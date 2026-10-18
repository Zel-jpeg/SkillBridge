"""Authoring must validate whole payloads and roll back failed nested writes."""
from copy import deepcopy
from unittest.mock import patch
from django.urls import reverse
from rest_framework.test import APITestCase
from .models import AnswerChoice, Assessment, Batch, Question, SkillCategory, User, StudentResponse


class AuthoringRecoveryTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email='author-recovery@example.com', role='instructor')
        self.batch = Batch.objects.create(name='Synthetic authoring', instructor=self.owner)
        self.category = SkillCategory.objects.create(name='Programming', created_by=self.owner)
        self.assessment = Assessment.objects.create(title='Draft fixture', batch=self.batch, created_by=self.owner, publication_status='draft')
        self.question = Question.objects.create(assessment=self.assessment, question_text='Original', skill_category=self.category)
        self.choice = AnswerChoice.objects.create(question=self.question, choice_text='Original key', is_correct=True)
        self.client.force_authenticate(self.owner)
        self.valid = {'question_text': 'Synthetic question', 'category': 'Programming', 'question_type': 'mcq',
                      'choices': [{'text': 'Yes', 'is_correct': True}, {'text': 'No', 'is_correct': False}]}

    def test_invalid_later_question_creates_nothing_on_create_or_append(self):
        for endpoint, envelope in [(reverse('instructor_assessments'), {'title': 'Must not exist', 'batch_id': self.batch.id, 'publication_status': 'draft'}),
                                   (reverse('instructor_assessment_add_questions', args=[self.assessment.id]), {})]:
            for field, invalid in [('question_text', []), ('question_type', 'unsupported'), ('correct_answer', {}),
                                   ('choices', [{'text': [], 'is_correct': True}])]:
                with self.subTest(endpoint=endpoint, field=field):
                    bad = {**deepcopy(self.valid), field: invalid}
                    response = self.client.post(endpoint, {**envelope, 'questions': [self.valid, bad]}, format='json')
                    self.assertEqual(response.status_code, 400)
                    self.assertEqual(Assessment.objects.count(), 1)
                    self.assertEqual(Question.objects.count(), 1)
                    self.assertEqual(AnswerChoice.objects.count(), 1)

    def test_failed_create_or_append_rolls_back_all_nested_rows(self):
        for endpoint, envelope in [(reverse('instructor_assessments'), {'title': 'Must roll back', 'batch_id': self.batch.id, 'publication_status': 'draft'}),
                                   (reverse('instructor_assessment_add_questions', args=[self.assessment.id]), {})]:
            with patch('api.views.AnswerChoice.objects.create', side_effect=RuntimeError('Synthetic write failure')):
                with self.assertRaises(RuntimeError):
                    self.client.post(endpoint, {**envelope, 'questions': [self.valid]}, format='json')
            self.assertEqual(Assessment.objects.count(), 1)
            self.assertEqual(Question.objects.count(), 1)
            self.assertEqual(AnswerChoice.objects.count(), 1)

    def test_failed_choice_replacement_preserves_original_question_and_key(self):
        with patch('api.views.AnswerChoice.objects.create', side_effect=RuntimeError('Synthetic write failure')):
            with self.assertRaises(RuntimeError):
                self.client.patch(reverse('instructor_question_detail', args=[self.question.id]), self.valid, format='json')
        self.question.refresh_from_db()
        self.assertEqual(self.question.question_text, 'Original')
        self.assertEqual(list(self.question.choices.values_list('choice_text', 'is_correct')), [('Original key', True)])

    def test_invalid_question_edit_preserves_existing_text_and_key(self):
        for payload in [{'question_text': []}, {'question_type': 'unsupported'}, {'correct_answer': []},
                        {'choices': [{'text': {}, 'is_correct': True}]}]:
            with self.subTest(payload=payload):
                response = self.client.patch(reverse('instructor_question_detail', args=[self.question.id]), payload, format='json')
                self.assertEqual(response.status_code, 400)
                self.question.refresh_from_db()
                self.assertEqual(self.question.question_text, 'Original')
                self.assertTrue(AnswerChoice.objects.filter(pk=self.choice.pk).exists())

    def test_composite_save_updates_metadata_and_questions_as_one_operation(self):
        removed = Question.objects.create(assessment=self.assessment, question_text='Remove this draft')
        result = self.client.patch(reverse('instructor_assessment_detail', args=[self.assessment.id]), {
            'title': 'Published complete graph', 'publication_status': 'published',
            'question_changes': {'delete_ids': [removed.id], 'update': [{'id': self.question.id, **self.valid}], 'add': [self.valid]},
        }, format='json')
        self.assertEqual(result.status_code, 200)
        self.assertEqual(len(result.data['questions']), 2)
        self.assertIn(self.question.id, [question['id'] for question in result.data['questions']])
        self.assertFalse(Question.objects.filter(pk=removed.id).exists())
        self.assessment.refresh_from_db()
        self.assertEqual(self.assessment.publication_status, 'published')

    def test_bad_composite_save_and_late_write_failure_preserve_whole_graph(self):
        endpoint = reverse('instructor_assessment_detail', args=[self.assessment.id])
        changes = {'delete_ids': [], 'update': [{'id': self.question.id, **self.valid}], 'add': [{**self.valid, 'question_text': []}]}
        result = self.client.patch(endpoint, {'title': 'Must not save', 'question_changes': changes}, format='json')
        self.assertEqual(result.status_code, 400)
        self.assessment.refresh_from_db(); self.question.refresh_from_db()
        self.assertEqual(self.assessment.title, 'Draft fixture')
        self.assertEqual(self.question.question_text, 'Original')
        changes['add'] = [self.valid]
        with patch('api.assessment_authoring.AnswerChoice.objects.create', side_effect=RuntimeError('Synthetic late nested write failure')):
            with self.assertRaises(RuntimeError):
                self.client.patch(endpoint, {'title': 'Must roll back', 'question_changes': changes}, format='json')
        self.question.refresh_from_db(); self.assessment.refresh_from_db()
        self.assertEqual(self.assessment.title, 'Draft fixture')
        self.assertEqual(self.question.question_text, 'Original')
        self.assertEqual(list(self.question.choices.values_list('choice_text', flat=True)), ['Original key'])

    def test_composite_foreign_duplicate_or_attempted_question_changes_are_rejected(self):
        foreign = Assessment.objects.create(title='Foreign', created_by=self.owner)
        foreign_question = Question.objects.create(assessment=foreign, question_text='Foreign question')
        endpoint = reverse('instructor_assessment_detail', args=[self.assessment.id])
        for changes in [{'delete_ids': [foreign_question.id]}, {'delete_ids': [self.question.id, self.question.id]},
                        {'delete_ids': [self.question.id], 'update': [{'id': self.question.id, **self.valid}]}]:
            self.assertEqual(self.client.patch(endpoint, {'question_changes': changes}, format='json').status_code, 400)
        student = User.objects.create_user(email='author-attempt@example.com', role='student')
        StudentResponse.objects.create(student=student, assessment=self.assessment)
        self.assertEqual(self.client.patch(endpoint, {'question_changes': {'update': [{'id': self.question.id, **self.valid}]}}, format='json').status_code, 409)
