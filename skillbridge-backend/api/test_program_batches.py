"""Program-bound batches, current authority, and signed enrollment integrity."""
import uuid
from concurrent.futures import ThreadPoolExecutor
from threading import Event
from unittest import skipUnless
from unittest.mock import patch

from django.urls import reverse
from django.db import close_old_connections, connection
from django.test import TransactionTestCase
from rest_framework.test import APITestCase, APIClient
from rest_framework_simplejwt.tokens import AccessToken

from .models import (Assessment, Batch, BatchEnrollment, Institute, InstructorAssignment,
                     ManagementAction, Program, User)


class ProgramBatchTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user('program-admin@dnsc.edu.ph', role='admin')
        self.owner = User.objects.create_user('program-owner@dnsc.edu.ph', role='instructor', is_approved=True)
        self.other = User.objects.create_user('program-other@dnsc.edu.ph', role='instructor', is_approved=True)
        self.institute = Institute.objects.create(code='ANY', name='Arbitrary Institute')
        self.program = Program.objects.create(institute=self.institute, code='DEG', name='Any Degree', aliases=['Alternate Degree'])
        self.second = Program.objects.create(institute=self.institute, code='DEG2', name='Second Degree')
        self.grant = InstructorAssignment.objects.create(instructor=self.owner, program=self.program)
        InstructorAssignment.objects.create(instructor=self.other, program=self.program)
        self.batch = Batch.objects.create(name='Program cohort', instructor=self.owner,
                                          program=self.program, institute=self.institute)
        self.assessment = Assessment.objects.create(title='Private draft', batch=self.batch, created_by=self.owner)
        self.legacy = Batch.objects.create(name='Existing mixed cohort', instructor=self.owner)
        self.sign_in(self.owner)

    def sign_in(self, user):
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + str(AccessToken.for_user(user)))

    def create(self, **kwargs):
        return self.client.post(reverse('instructor_batches'),
            {'name': 'New cohort', 'program_id': self.program.id, **kwargs}, format='json')

    def row(self, course='Alternate Degree', **kwargs):
        return {'school_id': '2099-00001', 'name': 'Synthetic Learner',
                'email': 'program-learner@dnsc.edu.ph', 'course': course, **kwargs}

    def preview(self, rows=None, batch=None):
        return self.client.post(f'/api/instructor/batches/{(batch or self.batch).id}/enroll/preview/',
                                {'students': rows or [self.row()]}, format='json')

    def confirm(self, reviewed, **kwargs):
        return self.client.post(f'/api/instructor/batches/{self.batch.id}/enroll/',
            {'students': reviewed.data['rows'], 'review_token': reviewed.data['review_token'],
             'request_id': str(uuid.uuid4()), 'email_mode': 'later', **kwargs}, format='json')

    def test_new_batch_derives_context_and_audit_without_mutating_old_cohorts(self):
        response = self.create()
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['program']['code'], 'DEG')
        self.assertEqual(response.data['institute_id'], self.institute.id)
        self.assertEqual(response.data['student_count'], 0)
        self.legacy.refresh_from_db()
        self.assertIsNone(self.legacy.program_id)
        self.assertEqual(self.legacy.status, 'active')
        self.assertEqual(ManagementAction.objects.filter(action='batch.create').count(), 1)

    def test_required_program_types_unknown_and_foreign_context(self):
        for value in [None, True, '1', [], 0, -1]:
            self.assertEqual(self.create(program_id=value).status_code, 400)
        self.assertEqual(self.create(program_id=self.second.id).status_code, 404)
        self.assertEqual(self.create(institute_id=self.institute.id).status_code, 400)
        self.assertEqual(self.create(instructor_id=self.other.id).status_code, 403)

    def test_admin_requires_assigned_owner_and_program_is_immutable(self):
        self.sign_in(self.admin)
        self.assertEqual(self.create(instructor_id=self.other.id).status_code, 201)
        self.assertEqual(self.create(program_id=self.second.id, instructor_id=self.other.id).status_code, 400)
        url = reverse('admin_batch_detail', args=[self.batch.id])
        self.assertEqual(self.client.patch(url, {'program_id': self.second.id}, format='json').status_code, 400)
        InstructorAssignment.objects.filter(instructor=self.other).update(is_active=False)
        self.assertEqual(self.client.patch(url, {'instructor_id': self.other.id}, format='json').status_code, 400)
        self.batch.refresh_from_db()
        self.assertEqual(self.batch.instructor_id, self.owner.id)

    def test_same_program_grant_never_grants_other_instructors_private_batch(self):
        self.sign_in(self.other)
        self.assertNotIn(self.batch.id, [row['id'] for row in self.client.get(reverse('instructor_batches')).data])
        self.assertEqual(self.preview().status_code, 404)
        self.assertEqual(self.client.get(f'/api/instructor/batches/{self.batch.id}/students/').status_code, 404)

    def test_revocation_on_same_jwt_blocks_private_batch_and_assessment_but_keeps_legacy(self):
        self.grant.is_active = False
        self.grant.save(update_fields=['is_active'])
        self.assertEqual([row['id'] for row in self.client.get(reverse('instructor_batches')).data], [self.legacy.id])
        self.assertEqual(self.preview().status_code, 404)
        self.assertEqual(self.client.get(f'/api/instructor/batches/{self.batch.id}/students/').status_code, 404)
        self.assertEqual(self.client.patch(f'/api/instructor/assessments/{self.assessment.id}/', {'title': 'Denied'}, format='json').status_code, 404)
        self.assertEqual(self.client.get(f'/api/instructor/batches/{self.batch.id}/emails/').status_code, 404)

    def test_archived_catalog_blocks_new_batch_and_enrollment_but_keeps_existing_read_access(self):
        self.program.is_active = False
        self.program.save(update_fields=['is_active'])
        self.assertEqual(self.create().status_code, 404)
        self.assertEqual(self.preview().status_code, 404)
        self.assertIn(self.batch.id, [row['id'] for row in self.client.get(reverse('instructor_batches')).data])
        self.assertEqual(self.client.get(f'/api/instructor/batches/{self.batch.id}/students/').status_code, 200)

    @patch('api.views.send_instructor_email', return_value=True)
    def test_alias_enrollment_assigns_program_profile_and_preserves_idempotency(self, send):
        reviewed = self.preview()
        self.assertEqual(reviewed.status_code, 200, reviewed.data)
        self.assertEqual(reviewed.data['summary']['ready'], 1)
        self.assertEqual(reviewed.data['summary']['unsupported'], 0)
        request_id = str(uuid.uuid4())
        response = self.confirm(reviewed, request_id=request_id)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['summary']['enrolled'], 1)
        student = User.objects.get(email='program-learner@dnsc.edu.ph')
        self.assertEqual((student.program_id, student.course, student.department),
                         (self.program.id, self.program.code, self.institute.name))
        repeat = self.confirm(reviewed, request_id=request_id)
        self.assertEqual(repeat.data, response.data)
        self.assertEqual(send.call_count, 1)
        self.sign_in(student)
        profile = self.client.get('/api/students/me/')
        self.assertEqual(profile.data['program']['id'], self.program.id)
        for data in [{'course': 'DEG2'}, {'program_id': self.second.id}]:
            self.assertEqual(self.client.patch('/api/students/me/profile/', data, format='json').status_code, 400)
        saved = self.client.patch('/api/students/me/profile/', {'course': 'Alternate Degree'}, format='json')
        self.assertEqual(saved.status_code, 200, saved.data)

    def test_unrelated_program_duplicate_identity_and_active_batch_conflicts_are_blocked(self):
        self.assertEqual(self.preview([self.row('DEG2')]).data['summary']['unsupported'], 1)
        self.assertEqual(self.preview([self.row(), self.row()]).data['summary']['duplicate'], 2)
        student = User.objects.create_user('program-learner@dnsc.edu.ph', role='student',
            school_id='2099-00001', program=self.second, course='DEG')
        self.assertEqual(self.preview().data['summary']['conflict'], 1)
        student.program = self.program
        student.save(update_fields=['program'])
        BatchEnrollment.objects.create(batch=self.legacy, student=student)
        self.assertEqual(self.preview().data['summary']['conflict'], 1)

    def test_signed_review_expires_on_catalog_or_owner_change(self):
        reviewed = self.preview()
        self.program.aliases = ['Changed alias']
        self.program.save(update_fields=['aliases'])
        self.assertEqual(self.confirm(reviewed).status_code, 400)
        self.assertFalse(BatchEnrollment.objects.filter(batch=self.batch).exists())

    def test_transfer_rejects_other_program_before_membership_removal(self):
        student = User.objects.create_user('transfer-program@dnsc.edu.ph', role='student', is_approved=True,
            school_id='2099-00007', course=self.second.code, program=self.second)
        original = BatchEnrollment.objects.create(batch=self.legacy, student=student)
        url = reverse('transfer_student', args=[self.batch.id])
        self.sign_in(self.admin)
        result = self.client.post(url, {'school_id': student.school_id}, format='json')
        self.assertEqual(result.status_code, 409, result.data)
        self.assertTrue(BatchEnrollment.objects.filter(pk=original.pk).exists())
        self.assertFalse(BatchEnrollment.objects.filter(batch=self.batch).exists())

    def test_transfer_review_binds_program_context_and_rechecks_archived_catalog(self):
        student = User.objects.create_user('transfer-same@dnsc.edu.ph', role='student', is_approved=True,
            school_id='2099-00008', course=self.program.code, program=self.program)
        original = BatchEnrollment.objects.create(batch=self.legacy, student=student)
        url = reverse('transfer_student', args=[self.batch.id])
        reviewed = self.client.post(url, {'school_id': student.school_id}, format='json')
        self.assertEqual(reviewed.status_code, 200, reviewed.data)
        self.program.name = 'Renamed Degree'
        self.program.save(update_fields=['name'])
        result = self.client.post(url, {'review_token': reviewed.data['review_token']}, format='json')
        self.assertEqual(result.status_code, 409, result.data)
        self.program.is_active = False
        self.program.save(update_fields=['is_active'])
        self.assertEqual(self.client.post(url, {'school_id': student.school_id}, format='json').status_code, 404)
        self.assertTrue(BatchEnrollment.objects.filter(pk=original.pk).exists())

    def test_revoked_assignment_disallows_retake_review_and_draft_student_scope(self):
        from .retake_requests import can_manage
        from .placement_drafts import scoped_ids
        from .models import StudentResponse
        student = User.objects.create_user('scope-program@dnsc.edu.ph', role='student')
        enrollment = BatchEnrollment.objects.create(batch=self.batch, student=student)
        attempt = StudentResponse.objects.create(assessment=self.assessment, student=student)
        self.assertTrue(can_manage(self.owner, attempt))
        self.assertEqual(scoped_ids(self.owner, {'enrollments': {student.id: enrollment}}), {student.id})
        self.grant.is_active = False
        self.grant.save(update_fields=['is_active'])
        self.assertFalse(can_manage(self.owner, attempt))
        self.assertEqual(scoped_ids(self.owner, {'enrollments': {student.id: enrollment}}), set())

    @patch('api.views.send_instructor_email', return_value=True)
    def test_existing_mixed_batch_keeps_both_courses_and_no_forced_program(self, send):
        rows = [self.row('BSIT'), self.row('BSIS', school_id='2099-00002', email='program-second@dnsc.edu.ph')]
        reviewed = self.preview(rows, self.legacy)
        result = self.client.post(f'/api/instructor/batches/{self.legacy.id}/enroll/',
            {'students': reviewed.data['rows'], 'review_token': reviewed.data['review_token'], 'email_mode': 'later'}, format='json')
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(result.data['summary']['enrolled'], 2)
        self.assertEqual(set(self.legacy.enrollments.values_list('student__course', flat=True)), {'BSIT', 'BSIS'})
        self.assertFalse(self.legacy.enrollments.filter(student__program__isnull=False).exists())


