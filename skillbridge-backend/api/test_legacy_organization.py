from django.db import transaction
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from .enrollment_import import match_row
from .legacy_organization import apply_mapping, mapping_plan
from .models import (
    Assessment, AssessmentAttemptHistory, Batch, BatchEnrollment, Company, Institute,
    OJTPlacement, Position, Program, Recommendation, SkillCategory, SkillScore,
    StudentResponse, User,
)
from .opportunity_scope import eligible_recommendations
from .placement_scope import current_approvals


class LegacyOrganizationTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user('link-owner@example.invalid', role='instructor', is_approved=True)
        self.other = User.objects.create_user('link-other@example.invalid', role='instructor', is_approved=True)
        self.batch = Batch.objects.create(name='Existing mixed cohort', instructor=self.owner,
                                          closeout_snapshots=[{'version': 1}])
        self.it = self.student('it', 'BSIT')
        self.is_student = self.student('is', 'Bachelor of Science in Information System')
        for student in (self.it, self.is_student):
            BatchEnrollment.objects.create(batch=self.batch, student=student, assessment_order=[72])

    def student(self, label, course, **fields):
        return User.objects.create_user(f'link-{label}@example.invalid', role='student', is_approved=True,
            department=fields.pop('department', 'Institute of Computing'), course=course, **fields)

    def test_links_keep_mixed_batch_active_and_leave_evidence_and_access_in_place(self):
        assessment = Assessment.objects.create(batch=self.batch, title='Existing assessment', created_by=self.owner)
        response = StudentResponse.objects.create(student=self.it, assessment=assessment, status='submitted', submitted_at=timezone.now())
        AssessmentAttemptHistory.objects.create(response=response, attempt_number=1, status='stopped', answers=[{'stored': 1}])
        category = SkillCategory.objects.create(name='Existing category', description='Saved definition', tags=['saved'])
        SkillScore.objects.create(student=self.it, assessment=assessment, skill_category=category, raw_score=3, max_score=4, percentage=75)
        company = Company.objects.create(name='Synthetic partner')
        position = Position.objects.create(company=company, title='Existing opening', slots_available=1)
        rec = Recommendation.objects.create(student=self.it, batch=self.batch, position=position, match_score=0.75)
        OJTPlacement.objects.create(student=self.it, batch=self.batch, position=position, company=company,
                                    recommendation=rec, status='approved', match_score_at_assignment=0.75)
        preserved = (Assessment, StudentResponse, AssessmentAttemptHistory, BatchEnrollment,
                     SkillCategory, SkillScore, Position, Recommendation, OJTPlacement)
        before = {model: list(model.objects.order_by('pk').values()) for model in preserved}
        reviewed = mapping_plan()
        result = apply_mapping(reviewed)
        self.assertEqual(result['students_by_program'], {'BSIT': 1, 'BSIS': 1})
        self.batch.refresh_from_db()
        self.it.refresh_from_db()
        self.assertEqual(self.batch.institute.code, 'IC')
        self.assertEqual(self.batch.status, 'active')
        self.assertIsNone(self.batch.program_id)
        self.assertIsNone(self.batch.framework_id)
        self.assertEqual(self.batch.closeout_snapshots, [{'version': 1}])
        self.assertEqual(self.it.program.code, 'BSIT')
        self.assertEqual(self.it.course, 'BSIT')
        self.assertEqual({model: list(model.objects.order_by('pk').values()) for model in preserved}, before)
        self.assertTrue(eligible_recommendations(Recommendation.objects.filter(pk=rec.pk)).exists())
        self.assertEqual(current_approvals(position=position).count(), 1)
        self.assertEqual(mapping_plan()['students'], {})
        self.assertEqual(mapping_plan()['batches'], [])

        self.client.force_authenticate(self.owner)
        batches = self.client.get(reverse('instructor_batches'))
        self.assertEqual(batches.data[0]['institute_name'], 'Institute of Computing')
        url = reverse('management_analytics')
        self.assertEqual(self.client.get(url, {'institute_id': self.batch.institute_id}).data['scope']['batch_ids'], [self.batch.id])
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(url, {'institute_id': self.batch.institute_id}).status_code, 404)

        row = {'status': 'ready', 'email': self.it.email, 'school_id': '2024-00001', 'course': 'BSIT'}
        matched, _ = match_row(row, self.batch)
        self.assertEqual(matched['status'], 'already_enrolled')

    def test_default_department_and_conflicting_enrollment_cannot_determine_links(self):
        unrelated = Institute.objects.create(code='OTHER', name='Other institute')
        program = Program.objects.create(institute=unrelated, code='BSIT', name='Different local program')
        conflicting = self.student('conflict', 'BSIT')
        ambiguous = self.student('ambiguous', 'IT')
        empty_department = self.student('blank', 'BSIT', department='')
        foreign_batch = Batch.objects.create(name='Other cohort', instructor=self.other, institute=unrelated, program=program)
        BatchEnrollment.objects.create(batch=foreign_batch, student=conflicting)
        empty = Batch.objects.create(name='Empty IT cohort', instructor=self.owner)
        BatchEnrollment.objects.create(batch=self.batch, student=ambiguous)
        planned = mapping_plan()
        self.assertEqual(planned['batches'], [])
        self.assertEqual(set(planned['students']), {self.it.id, self.is_student.id})
        apply_mapping(planned)
        for student in (conflicting, ambiguous, empty_department):
            student.refresh_from_db()
            self.assertIsNone(student.program_id)
        empty.refresh_from_db()
        self.assertIsNone(empty.institute_id)

    def test_stale_mapping_rolls_back_catalog_and_other_links(self):
        planned = mapping_plan()
        foreign = Institute.objects.create(code='NEW', name='Concurrent context')
        Batch.objects.filter(pk=self.batch.pk).update(institute=foreign)
        with self.assertRaisesRegex(ValueError, 'Batch links changed'), transaction.atomic():
            apply_mapping(planned)
        self.assertFalse(Institute.objects.filter(code='IC').exists())
        self.assertFalse(User.objects.exclude(program=None).exists())
