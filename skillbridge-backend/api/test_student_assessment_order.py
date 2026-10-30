"""Synthetic API coverage for aliases, release, history and evidence preservation."""
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, Event
from unittest import skipUnless
from unittest.mock import patch

from django.db import close_old_connections, connection, transaction
from django.test import TransactionTestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import (AnswerChoice, Assessment, Batch, BatchEnrollment, ChangeEvent, ManagementAction,
                     Question, SkillCategory, SkillScore, StudentResponse, User)
from .student_assessment_order import assessment_numbers


class StudentAssessmentOrderTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user('alias-owner@example.invalid', role='instructor', is_approved=True)
        self.admin = User.objects.create_user('alias-admin@example.invalid', role='admin')
        self.student = User.objects.create_user('alias-student@example.invalid', role='student', is_approved=True)
        self.other = User.objects.create_user('alias-other@example.invalid', role='student', is_approved=True)
        self.batch = Batch.objects.create(name='Synthetic alias batch', instructor=self.owner)
        self.enrollment = BatchEnrollment.objects.create(student=self.student, batch=self.batch)
        BatchEnrollment.objects.create(student=self.other, batch=self.batch)
        self.category = SkillCategory.objects.create(name='Programming')
        self.client.force_authenticate(self.student)

    def make(self, count=1, **settings):
        rows = []
        for index in range(count):
            assessment = Assessment.objects.create(title=f'Private programming title {index}',
                batch=self.batch, created_by=self.owner, **settings)
            question = Question.objects.create(assessment=assessment, skill_category=self.category,
                question_text='What is printed?\nprint(2 + 3)', question_type='mcq')
            AnswerChoice.objects.create(question=question, choice_text='5', is_correct=True)
            AnswerChoice.objects.create(question=question, choice_text='23')
            rows.append(assessment)
        return rows

    def listing(self):
        result = self.client.get(reverse('assessment_list'))
        self.assertEqual(result.status_code, 200, result.data)
        return result.data['assessments']

    def release(self, rows, actor=None):
        self.client.force_authenticate(actor or self.owner)
        return self.client.post(reverse('publish_assessments', args=[self.batch.pk]),
            {'assessment_ids': [row.pk for row in rows]}, format='json')

    def test_existing_enrollment_empty_then_atomic_six_draft_release(self):
        self.assertEqual(self.listing(), [])
        rows = self.make(6, publication_status='draft')
        self.assertEqual(self.listing(), [])
        self.enrollment.refresh_from_db()
        self.assertEqual(self.enrollment.assessment_order, [])
        self.assertEqual(self.release(rows).status_code, 200)
        self.client.force_authenticate(self.student)
        with patch('api.student_assessment_order.secrets.SystemRandom') as rng:
            rng.return_value.shuffle.side_effect = lambda items: items.reverse()
            first = self.listing()
            self.assertEqual([item['id'] for item in first], [row.pk for row in reversed(rows)])
            self.assertEqual(first, self.listing())
            self.assertEqual(rng.return_value.shuffle.call_count, 1)
        self.assertEqual([item['title'] for item in first], [f'Assessment {i}' for i in range(1, 7)])
        self.assertTrue(all(item['categories'] == [] for item in first))
        self.assertFalse(StudentResponse.objects.exists())
        self.student.refresh_from_db()
        self.assertIsNone(self.student.last_login)

    def test_independent_students_and_consistent_dashboard_active_routes(self):
        rows = self.make(6)
        calls = []
        def shuffle(items):
            if items:
                calls.append(list(items))
                if len(calls) == 1:
                    items.reverse()
        with patch('api.student_assessment_order.secrets.SystemRandom') as rng:
            rng.return_value.shuffle.side_effect = shuffle
            first = self.listing()
            me = self.client.get('/api/students/me/').data
            active = self.client.get(reverse('assessment_active')).data
            self.assertEqual(me['active_assessment']['id'], first[0]['id'])
            self.assertEqual(me['active_assessment']['title'], 'Assessment 1')
            self.assertEqual(active['title'], 'Assessment 1')
            self.client.force_authenticate(self.other)
            second = self.listing()
        self.assertEqual([item['id'] for item in first], [row.pk for row in reversed(rows)])
        self.assertEqual([item['id'] for item in second], [row.pk for row in rows])
        self.assertEqual(len(calls), 2)

    def test_new_group_appends_reserved_numbers_and_restoration_keeps_alias(self):
        self.make(6)
        first = self.listing()
        withdrawn = Assessment.objects.get(pk=first[2]['id'])
        withdrawn.publication_status = 'closed'
        withdrawn.archived_at = timezone.now()
        withdrawn.save()
        new = self.make(2)
        second = self.listing()
        self.assertNotIn(withdrawn.pk, [item['id'] for item in second])
        for item in second:
            previous = next((old for old in first if old['id'] == item['id']), None)
            if previous:
                self.assertEqual(item['title'], previous['title'])
        self.assertEqual({item['title'] for item in second if item['id'] in [row.pk for row in new]}, {'Assessment 7', 'Assessment 8'})
        withdrawn.archived_at = None
        withdrawn.publication_status = 'published'
        withdrawn.save()
        self.assertEqual(next(item['title'] for item in self.listing() if item['id'] == withdrawn.pk), 'Assessment 3')

    def test_deleted_and_unpublished_slots_are_not_reused(self):
        self.make(3)
        first = self.listing()
        Assessment.objects.get(pk=first[1]['id']).delete()
        Assessment.objects.filter(pk=first[2]['id']).update(publication_status='draft', is_active=False)
        extra = self.make()[0]
        titles = {item['id']: item['title'] for item in self.listing()}
        self.assertEqual(titles, {first[0]['id']: 'Assessment 1', extra.pk: 'Assessment 4'})

    def test_scheduled_assessments_keep_numbers_when_opening_time_arrives(self):
        rows = self.make(2, available_at=timezone.now() + timezone.timedelta(days=1))
        first = self.listing()
        self.assertTrue(all(item['availability_status'] == 'upcoming' for item in first))
        Assessment.objects.filter(pk__in=[row.pk for row in rows]).update(available_at=None)
        self.assertEqual([(item['id'], item['title']) for item in self.listing()], [(item['id'], item['title']) for item in first])

    def test_submission_results_review_retake_and_history_keep_features(self):
        assessment = self.make()[0]
        self.assertEqual(self.listing()[0]['title'], 'Assessment 1')
        started = self.client.post(reverse('assessment_start', args=[assessment.pk]))
        self.assertEqual(started.status_code, 200)
        self.assertEqual(started.data['title'], 'Assessment 1')
        self.assertEqual(started.data['questions'][0]['category'], '')
        question = assessment.questions.get()
        submitted = self.client.post(reverse('assessment_submit', args=[assessment.pk]), {
            'attempt_started_at': started.data['attempt_started_at'],
            'response_id': started.data['response_id'],
            'answers': [{'question_id': question.pk, 'selected_choice_id': question.choices.get(is_correct=True).pk}],
        }, format='json')
        self.assertEqual(submitted.status_code, 200, submitted.data)
        score = SkillScore.objects.get(student=self.student, assessment=assessment)
        self.assertEqual((score.raw_score, score.max_score, score.percentage), (1, 1, 100))
        result = self.client.get(reverse('student_results'), {'assessment_id': assessment.pk})
        self.assertEqual(result.data['assessment']['title'], 'Assessment 1')
        self.assertEqual(result.data['skill_scores'][0]['category'], 'Programming')
        self.assertFalse(result.data['recommendations_locked'])
        review = self.client.get(reverse('student_results_review'), {'assessment_id': assessment.pk})
        self.assertEqual(review.data['questions'][0]['category'], 'Programming')
        self.assertTrue(review.data['answers'][str(question.pk)]['submitted_answer_correct'])
        combined = self.client.get(reverse('student_combined_results'))
        self.assertEqual(combined.data['included_assessments'], [{'id': assessment.pk, 'title': 'Assessment 1'}])
        retake = self.client.get(reverse('student_retake_request', args=[assessment.pk]))
        self.assertEqual(retake.data['assessment'], 'Assessment 1')
        history = self.client.get(reverse('student_history'))
        self.assertEqual(history.status_code, 200)
        self.assertNotIn(assessment.title, str(history.data))
        response = StudentResponse.objects.get(student=self.student, assessment=assessment)
        original_layout = response.question_layout
        response.retake_allowed = True
        response.save(update_fields=['retake_allowed'])
        fresh = {**original_layout, 'version': 2}
        with patch('api.views.build_question_layout', return_value=fresh):
            retaken = self.client.post(reverse('assessment_start', args=[assessment.pk]))
        self.assertEqual(retaken.status_code, 200)
        self.assertEqual(retaken.data['title'], 'Assessment 1')
        self.assertEqual(StudentResponse.objects.get(pk=response.pk).question_layout, fresh)
        self.assertEqual(response.prior_attempts.count(), 1)

    def test_staff_real_titles_and_student_batch_permissions_remain(self):
        rows = self.make(2)
        self.listing()
        self.client.force_authenticate(self.owner)
        result = self.client.get(reverse('instructor_assessments'))
        self.assertTrue(all(row.title in str(result.data) for row in rows))
        outsider = User.objects.create_user('alias-outsider@example.invalid', role='student')
        self.client.force_authenticate(outsider)
        self.assertEqual(self.client.get(reverse('assessment_list')).status_code, 404)
        self.assertEqual(self.client.post(reverse('assessment_start', args=[rows[0].pk])).status_code, 404)

    def test_same_batch_reenrollment_preserves_order_and_new_batch_is_separate(self):
        self.make(6)
        first = self.listing()
        self.client.force_authenticate(self.owner)
        result = self.client.delete(reverse('instructor_student_remove', args=[self.student.pk]), {'batch_id': self.batch.pk}, format='json', QUERY_STRING=f'batch_id={self.batch.pk}')
        self.assertEqual(result.status_code, 200, result.data)
        BatchEnrollment.objects.create(student=self.student, batch=self.batch)
        self.client.force_authenticate(self.student)
        self.assertEqual([(item['id'], item['title']) for item in self.listing()], [(item['id'], item['title']) for item in first])
        other_batch = Batch.objects.create(name='Synthetic later batch', instructor=self.owner)
        self.assertEqual(assessment_numbers(self.student, other_batch), {})

    def test_release_validation_is_atomic_and_retries_are_idempotent(self):
        rows = self.make(2, publication_status='draft')
        broken = Assessment.objects.create(title='Missing questions', batch=self.batch, created_by=self.owner, publication_status='draft')
        failed = self.release(rows + [broken])
        self.assertEqual(failed.status_code, 400)
        self.assertEqual(Assessment.objects.filter(publication_status='published').count(), 0)
        good = self.release(rows)
        self.assertEqual((good.status_code, good.data['published_count']), (200, 2))
        audit_count = ManagementAction.objects.filter(action='assessment.publish').count()
        retried = self.release(rows)
        self.assertEqual((retried.status_code, retried.data['published_count']), (200, 0))
        self.assertEqual(ManagementAction.objects.filter(action='assessment.publish').count(), audit_count)

    def test_release_only_notifies_its_batch_after_successful_commit(self):
        rows = self.make(2, publication_status='draft')
        foreign = User.objects.create_user('alias-foreign@example.invalid', role='student')
        foreign_batch = Batch.objects.create(name='Synthetic foreign batch', instructor=self.owner)
        BatchEnrollment.objects.create(student=foreign, batch=foreign_batch)
        with self.captureOnCommitCallbacks(execute=True):
            result = self.release(rows)
            self.assertEqual(result.status_code, 200)
            self.assertFalse(ChangeEvent.objects.exists())
        events = ChangeEvent.objects.filter(recipient__role='student')
        self.assertEqual(set(events.values_list('recipient_id', flat=True)), {self.student.pk, self.other.pk})
        self.assertTrue(all(event.payload['batch_ids'] == [self.batch.pk] for event in events))
        self.assertNotIn('Private programming', str(list(events.values_list('payload', flat=True))))

    def test_publishing_drafts_without_students_supports_later_enrollment(self):
        BatchEnrollment.objects.filter(batch=self.batch).delete()
        rows = self.make(6, publication_status='draft')
        self.assertEqual(self.release(rows).status_code, 200)
        BatchEnrollment.objects.create(student=self.student, batch=self.batch)
        self.client.force_authenticate(self.student)
        self.assertEqual([item['title'] for item in self.listing()], [f'Assessment {i}' for i in range(1, 7)])

    def test_release_checks_role_batch_scope_archives_and_payload(self):
        rows = self.make(2, publication_status='draft')
        self.assertEqual(self.release(rows, actor=self.student).status_code, 403)
        other_owner = User.objects.create_user('alias-other-owner@example.invalid', role='instructor')
        self.assertEqual(self.release(rows, actor=other_owner).status_code, 404)
        self.client.force_authenticate(self.owner)
        url = reverse('publish_assessments', args=[self.batch.pk])
        for ids in ([], [True], [rows[0].pk, rows[0].pk], ['1']):
            self.assertEqual(self.client.post(url, {'assessment_ids': ids}, format='json').status_code, 400)
        self.assertEqual(self.client.post(url, [], format='json').status_code, 400)
        rows[0].archived_at = timezone.now()
        rows[0].save()
        self.assertEqual(self.release(rows).status_code, 409)
        self.assertEqual(Assessment.objects.filter(publication_status='published').count(), 0)
        self.batch.status = 'archived'
        self.batch.save()
        self.assertEqual(self.release([rows[1]], actor=self.admin).status_code, 409)


