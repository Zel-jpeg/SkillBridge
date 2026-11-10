"""Reviewed scoped deletion never erases recommendation or placement evidence."""
from unittest.mock import patch

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import Company, ManagementAction, OJTPlacement, Position, Recommendation, User
from .test_coordinator_catalog import CoordinatorFixtures


class CoordinatorCardActionsTests(CoordinatorFixtures, APITestCase):
    def urls(self, company, position):
        return (reverse('coordinator_partner_detail', args=[self.program.pk, company]),
                reverse('coordinator_position_detail', args=[self.program.pk, position]))

    def test_assigned_peer_can_archive_restore_and_delete_unused_program_records(self):
        partner = self.create_partner()
        position = self.create_position(partner)
        company_url, position_url = self.urls(partner['id'], position['id'])
        self.client.force_authenticate(self.peer)
        for kind, url, pk in [('position', position_url, position['id']), ('partner', company_url, partner['id'])]:
            row = self.client.get(url).data
            self.assertTrue(row['can_edit'])
            self.assertTrue(row['can_archive'])
            self.assertTrue(row['can_delete'])
            archive = reverse(f'coordinator_{kind}_archive', args=[self.program.pk, pk])
            result = self.client.post(archive, {'revision': row['revision']}, format='json')
            self.assertEqual(result.status_code, 200, result.data)
            row = self.client.get(url).data
            self.assertIsNotNone(row['archived_at'])
            self.assertEqual(self.client.post(archive, {'revision': row['revision'], 'restore': True}, format='json').status_code, 200)
            row = self.client.get(url).data
            result = self.client.delete(url, {'revision': row['revision']}, format='json')
            self.assertEqual(result.status_code, 204, result.data)
        self.assertFalse(Company.objects.filter(pk=partner['id']).exists())
        self.assertFalse(Position.objects.filter(pk=position['id']).exists())
        self.assertEqual(ManagementAction.objects.filter(action__endswith='.delete', actor=self.peer).count(), 2)

    def test_saved_recommendations_block_position_and_cascading_partner_delete(self):
        partner = self.create_partner()
        position = self.create_position(partner)
        urls = self.urls(partner['id'], position['id'])
        student = User.objects.create_user('action-student@example.invalid', role='student')
        rec = Recommendation.objects.create(student=student, position_id=position['id'], match_score=70, is_current=False)
        for url in urls:
            row = self.client.get(url).data
            self.assertFalse(row['can_delete'])
            self.assertIn('Archive', row['delete_blocked_reason'])
            result = self.client.delete(url, {'revision': row['revision']}, format='json')
            self.assertEqual(result.status_code, 409, result.data)
        self.assertTrue(Recommendation.objects.filter(pk=rec.pk).exists())
        self.assertTrue(Position.objects.filter(pk=position['id']).exists())

    def test_all_saved_placement_states_block_deletion(self):
        partner = self.create_partner()
        position = self.create_position(partner)
        company_url, position_url = self.urls(partner['id'], position['id'])
        student = User.objects.create_user('history-student@example.invalid', role='student')
        for status in ['suggested', 'approved', 'removed', 'rejected']:
            record = OJTPlacement.objects.create(student=student, company_id=partner['id'], position_id=position['id'], status=status)
            for url in [company_url, position_url]:
                row = self.client.get(url).data
                self.assertFalse(row['can_delete'])
                self.assertEqual(self.client.delete(url, {'revision': row['revision']}, format='json').status_code, 409)
            record.delete()

    def test_foreign_program_and_revoked_grants_cannot_delete(self):
        partner = self.create_partner()
        position = self.create_position(partner)
        urls = self.urls(partner['id'], position['id'])
        self.client.force_authenticate(self.foreign)
        for url in urls:
            self.assertEqual(self.client.delete(url, {'revision': 'forged'}, format='json').status_code, 404)
        self.client.force_authenticate(self.owner)
        snapshots = [self.client.get(url).data for url in urls]
        self.grant.is_active = False
        self.grant.save(update_fields=['is_active'])
        for url, row in zip(urls, snapshots):
            self.assertEqual(self.client.delete(url, {'revision': row['revision']}, format='json').status_code, 404)

    def test_whole_partner_actions_do_not_affect_hidden_foreign_openings(self):
        partner = self.create_partner()
        position = self.create_position(partner)
        foreign = Position.objects.create(company_id=partner['id'], title='Foreign private', eligibility_configured_at=timezone.now(), management_program=self.other)
        foreign.eligible_programs.add(self.other)
        company_url, _ = self.urls(partner['id'], position['id'])
        row = self.client.get(company_url).data
        self.assertTrue(row['can_edit'])
        self.assertFalse(row['can_archive'])
        self.assertFalse(row['can_delete'])
        self.assertEqual(self.client.delete(company_url, {'revision': row['revision']}, format='json').status_code, 403)
        self.assertTrue(Position.objects.filter(pk=foreign.pk).exists())

    def test_stale_review_and_new_history_after_preview_are_rechecked(self):
        partner = self.create_partner()
        position = self.create_position(partner)
        _, url = self.urls(partner['id'], position['id'])
        before = self.client.get(url).data
        changed = self.client.patch(url, {'revision': before['revision'], 'description': 'Reviewed change'}, format='json')
        self.assertEqual(changed.status_code, 200)
        self.assertEqual(self.client.delete(url, {'revision': before['revision']}, format='json').status_code, 409)
        student = User.objects.create_user('new-history@example.invalid', role='student')
        Recommendation.objects.create(student=student, position_id=position['id'], match_score=80)
        self.assertEqual(self.client.delete(url, {'revision': changed.data['revision']}, format='json').status_code, 409)

    def test_empty_partner_delete_cleans_image_only_after_commit(self):
        partner = self.create_partner()
        url = reverse('coordinator_partner_detail', args=[self.program.pk, partner['id']])
        Company.objects.filter(pk=partner['id']).update(image_key='company-images/synthetic.webp')
        row = self.client.get(url).data
        with patch('api.coordinator_catalog.cleanup_image') as cleanup:
            with self.captureOnCommitCallbacks(execute=True):
                result = self.client.delete(url, {'revision': row['revision']}, format='json')
                cleanup.assert_not_called()
            self.assertEqual(result.status_code, 204)
            cleanup.assert_called_once_with('company-images/synthetic.webp')
