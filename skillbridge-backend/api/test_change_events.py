import json
import os
import subprocess
import sys
from datetime import timedelta
from unittest import skipUnless
from unittest.mock import patch

from django.db import connection, transaction
from django.test import RequestFactory, TestCase, TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from .change_events import audience, publish_changes
from .models import (
    Assessment, Batch, BatchEnrollment, ChangeEvent, CombinedCompetencyProfile,
    User,
)
from .sse import _event_stream, admin_events, instructor_events, student_events


class ChangeEventTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user('admin@synthetic.invalid', role='admin', name='Admin')
        self.teacher = User.objects.create_user('teacher@synthetic.invalid', role='instructor', name='Teacher', is_approved=True)
        self.other = User.objects.create_user('other@synthetic.invalid', role='instructor', name='Other', is_approved=True)
        self.student = User.objects.create_user('student@synthetic.invalid', role='student', name='Student', is_approved=True)
        self.foreign = User.objects.create_user('foreign@synthetic.invalid', role='student', name='Foreign', is_approved=True)
        self.batch = Batch.objects.create(name='Synthetic cohort', instructor=self.teacher)
        self.foreign_batch = Batch.objects.create(name='Foreign cohort', instructor=self.other)
        BatchEnrollment.objects.create(student=self.student, batch=self.batch)
        BatchEnrollment.objects.create(student=self.foreign, batch=self.foreign_batch)
        self.assessment = Assessment.objects.create(title='Synthetic draft', batch=self.batch, created_by=self.teacher, publication_status='draft')
        self.client = APIClient()
        self.client.force_authenticate(self.teacher)

    def request(self, user):
        from types import SimpleNamespace
        return SimpleNamespace(user=user, data={})

    def test_publication_waits_for_commit_and_full_recalculation(self):
        # Archive calls recalculation after batch.save(), outside its inner work.
        def derived(batch):
            self.assertFalse(ChangeEvent.objects.exists())
            CombinedCompetencyProfile.objects.create(student=self.student, batch=batch)
        with patch('api.views.recalculate_enrolled_students', side_effect=derived):
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.post(f'/api/instructor/batches/{self.batch.id}/archive/')
                self.assertEqual(response.status_code, 200)
                self.assertFalse(ChangeEvent.objects.exists())
        self.assertTrue(CombinedCompetencyProfile.objects.exists())
        self.assertEqual(set(ChangeEvent.objects.values_list('recipient_id', flat=True)), {self.admin.id, self.teacher.id, self.student.id})

    def test_rollback_and_rejected_operation_publish_nothing(self):
        with self.captureOnCommitCallbacks(execute=True):
            try:
                with transaction.atomic():
                    self.client.post('/api/instructor/batches/', {'name': 'Rolled back'})
                    raise ValueError('synthetic rollback')
            except ValueError:
                pass
            response = self.client.patch(f'/api/instructor/assessments/{self.assessment.id}/', {'title': ''}, format='json')
            self.assertEqual(response.status_code, 400)
        self.assertFalse(ChangeEvent.objects.exists())
        self.assertFalse(Batch.objects.filter(name='Rolled back').exists())

    def test_bulk_enrollment_coalesces_and_preserves_scope(self):
        rows = [{'student_id': f'2099-{index:05d}', 'name': f'Synthetic {index}', 'email': f'synthetic{index}@dnsc.edu.ph', 'course': 'BSIT'} for index in range(4)]
        url = f'/api/instructor/batches/{self.batch.id}/enroll/'
        preview = self.client.post(url + 'preview/', {'students': rows}, format='json')
        self.assertEqual(preview.status_code, 200)
        with patch('api.views.send_instructor_email', return_value=False):
            with self.captureOnCommitCallbacks(execute=True):
                result = self.client.post(url, {'students': preview.data['rows'], 'review_token': preview.data['review_token']}, format='json')
                self.assertEqual(result.status_code, 200)
        self.assertEqual(result.data['summary']['enrolled'], 4)
        self.assertEqual(ChangeEvent.objects.filter(recipient=self.admin).count(), 1)
        self.assertEqual(ChangeEvent.objects.filter(recipient=self.teacher).count(), 1)
        self.assertFalse(ChangeEvent.objects.filter(recipient__in=[self.other, self.foreign]).exists())
        for event in ChangeEvent.objects.filter(recipient__role='student'):
            self.assertEqual(event.payload['batch_ids'], [self.batch.id])

    def test_removal_notifies_previous_student_and_instructor(self):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(f'/api/instructor/students/{self.student.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(ChangeEvent.objects.filter(recipient=self.student).exists())
        self.assertTrue(ChangeEvent.objects.filter(recipient=self.teacher).exists())
        self.assertFalse(ChangeEvent.objects.filter(recipient=self.other).exists())

    def test_payloads_contain_only_scoped_invalidation_metadata(self):
        result = audience('attempt', self.request(self.student), {'assessment_id': self.assessment.id})
        self.assertEqual(set(result), {self.admin.id, self.teacher.id, self.student.id})
        self.assertEqual(result[self.student.id]['student_ids'], [self.student.id])
        self.assertNotIn('assessment_ids', result[self.student.id])
        self.assertNotIn(self.foreign_batch.id, result[self.teacher.id]['batch_ids'])
        serialized = json.dumps(result)
        for forbidden in ['email', 'name', 'answer', 'token', 'question_text']:
            self.assertNotIn(forbidden, serialized)
        self.assertLess(len(json.dumps(result[self.teacher.id])), 1024)

    def test_implicit_shared_category_creation_reaches_other_instructors_without_batch_ids(self):
        with self.captureOnCommitCallbacks(execute=True):
            result = self.client.post('/api/instructor/assessments/', {
                'title': 'Another draft', 'publication_status': 'draft', 'batch_id': self.batch.id,
                'questions': [{'question_text': 'Synthetic question', 'category': 'New shared category',
                               'question_type': 'identification', 'correct_answer': 'Synthetic answer'}],
            }, format='json')
        self.assertEqual(result.status_code, 201)
        payload = ChangeEvent.objects.get(recipient=self.other).payload
        self.assertEqual(payload, {'topics': ['taxonomy']})

    def test_shared_catalog_ignores_unrelated_client_supplied_scope_fields(self):
        request = self.request(self.admin)
        request.data = {'student_id': self.foreign.id, 'batch_id': self.foreign_batch.id,
                        'assessment_id': self.assessment.id}
        for payload in audience('catalog', request, {}).values():
            self.assertEqual(set(payload), {'topics'})

    def test_instructor_with_shared_student_does_not_receive_other_batch_assessment_ids(self):
        BatchEnrollment.objects.create(student=self.student, batch=self.foreign_batch)
        result = audience('attempt', self.request(self.student), {'assessment_id': self.assessment.id})
        self.assertIn(self.other.id, result)  # Authorized to see this student's own-batch displays.
        self.assertNotIn('assessment_ids', result[self.other.id])
        self.assertEqual(result[self.other.id]['batch_ids'], [self.foreign_batch.id])

    def test_publication_failure_does_not_fail_committed_operation(self):
        with patch.object(ChangeEvent.objects, 'bulk_create', side_effect=RuntimeError('synthetic transport failure')):
            with self.assertLogs('api.change_events', level='ERROR'):
                with self.captureOnCommitCallbacks(execute=True):
                    response = self.client.post('/api/instructor/batches/', {'name': 'Still committed'})
        self.assertEqual(response.status_code, 201)
        self.assertTrue(Batch.objects.filter(name='Still committed').exists())

    def sse_request(self, user, **params):
        return RequestFactory().get('/api/events/', {'token': str(AccessToken.for_user(user)), **params})

    def test_subscriber_roles_approval_activity_enrollment_and_expiry(self):
        self.assertEqual(student_events(self.sse_request(self.student, check='1')).status_code, 204)
        self.assertEqual(admin_events(self.sse_request(self.student)).status_code, 401)
        self.assertEqual(instructor_events(self.sse_request(self.teacher, check='1')).status_code, 204)
        self.teacher.is_approved = False
        self.teacher.save()
        self.assertEqual(instructor_events(self.sse_request(self.teacher)).status_code, 401)
        self.student.is_active = False
        self.student.save()
        self.assertEqual(student_events(self.sse_request(self.student)).status_code, 401)
        BatchEnrollment.objects.filter(student=self.foreign).delete()
        self.assertEqual(student_events(self.sse_request(self.foreign)).status_code, 401)
        token = AccessToken.for_user(self.admin)
        token.set_exp(lifetime=-timedelta(seconds=1))
        self.assertEqual(admin_events(RequestFactory().get('/', {'token': str(token)})).status_code, 401)

    @patch('api.sse.connections.close_all')
    @patch('api.sse.time.sleep')
    def test_stream_resync_then_scoped_changes_and_revocation(self, _sleep, _close):
        request = self.sse_request(self.teacher)
        stream = _event_stream(request, 'instructor', self.teacher.id)
        self.assertIn('"resync": true', next(stream))
        publish_changes({self.teacher.id: {'topics': ['students'], 'batch_ids': [self.batch.id]}})
        publish_changes({self.other.id: {'topics': ['catalog']}})
        message = next(stream)
        self.assertIn('students', message)
        self.assertNotIn('catalog', message)
        self.teacher.is_approved = False
        self.teacher.save()
        publish_changes({self.teacher.id: {'topics': ['users']}})
        self.assertIn('auth_expired', next(stream))
        with self.assertRaises(StopIteration):
            next(stream)


@skipUnless(connection.vendor == 'postgresql', 'Requires a dedicated test PostgreSQL database; SQLite is not cross-worker evidence')
class PostgreSQLTransportTests(TransactionTestCase):
    def test_an_independent_process_observes_committed_events(self):
        user = User.objects.create_user('worker@synthetic.invalid', name='Worker', role='admin')
        publish_changes({user.id: {'topics': ['catalog']}})
        # Pass the *test* connection configuration over stdin, never logs/argv.
        code = '''import json, sys, django
from django.conf import settings
config = json.load(sys.stdin)
settings.DATABASES['default'].update(config['database'])
django.setup()
from api.sse import pending_events
print(json.dumps(pending_events(config['user_id'], 0)))
'''
        result = subprocess.run([sys.executable, '-c', code], input=json.dumps({
            'database': connection.settings_dict, 'user_id': user.id,
        }, default=str), capture_output=True, text=True, timeout=30, env={**os.environ, 'PYTHON_DOTENV_DISABLED': '1'})
        self.assertEqual(result.returncode, 0, 'Independent PostgreSQL reader failed')
        self.assertEqual(json.loads(result.stdout)[0]['payload']['topics'], ['catalog'])


class ActualCommitTests(TransactionTestCase):
    def test_outer_commit_publishes_and_outer_rollback_does_not(self):
        admin = User.objects.create_user('commit@synthetic.invalid', name='Commit', role='admin')
        client = APIClient()
        client.force_authenticate(admin)
        with transaction.atomic():
            response = client.post('/api/admin/companies/', {'name': 'Committed synthetic employer'})
            self.assertEqual(response.status_code, 201)
            self.assertFalse(ChangeEvent.objects.exists())
        self.assertEqual(ChangeEvent.objects.filter(recipient=admin).count(), 1)
        try:
            with transaction.atomic():
                client.post('/api/admin/companies/', {'name': 'Rolled back synthetic employer'})
                raise RuntimeError('synthetic rollback')
        except RuntimeError:
            pass
        self.assertEqual(ChangeEvent.objects.filter(recipient=admin).count(), 1)
