import io
import itertools
import json

from django.core.management import call_command, CommandError
from django.core.cache import cache
from django.db import connection
from django.test import TransactionTestCase
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from .combined_competency import combined_is_unlocked
from .models import (Assessment, AssessmentAttemptHistory, Batch, BatchEnrollment,
    CombinedCategoryScore, CombinedCompetencyProfile, Company, OJTPlacement, Position,
    Recommendation, SkillCategory, SkillScore, StudentResponse, User)
from .recommendation_freshness import catalog_fingerprint, input_fingerprint
from .views import _batch_students_payload, bulk_management_states


class DatabaseCollectionTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.admin = User.objects.create_user('db-admin@example.invalid', name='Admin', role='admin')
        self.owner = User.objects.create_user('db-owner@example.invalid', name='Owner', role='instructor', is_approved=True)
        self.other = User.objects.create_user('db-other@example.invalid', name='Other', role='instructor', is_approved=True)
        User.objects.create_user('db-pending@example.invalid', name='Pending', role='instructor')
        User.objects.create_user('db-archived@example.invalid', name='Archived', role='instructor', is_active=False)
        self.batch = Batch.objects.create(name='Synthetic database cohort', instructor=self.owner)
        self.foreign = Batch.objects.create(name='Foreign cohort', instructor=self.other)
        self.assessment = Assessment.objects.create(title='Required evidence', created_by=self.owner, batch=self.batch)
        self.category = SkillCategory.objects.create(name='Database')
        self.company = Company.objects.create(name='Synthetic partner')
        self.position = Position.objects.create(company=self.company, title='Synthetic role', slots_available=50)
        self.students = []
        catalog = catalog_fingerprint()
        for i in range(1, 25):
            student = User.objects.create_user(f'db-student-{i}@example.invalid', name=f'Synthetic Student {i:02}',
                role='student', school_id=f'DB-{i:03}', course='BSIS' if i % 3 == 0 else 'BSIT', is_active=i % 7 != 0)
            self.students.append(student)
            BatchEnrollment.objects.create(student=student, batch=self.batch, profile_review_required=i == 23)
            submitted = bool(i % 2)
            response = StudentResponse.objects.create(student=student, assessment=self.assessment,
                status='stopped' if i % 5 == 0 else 'submitted' if submitted else 'in_progress',
                submitted_at=timezone.now() if submitted else None, is_flagged=i == 9, retake_allowed=i % 4 == 0)
            SkillScore.objects.create(student=student, assessment=self.assessment, skill_category=self.category,
                raw_score=i, max_score=30, percentage=i * 100 / 30)
            CombinedCategoryScore.objects.create(student=student, batch=self.batch, skill_category=self.category,
                raw_score=i, max_score=30, percentage=i * 100 / 30, source_assessment_ids=[self.assessment.id])
            if i != 13:
                CombinedCompetencyProfile.objects.create(student=student, batch=self.batch, is_finalized=True,
                    included_assessment_ids=[self.assessment.id], ranking_input_fingerprint='stale' if i == 11 else input_fingerprint(student, catalog))
            Recommendation.objects.create(student=student, batch=self.batch, position=self.position, match_score=i * 3)
            AssessmentAttemptHistory.objects.create(response=response, attempt_number=1, status='submitted',
                answers=[{'synthetic': 'synthetic-history-marker'}])
        OJTPlacement.objects.create(student=self.students[0], batch=self.batch, company=self.company, position=self.position, status='approved')
        self.admin_url = reverse('admin_users')
        self.roster_url = reverse('instructor_batch_students', args=[self.batch.id])
        self.client.force_authenticate(self.admin)

    def get(self, url, **params):
        response = self.client.get(url, params)
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def test_explicit_absent_profile_never_requeries_or_unlocks(self):
        progress = {'has_required_assessments': True, 'all_required_completed': True}
        with self.assertNumQueries(0):
            self.assertFalse(combined_is_unlocked(self.students[12], self.batch, profile=None,
                progress=progress, source_ids=[self.assessment.id], catalog='synthetic', review_required=False))
        with self.assertNumQueries(1):
            self.assertFalse(combined_is_unlocked(self.students[12], self.batch,
                progress=progress, source_ids=[self.assessment.id], catalog='synthetic', review_required=False))

    def test_lightweight_gates_equal_full_saved_state(self):
        full = bulk_management_states(self.students, self.batch)
        light = bulk_management_states(self.students, self.batch, summary_only=True)
        for student in self.students:
            self.assertEqual(full[student.id][1], light[student.id][1])
            for key in ('all_required_completed', 'completed_required_count', 'remaining_required_count', 'recommendations_locked'):
                self.assertEqual(full[student.id][0][key], light[student.id][0][key])

    def test_missing_profiles_and_inactive_evidence_have_bounded_query_counts(self):
        CombinedCompetencyProfile.objects.all().delete()
        User.objects.filter(id__in=[s.id for s in self.students]).update(is_active=False)
        for reader in (lambda students: bulk_management_states(students, self.batch),
                       lambda students: _batch_students_payload(self.batch, [s.id for s in students])):
            with CaptureQueriesContext(connection) as one:
                reader(self.students[:1])
            with CaptureQueriesContext(connection) as many:
                reader(self.students)
            self.assertEqual(len(one), len(many))
        historical = self.get(self.roster_url)['students']
        self.assertTrue(all(row['recommendations_locked'] for row in historical))
        self.assertTrue(all(row['combined_category_scores'] for row in historical))

    def test_admin_pages_preserve_records_counts_sort_and_history_details(self):
        legacy = self.get(self.admin_url)
        for tab, buckets in [('students', ['students']), ('instructors', ['instructors']),
                             ('pending', ['pending_instructors']), ('archived', ['archived_students', 'archived_instructors']),
                             ('all', ['students', 'instructors'])]:
            source = sorted([row for key in buckets for row in legacy[key]], key=lambda row: (row['name'], row['id']))
            actual = []
            for page in range(1, max(1, (len(source) + 4) // 5) + 1):
                result = self.get(self.admin_url, page=page, page_size=5, tab=tab)
                actual.extend(sorted([row for key in buckets for row in result[key]], key=lambda row: (row['name'], row['id'])))
                self.assertEqual(result['pagination']['count'], len(source))
                self.assertEqual(result['counts'][tab], len(source))
                self.assertNotIn('synthetic-history-marker', str(result))
            self.assertEqual([row['id'] for row in actual], [row['id'] for row in source])
            for row in actual:
                original = next(value for value in source if value['id'] == row['id'])
                for key in ('status', 'top_match_score', 'placement', 'combined_category_scores', 'recommendations_locked'):
                    self.assertEqual(row.get(key), original.get(key))
        detail = self.get(self.admin_url, student_id=self.students[0].id)
        self.assertEqual([s['id'] for s in detail['students']], [self.students[0].id])
        self.assertNotIn('pagination', detail)
        self.assertIn('synthetic-history-marker', str(detail))

    def test_admin_filters_match_existing_status_and_identity_contract(self):
        legacy = self.get(self.admin_url)['students']
        for status, course, search in itertools.product(('all', 'completed', 'pending', 'stopped'), ('all', 'BSIT', 'BSIS'), ('', '  STUDENT 01  ')):
            expected = [s for s in legacy if (status == 'all' or s['status'] == status)
                and (course == 'all' or s['course'] == course)
                and (not search.strip() or any(search.strip().lower() in s[key].lower() for key in ('name', 'email', 'student_id')))]
            result = self.get(self.admin_url, page=1, page_size=50, status=status, course=course, search=search)
            self.assertEqual({s['id'] for s in result['students']}, {s['id'] for s in expected})
            preview = self.get(self.admin_url, page=1, counts_only=1, status=status, course=course, search=search)
            self.assertEqual(preview['pagination']['count'], len(expected))
            self.assertEqual(preview['students'], [])
        result = self.get(self.admin_url, page=1, page_size=50, sort='match', direction='desc', instructor='Owner')
        self.assertEqual([s['id'] for s in result['students']], [s['id'] for s in sorted(legacy, key=lambda s: (s['top_match_score'] if s['top_match_score'] is not None else -1, s['id']), reverse=True)])

    def test_roster_filter_intersections_and_global_summary(self):
        legacy = self.get(self.roster_url)
        for assessment, recommendation, account, course in itertools.product(
                ('all', 'complete', 'incomplete', 'stopped', 'retake'),
                ('all', 'available', 'awaiting', 'approved'), ('all', 'active', 'archived'), ('all', 'BSIS')):
            def matches(s):
                available = not s['recommendations_locked'] and bool(s['top_recommendations'])
                values = {'all': True, 'complete': s['all_required_completed'], 'incomplete': not s['all_required_completed'],
                    'stopped': any(a['attempt_status'] == 'stopped' or a['is_flagged'] for a in s['assessment_results']),
                    'retake': any(a['retake_allowed'] for a in s['assessment_results'])}
                rec = {'all': True, 'available': available, 'awaiting': available and not s['has_current_approval'],
                       'approved': s['placement']['status'] == 'approved'}
                return values[assessment] and rec[recommendation] and (account == 'all' or (not s['is_active']) == (account == 'archived')) and (course == 'all' or s['course'] == course)
            expected = [s for s in legacy['students'] if matches(s)]
            result = self.get(self.roster_url, page=1, page_size=50, assessment=assessment, recommendation=recommendation, account=account, course=course)
            self.assertEqual({s['id'] for s in result['students']}, {s['id'] for s in expected}, (assessment, recommendation, account, course))
            self.assertEqual(result['pagination']['count'], len(expected))
            for key, value in legacy['summary'].items():
                self.assertEqual(result['summary'][key], value)

    def test_history_loaded_for_one_authorized_student_only(self):
        page = self.get(self.roster_url, page=1)
        self.assertEqual(len(page['students']), 10)
        self.assertNotIn('synthetic-history-marker', str(page))
        student = page['students'][0]
        self.client.force_authenticate(self.owner)
        detail = self.get(self.roster_url, student_id=student['id'])
        self.assertEqual(len(detail['students']), 1)
        self.assertIn('synthetic-history-marker', str(detail))
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(self.roster_url, {'page': 1}).status_code, 404)
        self.assertEqual(self.client.get(self.roster_url, {'student_id': student['id']}).status_code, 404)
        self.client.force_authenticate(self.students[0])
        for url in (self.roster_url, self.admin_url):
            self.assertEqual(self.client.get(url, {'page': 1}).status_code, 403)

    def test_roster_category_fallback_preserves_missing_evidence(self):
        CombinedCategoryScore.objects.all().delete()
        self.assertEqual(self.get(self.roster_url, page=1)['categories'], ['Database'])
        completed = [row['id'] for row in self.get(self.roster_url)['students'] if row['all_required_completed']]
        SkillScore.objects.filter(student_id__in=completed).delete()
        # A completed student can have missing saved scores; partial students'
        # available categories still supply the collection's placeholder columns.
        self.assertEqual(self.get(self.roster_url, page=1)['categories'], ['Database'])

    def test_validation_empty_results_clamping_and_no_writes(self):
        for url in (self.admin_url, self.roster_url):
            for params in ({'page': 'x'}, {'page': '0'}, {'page': 1, 'page_size': 51}, {'page': 1, 'counts_only': 'yes'},
                           {'page': 1, 'unknown': 'value'}, {'page': 1, 'page_size': ['5', '10']}, {'student_id': '9' * 5000}):
                self.assertEqual(self.client.get(url, params).status_code, 400, params)
            empty = self.get(url, page=999, search='never matches')
            self.assertEqual(empty['pagination'], {'count': 0, 'page': 1, 'page_size': 10})
            with CaptureQueriesContext(connection) as queries:
                self.get(url, page=999)
            self.assertFalse(any(q['sql'].lstrip().upper().startswith(('INSERT ', 'UPDATE ', 'DELETE ')) for q in queries))


class DatabasePerformanceReportTests(TransactionTestCase):
    def test_readonly_report_excludes_business_data(self):
        output = io.StringIO()
        if connection.vendor != 'postgresql':
            with self.assertRaises(CommandError):
                call_command('database_performance_report', stdout=output)
            return
        with CaptureQueriesContext(connection) as queries:
            call_command('database_performance_report', stdout=output)
        result = json.loads(output.getvalue())
        self.assertEqual(result['pending_migrations'], [])
        self.assertTrue(result['indexes'])
        self.assertFalse(any(q['sql'].lstrip().upper().startswith(('INSERT ', 'UPDATE ', 'DELETE ')) for q in queries))
        self.assertTrue(any('transaction_read_only = on' in q['sql'] for q in queries))
