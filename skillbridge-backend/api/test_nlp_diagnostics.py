import json
from copy import deepcopy
from datetime import timedelta
from types import SimpleNamespace as Obj
from unittest.mock import patch

from django.db import connection
from django.test import SimpleTestCase
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import (Assessment, Batch, BatchEnrollment, Company, Position, PositionRequirement,
                     Recommendation, SkillCategory, SkillScore, StudentCompetencyProfile, StudentResponse, User)
from .nlp_evaluation import DATASET_PATH, prepared_data, ranking_diagnostics, ranking_metrics
from .recommendation_nlp import build_student_profile, suggest_skill_tags, suggest_position_tags
from .skill_taxonomy import taxonomy_diagnostics


class TaxonomyTests(SimpleTestCase):
    def test_weak_category_suggestions_and_aliases(self):
        for name, expected in [('Cloud', 'AWS'), ('DevOps', 'Docker'), ('Tools', 'Postman'),
                               ('Version Control', 'Git'), ('Operating Systems', 'Linux')]:
            tags = suggest_skill_tags(name)
            self.assertIn(expected, tags)
            self.assertGreaterEqual(len(tags), 8)
            self.assertNotIn(name, tags)
        self.assertEqual(suggest_skill_tags('Database'), suggest_skill_tags('Database Management'))
        self.assertEqual(suggest_skill_tags(''), [])
        self.assertEqual(suggest_skill_tags('Unmapped Category'), [])

    def test_roles_do_not_copy_all_category_tags(self):
        requirements = [{'name': 'Cloud', 'percentage': 95, 'tags': ['AWS', 'Azure']}]
        self.assertIn('test cases', suggest_position_tags('QA Tester Intern', requirements))
        self.assertNotIn('AWS', suggest_position_tags('QA Tester Intern', requirements))
        self.assertIn('React components', suggest_position_tags('Front-end Developer Intern'))
        self.assertIn('Django', suggest_position_tags('Backend Developer Intern'))

    def test_taxonomy_detects_issues_without_mutating_categories(self):
        cats = [Obj(id=1, name='Database', tags=['SQL', 'backup', 'indexing', 'ERD']),
                Obj(id=2, name='Database Management', tags=['SQL', 'backup', 'indexing', 'ERD']),
                Obj(id=3, name='DATABASE', tags=[]), Obj(id=4, name='Tools', tags=['Tools'])]
        before = deepcopy([vars(c) for c in cats])
        diagnostics = taxonomy_diagnostics(cats)
        self.assertTrue({'duplicate_name', 'near_duplicate', 'no_tags', 'few_tags', 'generic_tags', 'tag_overlap'}
                        <= {w['code'] for w in diagnostics['warnings']})
        self.assertEqual(before, [vars(c) for c in cats])

    def test_labels_cannot_influence_generated_profiles(self):
        original = json.loads(DATASET_PATH.read_bytes())
        first, positions, _ = prepared_data()
        changed = deepcopy(original)
        for case in changed['cases']:
            case['expected_position_id'] = case['expected_position_id'] % len(positions) + 1
            case['archetype'] = 'Forbidden expected role leaked from label'
        with patch('api.nlp_evaluation.DATASET_PATH') as path:
            path.read_bytes.return_value = json.dumps(changed).encode()
            second, _, _ = prepared_data()
        self.assertEqual([c['text'] for c in first], [c['text'] for c in second])
        self.assertEqual(original, json.loads(DATASET_PATH.read_bytes()))

    def test_zero_scores_and_generic_tags_are_not_positive_evidence(self):
        category = Obj(name='Tools', tags=['Tools', 'Postman'])
        text = build_student_profile([Obj(skill_category=category, percentage=0)])
        self.assertNotIn('Postman', text)
        text = build_student_profile([Obj(skill_category=category, percentage=90)])
        self.assertIn('Postman', text)
        self.assertNotIn('category vocabulary: Tools', text)
        self.assertEqual(category.tags, ['Tools', 'Postman'])

    def test_confusions_and_near_misses_from_known_rankings(self):
        cases = [{'id': str(i), 'expected': i} for i in (1, 2, 3)]
        positions = [Obj(id=i) for i in (1, 2, 3)]
        _, rows = ranking_metrics(cases, positions, [[1, 0, 0], [1, .5, 0], [1, .5, .1]])
        diagnostics = ranking_diagnostics(rows)
        self.assertEqual([r['expected_rank'] for r in diagnostics['near_misses']], [2, 3])
        self.assertEqual(sum(p['count'] for p in diagnostics['common_confusions']), 2)
        self.assertEqual(rows[1]['top3_scores'], [1, .5, 0])


