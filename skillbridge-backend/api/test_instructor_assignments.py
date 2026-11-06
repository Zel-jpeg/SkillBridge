from unittest.mock import patch

from django.urls import reverse
from rest_framework.test import APITestCase

from .models import User, Institute, Program, InstructorAssignment, Batch, ManagementAction, ChangeEvent
from .management_access import managed_batches


class InstructorAssignmentTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user('assignment-admin@example.invalid', role='admin')
        self.owner = User.objects.create_user('assignment-owner@example.invalid', role='instructor', name='Synthetic Owner', is_approved=True)
        self.other = User.objects.create_user('assignment-other@example.invalid', role='instructor', name='Synthetic Other', is_approved=True)
        self.student = User.objects.create_user('assignment-student@example.invalid', role='student')
        self.institute = Institute.objects.create(code='SYN', name='Synthetic Institute')
        self.foreign = Institute.objects.create(code='OTHER', name='Other Institute')
        self.program = Program.objects.create(institute=self.institute, code='ONE', name='One Program')
        self.second = Program.objects.create(institute=self.institute, code='TWO', name='Two Program')
        self.url = reverse('program_instructors', args=[self.institute.id, self.program.id])
        self.options = reverse('program_instructor_options', args=[self.institute.id, self.program.id])
        self.client.force_authenticate(self.admin)

    def grant(self, instructor=None, url=None):
        return self.client.post(url or self.url, {'instructor_id': (instructor or self.owner).id}, format='json')

    def detail(self, assignment_id):
        return reverse('instructor_assignment_detail', args=[self.institute.id, self.program.id, assignment_id])

    def test_only_admin_can_read_or_modify_assignments(self):
        for user in [None, self.owner, self.student]:
            self.client.force_authenticate(user)
            for response in [self.client.get(self.url), self.client.get(self.options), self.grant()]:
                self.assertIn(response.status_code, [401, 403])
        self.assertFalse(InstructorAssignment.objects.exists())

    def test_admin_cards_use_the_same_identity_photo_and_id_for_candidates_and_assignments(self):
        self.owner.school_id = 'SYN-COORD-01'
        self.owner.photo_url = 'https://images.example.invalid/synthetic-coordinator.webp'
        self.owner.save(update_fields=['school_id', 'photo_url'])
        candidate = next(row for row in self.client.get(self.options).data['results'] if row['id'] == self.owner.id)
        assigned = self.grant().data
        for row in (candidate, assigned):
            self.assertEqual(row['school_id'], self.owner.school_id)
            self.assertEqual(row['photo_url'], self.owner.photo_url)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.get(self.options).status_code, 403)
        self.assertEqual(self.client.get(self.url).status_code, 403)

    def test_assign_is_idempotent_and_revoke_restore_keeps_identity(self):
        first = self.grant()
        self.assertEqual(first.status_code, 201)
        self.assertTrue(first.data['effective'])
        second = self.grant()
        self.assertEqual(second.status_code, 200)
        self.assertEqual(second.data['id'], first.data['id'])
        self.assertEqual(ManagementAction.objects.count(), 1)
        url = self.detail(first.data['id'])
        self.assertEqual(self.client.patch(url, {'is_active': False}, format='json').status_code, 200)
        self.assertFalse(InstructorAssignment.objects.get().is_active)
        restored = self.grant()
        self.assertEqual(restored.data['id'], first.data['id'])
        self.assertTrue(restored.data['is_active'])
        self.assertEqual(InstructorAssignment.objects.count(), 1)
        self.assertEqual(ManagementAction.objects.count(), 3)

    def test_mutation_validates_payload_types_and_never_changes_role(self):
        for data in [{}, {'instructor_id': True}, {'instructor_id': '1'}, {'instructor_id': []},
                     {'instructor_id': self.owner.id, 'role': 'admin'}, {'instructor_id': self.student.id}]:
            self.assertIn(self.client.post(self.url, data, format='json').status_code, [400, 404])
        self.assertFalse(InstructorAssignment.objects.exists())
        row = self.grant().data
        for data in [{'is_active': 'false'}, {'is_active': False, 'program_id': self.second.id}, {}]:
            self.assertEqual(self.client.patch(self.detail(row['id']), data, format='json').status_code, 400)
        self.owner.refresh_from_db()
        self.assertEqual(self.owner.role, 'instructor')

    def test_only_approved_active_instructors_can_be_granted_or_restored(self):
        row = self.grant().data
        self.client.patch(self.detail(row['id']), {'is_active': False}, format='json')
        for field in ['is_active', 'is_approved']:
            User.objects.filter(pk=self.owner.id).update(**{field: False})
            self.assertEqual(self.grant().status_code, 404)
            self.assertEqual(self.client.patch(self.detail(row['id']), {'is_active': True}, format='json').status_code, 404)
            self.assertNotIn(self.owner.id, [item['id'] for item in self.client.get(self.options).data['results']])
            User.objects.filter(pk=self.owner.id).update(**{field: True})

    def test_inactive_context_blocks_grant_restore_but_allows_revoke(self):
        row = self.grant().data
        for model, pk in [(Program, self.program.pk), (Institute, self.institute.pk)]:
            model.objects.filter(pk=pk).update(is_active=False)
            self.assertEqual(self.grant(self.other).status_code, 409)
            self.assertEqual(self.client.get(self.options).status_code, 409)
            self.assertEqual(self.client.patch(self.detail(row['id']), {'is_active': False}, format='json').status_code, 200)
            self.assertEqual(self.client.patch(self.detail(row['id']), {'is_active': True}, format='json').status_code, 409)
            model.objects.filter(pk=pk).update(is_active=True)
            self.assertEqual(self.client.patch(self.detail(row['id']), {'is_active': True}, format='json').status_code, 200)

    def test_parent_and_program_paths_cannot_be_forged(self):
        row = self.grant().data
        wrong_parent = reverse('program_instructors', args=[self.foreign.pk, self.program.pk])
        self.assertEqual(self.grant(url=wrong_parent).status_code, 404)
        wrong_program = reverse('instructor_assignment_detail', args=[self.institute.pk, self.second.pk, row['id']])
        self.assertEqual(self.client.patch(wrong_program, {'is_active': False}, format='json').status_code, 404)

    def test_current_options_follow_multiple_grants_and_revocation_without_new_login(self):
        first = self.grant().data
        other_url = reverse('program_instructors', args=[self.institute.id, self.second.id])
        self.grant(url=other_url)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.get(reverse('program_options')).data['count'], 2)
        target = reverse('program_option_detail', args=[self.program.id])
        self.assertEqual(self.client.get(target).status_code, 200)
        self.client.force_authenticate(self.admin)
        self.client.patch(self.detail(first['id']), {'is_active': False}, format='json')
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.get(target).status_code, 404)
        self.assertEqual(self.client.get(reverse('program_options')).data['count'], 1)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(reverse('program_options')).data['count'], 0)
        self.assertEqual(self.client.get(target).status_code, 404)

    def test_archived_program_or_account_never_remains_effectively_authorized(self):
        self.grant()
        self.client.force_authenticate(self.owner)
        for model, pk, field in [(Program, self.program.pk, 'is_active'), (Institute, self.institute.pk, 'is_active'),
                                  (User, self.owner.pk, 'is_approved')]:
            model.objects.filter(pk=pk).update(**{field: False})
            self.assertEqual(self.client.get(reverse('program_options')).data['count'], 0)
            model.objects.filter(pk=pk).update(**{field: True})

    def test_program_membership_does_not_grant_colleagues_private_batches(self):
        batch = Batch.objects.create(name='Private owner batch', instructor=self.owner)
        self.grant()
        self.grant(self.other)
        self.assertEqual(list(managed_batches(self.other)), [])
        self.assertEqual(list(managed_batches(self.owner).values_list('id', flat=True)), [batch.id])

    def test_lists_have_accurate_counts_search_and_clamping(self):
        for index in range(10):
            instructor = User.objects.create_user(f'scope-{index}@example.invalid', name=f'Candidate {index:02}', role='instructor', is_approved=True)
            self.grant(instructor)
        response = self.client.get(self.url, {'search': 'Candidate', 'page_size': 3, 'page': 999})
        self.assertEqual((response.data['count'], response.data['page'], len(response.data['results'])), (10, 4, 1))
        self.assertEqual(self.client.get(self.options, {'search': 'scope-3'}).data['results'][0]['assigned'], True)
        self.assertEqual(self.client.get(self.url, {'status': 'revoked'}).data['count'], 0)

    def test_audit_failure_rolls_back_grant_and_revoke(self):
        with patch('api.instructor_assignments.record_action', side_effect=RuntimeError('synthetic audit failure')):
            with self.assertRaises(RuntimeError):
                self.grant()
        self.assertFalse(InstructorAssignment.objects.exists())
        row = self.grant().data
        with patch('api.instructor_assignments.record_action', side_effect=RuntimeError('synthetic audit failure')):
            with self.assertRaises(RuntimeError):
                self.client.patch(self.detail(row['id']), {'is_active': False}, format='json')
        self.assertTrue(InstructorAssignment.objects.get().is_active)

    def test_only_admins_and_affected_instructor_receive_assignment_events(self):
        with self.captureOnCommitCallbacks(execute=True):
            row = self.grant().data
        self.assertEqual(set(ChangeEvent.objects.values_list('recipient_id', flat=True)), {self.admin.id, self.owner.id})
        self.assertEqual(ChangeEvent.objects.get(recipient=self.admin).payload, {'topics': ['assignments']})
        self.assertEqual(ChangeEvent.objects.get(recipient=self.owner).payload, {'topics': ['assignments', 'scope']})
        ChangeEvent.objects.all().delete()
        with self.captureOnCommitCallbacks(execute=True):
            self.grant()
        self.assertFalse(ChangeEvent.objects.exists())
        with self.captureOnCommitCallbacks(execute=True):
            self.client.patch(self.detail(row['id']), {'is_active': False}, format='json')
        self.assertEqual(set(ChangeEvent.objects.values_list('recipient_id', flat=True)), {self.admin.id, self.owner.id})

    def test_organization_changes_notify_assigned_staff_without_student_data(self):
        self.grant()
        with self.captureOnCommitCallbacks(execute=True):
            self.client.patch(reverse('admin_institute_detail', args=[self.institute.id]), {'description': 'Changed'}, format='json')
        self.assertEqual(set(ChangeEvent.objects.values_list('recipient_id', flat=True)), {self.admin.id, self.owner.id})
        self.assertTrue(all(event.payload == {'topics': ['organization']} for event in ChangeEvent.objects.all()))

    def test_delete_unsupported_and_admin_options_exclude_archived_contexts(self):
        row = self.grant().data
        self.assertEqual(self.client.delete(self.detail(row['id'])).status_code, 405)
        self.assertEqual(self.client.get(reverse('program_options')).data['count'], 2)
        Program.objects.filter(pk=self.second.pk).update(is_active=False)
        self.assertEqual(self.client.get(reverse('program_options')).data['count'], 1)
