"""Admin edits/archive/reject must persist, preserve history and enforce access."""
from django.urls import reverse
from unittest.mock import patch
from rest_framework.test import APITestCase
from .models import Assessment, Batch, BatchEnrollment, User


class AdminAccountRecoveryTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email='account-admin@dnsc.edu.ph', role='admin')
        self.teacher = User.objects.create_user(email='account-teacher@dnsc.edu.ph', name='Original Instructor', role='instructor', school_id='STAFF-1', is_approved=True)
        self.student = User.objects.create_user(email='account-student@dnsc.edu.ph', name='Synthetic Student', role='student', school_id='2026-00001')
        self.pending = User.objects.create_user(email='account-pending@dnsc.edu.ph', role='instructor', is_approved=False)
        self.batch = Batch.objects.create(name='Account history', instructor=self.teacher)
        BatchEnrollment.objects.create(student=self.student, batch=self.batch)
        self.assessment = Assessment.objects.create(title='Preserved', batch=self.batch, created_by=self.teacher)
        self.client.force_authenticate(self.admin)

    def detail(self, user):
        return f'/api/admin/users/{user.id}/'

    def test_edit_persists_all_existing_instructor_editor_fields(self):
        result = self.client.patch(self.detail(self.teacher), {'name': 'Updated Instructor', 'email': 'updated.instructor@dnsc.edu.ph',
            'instructor_id': 'STAFF-UPDATED', 'department': 'Synthetic Department', 'courses': 'BSIS'}, format='json')
        self.assertEqual(result.status_code, 200)
        self.teacher.refresh_from_db()
        self.assertEqual(self.teacher.name, 'Updated Instructor')
        self.assertEqual(self.teacher.email, 'updated.instructor@dnsc.edu.ph')
        roster = self.client.get(reverse('admin_users')).data['instructors'][0]
        self.assertEqual((roster['instructor_id'], roster['department'], roster['courses']), ('STAFF-UPDATED', 'Synthetic Department', 'BSIS'))

    def test_invalid_edit_is_atomic_and_role_changes_are_rejected(self):
        for data in [{'email': self.student.email}, {'instructor_id': self.student.school_id}, {'email': 'bad@example.com'},
                     {'department': []}, {'role': 'admin'}]:
            with self.subTest(data=data):
                response = self.client.patch(self.detail(self.teacher), {'name': 'Must not save', **data}, format='json')
                self.assertIn(response.status_code, [400, 409])
                self.teacher.refresh_from_db()
                self.assertEqual(self.teacher.name, 'Original Instructor')

    def test_archive_is_persistent_idempotent_and_preserves_students_batches_and_history(self):
        for target in [self.teacher, self.student, self.pending]:
            for _ in range(2):
                self.assertEqual(self.client.delete(self.detail(target)).status_code, 200)
            target.refresh_from_db()
            self.assertFalse(target.is_active)
        roster = self.client.get(reverse('admin_users')).data
        self.assertEqual(roster['students'], [])
        self.assertEqual(roster['pending_instructors'], [])
        self.assertEqual({u['id'] for u in roster['archived_instructors']}, {self.teacher.id, self.pending.id})
        self.assertEqual([u['id'] for u in roster['archived_students']], [self.student.id])
        self.assertTrue(BatchEnrollment.objects.filter(student=self.student, batch=self.batch).exists())
        self.assertTrue(Assessment.objects.filter(pk=self.assessment.pk, created_by=self.teacher).exists())
        self.assertEqual(self.client.patch(self.detail(self.teacher), {'is_active': True}, format='json').status_code, 200)
        self.assertEqual(self.client.get(reverse('admin_users')).data['archived_instructors'][0]['id'], self.pending.id)

    def test_other_roles_missing_and_admin_targets_are_denied(self):
        for actor in [self.teacher, self.student, None]:
            self.client.force_authenticate(actor)
            self.assertIn(self.client.delete(self.detail(self.teacher)).status_code, [401, 403])
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.delete(self.detail(self.admin)).status_code, 404)
        self.assertEqual(self.client.delete('/api/admin/users/999999/').status_code, 404)

    def test_repeated_approval_does_not_queue_email_again_and_archive_requires_restore(self):
        with patch('api.views.send_instructor_email', return_value=True) as mail:
            for _ in range(2):
                self.assertEqual(self.client.post(reverse('admin_approve_instructor', args=[self.pending.id])).status_code, 200)
            self.assertEqual(mail.call_count, 1)
            self.client.delete(self.detail(self.pending))
            self.assertEqual(self.client.post(reverse('admin_approve_instructor', args=[self.pending.id])).status_code, 409)
            self.assertEqual(mail.call_count, 1)
