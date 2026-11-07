from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase
from .models import Assessment, AssessmentAttemptHistory, Batch, BatchEnrollment, Institute, InstructorAssignment, Program, StudentResponse, User
from .retake_requests import request_snapshot


class SchoolDashboardTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email='school-admin@example.invalid', role='admin')
        self.owner = User.objects.create_user(email='school-owner@example.invalid', role='instructor', is_approved=True)
        User.objects.create_user(email='school-pending@example.invalid', role='instructor', is_approved=False)
        self.ic = Institute.objects.create(code='IC', name='Computing')
        self.ibpa = Institute.objects.create(code='IBPA', name='Business')
        self.it = Program.objects.create(institute=self.ic, code='IT', name='Technology')
        self.tour = Program.objects.create(institute=self.ibpa, code='TOUR', name='Tourism')
        for program in (self.it, self.tour):
            InstructorAssignment.objects.create(instructor=self.owner, program=program)
        self.first = Batch.objects.create(instructor=self.owner, name='First program batch', institute=self.ic, program=self.it)
        self.second = Batch.objects.create(instructor=self.owner, name='Second program batch', institute=self.ibpa, program=self.tour)
        self.shared = Batch.objects.create(instructor=self.owner, name='Shared IC batch', institute=self.ic)
        self.empty = Batch.objects.create(instructor=self.owner, name='Empty IC batch', institute=self.ic, program=self.it)
        self.archived = Batch.objects.create(instructor=self.owner, name='Archived IC batch', institute=self.ic, program=self.it, status='archived')
        self.assessment = Assessment.objects.create(title='Required work', batch=self.first, created_by=self.owner, publication_status='published', is_required=True, include_in_competency=True)
        old = Assessment.objects.create(title='Archived work', batch=self.archived, created_by=self.owner)
        student = User.objects.create_user(email='school-multi@example.invalid', role='student', is_approved=True)
        BatchEnrollment.objects.create(batch=self.first, student=student)
        BatchEnrollment.objects.create(batch=self.second, student=student)
        self.response = self.pending(student, self.assessment)
        shared_student = User.objects.create_user(email='school-shared@example.invalid', role='student', is_approved=True)
        BatchEnrollment.objects.create(batch=self.shared, student=shared_student)
        for name, active, enrolled, assessment in [('archived', True, True, old), ('unenrolled', True, False, self.assessment), ('inactive', False, True, self.assessment)]:
            person = User.objects.create_user(email=f'school-{name}@example.invalid', role='student', is_approved=True, is_active=active)
            if enrolled:
                BatchEnrollment.objects.create(batch=assessment.batch, student=person)
            self.pending(person, assessment)
        self.client.force_authenticate(self.admin)

    def pending(self, student, assessment):
        return StudentResponse.objects.create(student=student, assessment=assessment, status='stopped', started_at=timezone.now(), retake_request_status='pending', retake_requested_at=timezone.now())

    def test_distinct_cohort_attention_and_retakes_use_recorded_batch_scope(self):
        response = self.client.get(reverse('management_analytics'))
        self.assertEqual(response.status_code, 200)
        data = response.data
        self.assertEqual(data['summary']['students'], 2)
        self.assertEqual(data['summary']['pending_instructors'], 1)
        attention = data['dashboard_attention']
        self.assertEqual(attention['pending_retakes'], 1)
        self.assertEqual(attention['retake_scopes'], [{'institute_id': self.ic.id, 'program_id': self.it.id, 'count': 1}])
        self.assertEqual(set(attention['batches_without_required']), {self.second.id, self.shared.id, self.empty.id})
        queue = self.client.get(reverse('retake_request_queue'), {'institute_id': self.ic.id, 'program_id': self.it.id, 'active_batches': '1'})
        self.assertEqual(queue.data['count'], attention['pending_retakes'])
        self.assertEqual(queue.data['results'][0]['id'], self.response.id)

    def test_archived_scope_has_no_active_followup_and_instructors_get_no_admin_attention(self):
        response = self.client.get(reverse('management_analytics'), {'batch_status': 'archived'})
        self.assertEqual(response.data['dashboard_attention']['pending_retakes'], 0)
        self.assertEqual(response.data['dashboard_attention']['batches_without_required'], [])
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.get(reverse('management_analytics')).data['dashboard_attention'], {})
        other = User.objects.create_user(email='school-other@example.invalid', role='instructor', is_approved=True)
        self.client.force_authenticate(other)
        self.assertEqual(self.client.get(reverse('retake_request_queue'), {'active_batches': '1'}).data['count'], 0)

    def test_retakes_validate_active_filter_and_keep_unfiltered_records(self):
        self.assertEqual(self.client.get(reverse('retake_request_queue'), {'active_batches': 'invalid'}).status_code, 400)
        self.assertEqual(self.client.get(reverse('retake_request_queue')).data['count'], 4)
        for response in StudentResponse.objects.all():
            AssessmentAttemptHistory.objects.create(response=response, attempt_number=1, started_at=response.started_at,
                status='stopped', retake_request=request_snapshot(response))
        history = self.client.get(reverse('retake_request_queue'), {'status': 'history', 'active_batches': '1'})
        self.assertEqual(history.status_code, 200)
        self.assertEqual(history.data['count'], 1)
