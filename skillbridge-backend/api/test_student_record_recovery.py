"""Account archive and selected-batch recovery preserve evidence and role scopes."""
from unittest.mock import patch
from unittest import skipUnless
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from django.db import connection, connections, close_old_connections
from django.test import TransactionTestCase
from rest_framework.test import APIClient
from django.urls import reverse
from rest_framework.test import APITestCase
from . import tests as placement_fixtures
from .models import (Assessment, AssessmentAttemptHistory, BatchEnrollment, CombinedCompetencyProfile,
                     ManagementAction, OJTPlacement, Recommendation, SkillScore, StudentResponse, User)
from .combined_competency import recalculate_combined


class StudentRecordRecoveryTests(APITestCase):
    def setUp(self):
        placement_fixtures.OJTPlacementAPITests.setUp(self)
        User.objects.filter(role='student').update(is_approved=True)
        self.client.force_authenticate(self.admin)
        self.student = self.student_one
        self.attempt = StudentResponse.objects.get(student=self.student)
        self.account = f'/api/admin/users/{self.student.id}/'
        self.history = self.account + 'history/'
        self.previous = f'/api/instructor/batches/{self.batch.id}/unenrolled/'
        self.remove = f'/api/instructor/students/{self.student.id}/?batch_id={self.batch.id}'

    def archive(self):
        self.assertEqual(self.client.delete(self.account).status_code, 200)

    def unenroll(self):
        self.assertEqual(self.client.delete(self.remove).status_code, 200)

    def enroll(self):
        url = f'/api/instructor/batches/{self.batch.id}/enroll/'
        row = {'school_id': self.student.school_id, 'name': self.student.name,
               'email': self.student.email, 'course': 'BSIT'}
        # Original placement fixtures intentionally use compact IDs/emails;
        # use a valid saved institutional identity for this enrollment contract.
        self.student.school_id = '2026-00001'
        self.student.email = 'synthetic.student@dnsc.edu.ph'
        self.student.course = 'BSIT'
        self.student.save(update_fields=['school_id', 'email', 'course'])
        row.update(school_id=self.student.school_id, email=self.student.email)
        preview = self.client.post(url + 'preview/', {'students': [row]}, format='json')
        self.assertEqual(preview.status_code, 200, preview.data)
        return self.client.post(url, {'students': preview.data['rows'], 'review_token': preview.data['review_token']}, format='json')

    def test_archive_restore_audit_is_idempotent_and_preserves_evidence_and_placement(self):
        placement = OJTPlacement.objects.create(student=self.student, batch=self.batch,
                    company=self.company, position=self.position, status='approved')
        before = (StudentResponse.objects.count(), SkillScore.objects.count(), Recommendation.objects.count())
        self.archive(); self.archive()
        self.assertEqual(ManagementAction.objects.filter(action='account.archive', target_id=self.student.id).count(), 1)
        self.assertEqual(before, (StudentResponse.objects.count(), SkillScore.objects.count(), Recommendation.objects.count()))
        self.assertTrue(BatchEnrollment.objects.filter(student=self.student, batch=self.batch).exists())
        self.assertTrue(OJTPlacement.objects.filter(pk=placement.pk, status='approved').exists())
        self.assertEqual(self.client.patch(self.account, {'is_active': True}, format='json').status_code, 200)
        self.client.patch(self.account, {'is_active': True}, format='json')
        self.assertEqual(ManagementAction.objects.filter(action='account.restore', target_id=self.student.id).count(), 1)

    def test_archived_history_contains_batch_scores_prior_attempt_and_saved_placement(self):
        AssessmentAttemptHistory.objects.create(response=self.attempt, attempt_number=1,
            status='submitted', started_at=self.attempt.started_at, category_scores=[{'category': 'Saved', 'percentage': 42}], answers=[])
        OJTPlacement.objects.create(student=self.student, batch=self.batch, company=self.company,
                                    position=self.position, status='removed', remarks='Synthetic preserved decision')
        self.archive()
        result = self.client.get(self.history)
        self.assertEqual(result.status_code, 200, result.data)
        record = next(row for row in result.data['records'] if row['batch']['id'] == self.batch.id)
        self.assertTrue(result.data['read_only'])
        self.assertEqual(record['assessment_results'][0]['response_id'], self.attempt.id)
        self.assertEqual(record['assessment_results'][0]['prior_attempts'][0]['category_scores'][0]['percentage'], 42)
        self.assertTrue(record['combined_category_scores'])
        self.assertEqual(record['placement_history'][0]['remarks'], 'Synthetic preserved decision')
        roster = self.client.get(f'/api/instructor/batches/{self.batch.id}/students/').data['students']
        self.assertTrue(next(row for row in roster if row['id'] == self.student.id)['recommendations_locked'])

    def test_archived_history_handles_membership_removed_and_detached_assessment(self):
        self.unenroll()
        detached = Assessment.objects.create(title='Detached history', created_by=self.instructor)
        StudentResponse.objects.create(student=self.student, assessment=detached)
        self.archive()
        result = self.client.get(self.history)
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual({row['batch']['id'] if row['batch'] else None for row in result.data['records']}, {self.batch.id, None})

    def test_history_is_admin_only_and_active_accounts_are_not_archived_history(self):
        self.assertEqual(self.client.get(self.history).status_code, 404)
        self.archive()
        for actor in [self.instructor, self.student, None]:
            self.client.force_authenticate(actor)
            self.assertIn(self.client.get(self.history).status_code, [401, 403])

    def test_history_keeps_score_only_batch_without_membership_or_response(self):
        assessment = Assessment.objects.get(batch=self.other_batch)
        original = SkillScore.objects.get(student=self.student)
        SkillScore.objects.create(student=self.student, assessment=assessment, skill_category=original.skill_category,
                                  raw_score=1, max_score=2, percentage=50)
        self.archive()
        result = self.client.get(self.history)
        record = next(row for row in result.data['records'] if row['batch']['id'] == self.other_batch.id)
        self.assertEqual(record['assessment_results'][0]['category_scores'][0]['percentage'], 50)

    def test_previously_unenrolled_is_scoped_deduplicated_and_excludes_current_members(self):
        self.unenroll()
        ManagementAction.objects.create(actor=self.admin, action='enrollment.remove', target_type='student',
                                         target_id=self.student.id, batch_id_snapshot=self.batch.id)
        self.client.force_authenticate(self.instructor)
        result = self.client.get(self.previous)
        self.assertEqual(result.status_code, 200)
        self.assertEqual([row['id'] for row in result.data['students']], [self.student.id])
        self.assertIn('Older removals', result.data['coverage_note'])
        self.client.force_authenticate(self.other_instructor)
        self.assertEqual(self.client.get(self.previous).status_code, 404)
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.get(self.previous).status_code, 403)
        BatchEnrollment.objects.create(student=self.student, batch=self.batch)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get(self.previous).data['students'], [])

    def test_legacy_unlogged_removal_is_not_invented_as_a_record(self):
        BatchEnrollment.objects.filter(student=self.student, batch=self.batch).delete()
        self.assertEqual(self.client.get(self.previous).data['students'], [])

    def test_archived_accounts_appear_in_previous_list_without_becoming_enrollable(self):
        self.unenroll(); self.archive()
        self.assertFalse(self.client.get(self.previous).data['students'][0]['is_active'])
        result = self.enroll()
        self.assertEqual(result.status_code, 200)
        self.assertFalse(BatchEnrollment.objects.filter(student=self.student, batch=self.batch).exists())
        self.assertEqual(self.client.post(f'/api/instructor/students/{self.student.id}/', {}).status_code, 405)

    @patch('api.views.send_instructor_email', return_value=True)
    def test_reenrollment_uses_existing_account_and_gates_without_reset_or_placement(self, mail):
        self.unenroll()
        scores = list(SkillScore.objects.filter(student=self.student).values_list('id', 'raw_score', 'max_score'))
        with patch('api.combined_competency.recalculate_combined', wraps=recalculate_combined) as reconcile:
            result = self.enroll()
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(result.data['summary']['enrolled'], 1, result.data)
        self.assertEqual(reconcile.call_count, 1)
        self.assertEqual(self.client.get(self.previous).data['students'], [])
        self.assertEqual(scores, list(SkillScore.objects.filter(student=self.student).values_list('id', 'raw_score', 'max_score')))
        self.assertTrue(StudentResponse.objects.filter(pk=self.attempt.id, status='submitted').exists())
        self.assertFalse(OJTPlacement.objects.filter(student=self.student, status='approved').exists())
        self.assertFalse(StudentResponse.objects.get(pk=self.attempt.id).retake_allowed)
        self.assertTrue(CombinedCompetencyProfile.objects.get(student=self.student, batch=self.batch).is_finalized)
        again = self.enroll()
        self.assertEqual(again.data['summary']['already_enrolled'], 1)
        self.assertEqual(BatchEnrollment.objects.filter(student=self.student, batch=self.batch).count(), 1)

    @patch('api.views.send_instructor_email', return_value=True)
    def test_reenrollment_does_not_unlock_incomplete_evidence(self, mail):
        self.unenroll()
        self.attempt.status = 'stopped'
        self.attempt.is_flagged = True
        self.attempt.save(update_fields=['status', 'is_flagged'])
        result = self.enroll()
        self.assertEqual(result.data['summary']['enrolled'], 1)
        self.assertFalse(CombinedCompetencyProfile.objects.get(student=self.student, batch=self.batch).is_finalized)
        self.assertFalse(Recommendation.objects.filter(student=self.student, batch=self.batch, is_current=True).exists())

    def test_archived_account_blocks_legacy_retake_and_extra_time_mutations(self):
        self.archive()
        result = self.client.patch(f'/api/instructor/students/{self.student.id}/retake/',
                    {'assessment_id': self.attempt.assessment_id, 'retake_allowed': True}, format='json')
        self.assertEqual(result.status_code, 409, result.data)
        result = self.client.post(f'/api/instructor/assessments/{self.attempt.assessment_id}/students/{self.student.id}/extra-time/', {}, format='json')
        self.assertEqual(result.status_code, 409, result.data)


