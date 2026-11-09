"""Focused contracts for required-category NLP; synthetic, no model downloads."""
from copy import deepcopy
from types import SimpleNamespace as Obj
from unittest.mock import patch

import numpy as np
from django.test import SimpleTestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from .combined_competency import recalculate_combined
from .models import (Assessment, Batch, BatchEnrollment, CombinedCategoryScore,
                     Company, CompetencyFramework, Institute, OJTPlacement, Position,
                     PositionRequirement, Program, Recommendation, SkillCategory,
                     SkillScore, StudentResponse, User)
from .nlp_explanations import explain_overlap
from .recommendation_freshness import catalog_fingerprint, recommendations_stale
from .recommendation_matching import MATCHING_INPUT_VERSION, position_specific_similarity
from .recommendation_nlp import build_student_profile
from .recommendation_policy import placement_evidence


def identity_preprocess(texts, model, **kwargs):
    return list(texts), model, None


class Items(list):
    def all(self):
        return self


def category(identity, name, *tags):
    return Obj(id=identity, name=name, description=f'Review recorded {name} information accurately.',
               tags=list(tags), framework_id=1)


def score(cat, percentage):
    return Obj(skill_category_id=cat.id, skill_category=cat, raw_score=percentage,
               max_score=100, percentage=percentage)


def position(identity, cat, *, tags=(), minimum=70):
    return Obj(id=identity, title=f'{cat.name} assistant', tags=list(tags), description='',
               company=Obj(name='Synthetic partner'), requirements=Items([
                   Obj(skill_category=cat, skill_category_id=cat.id, required_percentage=minimum)]))


