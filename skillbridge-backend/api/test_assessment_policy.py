"""Lifecycle policies, immutable timing, explicit extensions and safe draft copies."""
from datetime import datetime, timedelta, timezone as dt_timezone
from uuid import uuid4
from unittest.mock import patch
from django.urls import reverse
from rest_framework.test import APITestCase
from .models import (AnswerChoice, Assessment, AssessmentAttemptHistory, Batch, BatchEnrollment,
                     ManagementAction, Question, ResponseAnswer, SkillCategory, SkillScore, StudentResponse, User)
from .attempt_timing import timing


class AssessmentPolicyTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user('policy-owner@example.invalid', role='instructor', is_approved=True)
        self.admin = User.objects.create_user('policy-admin@example.invalid', role='admin')
        self.other = User.objects.create_user('policy-other@example.invalid', role='instructor', is_approved=True)
        self.student = User.objects.create_user('policy-student@example.invalid', role='student', is_approved=True)
        self.batch = Batch.objects.create(name='Synthetic timing cohort', instructor=self.owner)
        self.foreign_batch = Batch.objects.create(name='Foreign cohort', instructor=self.other)
        BatchEnrollment.objects.create(batch=self.batch, student=self.student)
        # 11:30 Manila, deadline 12:00 Manila; nominal duration is 60 minutes.
        self.now = datetime(2026, 11, 1, 3, 30, tzinfo=dt_timezone.utc)
        self.due = self.now + timedelta(minutes=30)
        self.assessment = Assessment.objects.create(title='Synthetic timed assessment', created_by=self.owner,
            batch=self.batch, duration_minutes=60, due_at=self.due)
        category = SkillCategory.objects.create(name='Synthetic timing category')
        self.question = Question.objects.create(assessment=self.assessment, question_text='Synthetic question', skill_category=category)
        self.choice = AnswerChoice.objects.create(question=self.question, choice_text='Yes', is_correct=True)
        AnswerChoice.objects.create(question=self.question, choice_text='No', is_correct=False)
        self.clock = patch('api.views.timezone.now', return_value=self.now)
        self.clock.start(); self.addCleanup(self.clock.stop)
        self.client.force_authenticate(self.owner)

    def start(self, at=None):
        self.client.force_authenticate(self.student)
        with patch('api.views.timezone.now', return_value=at or self.now):
            result = self.client.post(reverse('assessment_start', args=[self.assessment.id]))
        self.assertEqual(result.status_code, 200, result.data)
        self.response = StudentResponse.objects.get(pk=result.data['response_id'])
        self.payload = {'attempt_started_at': result.data['attempt_started_at'], 'response_id': self.response.id,
                        'answers': [{'question_id': self.question.id, 'selected_choice_id': self.choice.id}]}
        return result

    def edit(self, data, user=None):
        self.client.force_authenticate(user or self.owner)
        return self.client.patch(reverse('instructor_assessment_detail', args=[self.assessment.id]), data, format='json')

    def extend(self, minutes=10, **extra):
        self.client.force_authenticate(self.owner)
        data = {'minutes': minutes, 'reason': 'Synthetic connectivity accommodation', 'request_id': str(uuid4()),
                'attempt_started_at': self.payload['attempt_started_at'], **extra}
        return self.client.post(reverse('assessment_extra_time', args=[self.assessment.id, self.student.id]), data, format='json')

    def test_1130_start_with_one_hour_limit_and_noon_due_gets_thirty_minutes(self):
        started = self.start()
        self.assertEqual(started.data['remaining_seconds'], 1800)
        self.assertEqual(started.data['duration_seconds'], 3600)
        self.assertEqual(started.data['deadline_at'], self.due.isoformat())
        self.assertEqual(self.response.expires_at, self.due)
        self.assertEqual(self.response.due_at_snapshot, self.due)

    def test_duration_and_opening_lock_after_first_attempt_but_title_order_remain_editable(self):
        self.start()
        for user in (self.owner, self.admin):
            for data in ({'duration_minutes': 30}, {'available_at': self.now.isoformat()}, {'publication_status': 'closed'}):
                self.assertEqual(self.edit(data, user=user).status_code, 409)
            self.assertEqual(self.edit({'title': 'Safe title', 'display_order': 3}, user=user).status_code, 200)
        self.response.refresh_from_db()
        self.assertEqual(self.response.expires_at, self.due)

    def test_deadline_can_extend_or_be_removed_but_not_shortened_or_introduced(self):
        self.start()
        self.assertEqual(self.edit({'due_at': (self.due - timedelta(minutes=1)).isoformat()}).status_code, 409)
        self.assertEqual(self.edit({'due_at': (self.due + timedelta(hours=1)).isoformat()}).status_code, 200)
        self.response.refresh_from_db()
        self.assertEqual(timing(self.response, self.now)['remaining_seconds'], 1800)
        self.assertEqual(self.edit({'due_at': None}).status_code, 200)
        self.assertEqual(self.edit({'due_at': (self.due + timedelta(hours=2)).isoformat()}).status_code, 409)

    def test_time_snapshot_survives_out_of_band_template_duration_change(self):
        self.start()
        Assessment.objects.filter(pk=self.assessment.id).update(duration_minutes=1, due_at=self.now + timedelta(minutes=1))
        self.response.refresh_from_db()
        self.assertEqual(timing(self.response, self.now)['remaining_seconds'], 1800)

    def test_hard_cutoff_transport_grace_then_late_answers_are_saved_for_review(self):
        for seconds, expected_status in ((1800, 'submitted'), (1830, 'submitted'), (1830.001, 'stopped')):
            with self.subTest(seconds=seconds):
                StudentResponse.objects.all().delete(); SkillScore.objects.all().delete()
                self.start()
                with patch('api.views.timezone.now', return_value=self.now + timedelta(seconds=seconds)):
                    result = self.client.post(reverse('assessment_submit', args=[self.assessment.id]), self.payload, format='json')
                self.assertEqual(result.status_code, 200)
                self.response.refresh_from_db()
                self.assertEqual(self.response.status, expected_status)
                self.assertEqual(result.data['review_required'], expected_status == 'stopped')
                self.assertEqual(ResponseAnswer.objects.filter(response=self.response).count(), 1)
                self.assertEqual(SkillScore.objects.get(student=self.student, assessment=self.assessment).raw_score, 1)

    def test_extra_time_is_explicit_bounded_idempotent_and_audited(self):
        self.start()
        self.assertEqual(self.extend(10).status_code, 409)  # already capped at noon
        self.assertEqual(self.edit({'due_at': (self.due + timedelta(minutes=20)).isoformat()}).status_code, 200)
        nonce = str(uuid4())
        for _ in range(2):
            result = self.extend(10, request_id=nonce)
            self.assertEqual(result.status_code, 200, result.data)
            self.assertEqual(result.data['remaining_seconds'], 2400)
        self.response.refresh_from_db()
        self.assertEqual(self.response.duration_seconds, 3600)
        self.assertEqual(self.response.expires_at, self.due)
        self.assertEqual(self.response.extra_time_seconds, 600)
        self.assertEqual(ManagementAction.objects.filter(action='attempt.extra_time').count(), 1)

    def test_stale_auto_submit_cannot_finalize_an_extended_attempt(self):
        self.start()
        self.assertEqual(self.edit({'due_at': None}).status_code, 200)
        self.assertEqual(self.extend(10).status_code, 200)
        self.client.force_authenticate(self.student)
        with patch('api.views.timezone.now', return_value=self.due):
            result = self.client.post(reverse('assessment_submit', args=[self.assessment.id]),
                                     {**self.payload, 'auto_submit': True}, format='json')
        self.assertEqual(result.status_code, 409)
        self.assertEqual(result.data['code'], 'attempt_time_remaining')
        self.assertEqual(result.data['remaining_seconds'], 600)
        self.assertFalse(SkillScore.objects.exists())
        self.response.refresh_from_db()
        self.assertEqual(self.response.status, 'in_progress')

    def test_extra_time_rejects_invalid_expired_finalized_foreign_and_stale_attempts(self):
        self.start()
        self.assertEqual(self.extend(0).status_code, 400)
        self.assertEqual(self.extend(True).status_code, 400)
        self.assertEqual(self.extend(10, reason='').status_code, 400)
        self.assertEqual(self.extend(10, attempt_started_at='stale').status_code, 400)
        self.client.force_authenticate(self.other)
        foreign = self.client.post(reverse('assessment_extra_time', args=[self.assessment.id, self.student.id]), {}, format='json')
        self.assertEqual(foreign.status_code, 404)
        with patch('api.views.timezone.now', return_value=self.due):
            self.assertEqual(self.extend().status_code, 409)
        self.response.status = 'submitted'; self.response.submitted_at = self.now
        self.response.save()
        self.assertEqual(self.extend().status_code, 409)

    def test_timing_read_is_private_read_only_and_checks_attempt_identity(self):
        self.start()
        url = reverse('assessment_attempt_timing', args=[self.assessment.id])
        result = self.client.get(url, {'attempt_started_at': self.payload['attempt_started_at']})
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.data['remaining_seconds'], 1800)
        self.assertEqual(result['Cache-Control'], 'no-store')
        self.assertEqual(self.client.get(url).status_code, 400)
        stranger = User.objects.create_user('timing-stranger@example.invalid', role='student')
        self.client.force_authenticate(stranger)
        self.assertEqual(self.client.get(url, {'attempt_started_at': self.payload['attempt_started_at']}).status_code, 404)
        self.assertFalse(ManagementAction.objects.exists())

    def test_retake_captures_old_timing_and_starts_new_snapshot_without_extra_time(self):
        self.start()
        result = self.client.post(reverse('assessment_submit', args=[self.assessment.id]), self.payload, format='json')
        self.assertEqual(result.status_code, 200)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.patch(reverse('instructor_student_retake', args=[self.student.id]), {'assessment_id': self.assessment.id, 'retake_allowed': True}, format='json').status_code, 200)
        old_identity = self.payload['attempt_started_at']
        restarted = self.start(at=self.now + timedelta(minutes=10))
        self.assertNotEqual(restarted.data['attempt_started_at'], old_identity)
        self.assertEqual(restarted.data['remaining_seconds'], 1200)
        self.assertEqual(self.response.extra_time_seconds, 0)
        history = AssessmentAttemptHistory.objects.get(response=self.response)
        self.assertEqual(history.expires_at, self.due)
        self.assertEqual(history.duration_seconds, 3600)

    def test_duplicate_is_optional_excluded_unassigned_and_copies_only_content(self):
        self.start()
        self.client.force_authenticate(self.admin)
        nonce = str(uuid4())
        endpoint = reverse('assessment_duplicate', args=[self.assessment.id])
        result = self.client.post(endpoint, {'request_id': nonce}, format='json')
        self.assertEqual(result.status_code, 201, result.data)
        copy = Assessment.objects.get(pk=result.data['id'])
        self.assertEqual(copy.publication_status, 'draft')
        self.assertFalse(copy.is_required); self.assertFalse(copy.include_in_competency)
        self.assertIsNone(copy.batch_id); self.assertIsNone(copy.available_at); self.assertIsNone(copy.due_at)
        self.assertNotEqual(copy.questions.get().id, self.question.id)
        self.assertEqual(list(copy.questions.get().choices.values_list('choice_text', 'is_correct')), [('Yes', True), ('No', False)])
        self.assertFalse(copy.responses.exists()); self.assertFalse(SkillScore.objects.filter(assessment=copy).exists())
        retry = self.client.post(endpoint, {'request_id': nonce}, format='json')
        self.assertEqual(retry.status_code, 200); self.assertEqual(retry.data['id'], copy.id)
        self.assertEqual(Assessment.objects.count(), 2)

    def test_duplicate_respects_source_and_target_scope_and_rolls_back_failures(self):
        endpoint = reverse('assessment_duplicate', args=[self.assessment.id])
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.post(endpoint, {'request_id': str(uuid4())}, format='json').status_code, 404)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.post(endpoint, {'request_id': str(uuid4()), 'batch_id': self.foreign_batch.id}, format='json').status_code, 404)
        with patch('api.assessment_lifecycle.AnswerChoice.objects.bulk_create', side_effect=RuntimeError('Synthetic clone failure')):
            with self.assertRaises(RuntimeError): self.client.post(endpoint, {'request_id': str(uuid4())}, format='json')
        self.assertEqual(Assessment.objects.count(), 1)
        self.assertFalse(ManagementAction.objects.exists())
