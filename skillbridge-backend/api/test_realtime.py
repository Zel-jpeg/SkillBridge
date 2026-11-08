"""Synthetic token/recipient tests; Supabase provisioning is deliberately external."""
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch
from urllib.parse import quote, unquote, urlsplit
import uuid

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from django.test import override_settings
from django.urls import reverse
import jwt
import requests
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from .models import AnswerChoice, Assessment, Batch, BatchEnrollment, ChangeEvent, Question, SkillCategory, SkillScore, User
from .realtime import RECEIVER_ROLE, configuration, publish_invalidations, recipient_topic


class RealtimePilotTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_user('realtime-admin@synthetic.invalid', role='admin')
        cls.teacher = User.objects.create_user('realtime-teacher@synthetic.invalid', role='instructor', is_approved=True)
        cls.student = User.objects.create_user('realtime-student@synthetic.invalid', role='student', is_approved=True)
        cls.other = User.objects.create_user('realtime-other@synthetic.invalid', role='admin')
        cls.batch = Batch.objects.create(name='Synthetic realtime cohort', instructor=cls.teacher)
        BatchEnrollment.objects.create(batch=cls.batch, student=cls.student)
        key = ec.generate_private_key(ec.SECP256R1())
        cls.pem = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                        serialization.NoEncryption()).decode('ascii')

    def setUp(self):
        self.key = serialization.load_pem_private_key(self.pem.encode('ascii'), password=None)
        self.options = dict(REALTIME_PILOT_ENABLED=True, REALTIME_PILOT_PUBLISH_ENABLED=False,
            REALTIME_PILOT_USER_IDS=f'{self.admin.id},{self.student.id}',
            SUPABASE_REALTIME_URL='https://syntheticref.supabase.co',
            SUPABASE_REALTIME_PUBLISHABLE_KEY='sb_publishable_synthetic',
            SUPABASE_REALTIME_SIGNING_KEY=self.pem, SUPABASE_REALTIME_SIGNING_KID='synthetic-key-id',
            SUPABASE_REALTIME_TOPIC_SECRET='synthetic-topic-secret-with-at-least-32-characters',
            SUPABASE_REALTIME_PUBLISH_KEY='sb_secret_synthetic-server-key')
        override = override_settings(**self.options)
        override.enable()
        self.addCleanup(override.disable)
        self.token = self.authenticate(self.admin)

    def authenticate(self, user, **claims):
        token = AccessToken.for_user(user)
        for key, value in claims.items():
            token[key] = value
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        return token

    def exchange(self, data=None):
        return self.client.post(reverse('realtime_session'), data or {}, format='json')

    def test_disabled_and_nonpilot_sessions_keep_sse_without_network_calls(self):
        with patch('api.realtime.requests.post') as post, patch('api.realtime.serialization.load_pem_private_key') as load:
            with override_settings(REALTIME_PILOT_ENABLED=False):
                response = self.exchange()
            self.assertEqual(response.data, {'transport': 'sse'})
            load.assert_not_called()
            post.assert_not_called()
        self.authenticate(self.other)
        response = self.exchange()
        self.assertEqual(response.data, {'transport': 'sse'})
        self.assertEqual(response['Cache-Control'], 'no-store')

    def test_exchange_uses_existing_auth_and_rechecks_current_account(self):
        self.client.credentials()
        self.assertEqual(self.exchange().status_code, 401)
        self.authenticate(self.teacher)
        self.teacher.is_approved = False
        self.teacher.save(update_fields=['is_approved'])
        self.assertEqual(self.exchange().status_code, 401)
        self.authenticate(self.student)
        BatchEnrollment.objects.filter(student=self.student).delete()
        self.assertEqual(self.exchange().status_code, 401)
        self.authenticate(self.admin)
        self.admin.is_active = False
        self.admin.save(update_fields=['is_active'])
        self.assertEqual(self.exchange().status_code, 401)

    def test_exchange_is_post_only_and_expired_api_tokens_cannot_exchange(self):
        self.assertEqual(self.client.get(reverse('realtime_session')).status_code, 405)
        self.authenticate(self.admin, exp=1)
        self.assertEqual(self.exchange().status_code, 401)

    def test_token_is_short_lived_receive_only_and_server_assigns_identity(self):
        with patch('api.realtime.time.time', return_value=2000000000):
            self.authenticate(self.admin, exp=2000000017)
            response = self.exchange({'user_id': self.other.id, 'role': 'service_role', 'topic': 'foreign'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Cache-Control'], 'no-store')
        self.assertEqual(response['Pragma'], 'no-cache')
        self.assertEqual(response.data['transport'], 'supabase_broadcast')
        self.assertEqual(response.data['url'], 'https://syntheticref.supabase.co/realtime/v1')
        self.assertEqual(response.data['publishable_key'], 'sb_publishable_synthetic')
        self.assertEqual(response.data['event'], 'refresh')
        header = jwt.get_unverified_header(response.data['token'])
        self.assertEqual(header, {'alg': 'ES256', 'typ': 'JWT', 'kid': 'synthetic-key-id'})
        claims = jwt.decode(response.data['token'], self.key.public_key(), algorithms=['ES256'],
                            options={'verify_exp': False, 'verify_iat': False})
        self.assertEqual(set(claims), {'role', 'sub', 'iat', 'exp', 'jti', 'sb_topic'})
        self.assertEqual(claims['role'], RECEIVER_ROLE)
        self.assertEqual(claims['iat'], 2000000000)
        self.assertEqual(claims['exp'], 2000000017)
        self.assertEqual(response.data['expires_at'], claims['exp'])
        self.assertEqual(claims['sb_topic'], recipient_topic(self.admin, configuration()))
        self.assertEqual(response.data['topic'], claims['sb_topic'])
        self.assertEqual(uuid.UUID(claims['sub']).version, 4)
        self.assertNotIn(self.pem, response.content.decode())
        self.assertNotIn(self.options['SUPABASE_REALTIME_PUBLISH_KEY'], response.content.decode())
        self.assertNotIn(self.admin.email, response.content.decode())

    def test_tokens_expire_within_sixty_seconds_and_topics_are_account_isolated(self):
        first = self.exchange().data
        second = self.exchange().data
        self.assertEqual(first['topic'], second['topic'])
        claims = jwt.decode(first['token'], self.key.public_key(), algorithms=['ES256'])
        self.assertEqual(claims['exp'] - claims['iat'], 60)
        self.assertNotEqual(first['token'], second['token'])
        self.authenticate(self.student)
        third = self.exchange().data
        self.assertNotEqual(first['topic'], third['topic'])
        with override_settings(SUPABASE_REALTIME_TOPIC_SECRET='another-synthetic-secret-with-at-least-32-characters'):
            self.assertNotEqual(third['topic'], self.exchange().data['topic'])

    def test_invalid_configuration_fails_closed(self):
        for key, values in {
            'REALTIME_PILOT_USER_IDS': ['', '1,2,3', '0', '-1', 'invalid', '١'],
            'SUPABASE_REALTIME_URL': ['http://syntheticref.supabase.co', 'https://attacker.invalid',
                'https://syntheticref.supabase.co.evil.invalid', 'https://u:p@syntheticref.supabase.co',
                'https://syntheticref.supabase.co:8443', 'https://syntheticref.supabase.co/path',
                'https://syntheticref.supabase.co?query=1', 'https://syntheticref.supabase.co/#fragment'],
            'SUPABASE_REALTIME_PUBLISHABLE_KEY': ['', 'sb_secret_do-not-disclose', 'sb_publishable_', 'sb_publishable_has whitespace'],
            'SUPABASE_REALTIME_PUBLISH_KEY': ['', 'not-an-api-key', 'sb_secret_', 'sb_secret_has whitespace'],
            'SUPABASE_REALTIME_SIGNING_KEY': ['', 'not-a-private-key'],
            'SUPABASE_REALTIME_SIGNING_KID': ['', 'has whitespace'],
            'SUPABASE_REALTIME_TOPIC_SECRET': ['', 'too-short'],
        }.items():
            for value in values:
                with self.subTest(key=key, value=value), override_settings(**{key: value}):
                    self.assertEqual(self.exchange().data, {'transport': 'sse'})
        with override_settings(SUPABASE_REALTIME_SIGNING_KEY=ec.generate_private_key(ec.SECP384R1()).private_bytes(
                serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()).decode('ascii')):
            self.assertEqual(self.exchange().data, {'transport': 'sse'})

    def test_broadcast_supports_explicit_realtime_url_and_escaped_pem(self):
        with override_settings(SUPABASE_REALTIME_URL='https://syntheticref.supabase.co/realtime/v1/',
                               SUPABASE_REALTIME_SIGNING_KEY=self.pem.replace('\n', '\\n')):
            self.assertEqual(self.exchange().data['transport'], 'supabase_broadcast')

    def test_approved_instructor_can_exchange_and_revocation_blocks_publication(self):
        with override_settings(REALTIME_PILOT_USER_IDS=str(self.teacher.id), REALTIME_PILOT_PUBLISH_ENABLED=True):
            self.authenticate(self.teacher)
            self.assertEqual(self.exchange().data['transport'], 'supabase_broadcast')
            self.teacher.is_approved = False
            self.teacher.save(update_fields=['is_approved'])
            with patch('api.realtime.requests.post') as post:
                self.assertEqual(publish_invalidations({self.teacher.id: {'topics': ['students']}}), 0)
                post.assert_not_called()
            self.assertEqual(self.exchange().status_code, 401)

    def test_no_token_expiry_never_mints_and_existing_legacy_server_key_is_not_exposed(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.exchange().data, {'transport': 'sse'})
        self.client.force_authenticate(None)
        self.authenticate(self.admin)
        legacy = jwt.encode({'role': 'service_role'}, 'synthetic-legacy-key-only-for-test', algorithm='HS256')
        with override_settings(SUPABASE_REALTIME_PUBLISH_KEY=legacy):
            response = self.exchange()
        self.assertEqual(response.data['transport'], 'supabase_broadcast')
        self.assertNotIn(legacy, response.content.decode())

    def test_publish_is_independently_disabled_and_allowlist_is_bounded(self):
        with patch('api.realtime.requests.post') as post:
            self.assertEqual(publish_invalidations({self.admin.id: {'topics': ['students']}}), 0)
            with override_settings(REALTIME_PILOT_PUBLISH_ENABLED=True, REALTIME_PILOT_ENABLED=False):
                self.assertEqual(publish_invalidations({self.admin.id: {'topics': ['students']}}), 0)
            with override_settings(REALTIME_PILOT_PUBLISH_ENABLED=True,
                                   REALTIME_PILOT_USER_IDS=f'{self.admin.id},{self.teacher.id},{self.student.id}'):
                self.assertEqual(publish_invalidations({self.admin.id: {'topics': ['students']}}), 0)
            post.assert_not_called()

    def test_student_submit_publishes_only_after_scores_and_scoped_event_are_saved(self):
        assessment = Assessment.objects.create(title='Synthetic pilot assessment', batch=self.batch,
                                               created_by=self.teacher, publication_status='published')
        category = SkillCategory.objects.create(name='Synthetic skill', created_by=self.teacher)
        question = Question.objects.create(assessment=assessment, skill_category=category,
                                           question_text='Synthetic question', question_order=1)
        correct = AnswerChoice.objects.create(question=question, choice_text='Correct', is_correct=True)
        AnswerChoice.objects.create(question=question, choice_text='Incorrect', is_correct=False)
        self.authenticate(self.student)
        start = self.client.post(reverse('assessment_start', args=[assessment.id]))
        self.assertEqual(start.status_code, 200)

        published_state = []

        def provider(_url, **kwargs):
            published_state.append((
                SkillScore.objects.filter(student=self.student, assessment=assessment).exists(),
                ChangeEvent.objects.filter(recipient=self.teacher).exists(),
                set(kwargs['json']),
            ))
            return SimpleNamespace(status_code=202)

        with override_settings(REALTIME_PILOT_USER_IDS=str(self.teacher.id), REALTIME_PILOT_PUBLISH_ENABLED=True):
            with patch('api.realtime.requests.post', side_effect=provider) as post:
                with self.captureOnCommitCallbacks(execute=True):
                    response = self.client.post(reverse('assessment_submit', args=[assessment.id]), {
                        'response_id': start.data['response_id'],
                        'attempt_started_at': start.data['attempt_started_at'],
                        'answers': [{'question_id': question.id, 'selected_choice_id': correct.id}],
                    }, format='json')
                    self.assertEqual(response.status_code, 200)
                    post.assert_not_called()
                self.assertEqual(post.call_count, 1)
                self.assertIn(quote(recipient_topic(self.teacher, configuration()), safe=''), post.call_args.args[0])
        self.assertEqual(published_state, [(True, True, {'type', 'topics', 'event_id'})])

    @override_settings(REALTIME_PILOT_PUBLISH_ENABLED=True)
    def test_publish_sanitizes_payload_scopes_recipient_and_never_redirects(self):
        data = {'topics': ['students', 'results', 'scope', 'unknown', 'students', {'sensitive': 'value'}],
                'student_ids': [self.student.id], 'batch_ids': [self.batch.id], 'answer': 'not-broadcast'}
        with patch('api.realtime.requests.post', return_value=SimpleNamespace(status_code=202)) as post:
            sent = publish_invalidations({self.admin.id: data, self.other.id: data})
        self.assertEqual(sent, 1)
        args, kwargs = post.call_args
        parsed = urlsplit(args[0])
        self.assertEqual(parsed.hostname, 'syntheticref.supabase.co')
        self.assertEqual(unquote(parsed.path), '/realtime/v1/api/broadcast/' +
                         recipient_topic(self.admin, configuration()) + '/events/refresh')
        self.assertEqual(parsed.query, 'private=true')
        self.assertEqual(kwargs['timeout'], (.5, .5))
        self.assertIs(kwargs['allow_redirects'], False)
        self.assertEqual(kwargs['headers']['apikey'], self.options['SUPABASE_REALTIME_PUBLISH_KEY'])
        self.assertEqual(set(kwargs['json']), {'type', 'topics', 'event_id'})
        self.assertEqual(kwargs['json']['type'], 'data_changed')
        self.assertEqual(kwargs['json']['topics'], ['results', 'scope', 'students'])

    @override_settings(REALTIME_PILOT_PUBLISH_ENABLED=True)
    def test_publish_rechecks_recipient_after_account_or_enrollment_revocation(self):
        BatchEnrollment.objects.filter(student=self.student).delete()
        self.admin.is_active = False
        self.admin.save(update_fields=['is_active'])
        with patch('api.realtime.requests.post') as post:
            self.assertEqual(publish_invalidations({self.student.id: {'topics': ['results']},
                                                   self.admin.id: {'topics': ['results']}}), 0)
            post.assert_not_called()

    @override_settings(REALTIME_PILOT_PUBLISH_ENABLED=True)
    def test_invalid_hints_are_not_sent_and_publication_failures_are_sanitized(self):
        with patch('api.realtime.requests.post') as post:
            for payload in (None, {}, {'topics': 'results'}, {'topics': ['unknown']}):
                self.assertEqual(publish_invalidations({self.admin.id: payload}), 0)
            post.assert_not_called()
        for result in (SimpleNamespace(status_code=301), SimpleNamespace(status_code=503)):
            with self.subTest(status=result.status_code), patch('api.realtime.requests.post', return_value=result) as post:
                self.assertEqual(publish_invalidations({self.admin.id: {'topics': ['results']}}), 0)
                self.assertEqual(post.call_count, 1)
        with patch('api.realtime.requests.post', side_effect=requests.Timeout('secret-url-and-key')) as post:
            with self.assertLogs('api.realtime', level='WARNING') as logs:
                self.assertEqual(publish_invalidations({self.admin.id: {'topics': ['results']}}), 0)
            self.assertNotIn('secret-url-and-key', '\n'.join(logs.output))
            self.assertEqual(post.call_count, 1)
