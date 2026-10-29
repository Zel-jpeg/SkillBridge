from unittest.mock import Mock, patch

import requests
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from api.models import Batch, BatchEnrollment, User


@override_settings(SECURE_SSL_REDIRECT=False)
class GoogleDeadlineTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    @patch('api.views.http_requests.get', side_effect=requests.Timeout('synthetic timeout'))
    def test_external_timeout_is_retryable_and_does_not_become_invalid_credentials(self, get):
        for path, payload in [('/api/auth/google/', {'token': 'synthetic'}),
                              ('/api/auth/register-role/', {'token': 'synthetic', 'role': 'student'})]:
            response = self.client.post(path, payload, format='json')
            self.assertEqual(response.status_code, 503)
            self.assertIn('temporarily unavailable', response.data['error'])
        self.assertEqual(get.call_args.kwargs['timeout'], (3.05, 10))

    @patch('api.views.http_requests.get', return_value=Mock(status_code=401))
    def test_invalid_google_token_remains_unauthorized(self, get):
        response = self.client.post('/api/auth/google/', {'token': 'synthetic'}, format='json')
        self.assertEqual(response.status_code, 401)
        self.assertEqual(get.call_args.kwargs['timeout'], (3.05, 10))

    @patch('api.views.http_requests.get')
    def test_missing_token_never_contacts_google(self, get):
        self.assertEqual(self.client.post('/api/auth/google/', {}, format='json').status_code, 400)
        get.assert_not_called()


@override_settings(SECURE_SSL_REDIRECT=False)
class GoogleAccessTests(TestCase):
    @patch('api.views.http_requests.get')
    def test_role_approval_and_enrollment_gates_are_preserved(self, get):
        client = APIClient()
        instructor = User.objects.create_user('staff.synthetic@dnsc.edu.ph', role='instructor', is_approved=True)
        batch = Batch.objects.create(name='Synthetic cohort', instructor=instructor)
        cases = [('admin', True, False, 403, 'admin_password_required'),
                 ('instructor', True, False, 200, None),
                 ('instructor', False, False, 403, 'pending'),
                 ('student', False, True, 403, 'student_pending'),
                 ('student', True, False, 403, 'student_not_enrolled'),
                 ('student', True, True, 200, None)]
        for index, (role, approved, enrolled, code, error) in enumerate(cases):
            with self.subTest(role=role, approved=approved, enrolled=enrolled):
                user = User.objects.create_user(f'case{index}.synthetic@dnsc.edu.ph', role=role, is_approved=approved)
                if enrolled:
                    BatchEnrollment.objects.create(student=user, batch=batch)
                get.return_value = Mock(status_code=200)
                get.return_value.json.return_value = {'email': user.email, 'name': 'Synthetic user', 'email_verified': True, 'hd': 'dnsc.edu.ph', 'aud': 'synthetic-skillbridge-client.apps.googleusercontent.com', 'expires_in': '3600'}
                response = client.post('/api/auth/google/', {'token': 'synthetic'}, format='json')
                self.assertEqual(response.status_code, code)
                if error:
                    self.assertEqual(response.data['error'], error)
                    self.assertNotIn('access', response.data)
                else:
                    self.assertEqual(response.data['user']['role'], role)
                    self.assertIn('access', response.data)
