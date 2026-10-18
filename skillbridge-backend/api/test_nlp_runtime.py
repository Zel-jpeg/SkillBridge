from types import SimpleNamespace as Obj
from unittest.mock import patch
from django.test import SimpleTestCase
from django.utils import timezone
from rest_framework.test import APITestCase
from .combined_competency import recalculate_combined
from .models import (Assessment, Batch, BatchEnrollment, Company, Position,
                     PositionRequirement, Recommendation, RecommendationConfiguration,
                     SkillCategory, SkillScore, StudentResponse, User)
from .recommendation_nlp import preprocess_texts
from .recommendation_nlp import clear_preprocessing_cache


class PreprocessingReuseTests(SimpleTestCase):
    def setUp(self):
        clear_preprocessing_cache()
        self.addCleanup(clear_preprocessing_cache)

    def model(self, suffix=''):
        batches = []
        def pipe(texts, **kwargs):
            batches.append(tuple(texts))
            return [[Obj(lemma_=text + suffix, is_stop=False, is_punct=False, is_space=False)] for text in texts]
        return Obj(pipe=pipe), batches

    def test_shared_documents_reuse_lemmas_but_changed_text_and_model_are_reprocessed(self):
        model, batches = self.model()
        other, other_batches = self.model(' changed model')
        with patch('api.recommendation_nlp._load_model', return_value=model):
            first, actual, reason = preprocess_texts(['Shared', 'Profile A', 'Shared'], 'spacy_md')
            self.assertEqual((first, actual, reason), (['shared', 'profile a', 'shared'], 'spacy_md', None))
            first[0] = 'Caller mutation'
            second, _, _ = preprocess_texts(['Shared', 'Profile B'], 'spacy_md')
            self.assertEqual(second, ['shared', 'profile b'])
            self.assertEqual(batches, [('Shared', 'Profile A'), ('Profile B',)])
        with patch('api.recommendation_nlp._load_model', return_value=other):
            self.assertEqual(preprocess_texts(['Shared'], 'spacy_md')[0], ['shared changed model'])
        self.assertEqual(other_batches, [('Shared',)])

    def test_cached_success_does_not_hide_a_later_missing_resource_or_strict_failure(self):
        model, _ = self.model()
        with patch('api.recommendation_nlp._load_model', return_value=model):
            preprocess_texts(['Python and SQL'], 'spacy_md')
        with patch('api.recommendation_nlp._load_model', side_effect=OSError('Synthetic resource missing')):
            processed, actual, reason = preprocess_texts(['Python and SQL'], 'spacy_md')
            self.assertEqual((processed, actual), (['python sql'], 'simple_fallback'))
            self.assertIn('spacy_md unavailable', reason)
            with self.assertRaises(OSError):
                preprocess_texts(['Python and SQL'], 'spacy_md', allow_fallback=False)

    def test_document_cache_is_bounded_and_concurrent_profiles_keep_their_own_output(self):
        from concurrent.futures import ThreadPoolExecutor
        from . import recommendation_nlp as nlp
        model, batches = self.model()
        with patch('api.recommendation_nlp._load_model', return_value=model):
            preprocess_texts(['Shared'], 'spacy_md')
            with ThreadPoolExecutor(max_workers=20) as pool:
                outputs = list(pool.map(lambda i: preprocess_texts(['Shared', f'Profile {i}'], 'spacy_md')[0], range(20)))
            self.assertEqual(outputs, [['shared', f'profile {i}'] for i in range(20)])
            self.assertEqual(sum('Shared' in batch for batch in batches), 1)
            preprocess_texts([f'Unique {i}' for i in range(nlp._PREPROCESS_CACHE_LIMIT + 1)], 'spacy_md')
            self.assertLessEqual(len(nlp._preprocess_cache), nlp._PREPROCESS_CACHE_LIMIT)
            preprocess_texts(['Shared'], 'spacy_md')
            self.assertEqual(sum('Shared' in batch for batch in batches), 2)


