"""Synthetic cycle transitions, retained records and direct access boundaries."""
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, Event
from unittest import skipUnless

from django.urls import reverse
from django.db import connection, close_old_connections
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework.test import APITestCase, APIClient

from .models import (Assessment, Batch, BatchEnrollment, Company, ManagementAction,
                     OJTPlacement, Position, Recommendation, SkillCategory,
                     SkillScore, StudentResponse, User)


class CycleLifecycleTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email='cycle-admin@example.com', role='admin')
        self.owner = User.objects.create_user(email='cycle-owner@example.com', role='instructor', is_approved=True)
        self.other = User.objects.create_user(email='cycle-other@example.com', role='instructor', is_approved=True)
        self.student = User.objects.create_user(email='cycle-student@dnsc.edu.ph', name='Synthetic Student',
            role='student', school_id='2026-00001', course='BSIT', phone='09123456789', is_approved=True,
            address={'stayingAt': 'home', 'travelWilling': 'panabo', 'pinLat': 7.3, 'pinLng': 125.6,
                     'home': {'province': 'Davao del Norte', 'city': 'Panabo City', 'barangay': 'New Visayas'}})
        self.batch = Batch.objects.create(name='Cycle A', instructor=self.owner)
        self.enrollment = BatchEnrollment.objects.create(batch=self.batch, student=self.student)
        self.company = Company.objects.create(name='Synthetic Partner', address={'city': 'Panabo'})
        self.position = Position.objects.create(company=self.company, title='Network Support', slots_available=2)
        self.placement = OJTPlacement.objects.create(student=self.student, company=self.company,
            position=self.position, batch=self.batch, status='approved', approved_at=timezone.now(),
            match_score_at_assignment=72.5, assigned_by=self.owner, approved_by=self.owner)
        self.client.force_authenticate(self.owner)

    def preview(self):
        response = self.client.get(reverse('batch_closeout', args=[self.batch.pk]))
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def close(self, preview, note=''):
        return self.client.post(reverse('batch_closeout', args=[self.batch.pk]),
            {'review_token': preview['review_token'], 'note': note}, format='json')

    def test_training_completion_endpoint_is_absent(self):
        response = self.client.post('/api/placements/complete/', {'placement_id': self.placement.pk}, format='json')
        self.assertEqual(response.status_code, 404)
        self.placement.refresh_from_db()
        self.assertEqual(self.placement.status, 'approved')
        self.assertIsNone(self.placement.completed_at)

    def test_archive_releases_allocation_without_changing_approval_history(self):
        from .placement_scope import current_approvals
        self.assertEqual(current_approvals(position=self.position).count(), 1)
        self.assertEqual(self.close(self.preview()).status_code, 200)
        self.assertEqual(current_approvals(position=self.position).count(), 0)
        self.placement.refresh_from_db()
        self.assertEqual((self.placement.status, self.placement.match_score_at_assignment), ('approved', 72.5))
        self.assertIsNone(self.placement.completed_at)
        self.assertEqual(self.client.post(reverse('placement_remove'),
            {'placement_id': self.placement.pk, 'remarks': 'Archived records stay unchanged'}, format='json').status_code, 409)

    def test_reactivation_blocks_capacity_and_retired_openings(self):
        self.assertEqual(self.close(self.preview()).status_code, 200)
        self.position.slots_available = 0; self.position.save()
        url = reverse('instructor_batch_unarchive', args=[self.batch.pk])
        self.assertEqual(self.client.post(url).status_code, 409)
        self.position.slots_available = 2; self.position.archived_at = timezone.now(); self.position.save()
        self.assertEqual(self.client.post(url).status_code, 409)
        self.position.archived_at = None; self.position.save()
        self.assertEqual(self.client.post(url).status_code, 200)

    def test_reenrollment_does_not_revive_an_overbooked_or_retired_approval(self):
        from .enrollment_import import review_rows
        self.enrollment.delete()
        row = {'school_id': self.student.school_id, 'email': self.student.email,
               'name': self.student.name, 'course': self.student.course}
        self.position.slots_available = 0; self.position.save()
        self.assertEqual(review_rows([row], self.batch)[0]['status'], 'conflict')
        self.position.slots_available = 2; self.position.archived_at = timezone.now(); self.position.save()
        self.assertEqual(review_rows([row], self.batch)[0]['status'], 'conflict')
        self.position.archived_at = None; self.position.save()
        self.assertEqual(review_rows([row], self.batch)[0]['status'], 'existing_student')

    def test_active_batches_share_slots_and_detached_legacy_decisions_remain_reserved(self):
        from .placement_scope import current_approvals
        other = User.objects.create_user(email='shared-scope@example.com', role='student')
        batch = Batch.objects.create(name='Parallel batch', instructor=self.other)
        BatchEnrollment.objects.create(student=other, batch=batch)
        second = OJTPlacement.objects.create(student=other, batch=batch, company=self.company, position=self.position, status='approved')
        self.assertEqual(current_approvals(position=self.position).count(), 2)
        self.assertEqual(self.close(self.preview()).status_code, 200)
        self.assertEqual(current_approvals(position=self.position).count(), 1)
        second.batch = None; second.save(update_fields=['batch'])
        batch.status = 'archived'; batch.save()
        self.assertEqual(current_approvals(position=self.position).count(), 1)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.post(reverse('partner_archive', args=[self.company.pk]), {}, format='json').status_code, 409)

    def test_legacy_completed_record_is_preserved_without_becoming_current_allocation(self):
        from .placement_scope import current_approvals
        self.placement.status = 'completed'; self.placement.completed_at = timezone.now(); self.placement.save()
        before = self.placement.completed_at
        self.assertEqual(current_approvals(student=self.student).count(), 0)
        self.assertEqual(self.close(self.preview()).status_code, 200)
        self.placement.refresh_from_db()
        self.assertEqual((self.placement.status, self.placement.completed_at), ('completed', before))

    def test_reverse_scope_migration_protects_multiple_batch_decisions(self):
        from importlib import import_module
        from django.apps import apps
        from django.db.migrations.exceptions import IrreversibleError
        other = Batch.objects.create(name='Historical batch', instructor=self.owner, status='archived')
        OJTPlacement.objects.create(student=self.student, batch=other, company=self.company, position=self.position, status='approved')
        guard = import_module('api.migrations.0029_recommendation_cycle_scope').protect_decision_history
        with self.assertRaises(IrreversibleError):
            guard(apps, type('Editor', (), {'connection': connection})())

    def test_catalog_archive_preserves_placements_and_independent_position_state(self):
        self.client.force_authenticate(self.admin)
        url = reverse('partner_archive', args=[self.company.pk])
        self.assertEqual(self.client.post(url, {}, format='json').status_code, 409)
        self.assertEqual(self.client.post(reverse('instructor_batch_archive', args=[self.batch.pk])).status_code, 200)
        self.assertEqual(self.client.post(reverse('position_archive', args=[self.position.pk]), {}, format='json').status_code, 200)
        self.assertEqual(self.client.post(url, {}, format='json').status_code, 200)
        self.assertEqual(self.client.post(url, {'restore': True}, format='json').status_code, 200)
        self.position.refresh_from_db()
        self.assertIsNotNone(self.position.archived_at)
        self.assertTrue(OJTPlacement.objects.filter(pk=self.placement.pk).exists())
        self.assertEqual(self.client.patch(reverse('admin_position_detail', args=[self.position.pk]),
                                          {'slots': 3}, format='json').status_code, 409)

    def test_closeout_retains_approved_decisions_and_stores_frozen_version(self):
        reviewed = self.preview()
        self.assertEqual(self.close(reviewed).status_code, 200)
        self.batch.refresh_from_db()
        self.assertEqual(self.batch.status, 'archived')
        original = self.batch.closeout_snapshots[0]
        self.company.name = 'Next cycle label'; self.company.save()
        self.position.slots_available = 8; self.position.save()
        self.student.name = 'Updated student'; self.student.save()
        response = self.client.get(reverse('batch_closeout', args=[self.batch.pk]), {'version': 1})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, original)
        self.assertEqual(response.data['catalog'][0]['slots'], 2)
        self.assertEqual(response.data['placements'][0]['company']['name'], 'Synthetic Partner')
        self.assertEqual(self.close(reviewed).status_code, 409)

    def test_preview_changes_and_wrong_actor_require_new_review(self):
        reviewed = self.preview()
        self.position.title = 'Changed'; self.position.save()
        self.assertEqual(self.close(reviewed).status_code, 409)
        reviewed = self.preview()
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.close(reviewed).status_code, 409)

    def test_unplaced_students_can_archive_without_training_outcomes(self):
        self.placement.delete()
        preview = self.preview()
        self.assertEqual(self.close(preview).status_code, 200)
        self.batch.refresh_from_db()
        self.assertNotIn('exceptions', self.batch.closeout_snapshots[0])
        self.assertEqual(self.batch.closeout_snapshots[0]['schema_version'], 2)

    def test_unfinished_attempt_blocks_both_archive_and_closeout(self):
        assessment = Assessment.objects.create(title='Unfinished', batch=self.batch, created_by=self.owner)
        StudentResponse.objects.create(student=self.student, assessment=assessment, started_at=timezone.now())
        self.assertEqual(self.client.post(reverse('instructor_batch_archive', args=[self.batch.pk])).status_code, 409)
        self.assertEqual(self.close(self.preview()).status_code, 409)

    def test_reactivation_conflict_and_new_cycle_preserves_original_snapshot(self):
        self.assertEqual(self.close(self.preview()).status_code, 200)
        next_batch = Batch.objects.create(name='Cycle B', instructor=self.other)
        BatchEnrollment.objects.create(student=self.student, batch=next_batch)
        self.assertEqual(self.client.post(reverse('instructor_batch_unarchive', args=[self.batch.pk])).status_code, 409)
        self.batch.refresh_from_db()
        self.assertEqual(len(self.batch.closeout_snapshots), 1)
        self.client.force_authenticate(self.student)
        response = self.client.get(reverse('student_history'))
        self.assertEqual(len(response.data['batches']), 2)
        self.assertEqual(response.data['batches'][1]['placements'][0]['status'], 'approved')

    def test_history_is_private_and_confirmed_profile_clears_return_gate(self):
        self.enrollment.profile_review_required = True; self.enrollment.save()
        assessment = Assessment.objects.create(title='Required', batch=self.batch, created_by=self.owner)
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.post(reverse('assessment_start', args=[assessment.pk])).status_code, 409)
        self.assertEqual(self.client.post(reverse('confirm_profile'), {'batch_id': self.batch.pk}, format='json').status_code, 200)
        self.enrollment.refresh_from_db()
        self.assertFalse(self.enrollment.profile_review_required)
        self.assertIsNotNone(self.enrollment.profile_confirmed_at)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(reverse('student_history')).status_code, 403)
        self.assertEqual(self.client.get(reverse('batch_closeout', args=[self.batch.pk])).status_code, 404)

    def test_recloseout_appends_version_and_never_overwrites_first(self):
        self.close(self.preview())
        self.batch.refresh_from_db(); original = self.batch.closeout_snapshots[0]
        self.assertEqual(self.client.post(reverse('instructor_batch_unarchive', args=[self.batch.pk])).status_code, 200)
        self.assertEqual(self.close(self.preview()).status_code, 200)
        self.batch.refresh_from_db()
        self.assertEqual(len(self.batch.closeout_snapshots), 2)
        self.assertEqual(self.batch.closeout_snapshots[0], original)


    def test_explicit_transfer_is_scoped_audited_repeat_safe_and_retains_history(self):
        target = Batch.objects.create(name='Transfer target', instructor=self.other)
        url = reverse('transfer_student', args=[target.pk])
        self.assertEqual(self.client.post(url, {'school_id': self.student.school_id}, format='json').status_code, 404)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.post(url, {'school_id': self.student.school_id}, format='json').status_code, 403)
        self.client.force_authenticate(self.admin)
        preview = self.client.post(url, {'school_id': self.student.school_id}, format='json')
        self.assertEqual(preview.status_code, 200, preview.data)
        result = self.client.post(url, {'review_token': preview.data['review_token']}, format='json')
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(self.client.post(url, {'review_token': preview.data['review_token']}, format='json').status_code, 200)
        self.assertEqual(BatchEnrollment.objects.filter(student=self.student).count(), 1)
        self.assertTrue(BatchEnrollment.objects.get(batch=target, student=self.student).profile_review_required)
        self.assertTrue(OJTPlacement.objects.filter(pk=self.placement.pk, status='approved', batch=self.batch).exists())
        self.assertEqual(self.client.post(reverse('placement_remove'),
            {'placement_id': self.placement.pk, 'remarks': 'Previous enrollment is read-only'}, format='json').status_code, 409)
        self.assertEqual(ManagementAction.objects.filter(action='enrollment.transfer').count(), 1)
        self.client.force_authenticate(self.student)
        history = self.client.get(reverse('student_history')).data['batches']
        self.assertEqual({b['batch']['id'] for b in history}, {self.batch.pk, target.pk})

    def test_invalid_transfer_rolls_back_original_membership(self):
        target = Batch.objects.create(name='Transfer target', instructor=self.owner)
        self.student.course = 'Unsupported'; self.student.save()
        url = reverse('transfer_student', args=[target.pk])
        preview = self.client.post(url, {'school_id': self.student.school_id}, format='json').data
        result = self.client.post(url, {'review_token': preview['review_token']}, format='json')
        self.assertEqual(result.status_code, 400)
        self.assertTrue(BatchEnrollment.objects.filter(pk=self.enrollment.pk).exists())
        self.assertFalse(BatchEnrollment.objects.filter(batch=target).exists())

    def test_student_history_never_discloses_staff_decision_notes(self):
        self.placement.status = 'rejected'; self.placement.remarks = 'Private staff-only note'; self.placement.save()
        self.client.force_authenticate(self.student)
        history = self.client.get(reverse('student_history'))
        self.assertEqual(history.status_code, 200)
        self.assertNotIn('Private staff-only note', str(history.data))
        self.assertEqual(history.data['batches'][0]['placements'], [])

    def test_archived_previous_cycle_does_not_hide_reused_position_or_overwrite_history(self):
        from .models import CombinedCompetencyProfile, PositionRequirement
        from .recommendation_freshness import input_fingerprint
        self.batch.status = 'archived'; self.batch.save(update_fields=['status'])
        target = Batch.objects.create(name='Repeat cycle', instructor=self.owner)
        BatchEnrollment.objects.create(student=self.student, batch=target)
        category = SkillCategory.objects.create(name='Networking')
        PositionRequirement.objects.create(position=self.position, skill_category=category, required_percentage=60)
        assessment = Assessment.objects.create(title='New-cycle exam', batch=target, created_by=self.owner)
        StudentResponse.objects.create(student=self.student, assessment=assessment, status='submitted', submitted_at=timezone.now())
        SkillScore.objects.create(student=self.student, assessment=assessment, skill_category=category,
                                  raw_score=8, max_score=10, percentage=80)
        CombinedCompetencyProfile.objects.create(student=self.student, batch=target, is_finalized=True,
            included_assessment_ids=[assessment.pk], ranking_input_fingerprint=input_fingerprint(self.student))
        rec = Recommendation.objects.create(student=self.student, batch=target, position=self.position, match_score=80)
        listing = self.client.get(reverse('placement_suggestions'), {'include_history': 'true', 'include_placed': 'true'})
        self.assertEqual(listing.status_code, 200)
        suggestion = listing.data['companies'][0]['positions'][0]['suggested_students'][0]
        self.assertEqual(suggestion['placement_status'], 'unplaced')
        approved = self.client.post(reverse('placement_approve'), {'recommendation_id': rec.pk}, format='json')
        self.assertEqual(approved.status_code, 201, approved.data)
        self.placement.refresh_from_db()
        self.assertEqual((self.placement.status, self.placement.match_score_at_assignment), ('approved', 72.5))
        old_roster = self.client.get(reverse('instructor_batch_students', args=[self.batch.pk])).data
        self.assertEqual(old_roster['students'][0]['placement']['status'], 'approved')
        new_roster = self.client.get(reverse('instructor_batch_students', args=[target.pk])).data
        self.assertEqual(new_roster['students'][0]['placement']['status'], 'approved')

    def test_archiving_releases_only_that_batchs_manual_choices_for_future_cycles(self):
        from .placement_drafts import read_state, STATE_ACTION
        other_batch = Batch.objects.create(name='Unchanged batch', instructor=self.other)
        other = User.objects.create_user(email='other-cycle-student@example.com', role='student')
        ManagementAction.objects.create(actor=self.admin, action=STATE_ACTION,
            target_type='placement_allocation', target_id=1, metadata={'revision': 1, 'input_signature': 'old',
            'manual_choices': {str(self.student.pk): {'batch_id': self.batch.pk, 'position_id': self.position.pk},
                               str(other.pk): {'batch_id': other_batch.pk, 'position_id': self.position.pk}}, 'proposals': []})
        response = self.client.post(reverse('instructor_batch_archive', args=[self.batch.pk]), {}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        state = read_state()
        self.assertNotIn(str(self.student.pk), state.manual_choices)
        self.assertIn(str(other.pk), state.manual_choices)
        self.assertTrue(OJTPlacement.objects.filter(pk=self.placement.pk, status='approved').exists())

    def test_reverse_migration_cannot_silently_remove_a_pending_profile_review(self):
        from importlib import import_module
        from types import SimpleNamespace
        from django.apps import apps
        from django.db.migrations.exceptions import IrreversibleError
        self.enrollment.profile_review_required = True
        self.enrollment.save(update_fields=['profile_review_required'])
        guard = import_module('api.migrations.0028_ojt_cycle_lifecycle').protect_issued_records
        with self.assertRaises(IrreversibleError):
            guard(apps, SimpleNamespace(connection=connection))

    def test_confirming_changed_profile_refreshes_retained_same_batch_results_without_resetting_scores(self):
        from unittest.mock import patch
        from .models import CombinedCompetencyProfile, PositionRequirement
        from .recommendation_freshness import input_fingerprint
        from .combined_competency import combined_is_unlocked
        category = SkillCategory.objects.create(name='Networking')
        PositionRequirement.objects.create(position=self.position, skill_category=category, required_percentage=60)
        assessment = Assessment.objects.create(title='Retained assessment', batch=self.batch, created_by=self.owner)
        StudentResponse.objects.create(student=self.student, assessment=assessment, status='submitted', submitted_at=timezone.now())
        score = SkillScore.objects.create(student=self.student, assessment=assessment, skill_category=category,
                                         raw_score=8, max_score=10, percentage=80)
        CombinedCompetencyProfile.objects.create(student=self.student, batch=self.batch, is_finalized=True,
            included_assessment_ids=[assessment.pk], ranking_input_fingerprint=input_fingerprint(self.student))
        self.enrollment.profile_review_required = True; self.enrollment.save()
        self.student.address = {**self.student.address, 'pinLat': 8.0}; self.student.save()
        self.client.force_authenticate(self.student)
        with patch('api.recommendation_nlp.preprocess_texts', side_effect=lambda texts, model: (['synthetic evidence'] * len(texts), model, None)):
            result = self.client.post(reverse('confirm_profile'), {'batch_id': self.batch.pk}, format='json')
        self.assertEqual(result.status_code, 200, result.data)
        self.assertTrue(combined_is_unlocked(self.student, self.batch))
        score.refresh_from_db(); self.placement.refresh_from_db()
        self.assertEqual((score.raw_score, score.max_score, self.placement.match_score_at_assignment), (8, 10, 72.5))

    def test_profile_confirmation_is_repeat_safe_and_rejects_malformed_payloads(self):
        from unittest.mock import patch
        self.enrollment.profile_review_required = True
        self.enrollment.save(update_fields=['profile_review_required'])
        self.client.force_authenticate(self.student)
        url = reverse('confirm_profile')
        self.assertEqual(self.client.post(url, [], format='json').status_code, 400)
        self.assertEqual(self.client.post(url, {'batch_id': True}, format='json').status_code, 400)
        first = self.client.post(url, {'batch_id': self.batch.pk}, format='json')
        self.assertEqual(first.status_code, 200, first.data)
        with patch('api.combined_competency.recalculate_combined', side_effect=AssertionError('Repeat must not regenerate')):
            repeated = self.client.post(url, {'batch_id': self.batch.pk}, format='json')
        self.assertEqual(repeated.status_code, 200, repeated.data)
        self.assertTrue(repeated.data['idempotent'])
        self.assertEqual(repeated.data['profile_confirmed_at'], first.data['profile_confirmed_at'])


    def test_reopened_batch_history_uses_current_results_while_issued_snapshot_stays_unchanged(self):
        category = SkillCategory.objects.create(name='Networking')
        assessment = Assessment.objects.create(title='Original exam', batch=self.batch, created_by=self.owner)
        StudentResponse.objects.create(student=self.student, assessment=assessment, status='submitted', submitted_at=timezone.now())
        score = SkillScore.objects.create(student=self.student, assessment=assessment, skill_category=category,
                                         raw_score=7, max_score=10, percentage=70)
        self.assertEqual(self.close(self.preview()).status_code, 200)
        self.assertEqual(self.client.post(reverse('instructor_batch_unarchive', args=[self.batch.pk])).status_code, 200)
        score.raw_score = 9; score.percentage = 90; score.save()
        self.client.force_authenticate(self.student)
        row = self.client.get(reverse('student_history')).data['batches'][0]
        self.assertEqual(row['assessments'][0]['category_scores'][0]['raw_score'], 9)
        self.assertIsNone(row['snapshot_at'])
        self.client.force_authenticate(self.owner)
        saved = self.client.get(reverse('batch_closeout', args=[self.batch.pk]), {'version': 1}).data
        self.assertEqual(saved['students'][0]['assessments'][0]['category_scores'][0]['raw_score'], 7)

    def test_transfer_does_not_orphan_pending_or_approved_retakes(self):
        target = Batch.objects.create(name='Target', instructor=self.owner)
        assessment = Assessment.objects.create(title='Retake exam', batch=self.batch, created_by=self.owner)
        attempt = StudentResponse.objects.create(student=self.student, assessment=assessment,
            status='stopped', started_at=timezone.now(), submitted_at=timezone.now(), retake_request_status='pending')
        url = reverse('transfer_student', args=[target.pk])
        pending = self.client.post(url, {'school_id': self.student.school_id}, format='json')
        self.assertEqual(pending.status_code, 409, pending.data)
        attempt.retake_request_status = 'approved'; attempt.retake_allowed = True; attempt.save()
        approved = self.client.post(url, {'school_id': self.student.school_id}, format='json')
        self.assertEqual(approved.status_code, 409, approved.data)
        self.assertTrue(BatchEnrollment.objects.filter(pk=self.enrollment.pk).exists())


class CycleMigrationTests(TransactionTestCase):
    def test_additive_migration_preserves_tables_and_legacy_records(self):
        from django.db.migrations.executor import MigrationExecutor
        executor = MigrationExecutor(connection)
        latest = executor.loader.graph.leaf_nodes()
        # Resolve the previous migration by its actual dependency, avoiding assumptions.
        from importlib import import_module
        old = import_module('api.migrations.0028_ojt_cycle_lifecycle').Migration.dependencies
        executor.migrate(old)
        try:
            apps = executor.loader.project_state(old).apps
            user = apps.get_model('api', 'User').objects.create(email='cycle-legacy@example.com', role='student')
            owner = apps.get_model('api', 'User').objects.create(email='cycle-legacy-owner@example.com', role='instructor')
            batch = apps.get_model('api', 'Batch').objects.create(name='Legacy', instructor_id=owner.pk, status='archived')
            company = apps.get_model('api', 'Company').objects.create(name='Legacy partner')
            position = apps.get_model('api', 'Position').objects.create(company_id=company.pk, title='Legacy role', slots_available=5)
            placement = apps.get_model('api', 'OJTPlacement').objects.create(student_id=user.pk, batch_id=batch.pk,
                company_id=company.pk, position_id=position.pk, status='approved', match_score_at_assignment=72.5)
            tables = set(connection.introspection.table_names())
            MigrationExecutor(connection).migrate(latest)
            self.assertEqual(set(connection.introspection.table_names()), tables)
            self.assertEqual(Batch.objects.get(pk=batch.pk).closeout_snapshots, [])
            self.assertIsNone(Company.objects.get(pk=company.pk).archived_at)
            saved = OJTPlacement.objects.get(pk=placement.pk)
            self.assertEqual((saved.status, saved.completed_at, saved.match_score_at_assignment), ('approved', None, 72.5))
        finally:
            MigrationExecutor(connection).migrate(latest)


@skipUnless(connection.vendor == 'postgresql', 'Requires disposable PostgreSQL row locking')
class ConcurrentCycleTests(TransactionTestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email='cycle-race-admin@example.com', role='admin')
        self.student = User.objects.create_user(email='cycle-race-student@example.com', role='student', is_approved=True)
        self.batch = Batch.objects.create(name='Race cycle', instructor=self.admin)
        BatchEnrollment.objects.create(batch=self.batch, student=self.student)
        self.company = Company.objects.create(name='Race partner')
        self.position = Position.objects.create(company=self.company, title='Race role', slots_available=1)

    def request(self, actor_id, endpoint, payload, barrier, method='post'):
        close_old_connections()
        try:
            actor = User.objects.get(pk=actor_id)
            client = APIClient(); client.force_authenticate(actor)
            barrier.wait(timeout=10)
            response = getattr(client, method)(endpoint, payload, format='json')
            return response.status_code, response.data
        finally:
            close_old_connections()

    def test_partner_archive_and_assignment_cannot_leave_archived_current_allocation(self):
        barrier = Barrier(2)
        with ThreadPoolExecutor(max_workers=2) as pool:
            a = pool.submit(self.request, self.admin.pk, reverse('partner_archive', args=[self.company.pk]), {}, barrier)
            b = pool.submit(self.request, self.admin.pk, reverse('placement_manual_assign'),
                {'student_id': self.student.pk, 'position_id': self.position.pk, 'batch_id': self.batch.pk}, barrier)
            results = [a.result(timeout=30), b.result(timeout=30)]
        self.company.refresh_from_db()
        from .placement_scope import current_approvals
        allocated = current_approvals(company=self.company).count()
        self.assertFalse(self.company.archived_at and allocated, results)
        self.assertEqual(sum(code < 300 for code, _ in results), 1, results)

    def test_batch_closeout_and_attempt_start_serialize(self):
        from .models import Question, AnswerChoice
        assessment = Assessment.objects.create(title='Race exam', created_by=self.admin, batch=self.batch)
        question = Question.objects.create(assessment=assessment, question_text='Synthetic question')
        AnswerChoice.objects.create(question=question, choice_text='Synthetic choice', is_correct=True)
        client = APIClient(); client.force_authenticate(self.admin)
        preview = client.get(reverse('batch_closeout', args=[self.batch.pk])).data
        barrier = Barrier(2)
        with ThreadPoolExecutor(max_workers=2) as pool:
            a = pool.submit(self.request, self.admin.pk, reverse('batch_closeout', args=[self.batch.pk]),
                {'review_token': preview['review_token']}, barrier)
            b = pool.submit(self.request, self.student.pk, reverse('assessment_start', args=[assessment.pk]), {}, barrier)
            results = [a.result(timeout=30), b.result(timeout=30)]
        self.assertEqual(sorted(code for code, _ in results), [200, 409], results)
        self.batch.refresh_from_db()
        self.assertFalse(self.batch.status == 'archived' and StudentResponse.objects.filter(assessment=assessment).exists(), results)

    def test_archive_waits_for_submission_profiles_and_combined_scores_to_finish(self):
        from unittest.mock import patch
        from .models import Question, AnswerChoice
        from .scoring import update_assessment_profile
        category = SkillCategory.objects.create(name='Synthetic skill')
        assessment = Assessment.objects.create(title='Submission race', created_by=self.admin, batch=self.batch)
        question = Question.objects.create(assessment=assessment, question_text='Synthetic question', skill_category=category)
        choice = AnswerChoice.objects.create(question=question, choice_text='Synthetic choice', is_correct=True)
        client = APIClient(); client.force_authenticate(self.student)
        started = client.post(reverse('assessment_start', args=[assessment.pk])).data
        payload = {'response_id': started['response_id'], 'attempt_started_at': started['attempt_started_at'],
                   'answers': [{'question_id': question.pk, 'selected_choice_id': choice.pk}]}
        finalizing, release, archived = Event(), Event(), Event()

        def hold_profile(*args, **kwargs):
            finalizing.set()
            if not release.wait(timeout=15):
                raise RuntimeError('Synthetic finalization wait expired')
            return update_assessment_profile(*args, **kwargs)

        def archive():
            try:
                return self.request(self.admin.pk, reverse('instructor_batch_archive', args=[self.batch.pk]), {}, Barrier(1))
            finally:
                archived.set()

        with patch('api.scoring.update_assessment_profile', side_effect=hold_profile):
            with ThreadPoolExecutor(max_workers=2) as pool:
                submit = pool.submit(self.request, self.student.pk, reverse('assessment_submit', args=[assessment.pk]), payload, Barrier(1))
                self.assertTrue(finalizing.wait(timeout=10))
                archive_result = pool.submit(archive)
                try:
                    self.assertFalse(archived.wait(timeout=2), 'Archive finished before submitted evidence was finalized')
                finally:
                    release.set()
                outcomes = [submit.result(timeout=30), archive_result.result(timeout=30)]
        self.assertEqual([code for code, _ in outcomes], [200, 200], outcomes)
        self.assertEqual(SkillScore.objects.get(student=self.student, assessment=assessment).raw_score, 1)
        self.batch.refresh_from_db()
        self.assertEqual(self.batch.status, 'archived')

    def enrollment_preview(self, student, batch):
        client = APIClient(); client.force_authenticate(self.admin)
        response = client.post(reverse('instructor_batch_enroll_preview', args=[batch.pk]),
            {'students': [{'school_id': student.school_id, 'email': student.email, 'name': student.name, 'course': student.course}]}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        return {'students': response.data['rows'], 'review_token': response.data['review_token'], 'email_mode': 'later'}

    def test_profile_save_waits_for_submission_before_locking_student(self):
        from unittest.mock import patch
        from .models import Question, AnswerChoice
        from .scoring import update_assessment_profile
        category = SkillCategory.objects.create(name='Synthetic profile race skill')
        assessment = Assessment.objects.create(title='Profile submission race', created_by=self.admin, batch=self.batch)
        question = Question.objects.create(assessment=assessment, question_text='Synthetic question', skill_category=category)
        choice = AnswerChoice.objects.create(question=question, choice_text='Synthetic choice', is_correct=True)
        client = APIClient(); client.force_authenticate(self.student)
        started = client.post(reverse('assessment_start', args=[assessment.pk])).data
        payload = {'response_id': started['response_id'], 'attempt_started_at': started['attempt_started_at'],
                   'answers': [{'question_id': question.pk, 'selected_choice_id': choice.pk}]}
        finalizing, release, saved = Event(), Event(), Event()

        def hold_profile(*args, **kwargs):
            finalizing.set()
            if not release.wait(timeout=15):
                raise RuntimeError('Synthetic profile-save wait expired')
            return update_assessment_profile(*args, **kwargs)

        def save():
            try:
                return self.request(self.student.pk, reverse('student_profile'), {'phone': '09987654321'}, Barrier(1), 'patch')
            finally:
                saved.set()

        with patch('api.scoring.update_assessment_profile', side_effect=hold_profile):
            with ThreadPoolExecutor(max_workers=2) as pool:
                submit = pool.submit(self.request, self.student.pk, reverse('assessment_submit', args=[assessment.pk]), payload, Barrier(1))
                self.assertTrue(finalizing.wait(timeout=10))
                profile = pool.submit(save)
                try:
                    self.assertFalse(saved.wait(timeout=2))
                finally:
                    release.set()
                results = [submit.result(timeout=30), profile.result(timeout=30)]
        self.assertEqual([code for code, _ in results], [200, 200], results)
        self.student.refresh_from_db()
        self.assertEqual(self.student.phone, '09987654321')
        self.assertEqual(SkillScore.objects.get(student=self.student, assessment=assessment).raw_score, 1)

    def test_transfer_waits_for_start_without_locking_student_before_source_batch(self):
        from unittest.mock import patch
        from django.db.models.query import QuerySet
        from .models import Question, AnswerChoice
        self.student.school_id = '2026-00999'
        self.student.course = 'BSIT'
        self.student.save(update_fields=['school_id', 'course'])
        target = Batch.objects.create(name='Transfer race target', instructor=self.admin)
        assessment = Assessment.objects.create(title='Start transfer race', created_by=self.admin, batch=self.batch)
        question = Question.objects.create(assessment=assessment, question_text='Synthetic question')
        AnswerChoice.objects.create(question=question, choice_text='Synthetic choice', is_correct=True)
        starting, release, transferred = Event(), Event(), Event()
        original = QuerySet.get_or_create

        def hold_start(queryset, *args, **kwargs):
            if queryset.model is StudentResponse:
                starting.set()
                if not release.wait(timeout=15):
                    raise RuntimeError('Synthetic attempt-start wait expired')
            return original(queryset, *args, **kwargs)

        def transfer():
            try:
                return self.request(self.admin.pk, reverse('transfer_student', args=[target.pk]),
                                    {'school_id': self.student.school_id}, Barrier(1))
            finally:
                transferred.set()

        with patch.object(QuerySet, 'get_or_create', new=hold_start):
            with ThreadPoolExecutor(max_workers=2) as pool:
                start = pool.submit(self.request, self.student.pk, reverse('assessment_start', args=[assessment.pk]), {}, Barrier(1))
                self.assertTrue(starting.wait(timeout=10))
                transfer_result = pool.submit(transfer)
                try:
                    self.assertFalse(transferred.wait(timeout=2))
                finally:
                    release.set()
                results = [start.result(timeout=30), transfer_result.result(timeout=30)]
        self.assertEqual([code for code, _ in results], [200, 409], results)
        self.assertTrue(BatchEnrollment.objects.filter(student=self.student, batch=self.batch).exists())
        self.assertFalse(BatchEnrollment.objects.filter(student=self.student, batch=target).exists())

    def test_closeout_and_retake_review_serialize_without_lock_order_conflicts(self):
        from uuid import uuid4
        assessment = Assessment.objects.create(title='Retake review', created_by=self.admin, batch=self.batch)
        now = timezone.now()
        attempt = StudentResponse.objects.create(student=self.student, assessment=assessment,
            status='submitted', started_at=now, submitted_at=now, retake_request_status='pending',
            retake_request_id=str(uuid4()))
        client = APIClient(); client.force_authenticate(self.admin)
        preview = client.get(reverse('batch_closeout', args=[self.batch.pk])).data
        barrier = Barrier(2)
        with ThreadPoolExecutor(max_workers=2) as pool:
            a = pool.submit(self.request, self.admin.pk, reverse('batch_closeout', args=[self.batch.pk]),
                {'review_token': preview['review_token']}, barrier)
            b = pool.submit(self.request, self.admin.pk, reverse('review_retake_request', args=[assessment.pk, self.student.pk]),
                {'response_id': attempt.pk, 'attempt_started_at': now.isoformat(), 'request_id': attempt.retake_request_id,
                 'decision': 'declined', 'note': 'Synthetic review outcome for this cycle.'}, barrier)
            results = [a.result(timeout=30), b.result(timeout=30)]
        self.assertEqual([code for code, _ in results], [409, 200], results)
        self.batch.refresh_from_db()
        self.assertEqual(self.batch.status, 'active')

    def test_two_batches_cannot_concurrently_enroll_the_same_current_student(self):
        student = User.objects.create_user(email='cycle-race-enroll@dnsc.edu.ph', name='Synthetic Race Student',
            school_id='2026-00002', course='BSIT', role='student', is_approved=True)
        other = Batch.objects.create(name='Other active cycle', instructor=self.admin)
        payloads = [self.enrollment_preview(student, batch) for batch in (self.batch, other)]
        barrier = Barrier(2)
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(self.request, self.admin.pk, reverse('instructor_batch_enroll', args=[batch.pk]),
                                   data, barrier) for batch, data in zip((self.batch, other), payloads)]
            results = [future.result(timeout=30) for future in futures]
        self.assertEqual(sum(data['summary']['enrolled'] for _, data in results), 1, results)
        self.assertEqual(BatchEnrollment.objects.filter(student=student, batch__status='active').count(), 1)

    def test_reactivation_and_new_enrollment_cannot_create_two_active_memberships(self):
        student = User.objects.create_user(email='cycle-race-reactivate@dnsc.edu.ph', name='Synthetic Race Student',
            school_id='2026-00003', course='BSIT', role='student', is_approved=True)
        old = Batch.objects.create(name='Archived cycle', instructor=self.admin, status='archived')
        BatchEnrollment.objects.create(student=student, batch=old)
        preview = self.enrollment_preview(student, self.batch)
        barrier = Barrier(2)
        with ThreadPoolExecutor(max_workers=2) as pool:
            a = pool.submit(self.request, self.admin.pk, reverse('instructor_batch_enroll', args=[self.batch.pk]), preview, barrier)
            b = pool.submit(self.request, self.admin.pk, reverse('instructor_batch_unarchive', args=[old.pk]), {}, barrier)
            results = [a.result(timeout=30), b.result(timeout=30)]
        self.assertEqual(BatchEnrollment.objects.filter(student=student, batch__status='active').count(), 1, results)
        self.assertTrue(BatchEnrollment.objects.filter(student=student, batch=old).exists())
