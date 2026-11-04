from unittest.mock import patch

from django.db import IntegrityError, transaction
from django.db.models.deletion import ProtectedError
from django.urls import reverse
from rest_framework.test import APITestCase

from .models import Institute, Program, User, ManagementAction, ChangeEvent, Batch


class OrganizationTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user('org-admin@example.invalid', role='admin')
        self.staff = User.objects.create_user('org-staff@example.invalid', role='instructor', is_approved=True)
        self.student = User.objects.create_user('org-student@example.invalid', role='student')
        self.institute = Institute.objects.create(code='SYN', name='Synthetic Institute')
        self.other = Institute.objects.create(code='OTHER', name='Other Institute')
        self.program = Program.objects.create(institute=self.institute, code='EX', name='Example Program', aliases=['Example degree'])
        self.institutes = reverse('admin_institutes')
        self.detail = reverse('admin_institute_detail', args=[self.institute.id])
        self.programs = reverse('admin_programs', args=[self.institute.id])
        self.program_detail = reverse('admin_program_detail', args=[self.institute.id, self.program.id])
        self.client.force_authenticate(self.admin)

    def test_all_catalog_endpoints_reject_non_admin_roles_and_anonymous(self):
        urls = [self.institutes, self.detail, self.programs, self.program_detail]
        for user in [None, self.staff, self.student]:
            self.client.force_authenticate(user)
            for url in urls:
                with self.subTest(role=getattr(user, 'role', None), url=url):
                    self.assertIn(self.client.get(url).status_code, [401, 403])
                    method = self.client.patch if url in [self.detail, self.program_detail] else self.client.post
                    self.assertIn(method(url, {'name': 'Denied', 'code': 'DENIED'}, format='json').status_code, [401, 403])
        self.assertEqual(Institute.objects.count(), 2)
        self.assertEqual(Program.objects.count(), 1)

    def test_inactive_admin_denied_even_with_forced_authentication(self):
        self.admin.is_active = False
        self.assertEqual(self.client.post(self.institutes, {'name': 'Denied', 'code': 'DEN'}, format='json').status_code, 403)

    def test_arbitrary_catalog_create_normalizes_whitespace_without_seed_content(self):
        response = self.client.post(self.institutes, {'code': '  new  ', 'name': ' New   Institute ', 'description': 'Independent'}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual((response.data['code'], response.data['name']), ('NEW', 'New Institute'))
        self.assertEqual(response.data['program_count'], 0)
        self.assertEqual(ManagementAction.objects.get(target_id=response.data['id'], target_type='institute').actor_id, self.admin.id)

    def test_catalog_fields_are_typed_bounded_and_unknown_fields_rejected(self):
        for data in [{'code': 'X', 'name': []}, {'code': 1, 'name': 'X'}, {'code': 'X', 'name': 'Y', 'description': []},
                     {'code': 'X', 'name': 'Y', 'is_active': 'false'}, {'code': 'X', 'name': 'Y', 'owner_id': 1},
                     {'code': 'X' * 31, 'name': 'Y'}, {'code': 'X', 'name': 'x' * 256},
                     {'code': 'X', 'name': '---'}, {'code': 'bad!', 'name': 'Y'},
                     {'code': 'X', 'name': 'Y', 'description': 'x' * 2001}]:
            with self.subTest(data=str(data)[:70]):
                self.assertEqual(self.client.post(self.institutes, data, format='json').status_code, 400)
        self.assertEqual(Institute.objects.count(), 2)

    def test_case_insensitive_institute_duplicates_return_conflict(self):
        for data in [{'code': 'syn', 'name': 'Different'}, {'code': 'DIFF', 'name': 'synthetic institute'}]:
            self.assertEqual(self.client.post(self.institutes, data, format='json').status_code, 409)
        self.assertFalse(ManagementAction.objects.exists())

    def test_database_enforces_case_insensitive_codes(self):
        for create in [lambda: Institute.objects.create(code='syn', name='Other name'),
                       lambda: Program.objects.create(institute=self.institute, code='ex', name='Other program')]:
            with self.assertRaises(IntegrityError), transaction.atomic():
                create()

    def test_program_create_aliases_and_same_code_in_other_institute(self):
        response = self.client.post(self.programs, {'code': 'NEW COURSE', 'name': 'New Program', 'aliases': [' New   degree ']}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['aliases'], ['New degree'])
        response = self.client.post(reverse('admin_programs', args=[self.other.id]), {'code': 'EX', 'name': 'Example Program'}, format='json')
        self.assertEqual(response.status_code, 201)

    def test_aliases_cannot_ambiguously_resolve_to_other_programs(self):
        for data in [{'code': 'EX2', 'name': 'New name', 'aliases': ['example DEGREE']},
                     {'code': 'E-X', 'name': 'New name'}, {'code': 'EX2', 'name': 'Example degree'}]:
            self.assertEqual(self.client.post(self.programs, data, format='json').status_code, 400)
        self.assertEqual(Program.objects.count(), 1)

    def test_alias_validation_and_partial_update_include_existing_labels(self):
        for aliases in [[1], ['One', 'o-ne'], ['---'], ['x'] * 13, 'string']:
            self.assertEqual(self.client.patch(self.program_detail, {'aliases': aliases}, format='json').status_code, 400)
        Program.objects.create(institute=self.institute, code='SECOND', name='Second program', aliases=['Taken'])
        self.assertEqual(self.client.patch(self.program_detail, {'name': 'Taken'}, format='json').status_code, 400)
        self.program.refresh_from_db()
        self.assertEqual(self.program.name, 'Example Program')

    def test_program_parent_cannot_be_changed_or_forged(self):
        self.assertEqual(self.client.patch(self.program_detail, {'institute_id': self.other.id}, format='json').status_code, 400)
        wrong_parent = reverse('admin_program_detail', args=[self.other.id, self.program.id])
        self.assertEqual(self.client.patch(wrong_parent, {'name': 'Wrong'}, format='json').status_code, 404)
        self.assertEqual(self.client.get(wrong_parent).status_code, 404)

    def test_archive_restore_order_preserves_child_states_and_ids(self):
        self.assertEqual(self.client.patch(self.detail, {'is_active': False}, format='json').status_code, 409)
        self.assertEqual(self.client.patch(self.program_detail, {'is_active': False}, format='json').status_code, 200)
        self.assertEqual(self.client.patch(self.detail, {'is_active': False}, format='json').status_code, 200)
        self.assertEqual(self.client.patch(self.program_detail, {'is_active': True}, format='json').status_code, 409)
        self.assertEqual(self.client.post(self.programs, {'code': 'NEW', 'name': 'New'}, format='json').status_code, 409)
        self.assertEqual(self.client.patch(self.detail, {'is_active': True}, format='json').status_code, 200)
        self.program.refresh_from_db()
        self.assertFalse(self.program.is_active)
        self.assertEqual(self.client.patch(self.program_detail, {'is_active': True}, format='json').status_code, 200)
        self.assertTrue(Program.objects.filter(pk=self.program.pk, is_active=True).exists())

    def test_archived_institute_can_be_renamed_without_reactivating_it(self):
        Institute.objects.filter(pk=self.other.id).update(is_active=False)
        response = self.client.patch(reverse('admin_institute_detail', args=[self.other.id]), {'name': 'Updated archived'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['is_active'])

    def test_lists_search_filter_scope_pagination_and_clamp(self):
        for i in range(11):
            Institute.objects.create(code=f'Q{i}', name=f'Query {i:02}', is_active=i % 2 == 0)
        response = self.client.get(self.institutes, {'search': 'Query', 'status': 'active', 'page_size': 2, 'page': 999})
        self.assertEqual((response.data['count'], response.data['page'], len(response.data['results'])), (6, 3, 2))
        self.assertEqual(self.client.get(self.programs).data['count'], 1)
        self.assertEqual(self.client.get(reverse('admin_programs', args=[self.other.id])).data['count'], 0)
        self.assertEqual(self.client.get(self.institutes, {'search': 'no match'}).data['page'], 1)
        rows = self.client.get(self.institutes, {'page_size': 50}).data['results']
        self.assertEqual([row['name'] for row in rows], sorted(row['name'] for row in rows))

    def test_invalid_and_repeated_query_parameters_rejected(self):
        for query in ['?page=0', '?page=-1', '?page=1.5', '?page_size=51', '?status=wrong', '?x=1', '?page=1&page=2']:
            self.assertEqual(self.client.get(self.institutes + query).status_code, 400)

    def test_audit_failure_rolls_back_complete_write(self):
        with patch('api.organization.record_action', side_effect=RuntimeError('synthetic audit failure')):
            with self.assertRaises(RuntimeError):
                self.client.post(self.programs, {'code': 'ROLL', 'name': 'Rollback'}, format='json')
        self.assertFalse(Program.objects.filter(code='ROLL').exists())

    def test_committed_events_go_only_to_admins_without_student_data(self):
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.client.patch(self.detail, {'description': 'New description'}, format='json').status_code, 200)
        event = ChangeEvent.objects.get()
        self.assertEqual(event.recipient_id, self.admin.id)
        self.assertEqual(event.payload, {'topics': ['organization']})

    def test_failed_write_publishes_no_event(self):
        with self.captureOnCommitCallbacks(execute=True):
            self.client.patch(self.detail, {'is_active': False}, format='json')
        self.assertFalse(ChangeEvent.objects.exists())

    def test_no_delete_route_and_program_relationship_protected(self):
        self.assertEqual(self.client.delete(self.detail).status_code, 405)
        self.assertEqual(self.client.delete(self.program_detail).status_code, 405)
        with self.assertRaises(ProtectedError):
            self.institute.delete()

    def test_catalog_changes_do_not_reclassify_or_archive_existing_ic_records(self):
        self.student.course = 'BSIT'
        self.student.save()
        batch = Batch.objects.create(name='Existing mixed IC batch', instructor=self.staff)
        self.client.post(self.institutes, {'code': 'IC', 'name': 'Institute of Computing'}, format='json')
        batch.refresh_from_db()
        self.student.refresh_from_db()
        self.assertEqual(batch.status, 'active')
        self.assertEqual(self.student.course, 'BSIT')
        self.assertTrue(self.student.is_active)
