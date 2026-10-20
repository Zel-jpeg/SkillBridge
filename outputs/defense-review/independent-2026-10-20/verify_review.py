"""Reproduce the independent review using synthetic, disposable databases only.

Run from the repository root with skillbridge-backend/venv/Scripts/python.exe.
Modes: sqlite (full suite), postgres (full suite), probes (two issue observations).
The runner clears Django's cache between tests, preserving throttles within tests.
No .env, normal DB credentials, provider calls or application edits are required.
"""
import json
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'skillbridge-backend'))
os.chdir(ROOT / 'skillbridge-backend')
mode = sys.argv[1] if len(sys.argv) > 1 else 'sqlite'
if mode not in ('sqlite', 'postgres', 'probes'):
    raise SystemExit('Choose sqlite, postgres or probes')
os.environ.update(PYTHON_DOTENV_DISABLED='1', DEBUG='True',
                  SECRET_KEY='independent-review-synthetic-test-secret-only')
os.environ['DJANGO_SETTINGS_MODULE'] = ('core.sse_postgres_test_settings'
                                       if mode == 'postgres' else 'core.test_settings')
if mode == 'postgres':
    os.environ.update(SB_TEST_DB_NAME='test_skillbridge_independent_20261020',
                      SB_TEST_DB_USER='sb_test', SB_TEST_DB_PASSWORD='',
                      SB_TEST_DB_HOST='127.0.0.1', SB_TEST_DB_PORT='55438')

import django
django.setup()
from django.core.cache import cache
from django.test.runner import DiscoverRunner


class IsolatedResult(unittest.TextTestResult):
    def startTest(self, test):
        cache.clear()
        super().startTest(test)


class ReviewRunner(DiscoverRunner):
    def get_resultclass(self):
        return IsolatedResult


if mode == 'probes':
    from django.urls import reverse
    from django.utils import timezone
    from rest_framework.test import APITestCase
    from api.combined_competency import recalculate_combined
    from api.models import (Assessment, Batch, BatchEnrollment, Company, OJTPlacement,
                            Position, PositionRequirement, Recommendation,
                            SkillCategory, SkillScore, StudentResponse, User)

    observations = {}

    class IssueObservations(APITestCase):
        def setUp(self):
            self.admin = User.objects.create_user('review-admin@example.invalid', role='admin')
            self.owner = User.objects.create_user('review-owner@example.invalid', role='instructor', is_approved=True)
            self.student = User.objects.create_user('review-student@example.invalid', role='student', is_approved=True)
            self.client.force_authenticate(self.admin)

        def test_observe_stale_recommendation_after_requirement_edit(self):
            batch = Batch.objects.create(name='Independent synthetic review', instructor=self.owner)
            BatchEnrollment.objects.create(batch=batch, student=self.student)
            first = SkillCategory.objects.create(name='Programming')
            second = SkillCategory.objects.create(name='Networking')
            assessment = Assessment.objects.create(title='Synthetic required assessment', batch=batch, created_by=self.owner)
            StudentResponse.objects.create(student=self.student, assessment=assessment,
                                           status='submitted', submitted_at=timezone.now())
            SkillScore.objects.create(student=self.student, assessment=assessment,
                                      skill_category=first, raw_score=1, max_score=2, percentage=50)
            company = Company.objects.create(name='Synthetic employer')
            position = Position.objects.create(company=company, title='Synthetic intern', slots_available=2)
            PositionRequirement.objects.create(position=position, skill_category=first, required_percentage=50)
            with patch('api.recommendation_nlp.preprocess_texts', side_effect=lambda texts, model:
                       (['shared synthetic tokens'] * len(texts), model, None)):
                recalculate_combined(self.student, batch)
                recommendation = Recommendation.objects.get(student=self.student, position=position)
                before = recommendation.match_score
                result = self.client.patch(reverse('admin_position_detail', args=[position.id]),
                    {'requirements': {'Networking': 50}}, format='json')
                self.assertEqual(result.status_code, 200)
                self.client.force_authenticate(self.student)
                visible = self.client.get(reverse('student_combined_results'))
                recommendation.refresh_from_db()
                saved_after_edit = recommendation.match_score
                self.assertEqual(visible.status_code, 200)
                self.assertFalse(visible.data['recommendations_locked'])
                self.assertEqual(before, saved_after_edit)
                self.assertTrue(recommendation.is_current)
                self.client.force_authenticate(self.admin)
                approval = self.client.post(reverse('placement_approve'),
                    {'recommendation_id': recommendation.id}, format='json')
                self.assertEqual(approval.status_code, 201)
                snapshot = OJTPlacement.objects.get().match_score_at_assignment
                recalculate_combined(self.student, batch)
                recommendation.refresh_from_db()
                self.assertNotEqual(saved_after_edit, recommendation.match_score)
                observations['stale_recommendations'] = {
                    'position_edit_http': result.status_code, 'student_get_http': visible.status_code,
                    'locked_after_edit': visible.data['recommendations_locked'],
                    'score_before_and_after_edit': saved_after_edit,
                    'approval_http': approval.status_code, 'assignment_snapshot': snapshot,
                    'score_after_explicit_recalculation': recommendation.match_score,
                    'nlp': 'deterministic mock isolates category change; no provider/model load',
                }

        def test_observe_category_malformed_name(self):
            self.client.raise_request_exception = False
            cases = []
            for value in (None, ['invalid'], 42, {}):
                response = self.client.post(reverse('categories'), {'name': value}, format='json')
                self.assertEqual(response.status_code, 500)
                cases.append({'name_json_type': type(value).__name__, 'http': response.status_code})
            self.assertEqual(SkillCategory.objects.count(), 0)
            observations['malformed_category_name'] = cases

    labels = ['__main__.IssueObservations']
else:
    labels = sys.argv[2:] or ['api']

runner = ReviewRunner(verbosity=2, interactive=False)
failed = runner.run_tests(labels)
if mode == 'probes':
    target = Path(__file__).with_name('issue-observations.json')
    target.write_text(json.dumps(observations, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(observations, indent=2))
raise SystemExit(bool(failed))
