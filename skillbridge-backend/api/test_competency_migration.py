from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class CompetencyMigrationTests(TransactionTestCase):
    def tearDown(self):
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())
        super().tearDown()

    def test_upgrade_preserves_old_values_ids_scores_and_statuses_without_inferring_frameworks(self):
        previous = [('api', '0035_neutral_user_department')]
        target = [('api', '0036_program_competency_frameworks')]
        executor = MigrationExecutor(connection)
        executor.migrate(previous)
        old = executor.loader.project_state(previous).apps
        try:
            user = old.get_model('api', 'User')
            owner = user.objects.create(email='framework-upgrade-owner@example.invalid', role='instructor')
            student = user.objects.create(email='framework-upgrade-student@example.invalid', role='student', course='BSIT')
            category = old.get_model('api', 'SkillCategory').objects.create(name='Existing IC category',
                description='Retained definition', tags=['Existing vocabulary'], created_by_id=owner.id)
            batch = old.get_model('api', 'Batch').objects.create(name='Normal mixed IC batch', instructor_id=owner.id)
            old.get_model('api', 'BatchEnrollment').objects.create(batch_id=batch.id, student_id=student.id)
            assessment = old.get_model('api', 'Assessment').objects.create(title='Retained test', batch_id=batch.id, created_by_id=owner.id)
            old.get_model('api', 'Question').objects.create(assessment_id=assessment.id, skill_category_id=category.id, question_text='Retained question')
            old.get_model('api', 'SkillScore').objects.create(student_id=student.id, assessment_id=assessment.id,
                skill_category_id=category.id, raw_score=7, max_score=10, percentage=70)
            old.get_model('api', 'CombinedCategoryScore').objects.create(student_id=student.id, batch_id=batch.id,
                skill_category_id=category.id, raw_score=7, max_score=10, percentage=70, source_assessment_ids=[assessment.id])
            before = {m._meta.model_name: (list(m.objects.order_by('pk').values()), [f.attname for f in m._meta.concrete_fields])
                      for m in old.get_app_config('api').get_models()}
            tables = set(connection.introspection.table_names())
        finally:
            executor = MigrationExecutor(connection)
            executor.migrate(target)
        current = executor.loader.project_state(target).apps
        for name, (rows, columns) in before.items():
            self.assertEqual(rows, list(current.get_model('api', name).objects.order_by('pk').values(*columns)), name)
        self.assertEqual(set(connection.introspection.table_names()) - tables, {'api_competencyframework'})
        self.assertFalse(current.get_model('api', 'CompetencyFramework').objects.exists())
        self.assertFalse(current.get_model('api', 'Batch').objects.exclude(framework_id=None).exists())
        self.assertFalse(current.get_model('api', 'SkillCategory').objects.exclude(framework_id=None, source_category_id=None).exists())
