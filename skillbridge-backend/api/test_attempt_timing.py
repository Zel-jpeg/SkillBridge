from unittest.mock import patch
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest import skipUnless

from django.db import connection, close_old_connections
from django.test import TransactionTestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase, APIClient

from .models import (AnswerChoice, Assessment, AssessmentAttemptHistory, Batch,
                     BatchEnrollment, CombinedCategoryScore, Question, ResponseAnswer,
                     SkillCategory, SkillScore, StudentResponse, User)


class AttemptTimingTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email='timer-owner@example.com', name='Owner', role='instructor')
        self.student = User.objects.create_user(email='timer-student@example.com', name='Student', role='student')
        self.batch = Batch.objects.create(name='Timer fixture', instructor=self.owner)
        BatchEnrollment.objects.create(batch=self.batch, student=self.student)
        category = SkillCategory.objects.create(name='Programming', created_by=self.owner)
        self.assessment = Assessment.objects.create(title='Timer fixture', created_by=self.owner, batch=self.batch, duration_minutes=1)
        self.question = Question.objects.create(assessment=self.assessment, skill_category=category, question_text='Fixture')
        self.choice = AnswerChoice.objects.create(question=self.question, choice_text='Yes', is_correct=True)
        self.now = timezone.now()
        self.client.force_authenticate(self.student)
        self.patcher = patch('api.views.timezone.now', return_value=self.now)
        self.patcher.start()
        self.addCleanup(self.patcher.stop)
        self.started = self.client.post(reverse('assessment_start', args=[self.assessment.id]))
        self.assertEqual(self.started.status_code, 200)
        self.response = StudentResponse.objects.get(pk=self.started.data['response_id'])
        self.payload = {'response_id': self.response.id, 'attempt_started_at': self.started.data['attempt_started_at'],
                        'answers': [{'question_id': self.question.id, 'selected_choice_id': self.choice.id}]}

    def submit_at(self, seconds, operation='submit', payload=None):
        data = dict(self.payload if payload is None else payload)
        if operation == 'stop':
            data['reason'] = 'tab_hidden'
        with patch('api.views.timezone.now', return_value=self.now + timezone.timedelta(seconds=seconds)):
            return self.client.post(reverse(f'assessment_{operation}', args=[self.assessment.id]), data, format='json')

    def test_server_clock_and_resume_do_not_reset_attempt(self):
        with patch('api.views.timezone.now', return_value=self.now + timezone.timedelta(seconds=20)):
            resumed = self.client.post(reverse('assessment_start', args=[self.assessment.id]))
        self.assertEqual(resumed.data['attempt_started_at'], self.payload['attempt_started_at'])
        self.assertEqual(resumed.data['remaining_seconds'], 40)
        self.assertEqual(resumed.data['deadline_at'], (self.now + timezone.timedelta(seconds=60)).isoformat())
        self.assertEqual(resumed.data['grace_deadline_at'], (self.now + timezone.timedelta(seconds=90)).isoformat())
        result = self.submit_at(91, payload={**self.payload, 'started_at': timezone.now().isoformat(), 'remaining_seconds': 6000})
        self.assertTrue(result.data['review_required'])

    def test_on_time_and_exact_grace_boundary_complete(self):
        result = self.submit_at(90)
        self.assertEqual(result.status_code, 200)
        self.assertFalse(result.data['review_required'])
        self.assertFalse(result.data['recommendations_locked'])
        self.response.refresh_from_db()
        self.assertEqual(self.response.status, 'submitted')
        self.assertEqual(self.submit_at(91).status_code, 409)
        self.assertEqual(SkillScore.objects.get(student=self.student).raw_score, 1)

    def test_after_grace_saves_review_evidence_without_unlocking(self):
        result = self.submit_at(90.001)
        self.assertEqual(result.status_code, 200)
        self.assertTrue(result.data['review_required'])
        self.assertIn('instructor review', result.data['message'])
        self.assertTrue(result.data['recommendations_locked'])
        self.response.refresh_from_db()
        self.assertEqual(self.response.status, 'stopped')
        self.assertTrue(self.response.is_flagged)
        self.assertEqual(self.response.stopped_reason, 'attempt_expired')
        self.assertEqual(ResponseAnswer.objects.get(response=self.response).selected_choice_id, self.choice.id)
        self.assertEqual(SkillScore.objects.get(student=self.student).max_score, 1)
        self.assertFalse(CombinedCategoryScore.objects.filter(student=self.student).exists())
        self.assertEqual(self.submit_at(100).status_code, 409)
        duplicate = self.submit_at(100, 'stop')
        self.assertEqual(duplicate.status_code, 200)
        self.assertTrue(duplicate.data['already_stopped'])
        self.assertTrue(duplicate.data['review_required'])
        self.assertEqual(self.response.answers.count(), 1)

    def test_expired_stop_and_late_submit_cannot_both_finalize(self):
        stopped = self.submit_at(120, 'stop')
        self.assertTrue(stopped.data['review_required'])
        self.assertEqual(self.submit_at(121).status_code, 409)
        self.response.refresh_from_db()
        self.assertEqual(self.response.violation_count, 1)
        self.assertEqual(len(self.response.violation_events), 1)

    def test_stale_request_cannot_finalize_reviewed_retake(self):
        self.submit_at(120)
        self.client.force_authenticate(self.owner)
        granted = self.client.patch(reverse('instructor_student_retake', args=[self.student.id]),
                                    {'assessment_id': self.assessment.id, 'retake_allowed': True}, format='json')
        self.assertEqual(granted.status_code, 200)
        self.client.force_authenticate(self.student)
        with patch('api.views.timezone.now', return_value=self.now + timezone.timedelta(seconds=150)):
            restart = self.client.post(reverse('assessment_start', args=[self.assessment.id]))
        self.assertNotEqual(restart.data['attempt_started_at'], self.payload['attempt_started_at'])
        for operation in ('submit', 'stop'):
            self.assertEqual(self.submit_at(151, operation).status_code, 400)
        self.response.refresh_from_db()
        self.assertEqual(self.response.status, 'in_progress')
        self.assertFalse(self.response.answers.exists())
        self.assertFalse(SkillScore.objects.filter(student=self.student).exists())
        history = AssessmentAttemptHistory.objects.get(response=self.response)
        self.assertEqual(history.stopped_reason, 'attempt_expired')
        self.assertEqual(history.category_scores[0]['raw_score'], 1)
        fresh = {**self.payload, 'attempt_started_at': restart.data['attempt_started_at']}
        self.assertEqual(self.submit_at(160, payload=fresh).status_code, 200)

    def test_missing_identity_rejected_without_writes(self):
        for operation in ('submit', 'stop'):
            self.assertEqual(self.submit_at(10, operation, {'answers': []}).status_code, 400)
        self.assertFalse(SkillScore.objects.filter(student=self.student).exists())

    def test_due_date_remains_a_separate_gate(self):
        self.assessment.due_at = self.now + timezone.timedelta(seconds=15)
        self.assessment.save(update_fields=['due_at'])
        self.assertEqual(self.submit_at(15).status_code, 200)
        # A finalized attempt remains immutable even if the due date later passes.
        self.assertEqual(self.submit_at(16).status_code, 409)


