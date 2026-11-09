"""Assigned coordinators edit shared records while scopes and evidence survive."""
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import Company, InstructorAssignment, ManagementAction, Position, PositionRequirement, SkillCategory
from .test_coordinator_catalog import CoordinatorFixtures


class AssignedCoordinatorEditingTests(CoordinatorFixtures, APITestCase):
    def original_ic(self):
        institute = self.program.institute
        institute.code, institute.name = 'IC', 'Institute of Computing'
        institute.save(update_fields=['code', 'name'])
        InstructorAssignment.objects.create(instructor=self.owner, program=self.other)
        company = Company.objects.create(name='Original IC partner', added_by=self.admin)
        position = Position.objects.create(company=company, title='Shared records role', slots_available=4)
        category = SkillCategory.objects.create(name='Shared records knowledge', description='Understand records tasks.')
        PositionRequirement.objects.create(position=position, skill_category=category, required_percentage=55)
        return company, position, category

    def test_original_ic_edit_preserves_shared_eligibility_and_requirement_identity(self):
        company, position, category = self.original_ic()
        url = reverse('coordinator_position_detail', args=[self.program.pk, position.pk])
        current = self.client.get(url).data
        self.assertTrue(current['can_edit_requirements'])
        changed = self.client.patch(url, {'revision': current['revision'], 'description': 'Updated shared work context.',
            'requirements': {category.name: 65}, 'tags': ['Records'], 'slots': 4}, format='json')
        self.assertEqual(changed.status_code, 200, changed.data)
        position.refresh_from_db()
        self.assertIsNone(position.eligibility_configured_at)
        self.assertIsNone(position.management_program_id)
        self.assertIsNone(position.created_by_id)
        self.assertFalse(position.eligible_programs.exists())
        self.assertEqual(list(position.requirements.values_list('skill_category_id', 'required_percentage')), [(category.pk, 65)])
        other = self.client.get(reverse('coordinator_position_detail', args=[self.other.pk, position.pk])).data
        self.assertEqual(other['description'], 'Updated shared work context.')
        self.assertEqual(other['requirements'], {category.name: 65})
        self.assertFalse(other['can_archive'])
        self.assertEqual(ManagementAction.objects.filter(action='position.update', actor=self.owner).count(), 1)
        company.refresh_from_db()
        self.assertEqual(company.added_by_id, self.admin.pk)

    def test_ic_editor_cannot_inject_framework_requirements_or_change_program_authority(self):
        _, position, category = self.original_ic()
        url = reverse('coordinator_position_detail', args=[self.program.pk, position.pk])
        revision = self.client.get(url).data['revision']
        for fields in ({'eligible_program_ids': [self.program.pk]}, {'created_by': self.owner.pk},
                       {'category_requirements': [{'category_id': self.category.pk, 'percentage': 80}]},
                       {'requirements': {'Unknown saved category': 70}}):
            self.assertEqual(self.client.patch(url, {'revision': revision, **fields}, format='json').status_code, 400)
        self.assertEqual(position.requirements.get().skill_category_id, category.pk)
        self.assertEqual(position.requirements.get().required_percentage, 55)

    def test_shared_position_other_program_can_edit_details_but_cannot_replace_foreign_rubric(self):
        partner = self.create_partner()
        payload = self.create_position(partner)
        position = Position.objects.get(pk=payload['id'])
        position.eligible_programs.add(self.other)
        self.client.force_authenticate(self.foreign)
        url = reverse('coordinator_position_detail', args=[self.other.pk, position.pk])
        current = self.client.get(url).data
        self.assertTrue(current['can_edit'])
        self.assertFalse(current['can_edit_requirements'])
        changed = self.client.patch(url, {'revision': current['revision'], 'description': 'Reviewed shared duties.', 'slots': 5}, format='json')
        self.assertEqual(changed.status_code, 200, changed.data)
        self.assertEqual(position.requirements.get().required_percentage, 70)
        blocked = self.client.patch(url, {'revision': changed.data['revision'], 'category_requirements': []}, format='json')
        self.assertEqual(blocked.status_code, 403)
        self.assertEqual(position.requirements.get().required_percentage, 70)
        self.assertEqual(set(position.eligible_programs.values_list('pk', flat=True)), {self.program.pk, self.other.pk})

    def test_shared_partner_details_are_editable_without_exposing_other_program_openings(self):
        partner = self.create_partner()
        own = self.create_position(partner)
        foreign_opening = Position.objects.create(company_id=partner['id'], title='Private foreign role',
            management_program=self.other, created_by=self.foreign, eligibility_configured_at=timezone.now())
        foreign_opening.eligible_programs.add(self.other)
        self.client.force_authenticate(self.peer)
        url = reverse('coordinator_partner_detail', args=[self.program.pk, partner['id']])
        current = self.client.get(url).data
        self.assertEqual([p['id'] for p in current['positions']], [own['id']])
        changed = self.client.patch(url, {'revision': current['revision'], 'name': 'Reviewed shared partner'}, format='json')
        self.assertEqual(changed.status_code, 200, changed.data)
        self.assertFalse(changed.data['can_archive'])
        self.assertEqual(self.client.get(reverse('coordinator_position_detail', args=[self.program.pk, foreign_opening.pk])).status_code, 404)
        self.client.force_authenticate(self.foreign)
        other = self.client.get(reverse('coordinator_partner_detail', args=[self.other.pk, partner['id']])).data
        self.assertEqual(other['name'], 'Reviewed shared partner')
        self.assertEqual([p['id'] for p in other['positions']], [foreign_opening.pk])

    def test_shared_edit_stale_review_and_revocation_are_rechecked_before_write(self):
        _, position, _ = self.original_ic()
        url = reverse('coordinator_position_detail', args=[self.program.pk, position.pk])
        current = self.client.get(url).data
        self.client.force_authenticate(self.peer)
        saved = self.client.patch(url, {'revision': current['revision'], 'description': 'Peer review'}, format='json')
        self.assertEqual(saved.status_code, 200, saved.data)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.patch(url, {'revision': current['revision'], 'description': 'Stale overwrite'}, format='json').status_code, 409)
        self.grant.is_active = False
        self.grant.save(update_fields=['is_active'])
        self.assertEqual(self.client.patch(url, {'revision': saved.data['revision'], 'description': 'Revoked overwrite'}, format='json').status_code, 404)
        position.refresh_from_db()
        self.assertEqual(position.description, 'Peer review')
