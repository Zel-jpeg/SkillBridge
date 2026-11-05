from django.urls import reverse
from rest_framework.test import APITestCase

from .models import (AnswerChoice, Assessment, Batch, Institute, InstructorAssignment,
                     Program, Question, SkillCategory, StudentResponse, User)


class QuestionnaireExportTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user('export-admin@example.test', role='admin')
        self.owner = User.objects.create_user('export-owner@example.test', role='instructor', is_approved=True)
        self.other = User.objects.create_user('export-other@example.test', role='instructor', is_approved=True)
        self.student = User.objects.create_user('export-student@example.test', role='student', is_approved=True)
        institute = Institute.objects.create(code='EXPORT', name='Export institute')
        program = Program.objects.create(institute=institute, code='TEST', name='Test program')
        self.assignment = InstructorAssignment.objects.create(instructor=self.owner, program=program)
        InstructorAssignment.objects.create(instructor=self.other, program=program)
        batch = Batch.objects.create(name='Export batch', instructor=self.owner, institute=institute, program=program)
        self.assessment = Assessment.objects.create(title='Export worksheet', created_by=self.owner, batch=batch)
        self.url = reverse('questionnaire_export', args=[self.assessment.pk])
        self.category = SkillCategory.objects.create(name='Records')
        self.question('Count the entries.', 'identification', [('0', True)], 3)
        self.mcq = self.question('Which entry is current?', 'mcq', [('Old', False), ('Current', True)], 1)
        self.question('The entry is archived.', 'truefalse', [('False', True), ('True', False)], 2)
        self.question('Read the log:\n---\nprint(0)', 'mcq', [('1', False), ('0', True)], 4)
        self.client.force_authenticate(self.owner)

    def question(self, stem, kind, choices, order):
        question = Question.objects.create(assessment=self.assessment, skill_category=self.category, question_type=kind,
                                           question_text=stem, question_order=order)
        for text, correct in choices:
            AnswerChoice.objects.create(question=question, choice_text=text, is_correct=correct)
        return question

    def download(self, revision, file_format='aiken', partial=0):
        return self.client.get(self.url, {'download': 1, 'revision': revision, 'file_format': file_format, 'allow_partial': partial})

    def test_partial_download_requires_confirmation_and_uses_saved_question_and_choice_order(self):
        StudentResponse.objects.create(assessment=self.assessment, student=self.student,
            question_layout={'question_ids': [self.mcq.pk], 'mcq_choice_ids': {
                str(self.mcq.pk): list(self.mcq.choices.order_by('-id').values_list('id', flat=True)),
            }})
        preview = self.client.get(self.url)
        self.assertEqual(preview.status_code, 200)
        self.assertIn('no-store', preview['Cache-Control'])
        self.assertEqual(preview.data['included'], 1)
        self.assertEqual([row['number'] for row in preview.data['omitted']], [2, 3, 4])
        self.assertNotIn('Current', preview.content.decode())
        revision = preview.data['revision']
        self.assertEqual(self.download(revision).status_code, 409)
        download = self.download(revision, partial=1)
        self.assertEqual(download.status_code, 200)
        self.assertEqual(download.content.decode(), 'Which entry is current?\nA. Old\nB. Current\nANSWER: B\n')
        self.assertIn('attachment;', download['Content-Disposition'])
        self.assertIn('no-store', download['Cache-Control'])

    def test_native_preserves_types_category_keys_and_multiline(self):
        self.client.force_authenticate(self.admin)
        preview = self.client.get(self.url, {'file_format': 'native'}).data
        self.assertEqual(preview['included'], 4)
        download = self.download(preview['revision'], 'native')
        self.assertEqual(download.status_code, 200)
        blocks = download.content.decode().split('\n\n---\n\n')
        self.assertEqual(len(blocks), 4)
        self.assertIn('CORRECT: B', blocks[0])
        self.assertIn('CORRECT: False', blocks[1])
        self.assertIn('CORRECT: 0', blocks[2])
        self.assertIn('CATEGORY: Records', blocks[2])
        self.assertIn(r'QUESTION: "Read the log:\n---\nprint(0)"', blocks[3])

    def test_guessed_ids_and_previously_reviewed_downloads_require_current_scope(self):
        revision = self.client.get(self.url).data['revision']
        for actor, status in [(None, 401), (self.student, 403), (self.other, 404)]:
            self.client.force_authenticate(actor)
            self.assertEqual(self.client.get(self.url).status_code, status)
            self.assertEqual(self.download(revision, partial=1).status_code, status)
        self.assignment.is_active = False
        self.assignment.save(update_fields=['is_active'])
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.download(revision, partial=1).status_code, 404)

    def test_saved_edit_invalidates_revision_and_unsafe_questions_are_disclosed(self):
        preview = self.client.get(self.url).data
        self.mcq.question_text = 'A. Reserved stem marker'
        self.mcq.save(update_fields=['question_text'])
        self.assertEqual(self.download(preview['revision'], partial=1).status_code, 409)
        preview = self.client.get(self.url).data
        self.assertEqual(preview['included'], 0)
        self.assertEqual(self.download(preview['revision'], partial=1).status_code, 409)
        self.assertEqual(self.client.get(self.url, {'file_format': 'unknown'}).status_code, 400)