class PositionSpecificSimilarityTests(SimpleTestCase):
    def setUp(self):
        self.preprocessor = patch('api.recommendation_nlp.preprocess_texts', side_effect=identity_preprocess)
        self.preprocess = self.preprocessor.start()
        self.addCleanup(self.preprocessor.stop)
        self.web = category(1, 'Browser interfaces', 'htmlmarker', 'cssmarker', 'browsermarker')
        self.other = category(2, 'Community outreach', 'aquaculturemarker', 'outreachmarker')
        self.rows = [score(self.web, 80), score(self.other, 90)]
        self.positions = [position(1, self.web), position(2, self.other)]
        self.mapping = {1: 1, 2: 2}

    def match(self, rows=None, positions=None, mapping=None, **kwargs):
        rows = self.rows if rows is None else rows
        positions = self.positions if positions is None else positions
        return position_specific_similarity(build_student_profile(rows), rows, positions,
            self.mapping if mapping is None else mapping, 'spacy_md', **kwargs)

    def test_common_corpus_is_fitted_once_and_scores_match_actual_pair_cosines(self):
        original = TfidfVectorizer.fit_transform
        with patch.object(TfidfVectorizer, 'fit_transform', autospec=True, side_effect=original) as fit:
            result = self.match()
        self.assertEqual(fit.call_count, 1)
        self.assertEqual(result.reference_matrix.shape[0], 3)
        self.assertEqual(result.student_matrix.shape[0], 2)
        for index in range(2):
            pair = result.overlap_matrix(index)
            expected = cosine_similarity(pair[:1], pair[1:])[0][0]
            self.assertAlmostEqual(result.scores[index], expected, places=12)
        np.testing.assert_allclose(result.student_matrix.toarray(),
            result.vectorizer.transform(result.student_texts).toarray())
        self.assertEqual(result.model_used, 'spacy_md')
        self.assertIsNone(result.fallback_reason)

    def test_unrelated_categories_are_omitted_without_mutating_source_evidence(self):
        before = deepcopy((self.rows, self.positions))
        result = self.match()
        self.assertNotIn('aquaculturemarker', result.student_texts[0])
        self.assertNotIn('htmlmarker', result.student_texts[1])
        self.assertIn('aquaculturemarker', build_student_profile(self.rows))
        baseline = cosine_similarity(result.reference_matrix[:1], result.reference_matrix[1:2])[0][0]
        self.assertGreater(result.scores[0], baseline)
        self.assertEqual((self.rows, self.positions), before)
        self.assertEqual(result.relevant_category_ids, ((1,), (2,)))

    def test_missing_and_assessed_zero_have_no_positive_similarity_or_shared_explanation(self):
        for rows, identities in [([score(self.other, 90)], ()),
                                 ([score(self.web, 0), score(self.other, 90)], (1,))]:
            with self.subTest(assessed_zero=bool(identities)):
                result = self.match(rows=rows, positions=self.positions[:1])
                self.assertEqual(result.scores.tolist(), [0])
                self.assertEqual(result.relevant_category_ids, (identities,))
                self.assertEqual(result.positive_evidence, (False,))
                self.assertEqual(result.student_matrix.getrow(0).nnz, 0)
                self.assertEqual(explain_overlap(result.vectorizer, result.overlap_matrix(0), 0)['shared_terms'], [])
                self.assertFalse(result.input_metadata(0)['has_positive_relevant_evidence'])

    def test_canonical_map_allows_existing_equivalent_ids_but_exact_scope_does_not(self):
        alias = category(3, 'Browser interfaces', *self.web.tags)
        role = position(3, alias)
        mapped = self.match(rows=self.rows[:1], positions=[role], mapping={1: 1, 3: 1})
        exact = self.match(rows=self.rows[:1], positions=[role], mapping={1: 1, 3: 3})
        self.assertGreater(mapped.scores[0], 0)
        self.assertEqual(mapped.relevant_category_ids, ((1,),))
        self.assertEqual(exact.scores.tolist(), [0])
        self.assertEqual(exact.relevant_category_ids, ((),))

    def test_unknown_assessed_or_required_ids_fail_closed(self):
        foreign = category(99, 'Browser interfaces', *self.web.tags)
        with self.assertRaisesRegex(ValueError, 'outside the matching catalog'):
            self.match(rows=[score(foreign, 90)])
        with self.assertRaisesRegex(ValueError, 'outside the matching catalog'):
            self.match(positions=[position(99, foreign)])

    def test_overlap_uses_filtered_student_even_when_role_mentions_unrelated_word(self):
        role = position(1, self.web, tags=['aquaculturemarker'])
        result = self.match(positions=[role])
        index = result.vectorizer.vocabulary_['aquaculturemarker']
        self.assertGreater(result.reference_matrix[0, index], 0)
        self.assertGreater(result.reference_matrix[1, index], 0)
        self.assertEqual(result.student_matrix[0, index], 0)
        explanation = explain_overlap(result.vectorizer, result.overlap_matrix(0), 0, topn=20)
        self.assertNotIn('aquaculturemarker', [r['term'] for r in explanation['shared_terms']])
        metadata = result.input_metadata(0)
        self.assertEqual(metadata['matching_input_version'], MATCHING_INPUT_VERSION)
        self.assertEqual(metadata['student_profile_scope'], 'position_required_categories')
        self.assertEqual(metadata['relevant_assessed_category_ids'], [self.web.id])
        self.assertEqual(metadata['student_matching_word_count'], len(result.student_texts[0].split()))
        self.assertTrue(metadata['uses_common_tfidf_space'])

    def test_empty_vocabulary_is_zero_and_explainable_without_fake_model_substitution(self):
        self.preprocess.side_effect = lambda texts, model: ([''] * len(texts), model, None)
        result = self.match()
        self.assertEqual(result.scores.tolist(), [0, 0])
        self.assertIsNone(result.vectorizer)
        self.assertIsNone(result.overlap_matrix(0))
        self.assertEqual(result.model_used, 'spacy_md')
        self.assertEqual(explain_overlap(result.vectorizer, result.overlap_matrix(0), 0)['explanation_status'],
                         'empty_vocabulary')

    def test_actual_fallback_status_is_preserved(self):
        self.preprocess.side_effect = lambda texts, model: (list(texts), 'simple_fallback', 'Synthetic unavailable model')
        result = self.match()
        self.assertEqual(result.model_used, 'simple_fallback')
        self.assertEqual(result.fallback_reason, 'Synthetic unavailable model')

    def test_no_candidates_does_not_load_model_and_document_count_must_match(self):
        result = self.match(positions=[])
        self.assertEqual(result.scores.tolist(), [])
        self.preprocess.assert_not_called()
        with self.assertRaisesRegex(ValueError, 'exactly one position text'):
            self.match(position_texts=['Only one document'])


