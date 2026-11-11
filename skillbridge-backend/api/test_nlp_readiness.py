"""Readiness/resource consistency and admin configuration safety."""
import os
import tempfile
from pathlib import Path
from types import SimpleNamespace as Obj
from unittest.mock import patch

from django.db import connection
from django.test import SimpleTestCase
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from rest_framework.test import APITestCase

from .models import RecommendationConfiguration, User
from .recommendation_nlp import (clear_preprocessing_cache, model_status,
                                  preprocess_texts, stanza_resources_dir)


class ReadinessTests(SimpleTestCase):
    def test_explicit_stanza_directory_is_shared_by_status_and_loader(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            with patch.dict(os.environ, {'STANZA_RESOURCES_DIR': temporary}):
                self.assertEqual(stanza_resources_dir(), root)
                with patch('api.recommendation_nlp.importlib.util.find_spec', return_value=object()):
                    self.assertFalse(model_status('stanza_en')['available'])
                    for processor in ('tokenize', 'lemma'):
                        (root / 'en' / processor).mkdir(parents=True)
                        (root / 'en' / processor / 'test.pt').touch()
                    (root / 'resources.json').write_text('{}', encoding='utf-8')
                    status = model_status('stanza_en')
                    self.assertTrue(status['available'])
                    self.assertFalse(status['verified'])
                    self.assertEqual(status['readiness'], 'installed')

    @patch('api.recommendation_nlp.preprocess_texts')
    def test_verified_means_requested_model_really_processed_without_fallback(self, process):
        process.return_value = (['student maintain accurate record'], 'stanza_en', None)
        self.assertTrue(model_status('stanza_en', verify=True)['verified'])
        self.assertFalse(process.call_args.kwargs['allow_fallback'])
        for response in ((['text'], 'spacy_sm', 'fallback'), ([''], 'stanza_en', None)):
            process.return_value = response
            self.assertFalse(model_status('stanza_en', verify=True)['verified'])
        process.side_effect = FileNotFoundError('private/server/resources')
        failed = model_status('stanza_en', verify=True)
        self.assertFalse(failed['available'])
        self.assertNotIn('private/server', failed['error'])

    def test_stanza_success_cache_reuses_exact_documents_but_not_other_models_or_failures(self):
        clear_preprocessing_cache()
        self.addCleanup(clear_preprocessing_cache)
        calls = []
        def model(text):
            calls.append(text)
            return Obj(sentences=[Obj(words=[Obj(lemma='record', text=text)])])
        with patch('api.recommendation_nlp._load_model', return_value=model):
            self.assertEqual(preprocess_texts(['Records', 'Records'], 'stanza_en', allow_fallback=False)[0], ['record', 'record'])
            preprocess_texts(['Records', 'Visitors'], 'stanza_en', allow_fallback=False)
        self.assertEqual(calls, ['Records', 'Visitors'])
        with patch('api.recommendation_nlp._load_model', side_effect=OSError('missing')):
            with self.assertRaises(OSError):
                preprocess_texts(['Records'], 'stanza_en', allow_fallback=False)


class ConfigurationReadinessTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user('readiness-admin@example.invalid', role='admin')
        self.client.force_authenticate(self.admin)
        self.url = reverse('admin_nlp_configuration')

    @patch('api.views.model_status', return_value={'available': True, 'verified': False, 'readiness': 'installed', 'error': None})
    def test_inspection_and_recheck_are_read_only_and_request_verification_explicitly(self, status):
        for suffix, verify in (('', False), ('?verify=1', True)):
            with CaptureQueriesContext(connection) as queries:
                result = self.client.get(self.url + suffix)
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.data['active_model'], 'spacy_md')
            self.assertFalse(RecommendationConfiguration.objects.exists())
            self.assertFalse(any(q['sql'].lstrip().upper().startswith(('INSERT', 'UPDATE', 'DELETE')) for q in queries))
            self.assertEqual(status.call_args.kwargs['verify'], verify)

    @patch('api.views.model_status', return_value={'available': False, 'verified': False, 'readiness': 'unavailable', 'error': 'Model cannot load.'})
    def test_unavailable_model_cannot_be_saved_or_change_current_configuration(self, status):
        config = RecommendationConfiguration.get_active()
        response = self.client.patch(self.url, {'active_model': 'stanza_en'}, format='json')
        self.assertEqual(response.status_code, 409)
        config.refresh_from_db()
        self.assertEqual(config.active_model, 'spacy_md')
        self.assertTrue(status.call_args.kwargs['verify'])

    @patch('api.views.model_status', return_value={'available': True, 'verified': True, 'readiness': 'verified', 'error': None})
    def test_save_verifies_model_without_refreshing_recommendations(self, status):
        with patch('api.views.recalculate_combined') as recalculate:
            response = self.client.patch(self.url, {'active_model': 'stanza_en'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(RecommendationConfiguration.get_active().active_model, 'stanza_en')
        recalculate.assert_not_called()
        self.assertTrue(next(m for m in response.data['models'] if m['id'] == 'stanza_en')['verified'])

    def test_invalid_configuration_payload_cannot_crash_the_endpoint(self):
        for payload in ([], {'active_model': []}, {'active_model': {}}, {'active_model': 1}):
            response = self.client.patch(self.url, payload, format='json')
            self.assertEqual(response.status_code, 400)
