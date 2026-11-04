from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class AssignmentMigrationTests(TransactionTestCase):
    def tearDown(self):
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())
        super().tearDown()

    def test_upgrade_preserves_existing_catalog_and_cohort_without_auto_assigning(self):
        old_target = [('api', '0032_institute_program_catalog')]
        target = [('api', '0033_instructor_program_assignment')]
        executor = MigrationExecutor(connection)
        executor.migrate(old_target)
        old = executor.loader.project_state(old_target).apps
        try:
            institute = old.get_model('api', 'Institute').objects.create(code='SYN', name='Synthetic Institute')
            old.get_model('api', 'Program').objects.create(institute_id=institute.pk, code='ANY', name='Any Program', aliases=['Any degree'])
            owner = old.get_model('api', 'User').objects.create(email='old-assignment-owner@example.invalid', role='instructor', is_approved=True)
            old.get_model('api', 'Batch').objects.create(name='Existing mixed IC batch', instructor_id=owner.pk)
            before = {m._meta.model_name: list(m.objects.order_by('pk').values()) for m in old.get_app_config('api').get_models()}
        finally:
            executor = MigrationExecutor(connection)
            executor.migrate(target)
        current = executor.loader.project_state(target).apps
        for name, rows in before.items():
            self.assertEqual(rows, list(current.get_model('api', name).objects.order_by('pk').values()), name)
        self.assertEqual(current.get_model('api', 'InstructorAssignment').objects.count(), 0)
