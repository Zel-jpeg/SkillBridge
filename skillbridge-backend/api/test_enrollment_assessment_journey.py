"""Synthetic integration audit from reviewed enrollment to finalized batch results."""
import uuid
from unittest.mock import Mock, patch

from django.urls import reverse
from rest_framework.test import APIClient, APITestCase

from .models import (AnswerChoice, Assessment, AssessmentAttemptHistory, Batch,
                     BatchEnrollment, EmailNotice, Question, ResponseAnswer,
                     SkillCategory, SkillScore, StudentResponse, User)


def journey_fixture():
    owner = User.objects.create_user('journey-owner@dnsc.edu.ph', name='Synthetic Journey Instructor',
                                     role='instructor', is_approved=True)
    admin = User.objects.create_user('journey-admin@dnsc.edu.ph', name='Synthetic Journey Admin',
                                     role='admin', is_approved=True)
    batch = Batch.objects.create(name='Synthetic enrollment-to-results audit', instructor=owner)
    programming = SkillCategory.objects.create(name='Programming', created_by=owner)
    networking = SkillCategory.objects.create(name='Networking', created_by=owner)
    exams = [Assessment.objects.create(title=title, batch=batch, created_by=owner,
                                      display_order=index, duration_minutes=30)
             for index, title in enumerate(['Synthetic Fundamentals', 'Synthetic Programming'], 1)]
    questions = []
    for exam, category, kind, title in [
        (exams[0], programming, 'mcq', 'Choose the correct synthetic program.'),
        (exams[0], programming, 'mcq', 'This synthetic answer will be incorrect or omitted.'),
        (exams[0], networking, 'truefalse', 'Synthetic network connectivity is tested.'),
        (exams[0], networking, 'identification', 'Name the synthetic network term.'),
        (exams[1], programming, 'mcq', 'Choose synthetic loop.'),
        (exams[1], programming, 'mcq', 'Choose synthetic variable.'),
    ]:
        question = Question.objects.create(assessment=exam, skill_category=category,
            question_type=kind, question_text=title, question_order=len(questions) + 1)
        AnswerChoice.objects.create(question=question, choice_text='Expected Term' if kind == 'identification' else 'Synthetic correct', is_correct=True)
        if kind != 'identification':
            AnswerChoice.objects.create(question=question, choice_text='Synthetic incorrect', is_correct=False)
        questions.append(question)
    return owner, admin, batch, exams, questions