@skipUnless(connection.vendor == 'postgresql', 'Requires disposable PostgreSQL for row-lock concurrency')
class AttemptFinalizationConcurrencyTests(TransactionTestCase):
    def test_submit_and_stop_have_exactly_one_winner(self):
        self.race_finalizers(('submit', 'stop'))

    def test_duplicate_submissions_have_exactly_one_winner(self):
        self.race_finalizers(('submit', 'submit'))

    def test_duplicate_stops_have_exactly_one_winner(self):
        self.race_finalizers(('stop', 'stop'))

    def race_finalizers(self, operations):
        owner = User.objects.create_user(email='race-owner@example.com', name='Owner', role='instructor')
        student = User.objects.create_user(email='race-student@example.com', name='Student', role='student')
        batch = Batch.objects.create(name='Race fixture', instructor=owner)
        BatchEnrollment.objects.create(batch=batch, student=student)
        category = SkillCategory.objects.create(name='Race skill', created_by=owner)
        assessment = Assessment.objects.create(title='Race', created_by=owner, batch=batch)
        question = Question.objects.create(assessment=assessment, skill_category=category, question_text='Fixture')
        choice = AnswerChoice.objects.create(question=question, choice_text='Yes', is_correct=True)
        response = StudentResponse.objects.create(student=student, assessment=assessment, started_at=timezone.now())
        payload = {'response_id': response.id, 'attempt_started_at': response.started_at.isoformat(),
                   'answers': [{'question_id': question.id, 'selected_choice_id': choice.id}]}
        barrier = Barrier(2)

        def finalize(operation):
            close_old_connections()
            try:
                client = APIClient()
                client.force_authenticate(User.objects.get(pk=student.id))
                barrier.wait(timeout=10)
                result = client.post(reverse(f'assessment_{operation}', args=[assessment.id]),
                                     {**payload, **({'reason': 'tab_hidden'} if operation == 'stop' else {})}, format='json')
                return result.status_code, bool(result.data.get('already_stopped'))
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as workers:
            outcomes = list(workers.map(finalize, operations))
        self.assertEqual(sorted(code for code, _ in outcomes), [200, 200] if operations == ('stop', 'stop') else [200, 409])
        if operations == ('stop', 'stop'):
            self.assertEqual(sum(already for _, already in outcomes), 1)
        response.refresh_from_db()
        self.assertIn(response.status, ['submitted', 'stopped'])
        self.assertEqual(response.answers.count(), 1)
        self.assertEqual(SkillScore.objects.filter(student=student).count(), 1)
        self.assertEqual(response.violation_count, int(response.status == 'stopped'))
        self.assertEqual(len(response.violation_events), int(response.status == 'stopped'))
