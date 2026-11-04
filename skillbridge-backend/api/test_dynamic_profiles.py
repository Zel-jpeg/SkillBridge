"""Configured profile context, neutral onboarding, and immutable student programs."""
from unittest.mock import patch
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from .models import Batch, BatchEnrollment, EmailNotice, Institute, InstructorAssignment, Program, User


class DynamicProfileTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user('dynamic-admin@dnsc.edu.ph', role='admin')
        self.teacher = User.objects.create_user('dynamic-teacher@dnsc.edu.ph', role='instructor', is_approved=True)
        institute = Institute.objects.create(code='ANY', name='Any Institute')
        self.program = Program.objects.create(institute=institute, code='CUSTOM', name='Custom Degree', aliases=['Alternate Degree'])
        self.student = User.objects.create_user('dynamic-student@dnsc.edu.ph', role='student', school_id='2099-00001',
            course='CUSTOM', program=self.program, is_approved=True)
        self.client.force_authenticate(self.admin)

    def create(self, **changes):
        return self.client.post(reverse('admin_instructors'), {'name': 'Synthetic New Teacher',
            'email': 'dynamic-new@dnsc.edu.ph', 'instructor_id': 'DYN-NEW', **changes}, format='json')

    def test_new_unassigned_account_is_neutral_and_never_gets_implicit_program_access(self):
        result = self.create()
        self.assertEqual(result.status_code, 201, result.data)
        created = User.objects.get(pk=result.data['id'])
        self.assertEqual((created.department, created.course), ('', ''))
        self.assertEqual(result.data['assigned_programs'], [])
        self.assertFalse(InstructorAssignment.objects.filter(instructor=created).exists())

    def test_optional_program_creates_a_real_grant_and_derives_descriptive_fields(self):
        result = self.create(program_id=self.program.id, department='Untrusted label', courses='Other degree')
        self.assertEqual(result.status_code, 201, result.data)
        created = User.objects.get(pk=result.data['id'])
        self.assertEqual((created.department, created.course), (self.program.institute.name, self.program.code))
        self.assertTrue(InstructorAssignment.objects.filter(instructor=created, program=self.program, is_active=True).exists())
        self.assertEqual(result.data['assigned_programs'][0]['id'], self.program.id)

    def test_bad_program_or_archived_catalog_creates_nothing(self):
        for value in [None, True, [], '1', 0]:
            self.assertEqual(self.create(program_id=value).status_code, 400)
        self.program.is_active = False
        self.program.save(update_fields=['is_active'])
        self.assertEqual(self.create(program_id=self.program.id).status_code, 404)
        self.assertFalse(User.objects.filter(email='dynamic-new@dnsc.edu.ph').exists())
        self.assertFalse(EmailNotice.objects.exists())

    def test_grant_audit_failure_rolls_back_account_assignment_and_notice(self):
        with patch('api.views.record_action', side_effect=RuntimeError('Synthetic audit failure')):
            with self.assertRaises(RuntimeError):
                self.create(program_id=self.program.id)
        self.assertFalse(User.objects.filter(email='dynamic-new@dnsc.edu.ph').exists())
        self.assertFalse(InstructorAssignment.objects.exists())
        self.assertFalse(EmailNotice.objects.exists())

    def test_instructor_and_student_cannot_create_a_program_assigned_account(self):
        for actor in [self.teacher, self.student]:
            self.client.force_authenticate(actor)
            self.assertEqual(self.create(program_id=self.program.id).status_code, 403)

    def test_own_identity_reflects_current_assignment_without_new_jwt(self):
        self.client.force_authenticate(None)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + str(AccessToken.for_user(self.teacher)))
        grant = InstructorAssignment.objects.create(instructor=self.teacher, program=self.program)
        self.assertEqual(self.client.get(reverse('me')).data['assigned_programs'][0]['id'], self.program.id)
        grant.is_active = False
        grant.save(update_fields=['is_active'])
        self.assertEqual(self.client.get(reverse('me')).data['assigned_programs'], [])

    def test_all_program_codes_are_filterable_even_outside_the_current_page(self):
        User.objects.create_user('dynamic-second@dnsc.edu.ph', role='student', course='SECOND', is_approved=True)
        result = self.client.get('/api/admin/users/?tab=students&page=1&page_size=1')
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(result.data['options']['courses'], ['CUSTOM', 'SECOND'])
        filtered = self.client.get('/api/admin/users/?tab=students&course=SECOND&page=1&page_size=1')
        self.assertEqual(filtered.data['pagination']['count'], 1)
        self.assertEqual(filtered.data['students'][0]['course'], 'SECOND')

    def test_program_profile_accepts_alias_but_rejects_self_transfer_without_partial_save(self):
        self.client.force_authenticate(self.student)
        url = reverse('student_profile')
        self.assertEqual(self.client.patch(url, {'course': 'Alternate Degree'}, format='json').status_code, 200)
        for data in [{'course': 'OTHER'}, {'program_id': self.program.id}, {'institute_id': self.program.institute_id}]:
            result = self.client.patch(url, {'name': 'Must not save', **data}, format='json')
            self.assertEqual(result.status_code, 400)
        self.student.refresh_from_db()
        self.assertNotEqual(self.student.name, 'Must not save')
        self.assertEqual(self.student.program_id, self.program.id)

    def test_unmapped_ic_and_arbitrary_legacy_students_cannot_self_transfer(self):
        for code, alternate in [('BSIT', 'BSIS'), ('ARBITRARY', 'CUSTOM')]:
            User.objects.filter(pk=self.student.id).update(program=None, course=code)
            self.student.refresh_from_db()
            self.client.force_authenticate(self.student)
            denied = self.client.patch(reverse('student_profile'), {'course': alternate}, format='json')
            self.assertEqual(denied.status_code, 400)
            saved = self.client.patch(reverse('student_profile'), {'course': code, 'phone': '09000000401'}, format='json')
            self.assertEqual(saved.status_code, 200, saved.data)
        self.student.refresh_from_db()
        self.assertIsNone(self.student.program_id)

    def test_descriptive_account_fields_can_be_cleared_without_creating_or_revoking_a_grant(self):
        grant = InstructorAssignment.objects.create(instructor=self.teacher, program=self.program)
        result = self.client.patch(f'/api/admin/users/{self.teacher.id}/', {'department': '', 'courses': ''}, format='json')
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(result.data['assigned_programs'][0]['id'], self.program.id)
        grant.refresh_from_db()
        self.assertTrue(grant.is_active)
