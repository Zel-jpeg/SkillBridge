import itertools
import random
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest import skipUnless
from django.db import connection, IntegrityError, transaction
from django.test import TransactionTestCase
from . import test_concurrent_workflows as concurrent_fixtures

from django.test import SimpleTestCase
from django.urls import reverse
from rest_framework.test import APITestCase

from . import tests as placement_fixtures
from .models import User, Position, Recommendation, OJTPlacement, ManagementAction, ChangeEvent
from .placement_drafts import active_suggestions, STATE_ACTION
from .placement_allocator import allocate


class AllocatorTests(SimpleTestCase):
    def test_other_students_alternatives_and_no_minimum_cutoff(self):
        edges = [{'id': 1, 'student_id': 1, 'position_id': 1, 'match_score': 95},
                 {'id': 2, 'student_id': 1, 'position_id': 2, 'match_score': 94},
                 {'id': 3, 'student_id': 2, 'position_id': 1, 'match_score': 94},
                 {'id': 4, 'student_id': 2, 'position_id': 2, 'match_score': 40},
                 {'id': 5, 'student_id': 3, 'position_id': 3, 'match_score': 0}]
        self.assertEqual(allocate(edges, {1: 1, 2: 1, 3: 1}), {1: 2, 2: 3, 3: 5})
        self.assertEqual(allocate(list(reversed(edges)), {3: 1, 2: 1, 1: 1}), {1: 2, 2: 3, 3: 5})

    def test_random_small_graphs_match_exhaustive_cardinality_and_score(self):
        rng = random.Random(7)
        for _ in range(45):
            edges = [{'id': sid * 10 + pid, 'student_id': sid, 'position_id': pid, 'match_score': rng.randint(0, 100)}
                     for sid in (1, 2, 3) for pid in (1, 2, 3) if rng.random() > .25]
            capacities = {pid: rng.randint(0, 2) for pid in (1, 2, 3)}
            choices = [[None] + [row for row in edges if row['student_id'] == sid] for sid in (1, 2, 3)]
            feasible = []
            for combination in itertools.product(*choices):
                rows = [row for row in combination if row]
                if all(sum(row['position_id'] == pid for row in rows) <= capacity for pid, capacity in capacities.items()):
                    feasible.append((len(rows), sum(row['match_score'] for row in rows)))
            selected = set(allocate(edges, capacities).values())
            rows = [row for row in edges if row['id'] in selected]
            self.assertEqual((len(rows), sum(row['match_score'] for row in rows)), max(feasible))


