from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class ProgramBatchMigrationTests(TransactionTestCase):
    def tearDown(self):
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())
        super().tearDown()

    def test_upgrade_preserves_every_existing_field_and_adds_only_null_context(self):
        previous = [('api', '0033_instructor_program_assignment')]
        target = [('api', '0034_program_batch_context')]
        executor = MigrationExecutor(connection)
        executor.migrate(previous)
        old = executor.loader.project_state(previous).apps
        try:
            owner = old.get_model('api', 'User').objects.create(email='upgrade-owner@example.invalid', role='instructor')
            batch = old.get_model('api', 'Batch').objects.create(name='Unchanged mixed batch', instructor_id=owner.id)
            for number, code in enumerate(['BSIT', 'BSIS']):
                student = old.get_model('api', 'User').objects.create(email=f'upgrade-{number}@example.invalid', role='student', course=code)
                old.get_model('api', 'BatchEnrollment').objects.create(batch_id=batch.id, student_id=student.id)
            before = {m._meta.model_name: (list(m.objects.order_by('pk').values()), [f.attname for f in m._meta.concrete_fields])
                      for m in old.get_app_config('api').get_models()}
        finally:
            executor = MigrationExecutor(connection)
            executor.migrate(target)
        current = executor.loader.project_state(target).apps
        for name, (rows, fields) in before.items():
            self.assertEqual(rows, list(current.get_model('api', name).objects.order_by('pk').values(*fields)), name)
        self.assertFalse(current.get_model('api', 'User').objects.exclude(program_id=None).exists())
        self.assertFalse(current.get_model('api', 'Batch').objects.exclude(program_id=None, institute_id=None).exists())
