"""Provider failures are mocked; no credentials, real recipients or live writes."""
from unittest.mock import Mock, patch
import requests
from django.test import SimpleTestCase, override_settings
from api.company_images import _storage_request, ImageStorageError
from api.email_service import deliver_email
from api.views import _google_userinfo


@override_settings(SUPABASE_STORAGE_URL='https://synthetic.invalid',
                   SUPABASE_STORAGE_SERVICE_KEY='synthetic-server-key',
                   COMPANY_IMAGE_BUCKET='company-branding', COMPANY_IMAGE_PREFIX='companies')
class ExternalProviderTests(SimpleTestCase):
    @patch('api.company_images.requests.request')
    def test_storage_timeouts_denial_redirect_and_bounded_credentials(self, request):
        key = 'companies/' + 'a' * 32 + '.webp'
        for failure in [requests.Timeout('private diagnostic'), requests.ConnectionError('private diagnostic')]:
            request.side_effect = failure
            with self.assertRaises(ImageStorageError) as result:
                _storage_request('POST', key, data=b'synthetic')
            self.assertNotIn('private', str(result.exception))
        request.side_effect = None
        for status in [302, 401, 403, 429, 500, 503]:
            request.return_value = Mock(status_code=status)
            if status >= 400:
                request.return_value.raise_for_status.side_effect = requests.HTTPError('private response')
            with self.assertRaises(ImageStorageError):
                _storage_request('POST', key, data=b'synthetic')
        self.assertEqual(request.call_args.kwargs['timeout'], (3.05, 10))
        self.assertFalse(request.call_args.kwargs['allow_redirects'])
        self.assertEqual(request.call_args.kwargs['headers']['apikey'], 'synthetic-server-key')

    @override_settings(BREVO_API_KEY='synthetic-key', ENROLLMENT_SMTP_FALLBACK=False)
    @patch('api.email_service.send_mail')
    @patch('api.email_service.requests.post')
    def test_email_failure_is_not_delivery_and_never_follows_credential_redirect(self, post, smtp):
        message = dict(user_id=123, email='synthetic@example.invalid', name='Synthetic', subject='Synthetic', body='Synthetic')
        for status in [302, 403, 429, 503]:
            post.return_value = Mock(status_code=status)
            with self.assertLogs('api.email_service', level='WARNING') as logs:
                self.assertFalse(deliver_email(**message))
            self.assertNotIn('@', str(logs.output))
            self.assertNotIn('synthetic-key', str(logs.output))
        post.side_effect = requests.Timeout('private recipient and key')
        with self.assertLogs('api.email_service', level='WARNING') as logs:
            self.assertFalse(deliver_email(**message))
        self.assertNotIn('private', str(logs.output))
        self.assertEqual(post.call_args.kwargs['timeout'], (5, 15))
        self.assertFalse(post.call_args.kwargs['allow_redirects'])
        smtp.assert_not_called()

    @patch('api.views.http_requests.get', return_value=Mock(status_code=302))
    def test_google_does_not_follow_provider_redirect(self, get):
        self.assertEqual(_google_userinfo('synthetic').status_code, 302)
        self.assertFalse(get.call_args.kwargs['allow_redirects'])
