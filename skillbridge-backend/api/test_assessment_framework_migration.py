from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class AssessmentFrameworkMigrationTests(TransactionTestCase):
    def tearDown(self):
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())
        super().tearDown()

    def test_adds_only_null_link_and_preserves_all_existing_model_values(self):
        previous = [('api', '0036_program_competency_frameworks')]
        target = [('api', '0037_assessment_framework')]
        executor = MigrationExecutor(connection)
        executor.migrate(previous)
        old = executor.loader.project_state(previous).apps
        try:
            owner = old.get_model('api', 'User').objects.create(email='upgrade@example.invalid', role='instructor')
            batch = old.get_model('api', 'Batch').objects.create(name='Unchanged mixed IC', instructor_id=owner.pk)
            assessment = old.get_model('api', 'Assessment').objects.create(title='Unchanged assessment', batch_id=batch.pk, created_by_id=owner.pk)
            category = old.get_model('api', 'SkillCategory').objects.create(name='Original IC category', tags=['Saved'])
            question = old.get_model('api', 'Question').objects.create(assessment_id=assessment.pk, question_text='Unchanged?', skill_category_id=category.pk)
            old.get_model('api', 'AnswerChoice').objects.create(question_id=question.pk, choice_text='Original key', is_correct=True)
            old.get_model('api', 'SkillScore').objects.create(student_id=owner.pk, assessment_id=assessment.pk,
                skill_category_id=category.pk, raw_score=3, max_score=4, percentage=75)
            before = {model._meta.model_name: (list(model.objects.order_by('pk').values()), [field.attname for field in model._meta.concrete_fields])
                      for model in old.get_app_config('api').get_models()}
        finally:
            executor = MigrationExecutor(connection)
            executor.migrate(target)
        current = executor.loader.project_state(target).apps
        for name, (rows, fields) in before.items():
            self.assertEqual(rows, list(current.get_model('api', name).objects.order_by('pk').values(*fields)), name)
        self.assertFalse(current.get_model('api', 'Assessment').objects.exclude(framework_id=None).exists())
