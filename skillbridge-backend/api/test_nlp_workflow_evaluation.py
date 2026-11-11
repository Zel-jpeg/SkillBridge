"""Synthetic current-policy evaluation contracts, isolated from school data."""
from copy import deepcopy
import json
from types import SimpleNamespace as Obj
from unittest.mock import patch

from django.db import connection
from django.test import SimpleTestCase
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from rest_framework.test import APITestCase

from .nlp_evaluation import DatasetError, Items, run_comparison
from .nlp_workflow_evaluation import (
    DATASET_PATH, _candidates, _input_fingerprint, _rank_case, run_workflow_comparison,
    workflow_coverage, workflow_data,
)
from .recommendation_policy import pooled_evidence


def identity_preprocess(texts, model, **kwargs):
    if kwargs.get('allow_fallback') is not False:
        raise AssertionError('Workflow evaluation must disable fallback')
    return list(texts), model, None


class WorkflowDatasetTests(SimpleTestCase):
    def test_200_cases_four_isolated_programs_fixed_labels_and_meaningful_candidates(self):
        cases, positions, metadata = workflow_data()
        self.assertEqual(len(cases), 200)
        self.assertEqual(len(positions), 16)
        self.assertEqual([program['case_count'] for program in metadata['programs']], [50] * 4)
        self.assertEqual(metadata['independent_evidence_patterns'], 40)
        self.assertEqual(len({case['id'] for case in cases}), 200)
        for case in cases:
            eligible = _candidates(case, positions)
            self.assertEqual(len(eligible), 4)
            self.assertTrue(all(p.program_id == case['program_id'] for p in eligible))
            if case['expected'] is not None:
                self.assertIn(case['expected'], [p.id for p in eligible])
            self.assertTrue(all(p.title not in case['text'] for p in positions))
        # IC's copied definitions have distinct IDs in the two program frameworks.
        it = next(case for case in cases if case['program_id'] == 'IT')
        info_systems = next(case for case in cases if case['program_id'] == 'IS')
        self.assertFalse(set(it['mapping']) & set(info_systems['mapping']))

    def test_program_scope_and_invalid_scope(self):
        for scope in ('IT', 'IS', 'SW', 'TOURISM'):
            metadata = workflow_coverage(scope)
            self.assertEqual(metadata['case_count'], 50)
            self.assertEqual(metadata['position_count'], 4)
            self.assertEqual(metadata['dataset']['programs'][0]['id'], scope)
        for invalid in ('IC', '', None, 1):
            with self.assertRaises(ValueError):
                workflow_data(invalid)

    def test_pooling_uses_unequal_raw_max_totals_not_mean_of_percentages(self):
        cases, _, _ = workflow_data('IT')
        case = cases[0]
        first_key = next(iter(case['scores']))
        rows = [row for row in case['evidence'] if row.skill_category_id == first_key]
        self.assertEqual(case['scores'][first_key], 90)
        self.assertNotAlmostEqual(sum(row.percentage for row in rows) / len(rows), 90)
        self.assertEqual(sum(row.max_score for row in rows), 100)

    def test_missing_category_is_absent_and_assessed_zero_keeps_raw_max_evidence(self):
        cases, _, _ = workflow_data('IT')
        missing = next(case for case in cases if case['coverage'] == 'missing_categories')
        zero = next(case for case in cases if case['coverage'] == 'assessed_zero')
        self.assertEqual(len(missing['scores']), 2)
        self.assertTrue(any(value == 0 for value in zero['scores'].values()))
        self.assertTrue(all(row.max_score > 0 for row in zero['combined']))

    def test_foreign_framework_and_score_ids_fail_closed(self):
        cases, positions, _ = workflow_data('IT')
        case = cases[0]
        wrong = deepcopy(positions[0])
        wrong.requirements[0].skill_category_id = 99999
        with self.assertRaises(ValueError):
            _candidates(case, [wrong])
        rows = [Obj(skill_category_id=99999, raw_score=5, max_score=10)]
        categories = [row.skill_category for row in case['combined']]
        with self.assertRaises(ValueError):
            pooled_evidence(rows, categories, exact_categories=True)

    def test_expected_labels_never_change_inputs_or_generated_text(self):
        cases, positions, _ = workflow_data('IT')
        first_hash = _input_fingerprint(cases, positions)
        changed = json.loads(DATASET_PATH.read_bytes())
        for program in changed['programs']:
            for scenario in program['scenarios']:
                scenario['expected_role'] = 3
        with patch('api.nlp_workflow_evaluation.DATASET_PATH') as path:
            path.read_bytes.return_value = json.dumps(changed).encode()
            other, other_positions, _ = workflow_data('IT')
        self.assertEqual([case['text'] for case in cases], [case['text'] for case in other])
        self.assertEqual(first_hash, _input_fingerprint(other, other_positions))

    @patch('api.nlp_workflow_evaluation.DATASET_PATH')
    def test_unreadable_or_bad_fixture_returns_dataset_error(self, path):
        for data in (b'{', b'{}'):
            path.read_bytes.return_value = data
            with self.assertRaises(DatasetError):
                workflow_data()

    @patch('api.recommendation_nlp.preprocess_texts', side_effect=identity_preprocess)
    def test_minimum_gate_missing_credit_and_no_positive_gate_match_production(self, preprocess):
        cases, positions, _ = workflow_data('IT')
        gated = next(case for case in cases if case['coverage'] == 'minimum_gate')
        rows, _ = _rank_case(gated, positions, 'spacy_md')
        # Role 0 has higher mean but misses its 70% category minimum (69%).
        self.assertEqual(rows[0]['position_id'], 1002)
        self.assertTrue(rows[0]['all_targets_met'])
        role0 = next(row for row in rows if row['position_id'] == 1001)
        self.assertGreater(role0['match_percentage'], rows[0]['match_percentage'])
        missing = next(case for case in cases if case['coverage'] == 'missing_categories')
        rows, _ = _rank_case(missing, positions, 'spacy_md')
        unassessed_role = next(row for row in rows if row['position_id'] == 1002)
        self.assertEqual(unassessed_role['match_percentage'], 0)
        self.assertEqual(unassessed_role['unknown_categories'], 2)
        zero = next(case for case in cases if case['coverage'] == 'no_positive_evidence')
        before = preprocess.call_count
        self.assertEqual(_rank_case(zero, positions, 'spacy_md'), ([], []))
        self.assertEqual(preprocess.call_count, before)

    @patch('api.recommendation_nlp.preprocess_texts', side_effect=identity_preprocess)
    @patch('api.nlp_workflow_evaluation._load_model', return_value=object())
    def test_all_models_receive_same_cases_and_expose_separate_nlp_metrics(self, load, preprocess):
        result = run_workflow_comparison('SW')
        self.assertEqual(result['status'], 'complete')
        self.assertEqual([model['status'] for model in result['models']], ['available'] * 3)
        self.assertEqual([len(model['predictions']) for model in result['models']], [50] * 3)
        for row in result['models']:
            self.assertEqual(row['metrics']['no_evidence_case_count'], 5)
            self.assertEqual(row['metrics']['nlp_only_case_count'], 45)
            self.assertEqual(row['metrics']['no_evidence_gate_agreement'], 1)
            self.assertGreaterEqual(row['metrics']['top1_accuracy'], 0)
            self.assertLessEqual(row['metrics']['top1_accuracy'], 1)
            self.assertEqual(row['program_metrics'][0]['program_id'], 'SW')
        inputs = [[call.args[0] for call in preprocess.call_args_list if call.args[1] == model]
                  for model in ('spacy_sm', 'spacy_md', 'stanza_en')]
        self.assertEqual(inputs[0], inputs[1])
        self.assertEqual(inputs[1], inputs[2])

    @patch('api.nlp_workflow_evaluation.position_specific_similarity')
    def test_location_breaks_equal_numeric_nlp_ties_without_changing_match(self, similarity):
        cases, positions, _ = workflow_data('IT')
        similarity.return_value = Obj(scores=[.5] * 4, model_used='spacy_md', fallback_reason=None)
        tied = [case for case in cases if case['coverage'] == 'numeric_tie']
        near_first = next(case for case in tied if case['location_variant'] == 'near-panabo')
        near_fourth = next(case for case in tied if case['location_variant'] == 'near-role-four')
        unknown_location = next(case for case in tied if case['location_variant'] == 'missing')
        first_rows, _ = _rank_case(near_first, positions, 'spacy_md')
        fourth_rows, _ = _rank_case(near_fourth, positions, 'spacy_md')
        missing_rows, _ = _rank_case(unknown_location, positions, 'spacy_md')
        self.assertEqual(first_rows[0]['position_id'], 1001)
        self.assertEqual(fourth_rows[0]['position_id'], 1004)
        self.assertEqual([row['position_id'] for row in missing_rows], [1001, 1002, 1003, 1004])
        self.assertTrue(all(row['match_percentage'] == 80 for row in first_rows + fourth_rows + missing_rows))
        self.assertTrue(all(row['location_percent'] == 50 for row in missing_rows))

    @patch('api.recommendation_nlp.preprocess_texts', side_effect=identity_preprocess)
    @patch('api.nlp_workflow_evaluation._load_model')
    def test_missing_model_cannot_borrow_fallback_scores(self, load, preprocess):
        load.side_effect = [OSError('missing'), object(), object()]
        result = run_comparison('workflow_simulation', 'IT')
        self.assertEqual([m['status'] for m in result['models']], ['unavailable', 'available', 'available'])
        self.assertIsNone(result['models'][0]['metrics'])
        self.assertNotIn('predictions', result['models'][0])

    @patch('api.nlp_workflow_evaluation._load_model', return_value=object())
    @patch('api.recommendation_nlp.preprocess_texts')
    def test_wrong_actual_model_is_error_not_success(self, preprocess, load):
        preprocess.side_effect = lambda texts, model, **kwargs: (list(texts), 'simple_fallback', 'missing')
        result = run_workflow_comparison('IT')
        self.assertEqual([m['status'] for m in result['models']], ['error'] * 3)
        self.assertTrue(all(m['metrics'] is None for m in result['models']))


