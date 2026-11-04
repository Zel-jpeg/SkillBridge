"""Framework identity, atomic drafts/publication and exact original grading."""
import uuid
from rest_framework.test import APITestCase
from .models import (Assessment, AnswerChoice, Batch, CompetencyFramework, Institute, InstructorAssignment,
                     Program, Question, SkillCategory, SkillScore, StudentResponse, User)


class FrameworkAuthoringTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user('author@example.invalid', role='instructor', is_approved=True)
        self.peer = User.objects.create_user('peer@example.invalid', role='instructor', is_approved=True)
        self.admin = User.objects.create_user('admin@example.invalid', role='admin')
        self.student = User.objects.create_user('learner@example.invalid', role='student', is_approved=True)
        self.institute = Institute.objects.create(code='ANY', name='Any Institute')
        self.program = Program.objects.create(institute=self.institute, code='ANY', name='Any Program')
        self.other = Program.objects.create(institute=self.institute, code='OTHER', name='Other Program')
        self.grant = InstructorAssignment.objects.create(instructor=self.owner, program=self.program)
        InstructorAssignment.objects.create(instructor=self.peer, program=self.program)
        self.framework = CompetencyFramework.objects.create(program=self.program, version=1, name='Original knowledge', created_by=self.owner)
        self.next = CompetencyFramework.objects.create(program=self.program, version=2, name='Next knowledge', created_by=self.owner)
        self.foreign = CompetencyFramework.objects.create(program=self.other, version=1, name='Foreign knowledge', created_by=self.admin)
        self.category = SkillCategory.objects.create(framework=self.framework, name='Shared name', description='Original construct', tags=['Manual'])
        self.next_category = SkillCategory.objects.create(framework=self.next, name='Shared name', description='Different construct', tags=['New'])
        self.foreign_category = SkillCategory.objects.create(framework=self.foreign, name='Shared name', description='Foreign construct', tags=[])
        self.batch = Batch.objects.create(name='Program cohort', instructor=self.owner, program=self.program, institute=self.institute)
        self.legacy = Batch.objects.create(name='Original mixed IC', instructor=self.owner)
        self.client.force_authenticate(self.owner)

    def question(self, **changes):
        return {'question_text': 'Which record is appropriate?', 'question_type': 'mcq', 'category_id': self.category.id,
                'choices': [{'text': 'Reviewed record', 'is_correct': True}, {'text': 'Other', 'is_correct': False}], **changes}

    def create(self, **changes):
        from .competencies import current_framework, framework_payload
        digest = framework_payload(current_framework(self.owner, self.program, self.framework.id), self.owner)['digest']
        return self.client.post('/api/instructor/assessments/', {'title': 'Program assessment', 'batch_id': self.batch.id,
            'framework_id': self.framework.id, 'framework_digest': digest, 'publication_status': 'draft', 'questions': [self.question()], **changes}, format='json')

    def test_create_binds_batch_and_question_identity_and_freezes_all_definitions(self):
        result = self.create()
        self.assertEqual(result.status_code, 201, result.data)
        assessment = Assessment.objects.get(pk=result.data['id'])
        self.batch.refresh_from_db()
        self.assertEqual((assessment.framework_id, self.batch.framework_id, assessment.questions.get().skill_category_id),
                         (self.framework.id, self.framework.id, self.category.id))
        base = f'/api/management/programs/{self.program.id}/frameworks/{self.framework.id}/'
        self.assertTrue(self.client.get(base).data['locked'])
        self.assertEqual(self.client.post(base + 'categories/', {'name': 'Late', 'description': 'Late', 'tags': []}, format='json').status_code, 409)

    def test_foreign_mixed_name_only_and_invalid_category_payloads_have_no_partial_writes(self):
        for changes in [{'category_id': self.foreign_category.id}, {'category_id': self.next_category.id},
                        {'category_id': None, 'category': 'Shared name'}, {'category_id': True}, {'category': 'Wrong label'}]:
            result = self.create(questions=[self.question(), self.question(**changes)])
            self.assertIn(result.status_code, [400, 404], result.data)
            self.assertFalse(Assessment.objects.exists())
            self.batch.refresh_from_db(); self.assertIsNone(self.batch.framework_id)
        self.assertEqual(self.create(framework_id=self.foreign.id).status_code, 404)

    def test_stale_definition_review_cannot_bind_or_freeze_unreviewed_content(self):
        self.assertEqual(self.create(framework_digest='outdated').status_code, 409)
        self.assertFalse(Assessment.objects.exists())
        self.batch.refresh_from_db(); self.assertIsNone(self.batch.framework_id)
        self.framework.refresh_from_db(); self.assertIsNone(self.framework.locked_at)
        self.category.delete()
        result = self.create(questions=[])
        self.assertEqual(result.status_code, 400)
        self.assertFalse(Assessment.objects.exists())

    def test_binding_freezes_permanently_and_notifies_only_the_program_catalog(self):
        with self.captureOnCommitCallbacks(execute=True):
            result = self.create(questions=[])
        from .models import ChangeEvent
        events = ChangeEvent.objects.filter(payload__topics=['competencies'])
        self.assertEqual(set(events.values_list('recipient_id', flat=True)), {self.owner.id, self.peer.id, self.admin.id})
        for event in events:
            self.assertEqual(event.payload, {'topics': ['competencies'], 'program_ids': [self.program.id]})
        Assessment.objects.get(pk=result.data['id']).delete()
        self.framework.refresh_from_db(); self.assertIsNotNone(self.framework.locked_at)

    def test_new_assignment_requires_active_version_program_and_responsible_owner_grant(self):
        pk = self.create(batch_id=None).data['id']; url = f'/api/instructor/assessments/{pk}/'
        self.framework.is_active = False; self.framework.save(update_fields=['is_active'])
        self.assertEqual(self.client.patch(url, {'batch_id': self.batch.id}, format='json').status_code, 400)
        self.framework.is_active = True; self.framework.save(update_fields=['is_active'])
        self.program.is_active = False; self.program.save(update_fields=['is_active'])
        self.assertEqual(self.client.patch(url, {'batch_id': self.batch.id}, format='json').status_code, 400)
        self.program.is_active = True; self.program.save(update_fields=['is_active'])
        self.grant.is_active = False; self.grant.save(update_fields=['is_active'])
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.patch(url, {'batch_id': self.batch.id}, format='json').status_code, 400)
        self.assertIsNone(Assessment.objects.get(pk=pk).batch_id)

    def test_required_optional_flags_and_exact_identification_key_are_preserved(self):
        result = self.create(is_required=False, include_in_competency=False, publication_status='published',
            questions=[self.question(question_type='identification', correct_answer='Original Answer', choices=[])])
        self.assertEqual(result.status_code, 201, result.data)
        assessment = Assessment.objects.get(pk=result.data['id'])
        self.assertFalse(assessment.is_required); self.assertFalse(assessment.include_in_competency)
        question = assessment.questions.get()
        from .scoring import score_submission
        response = StudentResponse.objects.create(student=self.student, assessment=assessment)
        score_submission(response, [{'question_id': question.id, 'text_answer': '  ORIGINAL answer  '}], [])
        self.assertEqual(SkillScore.objects.get(assessment=assessment).percentage, 100)

    def test_framework_is_required_for_program_batch_and_cannot_change_or_use_legacy_batch(self):
        self.assertEqual(self.create(framework_id=None).status_code, 400)
        self.assertEqual(self.create(batch_id=self.legacy.id).status_code, 400)
        original = self.create().data['id']
        self.assertEqual(self.client.patch(f'/api/instructor/assessments/{original}/', {'framework_id': self.next.id}, format='json').status_code, 409)
        self.assertEqual(self.create(framework_id=self.next.id, questions=[self.question(category_id=self.next_category.id)]).status_code, 400)

    def test_batchless_draft_has_scope_freezes_definitions_and_assigns_only_to_compatible_batch(self):
        result = self.create(batch_id=None)
        self.assertEqual(result.status_code, 201, result.data)
        pk = result.data['id']; url = f'/api/instructor/assessments/{pk}/'
        self.assertIsNone(Assessment.objects.get(pk=pk).batch_id)
        base = f'/api/management/programs/{self.program.id}/frameworks/{self.framework.id}/'
        self.assertTrue(self.client.get(base).data['locked'])
        self.assertEqual(self.client.patch(url, {'batch_id': self.legacy.id}, format='json').status_code, 400)
        self.assertEqual(self.client.patch(url, {'batch_id': self.batch.id}, format='json').status_code, 200)
        self.batch.refresh_from_db(); self.assertEqual(self.batch.framework_id, self.framework.id)

    def test_same_program_does_not_share_private_draft_or_keys_and_revoke_hides_batchless_scope(self):
        pk = self.create(batch_id=None).data['id']
        self.client.force_authenticate(self.peer)
        self.assertEqual(self.client.get(f'/api/management/programs/{self.program.id}/frameworks/{self.framework.id}/authoring/').status_code, 200)
        self.assertEqual(self.client.get(f'/api/instructor/assessments/{pk}/questions/').status_code, 404)
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.get(f'/api/management/programs/{self.program.id}/frameworks/{self.framework.id}/authoring/').status_code, 403)
        self.client.force_authenticate(self.owner)
        self.grant.is_active = False; self.grant.save(update_fields=['is_active'])
        self.assertEqual(self.client.get(f'/api/instructor/assessments/{pk}/questions/').status_code, 404)
        self.assertEqual(self.client.get(f'/api/management/programs/{self.program.id}/frameworks/{self.framework.id}/authoring/').status_code, 404)

    def test_atomic_edit_append_and_individual_patch_cannot_escape_framework(self):
        pk = self.create().data['id']; url = f'/api/instructor/assessments/{pk}/'
        question = Question.objects.get(assessment_id=pk)
        result = self.client.patch(url, {'title': 'Must roll back', 'question_changes': {
            'update': [{'id': question.id, 'question_text': 'Must roll back'}], 'add': [self.question(category_id=self.foreign_category.id)]}}, format='json')
        self.assertEqual(result.status_code, 404)
        question.refresh_from_db(); self.assertEqual(question.question_text, 'Which record is appropriate?')
        self.assertEqual(Assessment.objects.get(pk=pk).title, 'Program assessment')
        self.assertEqual(self.client.post(url + 'questions/add/', {'questions': [self.question(category_id=self.next_category.id)]}, format='json').status_code, 404)
        qurl = f'/api/instructor/questions/{question.id}/'
        self.assertEqual(self.client.patch(qurl, {'category_id': self.next_category.id}, format='json').status_code, 404)
        self.assertEqual(self.client.patch(url, {'question_changes': {'update': [{'id': question.id, 'question_text': 'Updated text'}]}}, format='json').status_code, 200)
        question.refresh_from_db(); self.assertEqual(question.skill_category_id, self.category.id)

    def test_bulk_publication_rejects_corrupt_or_uncategorized_draft_atomically(self):
        first = self.create().data['id']
        second = self.create(questions=[self.question(category_id=None)]).data['id']
        result = self.client.post(f'/api/instructor/batches/{self.batch.id}/publish-assessments/', {'assessment_ids': [first, second]}, format='json')
        self.assertEqual(result.status_code, 400, result.data)
        self.assertFalse(Assessment.objects.filter(publication_status='published').exists())
        Question.objects.filter(assessment_id=second).update(skill_category=self.foreign_category)
        result = self.client.patch(f'/api/instructor/assessments/{second}/', {'publication_status': 'published'}, format='json')
        self.assertEqual(result.status_code, 400)

    def test_copy_retains_ids_and_never_crosses_program_or_version_even_with_same_name(self):
        pk = self.create().data['id']
        other_batch = Batch.objects.create(name='Next cohort', instructor=self.owner, program=self.program,
            institute=self.institute, framework=self.next)
        url = f'/api/instructor/assessments/{pk}/duplicate/'
        self.assertEqual(self.client.post(url, {'request_id': str(uuid.uuid4()), 'batch_id': other_batch.id}, format='json').status_code, 400)
        result = self.client.post(url, {'request_id': str(uuid.uuid4())}, format='json')
        self.assertEqual(result.status_code, 201, result.data)
        copied = Assessment.objects.get(pk=result.data['id'])
        self.assertEqual((copied.framework_id, copied.questions.get().skill_category_id, copied.is_required, copied.include_in_competency),
                         (self.framework.id, self.category.id, False, False))

    def test_three_question_types_and_missing_answers_preserve_raw_max_by_category_id(self):
        questions = [self.question(), self.question(question_type='truefalse', choices=[{'text': 'True', 'is_correct': False}, {'text': 'False', 'is_correct': True}]),
                     self.question(question_type='identification', correct_answer='Reviewed record', choices=[])]
        result = self.create(questions=questions, publication_status='published')
        self.assertEqual(result.status_code, 201, result.data)
        assessment = Assessment.objects.get(pk=result.data['id'])
        response = StudentResponse.objects.create(student=self.student, assessment=assessment)
        question = assessment.questions.first()
        from .scoring import score_submission
        score_submission(response, [{'question_id': question.id, 'selected_choice_id': question.choices.get(is_correct=True).id}], [])
        score = SkillScore.objects.get(assessment=assessment)
        self.assertEqual((score.skill_category_id, score.raw_score, score.max_score, score.percentage), (self.category.id, 1, 3, 33.33))
        self.assertEqual(self.client.patch(f'/api/instructor/assessments/{assessment.id}/', {'question_changes': {'add': [self.question()]}}, format='json').status_code, 409)
