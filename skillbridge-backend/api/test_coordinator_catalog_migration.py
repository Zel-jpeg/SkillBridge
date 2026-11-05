from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class CoordinatorCatalogMigrationTests(TransactionTestCase):
    def tearDown(self):
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())
        super().tearDown()

    def test_upgrade_preserves_old_catalog_and_keeps_new_authority_unassigned(self):
        previous = [('api', '0038_position_program_eligibility')]
        target = [('api', '0039_coordinator_catalog_authority')]
        executor = MigrationExecutor(connection)
        executor.migrate(previous)
        old = executor.loader.project_state(previous).apps
        try:
            user = old.get_model('api', 'User').objects.create(email='catalog-upgrade@example.invalid', role='instructor')
            institute = old.get_model('api', 'Institute').objects.create(code='OLD', name='Existing institute')
            program = old.get_model('api', 'Program').objects.create(institute_id=institute.pk, code='OLD', name='Existing program')
            company = old.get_model('api', 'Company').objects.create(name='Existing partner', added_by_id=user.pk)
            position = old.get_model('api', 'Position').objects.create(company_id=company.pk, title='Existing position', slots_available=3)
            position.eligible_programs.add(program.pk)
            before = {model._meta.model_name: (
                list(model.objects.order_by('pk').values()), [field.attname for field in model._meta.concrete_fields])
                for model in old.get_app_config('api').get_models()}
            links = list(position.eligible_programs.through.objects.order_by('pk').values())
        finally:
            executor = MigrationExecutor(connection)
            executor.migrate(target)
        current = executor.loader.project_state(target).apps
        for name, (rows, fields) in before.items():
            self.assertEqual(rows, list(current.get_model('api', name).objects.order_by('pk').values(*fields)), name)
        self.assertFalse(current.get_model('api', 'Company').objects.exclude(management_program=None).exists())
        self.assertFalse(current.get_model('api', 'Position').objects.exclude(management_program=None).exists())
        self.assertFalse(current.get_model('api', 'Position').objects.exclude(created_by=None).exists())
        self.assertEqual(links, list(current.get_model('api', 'Position').eligible_programs.through.objects.order_by('pk').values()))