@skipUnless(connection.vendor == 'postgresql', 'Requires disposable PostgreSQL for row-lock concurrency')
class StudentRecoveryConcurrencyTests(TransactionTestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email='synthetic-race-admin@dnsc.edu.ph', role='admin')
        self.teacher = User.objects.create_user(email='synthetic-race-teacher@dnsc.edu.ph', role='instructor', is_approved=True)
        self.student = User.objects.create_user(email='synthetic-race-student@dnsc.edu.ph', name='Synthetic Race',
            role='student', school_id='2026-00001', course='BSIT', is_approved=True)
        from .models import Batch
        self.batch = Batch.objects.create(name='Synthetic recovery race', instructor=self.teacher)
        ManagementAction.objects.create(actor=self.admin, action='enrollment.remove', target_type='student',
            target_id=self.student.id, batch_id_snapshot=self.batch.id)
        self.url = f'/api/instructor/batches/{self.batch.id}/enroll/'
        client = APIClient(); client.force_authenticate(self.admin)
        result = client.post(self.url+'preview/', {'students': [{'name': self.student.name, 'email': self.student.email,
            'school_id': self.student.school_id, 'course': self.student.course}]}, format='json')
        self.payload = {'students': result.data['rows'], 'review_token': result.data['review_token']}

    def race(self, second):
        barrier = Barrier(2)
        def call(action):
            close_old_connections()
            try:
                client = APIClient(); client.force_authenticate(User.objects.get(pk=self.admin.pk))
                barrier.wait(timeout=10)
                response = client.post(self.url, self.payload, format='json') if action == 'enroll' else client.delete(f'/api/admin/users/{self.student.id}/')
                return response.status_code, response.data
            finally:
                connections.close_all()
        with patch('api.views.send_instructor_email', return_value=False), ThreadPoolExecutor(2) as pool:
            futures = [pool.submit(call, action) for action in ('enroll', second)]
            return [future.result(timeout=30) for future in futures]

    def test_duplicate_reenrollments_create_one_membership(self):
        responses = self.race('enroll')
        self.assertTrue(all(status == 200 for status, _ in responses), responses)
        self.assertEqual(BatchEnrollment.objects.filter(student=self.student, batch=self.batch).count(), 1)
        self.assertEqual(sum(data['summary']['enrolled'] for _, data in responses), 1)

    def test_archive_and_reenrollment_are_serialized_without_reactivating_account(self):
        responses = self.race('archive')
        self.assertTrue(all(status == 200 for status, _ in responses), responses)
        self.student.refresh_from_db()
        self.assertFalse(self.student.is_active)
        # Enrollment may commit before archive, or be rejected after archive.
        # Neither ordering can create duplicates or reactivate the account.
        self.assertLessEqual(BatchEnrollment.objects.filter(student=self.student, batch=self.batch).count(), 1)