@skipUnless(connection.vendor == 'postgresql', 'Requires isolated PostgreSQL row locks')
class StudentAssessmentOrderConcurrencyTests(TransactionTestCase):
    def setUp(self):
        self.owner = User.objects.create_user('alias-race-owner@example.invalid', role='instructor')
        self.student = User.objects.create_user('alias-race-student@example.invalid', role='student')
        self.batch = Batch.objects.create(name='Synthetic alias race', instructor=self.owner)
        self.enrollment = BatchEnrollment.objects.create(student=self.student, batch=self.batch)
        self.rows = [Assessment.objects.create(title=f'Synthetic {i}', batch=self.batch, created_by=self.owner) for i in range(6)]

    def numbers(self, barrier=None, entered=None):
        close_old_connections()
        try:
            if barrier:
                barrier.wait(timeout=10)
            if entered:
                entered.set()
            return assessment_numbers(self.student, self.batch)
        finally:
            close_old_connections()

    def test_simultaneous_initialization_returns_one_saved_order(self):
        barrier = Barrier(2)
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(self.numbers, barrier) for _ in range(2)]
            results = [future.result(timeout=20) for future in futures]
        self.assertEqual(results[0], results[1])
        self.enrollment.refresh_from_db()
        self.assertEqual(results[0], {pk: i for i, pk in enumerate(self.enrollment.assessment_order, 1)})

    def test_first_read_cannot_observe_partial_release(self):
        Assessment.objects.filter(batch=self.batch).update(publication_status='draft', is_active=False)
        entered = Event()
        with ThreadPoolExecutor(max_workers=1) as pool:
            with transaction.atomic():
                Batch.objects.select_for_update().get(pk=self.batch.pk)
                Assessment.objects.filter(pk=self.rows[0].pk).update(publication_status='published', is_active=True)
                future = pool.submit(self.numbers, entered=entered)
                self.assertTrue(entered.wait(timeout=5))
                Assessment.objects.filter(batch=self.batch).update(publication_status='published', is_active=True)
            result = future.result(timeout=20)
        self.assertEqual(set(result), {row.pk for row in self.rows})