class WorkflowEvaluationAPITests(APITestCase):
    def setUp(self):
        from .models import User
        self.admin = User.objects.create_user(email='synthetic-workflow@example.com', name='Synthetic admin', role='admin')
        self.client.force_authenticate(self.admin)
        self.url = reverse('admin_nlp_model_comparison')

    @patch('api.nlp_workflow_evaluation._load_model')
    def test_get_coverage_does_not_load_models_or_write_database(self, load):
        with CaptureQueriesContext(connection) as queries:
            response = self.client.get(self.url, {'mode': 'workflow_simulation', 'program_scope': 'all', '_t': 'synthetic-revalidation'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['case_count'], 200)
        self.assertEqual(len(response.data['dataset']['programs']), 4)
        load.assert_not_called()
        self.assertFalse(any(query['sql'].lstrip().upper().startswith(('INSERT', 'UPDATE', 'DELETE')) for query in queries))
        self.assertEqual(self.client.post(self.url, {'_t': 'GET-only'}).status_code, 400)

    @patch('api.nlp_workflow_evaluation._load_model', return_value=object())
    @patch('api.recommendation_nlp.preprocess_texts', side_effect=identity_preprocess)
    def test_default_post_current_workflow_and_explicit_program_are_read_only(self, preprocess, load):
        from .models import Recommendation, RecommendationConfiguration, StudentCompetencyProfile
        with CaptureQueriesContext(connection) as queries:
            response = self.client.post(self.url, {'program_scope': 'IS'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['mode'], 'workflow_simulation')
        self.assertEqual(response.data['case_count'], 50)
        self.assertEqual(len(response.data['models']), 3)
        self.assertTrue(response.data['evaluated_at'])
        self.assertFalse(any(query['sql'].lstrip().upper().startswith(('INSERT', 'UPDATE', 'DELETE')) for query in queries))
        for model in (Recommendation, RecommendationConfiguration, StudentCompetencyProfile):
            self.assertEqual(model.objects.count(), 0)

    def test_coverage_get_permissions_and_invalid_scope(self):
        from .models import User
        self.assertEqual(self.client.get(self.url, {'program_scope': 'IC'}).status_code, 400)
        self.assertEqual(self.client.post(self.url, {'program_scope': 'IC'}).status_code, 400)
        for role in ('student', 'instructor'):
            user = User.objects.create_user(email=f'workflow-{role}@example.com', name=role, role=role)
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get(self.url).status_code, 403)
            self.assertEqual(self.client.post(self.url).status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(self.url).status_code, 401)

    def test_malformed_payloads_and_unknown_keys_are_400_not_server_errors(self):
        for payload in ([], ['workflow_simulation'], 'workflow_simulation', 123, None,
                        {'mode': None}, {'mode': []}, {'mode': True}, {'mode': {}},
                        {'program_scope': None}, {'program_scope': []}, {'program_scope': True},
                        {'program_scope': {}}, {'batch_id': 1}):
            with self.subTest(payload=payload):
                response = self.client.generic('POST', self.url, json.dumps(payload), content_type='application/json')
                self.assertEqual(response.status_code, 400)
        self.assertEqual(self.client.get(self.url, {'unknown': 'value'}).status_code, 400)
        self.assertEqual(self.client.get(f'{self.url}?program_scope=IT&program_scope=SW').status_code, 400)

    @patch('api.nlp_workflow_evaluation.DATASET_PATH')
    def test_missing_workflow_fixture_reports_503(self, path):
        path.read_bytes.side_effect = OSError('missing')
        self.assertEqual(self.client.get(self.url).status_code, 503)
        self.assertEqual(self.client.post(self.url).status_code, 503)
