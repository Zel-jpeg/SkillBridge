"""Archive is scoped, reversible and independent of historical scoring evidence."""
from unittest.mock import patch
from django.db import IntegrityError, transaction
from django.forms.models import model_to_dict
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from .assessment_progress import assessment_availability, required_progress
from .combined_competency import eligible_evidence
from .models import (AnswerChoice, Assessment, AssessmentAttemptHistory, Batch, BatchEnrollment,
                     ChangeEvent, ManagementAction, Question, ResponseAnswer, SkillCategory,
                     SkillScore, StudentCompetencyProfile, StudentResponse, User)


class AssessmentArchiveTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user('archive-owner@example.invalid', role='instructor', is_approved=True)
        self.other = User.objects.create_user('archive-other@example.invalid', role='instructor', is_approved=True)
        self.admin = User.objects.create_user('archive-admin@example.invalid', role='admin')
        self.student = User.objects.create_user('archive-student@example.invalid', role='student', is_approved=True)
        self.batch = Batch.objects.create(name='Synthetic archive cohort', instructor=self.owner)
        BatchEnrollment.objects.create(batch=self.batch, student=self.student)
        self.assessment = Assessment.objects.create(title='Archive fixture', batch=self.batch, created_by=self.owner,
                                                    publication_status='closed')
        self.category = SkillCategory.objects.create(name='Synthetic archive skill')
        self.question = Question.objects.create(assessment=self.assessment, question_text='Question', skill_category=self.category)
        self.choice = AnswerChoice.objects.create(question=self.question, choice_text='Yes', is_correct=True)
        self.client.force_authenticate(self.owner)

    def action(self, restore=False, assessment=None):
        return self.client.post(reverse('assessment_restore' if restore else 'assessment_archive',
                                        args=[(assessment or self.assessment).id]), {}, format='json')

    def history(self):
        response = StudentResponse.objects.create(student=self.student, assessment=self.assessment,
                    status='submitted', submitted_at=timezone.now(), started_at=timezone.now())
        answer = ResponseAnswer.objects.create(response=response, question=self.question, selected_choice=self.choice)
        score = SkillScore.objects.create(student=self.student, assessment=self.assessment,
                    skill_category=self.category, raw_score=1, max_score=1, percentage=100)
        prior = AssessmentAttemptHistory.objects.create(response=response, attempt_number=1, status='submitted',
                    answers=[{'question_id': self.question.id}], category_scores=[{'raw_score': 0, 'max_score': 1}])
        profile = StudentCompetencyProfile.objects.create(student=self.student, assessment=self.assessment)
        return [response, answer, score, prior, profile, self.question, self.choice]

    def test_archive_restore_preserves_publication_and_all_history(self):
        rows = self.history()
        before = [model_to_dict(row) for row in rows]
        settings = model_to_dict(self.assessment)
        progress = required_progress(self.student, self.batch)
        source_ids, scores = eligible_evidence(self.student, self.batch)
        self.assertEqual(source_ids, [self.assessment.id])
        for user in (self.owner, self.admin):
            self.client.force_authenticate(user)
            self.assertEqual(self.action().status_code, 200)
            self.assessment.refresh_from_db()
            self.assertTrue(self.assessment.is_archived)
            self.assertEqual(self.assessment.archived_by_id, user.id)
            self.assertEqual(assessment_availability(self.assessment), 'archived')
            self.assertEqual(required_progress(self.student, self.batch), progress)
            self.assertEqual(eligible_evidence(self.student, self.batch)[0], source_ids)
            self.assertEqual([s.id for s in eligible_evidence(self.student, self.batch)[1]], [s.id for s in scores])
            for row in rows: row.refresh_from_db()
            self.assertEqual([model_to_dict(row) for row in rows], before)
            self.assertEqual(self.action(restore=True).status_code, 200)
            self.assessment.refresh_from_db()
            self.assertFalse(self.assessment.is_archived)
            self.assertEqual(model_to_dict(self.assessment), settings)
        self.assertEqual(ManagementAction.objects.filter(action='assessment.archive').count(), 2)
        self.assertEqual(ManagementAction.objects.filter(action='assessment.restore').count(), 2)

    def test_published_cannot_be_archived_and_nonpublished_with_unfinished_attempt_cannot_be_archived(self):
        self.assessment.publication_status = 'published'
        self.assessment.save()
        self.assertEqual(self.action().status_code, 409)
        self.assessment.publication_status = 'closed'
        self.assessment.save()
        StudentResponse.objects.create(student=self.student, assessment=self.assessment, started_at=timezone.now())
        self.assertEqual(self.action().status_code, 409)
        self.assertFalse(ManagementAction.objects.exists())

    def test_stopped_attempt_and_batchless_draft_can_be_archived(self):
        StudentResponse.objects.create(student=self.student, assessment=self.assessment, status='stopped',
                                       submitted_at=timezone.now(), is_flagged=True)
        self.assertEqual(self.action().status_code, 200)
        draft = Assessment.objects.create(title='Unused draft', created_by=self.owner, publication_status='draft')
        self.assertEqual(self.action(assessment=draft).status_code, 200)
        self.assertEqual(self.action(restore=True, assessment=draft).status_code, 200)
        draft.refresh_from_db()
        self.assertEqual(draft.publication_status, 'draft')

    def test_scope_is_enforced_for_archive_restore_and_list(self):
        for restoring in (False, True):
            self.client.force_authenticate(self.other)
            self.assertEqual(self.action(restore=restoring).status_code, 404)
            self.client.force_authenticate(self.student)
            self.assertEqual(self.action(restore=restoring).status_code, 403)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.action().status_code, 200)
        listing = self.client.get(reverse('instructor_assessments')).data
        self.assertTrue(listing[0]['is_archived'])
        self.assertEqual(listing[0]['archived_by_id'], self.owner.id)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(reverse('instructor_assessments')).data, [])
        self.batch.instructor = self.other
        self.batch.save()
        self.assertEqual(self.action(restore=True).status_code, 200)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.action().status_code, 404)

    def test_archived_settings_questions_and_retake_writes_are_blocked(self):
        self.history()
        self.assertEqual(self.action().status_code, 200)
        for user in (self.owner, self.admin):
            self.client.force_authenticate(user)
            for data in ({'title': 'Forbidden'}, {'publication_status': 'published'},
                         {'question_changes': {'delete_ids': [self.question.id]}}, {'include_in_competency': False}):
                self.assertEqual(self.client.patch(reverse('instructor_assessment_detail', args=[self.assessment.id]), data, format='json').status_code, 409)
            self.assertEqual(self.client.post(reverse('instructor_assessment_add_questions', args=[self.assessment.id]), {'questions': []}, format='json').status_code, 409)
            self.assertEqual(self.client.patch(reverse('instructor_question_detail', args=[self.question.id]), {'question_text': 'Forbidden'}, format='json').status_code, 409)
            self.assertEqual(self.client.delete(reverse('instructor_question_detail', args=[self.question.id])).status_code, 409)
            self.assertEqual(self.client.patch(reverse('instructor_student_retake', args=[self.student.id]), {'assessment_id': self.assessment.id, 'retake_allowed': True}, format='json').status_code, 409)
            self.assertEqual(self.client.get(reverse('instructor_assessment_questions', args=[self.assessment.id])).status_code, 200)
        self.question.refresh_from_db()
        self.assertEqual(self.question.question_text, 'Question')

    def test_student_results_survive_but_start_is_unavailable(self):
        self.history()
        self.assertEqual(self.action().status_code, 200)
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.post(reverse('assessment_start', args=[self.assessment.id])).status_code, 409)
        self.assertEqual(self.client.get(reverse('student_results'), {'assessment_id': self.assessment.id}).status_code, 200)
        self.assertEqual(self.client.get(reverse('student_results_review'), {'assessment_id': self.assessment.id}).status_code, 200)
        listing = self.client.get(reverse('assessment_list')).data
        self.assertEqual(listing['assessments'][0]['availability_status'], 'archived')
        self.assertEqual(listing['assessments'][0]['action'], 'view_result')

    def test_repeated_actions_are_idempotent_and_publish_only_committed_changes(self):
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.action().status_code, 200)
        self.assessment.refresh_from_db()
        archived_at = self.assessment.archived_at
        events = ChangeEvent.objects.count()
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.action().status_code, 200)
        self.assessment.refresh_from_db()
        self.assertEqual(self.assessment.archived_at, archived_at)
        self.assertEqual(ChangeEvent.objects.count(), events)
        self.assertGreater(events, 0)
        for _ in range(2): self.assertEqual(self.action(restore=True).status_code, 200)
        self.assertEqual(ManagementAction.objects.count(), 2)

    def test_audit_failure_rolls_back_archive(self):
        with patch('api.assessment_archives.record_action', side_effect=RuntimeError('Synthetic audit failure')):
            with self.assertRaises(RuntimeError): self.action()
        self.assessment.refresh_from_db()
        self.assertFalse(self.assessment.is_archived)

    def test_database_rejects_published_archive_and_no_delete_endpoint_was_added(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            Assessment.objects.filter(pk=self.assessment.pk).update(publication_status='published', archived_at=timezone.now())
        self.assertEqual(self.client.delete(reverse('instructor_assessment_detail', args=[self.assessment.id])).status_code, 405)

    def test_retake_rechecks_finalization_after_acquiring_parent_lock(self):
        response = self.history()[0]
        real_lock = Assessment.objects.select_for_update

        def start_before_lock(*args, **kwargs):
            # Model the start transaction committing after the staff lookup.
            StudentResponse.objects.filter(pk=response.pk).update(status='in_progress', submitted_at=None, retake_allowed=False)
            return real_lock(*args, **kwargs)

        with patch('api.views.Assessment.objects.select_for_update', side_effect=start_before_lock):
            result = self.client.patch(reverse('instructor_student_retake', args=[self.student.id]),
                                       {'assessment_id': self.assessment.id, 'retake_allowed': True}, format='json')
        self.assertEqual(result.status_code, 409)
        response.refresh_from_db()
        self.assertFalse(response.retake_allowed)
