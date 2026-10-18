from unittest.mock import Mock, patch
from django.core.cache import cache
from django.urls import reverse
from rest_framework.test import APITestCase
from .models import Batch, BatchEnrollment, User


class AuthenticationContractTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.admin = User.objects.create_user(email='auth-admin@dnsc.edu.ph', name='Admin', role='admin', password='Synthetic-admin-pass-2026')
        self.owner = User.objects.create_user(email='auth-owner@dnsc.edu.ph', name='Instructor', role='instructor', is_approved=True)
        self.student = User.objects.create_user(email='auth-student@dnsc.edu.ph', name='Student', role='student', is_approved=True)
        self.batch = Batch.objects.create(name='Auth synthetic batch', instructor=self.owner)
        BatchEnrollment.objects.create(batch=self.batch, student=self.student)

    def login(self, actor, **extra):
        return self.client.post(reverse('login'), {'email': actor.email, 'password': 'Synthetic-admin-pass-2026', **extra}, format='json')

    def google(self, actor, *, route='google_login', identity=None, **extra):
        data = {'email': actor.email, 'name': 'Synthetic verified user', 'email_verified': True} if identity is None else identity
        with patch('api.views._google_userinfo', return_value=Mock(status_code=200, json=lambda: data)):
            return self.client.post(reverse(route), {'token': 'synthetic-provider-token', **extra}, format='json')

    def test_admin_password_only_and_no_other_role_can_use_password_login(self):
        result = self.login(self.admin)
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.data['user']['role'], 'admin')
        for actor in [self.owner, self.student]:
            actor.set_password('Synthetic-admin-pass-2026')
            actor.save(update_fields=['password'])
            self.assertEqual(self.login(actor).status_code, 403)
        self.admin.is_active = False
        self.admin.save(update_fields=['is_active'])
        self.assertEqual(self.login(self.admin).status_code, 401)

    def test_google_supported_roles_and_inactive_accounts_never_receive_tokens(self):
        for actor in [self.owner, self.student]:
            self.assertEqual(self.google(actor).status_code, 200)
            actor.is_active = False
            actor.save(update_fields=['is_active'])
            denied = self.google(actor)
            self.assertEqual(denied.status_code, 403)
            self.assertNotIn('access', denied.data)
        denied = self.google(self.admin)
        self.assertEqual(denied.status_code, 403)
        self.assertEqual(denied.data['error'], 'admin_password_required')

    def test_verified_institutional_identity_required_for_login_and_registration(self):
        for route in ['google_login', 'register_role']:
            for identity in [[], {'email': None}, {'email': self.student.email, 'email_verified': False},
                             {'email': self.student.email}, {'email': ['invalid'], 'email_verified': True}]:
                with self.subTest(route=route, identity=identity):
                    result = self.google(self.student, route=route, identity=identity, role='student')
                    self.assertIn(result.status_code, [401, 403, 503])
                    self.assertNotIn('access', result.data)
            foreign = self.google(self.student, route=route, identity={'email': 'synthetic@example.com', 'email_verified': True}, role='student')
            self.assertEqual(foreign.status_code, 403)
            self.assertEqual(foreign.data['error'], 'not_dnsc')

    def test_provider_failure_and_malformed_json_are_retryable(self):
        for route in ['google_login', 'register_role']:
            with patch('api.views._google_userinfo', return_value=Mock(status_code=200, json=Mock(side_effect=ValueError('Synthetic bad JSON')))):
                self.assertEqual(self.client.post(reverse(route), {'token': 'synthetic', 'role': 'student'}, format='json').status_code, 503)
            with patch('api.views._google_userinfo', return_value=Mock(status_code=503)):
                self.assertEqual(self.client.post(reverse(route), {'token': 'synthetic', 'role': 'student'}, format='json').status_code, 503)

    def test_pending_registration_never_escalates_existing_role_or_creates_shared_password(self):
        actor = User(email='new-instructor@dnsc.edu.ph', role='instructor')
        result = self.google(actor, route='register_role', role='instructor')
        self.assertEqual(result.status_code, 201)
        created = User.objects.get(email=actor.email)
        self.assertFalse(created.is_approved)
        self.assertFalse(created.has_usable_password())
        self.assertEqual(self.google(created).data['error'], 'pending')
        self.assertEqual(self.google(self.student, route='register_role', role='admin').status_code, 400)
        self.google(self.student, route='register_role', role='instructor')
        self.student.refresh_from_db()
        self.assertEqual(self.student.role, 'student')
        self.assertEqual(User.objects.filter(email=self.student.email).count(), 1)

    def test_bad_local_payloads_are_400_without_provider_lookup(self):
        with patch('api.views._google_userinfo') as provider:
            for route, payload in [('login', {'email': [], 'password': 'x'}), ('login', {'email': 'x', 'password': {}}),
                                   ('google_login', {'token': []}), ('register_role', {'token': 'synthetic', 'role': None})]:
                self.assertEqual(self.client.post(reverse(route), payload, format='json').status_code, 400)
            provider.assert_not_called()

    def test_admin_onboarding_creates_google_only_instructor_and_truthful_notification(self):
        self.client.force_authenticate(self.admin)
        payload = {'email': 'added-staff@dnsc.edu.ph', 'name': 'Synthetic Faculty', 'instructor_id': 'SYNTH-F001'}
        with patch('api.views.send_instructor_email', return_value=True):
            result = self.client.post(reverse('admin_instructors'), payload, format='json')
        self.assertEqual(result.status_code, 201)
        self.assertTrue(result.data['email_queued'])
        self.assertFalse(result.data['email_sent'])
        actor = User.objects.get(pk=result.data['id'])
        self.assertTrue(actor.is_approved)
        self.assertFalse(actor.has_usable_password())
        self.client.force_authenticate(None)
        self.assertEqual(self.google(actor).status_code, 200)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.post(reverse('admin_instructors'), payload, format='json').status_code, 409)
        for field in ['email', 'name', 'instructor_id', 'department', 'courses']:
            self.assertEqual(self.client.post(reverse('admin_instructors'), {**payload, field: []}, format='json').status_code, 400)
        self.assertEqual(User.objects.filter(email=payload['email']).count(), 1)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.post(reverse('admin_instructors'), payload, format='json').status_code, 403)
