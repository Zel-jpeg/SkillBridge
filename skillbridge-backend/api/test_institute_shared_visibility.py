from unittest.mock import patch
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase
from .models import (Assessment, AssessmentAttemptHistory, Batch, BatchEnrollment, Company,
    Institute, InstructorAssignment, OJTPlacement, Position, Program, StudentResponse, User)
from .retake_requests import request_snapshot


class InstituteSharedVisibilityTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email='shared-admin@example.invalid', role='admin')
        self.owner = User.objects.create_user(email='shared-owner@example.invalid', role='instructor', is_approved=True)
        self.other = User.objects.create_user(email='shared-other@example.invalid', role='instructor', is_approved=True)
        self.institute = Institute.objects.create(code='ANY', name='Any configured institute')
        self.foreign = Institute.objects.create(code='OTHER', name='Other institute')
        self.first = Program.objects.create(institute=self.institute, code='FIRST', name='First program')
        self.second = Program.objects.create(institute=self.institute, code='SECOND', name='Second program')
        for program in (self.first, self.second):
            InstructorAssignment.objects.create(instructor=self.owner, program=program)
        company = Company.objects.create(name='Shared synthetic partner')
        self.position = Position.objects.create(company=company, title='Shared role', slots_available=8)
        self.batches, self.students = {}, {}
        for name, institute, program, owner, programs in [
            ('first', self.institute, self.first, self.owner, [self.first]),
            ('second', self.institute, self.second, self.owner, [self.second]),
            ('shared', self.institute, None, self.owner, [self.first, self.second]),
            ('other-owner', self.institute, None, self.other, [self.first]),
            ('foreign', self.foreign, None, self.owner, [None]),
            ('unassigned', None, None, self.owner, [None])]:
            batch = Batch.objects.create(name=f'{name} cohort', institute=institute, program=program, instructor=owner)
            self.batches[name] = batch
            assessment = Assessment.objects.create(title=f'{name} assessment', batch=batch, created_by=owner)
            self.students[name] = []
            for i, student_program in enumerate(programs):
                student = User.objects.create_user(email=f'shared-{name}-{i}@example.invalid', name=f'{name} learner {i}', role='student', program=student_program)
                self.students[name].append(student)
                BatchEnrollment.objects.create(batch=batch, student=student)
                attempt = StudentResponse.objects.create(student=student, assessment=assessment, started_at=timezone.now(),
                    status='stopped', retake_request_status='pending', retake_requested_at=timezone.now())
                AssessmentAttemptHistory.objects.create(response=attempt, attempt_number=1, started_at=attempt.started_at,
                    status='stopped', retake_request=request_snapshot(attempt))
                OJTPlacement.objects.create(student=student, batch=batch, company=company, position=self.position, status='removed')
        self.scope = {'institute_id': self.institute.id, 'program_id': self.first.id}
        self.client.force_authenticate(self.admin)

    def test_program_analytics_includes_full_shared_rosters_without_sibling_or_foreign_batches(self):
        with patch('api.combined_competency.recalculate_combined', side_effect=AssertionError('Read must not recalculate')):
            data = self.client.get(reverse('management_analytics'), self.scope).data
        self.assertEqual(set(data['scope']['batch_ids']), {self.batches[name].id for name in ('first', 'shared', 'other-owner')})
        self.assertEqual(set(data['scope']['shared_batch_ids']), {self.batches[name].id for name in ('shared', 'other-owner')})
        self.assertEqual(data['summary']['students'], 4)
        self.assertTrue({student.id for student in self.students['shared']}.issubset({row['id'] for row in data['students']}))
        other = self.client.get(reverse('management_analytics'), {'program_id': self.second.id}).data
        self.assertEqual(other['summary']['students'], 4)
        institute = self.client.get(reverse('management_analytics'), {'institute_id': self.institute.id}).data
        self.assertEqual(institute['summary']['students'], 5)
        self.batches['shared'].refresh_from_db()
        self.assertIsNone(self.batches['shared'].program_id)
        self.assertEqual(self.batches['shared'].enrollments.count(), 2)
        self.assertEqual(self.position.eligible_programs.count(), 0)

    def test_current_history_and_assessment_exports_use_same_recorded_shared_scope(self):
        for status in ('pending', 'history'):
            response = self.client.get(reverse('retake_request_queue'), {**self.scope, 'status': status})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data['count'], 4)
            self.assertEqual({row['batch_id'] for row in response.data['results']}, {self.batches[name].id for name in ('first', 'shared', 'other-owner')})
        report = self.client.get(reverse('management_assessment_reports'), {**self.scope, 'type': 'student_competency', 'export': 'csv'})
        self.assertEqual(report.status_code, 200)
        self.assertIn(b'shared learner 1', report.content)
        self.assertIn(b'institute-shared batches with full rosters', report.content)
        self.assertNotIn(b'second learner 0', report.content)
        self.assertNotIn(b'foreign learner 0', report.content)

    def test_placement_history_and_reports_match_and_instructor_ownership_is_retained(self):
        for name, key in [('placement_history', 'placements'), ('placement_reports', 'records')]:
            response = self.client.get(reverse(name), self.scope)
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual(len(response.data[key]), 4)
            if name == 'placement_reports':
                self.assertIn('full rosters', response.data['scope_note'])
        self.client.force_authenticate(self.owner)
        analytics = self.client.get(reverse('management_analytics'), self.scope)
        self.assertEqual(analytics.status_code, 200)
        self.assertEqual(analytics.data['summary']['students'], 3)
        self.assertNotIn(self.batches['other-owner'].id, analytics.data['scope']['batch_ids'])
        self.assertEqual(self.client.get(reverse('retake_request_queue'), self.scope).data['count'], 3)
        self.assertEqual(len(self.client.get(reverse('placement_reports'), self.scope).data['records']), 3)
        self.client.force_authenticate(self.students['shared'][0])
        self.assertEqual(self.client.get(reverse('management_analytics'), self.scope).status_code, 403)

    def test_archived_shared_batch_stays_in_archived_scope_and_active_queue_excludes_it(self):
        batch = self.batches['shared']
        batch.status = 'archived'
        batch.save(update_fields=['status'])
        archived = self.client.get(reverse('management_analytics'), {**self.scope, 'batch_status': 'archived'}).data
        self.assertEqual(archived['scope']['batch_ids'], [batch.id])
        self.assertEqual(archived['summary']['students'], 2)
        self.assertEqual(self.client.get(reverse('retake_request_queue'), {**self.scope, 'active_batches': '1'}).data['count'], 2)
