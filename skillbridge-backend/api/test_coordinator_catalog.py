from concurrent.futures import ThreadPoolExecutor
import json
from threading import Barrier
from unittest import skipUnless
from unittest.mock import patch

from django.db import close_old_connections, connection
from django.urls import reverse
from rest_framework.test import APIClient, APITestCase, APITransactionTestCase

from .models import (Company, CompetencyFramework, Institute, InstructorAssignment,
                     ManagementAction, OJTPlacement, Position, Program, SkillCategory, User)
from .test_company_images import fixture


class CoordinatorFixtures:
    def setUp(self):
        self.admin = User.objects.create_user('coordinator-admin@example.invalid', role='admin')
        self.owner = User.objects.create_user('coordinator-owner@example.invalid', role='instructor', is_approved=True)
        self.peer = User.objects.create_user('coordinator-peer@example.invalid', role='instructor', is_approved=True)
        self.foreign = User.objects.create_user('coordinator-foreign@example.invalid', role='instructor', is_approved=True)
        institute = Institute.objects.create(code='TEST', name='Synthetic institute')
        self.program = Program.objects.create(institute=institute, code='FIRST', name='First program')
        self.other = Program.objects.create(institute=institute, code='SECOND', name='Second program')
        self.grant = InstructorAssignment.objects.create(instructor=self.owner, program=self.program)
        InstructorAssignment.objects.create(instructor=self.peer, program=self.program)
        InstructorAssignment.objects.create(instructor=self.foreign, program=self.other)
        self.framework = CompetencyFramework.objects.create(program=self.program, name='Reviewed rubric', version=1)
        self.category = SkillCategory.objects.create(framework=self.framework, name='Records', description='Records knowledge')
        self.client.force_authenticate(self.owner)

    def create_partner(self, name='Synthetic partner'):
        result = self.client.post(reverse('coordinator_partners', args=[self.program.pk]), {'name': name}, format='json')
        self.assertEqual(result.status_code, 201, result.data)
        return result.data

    def create_position(self, partner, **values):
        result = self.client.post(reverse('coordinator_positions', args=[self.program.pk, partner['id']]), {
            'title': 'Records assistant', 'slots': 2, 'tags': ['Records'],
            'category_requirements': [{'category_id': self.category.pk, 'percentage': 70}], **values,
        }, format='json')
        self.assertEqual(result.status_code, 201, result.data)
        return result.data


