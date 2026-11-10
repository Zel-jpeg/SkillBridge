"""Shared catalog lists and details agree without expanding mutation authority."""
from django.test.utils import CaptureQueriesContext
from django.db import connection
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import Company, Institute, InstructorAssignment, Position, Program, User


class SharedPartnerVisibilityTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user('visibility-admin@example.invalid', role='admin')
        self.owner = User.objects.create_user('visibility-owner@example.invalid', role='instructor', is_approved=True)
        self.ic = Institute.objects.create(code='IC', name='Institute of Computing')
        self.it = Program.objects.create(institute=self.ic, code='BSIT', name='Information Technology')
        self.is_program = Program.objects.create(institute=self.ic, code='BSIS', name='Information Systems')
        other = Institute.objects.create(code='ANY', name='Any other institute')
        self.first = Program.objects.create(institute=other, code='ONE', name='First program')
        self.second = Program.objects.create(institute=other, code='TWO', name='Second program')
        for program in (self.it, self.is_program, self.first, self.second):
            InstructorAssignment.objects.create(instructor=self.owner, program=program)
        self.company = Company.objects.create(name='Original shared partner', added_by=self.admin)
        self.opening = Position.objects.create(company=self.company, title='Original shared opening')
        self.client.force_authenticate(self.owner)

    def catalog(self, program, **query):
        result = self.client.get(reverse('coordinator_partners', args=[program.pk]), query)
        self.assertEqual(result.status_code, 200, result.data)
        return result.data

    def test_original_shared_catalog_visible_in_both_ic_programs_without_rewriting_records(self):
        for program in (self.it, self.is_program):
            with self.subTest(program=program.code), CaptureQueriesContext(connection) as queries:
                listed = self.catalog(program)
                detail = self.client.get(reverse('coordinator_partner_detail', args=[program.pk, self.company.pk]))
                opening = self.client.get(reverse('coordinator_position_detail', args=[program.pk, self.opening.pk]))
                self.assertEqual(listed['count'], 1)
                self.assertEqual(detail.status_code, 200)
                self.assertEqual(opening.status_code, 200)
                self.assertEqual(listed['results'][0], detail.data)
                self.assertEqual(detail.data['positions'], [opening.data])
                self.assertEqual(opening.data['shared_institute']['id'], self.ic.pk)
                self.assertTrue(opening.data['can_edit'])
                self.assertTrue(detail.data['can_edit'])
                self.assertTrue(opening.data['can_archive'])
                self.assertTrue(detail.data['can_archive'])
                self.assertFalse(any(q['sql'].lstrip().upper().startswith(('INSERT', 'UPDATE', 'DELETE')) for q in queries))
        self.opening.refresh_from_db()
        self.assertIsNone(self.opening.management_program_id)
        self.assertIsNone(self.opening.eligibility_configured_at)
        self.assertFalse(self.opening.eligible_programs.exists())

    def test_same_institute_private_and_foreign_positions_stay_out_of_shared_partner_payload(self):
        private = Position.objects.create(company=self.company, title='IT only', eligibility_configured_at=timezone.now())
        private.eligible_programs.add(self.it)
        foreign = Position.objects.create(company=self.company, title='Other institute only', eligibility_configured_at=timezone.now())
        foreign.eligible_programs.add(self.first)
        closed = Position.objects.create(company=self.company, title='Closed unowned opening', eligibility_configured_at=timezone.now())
        self.assertEqual({p['id'] for p in self.catalog(self.it)['results'][0]['positions']}, {self.opening.pk, private.pk})
        self.assertEqual({p['id'] for p in self.catalog(self.is_program)['results'][0]['positions']}, {self.opening.pk})
        for hidden in (private, foreign, closed):
            self.assertEqual(self.client.get(reverse('coordinator_position_detail', args=[self.is_program.pk, hidden.pk])).status_code, 404)
        self.assertEqual({p['id'] for p in self.catalog(self.first)['results'][0]['positions']}, {foreign.pk})

    def test_explicit_program_sharing_works_for_any_institute_and_does_not_make_original_ic_openings_global(self):
        self.assertEqual(self.catalog(self.first)['count'], 0)
        self.assertEqual(self.catalog(self.second)['count'], 0)
        shared = Position.objects.create(company=self.company, title='Configured shared opening', eligibility_configured_at=timezone.now())
        shared.eligible_programs.add(self.first, self.second)
        for program in (self.first, self.second):
            listed = self.catalog(program)
            self.assertEqual(listed['count'], 1)
            self.assertEqual([p['id'] for p in listed['results'][0]['positions']], [shared.pk])
            self.assertIsNone(listed['results'][0]['positions'][0]['shared_institute'])
            self.assertEqual(self.client.get(reverse('coordinator_position_detail', args=[program.pk, self.opening.pk])).status_code, 404)

    def test_program_editing_keeps_archive_and_duplicate_creation_protected(self):
        for program in (self.it, self.is_program):
            partner_url = reverse('coordinator_partner_detail', args=[program.pk, self.company.pk])
            position_url = reverse('coordinator_position_detail', args=[program.pk, self.opening.pk])
            partner = self.client.get(partner_url).data
            position = self.client.get(position_url).data
            self.assertEqual(self.client.patch(partner_url, {'revision': partner['revision'], 'name': 'Updated partner'}, format='json').status_code, 200)
            self.assertEqual(self.client.patch(position_url, {'revision': position['revision'], 'slots': 5}, format='json').status_code, 200)
            for name, pk in [('partner', self.company.pk), ('position', self.opening.pk)]:
                latest = self.client.get(partner_url if name == 'partner' else position_url).data
                archive = reverse(f'coordinator_{name}_archive', args=[program.pk, pk])
                self.assertEqual(self.client.post(archive, {'revision': latest['revision']}, format='json').status_code, 200)
                archived = self.client.get(partner_url if name == 'partner' else position_url).data
                self.assertEqual(self.client.post(archive, {'revision': archived['revision'], 'restore': True}, format='json').status_code, 200)
            duplicate = self.client.post(reverse('coordinator_positions', args=[program.pk, self.company.pk]),
                {'title': self.opening.title, 'category_requirements': []}, format='json')
            self.assertEqual(duplicate.status_code, 409, duplicate.data)
        self.assertEqual(Position.objects.count(), 1)

    def test_filters_and_revoked_grants_apply_before_shared_catalog_read(self):
        self.assertEqual(self.catalog(self.it, search='No such partner')['count'], 0)
        self.company.archived_at = timezone.now()
        self.company.save(update_fields=['archived_at'])
        self.assertEqual(self.catalog(self.it)['count'], 0)
        self.assertEqual(self.catalog(self.it, status='archived')['count'], 1)
        InstructorAssignment.objects.filter(instructor=self.owner, program=self.it).update(is_active=False)
        for name, args in [('coordinator_partners', [self.it.pk]), ('coordinator_partner_detail', [self.it.pk, self.company.pk]),
                           ('coordinator_position_detail', [self.it.pk, self.opening.pk])]:
            self.assertEqual(self.client.get(reverse(name, args=args)).status_code, 404)
