from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class StudentAssessmentOrderMigrationTests(TransactionTestCase):
    def test_existing_membership_and_scores_survive_with_empty_order(self):
        old_target = [('api', '0029_recommendation_cycle_scope')]
        new_target = [('api', '0030_batchenrollment_assessment_order')]
        executor = MigrationExecutor(connection)
        latest = executor.loader.graph.leaf_nodes()
        executor.migrate(old_target)
        try:
            old = executor.loader.project_state(old_target).apps
            User = old.get_model('api', 'User')
            owner = User.objects.create(email='alias-migration-owner@example.invalid', role='instructor')
            student = User.objects.create(email='alias-migration-student@example.invalid', role='student')
            batch = old.get_model('api', 'Batch').objects.create(name='Synthetic migration batch', instructor=owner)
            membership = old.get_model('api', 'BatchEnrollment').objects.create(student=student, batch=batch)
            category = old.get_model('api', 'SkillCategory').objects.create(name='Programming')
            assessment = old.get_model('api', 'Assessment').objects.create(title='Preserved staff title', batch=batch, created_by=owner)
            score = old.get_model('api', 'SkillScore').objects.create(student=student, assessment=assessment,
                skill_category=category, raw_score=8, max_score=10, percentage=80)
            before_tables = set(connection.introspection.table_names())
            executor = MigrationExecutor(connection)
            executor.migrate(new_target)
            new = executor.loader.project_state(new_target).apps
            self.assertEqual(set(connection.introspection.table_names()), before_tables)
            saved = new.get_model('api', 'BatchEnrollment').objects.get(pk=membership.pk)
            self.assertEqual(saved.assessment_order, [])
            self.assertEqual(saved.student_id, student.pk)
            preserved = new.get_model('api', 'SkillScore').objects.get(pk=score.pk)
            self.assertEqual((preserved.raw_score, preserved.max_score, preserved.percentage), (8, 10, 80))
            self.assertEqual(new.get_model('api', 'Assessment').objects.get(pk=assessment.pk).title, 'Preserved staff title')
            self.assertFalse(new.get_model('api', 'StudentResponse').objects.exists())
        finally:
            MigrationExecutor(connection).migrate(latest)
