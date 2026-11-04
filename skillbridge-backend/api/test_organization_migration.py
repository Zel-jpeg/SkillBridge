"""Exercise the actual additive upgrade with synthetic pre-existing evidence."""
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class OrganizationMigrationTests(TransactionTestCase):
    migrate_from = [('api', '0031_recommendation_assessment_order')]
    migrate_to = [('api', '0032_institute_program_catalog')]

    def tearDown(self):
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())
        super().tearDown()

    def test_upgrade_adds_only_empty_catalog_without_changing_existing_rows(self):
        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_from)
        old = executor.loader.project_state(self.migrate_from).apps
        try:
            user = old.get_model('api', 'User')
            owner = user.objects.create(email='migration-staff@example.invalid', role='instructor', name='Synthetic Staff')
            student = user.objects.create(email='migration-student@example.invalid', role='student', course='BSIT', name='Synthetic Student')
            batch = old.get_model('api', 'Batch').objects.create(name='Existing mixed cohort', instructor_id=owner.pk)
            old.get_model('api', 'BatchEnrollment').objects.create(batch_id=batch.pk, student_id=student.pk)
            category = old.get_model('api', 'SkillCategory').objects.create(name='Existing competency')
            assessment = old.get_model('api', 'Assessment').objects.create(title='Existing assessment', created_by_id=owner.pk, batch_id=batch.pk)
            old.get_model('api', 'SkillScore').objects.create(student_id=student.pk, assessment_id=assessment.pk,
                skill_category_id=category.pk, raw_score=3, max_score=5, percentage=60)
            before = {m._meta.model_name: list(m.objects.order_by('pk').values()) for m in old.get_app_config('api').get_models()}
        finally:
            executor = MigrationExecutor(connection)
            executor.migrate(self.migrate_to)
        current = executor.loader.project_state(self.migrate_to).apps
        for name, rows in before.items():
            with self.subTest(model=name):
                self.assertEqual(rows, list(current.get_model('api', name).objects.order_by('pk').values()))
        self.assertEqual(current.get_model('api', 'Institute').objects.count(), 0)
        self.assertEqual(current.get_model('api', 'Program').objects.count(), 0)
