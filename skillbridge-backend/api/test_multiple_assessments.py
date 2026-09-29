from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import (AnswerChoice, Assessment, Batch, BatchEnrollment, Question,
                     SkillCategory, StudentResponse, User)


class MultipleAssessmentFoundationTests(APITestCase):
    def setUp(self):
        self.instructor = User.objects.create_user(email='owner@example.com', name='Owner', role='instructor')
        self.other_instructor = User.objects.create_user(email='other@example.com', name='Other', role='instructor')
        self.admin = User.objects.create_user(email='admin@example.com', name='Admin', role='admin')
        self.student = User.objects.create_user(email='student@example.com', name='Student', role='student')
        self.outsider = User.objects.create_user(email='outsider@example.com', name='Outsider', role='student')
        self.batch = Batch.objects.create(name='Main', instructor=self.instructor)
        self.other_batch = Batch.objects.create(name='Other', instructor=self.other_instructor)
        BatchEnrollment.objects.create(batch=self.batch, student=self.student)
        BatchEnrollment.objects.create(batch=self.other_batch, student=self.outsider)
        self.database = SkillCategory.objects.create(name='Database', created_by=self.instructor)
        self.network = SkillCategory.objects.create(name='Networking', created_by=self.instructor)
        self.programming = SkillCategory.objects.create(name='Programming', created_by=self.instructor)

    def make_assessment(self, title, categories, batch=None, **kwargs):
        assessment = Assessment.objects.create(
            title=title, created_by=self.instructor, batch=batch or self.batch, **kwargs,
        )
        for order, category in enumerate(categories, 1):
            question = Question.objects.create(
                assessment=assessment, skill_category=category,
                question_text=f'{category.name} question', question_type='mcq', question_order=order,
            )
            AnswerChoice.objects.create(question=question, choice_text='Secret answer', is_correct=True)
            AnswerChoice.objects.create(question=question, choice_text='Distractor', is_correct=False)
        return assessment

    def submit(self, assessment):
        self.client.force_authenticate(self.student)
        started = self.client.post(reverse('assessment_start', args=[assessment.id]))
        self.assertEqual(started.status_code, 200)
        answers = [{'question_id': q.id, 'selected_choice_id': q.choices.get(is_correct=False).id}
                   for q in assessment.questions.all()]
        result = self.client.post(reverse('assessment_submit', args=[assessment.id]),
                                  {'response_id': started.data['response_id'], 'answers': answers}, format='json')
        self.assertEqual(result.status_code, 200)
        return result

    def test_comprehensive_and_focused_assessments_list_and_independent_attempts(self):
        comprehensive = self.make_assessment('Comprehensive', [self.database, self.network, self.programming], display_order=2)
        focused = self.make_assessment('Database', [self.database], display_order=1)
        optional = self.make_assessment('Optional', [self.network], is_required=False, display_order=3)
        self.client.force_authenticate(self.student)
        listing = self.client.get(reverse('assessment_list'))
        self.assertEqual(listing.status_code, 200)
        self.assertEqual([a['id'] for a in listing.data['assessments']], [focused.id, comprehensive.id, optional.id])
        self.assertEqual(listing.data['assessments'][1]['categories'], ['Database', 'Networking', 'Programming'])
        self.assertEqual(listing.data['total_required_count'], 2)
        self.assertEqual(listing.data['remaining_required_count'], 2)
        self.assertEqual([a['action'] for a in listing.data['assessments']], ['start', 'start', 'start'])
        self.assertEqual(self.client.get(reverse('assessment_active')).data['id'], focused.id)
        self.submit(focused)
        self.assertEqual(self.client.get(reverse('assessment_active')).data['id'], comprehensive.id)
        self.assertEqual(self.client.get(reverse('assessment_list')).data['completed_required_count'], 1)
        self.assertEqual(self.client.get(reverse('assessment_list')).data['assessments'][0]['action'], 'view_result')
        self.submit(comprehensive)
        self.assertEqual(StudentResponse.objects.filter(student=self.student).count(), 2)
        self.assertTrue(self.client.get(reverse('assessment_list')).data['all_required_completed'])
        self.assertEqual(self.client.get(reverse('assessment_list')).data['remaining_required_count'], 0)
        self.assertTrue(self.client.get(reverse('assessment_active')).data['completed'])

    def test_access_is_batch_scoped_and_publication_and_dates_are_enforced(self):
        main = self.make_assessment('Main', [self.database])
        other = self.make_assessment('Other', [self.network], batch=self.other_batch)
        draft = self.make_assessment('Draft', [self.programming], publication_status='draft')
        upcoming = self.make_assessment('Upcoming', [self.programming], available_at=timezone.now() + timezone.timedelta(days=1))
        self.client.force_authenticate(self.student)
        for operation in ('start', 'submit', 'stop'):
            self.assertEqual(self.client.post(reverse(f'assessment_{operation}', args=[other.id]), {}, format='json').status_code, 404)
        self.assertEqual(self.client.post(reverse('assessment_start', args=[draft.id])).status_code, 409)
        self.assertEqual(self.client.post(reverse('assessment_start', args=[upcoming.id])).status_code, 409)
        statuses = {a['id']: a['availability_status'] for a in self.client.get(reverse('assessment_list')).data['assessments']}
        self.assertNotIn(draft.id, statuses)
        self.assertEqual(statuses[upcoming.id], 'upcoming')
        self.assertEqual(self.client.post(reverse('assessment_start', args=[main.id])).status_code, 200)
        self.client.force_authenticate(self.outsider)
        self.assertEqual(self.client.post(reverse('assessment_start', args=[main.id])).status_code, 404)
        self.assertEqual(self.client.get(reverse('assessment_list')).data['batch']['id'], self.other_batch.id)

    def test_retake_requires_assessment_id_when_ambiguous_and_checks_owner(self):
        first = self.make_assessment('First', [self.database])
        second = self.make_assessment('Second', [self.network])
        self.submit(first)
        self.submit(second)
        url = reverse('instructor_student_retake', args=[self.student.id])
        self.client.force_authenticate(self.instructor)
        self.assertEqual(self.client.patch(url, {'retake_allowed': True}, format='json').status_code, 409)
        granted = self.client.patch(url, {'assessment_id': first.id, 'retake_allowed': True}, format='json')
        self.assertEqual(granted.status_code, 200)
        self.assertTrue(StudentResponse.objects.get(student=self.student, assessment=first).retake_allowed)
        self.assertFalse(StudentResponse.objects.get(student=self.student, assessment=second).retake_allowed)
        self.client.force_authenticate(self.other_instructor)
        self.assertEqual(self.client.patch(url, {'assessment_id': second.id, 'retake_allowed': True}, format='json').status_code, 403)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.patch(url, {'assessment_id': second.id, 'retake_allowed': True}, format='json').status_code, 200)

    def test_archive_unarchive_preserves_draft_and_closed_and_attempts(self):
        published = self.make_assessment('Published', [self.database])
        draft = self.make_assessment('Draft', [self.network], publication_status='draft')
        closed = self.make_assessment('Closed', [self.programming], publication_status='closed')
        self.submit(published)
        self.client.force_authenticate(self.instructor)
        self.assertEqual(self.client.post(reverse('instructor_batch_archive', args=[self.batch.id])).status_code, 200)
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.post(reverse('assessment_start', args=[published.id])).status_code, 409)
        self.assertEqual(self.client.get(reverse('student_results'), {'assessment_id': published.id}).status_code, 200)
        self.assertEqual(self.client.get(reverse('student_results_review'), {'assessment_id': published.id}).status_code, 200)
        self.client.force_authenticate(self.instructor)
        self.assertEqual(self.client.post(reverse('instructor_batch_unarchive', args=[self.batch.id])).status_code, 200)
        for assessment, expected in ((published, 'published'), (draft, 'draft'), (closed, 'closed')):
            assessment.refresh_from_db()
            self.assertEqual(assessment.publication_status, expected)
        self.assertEqual(StudentResponse.objects.filter(student=self.student, assessment=published).count(), 1)

    def test_reports_batch_students_and_student_review_without_answer_key(self):
        first = self.make_assessment('First', [self.database, self.network])
        second = self.make_assessment('Second', [self.programming])
        result = self.submit(first)
        self.assertNotIn('correct_answers', result.data)
        self.assertEqual(result.data['recommendations'], [])
        self.client.force_authenticate(self.student)
        review = self.client.get(reverse('student_results_review'), {'assessment_id': first.id})
        self.assertEqual(review.status_code, 200)
        self.assertNotIn('is_correct', review.data['questions'][0]['choices'][0])
        self.assertNotIn('correct_text', review.data['questions'][0])
        self.assertFalse(next(iter(review.data['answers'].values()))['submitted_answer_correct'])
        self.assertEqual(self.client.get(reverse('student_results_review')).status_code, 409)
        results = self.client.get(reverse('student_results'), {'assessment_id': first.id})
        self.assertEqual(results.data['recommendations'], [])
        self.assertFalse(results.data['all_required_completed'])
        self.assertEqual(self.client.get(reverse('student_results'), {'assessment_id': second.id}).status_code, 404)
        self.client.force_authenticate(self.instructor)
        students = self.client.get(reverse('instructor_batch_students', args=[self.batch.id]))
        self.assertEqual(students.status_code, 200)
        self.client.force_authenticate(self.admin)
        reports = self.client.get(reverse('admin_reports'))
        self.assertEqual(reports.status_code, 200)
        self.assertEqual(next(r for r in reports.data['batch_completion'] if r['batch'] == self.batch.name)['submitted'], 0)

    def test_instructor_creation_keeps_existing_assessments_published(self):
        existing = self.make_assessment('Existing', [self.database])
        self.client.force_authenticate(self.instructor)
        created = self.client.post(reverse('instructor_assessments'), {
            'title': 'New', 'batch_id': self.batch.id,
            'questions': [{'question_text': 'New question', 'question_type': 'identification',
                           'category': 'Programming', 'correct_answer': 'Private answer'}],
        }, format='json')
        self.assertEqual(created.status_code, 201)
        existing.refresh_from_db()
        self.assertEqual(existing.publication_status, 'published')
        self.assertTrue(existing.is_active)

    def test_draft_and_historical_closed_assessments_do_not_block_progress(self):
        published = self.make_assessment('Assigned', [self.database])
        draft = self.make_assessment('Unassigned draft', [self.network], publication_status='draft')
        closed = self.make_assessment('Historical closed', [self.programming], publication_status='closed')
        self.client.force_authenticate(self.student)
        before = self.client.get(reverse('assessment_list')).data
        self.assertEqual(before['total_required_count'], 1)
        self.assertTrue(before['has_required_assessments'])
        self.assertFalse(before['all_required_completed'])
        self.submit(published)
        after = self.client.get(reverse('assessment_list')).data
        self.assertEqual(after['total_required_count'], 1)
        self.assertEqual(after['completed_required_count'], 1)
        self.assertTrue(after['all_required_completed'])
        self.assertEqual(after['remaining_required_count'], 0)
        self.assertEqual(self.client.get(reverse('assessment_active')).data['state'], 'completed')
        self.assertEqual(draft.publication_status, 'draft')
        self.assertEqual(closed.publication_status, 'closed')

    def test_student_list_hides_draft_and_unattempted_closed_metadata(self):
        published = self.make_assessment('Assigned', [self.database])
        draft = self.make_assessment('Private draft', [self.network], publication_status='draft')
        closed = self.make_assessment('Private closed', [self.programming], publication_status='closed')
        self.client.force_authenticate(self.student)
        listing = self.client.get(reverse('assessment_list'))
        self.assertEqual([item['id'] for item in listing.data['assessments']], [published.id])
        self.assertNotIn(draft.title, str(listing.data))
        self.assertNotIn(closed.title, str(listing.data))
        self.assertEqual(self.client.get(reverse('student_results'), {'assessment_id': draft.id}).status_code, 404)
        self.assertEqual(self.client.get(reverse('student_results_review'), {'assessment_id': draft.id}).status_code, 404)
        self.assertEqual(listing.data['total_required_count'], 1)
        self.submit(published)
        published.publication_status = 'closed'
        published.save(update_fields=['publication_status'])
        listing = self.client.get(reverse('assessment_list'))
        self.assertEqual(listing.data['assessments'][0]['action'], 'view_result')
        self.assertEqual(listing.data['assessments'][0]['availability_status'], 'closed')
        self.assertEqual(self.client.get(reverse('student_results'), {'assessment_id': published.id}).status_code, 200)

    def test_zero_published_required_assessments_is_not_complete(self):
        self.make_assessment('Draft only', [self.database], publication_status='draft')
        self.make_assessment('Closed legacy', [self.network], publication_status='closed')
        self.client.force_authenticate(self.student)
        progress = self.client.get(reverse('assessment_list')).data
        self.assertEqual(progress['total_required_count'], 0)
        self.assertEqual(progress['completed_required_count'], 0)
        self.assertEqual(progress['remaining_required_count'], 0)
        self.assertFalse(progress['has_required_assessments'])
        self.assertFalse(progress['all_required_completed'])
        self.assertEqual(self.client.get(reverse('assessment_active')).status_code, 409)

    def test_upcoming_and_overdue_published_assessments_still_count(self):
        self.make_assessment(
            'Upcoming assigned', [self.database],
            available_at=timezone.now() + timezone.timedelta(days=1),
        )
        self.make_assessment(
            'Overdue assigned', [self.network],
            due_at=timezone.now() - timezone.timedelta(days=1),
        )
        self.client.force_authenticate(self.student)
        progress = self.client.get(reverse('assessment_list')).data
        self.assertEqual(progress['total_required_count'], 2)
        self.assertEqual(progress['remaining_required_count'], 2)
        self.assertFalse(progress['all_required_completed'])
        self.assertEqual(
            {item['availability_status'] for item in progress['assessments']},
            {'upcoming', 'overdue'},
        )

    def test_finalized_results_survive_closure_without_exposing_answer_key(self):
        assessment = self.make_assessment('Completed then closed', [self.database])
        question = assessment.questions.get()
        submitted_choice = question.choices.get(is_correct=False)
        self.submit(assessment)
        assessment.publication_status = 'closed'
        assessment.save(update_fields=['publication_status'])

        self.client.force_authenticate(self.student)
        result = self.client.get(reverse('student_results'), {'assessment_id': assessment.id})
        review = self.client.get(reverse('student_results_review'), {'assessment_id': assessment.id})
        self.assertEqual(result.status_code, 200)
        self.assertEqual(self.client.get(reverse('student_results')).status_code, 200)
        self.assertEqual(result.data['skill_scores'][0]['category'], 'Database')
        self.assertEqual(result.data['skill_scores'][0]['raw_score'], 0)
        self.assertFalse(result.data['all_required_completed'])
        self.assertEqual(review.status_code, 200)
        self.assertEqual(self.client.get(reverse('student_results_review')).status_code, 200)
        self.assertEqual(review.data['answers'][str(question.id)]['selected_choice_id'], submitted_choice.id)
        self.assertFalse(review.data['answers'][str(question.id)]['submitted_answer_correct'])
        for forbidden_key in ('correct_answers', 'correct_text', 'is_correct', 'answer_key'):
            self.assertNotIn(forbidden_key, str(result.data))
            self.assertNotIn(forbidden_key, str(review.data))
        self.assertEqual(self.client.post(reverse('assessment_start', args=[assessment.id])).status_code, 409)

        same_batch_without_attempt = User.objects.create_user(
            email='no-attempt@example.com', name='No Attempt', role='student',
        )
        BatchEnrollment.objects.create(batch=self.batch, student=same_batch_without_attempt)
        self.client.force_authenticate(same_batch_without_attempt)
        self.assertEqual(self.client.get(reverse('student_results'), {'assessment_id': assessment.id}).status_code, 404)
        self.assertEqual(self.client.get(reverse('student_results_review'), {'assessment_id': assessment.id}).status_code, 404)
        self.client.force_authenticate(self.outsider)
        self.assertEqual(self.client.get(reverse('student_results'), {'assessment_id': assessment.id}).status_code, 404)
        self.assertEqual(self.client.get(reverse('student_results_review'), {'assessment_id': assessment.id}).status_code, 404)

    def test_stopped_or_overdue_finalized_attempt_remains_reviewable(self):
        assessment = self.make_assessment('Timed assessment', [self.network])
        question = assessment.questions.get()
        self.client.force_authenticate(self.student)
        started = self.client.post(reverse('assessment_start', args=[assessment.id]))
        stopped = self.client.post(reverse('assessment_stop', args=[assessment.id]), {
            'response_id': started.data['response_id'],
            'reason': 'tab_hidden',
            'answers': [{'question_id': question.id,
                         'selected_choice_id': question.choices.get(is_correct=False).id}],
        }, format='json')
        self.assertEqual(stopped.status_code, 200)
        assessment.due_at = timezone.now() - timezone.timedelta(minutes=1)
        assessment.save(update_fields=['due_at'])
        self.assertEqual(self.client.get(reverse('student_results'), {'assessment_id': assessment.id}).status_code, 200)
        review = self.client.get(reverse('student_results_review'), {'assessment_id': assessment.id})
        self.assertEqual(review.status_code, 200)
        self.assertFalse(review.data['answers'][str(question.id)]['submitted_answer_correct'])
        self.assertEqual(self.client.post(reverse('assessment_start', args=[assessment.id])).status_code, 409)
