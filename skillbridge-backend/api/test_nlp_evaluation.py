from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch

from django.db import connection
from django.test import SimpleTestCase
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import (Assessment, Company, OJTPlacement, Position, PositionRequirement,
                     Recommendation, RecommendationConfiguration, SkillCategory, SkillScore,
                     StudentCompetencyProfile, StudentResponse, User)
from .nlp_evaluation import prepared_data, ranking_metrics, real_data, run_comparison


def fake_preprocess(texts, model_id, **kwargs):
    # Unit-test ranking and API safety without requiring optional language models.
    return texts, model_id, None


class EvaluationMetricTests(SimpleTestCase):
    def test_known_metrics_and_stable_ties(self):
        cases = [{'id': str(i), 'expected': i} for i in (1, 2, 3)]
        positions = [SimpleNamespace(id=i) for i in (1, 2, 3, 4)]
        metrics, rows = ranking_metrics(cases, positions,
            [[1, 0, 0, 0], [1, 0, 0, 0], [0, 0, 0, 1]])
        self.assertAlmostEqual(metrics['top1_accuracy'], 1 / 3)
        self.assertAlmostEqual(metrics['top3_accuracy'], 2 / 3)
        self.assertAlmostEqual(metrics['precision'], .125)
        self.assertAlmostEqual(metrics['recall'], .25)
        self.assertAlmostEqual(metrics['f1'], 1 / 6)
        self.assertEqual(rows[1]['top3_position_ids'], [1, 2, 3])

    def test_dataset_has_balanced_labels_and_no_target_title_in_profile(self):
        cases, positions, metadata = prepared_data()
        self.assertEqual(len(cases), 60)
        self.assertEqual(len(positions), 6)
        for position in positions:
            self.assertEqual(sum(c['expected'] == position.id for c in cases), 10)
            self.assertTrue(all(position.title not in c['text'] for c in cases))
        self.assertEqual(len(metadata['sha256']), 64)

    @patch('api.nlp_evaluation.preprocess_texts', side_effect=fake_preprocess)
    @patch('api.nlp_evaluation._load_model')
    def test_missing_model_does_not_substitute_fallback_or_stop_others(self, load, preprocess):
        load.side_effect = [object(), OSError('missing medium'), object()]
        result = run_comparison('evaluation_dataset')
        self.assertEqual([m['status'] for m in result['models']], ['available', 'unavailable', 'available'])
        self.assertIsNone(result['models'][1]['metrics'])
        self.assertEqual(preprocess.call_count, 2)
        self.assertFalse(preprocess.call_args.kwargs['allow_fallback'])

    @patch('api.nlp_evaluation._load_model', return_value=object())
    @patch('api.nlp_evaluation.preprocess_texts')
    def test_processing_failure_is_isolated(self, preprocess, load):
        def process(texts, model_id, **kwargs):
            if model_id == 'spacy_sm':
                raise RuntimeError('bad model')
            return fake_preprocess(texts, model_id)
        preprocess.side_effect = process
        result = run_comparison('evaluation_dataset')
        self.assertEqual([m['status'] for m in result['models']], ['error', 'available', 'available'])

    @patch('api.recommendation_nlp._load_model', side_effect=OSError('missing'))
    def test_strict_preprocessing_raises_but_production_still_falls_back(self, load):
        from .recommendation_nlp import preprocess_texts
        with self.assertRaises(OSError):
            preprocess_texts(['Python code'], 'spacy_md', allow_fallback=False)
        self.assertEqual(preprocess_texts(['Python code'], 'spacy_md')[1], 'simple_fallback')


