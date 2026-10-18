from datetime import timedelta
from unittest.mock import patch
from django.db import OperationalError
from django.core.cache import cache
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken
from .models import User, Batch, BatchEnrollment


class SessionRenewalTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.admin = User.objects.create_user(email='renew-admin@example.com', role='admin', name='Synthetic Admin', password='Synthetic-renewal-pass-2026')
        self.owner = User.objects.create_user(email='renew-owner@example.com', role='instructor', name='Synthetic Owner', is_approved=True)
        self.student = User.objects.create_user(email='renew-student@example.com', role='student', name='Synthetic Student', is_approved=True)
        self.batch = Batch.objects.create(name='Renewal fixture', instructor=self.owner)
        BatchEnrollment.objects.create(student=self.student, batch=self.batch)

    def renew(self, token):
        return self.client.post(reverse('refresh'), {'refresh': str(token)}, format='json')

    def test_expired_access_is_rejected_then_valid_refresh_restores_access(self):
        token = RefreshToken.for_user(self.admin)
        expired = token.access_token
        expired.set_exp(from_time=timezone.now() - timedelta(seconds=2), lifetime=timedelta(seconds=1))
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + str(expired))
        self.assertEqual(self.client.get(reverse('me')).status_code, 401)
        self.client.credentials()
        result = self.renew(token)
        self.assertEqual(result.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + result.data['access'])
        self.assertEqual(self.client.get(reverse('me')).status_code, 200)

    def test_expired_malformed_inactive_and_password_revoked_refresh_fail(self):
        expired = RefreshToken.for_user(self.admin)
        expired.set_exp(from_time=timezone.now() - timedelta(seconds=2), lifetime=timedelta(seconds=1))
        self.assertEqual(self.renew(expired).status_code, 401)
        self.assertEqual(self.renew('malformed').status_code, 401)
        token = RefreshToken.for_user(self.admin)
        self.admin.is_active = False
        self.admin.save(update_fields=['is_active'])
        self.assertEqual(self.renew(token).status_code, 401)
        self.admin.is_active = True
        self.admin.set_password('New-synthetic-admin-password-2026')
        self.admin.save(update_fields=['is_active', 'password'])
        self.assertEqual(self.renew(token).status_code, 401)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + str(token.access_token))
        self.assertEqual(self.client.get(reverse('me')).status_code, 401)
        self.assertEqual(self.client.get(reverse('admin_events'), {'token': str(token.access_token), 'check': '1'}).status_code, 401)

    def test_approval_or_enrollment_revocation_prevents_renewal(self):
        for actor in [self.student, self.owner]:
            token = RefreshToken.for_user(actor)
            self.assertEqual(self.renew(token).status_code, 200)
            actor.is_approved = False
            actor.save(update_fields=['is_approved'])
            self.assertEqual(self.renew(token).status_code, 401)
        self.student.is_approved = True
        self.student.save(update_fields=['is_approved'])
        BatchEnrollment.objects.filter(student=self.student).delete()
        self.assertEqual(self.renew(RefreshToken.for_user(self.student)).status_code, 401)

    def test_access_cannot_extend_fixed_seven_day_refresh_boundary(self):
        token = RefreshToken.for_user(self.admin)
        self.assertEqual(token['exp'] - token['iat'], 7 * 24 * 60 * 60)
        token.set_exp(lifetime=timedelta(seconds=30))
        result = self.renew(token)
        self.assertEqual(result.status_code, 200)
        access = AccessToken(result.data['access'])
        self.assertEqual(access['exp'], token['exp'])
        self.assertNotIn('refresh', result.data)

    def test_refresh_payload_shape_does_not_crash(self):
        for payload in [[], {}, {'refresh': []}, {'refresh': None}]:
            self.assertEqual(self.client.post(reverse('refresh'), payload, format='json').status_code, 400)

    def test_database_outage_is_retryable_not_false_credential_expiry(self):
        token = RefreshToken.for_user(self.admin)
        with patch('rest_framework_simplejwt.authentication.JWTAuthentication.get_user', side_effect=OperationalError('Synthetic database outage')):
            result = self.renew(token)
        self.assertEqual(result.status_code, 503)
        self.assertIn('temporarily unavailable', result.data['error'])