class PositionSpecificMatchingIntegrationTests(APITestCase):
    def setUp(self):
        self.preprocessor = patch('api.recommendation_nlp.preprocess_texts', side_effect=identity_preprocess)
        self.preprocess = self.preprocessor.start()
        self.addCleanup(self.preprocessor.stop)
        self.admin = User.objects.create_user('matching-admin@example.invalid', role='admin')
        self.staff = User.objects.create_user('matching-staff@example.invalid', role='instructor', is_approved=True)
        self.institute = Institute.objects.create(code='MATCH', name='Matching test institute')
        self.program = Program.objects.create(institute=self.institute, code='MATCH', name='Matching test program')
        self.framework = CompetencyFramework.objects.create(program=self.program, version=1, name='Synthetic categories')
        self.student = User.objects.create_user('matching-student@example.invalid', role='student',
                                               program=self.program, is_approved=True)
        self.batch = Batch.objects.create(name='Matching test cohort', instructor=self.staff,
            institute=self.institute, program=self.program, framework=self.framework)
        BatchEnrollment.objects.create(batch=self.batch, student=self.student, profile_review_required=False)
        self.first = SkillCategory.objects.create(framework=self.framework, name='Browser interfaces',
            description='Review browser records.', tags=['htmlmarker', 'cssmarker'])
        self.second = SkillCategory.objects.create(framework=self.framework, name='Community outreach',
            description='Review community records.', tags=['aquaculturemarker', 'outreachmarker'])
        self.assessment = Assessment.objects.create(batch=self.batch, framework=self.framework,
            created_by=self.staff, title='Required synthetic evidence')
        StudentResponse.objects.create(student=self.student, assessment=self.assessment,
            status='submitted', submitted_at=timezone.now())
        for cat, value in [(self.first, 8), (self.second, 9)]:
            SkillScore.objects.create(student=self.student, assessment=self.assessment,
                skill_category=cat, raw_score=value, max_score=10, percentage=value * 10)
        self.company = Company.objects.create(name='Synthetic matching partner', management_program=self.program)
        self.role = Position.objects.create(company=self.company, title='Browser assistant', slots_available=3,
            description='Assist reviewed browser tasks.', tags=['aquaculturemarker'],
            management_program=self.program, eligibility_configured_at=timezone.now())
        self.role.eligible_programs.add(self.program)
        PositionRequirement.objects.create(position=self.role, skill_category=self.first, required_percentage=70)
        self.profile, _, self.rows = recalculate_combined(self.student, self.batch)
        self.rec = Recommendation.objects.get(student=self.student, batch=self.batch, position=self.role)

    def result(self):
        self.client.force_authenticate(self.student)
        response = self.client.get(reverse('student_combined_results'))
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def test_full_visible_profile_and_grades_stay_complete_while_matching_uses_required_categories(self):
        before = list(SkillScore.objects.filter(student=self.student).order_by('id').values())
        expected = build_student_profile(list(CombinedCategoryScore.objects.filter(
            student=self.student, batch=self.batch).select_related('skill_category')))
        self.assertEqual(self.profile.competency_profile_text, expected)
        self.assertIn('aquaculturemarker', self.profile.competency_profile_text)
        evidence = self.rec.assessment_details['nlp_evidence']
        self.assertEqual(evidence['matching_input_version'], MATCHING_INPUT_VERSION)
        self.assertEqual(evidence['relevant_assessed_category_ids'], [self.first.pk])
        self.assertNotIn('aquaculturemarker', [r['term'] for r in evidence['shared_terms']])
        self.assertEqual(self.rec.assessment_details['ranking_inputs']['matching_input_version'], MATCHING_INPUT_VERSION)
        result = self.result()
        self.assertEqual(result['combined_competency_profile']['competency_profile_text'], expected)
        self.assertEqual({s['category_id'] for s in result['combined_category_scores']}, {self.first.pk, self.second.pk})
        self.assertEqual(result['overall_raw_score'], 17)
        self.assertEqual(result['overall_max_score'], 20)
        self.assertEqual(before, list(SkillScore.objects.filter(student=self.student).order_by('id').values()))

    def test_matching_version_stales_only_rankings_preserving_grades_and_issued_snapshot(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(reverse('placement_approve'), {'recommendation_id': self.rec.pk}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        placement = OJTPlacement.objects.get(student=self.student, status='approved')
        evidence = placement_evidence(placement)
        self.assertIsNotNone(evidence)
        scores = list(SkillScore.objects.filter(student=self.student).order_by('id').values())
        combined = list(CombinedCategoryScore.objects.filter(student=self.student).order_by('id').values())
        fingerprint = self.profile.ranking_input_fingerprint
        with patch('api.recommendation_freshness.MATCHING_INPUT_VERSION', 'synthetic-next-matching-version'):
            self.assertTrue(recommendations_stale(self.profile, self.student, batch=self.batch))
            result = self.result()
            self.assertFalse(result['competency_locked'])
            self.assertTrue(result['recommendations_locked'])
            self.assertTrue(result['recommendations_stale'])
            self.assertEqual(result['recommendations'], [])
            self.assertEqual(result['overall_percentage'], 85)
            self.profile.refresh_from_db()
            self.assertEqual(self.profile.ranking_input_fingerprint, fingerprint, 'GET cannot silently rerank')
        self.assertEqual(list(SkillScore.objects.filter(student=self.student).order_by('id').values()), scores)
        self.assertEqual(list(CombinedCategoryScore.objects.filter(student=self.student).order_by('id').values()), combined)
        self.assertEqual(placement_evidence(OJTPlacement.objects.get(pk=placement.pk)), evidence)

    def test_version_participates_in_scoped_and_unscoped_catalog_fingerprints(self):
        scoped = catalog_fingerprint(self.batch)
        unscoped = catalog_fingerprint()
        with patch('api.recommendation_freshness.MATCHING_INPUT_VERSION', 'synthetic-next-matching-version'):
            self.assertNotEqual(catalog_fingerprint(self.batch), scoped)
            self.assertNotEqual(catalog_fingerprint(), unscoped)

    def test_unscoped_canonical_aliases_keep_existing_assessment_evidence(self):
        source = SkillCategory.objects.create(name='Database', tags=['SQL', 'tables'], description='Review database records.')
        alias = SkillCategory.objects.create(name='Database Management', tags=['SQL', 'tables'], description='Review database records.')
        student = User.objects.create_user('legacy-matching-student@example.invalid', role='student', is_approved=True)
        batch = Batch.objects.create(name='Existing shared institute cohort', instructor=self.staff)
        BatchEnrollment.objects.create(batch=batch, student=student)
        assessment = Assessment.objects.create(batch=batch, created_by=self.staff, title='Existing shared assessment')
        StudentResponse.objects.create(student=student, assessment=assessment, status='submitted', submitted_at=timezone.now())
        SkillScore.objects.create(student=student, assessment=assessment, skill_category=source,
                                  raw_score=8, max_score=10, percentage=80)
        role = Position.objects.create(company=self.company, title='Existing database assistant')
        PositionRequirement.objects.create(position=role, skill_category=alias, required_percentage=70)
        _, _, rows = recalculate_combined(student, batch)
        self.assertEqual([row['position_id'] for row in rows], [role.pk])
        self.assertEqual(rows[0]['assessment_details']['coverage'], 100)
        evidence = rows[0]['assessment_details']['nlp_evidence']
        self.assertEqual(evidence['relevant_assessed_category_ids'], [source.pk])
        self.assertTrue(evidence['has_positive_relevant_evidence'])
        self.assertGreater(rows[0]['nlp_score_component'], 0)
