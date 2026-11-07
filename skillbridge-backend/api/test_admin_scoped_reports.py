from django.urls import reverse
from rest_framework.test import APITestCase
from .models import Batch, BatchEnrollment, Institute, InstructorAssignment, Program, User


class AdminReportOrganizationTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email='report-admin@example.invalid', role='admin')
        self.owner = User.objects.create_user(email='report-owner@example.invalid', role='instructor', is_approved=True)
        self.institute = Institute.objects.create(name='Configured institute', code='CONFIG')
        self.empty = Institute.objects.create(name='Empty archived institute', code='EMPTY', is_active=False)
        self.program = Program.objects.create(institute=self.institute, name='Configured program', code='PROGRAM')
        self.empty_program = Program.objects.create(institute=self.empty, name='Empty archived program', code='EMPTY', is_active=False)
        InstructorAssignment.objects.create(instructor=self.owner, program=self.program)
        self.batch = Batch.objects.create(instructor=self.owner, institute=self.institute, program=self.program, name='Owned report batch')
        student = User.objects.create_user(email='report-student@example.invalid', role='student')
        BatchEnrollment.objects.create(batch=self.batch, student=student)
        self.url = reverse('management_analytics')
        self.client.force_authenticate(self.admin)

    def test_admin_empty_saved_scope_has_correct_choices_and_zero_cohort(self):
        response = self.client.get(self.url, {'institute_id': self.empty.id, 'program_id': self.empty_program.id})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['summary']['students'], 0)
        self.assertEqual(response.data['scope']['batch_ids'], [])
        self.assertEqual(response.data['scope']['institute_id'], self.empty.id)
        self.assertIn({'id': self.empty.id, 'name': self.empty.name, 'code': self.empty.code, 'is_active': False}, response.data['options']['institutes'])
        self.assertIn(self.empty_program.id, [row['id'] for row in response.data['options']['programs']])

    def test_invalid_and_mismatched_organizations_do_not_fall_back_to_school(self):
        for params, status in [({'institute_id': 999999}, 404), ({'program_id': 999999}, 404),
                               ({'institute_id': self.institute.id, 'program_id': self.empty_program.id}, 400)]:
            response = self.client.get(self.url, params)
            self.assertEqual(response.status_code, status)
            self.assertNotIn('students', response.data)
        self.assertEqual(self.client.get(self.url, {'program_id': self.program.id}).data['summary']['students'], 1)

    def test_instructor_choices_and_direct_scope_stay_inside_owned_batches(self):
        self.client.force_authenticate(self.owner)
        response = self.client.get(self.url)
        self.assertEqual([row['id'] for row in response.data['options']['institutes']], [self.institute.id])
        self.assertEqual([row['id'] for row in response.data['options']['programs']], [self.program.id])
        self.assertEqual(self.client.get(self.url, {'institute_id': self.empty.id}).status_code, 404)