class PreprocessorFailureTests(SimpleTestCase):
    def test_missing_medium_reports_actual_small_and_strict_comparison_never_substitutes(self):
        token = Obj(lemma_='synthetic', is_stop=False, is_punct=False, is_space=False)
        small = Obj(pipe=lambda texts, **kwargs: [[token] for _ in texts])
        def load(model):
            if model == 'spacy_md':
                raise OSError('Synthetic missing medium')
            return small
        with patch('api.recommendation_nlp._load_model', side_effect=load):
            processed, actual, reason = preprocess_texts(['Synthetic text'], 'spacy_md')
            self.assertEqual(processed, ['synthetic'])
            self.assertEqual(actual, 'spacy_sm')
            self.assertIn('spacy_md unavailable', reason)
            with self.assertRaises(OSError):
                preprocess_texts(['Synthetic text'], 'spacy_md', allow_fallback=False)

    def test_initialization_failure_uses_truthful_deterministic_fallback(self):
        with patch('api.recommendation_nlp._load_model', side_effect=RuntimeError('Synthetic initialization failure')):
            result, actual, reason = preprocess_texts(['Python and SQL', '', 'the and of'], 'spacy_md')
        self.assertEqual(actual, 'simple_fallback')
        self.assertEqual(result, ['python sql', '', ''])
        self.assertIn('spacy_md unavailable', reason)
        self.assertIn('spacy_sm unavailable', reason)


class RuntimeRankingFallbackTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email='nlp-owner@example.com', name='Owner', role='instructor')
        self.student = User.objects.create_user(email='nlp-student@example.com', name='Student', role='student')
        self.batch = Batch.objects.create(name='NLP fixture', instructor=self.owner)
        BatchEnrollment.objects.create(batch=self.batch, student=self.student)
        self.category = SkillCategory.objects.create(name='Programming', tags=['Python'], created_by=self.owner)
        self.assessment = Assessment.objects.create(title='NLP fixture', batch=self.batch, created_by=self.owner)
        StudentResponse.objects.create(student=self.student, assessment=self.assessment, status='submitted', submitted_at=timezone.now())
        self.score = SkillScore.objects.create(student=self.student, assessment=self.assessment, skill_category=self.category,
                                                raw_score=1, max_score=2, percentage=50)
        self.company = Company.objects.create(name='Synthetic employer')
        self.position = Position.objects.create(company=self.company, title='Python intern', slots_available=1)
        PositionRequirement.objects.create(position=self.position, skill_category=self.category, required_percentage=50)
        RecommendationConfiguration.get_active()

    def test_missing_resources_preserve_requested_and_actual_model_in_saved_results(self):
        with patch('api.recommendation_nlp._load_model', side_effect=OSError('Synthetic missing resource')):
            profile, _, results = recalculate_combined(self.student, self.batch)
        self.assertEqual(profile.active_model, 'spacy_md')
        self.assertEqual(profile.model_used, 'simple_fallback')
        self.assertEqual(results[0]['requested_model'], 'spacy_md')
        self.assertEqual(results[0]['model_used'], 'simple_fallback')
        self.assertEqual(Recommendation.objects.get(student=self.student).model_used, 'simple_fallback')

    def test_empty_vocabulary_produces_zero_text_component_without_fake_similarity(self):
        with patch('api.recommendation_nlp.preprocess_texts', return_value=(['', ''], 'spacy_md', None)):
            _, _, results = recalculate_combined(self.student, self.batch)
        self.assertEqual(results[0]['nlp_score_component'], 0)
        self.assertEqual(results[0]['category_score_component'], 100)
        self.assertEqual(results[0]['location_score_component'], 50)
        self.assertEqual(results[0]['match_score'], 67.5)

    def test_no_positions_or_zero_evidence_does_not_claim_a_model_ran(self):
        for condition in ['no_positions', 'zero_evidence']:
            with self.subTest(condition=condition):
                if condition == 'no_positions':
                    self.position.requirements.all().delete()
                else:
                    PositionRequirement.objects.create(position=self.position, skill_category=self.category, required_percentage=50)
                    self.score.raw_score, self.score.percentage = 0, 0
                    self.score.save()
                with patch('api.recommendation_nlp.preprocess_texts') as preprocess:
                    profile, _, results = recalculate_combined(self.student, self.batch)
                self.assertEqual(results, [])
                preprocess.assert_not_called()
                self.assertEqual(profile.active_model, 'spacy_md')
                self.assertEqual(profile.model_used, '')
                self.assertFalse(Recommendation.objects.filter(student=self.student, is_current=True).exists())