@skipUnless(connection.vendor == 'postgresql', 'Requires PostgreSQL row locking')
class ProgramEnrollmentConcurrencyTests(TransactionTestCase):
    def test_confirm_holds_program_authority_until_commit_and_next_request_observes_revoke(self):
        from .program_scope import enrollment_context
        admin = User.objects.create_user('program-race-admin@dnsc.edu.ph', role='admin')
        owner = User.objects.create_user('program-race-owner@dnsc.edu.ph', role='instructor', is_approved=True)
        institute = Institute.objects.create(code='RACE', name='Synthetic Race Institute')
        program = Program.objects.create(institute=institute, code='ANY', name='Any Degree')
        grant = InstructorAssignment.objects.create(program=program, instructor=owner)
        batch = Batch.objects.create(name='Race cohort', program=program, institute=institute, instructor=owner)
        client = APIClient()
        client.force_authenticate(owner)
        reviewed = client.post(f'/api/instructor/batches/{batch.id}/enroll/preview/', {'students': [
            {'name': 'Synthetic Race Learner', 'school_id': '2099-00009', 'email': 'program-race-student@dnsc.edu.ph', 'course': 'ANY'}]}, format='json')
        payload = {'students': reviewed.data['rows'], 'review_token': reviewed.data['review_token'], 'email_mode': 'later'}
        locked, release, revoking, revoked = Event(), Event(), Event(), Event()

        def hold_authority(*args, **kwargs):
            enrollment_context(*args, **kwargs)
            if kwargs.get('lock'):
                locked.set()
                if not release.wait(10):
                    raise RuntimeError('Synthetic race release timed out')

        def confirm():
            close_old_connections()
            try:
                local = APIClient()
                local.force_authenticate(User.objects.get(pk=owner.pk))
                return local.post(f'/api/instructor/batches/{batch.id}/enroll/', payload, format='json')
            finally:
                close_old_connections()

        def revoke():
            close_old_connections()
            try:
                local = APIClient()
                local.force_authenticate(User.objects.get(pk=admin.pk))
                revoking.set()
                response = local.patch(f'/api/admin/institutes/{institute.id}/programs/{program.id}/instructors/{grant.id}/',
                    {'is_active': False}, format='json')
                revoked.set()
                return response
            finally:
                close_old_connections()

        with patch('api.program_scope.enrollment_context', side_effect=hold_authority):
            with ThreadPoolExecutor(max_workers=2) as pool:
                first = pool.submit(confirm)
                try:
                    self.assertTrue(locked.wait(10))
                    second = pool.submit(revoke)
                    self.assertTrue(revoking.wait(10))
                    self.assertFalse(revoked.wait(.5), 'Grant revocation bypassed the confirmed operation lock')
                finally:
                    release.set()
                enrolled, removed = first.result(15), second.result(15)
        self.assertEqual(enrolled.status_code, 200, enrolled.data)
        self.assertEqual(enrolled.data['summary']['enrolled'], 1)
        self.assertEqual(removed.status_code, 200, removed.data)
        self.assertEqual(BatchEnrollment.objects.filter(batch=batch).count(), 1)
        self.assertEqual(client.post(f'/api/instructor/batches/{batch.id}/enroll/preview/', {'students': payload['students']}, format='json').status_code, 404)