class CoordinatorCatalogTests(CoordinatorFixtures, APITestCase):
    def test_create_edit_and_list_work_before_any_batch_exists(self):
        partner = self.create_partner()
        position = self.create_position(partner)
        row = Position.objects.get(pk=position['id'])
        self.assertEqual((row.created_by_id, row.management_program_id), (self.owner.pk, self.program.pk))
        self.assertEqual(list(row.eligible_programs.all()), [self.program])
        self.framework.refresh_from_db()
        self.assertIsNotNone(self.framework.locked_at)
        url = reverse('coordinator_position_detail', args=[self.program.pk, row.pk])
        result = self.client.patch(url, {'revision': position['revision'], 'slots': 0, 'tags': ['Updated']}, format='json')
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(result.data['slots'], 0)
        page = self.client.get(reverse('coordinator_partners', args=[self.program.pk]))
        self.assertEqual(page.data['count'], 1)
        self.assertEqual(page.data['results'][0]['positions'][0]['tags'], ['Updated'])
        self.assertNotIn('student', str(page.data).lower())
        self.assertIn('no-store', page['Cache-Control'])
        self.assertEqual(ManagementAction.objects.filter(action='position.update').count(), 1)

    def test_assigned_peer_can_edit_program_partner_and_position_without_taking_ownership(self):
        partner = self.create_partner()
        position = self.create_position(partner)
        detail = reverse('coordinator_partner_detail', args=[self.program.pk, partner['id']])
        self.client.force_authenticate(self.peer)
        view = self.client.get(detail)
        self.assertEqual(view.status_code, 200)
        self.assertTrue(view.data['can_edit'])
        self.assertTrue(view.data['positions'][0]['can_edit'])
        self.assertTrue(view.data['can_archive'])
        self.assertTrue(view.data['positions'][0]['can_archive'])
        self.assertEqual(self.client.patch(detail, {'revision': view.data['revision'], 'name': 'Changed'}, format='json').status_code, 200)
        url = reverse('coordinator_position_detail', args=[self.program.pk, position['id']])
        self.assertEqual(self.client.patch(url, {'revision': position['revision'], 'slots': 3}, format='json').status_code, 200)
        self.assertEqual(Position.objects.get(pk=position['id']).created_by_id, self.owner.pk)
        self.create_position(partner, title='Another position')
        self.assertEqual(Position.objects.count(), 2)

    def test_explicit_foreign_program_reuse_exposes_only_organization_identity(self):
        partner = self.create_partner()
        position = self.create_position(partner)
        self.client.force_authenticate(self.foreign)
        options = self.client.get(reverse('coordinator_partner_options', args=[self.other.pk]))
        self.assertEqual(options.status_code, 200)
        self.assertEqual(set(options.data['results'][0]), {'id', 'name', 'address'})
        url = reverse('coordinator_partner_detail', args=[self.other.pk, partner['id']])
        self.assertEqual(self.client.get(url).status_code, 404)
        create = reverse('coordinator_positions', args=[self.other.pk, partner['id']])
        self.assertEqual(self.client.post(create, {'title': 'Other opening'}, format='json').status_code, 403)
        result = self.client.post(create, {'title': 'Other opening', 'reuse_existing': True,
                                          'category_requirements': []}, format='json')
        self.assertEqual(result.status_code, 201, result.data)
        view = self.client.get(url)
        self.assertEqual(len(view.data['positions']), 1)
        self.assertEqual(view.data['positions'][0]['id'], result.data['id'])
        self.client.force_authenticate(self.owner)
        original = self.client.get(reverse('coordinator_partner_detail', args=[self.program.pk, partner['id']]))
        self.assertTrue(original.data['can_edit'])
        self.assertFalse(original.data['can_archive'])
        self.assertTrue(original.data['positions'][0]['can_edit'])
        self.assertEqual(original.data['positions'][0]['id'], position['id'])
        self.assertEqual(self.client.patch(reverse('coordinator_partner_detail', args=[self.program.pk, partner['id']]),
            {'revision': original.data['revision'], 'name': 'Updated shared partner'}, format='json').status_code, 200)

    def test_direct_foreign_program_and_revoked_grant_requests_are_denied(self):
        partner = self.create_partner()
        detail = reverse('coordinator_partner_detail', args=[self.program.pk, partner['id']])
        self.assertEqual(self.client.get(reverse('coordinator_partners', args=[self.other.pk])).status_code, 404)
        self.grant.is_active = False
        self.grant.save(update_fields=['is_active'])
        self.assertEqual(self.client.get(detail).status_code, 404)
        self.assertEqual(self.client.patch(detail, {'revision': partner['revision'], 'name': 'Revoked'}, format='json').status_code, 404)
        self.assertEqual(Company.objects.get(pk=partner['id']).name, 'Synthetic partner')
        self.client.force_authenticate(self.admin)
        result = self.client.patch(detail, {'revision': partner['revision'], 'name': 'Admin oversight'}, format='json')
        self.assertEqual(result.status_code, 200, result.data)

    def test_forged_ownership_eligibility_and_foreign_categories_roll_back(self):
        partner = self.create_partner()
        framework = CompetencyFramework.objects.create(program=self.other, name='Other rubric', version=1)
        category = SkillCategory.objects.create(framework=framework, name='Records')
        url = reverse('coordinator_positions', args=[self.program.pk, partner['id']])
        for payload in (
            {'title': 'Foreign', 'created_by': self.peer.pk},
            {'title': 'Foreign', 'eligible_program_ids': [self.other.pk]},
            {'title': 'Foreign', 'category_requirements': [{'category_id': category.pk, 'percentage': 70}]},
            {'title': 'Malformed', 'category_requirements': [{'category_id': True, 'percentage': 70}]},
            {'title': 'Malformed', 'slots': -1},
        ):
            with self.subTest(payload=payload):
                self.assertEqual(self.client.post(url, payload, format='json').status_code, 400)
                self.assertFalse(Position.objects.exists())
        framework.refresh_from_db()
        self.assertIsNone(framework.locked_at)
        self.assertEqual(self.client.post(reverse('coordinator_partners', args=[self.program.pk]),
            {'name': 'Forged', 'management_program': self.other.pk}, format='json').status_code, 400)

    def test_stale_review_and_duplicate_create_do_not_overwrite_saved_data(self):
        partner = self.create_partner()
        url = reverse('coordinator_partner_detail', args=[self.program.pk, partner['id']])
        first = self.client.patch(url, {'revision': partner['revision'], 'name': 'First edit'}, format='json')
        self.assertEqual(first.status_code, 200)
        stale = self.client.patch(url, {'revision': partner['revision'], 'name': 'Second edit'}, format='json')
        self.assertEqual(stale.status_code, 409)
        result = self.client.post(reverse('coordinator_partners', args=[self.program.pk]), {'name': 'first EDIT'}, format='json')
        self.assertEqual(result.status_code, 409)
        self.assertEqual(Company.objects.count(), 1)
        self.assertEqual(Company.objects.get().name, 'First edit')

    def test_admin_created_program_opening_is_editable_by_assigned_coordinator(self):
        company = Company.objects.create(name='Existing catalog', added_by=self.admin)
        position = Position.objects.create(company=company, title='Existing shared opening')
        position.eligible_programs.add(self.program)
        url = reverse('coordinator_partner_detail', args=[self.program.pk, company.pk])
        view = self.client.get(url)
        self.assertEqual(view.status_code, 200)
        self.assertTrue(view.data['can_edit'])
        self.assertTrue(view.data['positions'][0]['can_edit'])
        self.assertEqual(self.client.patch(url, {'revision': view.data['revision'], 'name': 'Updated partner'}, format='json').status_code, 200)
        self.client.force_authenticate(self.admin)
        edited = self.client.patch(reverse('coordinator_position_detail', args=[self.program.pk, position.pk]),
            {'revision': view.data['positions'][0]['revision'], 'slots': 3}, format='json')
        self.assertEqual(edited.status_code, 200, edited.data)
        position.refresh_from_db()
        self.assertIsNone(position.created_by_id)
        self.assertIsNone(position.management_program_id)

    def test_reuse_does_not_duplicate_an_existing_eligible_admin_opening(self):
        company = Company.objects.create(name='Existing partner', added_by=self.admin)
        position = Position.objects.create(company=company, title='Existing opening')
        position.eligible_programs.add(self.program)
        url = reverse('coordinator_positions', args=[self.program.pk, company.pk])
        result = self.client.post(url, {'title': 'existing OPENING', 'slots': 5}, format='json')
        self.assertEqual(result.status_code, 409)
        self.assertEqual(company.positions.count(), 1)

    def test_administrator_closed_opening_remains_readable_without_coordinator_edit_authority(self):
        partner = self.create_partner()
        opening = self.create_position(partner)
        self.client.force_authenticate(self.admin)
        closed = self.client.patch(reverse('admin_position_detail', args=[opening['id']]),
            {'eligible_program_ids': [], 'category_requirements': []}, format='json')
        self.assertEqual(closed.status_code, 200, closed.data)
        self.client.force_authenticate(self.owner)
        detail = reverse('coordinator_position_detail', args=[self.program.pk, opening['id']])
        view = self.client.get(detail)
        self.assertEqual(view.status_code, 200)
        self.assertTrue(view.data['eligibility_configured'])
        self.assertEqual(view.data['eligible_programs'], [])
        self.assertFalse(view.data['can_edit'])
        changed = self.client.patch(detail, {'revision': view.data['revision'], 'slots': 5,
            'category_requirements': [{'category_id': self.category.pk, 'percentage': 75}]}, format='json')
        self.assertEqual(changed.status_code, 403)
        saved = Position.objects.get(pk=opening['id'])
        self.assertEqual(saved.slots_available, opening['slots'])
        self.assertFalse(saved.eligible_programs.exists())
        self.assertFalse(saved.requirements.exists())

    def test_archive_restore_and_current_capacity_preserve_decisions(self):
        partner = self.create_partner()
        position = self.create_position(partner)
        student = User.objects.create_user('coordinator-student@example.invalid', role='student')
        decision = OJTPlacement.objects.create(student=student, company_id=partner['id'], position_id=position['id'],
                                               status='approved', match_score_at_assignment=81)
        detail = reverse('coordinator_position_detail', args=[self.program.pk, position['id']])
        archive = reverse('coordinator_position_archive', args=[self.program.pk, position['id']])
        self.assertEqual(self.client.patch(detail, {'revision': position['revision'], 'slots': 0}, format='json').status_code, 409)
        self.assertEqual(self.client.post(archive, {'revision': position['revision']}, format='json').status_code, 409)
        decision.status = 'removed'
        decision.save(update_fields=['status'])
        archived = self.client.post(archive, {'revision': position['revision']}, format='json')
        self.assertEqual(archived.status_code, 200)
        latest = self.client.get(detail)
        self.assertIsNotNone(latest.data['archived_at'])
        restored = self.client.post(archive, {'revision': latest.data['revision'], 'restore': True}, format='json')
        self.assertEqual(restored.status_code, 200)
        decision.refresh_from_db()
        self.assertEqual(decision.match_score_at_assignment, 81)

    def test_failed_upload_keeps_database_unchanged(self):
        with patch('api.company_images.CompanyImageChange.save', side_effect=RuntimeError('synthetic storage failure')):
            with self.assertRaises(RuntimeError):
                self.client.post(reverse('coordinator_partners', args=[self.program.pk]), {'name': 'Will roll back'}, format='json')
        self.assertFalse(Company.objects.exists())
        self.assertFalse(ManagementAction.objects.filter(action='partner.create').exists())

    def test_uploaded_image_is_compensated_after_a_later_database_failure(self):
        with patch('api.company_images.upload_image') as upload, patch('api.company_images.cleanup_image') as cleanup:
            with patch('api.coordinator_catalog.record_action', side_effect=RuntimeError('synthetic audit failure')):
                with self.assertRaises(RuntimeError):
                    self.client.post(reverse('coordinator_partners', args=[self.program.pk]), {
                        'payload': json.dumps({'name': 'Image rollback', 'image_action': 'replace'}),
                        'image': fixture(),
                    }, format='multipart')
        upload.assert_called_once()
        cleanup.assert_called_once_with(upload.call_args.args[0])
        self.assertFalse(Company.objects.exists())

    def test_image_upload_checks_program_access_while_archive_keeps_its_authority(self):
        partner = self.create_partner()
        self.client.force_authenticate(self.foreign)
        url = reverse('coordinator_partner_detail', args=[self.program.pk, partner['id']])
        with patch('api.company_images.upload_image') as upload:
            response = self.client.patch(url, {
                'payload': json.dumps({'revision': partner['revision'], 'image_action': 'replace'}),
                'image': fixture(),
            }, format='multipart')
        self.assertEqual(response.status_code, 404)
        upload.assert_not_called()
        self.client.force_authenticate(self.peer)
        with patch('api.company_images.upload_image') as allowed_upload:
            edited = self.client.patch(url, {
                'payload': json.dumps({'revision': partner['revision'], 'image_action': 'replace'}),
                'image': fixture(),
            }, format='multipart')
        self.assertEqual(edited.status_code, 200, edited.data)
        allowed_upload.assert_called_once()
        self.assertEqual(self.client.post(reverse('coordinator_partner_archive', args=[self.program.pk, partner['id']]),
            {'revision': edited.data['revision']}, format='json').status_code, 200)

    def test_archived_program_stays_readable_while_new_writes_are_denied(self):
        partner = self.create_partner()
        self.program.is_active = False
        self.program.save(update_fields=['is_active'])
        url = reverse('coordinator_partner_detail', args=[self.program.pk, partner['id']])
        result = self.client.get(url)
        self.assertEqual(result.status_code, 200)
        self.assertFalse(result.data['can_edit'])
        self.assertEqual(self.client.patch(url, {'revision': partner['revision'], 'name': 'Blocked'}, format='json').status_code, 404)
        self.client.force_authenticate(self.admin)
        self.assertFalse(self.client.get(url).data['can_edit'])
        self.assertEqual(self.client.patch(url, {'revision': partner['revision'], 'name': 'Blocked'}, format='json').status_code, 404)

    def test_search_pagination_and_archived_filters_preserve_scope(self):
        for number in range(10):
            Company.objects.create(name=f'Owned partner {number:02}', added_by=self.owner, management_program=self.program)
        Company.objects.create(name='Foreign partner', added_by=self.foreign, management_program=self.other)
        url = reverse('coordinator_partners', args=[self.program.pk])
        page = self.client.get(url, {'page': 2, 'page_size': 8})
        self.assertEqual((page.data['count'], len(page.data['results'])), (10, 2))
        self.assertEqual(self.client.get(url, {'page': 999}).data['page'], 2)
        self.assertEqual(self.client.get(url, {'search': 'Foreign'}).data['count'], 0)
        self.assertEqual(self.client.get(url, {'status': 'unknown'}).status_code, 400)
        self.assertEqual(self.client.get(url, {'page_size': 51}).status_code, 400)

    def test_unapproved_inactive_student_and_anonymous_access(self):
        url = reverse('coordinator_partners', args=[self.program.pk])
        student = User.objects.create_user('coordinator-denied@example.invalid', role='student')
        self.client.force_authenticate(student)
        self.assertEqual(self.client.get(url).status_code, 403)
        self.owner.is_approved = False
        self.owner.save(update_fields=['is_approved'])
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.post(url, {'name': 'Denied'}, format='json').status_code, 403)
        self.owner.is_active = False
        self.owner.save(update_fields=['is_active'])
        self.assertEqual(self.client.get(url).status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(url).status_code, 401)


@skipUnless(connection.vendor == 'postgresql', 'Requires PostgreSQL transaction locks')
class CoordinatorCatalogRaceTests(CoordinatorFixtures, APITransactionTestCase):
    def test_two_editors_cannot_both_overwrite_the_same_review(self):
        partner = self.create_partner()
        barrier = Barrier(2)
        url = reverse('coordinator_partner_detail', args=[self.program.pk, partner['id']])

        def save(name):
            close_old_connections()
            try:
                client = APIClient()
                client.force_authenticate(self.owner)
                barrier.wait(timeout=10)
                return client.patch(url, {'name': name, 'revision': partner['revision']}, format='json').status_code
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as executor:
            self.assertEqual(sorted(executor.map(save, ['First update', 'Second update'])), [200, 409])
        self.assertEqual(ManagementAction.objects.filter(action='partner.update').count(), 1)
