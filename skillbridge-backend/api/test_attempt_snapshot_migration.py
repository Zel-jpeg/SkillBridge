"""Legacy active attempts retain the server limits in force at migration."""
from datetime import datetime, timedelta, timezone
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class AttemptSnapshotMigrationTests(TransactionTestCase):
    def test_only_active_attempts_receive_current_policy_snapshots(self):
        old_target = [('api', '0023_assessment_archives')]
        new_target = [('api', '0024_attempt_timing_snapshots')]
        executor = MigrationExecutor(connection)
        latest_targets = executor.loader.graph.leaf_nodes()
        executor.migrate(old_target)
        try:
            old = executor.loader.project_state(old_target).apps
            User = old.get_model('api', 'User')
            Assessment = old.get_model('api', 'Assessment')
            Response = old.get_model('api', 'StudentResponse')
            owner = User.objects.create(email='migration-owner@example.invalid', role='instructor')
            student = User.objects.create(email='migration-active@example.invalid', role='student')
            finished_student = User.objects.create(email='migration-finished@example.invalid', role='student')
            started = datetime(2026, 11, 1, 3, 30, tzinfo=timezone.utc)
            assessment = Assessment.objects.create(title='Legacy migration fixture', created_by=owner,
                                                   duration_minutes=60, due_at=started + timedelta(minutes=30))
            active = Response.objects.create(student=student, assessment=assessment, started_at=started)
            finished = Response.objects.create(student=finished_student, assessment=assessment, started_at=started,
                                               status='submitted', submitted_at=started + timedelta(minutes=10))
            executor = MigrationExecutor(connection)
            executor.migrate(new_target)
            new = executor.loader.project_state(new_target).apps
            NewResponse = new.get_model('api', 'StudentResponse')
            active = NewResponse.objects.get(pk=active.pk)
            finished = NewResponse.objects.get(pk=finished.pk)
            self.assertEqual(active.duration_seconds, 3600)
            self.assertEqual(active.expires_at, started + timedelta(minutes=30))
            self.assertEqual(active.extra_time_seconds, 0)
            self.assertIsNone(finished.duration_seconds)
            self.assertIsNone(finished.expires_at)
            self.assertEqual(finished.submitted_at, started + timedelta(minutes=10))
        finally:
            MigrationExecutor(connection).migrate(latest_targets)
