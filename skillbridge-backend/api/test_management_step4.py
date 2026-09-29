import csv
import io

from django.urls import reverse
from zoneinfo import ZoneInfo
from rest_framework.test import APITestCase

from .models import (AnswerChoice, Assessment, Batch, BatchEnrollment, CombinedCategoryScore,
                     CombinedCompetencyProfile, Company, OJTPlacement, Position, Question,
                     Recommendation, SkillCategory, SkillScore, StudentResponse, User)


class ManagementStep4Tests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email='owner4@example.com', name='Owner', role='instructor')
        self.other = User.objects.create_user(email='other4@example.com', name='Other', role='instructor')
        self.admin = User.objects.create_user(email='admin4@example.com', name='Admin', role='admin')
        self.student = User.objects.create_user(email='student4@example.com', name='Student', role='student')
        self.batch = Batch.objects.create(name='Step 4', instructor=self.owner)
        self.other_batch = Batch.objects.create(name='Other batch', instructor=self.other)
        BatchEnrollment.objects.create(batch=self.batch, student=self.student)
        self.category = SkillCategory.objects.create(name='Database Step 4', created_by=self.owner)

    def assessment(self, title='Database', batch=None, state='published', required=True):
        owner = (batch or self.batch).instructor
        assessment = Assessment.objects.create(title=title, batch=batch or self.batch,
                                               created_by=owner, publication_status=state,
                                               is_required=required)
        question = Question.objects.create(assessment=assessment, skill_category=self.category,
                                           question_text='Private key?', question_type='mcq')
        AnswerChoice.objects.create(question=question, choice_text='Secret', is_correct=True)
        AnswerChoice.objects.create(question=question, choice_text='Other', is_correct=False)
        return assessment

    def finalized(self, assessment, status='submitted', flagged=False):
        return StudentResponse.objects.create(student=self.student, assessment=assessment,
                                              status=status, is_flagged=flagged,
                                              submitted_at=__import__('django').utils.timezone.now())

    def test_management_list_has_per_assessment_metrics_and_scoped_keys(self):
        owned = self.assessment()
        foreign = self.assessment('Foreign', batch=self.other_batch)
        self.finalized(owned)
        self.client.force_authenticate(self.owner)
        response = self.client.get(reverse('instructor_assessments'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        item = response.data[0]
        self.assertEqual(item['categories'], ['Database Step 4'])
        self.assertEqual(item['submission_count'], 1)
        self.assertEqual(item['completion_rate'], 100)
        self.assertTrue(item['questions_locked'])
        self.assertEqual(self.client.get(reverse('instructor_assessment_questions', args=[foreign.id])).status_code, 404)
        self.client.force_authenticate(self.admin)
        self.assertEqual(len(self.client.get(reverse('instructor_assessments')).data), 2)
        self.assertEqual(self.client.get(reverse('instructor_assessment_questions', args=[foreign.id])).status_code, 200)

    def test_publish_validates_question_key_and_draft_stays_private(self):
        self.client.force_authenticate(self.owner)
        draft = self.client.post(reverse('instructor_assessments'), {
            'title': 'Incomplete draft', 'batch_id': self.batch.id,
            'publication_status': 'draft', 'questions': [],
        }, format='json')
        self.assertEqual(draft.status_code, 201)
        draft_id = draft.data['id']
        invalid = self.client.patch(reverse('instructor_assessment_detail', args=[draft_id]),
                                    {'publication_status': 'published'}, format='json')
        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(Assessment.objects.get(id=draft_id).publication_status, 'draft')
        bad_question = self.client.post(reverse('instructor_assessments'), {
            'title': 'Invalid', 'batch_id': self.batch.id, 'publication_status': 'published',
            'questions': [{'question_text': 'Question', 'question_type': 'mcq', 'category': 'Database Step 4',
                           'choices': [{'text': 'A', 'is_correct': True}, {'text': 'B', 'is_correct': True}]}],
        }, format='json')
        self.assertEqual(bad_question.status_code, 400)
        self.client.force_authenticate(self.student)
        listing = self.client.get(reverse('assessment_list'))
        self.assertEqual(listing.data['assessments'], [])
        self.assertNotIn('Incomplete draft', str(listing.data))

    def test_attempts_block_question_and_draft_mutation_but_preserve_metadata(self):
        assessment = self.assessment()
        attempt = self.finalized(assessment)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.patch(reverse('instructor_assessment_detail', args=[assessment.id]),
                                           {'publication_status': 'draft'}, format='json').status_code, 409)
        self.assertEqual(self.client.delete(reverse('instructor_question_detail', args=[assessment.questions.first().id])).status_code, 409)
        closed = self.client.patch(reverse('instructor_assessment_detail', args=[assessment.id]),
                                   {'publication_status': 'closed', 'display_order': 8}, format='json')
        self.assertEqual(closed.status_code, 200)
        assessment.refresh_from_db()
        self.assertEqual(assessment.display_order, 8)
        self.assertEqual(assessment.publication_status, 'closed')
        self.assertTrue(StudentResponse.objects.filter(id=attempt.id).exists())

    def test_scoped_reports_csv_and_student_key_denial(self):
        assessment = self.assessment()
        foreign = self.assessment('Foreign', batch=self.other_batch)
        self.finalized(assessment, status='stopped', flagged=True)
        url = reverse('management_assessment_reports')
        self.client.force_authenticate(self.owner)
        report = self.client.get(url, {'type': 'assessment_completion', 'batch_id': self.batch.id})
        self.assertEqual(report.status_code, 200)
        self.assertEqual(report.data['rows'][0]['stopped_or_flagged'], 1)
        self.assertEqual(report.data['rows'][0]['submitted'], 0)
        self.assertEqual(self.client.get(url, {'assessment_id': foreign.id}).status_code, 404)
        progress = self.client.get(url, {'type': 'batch_progress', 'batch_id': self.batch.id})
        self.assertTrue(progress.data['rows'][0]['recommendations_locked'])
        self.assertNotIn('Secret', str(progress.data))
        csv_result = self.client.get(url, {'type': 'batch_progress', 'export': 'csv'})
        self.assertEqual(csv_result.status_code, 200)
        self.assertIn('text/csv', csv_result['Content-Type'])
        self.assertNotIn('Secret', csv_result.content.decode('utf-8'))
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.get(url).status_code, 403)
        self.assertEqual(self.client.get(reverse('instructor_assessment_questions', args=[assessment.id])).status_code, 403)
        self.client.force_authenticate(self.admin)
        self.assertEqual(len(self.client.get(url, {'type': 'assessment_completion'}).data['rows']), 2)

    def test_retake_targets_exact_assessment_and_preserves_other_attempt(self):
        first = self.assessment('First')
        second = self.assessment('Second')
        first_response = self.finalized(first, status='stopped', flagged=True)
        second_response = self.finalized(second)
        url = reverse('instructor_student_retake', args=[self.student.id])
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.patch(url, {'assessment_id': first.id, 'retake_allowed': True}, format='json').status_code, 403)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.patch(url, {'retake_allowed': True}, format='json').status_code, 409)
        result = self.client.patch(url, {'assessment_id': first.id, 'retake_allowed': True}, format='json')
        self.assertEqual(result.status_code, 200)
        first_response.refresh_from_db(); second_response.refresh_from_db()
        self.assertTrue(first_response.retake_allowed)
        self.assertFalse(second_response.retake_allowed)
        self.assertEqual(result.data['assessment_id'], first.id)

    def test_naive_management_schedule_uses_manila_local_time(self):
        assessment = self.assessment()
        self.client.force_authenticate(self.owner)
        result = self.client.patch(reverse('instructor_assessment_detail', args=[assessment.id]), {
            'available_at': '2026-10-01T09:30', 'due_at': '2026-10-02T09:30',
        }, format='json')
        self.assertEqual(result.status_code, 200)
        assessment.refresh_from_db()
        local = assessment.available_at.astimezone(ZoneInfo('Asia/Manila'))
        self.assertEqual(local.isoformat(), '2026-10-01T09:30:00+08:00')

    def test_flagged_submission_does_not_inflate_completion_rate(self):
        assessment = self.assessment()
        self.finalized(assessment, flagged=True)
        self.client.force_authenticate(self.owner)
        listing = self.client.get(reverse('instructor_assessments')).data[0]
        self.assertEqual(listing['submission_count'], 1)
        self.assertEqual(listing['completion_count'], 0)
        self.assertEqual(listing['completion_rate'], 0)
        report = self.client.get(reverse('management_assessment_reports'), {'type': 'assessment_completion'})
        self.assertEqual(report.data['rows'][0]['submitted'], 0)
        self.assertEqual(report.data['rows'][0]['stopped_or_flagged'], 1)

    def test_strict_boolean_create_patch_choices_and_retake(self):
        self.client.force_authenticate(self.owner)
        payload = {'title': 'Strict booleans', 'batch_id': self.batch.id,
                   'publication_status': 'published', 'is_required': False,
                   'include_in_competency': 'FALSE',
                   'questions': [{'question_text': 'Question', 'question_type': 'mcq',
                                  'category': self.category.name,
                                  'choices': [{'text': 'True choice', 'is_correct': True},
                                              {'text': 'False choice', 'is_correct': 'false'}]}]}
        created = self.client.post(reverse('instructor_assessments'), payload, format='json')
        self.assertEqual(created.status_code, 201)
        assessment = Assessment.objects.get(id=created.data['id'])
        self.assertFalse(assessment.is_required)
        self.assertFalse(assessment.include_in_competency)
        self.assertFalse(assessment.questions.get().choices.get(choice_text='False choice').is_correct)
        detail = reverse('instructor_assessment_detail', args=[assessment.id])
        self.assertEqual(self.client.patch(detail, {'display_order': 7}, format='json').status_code, 200)
        assessment.refresh_from_db()
        self.assertFalse(assessment.is_required)
        self.assertFalse(assessment.include_in_competency)
        self.assertEqual(self.client.patch(detail, {'is_required': 'false'}, format='json').status_code, 200)
        for field, invalid in [('is_required', 'maybe'), ('include_in_competency', 0), ('is_active', None)]:
            rejected = self.client.patch(detail, {field: invalid}, format='json')
            self.assertEqual(rejected.status_code, 400)
            self.assertIn(field, str(rejected.data))
        payload['title'] = 'Bad flag'
        payload['questions'][0]['choices'][0]['is_correct'] = 'yes'
        self.assertEqual(self.client.post(reverse('instructor_assessments'), payload, format='json').status_code, 400)
        question_id = assessment.questions.get().id
        self.assertEqual(self.client.patch(reverse('instructor_question_detail', args=[question_id]),
                                           {'choices': [{'text': 'A', 'is_correct': []}]}, format='json').status_code, 400)
        attempt = self.finalized(assessment)
        retake_url = reverse('instructor_student_retake', args=[self.student.id])
        self.assertEqual(self.client.patch(retake_url, {'assessment_id': assessment.id,
                                                        'retake_allowed': 'false'}, format='json').status_code, 200)
        self.assertFalse(attempt.retake_allowed)
        self.assertEqual(self.client.patch(retake_url, {'assessment_id': assessment.id,
                                                        'retake_allowed': 'later'}, format='json').status_code, 400)

    def test_student_competency_report_exports_complete_unlocked_evidence(self):
        assessment = self.assessment('Database Skills')
        self.finalized(assessment)
        SkillScore.objects.create(student=self.student, assessment=assessment, skill_category=self.category,
                                  raw_score=3, max_score=4, percentage=75)
        CombinedCategoryScore.objects.create(student=self.student, batch=self.batch, skill_category=self.category,
                                             raw_score=3, max_score=4, percentage=75,
                                             source_assessment_ids=[assessment.id])
        CombinedCompetencyProfile.objects.create(student=self.student, batch=self.batch, is_finalized=True,
                                                 included_assessment_ids=[assessment.id],
                                                 orientation_summary='Ready for database work')
        company = Company.objects.create(name='Sample Employer', added_by=self.admin)
        first = Position.objects.create(company=company, title='Database Intern')
        second = Position.objects.create(company=company, title='Data Analyst Intern')
        Recommendation.objects.create(student=self.student, batch=self.batch, position=first,
                                      match_score=91, is_current=True)
        Recommendation.objects.create(student=self.student, batch=self.batch, position=second,
                                      match_score=83, is_current=True)
        OJTPlacement.objects.create(student=self.student, batch=self.batch, company=company,
                                    position=first, status='approved')
        self.client.force_authenticate(self.owner)
        url = reverse('management_assessment_reports')
        result = self.client.get(url, {'type': 'student_competency', 'batch_id': self.batch.id})
        self.assertEqual(result.status_code, 200)
        row = result.data['rows'][0]
        self.assertEqual(row['individual_results'][0]['category_scores'][0]['raw_score'], 3)
        self.assertEqual(row['combined_category_scores'][0]['percentage'], 75)
        self.assertEqual(row['included_assessments'][0]['title'], assessment.title)
        self.assertEqual(row['combined_competency_profile']['orientation_summary'], 'Ready for database work')
        self.assertFalse(row['recommendations_locked'])
        self.assertEqual([rec['rank'] for rec in row['final_recommendations']], [1, 2])
        self.assertEqual(row['placement']['status'], 'approved')
        self.assertNotIn('Secret', str(result.data))
        csv_result = self.client.get(url, {'type': 'student_competency', 'export': 'csv'})
        csv_text = csv_result.content.decode('utf-8-sig')
        for expected in ('Database Skills', 'Database Step 4: 3/4 (75.0%)', 'Ready for database work',
                         '#1 Sample Employer - Database Intern', '#2 Sample Employer - Data Analyst Intern',
                         'Approved: Sample Employer - Database Intern'):
            self.assertIn(expected, csv_text)
        self.assertNotIn('Secret', csv_text)

    def test_locked_competency_report_never_exports_stale_recommendations(self):
        completed = self.assessment('Completed')
        self.assessment('Remaining')
        self.finalized(completed)
        SkillScore.objects.create(student=self.student, assessment=completed, skill_category=self.category,
                                  raw_score=1, max_score=1, percentage=100)
        company = Company.objects.create(name='Stale Private Employer', added_by=self.admin)
        position = Position.objects.create(company=company, title='Stale Private Position')
        Recommendation.objects.create(student=self.student, batch=self.batch, position=position,
                                      match_score=99, is_current=True)
        self.client.force_authenticate(self.admin)
        url = reverse('management_assessment_reports')
        report = self.client.get(url, {'type': 'student_competency'})
        row = report.data['rows'][0]
        self.assertTrue(row['recommendations_locked'])
        self.assertEqual(row['final_recommendations'], [])
        self.assertEqual(row['combined_category_scores'], [])
        self.assertEqual(row['placement']['status'], 'unplaced')
        self.assertNotIn('Stale Private', str(report.data))
        exported = self.client.get(url, {'type': 'student_competency', 'export': 'csv'}).content.decode('utf-8-sig')
        self.assertIn('Locked', exported)
        self.assertIn('Unplaced', exported)
        self.assertNotIn('Stale Private', exported)
        self.assertNotIn('Secret', exported)

    def test_csv_formula_cells_are_escaped_without_changing_numeric_cells(self):
        self.student.name = '=HYPERLINK("bad")'
        self.student.school_id = '+101'
        self.student.save(update_fields=['name', 'school_id'])
        self.batch.name = '-Batch'
        self.batch.save(update_fields=['name'])
        assessment = self.assessment('@Assessment')
        self.finalized(assessment)
        self.client.force_authenticate(self.owner)
        response = self.client.get(reverse('management_assessment_reports'),
                                   {'type': 'batch_progress', 'export': 'csv'})
        rows = list(csv.reader(io.StringIO(response.content.decode('utf-8-sig'))))
        data = rows[3]
        self.student.refresh_from_db()
        self.assertEqual(data[:3], ["'+101", "'" + self.student.name, "'-Batch"])
        self.assertEqual(data[4], "'@Assessment")
        self.assertEqual(data[8:10], ['1', '1'])
