"""Synthetic provider/config checks; no real OAuth tokens or provider requests."""
from unittest.mock import Mock, patch
from unittest import skipUnless
import json
import os
import subprocess
import sys

import requests
from django.conf import settings
from django.db import connection
from django.test import SimpleTestCase, override_settings
from rest_framework.test import APITestCase

from .views import _google_userinfo, _verified_google_identity


class GoogleTokenBindingTests(SimpleTestCase):
    def metadata(self, **changes):
        return {'aud': settings.GOOGLE_OAUTH_CLIENT_ID, 'expires_in': '3600', **changes}

    @patch('api.views.http_requests.get')
    def test_valid_client_token_uses_bounded_google_calls(self, get):
        identity = Mock(status_code=200)
        get.side_effect = [Mock(status_code=200, json=lambda: self.metadata()), identity]
        self.assertIs(_google_userinfo('synthetic-token'), identity)
        self.assertEqual(get.call_count, 2)
        self.assertEqual(get.call_args_list[0].kwargs['params'], {'access_token': 'synthetic-token'})
        self.assertEqual(get.call_args_list[1].kwargs['headers']['Authorization'], 'Bearer synthetic-token')
        for call in get.call_args_list:
            self.assertEqual(call.kwargs['timeout'], (3.05, 10))
            self.assertFalse(call.kwargs['allow_redirects'])

    @patch('api.views.http_requests.get')
    def test_foreign_missing_conflicting_and_expired_tokens_never_fetch_identity(self, get):
        for changes in ({'aud': 'other-client'}, {'aud': None}, {'azp': 'other-client'},
                        {'expires_in': '0'}, {'expires_in': -1}, {'expires_in': True},
                        {'expires_in': 'bad'}, {'expires_in': None}):
            with self.subTest(changes=changes):
                get.reset_mock()
                get.side_effect = None
                get.return_value = Mock(status_code=200, json=lambda: self.metadata(**changes))
                self.assertEqual(_google_userinfo('synthetic-token').status_code, 401)
                self.assertEqual(get.call_count, 1)

    @override_settings(GOOGLE_OAUTH_CLIENT_ID='')
    @patch('api.views.http_requests.get')
    def test_unconfigured_client_fails_closed_without_provider_io(self, get):
        self.assertIsNone(_google_userinfo('synthetic-token'))
        get.assert_not_called()

    @patch('api.views.http_requests.get')
    def test_malformed_metadata_and_provider_outage_are_retryable(self, get):
        for response in (Mock(status_code=200, json=lambda: []),
                         Mock(status_code=200, json=Mock(side_effect=ValueError())),
                         Mock(status_code=503)):
            get.side_effect = None
            get.return_value = response
            _, error = _verified_google_identity({'token': 'synthetic-token'})
            self.assertEqual(error.status_code, 503)
        get.side_effect = requests.Timeout('private-provider-diagnostic')
        _, error = _verified_google_identity({'token': 'synthetic-token'})
        self.assertEqual(error.status_code, 503)
        self.assertNotIn('private-provider', str(error.data))

    @patch('api.views._google_userinfo')
    def test_verified_email_requires_institutional_workspace(self, provider):
        for domain in (None, '', 'other.example', 'dnsc.edu.ph.attacker.example'):
            provider.return_value = Mock(status_code=200, json=lambda: {
                'email': 'synthetic@dnsc.edu.ph', 'email_verified': True, 'hd': domain})
            identity, error = _verified_google_identity({'token': 'synthetic-token'})
            self.assertIsNone(identity)
            self.assertEqual(error.status_code, 403)
            self.assertEqual(error.data['error'], 'not_dnsc')


class ProductionProbeTests(APITestCase):
    @patch('api.views.http_requests.get')
    def test_wrong_oauth_client_never_creates_or_authenticates_an_account(self, get):
        from .models import User
        get.return_value = Mock(status_code=200, json=lambda: {'aud': 'foreign-client', 'expires_in': 3600})
        before = User.objects.count()
        for path in ('/api/auth/google/', '/api/auth/register-role/'):
            response = self.client.post(path, {'token': 'synthetic-token', 'role': 'student'}, format='json')
            self.assertEqual(response.status_code, 401)
            self.assertNotIn('access', response.data)
        self.assertEqual(User.objects.count(), before)

    @override_settings(DEBUG=False, ALLOWED_HOSTS=['healthcheck.railway.app'],
                       SECURE_SSL_REDIRECT=True, SECURE_REDIRECT_EXEMPT=[r'^api/health/$'])
    def test_internal_readiness_is_http_safe_but_api_still_redirects(self):
        probe = self.client.get('/api/health/', HTTP_HOST='healthcheck.railway.app')
        self.assertEqual(probe.status_code, 200)
        self.assertEqual(probe.json(), {'status': 'ok'})
        self.assertEqual(self.client.get('/api/auth/me/', HTTP_HOST='healthcheck.railway.app').status_code, 301)

    def test_infrastructure_probe_does_not_exhaust_user_login_throttles(self):
        for _ in range(65):
            self.assertEqual(self.client.get('/api/health/').status_code, 200)


@skipUnless(connection.vendor == 'postgresql', 'Requires the disposable PostgreSQL test server.')
class CooperativeDatabaseTests(APITestCase):
    def test_gunicorn_hook_allows_other_greenlets_during_database_wait(self):
        # Isolate the callback change from Django's threaded/concurrency tests.
        config = connection.settings_dict
        credentials = {key: config[name] for key, name in (
            ('dbname', 'NAME'), ('user', 'USER'), ('password', 'PASSWORD'),
            ('host', 'HOST'), ('port', 'PORT'))}
        script = '''
import json, os, runpy
import gevent, psycopg2
runpy.run_path('gunicorn.conf.py')['post_fork'](None, None)
db = psycopg2.connect(**json.loads(os.environ['SB_GEVENT_TEST_DSN']))
ticks = []
def query():
    with db.cursor() as cursor:
        cursor.execute('SELECT pg_sleep(0.15)')
job = gevent.spawn(query)
while not job.ready():
    ticks.append(1)
    gevent.sleep(0.01)
job.get()
db.close()
assert len(ticks) >= 3, len(ticks)
print('PostgreSQL wait yielded to other greenlets')
'''
        result = subprocess.run([sys.executable, '-c', script],
            env={**os.environ, 'SB_GEVENT_TEST_DSN': json.dumps(credentials)},
            capture_output=True, text=True, timeout=20,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
