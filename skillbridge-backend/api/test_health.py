"""Probe availability without leaking credentials or accepting mutations."""
from unittest.mock import patch
from django.db import OperationalError
from django.urls import reverse
from rest_framework.test import APITestCase


class ReadinessTests(APITestCase):
    def test_public_probe_checks_database_and_never_caches_healthy_status(self):
        response = self.client.get(reverse('health'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'ok'})
        self.assertEqual(response['Cache-Control'], 'no-store')

    def test_expired_or_invalid_identity_does_not_disable_infrastructure_probe(self):
        response = self.client.get(reverse('health'), HTTP_AUTHORIZATION='Bearer synthetic-invalid')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'ok'})

    def test_unavailable_database_returns_safe_retryable_status_and_log(self):
        with patch('api.health.connection.cursor', side_effect=OperationalError('synthetic-secret-host-password')):
            with self.assertLogs('api.health', level='WARNING') as captured:
                response = self.client.get(reverse('health'))
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {'status': 'unavailable'})
        self.assertEqual(response['Cache-Control'], 'no-store')
        self.assertNotIn('synthetic-secret', '\n'.join(captured.output))

    def test_head_has_no_body_and_mutating_methods_are_rejected(self):
        response = self.client.head(reverse('health'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b'')
        self.assertEqual(self.client.post(reverse('health'), {}, format='json').status_code, 405)