class EvaluationAPITests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email='eval-admin@example.com', name='Admin', role='admin')
        self.url = reverse('admin_nlp_model_comparison')
        self.client.force_authenticate(self.admin)

    def test_auth_and_invalid_mode(self):
        self.assertEqual(self.client.post(self.url, {'mode': 'invalid'}).status_code, 400)
        for role in ('student', 'instructor'):
            user = User.objects.create_user(email=f'{role}@example.com', name=role, role=role)
            self.client.force_authenticate(user)
            self.assertEqual(self.client.post(self.url).status_code, 403)
            self.assertEqual(self.client.patch(reverse('admin_nlp_configuration'), {'active_model': 'spacy_sm'}).status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.post(self.url).status_code, 401)

    @patch('api.nlp_evaluation.DATASET_PATH')
    def test_bad_dataset_returns_clear_error(self, path):
        path.read_bytes.side_effect = OSError('missing')
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data['status'], 'dataset_error')

    @patch('api.nlp_evaluation._load_model')
    def test_empty_real_data_does_not_load_models(self, load):
        response = self.client.post(self.url, {'mode': 'real_placement_data'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'insufficient_data')
        self.assertEqual(response.data['case_count'], 0)
        load.assert_not_called()

    @patch('api.nlp_evaluation._load_model', return_value=object())
    @patch('api.nlp_evaluation.preprocess_texts', side_effect=fake_preprocess)
    def test_prepared_endpoint_performs_no_database_writes(self, preprocess, load):
        with CaptureQueriesContext(connection) as queries:
            response = self.client.post(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['case_count'], 60)
        self.assertFalse(any(q['sql'].lstrip().upper().startswith(('INSERT', 'UPDATE', 'DELETE')) for q in queries))
        self.assertEqual(RecommendationConfiguration.objects.count(), 0)
        self.assertEqual(Recommendation.objects.count(), 0)
        self.assertEqual(StudentCompetencyProfile.objects.count(), 0)

    def make_placements(self):
        category = SkillCategory.objects.create(name='Programming', tags=['Python'], created_by=self.admin)
        company = Company.objects.create(name='Evaluation Company', added_by=self.admin)
        positions = []
        for i in range(3):
            position = Position.objects.create(title=f'Position {i}', company=company)
            PositionRequirement.objects.create(position=position, skill_category=category, required_percentage=80)
            positions.append(position)
        assessment = Assessment.objects.create(title='Before approval', created_by=self.admin)
        later = Assessment.objects.create(title='After approval', created_by=self.admin)
        now = timezone.now()
        for i in range(5):
            student = User.objects.create_user(email=f'placed{i}@example.com', name=f'Student {i}', role='student')
            StudentResponse.objects.create(student=student, assessment=assessment, status='submitted', submitted_at=now - timedelta(days=1))
            SkillScore.objects.create(student=student, assessment=assessment, skill_category=category, percentage=80)
            StudentResponse.objects.create(student=student, assessment=later, status='submitted', submitted_at=now + timedelta(days=1))
            SkillScore.objects.create(student=student, assessment=later, skill_category=category, percentage=0)
            OJTPlacement.objects.create(student=student, company=company, position=positions[i % 3], status='approved', approved_at=now)
        return positions

    @patch('api.nlp_evaluation._load_model', return_value=object())
    @patch('api.nlp_evaluation.preprocess_texts', side_effect=fake_preprocess)
    def test_real_mode_uses_approvals_and_preapproval_scores_without_writes(self, preprocess, load):
        positions = self.make_placements()
        cases, _, _ = real_data()
        self.assertEqual(len(cases), 5)
        self.assertTrue(all('strong' in c['text'] for c in cases))
        # Equal category fit (1) and neutral location (.5) give base = .675.
        self.assertTrue(all(abs(v - .675) < 1e-9 for c in cases for v in c['base_scores']))
        with CaptureQueriesContext(connection) as queries:
            response = self.client.post(self.url, {'mode': 'real_placement_data'})
        self.assertEqual(response.data['status'], 'complete')
        self.assertEqual(response.data['case_count'], 5)
        self.assertEqual(response.data['models'][0]['metrics']['top3_accuracy'], 1)
        self.assertFalse(any(q['sql'].lstrip().upper().startswith(('INSERT', 'UPDATE', 'DELETE')) for q in queries))
        self.assertEqual(set(response.data['models'][0]['predictions'][0]['top3_position_ids']), {p.id for p in positions})
        OJTPlacement.objects.all().update(status='suggested')
        response = self.client.post(self.url, {'mode': 'real_placement_data'})
        self.assertEqual(response.data['status'], 'insufficient_data')
