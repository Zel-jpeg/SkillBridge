"""Admin navigation read scopes must filter requests before counting/paging."""
from django.urls import reverse
from unittest.mock import patch
from django.utils import timezone
from rest_framework.test import APITestCase
from .models import (Assessment, AssessmentAttemptHistory, Batch, Company,
                     Institute, InstructorAssignment, Program, StudentResponse, User)
from .retake_requests import request_snapshot


class AdminNavigationScopeTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email='nav-admin@example.invalid', role='admin')
        self.owner = User.objects.create_user(email='nav-owner@example.invalid', role='instructor', is_approved=True)
        self.other = User.objects.create_user(email='nav-other@example.invalid', role='instructor', is_approved=True)
        self.ic = Institute.objects.create(code='IC', name='Institute of Computing')
        self.ibpa = Institute.objects.create(code='IBPA', name='Business and Public Affairs')
        self.it = Program.objects.create(institute=self.ic, code='IT', name='Information Technology')
        self.tourism = Program.objects.create(institute=self.ibpa, code='TOUR', name='Tourism')
        self.responses = []
        for program, institute in [(self.it, self.ic), (self.tourism, self.ibpa), (None, self.ic)]:
            batch = Batch.objects.create(name='Synthetic batch', instructor=self.owner, program=program, institute=institute)
            if program:
                InstructorAssignment.objects.create(instructor=self.owner, program=program)
            assessment = Assessment.objects.create(title='Synthetic assessment', batch=batch, created_by=self.owner)
            for index in range(9 if program == self.tourism else 1):
                student = User.objects.create_user(email=f'nav-{len(self.responses)}@example.invalid', role='student')
                row = StudentResponse.objects.create(student=student, assessment=assessment, status='stopped', started_at=timezone.now(),
                    retake_request_status='pending', retake_requested_at=timezone.now())
                AssessmentAttemptHistory.objects.create(response=row, attempt_number=1, started_at=row.started_at,
                    status='stopped', retake_request=request_snapshot(row))
                self.responses.append(row)
        self.client.force_authenticate(self.admin)
        self.url = reverse('retake_request_queue')

    def test_current_and_history_scope_before_pagination_with_context(self):
        for status in ('pending', 'history'):
            with self.subTest(status=status):
                result = self.client.get(self.url, {'institute_id': self.ibpa.id, 'program_id': self.tourism.id, 'status': status, 'page': 2})
                self.assertEqual(result.status_code, 200)
                self.assertEqual(result.data['count'], 9)
                self.assertEqual(len(result.data['results']), 1)
                row = result.data['results'][0]
                self.assertEqual(row['institute_id'], self.ibpa.id)
                self.assertEqual(row['program']['id'], self.tourism.id)
                self.assertEqual(row['program']['institute_code'], 'IBPA')
                self.assertIsNotNone(row['batch_id'])
        shared = self.client.get(self.url, {'institute_id': self.ic.id})
        self.assertEqual(shared.data['count'], 2)
        self.assertEqual(sum(row['program'] is None for row in shared.data['results']), 1)
        mismatch = self.client.get(self.url, {'institute_id': self.ic.id, 'program_id': self.tourism.id})
        self.assertEqual(mismatch.data['count'], 0)

    def test_scope_does_not_expand_instructor_or_student_access(self):
        self.client.force_authenticate(self.other)
        for status in ('pending', 'history'):
            self.assertEqual(self.client.get(self.url, {'program_id': self.tourism.id, 'status': status}).data['count'], 0)
        self.client.force_authenticate(self.responses[0].student)
        self.assertEqual(self.client.get(self.url, {'program_id': self.tourism.id}).status_code, 403)

    def test_invalid_scope_is_rejected(self):
        for field in ('program_id', 'institute_id'):
            for value in ('-1', 'invalid', '0'):
                self.assertEqual(self.client.get(self.url, {field: value}).status_code, 400)

    def test_admin_new_partner_can_record_selected_program_without_reassigning_existing(self):
        original = Company.objects.create(name='Original IC partner')
        result = self.client.post('/api/admin/companies/', {'name': 'New scoped partner', 'management_program_id': self.tourism.id}, format='json')
        self.assertEqual(result.status_code, 201)
        self.assertEqual(result.data['management_program_id'], self.tourism.id)
        original.refresh_from_db()
        self.assertIsNone(original.management_program_id)
        for invalid in (True, -1, 'invalid'):
            self.assertEqual(self.client.post('/api/admin/companies/', {'name': 'Invalid partner', 'management_program_id': invalid}, format='json').status_code, 400)
        self.tourism.is_active = False
        self.tourism.save(update_fields=['is_active'])
        self.assertEqual(self.client.post('/api/admin/companies/', {'name': 'Inactive program partner', 'management_program_id': self.tourism.id}, format='json').status_code, 404)

    def test_program_is_rechecked_after_image_preparation_before_partner_save(self):
        def archive_during_preparation():
            Program.objects.filter(pk=self.tourism.pk).update(is_active=False)
            return image_change.return_value

        with patch('api.views.CompanyImageChange') as image_change:
            image_change.return_value.__enter__.side_effect = archive_during_preparation
            image_change.return_value.__exit__.return_value = False
            result = self.client.post('/api/admin/companies/', {
                'name': 'Partner whose program changed', 'management_program_id': self.tourism.pk,
            }, format='json')
            self.assertEqual(result.status_code, 404)
            image_change.return_value.save.assert_not_called()
        self.assertFalse(Company.objects.filter(name='Partner whose program changed').exists())
