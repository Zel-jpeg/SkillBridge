from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class NeutralDepartmentMigrationTests(TransactionTestCase):
    def tearDown(self):
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())
        super().tearDown()

    def test_default_change_preserves_every_existing_field_and_structured_relationship(self):
        previous = [('api', '0034_program_batch_context')]
        target = [('api', '0035_neutral_user_department')]
        executor = MigrationExecutor(connection)
        executor.migrate(previous)
        old = executor.loader.project_state(previous).apps
        try:
            institute = old.get_model('api', 'Institute').objects.create(code='SYN', name='Synthetic Institute')
            program = old.get_model('api', 'Program').objects.create(institute_id=institute.id, code='ANY', name='Any Degree')
            owner = old.get_model('api', 'User').objects.create(email='neutral-owner@example.invalid', role='instructor', department='Retained label')
            student = old.get_model('api', 'User').objects.create(email='neutral-student@example.invalid', role='student',
                department='Institute of Computing', course='ANY', program_id=program.id)
            batch = old.get_model('api', 'Batch').objects.create(name='Normal cohort', instructor_id=owner.id,
                program_id=program.id, institute_id=institute.id)
            old.get_model('api', 'BatchEnrollment').objects.create(batch_id=batch.id, student_id=student.id)
            before = {m._meta.model_name: list(m.objects.order_by('pk').values()) for m in old.get_app_config('api').get_models()}
        finally:
            executor = MigrationExecutor(connection)
            executor.migrate(target)
        current = executor.loader.project_state(target).apps
        for name, rows in before.items():
            self.assertEqual(rows, list(current.get_model('api', name).objects.order_by('pk').values()), name)
        new = current.get_model('api', 'User').objects.create(email='neutral-new@example.invalid', role='instructor')
        self.assertEqual(new.department, '')