class TextPreviewAPITests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email='preview-admin@example.com', name='Admin', role='admin')
        self.instructor = User.objects.create_user(email='preview-teacher@example.com', name='Teacher', role='instructor')
        self.other = User.objects.create_user(email='preview-other@example.com', name='Other', role='instructor')
        self.student = User.objects.create_user(email='preview-student@example.com', name='Student', role='student')
        batch = Batch.objects.create(name='My batch', instructor=self.instructor)
        other_batch = Batch.objects.create(name='Other batch', instructor=self.other)
        BatchEnrollment.objects.create(batch=batch, student=self.student)
        BatchEnrollment.objects.create(batch=other_batch, student=self.student)
        self.assessment = Assessment.objects.create(title='Mine', batch=batch, created_by=self.instructor)
        self.other_assessment = Assessment.objects.create(title='Other', batch=other_batch, created_by=self.other)
        self.category = SkillCategory.objects.create(name='Cloud', tags=['AWS'], created_by=self.admin)
        for a, pct, date in [(self.assessment, 80, timezone.now() - timedelta(days=1)),
                             (self.other_assessment, 95, timezone.now())]:
            StudentResponse.objects.create(student=self.student, assessment=a, status='submitted', submitted_at=date)
            SkillScore.objects.create(student=self.student, assessment=a, skill_category=self.category, percentage=pct)
        self.profile = StudentCompetencyProfile.objects.create(student=self.student, assessment=self.assessment,
            competency_profile_text='Previously generated profile retained unchanged')
        company = Company.objects.create(name='Test Co', added_by=self.admin)
        self.position = Position.objects.create(title='Cloud Engineer Intern', company=company, tags=['AWS deployment'])
        PositionRequirement.objects.create(position=self.position, skill_category=self.category, required_percentage=85)
        self.recommendation = Recommendation.objects.create(student=self.student, position=self.position, match_score=72)
        self.url = reverse('student_nlp_text', args=[self.student.id])
        self.pos_url = reverse('position_nlp_text', args=[self.position.id])

    def test_instructor_sees_only_assessments_in_own_batches(self):
        self.client.force_authenticate(self.instructor)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['assessment_id'], self.assessment.id)
        response = self.client.get(self.url, {'assessment_id': self.other_assessment.id})
        self.assertEqual(response.data['status'], 'empty')
        BatchEnrollment.objects.filter(student=self.student, batch__instructor=self.instructor).delete()
        self.assertEqual(self.client.get(self.url).status_code, 403)

    def test_admin_can_view_all_and_previews_never_write_or_query_answers(self):
        self.client.force_authenticate(self.admin)
        with CaptureQueriesContext(connection) as queries:
            student = self.client.get(self.url, {'assessment_id': self.assessment.id})
            position = self.client.get(self.pos_url)
            taxonomy = self.client.get(reverse('taxonomy_quality'))
        self.assertEqual(student.data['texts'][0]['text'], self.profile.competency_profile_text)
        self.assertIn('80 percent', student.data['texts'][1]['text'])
        self.assertIn('Cloud: 85 percent', position.data['texts'][0]['text'])
        self.assertEqual(taxonomy.status_code, 200)
        for query in queries:
            sql = query['sql'].lower().lstrip()
            self.assertFalse(sql.startswith(('insert', 'update', 'delete')))
            self.assertFalse(any(table in sql for table in ('api_question', 'api_answerchoice', 'api_responseanswer')))
        self.profile.refresh_from_db()
        self.recommendation.refresh_from_db()
        self.assertEqual(self.profile.competency_profile_text, 'Previously generated profile retained unchanged')
        self.assertEqual(self.recommendation.match_score, 72)
        self.assertEqual(self.client.get(self.url).data['assessment_id'], self.other_assessment.id)

    def test_student_denied_staff_tools_and_staff_position_access(self):
        for role in (self.admin, self.instructor, self.other):
            self.client.force_authenticate(role)
            self.assertEqual(self.client.get(self.pos_url).status_code, 200)
        self.client.force_authenticate(self.student)
        for url in (self.url, self.pos_url, reverse('taxonomy_quality')):
            self.assertEqual(self.client.get(url).status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(self.url).status_code, 401)

    def test_suggestions_preserve_saved_tags_and_scores(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(reverse('suggest_tags'), {'type': 'skill', 'name': 'Cloud'}, format='json')
        self.assertIn('Azure', response.data['suggested_tags'])
        self.category.refresh_from_db()
        self.assertEqual(self.category.tags, ['AWS'])
        self.assertEqual(SkillScore.objects.filter(student=self.student).count(), 2)
        accepted = self.client.put(reverse('admin_skill_detail', args=[self.category.id]),
            {'name': 'Cloud', 'description': '', 'tags': response.data['suggested_tags']}, format='json')
        self.assertEqual(accepted.status_code, 200)
        changed_position = self.client.patch(reverse('admin_position_detail', args=[self.position.id]),
            {'tags': ['cloud deployment', 'serverless']}, format='json')
        self.assertEqual(changed_position.status_code, 200)
        self.recommendation.refresh_from_db()
        self.profile.refresh_from_db()
        self.assertEqual(self.recommendation.match_score, 72)
        self.assertEqual(self.profile.competency_profile_text, 'Previously generated profile retained unchanged')
        self.assertEqual(list(SkillScore.objects.filter(student=self.student).order_by('percentage')
                              .values_list('percentage', flat=True)), [80, 95])

    def test_simplified_student_profile_excludes_technical_text(self):
        from .views import serialize_competency_profile
        payload = serialize_competency_profile(self.profile, include_nlp_text=False)
        self.assertNotIn('competency_profile_text', payload)
        self.assertIn('orientation_summary', payload)
