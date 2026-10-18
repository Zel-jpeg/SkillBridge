"""Synthetic endpoint regressions for full-assessment grading and atomic input rejection."""
from unittest.mock import patch

from django.urls import reverse
from rest_framework.test import APITestCase

from .models import (
    AnswerChoice, Assessment, Batch, BatchEnrollment, CombinedCategoryScore,
    CombinedCompetencyProfile, Company, Position, PositionRequirement, Question,
    Recommendation, ResponseAnswer, SkillCategory, SkillScore, StudentResponse, User,
)


class SubmissionIntegrityTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email='owner@example.com', name='Owner', role='instructor')
        self.student = User.objects.create_user(email='student@example.com', name='Student', role='student')
        self.batch = Batch.objects.create(name='Synthetic batch', instructor=self.owner)
        BatchEnrollment.objects.create(student=self.student, batch=self.batch)
        self.category = SkillCategory.objects.create(name='Programming', created_by=self.owner)
        self.other_category = SkillCategory.objects.create(name='Networking', created_by=self.owner)
        self.assessment = Assessment.objects.create(title='Synthetic exam', created_by=self.owner, batch=self.batch)
        self.first = self.question(self.assessment, self.category)
        self.second = self.question(self.assessment, self.category)
        foreign_exam = Assessment.objects.create(title='Foreign exam', created_by=self.owner, batch=self.batch, is_required=False)
        self.foreign = self.question(foreign_exam, self.other_category)
        self.client.force_authenticate(self.student)
        started = self.client.post(reverse('assessment_start', args=[self.assessment.id]))
        self.assertEqual(started.status_code, 200)
        self.response = StudentResponse.objects.get(pk=started.data['response_id'])
        patcher = patch('api.recommendation_nlp.preprocess_texts', side_effect=lambda texts, model: (['synthetic skill text'] * len(texts), model, None))
        patcher.start()
        self.addCleanup(patcher.stop)

    def question(self, assessment, category, kind='mcq'):
        question = Question.objects.create(assessment=assessment, skill_category=category,
                                           question_text='Synthetic question', question_type=kind)
        AnswerChoice.objects.create(question=question, choice_text='Expected Term', is_correct=True)
        if kind != 'identification':
            AnswerChoice.objects.create(question=question, choice_text='Wrong', is_correct=False)
        return question

    def answer(self, question):
        return {'question_id': question.id, 'selected_choice_id': question.choices.get(is_correct=True).id}

    def submit(self, answers, operation='submit'):
        payload = {'response_id': self.response.id, 'attempt_started_at': self.response.started_at.isoformat(), 'answers': answers}
        if operation == 'stop':
            payload['reason'] = 'tab_hidden'
        return self.client.post(reverse(f'assessment_{operation}', args=[self.assessment.id]), payload, format='json')

    def assert_score(self, category, raw, maximum):
        score = SkillScore.objects.get(student=self.student, assessment=self.assessment, skill_category=category)
        self.assertEqual((score.raw_score, score.max_score, score.percentage), (raw, maximum, round(raw / maximum * 100, 2)))

    def test_omitted_question_counts_in_denominator_and_combined_evidence(self):
        company = Company.objects.create(name='Synthetic company')
        position = Position.objects.create(company=company, title='Intern', slots_available=1)
        PositionRequirement.objects.create(position=position, skill_category=self.category, required_percentage=50)
        result = self.submit([self.answer(self.first)])
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.data['scores']['Programming'], {'raw': 1, 'max': 2, 'pct': 50.0})
        self.assert_score(self.category, 1, 2)
        combined = CombinedCategoryScore.objects.get(student=self.student, batch=self.batch)
        self.assertEqual((combined.raw_score, combined.max_score, combined.percentage), (1, 2, 50.0))
        self.assertTrue(CombinedCompetencyProfile.objects.get(student=self.student, batch=self.batch).is_finalized)
        self.assertFalse(result.data['recommendations_locked'])
        self.assertTrue(Recommendation.objects.filter(student=self.student, position=position, is_current=True).exists())

    def test_seven_correct_three_omitted_is_seventy_percent(self):
        questions = [self.first, self.second] + [self.question(self.assessment, self.category) for _ in range(8)]
        result = self.submit([self.answer(q) for q in questions[:7]])
        self.assertEqual(result.status_code, 200)
        self.assert_score(self.category, 7, 10)

    def test_empty_submission_records_zero_for_every_authoritative_category(self):
        self.question(self.assessment, self.other_category)
        result = self.submit([])
        self.assertEqual(result.status_code, 200)
        self.assert_score(self.category, 0, 2)
        self.assert_score(self.other_category, 0, 1)
        self.assertFalse(ResponseAnswer.objects.filter(response=self.response).exists())
        self.assertEqual(CombinedCategoryScore.objects.get(student=self.student, skill_category=self.category).percentage, 0)

    def test_malformed_duplicate_and_foreign_entries_reject_before_any_write(self):
        good = self.answer(self.first)
        invalid_entries = [
            [good, good], [good, 'invalid-item'], [good, None], [good, []], [good, {}],
            [good, {'question_id': True}], [good, {'question_id': -1}],
            [good, {'question_id': 'invalid'}], [good, {'question_id': 1.5}],
            [good, {'question_id': 10**40}], [good, self.answer(self.foreign)],
            [good, {'question_id': self.second.id, 'selected_choice_id': good['selected_choice_id']}],
            [good, {'question_id': self.second.id, 'selected_choice_id': True}],
            [good, {'question_id': self.second.id, 'selected_choice_id': 'bad'}],
            [good, {'question_id': self.second.id, 'text_answer': {'bad': 'shape'}}],
            [good, {'question_id': self.second.id, 'text_answer': None}],
        ]
        for operation in ('submit', 'stop'):
            for payload in invalid_entries:
                with self.subTest(operation=operation, payload=payload):
                    result = self.submit(payload, operation)
                    self.assertEqual(result.status_code, 400, result.data)
                    self.assertIn('answers', result.data)
                    self.response.refresh_from_db()
                    self.assertEqual(self.response.status, StudentResponse.STATUS_IN_PROGRESS)
                    self.assertIsNone(self.response.submitted_at)
                    self.assertFalse(self.response.answers.exists())
                    self.assertFalse(SkillScore.objects.filter(student=self.student).exists())
                    self.assertFalse(CombinedCompetencyProfile.objects.filter(student=self.student).exists())

    def test_mixed_types_normalization_and_omitted_category(self):
        self.second.question_type = 'truefalse'
        self.second.save()
        identification = self.question(self.assessment, self.category, 'identification')
        self.question(self.assessment, self.other_category)
        result = self.submit([self.answer(self.first), self.answer(self.second),
                              {'question_id': identification.id, 'text_answer': '  eXpected TERM  '}])
        self.assertEqual(result.status_code, 200)
        self.assert_score(self.category, 3, 3)
        self.assert_score(self.other_category, 0, 1)
        self.assertEqual(self.response.answers.get(question=identification).text_answer, '  eXpected TERM  ')

    def test_identification_is_exact_not_synonym_or_substring(self):
        identification = self.question(self.assessment, self.other_category, 'identification')
        result = self.submit([{'question_id': identification.id, 'text_answer': 'Expected Term plus extra'}])
        self.assertEqual(result.status_code, 200)
        self.assert_score(self.other_category, 0, 1)

    def test_stop_keeps_only_completed_answers_and_excludes_combined_evidence(self):
        identification = self.question(self.assessment, self.other_category, 'identification')
        result = self.submit([self.answer(self.first), {'question_id': self.second.id, 'selected_choice_id': None},
                              {'question_id': identification.id, 'text_answer': '  '}], 'stop')
        self.assertEqual(result.status_code, 200)
        self.assert_score(self.category, 1, 2)
        self.assert_score(self.other_category, 0, 1)
        self.assertEqual(self.response.answers.count(), 1)
        self.assertFalse(CombinedCategoryScore.objects.filter(student=self.student).exists())
        self.assertTrue(result.data['recommendations_locked'])

    def test_grader_failure_rolls_back_answers_scores_and_finalization(self):
        with patch('api.models.SkillScore.objects.update_or_create', side_effect=RuntimeError('Synthetic write failure')):
            with self.assertRaises(RuntimeError):
                self.submit([self.answer(self.first)])
        self.response.refresh_from_db()
        self.assertEqual(self.response.status, StudentResponse.STATUS_IN_PROGRESS)
        self.assertFalse(self.response.answers.exists())
        self.assertFalse(SkillScore.objects.filter(student=self.student).exists())

    def test_pending_answer_updates_keep_identity_and_do_not_duplicate_rows(self):
        from .scoring import score_submission
        categories = [self.category, self.other_category]
        score_submission(self.response, [self.answer(self.first)], categories)
        saved = ResponseAnswer.objects.get(response=self.response, question=self.first)
        wrong = self.first.choices.get(is_correct=False)
        result = score_submission(self.response, [
            {'question_id': self.first.pk, 'selected_choice_id': wrong.pk}, self.answer(self.second),
        ], categories)
        saved.refresh_from_db()
        self.assertEqual(saved.selected_choice_id, wrong.pk)
        self.assertEqual(ResponseAnswer.objects.get(response=self.response, question=self.first).pk, saved.pk)
        self.assertEqual(self.response.answers.count(), 2)
        self.assertEqual(result[self.category.name], {'raw': 1, 'max': 2, 'pct': 50.0})

    def test_ambiguous_existing_answers_fail_without_silently_replacing_history(self):
        from .scoring import score_submission
        choice = self.first.choices.get(is_correct=True)
        for _ in range(2):
            ResponseAnswer.objects.create(response=self.response, question=self.first, selected_choice=choice)
        with self.assertRaises(ResponseAnswer.MultipleObjectsReturned):
            score_submission(self.response, [self.answer(self.first)], [self.category])
        self.assertEqual(self.response.answers.count(), 2)
        self.assertFalse(SkillScore.objects.filter(student=self.student).exists())
