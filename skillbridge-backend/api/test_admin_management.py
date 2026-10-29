from unittest.mock import patch
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken
from api.models import AnswerChoice, Assessment, Batch, BatchEnrollment, Question, SkillCategory, StudentResponse, User, ManagementAction


class AdminManagementTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user('role-admin@example.invalid', role='admin')
        self.owner = User.objects.create_user('role-owner@example.invalid', role='instructor', is_approved=True)
        self.other = User.objects.create_user('role-other@example.invalid', role='instructor', is_approved=True)
        self.student = User.objects.create_user('role-student@example.invalid', role='student', is_approved=True)
        self.batch = Batch.objects.create(name='Synthetic role batch', instructor=self.owner)
        self.second = Batch.objects.create(name='Synthetic second batch', instructor=self.other)
        BatchEnrollment.objects.create(batch=self.batch, student=self.student)
        BatchEnrollment.objects.create(batch=self.second, student=self.student)
        self.cat = SkillCategory.objects.create(name='Synthetic category')
        self.assessment = Assessment.objects.create(title='Synthetic draft', batch=self.batch, created_by=self.owner, publication_status='draft')
        self.question = Question.objects.create(assessment=self.assessment, question_text='Original', skill_category=self.cat)
        AnswerChoice.objects.create(question=self.question, choice_text='Yes', is_correct=True)
        AnswerChoice.objects.create(question=self.question, choice_text='No', is_correct=False)
        self.payload = {'question_text': 'Synthetic question?', 'question_type': 'mcq', 'category': self.cat.name,
                        'choices': [{'text': 'Yes', 'is_correct': True}, {'text': 'No', 'is_correct': False}]}
        self.sign_in(self.admin)

    def sign_in(self, user):
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + str(RefreshToken.for_user(user).access_token))

    def test_admin_creates_assessment_in_instructor_batch(self):
        result = self.client.post(reverse('instructor_assessments'), {'title': 'Admin-created draft', 'batch_id': self.batch.pk,
            'publication_status': 'draft', 'questions': [self.payload]}, format='json')
        self.assertEqual(result.status_code, 201, result.data)
        assessment = Assessment.objects.get(pk=result.data['id'])
        self.assertEqual(assessment.created_by_id, self.admin.pk)
        self.assertEqual(assessment.batch.instructor_id, self.owner.pk)
        self.assertEqual(assessment.questions.count(), 1)

    def test_admin_edits_adds_and_deletes_foreign_questions(self):
        result = self.client.patch(reverse('instructor_assessment_detail', args=[self.assessment.pk]), {
            'title': 'Admin composite edit', 'question_changes': {'delete_ids': [],
                'update': [{'id': self.question.pk, 'question_text': 'Changed by admin'}], 'add': [self.payload]}}, format='json')
        self.assertEqual(result.status_code, 200, result.data)
        self.question.refresh_from_db()
        self.assertEqual(self.question.question_text, 'Changed by admin')
        result = self.client.post(reverse('instructor_assessment_add_questions', args=[self.assessment.pk]), {'questions': [self.payload]}, format='json')
        self.assertEqual(result.status_code, 201, result.data)
        result = self.client.patch(reverse('instructor_question_detail', args=[self.question.pk]), {'question_text': 'Individual edit'}, format='json')
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(self.client.delete(reverse('instructor_question_detail', args=[self.question.pk])).status_code, 200)

    def test_admin_and_owner_obey_attempt_locks_and_can_edit_metadata(self):
        StudentResponse.objects.create(student=self.student, assessment=self.assessment)
        for user in [self.admin, self.owner]:
            self.sign_in(user)
            result = self.client.post(reverse('instructor_assessment_add_questions', args=[self.assessment.pk]), {'questions': [self.payload]}, format='json')
            self.assertEqual(result.status_code, 409, result.data)
            result = self.client.patch(reverse('instructor_question_detail', args=[self.question.pk]), {'question_text': 'Forbidden rewrite'}, format='json')
            self.assertEqual(result.status_code, 409, result.data)
            result = self.client.patch(reverse('instructor_assessment_detail', args=[self.assessment.pk]), {'title': 'Metadata remains editable'}, format='json')
            self.assertEqual(result.status_code, 200, result.data)
        self.question.refresh_from_db()
        self.assertEqual(self.question.question_text, 'Original')

    def test_admin_batch_creation_assigns_selected_instructor_and_records_creator(self):
        result = self.client.post(reverse('instructor_batches'), {'name': 'Admin requested instructor owner', 'instructor_id': self.owner.pk}, format='json')
        self.assertEqual(result.status_code, 201, result.data)
        batch = Batch.objects.get(pk=result.data['id'])
        self.assertEqual(batch.instructor_id, self.owner.pk)
        self.assertEqual(batch.created_by_id, self.admin.pk)
        self.assertEqual(self.client.post(reverse('instructor_batches'), {'name': 'Missing owner'}, format='json').status_code, 400)

    @patch('api.views.recalculate_enrolled_students')
    def test_admin_can_archive_restore_and_read_instructor_batch(self, recalculate):
        for endpoint, expected in [('instructor_batch_archive', 'archived'), ('instructor_batch_unarchive', 'active')]:
            if endpoint == 'instructor_batch_unarchive':
                conflict = self.client.post(reverse(endpoint, args=[self.batch.pk]), {}, format='json')
                self.assertEqual(conflict.status_code, 409, conflict.data)
                self.second.status = 'archived'
                self.second.save(update_fields=['status'])
            result = self.client.post(reverse(endpoint, args=[self.batch.pk]), {}, format='json')
            self.assertEqual(result.status_code, 200, result.data)
            self.batch.refresh_from_db()
            self.assertEqual(self.batch.status, expected)
        result = self.client.get(reverse('instructor_batch_students', args=[self.batch.pk]))
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual([row['id'] for row in result.data['students']], [self.student.pk])

    def test_admin_unenrollment_requires_explicit_foreign_batch(self):
        endpoint = reverse('instructor_student_remove', args=[self.student.pk])
        result = self.client.delete(endpoint)
        self.assertEqual(result.status_code, 400, result.data)
        result = self.client.delete(endpoint + f'?batch_id={self.batch.pk}')
        self.assertEqual(result.status_code, 200, result.data)
        self.assertFalse(BatchEnrollment.objects.filter(batch=self.batch, student=self.student).exists())
        self.assertTrue(BatchEnrollment.objects.filter(batch=self.second, student=self.student).exists())
        self.student.refresh_from_db()
        self.assertTrue(self.student.is_active)

    def test_admin_retakes_instructor_attempt(self):
        attempt = StudentResponse.objects.create(student=self.student, assessment=self.assessment, status='submitted', submitted_at=timezone.now())
        result = self.client.patch(reverse('instructor_student_retake', args=[self.student.pk]), {'assessment_id': self.assessment.pk, 'retake_allowed': True}, format='json')
        self.assertEqual(result.status_code, 200, result.data)
        attempt.refresh_from_db()
        self.assertTrue(attempt.retake_allowed)

    def test_admin_dashboard_endpoint_alternative_and_owner_scoped_legacy_read(self):
        shared = self.client.get(reverse('instructor_student_recommendations'))
        self.assertEqual(shared.status_code, 200)
        self.assertTrue(any(row['id'] == self.student.pk for row in shared.data))
        result = self.client.get(reverse('admin_student_recommendations'))
        self.assertEqual(result.status_code, 200, result.data)
        self.assertTrue(any(row['id'] == self.student.pk for row in result.data))

    def test_batchless_draft_can_be_assigned_but_assessment_delete_is_unsupported(self):
        self.assessment.batch = None
        self.assessment.save()
        endpoint = reverse('instructor_assessment_detail', args=[self.assessment.pk])
        result = self.client.patch(endpoint, {'batch_id': self.batch.pk}, format='json')
        self.assertEqual(result.status_code, 200, result.data)
        self.assessment.refresh_from_db()
        self.assertEqual(self.assessment.batch_id, self.batch.pk)
        self.assertEqual(self.client.patch(endpoint, {'publication_status': 'published'}, format='json').status_code, 200)
        self.assertEqual(self.client.delete(endpoint).status_code, 405)

    def test_foreign_instructor_denied_where_admin_can_manage(self):
        self.sign_in(self.other)
        result = self.client.patch(reverse('instructor_assessment_detail', args=[self.assessment.pk]), {'title': 'Forbidden'}, format='json')
        self.assertEqual(result.status_code, 404)
        self.assertEqual(self.client.get(reverse('instructor_assessment_questions', args=[self.assessment.pk])).status_code, 404)

    def test_reassignment_transfers_access_without_rewriting_history(self):
        from api.models import ChangeEvent, SkillScore
        score = SkillScore.objects.create(student=self.student, assessment=self.assessment,
            skill_category=self.cat, raw_score=1, max_score=2, percentage=50)
        with self.captureOnCommitCallbacks(execute=True):
            result = self.client.patch(reverse('admin_batch_detail', args=[self.batch.pk]),
                {'name': 'Transferred batch', 'instructor_id': self.other.pk}, format='json')
        self.assertEqual(result.status_code, 200, result.data)
        self.batch.refresh_from_db()
        self.assertEqual(self.batch.instructor_id, self.other.pk)
        self.assessment.refresh_from_db()
        self.assertEqual(self.assessment.created_by_id, self.owner.pk)
        score.refresh_from_db()
        self.assertEqual(score.percentage, 50)
        self.assertTrue(BatchEnrollment.objects.filter(batch=self.batch, student=self.student).exists())
        for user, expected in [(self.owner, 404), (self.other, 200), (self.admin, 200)]:
            self.sign_in(user)
            result = self.client.get(reverse('instructor_assessment_questions', args=[self.assessment.pk]))
            self.assertEqual(result.status_code, expected)
        recipients = set(ChangeEvent.objects.values_list('recipient_id', flat=True))
        self.assertTrue({self.owner.pk, self.other.pk, self.admin.pk, self.student.pk}.issubset(recipients))
        action = ManagementAction.objects.get(action='batch.update')
        self.assertEqual(action.actor_id, self.admin.pk)
        self.assertEqual(action.metadata['previous_instructor_id'], self.owner.pk)

    def test_invalid_owner_is_atomic_and_new_admin_endpoints_deny_other_roles(self):
        endpoint = reverse('admin_batch_detail', args=[self.batch.pk])
        for owner in [None, True, '2', self.admin.pk, self.student.pk, 999999]:
            result = self.client.patch(endpoint, {'name': 'Must not persist', 'instructor_id': owner}, format='json')
            self.assertEqual(result.status_code, 400, result.data)
            self.batch.refresh_from_db()
            self.assertEqual(self.batch.name, 'Synthetic role batch')
        self.other.is_active = False
        self.other.save(update_fields=['is_active'])
        self.assertEqual(self.client.patch(endpoint, {'instructor_id': self.other.pk}, format='json').status_code, 400)
        self.other.is_active = True
        self.other.is_approved = False
        self.other.save(update_fields=['is_active', 'is_approved'])
        self.assertEqual(self.client.patch(endpoint, {'instructor_id': self.other.pk}, format='json').status_code, 400)
        self.assertEqual(ManagementAction.objects.count(), 0)
        for user in [self.owner, self.student]:
            self.sign_in(user)
            self.assertEqual(self.client.patch(endpoint, {'name': 'Forbidden'}, format='json').status_code, 403)
            self.assertEqual(self.client.get(reverse('admin_batch_instructors')).status_code, 403)
            self.assertEqual(self.client.get(reverse('admin_management_actions')).status_code, 403)

    def test_audit_records_exclude_keys_and_rejected_changes(self):
        endpoint = reverse('instructor_question_detail', args=[self.question.pk])
        result = self.client.patch(endpoint, {'question_text': 'Private replacement question',
            'choices': [{'text': 'Private replacement key', 'is_correct': True}, {'text': 'Private distractor', 'is_correct': False}]}, format='json')
        self.assertEqual(result.status_code, 200, result.data)
        result = self.client.get(reverse('admin_management_actions'))
        self.assertEqual(result.status_code, 200)
        text = str(result.data)
        for private in ['Private replacement key', 'Private replacement question', 'Private distractor', self.student.email]:
            self.assertNotIn(private, text)
        self.assertEqual(result.data['results'][0]['action'], 'question.update')
        count = ManagementAction.objects.count()
        self.client.patch(endpoint, {'question_type': 'unsupported'}, format='json')
        self.assertEqual(ManagementAction.objects.count(), count)

    def test_batchless_assignment_cannot_take_foreign_or_attempted_draft(self):
        draft = Assessment.objects.create(title='Owner-only batchless', created_by=self.owner, publication_status='draft')
        endpoint = reverse('instructor_assessment_detail', args=[draft.pk])
        self.sign_in(self.owner)
        self.assertEqual(self.client.patch(endpoint, {'batch_id': self.second.pk}, format='json').status_code, 404)
        StudentResponse.objects.create(student=self.student, assessment=draft)
        self.assertEqual(self.client.patch(endpoint, {'batch_id': self.batch.pk}, format='json').status_code, 409)
        draft.refresh_from_db()
        self.assertIsNone(draft.batch_id)
        endpoint = reverse('instructor_assessment_detail', args=[self.assessment.pk])
        for invalid in [True, '1', [], 0]:
            self.assertEqual(self.client.patch(endpoint, {'batch_id': invalid}, format='json').status_code, 400)

    def test_instructor_cannot_choose_different_owner_and_picker_is_active_only(self):
        self.sign_in(self.owner)
        self.assertEqual(self.client.post(reverse('instructor_batches'),
            {'name': 'Forbidden owner', 'instructor_id': self.other.pk}, format='json').status_code, 403)
        result = self.client.post(reverse('instructor_batches'), {'name': 'Own cohort'}, format='json')
        self.assertEqual(result.status_code, 201, result.data)
        self.assertEqual(result.data['instructor_id'], self.owner.pk)
        self.sign_in(self.admin)
        self.other.is_active = False
        self.other.save(update_fields=['is_active'])
        self.assertEqual([row['id'] for row in self.client.get(reverse('admin_batch_instructors')).data], [self.owner.pk])

    def test_audit_failure_rolls_back_assessment_and_batch_changes(self):
        with patch('api.views.record_action', side_effect=RuntimeError('Synthetic audit write failure')):
            with self.assertRaises(RuntimeError):
                self.client.patch(reverse('instructor_assessment_detail', args=[self.assessment.pk]),
                    {'title': 'Must roll back'}, format='json')
        self.assessment.refresh_from_db()
        self.assertEqual(self.assessment.title, 'Synthetic draft')
        with patch('api.management_views.record_action', side_effect=RuntimeError('Synthetic audit write failure')):
            with self.assertRaises(RuntimeError):
                self.client.patch(reverse('admin_batch_detail', args=[self.batch.pk]),
                    {'instructor_id': self.other.pk}, format='json')
        self.batch.refresh_from_db()
        self.assertEqual(self.batch.instructor_id, self.owner.pk)

    @patch('api.views.combined_is_unlocked', return_value=True)
    def test_admin_company_candidates_include_all_managed_batches_without_losing_memberships(self, unlocked):
        from api.models import Company, Position, Recommendation
        company = Company.objects.create(name='Synthetic company')
        position = Position.objects.create(company=company, title='Synthetic position')
        for batch in [self.batch, self.second]:
            Recommendation.objects.create(student=self.student, batch=batch, position=position, match_score=80)
        result = self.client.get(reverse('instructor_companies'))
        self.assertEqual(result.status_code, 200, result.data)
        matched = result.data[0]['positions'][0]['matched_students']
        self.assertEqual({row['batch_name'] for row in matched}, {self.batch.name, self.second.name})
        self.sign_in(self.owner)
        matched = self.client.get(reverse('instructor_companies')).data[0]['positions'][0]['matched_students']
        self.assertEqual([row['batch_name'] for row in matched], [self.batch.name])


