"""Nested assessment creation retains keys, validation and atomic rollback."""
from unittest.mock import patch

from django.db import connection
from django.http import Http404
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from .authoring_scope import category_fields
from .competencies import current_framework, framework_payload
from .models import (AnswerChoice, Assessment, Batch, ChangeEvent, CompetencyFramework,
                     Institute, InstructorAssignment, ManagementAction, Program, Question,
                     SkillCategory, User)


class AssessmentCreateBatchingTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user('batch-author@example.invalid', role='instructor', is_approved=True)
        self.institute = Institute.objects.create(code='BATCH', name='Synthetic Authoring Institute')
        self.program = Program.objects.create(institute=self.institute, code='ANY', name='Arbitrary Program')
        InstructorAssignment.objects.create(program=self.program, instructor=self.owner)
        self.framework = CompetencyFramework.objects.create(program=self.program, version=1,
            name='Reviewed skills', created_by=self.owner)
        self.category = SkillCategory.objects.create(framework=self.framework, name='Records')
        self.batch = Batch.objects.create(instructor=self.owner, name='Synthetic cohort',
            program=self.program, institute=self.institute)
        self.client.force_authenticate(self.owner)

    def question(self, **changes):
        return {'question_text': 'Which record is current?', 'question_type': 'mcq', 'category_id': self.category.pk,
                'choices': [{'text': ' Current ', 'is_correct': True}, {'text': ' Old ', 'is_correct': False}], **changes}

    def payload(self, questions, **changes):
        framework = current_framework(self.owner, self.program, self.framework.pk)
        return {'title': 'Synthetic assessment', 'framework_id': self.framework.pk,
                'framework_digest': framework_payload(framework, self.owner)['digest'],
                'publication_status': 'draft', 'questions': questions, **changes}

    def create(self, payload):
        return self.client.post(reverse('instructor_assessments'), payload, format='json')

    def test_mixed_publication_keeps_ordered_choice_keys_and_recalculates_after_all_inserts(self):
        payload = self.payload([self.question(), self.question(question_type='truefalse',
            question_text='The record is archived.', choices=[{'text': 'True', 'is_correct': False}, {'text': 'False', 'is_correct': True}]),
            self.question(question_type='identification', question_text='How many entries?', choices=[], correct_answer=' 0 ')],
            batch_id=self.batch.pk, publication_status='published')
        def recalculate(batch):
            assessment = Assessment.objects.get(batch=batch)
            self.assertEqual(assessment.questions.count(), 3)
            self.assertEqual(AnswerChoice.objects.filter(question__assessment=assessment).count(), 5)
        with patch('api.views.recalculate_enrolled_students', side_effect=recalculate) as recalculation:
            result = self.create(payload)
        self.assertEqual(result.status_code, 201, result.data)
        self.assertEqual(result.data['question_count'], 3)
        recalculation.assert_called_once()
        questions = list(Question.objects.filter(assessment_id=result.data['id']).prefetch_related('choices'))
        self.assertEqual([row.question_order for row in questions], [1, 2, 3])
        self.assertEqual([row.skill_category_id for row in questions], [self.category.pk] * 3)
        self.assertEqual([[(choice.choice_text, choice.is_correct) for choice in row.choices.all()] for row in questions],
                         [[('Current', True), ('Old', False)], [('True', False), ('False', True)], [('0', True)]])
        self.assertEqual(ManagementAction.objects.get(action='assessment.create').metadata['question_count'], 3)

    def test_incomplete_draft_skips_blank_questions_and_preserves_order_gaps_and_unmapped_choices(self):
        result = self.create(self.payload([self.question(question_text=' '), self.question(category_id=None, choices=[]),
            self.question(question_text='  Another question  ', choices=[{'text': ' ', 'is_correct': False}]),
            self.question(question_type='identification', correct_answer='', choices=[])]))
        self.assertEqual(result.status_code, 201, result.data)
        self.assertEqual(result.data['question_count'], 3)
        questions = list(Question.objects.filter(assessment_id=result.data['id']).prefetch_related('choices'))
        self.assertEqual([row.question_order for row in questions], [2, 3, 4])
        self.assertIsNone(questions[0].skill_category_id)
        self.assertEqual(questions[0].choices.count(), 0)
        self.assertEqual([(choice.choice_text, choice.is_correct) for choice in questions[1].choices.all()], [('', False)])
        self.assertEqual(questions[2].choices.count(), 0)

    def test_late_bulk_failure_rolls_back_questions_choices_audit_and_batch_binding(self):
        payload = self.payload([self.question()], batch_id=self.batch.pk)
        for model in (Question, AnswerChoice):
            original = model.objects.bulk_create
            def fail_after_insert(rows, *args, **kwargs):
                original(rows, *args, **kwargs)
                raise RuntimeError('Synthetic late bulk failure')
            with self.subTest(model=model.__name__), patch.object(model.objects, 'bulk_create', side_effect=fail_after_insert):
                with self.captureOnCommitCallbacks(execute=True) as callbacks:
                    with self.assertRaises(RuntimeError):
                        self.create(payload)
                self.assertEqual(callbacks, [])
                for stored in (Assessment, Question, AnswerChoice, ManagementAction, ChangeEvent):
                    self.assertFalse(stored.objects.exists())
                self.batch.refresh_from_db()
                self.framework.refresh_from_db()
                self.assertIsNone(self.batch.framework_id)
                self.assertIsNone(self.framework.locked_at)

    def test_invalid_or_foreign_later_category_cannot_leave_partial_rows(self):
        other = CompetencyFramework.objects.create(program=self.program, name='Other set', version=2)
        foreign = SkillCategory.objects.create(framework=other, name='Records')
        for values in ({'category_id': foreign.pk}, {'category_id': self.category.pk, 'category': 'Wrong name'}, {'category_id': True}):
            with self.subTest(values=values):
                result = self.create(self.payload([self.question(), self.question(**values)], batch_id=self.batch.pk))
                self.assertIn(result.status_code, (400, 404))
                self.assertFalse(Assessment.objects.exists())
                self.assertFalse(Question.objects.exists())
        with self.assertRaises(Http404):
            category_fields({'category_id': foreign.pk}, self.framework, lambda value: value,
                            category_cache={foreign.pk: foreign})

    def test_legacy_case_insensitive_category_reuse_and_ambiguous_names_keep_their_rules(self):
        existing = SkillCategory.objects.create(name='Legacy records')
        questions = [self.question(category=' LEGACY RECORDS ', category_id=None),
                     self.question(category='Legacy records', category_id=None)]
        payload = {'title': 'Shared IC draft', 'publication_status': 'draft', 'questions': questions}
        result = self.create(payload)
        self.assertEqual(result.status_code, 201, result.data)
        self.assertEqual(list(Question.objects.filter(assessment_id=result.data['id']).values_list('skill_category_id', flat=True)), [existing.pk, existing.pk])
        SkillCategory.objects.create(name='LEGACY RECORDS')
        before = Assessment.objects.count()
        result = self.create(payload)
        self.assertEqual(result.status_code, 400)
        self.assertEqual(Assessment.objects.count(), before)

    def test_scoped_save_query_count_is_bounded_from_twenty_to_one_hundred_questions(self):
        self.framework.locked_at = timezone.now()
        self.framework.save(update_fields=['locked_at'])
        counts = []
        for count in (20, 100):
            payload = self.payload([self.question(question_text=f'Record {index}') for index in range(count)])
            with CaptureQueriesContext(connection) as queries:
                response = self.create(payload)
            self.assertEqual(response.status_code, 201, response.data)
            self.assertEqual(response.data['question_count'], count)
            self.assertEqual(Question.objects.filter(assessment_id=response.data['id']).count(), count)
            self.assertEqual(AnswerChoice.objects.filter(question__assessment_id=response.data['id']).count(), count * 2)
            counts.append(len(queries))
        self.assertLessEqual(counts[1], counts[0] + 2)

    def test_legacy_save_query_count_is_bounded_for_repeated_category_names(self):
        SkillCategory.objects.create(name='Legacy records')
        counts = []
        for count in (20, 100):
            payload = {'title': 'Shared IC draft', 'publication_status': 'draft',
                'questions': [self.question(category='Legacy records', category_id=None) for _ in range(count)]}
            with CaptureQueriesContext(connection) as queries:
                response = self.create(payload)
            self.assertEqual(response.status_code, 201, response.data)
            self.assertEqual(response.data['question_count'], count)
            self.assertEqual(Question.objects.filter(assessment_id=response.data['id']).count(), count)
            counts.append(len(queries))
        self.assertLessEqual(counts[1], counts[0] + 2)
