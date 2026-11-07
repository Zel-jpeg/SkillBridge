from unittest.mock import patch

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import (Assessment, Batch, BatchEnrollment, ChangeEvent, CombinedCategoryScore,
                     CombinedCompetencyProfile, Company, CompetencyFramework, Institute, InstructorAssignment,
                     OJTPlacement, Position, Program, SkillCategory, SkillScore, StudentResponse, User)
from .sse import scoped_change


class DerivedScopeTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user('derived-admin@example.test', role='admin')
        self.owner = User.objects.create_user('derived-owner@example.test', role='instructor', is_approved=True)
        self.foreign = User.objects.create_user('derived-other@example.test', role='instructor', is_approved=True)
        self.first = self.cohort('FIRST', self.owner)
        self.second = self.cohort('SECOND', self.foreign)
        self.client.force_authenticate(self.owner)

    def cohort(self, code, instructor):
        institute = Institute.objects.create(code=code, name=f'{code} institute')
        program = Program.objects.create(institute=institute, code=code, name=f'{code} program')
        assignment = InstructorAssignment.objects.create(instructor=instructor, program=program)
        batch = Batch.objects.create(name=f'{code} cohort', institute=institute, program=program, instructor=instructor)
        student = User.objects.create_user(f'derived-{code.lower()}@example.test', name=f'{code} learner',
                                           role='student', is_approved=True, program=program)
        BatchEnrollment.objects.create(batch=batch, student=student)
        assessment = Assessment.objects.create(title=f'{code} private assessment', batch=batch, created_by=instructor)
        return batch, student, assessment, assignment

    def test_staff_organization_choices_and_scoped_assessment_metadata(self):
        first, second = self.first[0], self.second[0]
        url = reverse('staff_organization_options')
        self.assertEqual([row['id'] for row in self.client.get(url).data['programs']], [first.program_id])
        self.client.force_authenticate(self.first[1])
        self.assertEqual(self.client.get(url).status_code, 403)
        self.client.force_authenticate(self.admin)
        empty = Institute.objects.create(name='Institute without programs', code='EMPTY')
        choices = self.client.get(url).data
        self.assertEqual({row['id'] for row in choices['institutes']}, {first.institute_id, second.institute_id, empty.id})
        framework = CompetencyFramework.objects.create(program=second.program, name='Draft library', version=1)
        draft = Assessment.objects.create(title='Unassigned scoped draft', framework=framework, created_by=self.admin)
        records = {row['id']: row for row in self.client.get(reverse('instructor_assessments')).data}
        self.assertEqual((records[draft.id]['institute_id'], records[draft.id]['program_id']),
                         (second.institute_id, second.program_id))
        self.assertEqual(records[self.first[2].id]['institute_id'], first.institute_id)

    def test_placement_history_filters_before_pagination_and_uses_recorded_batch(self):
        company = Company.objects.create(name='Shared partner')
        position = Position.objects.create(company=company, title='Shared role')
        records = [OJTPlacement.objects.create(student=student, batch=batch, company=company, position=position, status='removed')
                   for batch, student, _, _ in [self.first, self.second]]
        url = reverse('placement_history')
        params = {'institute_id': self.second[0].institute_id, 'program_id': self.second[0].program_id, 'limit': 1}
        self.assertEqual(self.client.get(url, params).data['placements'], [])
        self.client.force_authenticate(self.admin)
        result = self.client.get(url, params)
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.data['count'], 1)
        self.assertEqual([row['id'] for row in result.data['placements']], [records[1].id])
        self.assertEqual(result.data['placements'][0]['batch']['program_id'], self.second[0].program_id)

    def test_analytics_hides_unrelated_openings_but_counts_shared_occupancy(self):
        company = Company.objects.create(name='Shared partner')
        visible = Position.objects.create(company=company, title='Shared opening', slots_available=2,
                                          eligibility_configured_at=timezone.now())
        visible.eligible_programs.add(self.first[0].program, self.second[0].program)
        foreign = Position.objects.create(company=company, title='Private opening', slots_available=3,
                                          eligibility_configured_at=timezone.now())
        foreign.eligible_programs.add(self.second[0].program)
        OJTPlacement.objects.create(student=self.second[1], batch=self.second[0], position=visible, company=company,
                                    status='approved')
        url = reverse('management_analytics')
        result = self.client.get(url, {'program_id': self.first[0].program_id})
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual([row['id'] for row in result.data['capacity']], [visible.id])
        self.assertEqual(result.data['capacity'][0]['remaining'], 1)
        self.assertNotIn(self.second[1].name, str(result.data))
        self.assertEqual(self.client.get(url, {'position_id': foreign.id}).status_code, 404)
        self.assertEqual(self.client.get(url, {'program_id': self.second[0].program_id}).status_code, 404)

    def test_reports_and_protected_images_use_scope_before_lookup_and_preserve_evidence(self):
        report = reverse('management_assessment_reports')
        self.assertEqual(self.client.get(report, {'program_id': self.second[0].program_id, 'export': 'csv'}).status_code, 404)
        self.assertEqual(self.client.get(report, {'assessment_id': self.second[2].id, 'export': 'csv'}).status_code, 404)
        placements = reverse('placement_reports')
        self.assertEqual(self.client.get(placements, {'batch_id': self.second[0].id}).data['records'], [])
        self.assertEqual(self.client.get(placements, {'program_id': self.second[0].program_id}).status_code, 404)
        self.client.force_authenticate(self.admin)
        result = self.client.get(report, {'assessment_id': self.first[2].id})
        self.assertEqual([row['student_id'] for row in result.data['rows']], [self.first[1].id])

        attempt = StudentResponse.objects.create(student=self.first[1], assessment=self.first[2],
                                                  retake_image_key='retakes/' + 'b' * 32 + '.webp')
        image = reverse('retake_request_evidence', args=[self.first[2].id, self.first[1].id])
        self.client.force_authenticate(self.owner)
        with patch('api.retake_evidence.download', return_value=b'test') as storage:
            self.assertEqual(self.client.get(image).status_code, 200)
            self.first[3].is_active = False
            self.first[3].save(update_fields=['is_active'])
            self.assertEqual(self.client.get(image).status_code, 404)
            self.assertEqual(self.client.get(report, {'batch_id': self.first[0].id, 'export': 'csv'}).status_code, 404)
            storage.assert_called_once()
        attempt.refresh_from_db()
        self.assertTrue(attempt.retake_image_key)

    def test_analytics_separates_same_name_skills_and_counts_only_matching_framework(self):
        categories = {}
        for batch, student, assessment, _ in (self.first, self.second):
            framework = CompetencyFramework.objects.create(program=batch.program, name='Pilot rubric', version=1)
            batch.framework = framework
            batch.save(update_fields=['framework'])
            category = categories[student.id] = SkillCategory.objects.create(framework=framework, name='Shared name')
            assessment.framework = framework
            assessment.publication_status = Assessment.PUBLICATION_PUBLISHED
            assessment.is_required = assessment.include_in_competency = True
            assessment.save(update_fields=['framework', 'publication_status', 'is_required', 'include_in_competency'])
            StudentResponse.objects.create(student=student, assessment=assessment, status='submitted', submitted_at=timezone.now())
            SkillScore.objects.create(student=student, assessment=assessment, skill_category=category,
                                      raw_score=8, max_score=10, percentage=80)
            CombinedCompetencyProfile.objects.create(student=student, batch=batch, is_finalized=True,
                                                     included_assessment_ids=[assessment.id])
            CombinedCategoryScore.objects.create(student=student, batch=batch, skill_category=category,
                raw_score=8, max_score=10, percentage=80, source_assessment_ids=[assessment.id])

        self.client.force_authenticate(self.admin)
        url = reverse('management_analytics')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200, response.data)
        rows = response.data['skills']
        self.assertEqual({row['id'] for row in rows}, {category.id for category in categories.values()})
        self.assertEqual(len({row['framework_label'] for row in rows}), 2)
        self.assertTrue(all(row['sample'] == 1 and row['missing'] == 0 for row in rows))
        overview = self.client.get(url, {'view': 'overview', 'program_id': self.first[0].program_id})
        self.assertEqual(overview.status_code, 200)
        self.assertEqual(overview.data['skills'], [row for row in rows if row['program_id'] == self.first[0].program_id])

    def test_admin_scoped_rerun_only_processes_and_notifies_selected_cohort(self):
        url = reverse('admin_rerun_recommendations')
        self.assertEqual(self.client.post(url, {'batch_id': self.first[0].id}, format='json').status_code, 403)
        self.client.force_authenticate(self.admin)
        with patch('api.views.recalculate_combined', return_value=(None, {'all_required_completed': True}, [])) as rerun:
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.post(url, {'program_id': self.first[0].program_id}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        rerun.assert_called_once_with(self.first[1], self.first[0])
        recipients = set(ChangeEvent.objects.values_list('recipient_id', flat=True))
        self.assertEqual(recipients, {self.admin.id, self.owner.id, self.first[1].id})

    def test_queued_event_cannot_expose_ids_after_grant_revocation(self):
        batch, student, assessment, assignment = self.first
        rows = [{'payload': {'topics': ['assessments'], 'batch_ids': [batch.id], 'program_ids': [batch.program_id],
                             'student_ids': [student.id], 'assessment_ids': [assessment.id]}}]
        self.assertEqual(scoped_change(self.owner, rows)['assessment_ids'], [assessment.id])
        self.assertEqual(scoped_change(self.owner, rows)['program_ids'], [batch.program_id])
        assignment.is_active = False
        assignment.save(update_fields=['is_active'])
        event = scoped_change(self.owner, rows)
        for field in ('batch_ids', 'program_ids', 'student_ids', 'assessment_ids'):
            self.assertEqual(event[field], [])
        self.assertEqual(scoped_change(self.admin, rows)['assessment_ids'], [assessment.id])
