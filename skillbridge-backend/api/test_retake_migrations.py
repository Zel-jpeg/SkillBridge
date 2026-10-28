"""Retake migrations add recovery fields without rewriting historical evidence."""
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class RetakeMigrationTests(TransactionTestCase):
    def test_recovery_columns_preserve_existing_attempt_score_and_table_set(self):
        executor = MigrationExecutor(connection)
        latest = executor.loader.graph.leaf_nodes()
        old = [('api', '0024_attempt_timing_snapshots')]
        new = [('api', '0026_alter_studentresponse_retake_explanation')]
        try:
            executor.migrate(old)
            apps = executor.loader.project_state(old).apps
            owner = apps.get_model('api', 'User').objects.create(email='synthetic-migration-owner@example.invalid', role='instructor')
            student = apps.get_model('api', 'User').objects.create(email='synthetic-migration-student@example.invalid', role='student')
            assessment = apps.get_model('api', 'Assessment').objects.create(title='Preserved migration assessment', created_by=owner)
            response = apps.get_model('api', 'StudentResponse').objects.create(student=student, assessment=assessment, status='submitted')
            category = apps.get_model('api', 'SkillCategory').objects.create(name='Preserved category')
            score = apps.get_model('api', 'SkillScore').objects.create(student=student, assessment=assessment,
                skill_category=category, raw_score=2, max_score=3, percentage=66.67)
            history = apps.get_model('api', 'AssessmentAttemptHistory').objects.create(response=response, attempt_number=1,
                status='stopped', answers=[{'question_id': 123, 'text_answer': 'Synthetic retained answer'}],
                category_scores=[{'category_id': category.pk, 'raw_score': 1, 'max_score': 3}])
            tables = set(connection.introspection.table_names())
            executor = MigrationExecutor(connection)
            executor.migrate(new)
            migrated_apps = executor.loader.project_state(new).apps
            StudentResponse, SkillScore, AssessmentAttemptHistory = [
                migrated_apps.get_model('api', name)
                for name in ['StudentResponse', 'SkillScore', 'AssessmentAttemptHistory']]
            saved = StudentResponse.objects.get(pk=response.pk)
            self.assertEqual(saved.status, 'submitted')
            self.assertEqual((saved.draft_answers, saved.interruption_events, saved.retake_request_status), ([], [], ''))
            saved_score = SkillScore.objects.get(pk=score.pk)
            self.assertEqual((saved_score.raw_score, saved_score.max_score, saved_score.percentage), (2, 3, 66.67))
            saved_history = AssessmentAttemptHistory.objects.get(pk=history.pk)
            self.assertEqual(saved_history.answers, history.answers)
            self.assertEqual(saved_history.category_scores, history.category_scores)
            self.assertEqual(saved_history.retake_request, {})
            self.assertEqual(set(connection.introspection.table_names()), tables)
        finally:
            MigrationExecutor(connection).migrate(latest)

    def test_explanation_narrowing_rejects_long_values_without_truncation(self):
        executor = MigrationExecutor(connection)
        latest = executor.loader.graph.leaf_nodes()
        old = [('api', '0025_assessmentattempthistory_interruption_events_and_more')]
        new = [('api', '0026_alter_studentresponse_retake_explanation')]
        response = None
        try:
            executor.migrate(old)
            apps = executor.loader.project_state(old).apps
            User, Assessment, Response = [apps.get_model('api', name) for name in ['User', 'Assessment', 'StudentResponse']]
            owner = User.objects.create(email='synthetic-limit-owner@example.invalid', role='instructor')
            student = User.objects.create(email='synthetic-limit-student@example.invalid', role='student')
            assessment = Assessment.objects.create(title='Synthetic length guard', created_by=owner)
            response = Response.objects.create(student=student, assessment=assessment, retake_explanation='x'*501)
            with self.assertRaisesRegex(RuntimeError, 'nothing will be truncated'):
                MigrationExecutor(connection).migrate(new)
            self.assertEqual(Response.objects.get(pk=response.pk).retake_explanation, 'x'*501)
            Response.objects.filter(pk=response.pk).update(retake_explanation='x'*500)
            executor = MigrationExecutor(connection)
            executor.migrate(new)
            StudentResponse = executor.loader.project_state(new).apps.get_model('api', 'StudentResponse')
            self.assertEqual(StudentResponse.objects.get(pk=response.pk).retake_explanation, 'x'*500)
        finally:
            if response:
                # A failed assertion must still leave a migratable fixture.
                Response.objects.filter(pk=response.pk).update(retake_explanation='')
            MigrationExecutor(connection).migrate(latest)