class DraftAPITests(APITestCase):
    def setUp(self):
        placement_fixtures.OJTPlacementAPITests.setUp(self)
        User.objects.filter(role='student').update(is_approved=True)
        self.client.force_authenticate(self.admin)

    def preview(self):
        response = self.client.post(reverse('placement_draft'), {'action': 'preview'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def generate(self):
        preview = self.preview()
        response = self.client.post(reverse('placement_draft'), {'action': 'apply', 'preview_token': preview['preview_token']}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def test_preview_no_proposals_and_apply_shared_capacity_without_approval(self):
        ChangeEvent.objects.all().delete()
        with self.captureOnCommitCallbacks(execute=True):
            preview = self.preview()
        self.assertEqual(ChangeEvent.objects.count(), 0)
        self.assertEqual(active_suggestions().count(), 0)
        data = self.generate()
        selected = {row.student_id: row.recommendation_id for row in active_suggestions().all()}
        self.assertEqual(selected, {self.student_one.id: self.other_recommendation.id, self.student_two.id: self.recommendation_two.id})
        self.assertEqual(OJTPlacement.objects.filter(status='approved').count(), 0)
        self.assertFalse(data['stale'])
        self.assertEqual(data['proposed_counts'][self.position.id], 1)
        self.assertEqual(ManagementAction.objects.filter(action=STATE_ACTION).count(), 1)
        self.assertTrue(preview['can_generate'])

    def test_automatic_sync_is_idempotent_read_only_get_and_no_automatic_approval(self):
        self.assertEqual(self.client.get(reverse('placement_draft')).status_code, 200)
        self.assertFalse(active_suggestions().exists())
        self.client.force_authenticate(self.instructor)
        with self.captureOnCommitCallbacks(execute=True):
            first = self.client.post(reverse('placement_draft'), {'action': 'sync'}, format='json')
        self.assertEqual(first.status_code, 200, first.data)
        self.assertTrue(first.data['changed'])
        self.assertEqual({row['student']['id'] for row in first.data['students']}, {self.student_one.id, self.student_two.id})
        self.assertEqual(active_suggestions().count(), 2)
        self.assertFalse(OJTPlacement.objects.filter(status='approved').exists())
        ids = list(active_suggestions().values_list('id', flat=True))
        events = ChangeEvent.objects.count()
        with self.captureOnCommitCallbacks(execute=True):
            repeat = self.client.post(reverse('placement_draft'), {'action': 'sync'}, format='json')
        self.assertFalse(repeat.data['changed'])
        self.assertEqual(repeat.data['revision'], first.data['revision'])
        self.assertEqual(ChangeEvent.objects.count(), events)
        self.assertEqual(list(active_suggestions().values_list('id', flat=True)), ids)
        self.client.force_authenticate(self.student_one)
        self.assertEqual(self.client.post(reverse('placement_draft'), {'action': 'sync'}, format='json').status_code, 403)

    def test_sync_updates_changed_capacity_preserves_choices_and_never_reassigns_approved(self):
        data = self.generate()
        response = self.client.post(reverse('placement_draft'), {'action': 'choose', 'revision': data['revision'],
            'student_id': self.student_one.id, 'recommendation_id': self.other_recommendation.id}, format='json')
        self.assertEqual(response.status_code, 200)
        self.client.post(reverse('placement_approve'), {'recommendation_id': self.recommendation_two.id}, format='json')
        approved_id = OJTPlacement.objects.get(status='approved').id
        Position.objects.filter(pk=self.other_position.id).update(slots_available=4)
        response = self.client.post(reverse('placement_draft'), {'action': 'sync'}, format='json')
        self.assertTrue(response.data['changed'])
        self.assertFalse(response.data['stale'])
        self.assertEqual(active_suggestions().get(student=self.student_one).recommendation_id, self.other_recommendation.id)
        self.assertEqual(OJTPlacement.objects.get(status='approved').id, approved_id)
        self.assertNotIn(str(self.student_two.id), ManagementAction.objects.filter(action=STATE_ACTION).first().metadata['manual_choices'])

    def test_sync_preserves_existing_choices_from_previous_audit_format(self):
        Position.objects.filter(pk=self.position.id).update(slots_available=2)
        data = self.generate()
        result = self.client.post(reverse('placement_draft'), {'action': 'choose', 'revision': data['revision'],
            'student_id': self.student_one.id, 'recommendation_id': self.other_recommendation.id}, format='json')
        self.assertEqual(result.status_code, 200)
        entry = ManagementAction.objects.filter(action=STATE_ACTION).first()
        entry.metadata.pop('manual_choices')
        entry.save(update_fields=['metadata'])
        result = self.client.post(reverse('placement_draft'), {'action': 'sync'}, format='json')
        self.assertTrue(result.data['changed'])
        self.assertEqual(active_suggestions().get(student=self.student_one).recommendation_id, self.other_recommendation.id)
        self.assertFalse(self.client.post(reverse('placement_draft'), {'action': 'sync'}, format='json').data['changed'])

    def test_preview_token_rejects_input_changes_or_replay(self):
        preview = self.preview()
        Position.objects.filter(pk=self.position.pk).update(slots_available=4)
        response = self.client.post(reverse('placement_draft'), {'action': 'apply', 'preview_token': preview['preview_token']}, format='json')
        self.assertEqual(response.status_code, 409)
        preview = self.preview()
        self.client.post(reverse('placement_draft'), {'action': 'apply', 'preview_token': preview['preview_token']}, format='json')
        replay = self.client.post(reverse('placement_draft'), {'action': 'apply', 'preview_token': preview['preview_token']}, format='json')
        self.assertEqual(replay.status_code, 409)

    def test_instructor_sees_only_own_students_and_cannot_regenerate_global_draft(self):
        self.generate()
        self.client.force_authenticate(self.other_instructor)
        response = self.client.get(reverse('placement_draft'))
        self.assertEqual({row['student']['id'] for row in response.data['students']}, {self.student_three.id})
        self.assertEqual(self.client.post(reverse('placement_draft'), {'action': 'preview'}, format='json').status_code, 403)
        self.assertEqual(self.client.post(reverse('placement_draft'), {'action': 'choose', 'student_id': self.student_one.id, 'revision': 1}, format='json').status_code, 403)
        self.client.force_authenticate(self.student_one)
        self.assertEqual(self.client.get(reverse('placement_draft')).status_code, 403)

    def test_proposed_seat_cannot_be_taken_by_another_student_string_or_integer_id(self):
        self.generate()
        response = self.client.post(reverse('placement_approve'), {'recommendation_id': str(self.recommendation_one.id)}, format='json')
        self.assertEqual(response.status_code, 409)
        response = self.client.post(reverse('placement_approve'), {'recommendation_id': self.recommendation_two.id}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(active_suggestions().filter(student=self.student_two).exists())
        self.assertEqual(OJTPlacement.objects.filter(status='approved').count(), 1)
        data = self.client.get(reverse('placement_draft')).data
        self.assertFalse(data['stale'])
        self.generate()
        self.assertEqual(OJTPlacement.objects.filter(student=self.student_two, status='approved').count(), 1)

    def test_coordinator_choice_survives_refresh_and_invalid_choice_requires_review(self):
        self.position.slots_available = 2
        self.position.save()
        data = self.generate()
        response = self.client.post(reverse('placement_draft'), {'action': 'choose', 'revision': data['revision'],
            'student_id': self.student_one.id, 'recommendation_id': self.other_recommendation.id}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(active_suggestions().get(student=self.student_one).recommendation_id, self.other_recommendation.id)
        self.generate()
        self.assertEqual(active_suggestions().get(student=self.student_one).recommendation_id, self.other_recommendation.id)
        self.other_position.slots_available = 0
        self.other_position.save()
        self.assertTrue(self.client.get(reverse('placement_draft')).data['stale'])
        result = self.generate()
        one = next(row for row in result['students'] if row['student']['id'] == self.student_one.id)
        self.assertEqual(one['status'], 'coordinator_review')
        self.assertIsNone(one['proposal'])

    def test_low_zero_score_and_full_roles_are_distinct_from_locked_evidence(self):
        self.recommendation_two.match_score = 0
        self.recommendation_two.save()
        data = self.generate()
        two = next(row for row in data['students'] if row['student']['id'] == self.student_two.id)
        self.assertTrue(two['needs_review'])
        self.position.slots_available = 0
        self.other_position.slots_available = 0
        self.position.save()
        self.other_position.save()
        data = self.generate()
        self.assertEqual(next(row for row in data['students'] if row['student']['id'] == self.student_two.id)['status'], 'awaiting_capacity')

    def test_declining_an_alternative_preserves_other_suggestion_and_marks_update(self):
        data = self.generate()
        response = self.client.post(reverse('placement_draft'), {'action': 'choose', 'revision': data['revision'],
            'student_id': self.student_one.id, 'recommendation_id': self.other_recommendation.id}, format='json')
        self.assertEqual(response.status_code, 200)
        response = self.client.post(reverse('placement_reject'), {'recommendation_id': self.recommendation_one.id,
            'remarks': 'Prefer the other role after review'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(active_suggestions().get(student=self.student_one).recommendation_id, self.other_recommendation.id)
        self.assertTrue(self.client.get(reverse('placement_draft')).data['stale'])
        self.generate()
        self.assertEqual(active_suggestions().get(student=self.student_one).recommendation_id, self.other_recommendation.id)

    def test_declined_options_are_distinct_and_releasing_an_approval_needs_update(self):
        self.generate()
        response = self.client.post(reverse('placement_approve'), {'recommendation_id': self.recommendation_two.id}, format='json')
        self.assertEqual(response.status_code, 200)
        response = self.client.post(reverse('placement_remove'), {'placement_id': response.data['placement']['id'], 'remarks': 'Synthetic release'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(self.client.get(reverse('placement_draft')).data['stale'])
        self.assertEqual(self.client.post(reverse('placement_approve'), {'recommendation_id': self.other_recommendation.id}, format='json').status_code, 409)
        for rec in (self.recommendation_one, self.other_recommendation):
            self.assertEqual(self.client.post(reverse('placement_reject'), {'recommendation_id': rec.id, 'remarks': 'Synthetic review'}, format='json').status_code, 200)
        one = next(row for row in self.client.get(reverse('placement_draft')).data['students'] if row['student']['id'] == self.student_one.id)
        self.assertEqual(one['status'], 'suggestions_declined')

    def test_archived_batch_suggestions_are_released_without_altering_legacy_history(self):
        legacy = OJTPlacement.objects.create(student=self.student_one, batch=self.batch,
            company=self.company, position=self.position, status='suggested', remarks='Legacy history')
        self.generate()
        self.batch.status = 'archived'
        self.batch.save()
        data = self.generate()
        self.assertFalse(active_suggestions().exists())
        legacy.refresh_from_db()
        self.assertEqual((legacy.status, legacy.remarks, legacy.is_active_suggestion), ('suggested', 'Legacy history', False))
        self.assertNotIn(self.student_one.id, [row['student']['id'] for row in data['students']])

    def test_invalid_tokens_and_boolean_identifiers_are_rejected_without_writes(self):
        for token in (None, {}, [], True):
            self.assertEqual(self.client.post(reverse('placement_draft'), {'action': 'apply', 'preview_token': token}, format='json').status_code, 409)
        data = self.generate()
        self.assertEqual(self.client.post(reverse('placement_draft'), {'action': 'choose', 'revision': True,
            'student_id': self.student_one.id, 'recommendation_id': self.other_recommendation.id}, format='json').status_code, 409)
        self.assertEqual(self.client.post(reverse('placement_draft'), {'action': 'choose', 'revision': data['revision'],
            'student_id': self.student_one.id, 'recommendation_id': True}, format='json').status_code, 409)

    def test_approved_roster_is_complete_beyond_first_500_history_records(self):
        approved = OJTPlacement.objects.create(student=self.student_one, batch=self.batch, company=self.company,
            position=self.position, status='approved')
        OJTPlacement.objects.bulk_create([OJTPlacement(student=self.student_two, batch=self.batch,
            company=self.company, position=self.position, status='rejected', remarks=f'Synthetic history {i}') for i in range(505)])
        history = self.client.get(reverse('placement_history'), {'limit': 10, 'offset': 500}).data
        self.assertEqual(history['count'], 506)
        self.assertEqual(len(history['placements']), 6)
        response = self.client.get(reverse('placement_suggestions')).data
        self.assertEqual([row['id'] for row in response['approved_placements']], [approved.id])
        self.assertEqual(self.client.get(reverse('placement_history'), {'q': 'Synthetic history 504'}).data['count'], 1)

    def test_pending_suggestions_do_not_change_reports_student_status_or_rankings(self):
        from .views import _visible_placements_by_student
        before = list(Recommendation.objects.order_by('id').values())
        report_before = self.client.get(reverse('placement_reports')).data
        self.generate()
        self.assertEqual(list(Recommendation.objects.order_by('id').values()), before)
        self.assertIsNone(_visible_placements_by_student([self.student_one.id])[self.student_one.id])
        self.assertEqual(self.client.get(reverse('placement_history')).data['count'], 0)
        report_after = self.client.get(reverse('placement_reports')).data
        self.assertEqual(report_after['summary'], report_before['summary'])
        self.assertEqual(report_after['records'], report_before['records'])
        self.assertTrue(all(row.status == 'suggested' and not row.approved_at for row in active_suggestions()))
        self.assertEqual(self.client.get(reverse('placement_analytics')).data['summary']['approved_placements'], 0)

    def test_active_constraints_and_normal_approval_conversion(self):
        self.generate()
        suggestion = active_suggestions().get(student=self.student_two)
        with self.assertRaises(IntegrityError), transaction.atomic():
            OJTPlacement.objects.create(student=self.student_two, company=self.company, position=self.position,
                status='suggested', is_active_suggestion=True)
        with self.assertRaises(IntegrityError), transaction.atomic():
            OJTPlacement.objects.filter(pk=suggestion.pk).update(status='approved')
        response = self.client.post(reverse('placement_approve'), {'recommendation_id': self.recommendation_two.id}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['placement']['id'], suggestion.id)
        suggestion.refresh_from_db()
        self.assertFalse(suggestion.is_active_suggestion)
        self.assertEqual(suggestion.status, 'approved')
        self.assertEqual(self.client.get(reverse('placement_history')).data['count'], 1)

    def test_catalog_deletion_releases_only_pending_suggestions(self):
        self.generate()
        response = self.client.delete(reverse('admin_position_detail', args=[self.position.id]))
        self.assertEqual(response.status_code, 204, response.data)
        self.assertFalse(active_suggestions().filter(position_id=self.position.id).exists())
        self.assertTrue(self.client.get(reverse('placement_draft')).data['stale'])
        response = self.client.delete(reverse('admin_company_detail', args=[self.other_company.id]))
        self.assertEqual(response.status_code, 204, response.data)
        self.assertFalse(active_suggestions().exists())

    def test_failed_catalog_delete_rolls_back_pending_cleanup_and_preserves_history(self):
        self.generate()
        decision = OJTPlacement.objects.create(student=self.student_three, company=self.company,
            position=self.position, status='rejected', remarks='Keep decision history')
        response = self.client.delete(reverse('admin_company_detail', args=[self.company.id]))
        self.assertEqual(response.status_code, 409)
        self.assertTrue(OJTPlacement.objects.filter(pk=decision.id).exists())
        self.assertTrue(active_suggestions().filter(position=self.position).exists())


class MigrationPreservationTests(TransactionTestCase):
    def test_existing_records_keep_their_status_scores_and_table_set(self):
        from django.db.migrations.executor import MigrationExecutor
        old = [('api', '0021_batch_created_by_managementaction')]
        new = [('api', '0022_placement_active_suggestion')]
        executor = MigrationExecutor(connection)
        latest_targets = executor.loader.graph.leaf_nodes()
        executor.migrate(old)
        try:
            apps = executor.loader.project_state(old).apps
            student = apps.get_model('api', 'User').objects.create(email='migration@example.invalid', role='student')
            company = apps.get_model('api', 'Company').objects.create(name='Synthetic migration company')
            position = apps.get_model('api', 'Position').objects.create(company_id=company.pk, title='Synthetic role')
            placement = apps.get_model('api', 'OJTPlacement')
            ids = [placement.objects.create(student_id=student.pk, company_id=company.pk, position_id=position.pk,
                status=status, remarks='Preserve legacy decision', match_score_at_assignment=72.345).pk
                for status in ('suggested', 'approved', 'removed', 'rejected')]
            tables_before = set(connection.introspection.table_names())
            executor = MigrationExecutor(connection)
            executor.migrate(new)
            self.assertEqual(set(connection.introspection.table_names()), tables_before)
            rows = list(OJTPlacement.objects.filter(pk__in=ids).order_by('id'))
            self.assertEqual([row.status for row in rows], ['suggested', 'approved', 'removed', 'rejected'])
            self.assertTrue(all(not row.is_active_suggestion and row.match_score_at_assignment == 72.345
                                and row.remarks == 'Preserve legacy decision' for row in rows))
        finally:
            MigrationExecutor(connection).migrate(latest_targets)


# These are real independent connections, deliberately skipped by SQLite.


@skipUnless(connection.vendor == 'postgresql', 'Requires disposable PostgreSQL row locking')
class ConcurrentDraftTests(TransactionTestCase):
    def new_assessment(self):
        return concurrent_fixtures.ConcurrentWorkflowTests.new_assessment(self)

    def setUp(self):
        concurrent_fixtures.ConcurrentWorkflowTests.setUp(self)

    def request(self, *args, **kwargs):
        return concurrent_fixtures.ConcurrentWorkflowTests.request(self, *args, **kwargs)

    def preview(self):
        status, payload = self.request(self.admin.pk, 'post', reverse('placement_draft'), {'action': 'preview'})
        self.assertEqual(status, 200, payload)
        return payload

    def test_same_preview_can_only_be_applied_once(self):
        preview = self.preview()
        barrier = Barrier(2)
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(self.request, self.admin.pk, 'post', reverse('placement_draft'),
                {'action': 'apply', 'preview_token': preview['preview_token']}, barrier=barrier) for _ in range(2)]
            outcomes = [future.result(timeout=30) for future in futures]
        self.assertEqual(sorted(row[0] for row in outcomes), [200, 409])
        self.assertEqual(active_suggestions().count(), 1)
        self.assertEqual(ManagementAction.objects.filter(action=STATE_ACTION).count(), 1)

    def test_simultaneous_draft_choices_do_not_double_reserve_last_seat(self):
        preview = self.preview()
        status, data = self.request(self.admin.pk, 'post', reverse('placement_draft'),
            {'action': 'apply', 'preview_token': preview['preview_token']})
        self.assertEqual(status, 200)
        barrier = Barrier(2)
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(self.request, self.admin.pk, 'post', reverse('placement_draft'),
                {'action': 'choose', 'revision': data['revision'], 'student_id': rec.student_id,
                 'recommendation_id': rec.id}, barrier=barrier) for rec in self.recs]
            outcomes = [future.result(timeout=30) for future in futures]
        self.assertEqual(sorted(row[0] for row in outcomes), [200, 409])
        self.assertEqual(active_suggestions().count(), 1)

    def test_apply_and_approval_share_one_capacity_lock(self):
        preview = self.preview()
        barrier = Barrier(2)
        with ThreadPoolExecutor(max_workers=2) as pool:
            apply = pool.submit(self.request, self.admin.pk, 'post', reverse('placement_draft'),
                {'action': 'apply', 'preview_token': preview['preview_token']}, barrier=barrier)
            approve = pool.submit(self.request, self.admin.pk, 'post', reverse('placement_approve'),
                {'recommendation_id': self.recs[0].pk}, barrier=barrier)
            outcomes = (apply.result(timeout=30), approve.result(timeout=30))
        self.assertIn((outcomes[0][0], outcomes[1][0]), [(200, 409), (409, 201)])
        self.assertEqual(active_suggestions().count() + OJTPlacement.objects.filter(status='approved').count(), 1)

    def test_simultaneous_automatic_updates_write_one_revision(self):
        barrier = Barrier(2)
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(self.request, self.owner.pk, 'post', reverse('placement_draft'),
                {'action': 'sync'}, barrier=barrier) for _ in range(2)]
            outcomes = [future.result(timeout=30) for future in futures]
        self.assertEqual([row[0] for row in outcomes], [200, 200])
        self.assertEqual(sorted(row[1]['changed'] for row in outcomes), [False, True])
        self.assertEqual(ManagementAction.objects.filter(action=STATE_ACTION).count(), 1)
        self.assertEqual(active_suggestions().count(), 1)
        self.assertFalse(OJTPlacement.objects.filter(status='approved').exists())

    def test_catalog_delete_and_apply_cannot_leave_an_orphan_reservation(self):
        preview = self.preview()
        barrier = Barrier(2)
        with ThreadPoolExecutor(max_workers=2) as pool:
            apply = pool.submit(self.request, self.admin.pk, 'post', reverse('placement_draft'),
                {'action': 'apply', 'preview_token': preview['preview_token']}, barrier=barrier)
            delete = pool.submit(self.request, self.admin.pk, 'delete',
                reverse('admin_position_detail', args=[self.position.pk]), {}, barrier=barrier)
            outcomes = (apply.result(timeout=30), delete.result(timeout=30))
        self.assertIn(outcomes[0][0], [200, 409])
        self.assertEqual(outcomes[1][0], 204)
        self.assertFalse(Position.objects.filter(pk=self.position.pk).exists())
        self.assertFalse(active_suggestions().exists())
