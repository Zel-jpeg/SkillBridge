from unittest.mock import patch

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from rest_framework.test import APITestCase

from . import test_analytics
from .models import BatchEnrollment, CombinedCompetencyProfile, Institute, Program, User


class DashboardProjectionTests(APITestCase):
    setUp = test_analytics.AnalyticsTests.setUp
    ready = test_analytics.AnalyticsTests.ready

    def dashboard(self, **params):
        self.client.force_authenticate(self.admin)
        response = self.client.get(self.url, {'view': 'dashboard', **params})
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def test_summary_matches_overview_without_report_history_or_recalculation(self):
        self.ready(0)
        with patch('api.combined_competency.recalculate_combined', side_effect=AssertionError('Read only')):
            with CaptureQueriesContext(connection) as queries:
                data = self.dashboard()
        overview = self.client.get(self.url, {'view': 'overview'}).data
        self.assertEqual(data['summary'], overview['summary'])
        row = next(row for row in data['students'] if row['id'] == self.student.id)
        self.assertEqual(row['combined_category_scores'][0]['percentage'], 0)
        self.assertEqual(len(row['top_recommendations']), 1)
        self.assertFalse(row['competency_locked'])
        self.assertEqual(row['detail_url'], f'/api/instructor/batches/{self.batch.id}/students/?student_id={self.student.id}')
        self.assertFalse({'capacity', 'activity', 'placement_students'} & data.keys())
        self.assertNotIn('answers', str(data))
        self.assertNotIn('ranking_input_fingerprint', str(data))
        self.assertFalse(any('api_assessmentattempthistory' in q['sql'] for q in queries))
        self.assertFalse(any(q['sql'].lstrip().upper().startswith(('INSERT', 'UPDATE', 'DELETE')) for q in queries))

    def test_dashboard_is_admin_only(self):
        for user in (self.owner, self.student, self.other):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get(self.url, {'view': 'dashboard'}).status_code, 403)

    def test_stale_recommendations_keep_valid_assessment_scores(self):
        self.ready(80)
        CombinedCompetencyProfile.objects.filter(student=self.student).update(ranking_input_fingerprint='stale')
        data = self.dashboard()
        row = next(row for row in data['students'] if row['id'] == self.student.id)
        self.assertTrue(row['recommendations_locked'])
        self.assertEqual(row['top_recommendations'], [])
        self.assertFalse(row['competency_locked'])
        self.assertEqual(row['combined_category_scores'][0]['percentage'], 80)

    def test_program_views_keep_shared_full_roster_and_reject_other_institutes(self):
        institute = Institute.objects.create(code='SYN', name='Synthetic institute')
        other = Institute.objects.create(code='OTHER', name='Other synthetic institute')
        a = Program.objects.create(code='A', name='Program A', institute=institute)
        b = Program.objects.create(code='B', name='Program B', institute=institute)
        self.batch.institute = institute
        self.batch.save(update_fields=['institute'])
        self.ready(60)
        for program in (a, b):
            data = self.dashboard(institute_id=institute.id, program_id=program.id)
            self.assertEqual(data['summary']['students'], 1)
            self.assertEqual(data['students'][0]['batch_id'], self.batch.id)
            self.assertIsNone(data['students'][0]['program_id'])
            self.assertEqual(data['scope']['shared_batch_ids'], [self.batch.id])
        self.assertEqual(self.dashboard(institute_id=other.id)['students'], [])
        self.assertEqual(self.client.get(self.url, {'view': 'dashboard', 'institute_id': other.id, 'program_id': a.id}).status_code, 400)

    def test_latest_enrollment_and_query_count_do_not_grow_per_student(self):
        self.ready(70)
        self.dashboard()
        with CaptureQueriesContext(connection) as before:
            self.dashboard()
        for index in range(12):
            learner = User.objects.create_user(email=f'dashboard-{index}@example.invalid', role='student')
            BatchEnrollment.objects.create(batch=self.batch, student=learner)
        BatchEnrollment.objects.create(batch=self.foreign, student=self.student)
        with CaptureQueriesContext(connection) as after:
            data = self.dashboard()
        self.assertLessEqual(len(after), len(before) + 1)
        record = next(row for row in data['students'] if row['id'] == self.student.id)
        self.assertEqual(record['batch_id'], self.foreign.id)
        self.assertEqual(record['combined_category_scores'], [])
        self.assertEqual(len({row['id'] for row in data['students']}), data['summary']['students'])
        details = self.client.get(record['detail_url'])
        self.assertEqual(details.status_code, 200)
        self.assertEqual(details.data['batch']['id'], self.foreign.id)
        self.assertEqual([row['id'] for row in details.data['students']], [self.student.id])