class EnrollmentAssessmentJourneyTests(APITestCase):
    def setUp(self):
        self.owner, self.admin, self.batch, self.exams, self.questions = journey_fixture()
        self.client.force_authenticate(self.owner)
        self.enroll_url = reverse('instructor_batch_enroll', args=[self.batch.pk])

    def enroll(self, count, mode):
        rows = [dict(name=f'Synthetic Journey {index:03}', school_id=f'2098-{index:05}',
                     course='BSIT', email=f'journey-{index:03}@dnsc.edu.ph') for index in range(1, count + 1)]
        review = self.client.post(self.enroll_url + 'preview/', {'students': rows}, format='json')
        self.assertEqual(review.status_code, 200, review.data)
        payload = dict(students=review.data['rows'], review_token=review.data['review_token'],
                       email_mode=mode, request_id=str(uuid.uuid4()))
        saved = self.client.post(self.enroll_url, payload, format='json')
        self.assertEqual(saved.status_code, 200, saved.data)
        self.assertEqual(saved.data['summary']['enrolled'], count)
        replayed = self.client.post(self.enroll_url, payload, format='json')
        self.assertEqual(replayed.data, saved.data)
        self.assertEqual(BatchEnrollment.objects.filter(batch=self.batch).count(), count)
        self.assertEqual(EmailNotice.objects.count(), count)

    def login_student(self):
        student = User.objects.get(email='journey-001@dnsc.edu.ph')
        public = APIClient()
        provider = Mock(status_code=200, json=lambda: dict(email=student.email, email_verified=True,
                                                          name='Provider Name Must Not Replace Reviewed Name', picture=''))
        with patch('api.views._google_userinfo', return_value=provider):
            login = public.post(reverse('google_login'), {'token': 'synthetic-provider-token'}, format='json')
        self.assertEqual(login.status_code, 200, login.data)
        self.assertEqual(login.data['user']['name'], student.name)
        self.assertFalse(student.has_usable_password())
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION='Bearer ' + login.data['access'])
        return student, client

    def start(self, client, exam):
        response = client.post(reverse('assessment_start', args=[exam.pk]))
        self.assertEqual(response.status_code, 200, response.data)
        self.assertNotIn('is_correct', str(response.data['questions']))
        return {key: response.data[key] for key in ('response_id', 'attempt_started_at')}, response

    def answers(self, exam, *, omit=False):
        result = []
        for question in self.questions:
            if question.assessment_id != exam.pk or omit and question == self.questions[1]:
                continue
            answer = {'question_id': question.pk}
            if question.question_type == 'identification':
                answer['text_answer'] = '  eXpEcTeD tErM  '
            else:
                answer['selected_choice_id'] = question.choices.get(is_correct=question != self.questions[1]).pk
            result.append(answer)
        return result

    def combined(self, client):
        response = client.get(reverse('student_combined_results'))
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    @patch('api.email_outbox.requests.post')
    @patch('api.email_outbox.requests.get')
    def test_one_hundred_enrollments_pending_emails_do_not_block_login_and_completion(self, get, post):
        self.enroll(100, 'now')
        self.assertEqual(EmailNotice.objects.filter(status='queued').count(), 100)
        student, client = self.login_student()
        invalid = client.patch(reverse('student_profile'), {'phone': 'bad'}, format='json')
        self.assertEqual(invalid.status_code, 400)
        profile = client.patch(reverse('student_profile'), dict(phone='09000000001', stayingAt='home',
            travelWilling='panabo', homeProvince='Davao del Norte', homeCity='Panabo City',
            homeBarangay='Synthetic Barangay', pinLat=7.30, pinLng=125.68), format='json')
        self.assertEqual(profile.status_code, 200, profile.data)
        self.assertTrue(self.combined(client)['recommendations_locked'])
        for index, exam in enumerate(self.exams):
            identity, started = self.start(client, exam)
            resumed_identity, resumed = self.start(client, exam)
            self.assertEqual(resumed_identity, identity)
            self.assertEqual(started.data['questions'], resumed.data['questions'])
            answers = self.answers(exam, omit=True)
            if index == 0:
                bad = client.post(reverse('assessment_submit', args=[exam.pk]),
                    {**identity, 'answers': answers + answers[:1]}, format='json')
                self.assertEqual(bad.status_code, 400)
                self.assertFalse(ResponseAnswer.objects.filter(response_id=identity['response_id']).exists())
                self.assertFalse(SkillScore.objects.filter(student=student).exists())
            payload = {**identity, 'answers': answers}
            result = client.post(reverse('assessment_submit', args=[exam.pk]), payload, format='json')
            self.assertEqual(result.status_code, 200, result.data)
            self.assertEqual(result.data['completed_required_count'], index + 1)
            self.assertEqual(result.data['recommendations_locked'], index == 0)
            self.assertEqual(client.post(reverse('assessment_submit', args=[exam.pk]), payload, format='json').status_code, 409)
        combined = self.combined(client)
        self.assertFalse(combined['recommendations_locked'])
        self.assertEqual((combined['overall_raw_score'], combined['overall_max_score'], combined['overall_percentage']), (5, 6, 83.33))
        scores = {row['category']: (row['raw_score'], row['max_score'], row['percentage']) for row in combined['combined_category_scores']}
        self.assertEqual(scores, {'Programming': (3, 4, 75), 'Networking': (2, 2, 100)})
        for actor in (self.owner, self.admin):
            self.client.force_authenticate(actor)
            roster = self.client.get(reverse('instructor_batch_students', args=[self.batch.pk]))
            self.assertEqual(roster.status_code, 200)
            row = next(row for row in roster.data['students'] if row['id'] == student.pk)
            self.assertTrue(row['all_required_completed'])
        self.assertEqual(StudentResponse.objects.filter(student=student).count(), 2)
        self.assertEqual(EmailNotice.objects.filter(status='queued').count(), 100)
        get.assert_not_called(); post.assert_not_called()

    def test_held_email_interruption_retake_and_stale_attempt_cannot_bypass_completion(self):
        self.enroll(1, 'later')
        student, client = self.login_student()
        exam = self.exams[0]
        identity, _ = self.start(client, exam)
        stopped = client.post(reverse('assessment_stop', args=[exam.pk]),
            {**identity, 'answers': self.answers(exam), 'reason': 'interruption_review'}, format='json')
        self.assertEqual(stopped.status_code, 200, stopped.data)
        self.assertTrue(self.combined(client)['recommendations_locked'])
        self.assertEqual(self.combined(client)['completed_required_count'], 0)
        self.client.force_authenticate(self.owner)
        grant = self.client.patch(reverse('instructor_student_retake', args=[student.pk]),
            {'assessment_id': exam.pk, 'retake_allowed': True}, format='json')
        self.assertEqual(grant.status_code, 200, grant.data)
        fresh, _ = self.start(client, exam)
        self.assertNotEqual(fresh['attempt_started_at'], identity['attempt_started_at'])
        self.assertEqual(AssessmentAttemptHistory.objects.count(), 1)
        self.assertFalse(SkillScore.objects.filter(student=student, assessment=exam).exists())
        stale = client.post(reverse('assessment_submit', args=[exam.pk]),
            {**identity, 'answers': self.answers(exam)}, format='json')
        self.assertEqual(stale.status_code, 400)
        for current_exam in self.exams:
            current = fresh if current_exam == exam else self.start(client, current_exam)[0]
            result = client.post(reverse('assessment_submit', args=[current_exam.pk]),
                {**current, 'answers': self.answers(current_exam)}, format='json')
            self.assertEqual(result.status_code, 200, result.data)
        self.assertTrue(self.combined(client)['all_required_completed'])
        self.assertEqual(EmailNotice.objects.get().status, 'held')
