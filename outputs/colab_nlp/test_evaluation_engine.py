"""Meaningful offline checks; run with the backend venv, no database."""
import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

import evaluation_engine as engine

HERE = Path(__file__).resolve().parent
TEST_TEMP = HERE / 'test_temp'
TEST_TEMP.mkdir(exist_ok=True)


class StudyTests(unittest.TestCase):
    def setUp(self):
        self.data = json.loads((HERE / 'development_dataset.json').read_text())
        self.inputs = engine.build_inputs(self.data, 'dev')

    def test_labels_never_change_model_inputs(self):
        changed = copy.deepcopy(self.data)
        for c in changed['cases']:
            c['expected_position_id'] = 1 if c['expected_position_id'] != 1 else 2
        self.assertEqual(self.inputs['input_hash'], engine.build_inputs(changed, 'dev')['input_hash'])

    def test_group_leakage_rejected(self):
        self.data['cases'][1]['split'] = 'test'
        self.data['cases'][1]['group_id'] = self.data['cases'][0]['group_id']
        with self.assertRaisesRegex(ValueError, 'both dev and test'):
            engine.validate(self.data)

    def test_component_formula_and_per_student_tfidf_match_production_calculation(self):
        result = engine.run_method(self.inputs, 'tfidf_regex', repeats=1)
        processed = engine.nlp._simple_preprocess(self.inputs['profiles'] + self.inputs['descriptions'])
        for i in [0, 14, 39, 59]:
            vector = TfidfVectorizer(ngram_range=(1, 3), min_df=1, sublinear_tf=True).fit_transform(
                [processed[i]] + processed[len(self.inputs['cases']):])
            text = cosine_similarity(vector[:1], vector[1:])[0]
            final = .60 * self.inputs['category'][i] + .25 * text + .15 * self.inputs['location'][i]
            np.testing.assert_allclose(result['predictions'][i]['nlp_scores'], text, atol=1e-12)
            np.testing.assert_allclose(result['predictions'][i]['final_scores'], final, atol=1e-12)

    def test_multirelevant_metrics_and_rounded_ties(self):
        inputs = {'cases': [{'id': 'a', 'group_id': 'a', 'expected_position_id': 2,
                             'relevant_position_ids': [1, 2]}],
                  'positions': [{'id': i, 'title': str(i)} for i in [1, 2, 3, 4]]}
        scores = np.array([[.9, .8, .7, .6]])
        metrics, rows, _ = engine.metrics(inputs, scores)
        self.assertEqual(metrics['top1_accuracy'], 0)
        self.assertEqual(metrics['hit_rate3'], 1)
        self.assertAlmostEqual(metrics['precision3'], 2 / 3)
        self.assertEqual(metrics['recall3'], 1)
        self.assertEqual(metrics['ndcg3'], 1)
        self.assertEqual(rows[0]['expected_rank'], 2)
        self.assertEqual(engine.rank([[.500001, .500002, .2]]).tolist(), [[0, 1, 2]])

    def test_missing_model_does_not_inherit_metrics(self):
        with patch.object(engine.nlp, 'preprocess_texts', side_effect=OSError('no model')):
            report = engine.compare(self.data, methods=['spacy_sm'], repeats=1)
        self.assertEqual(report['results'][0]['status'], 'unavailable_or_error')
        self.assertNotIn('hybrid', report['results'][0])

    def test_demo_cannot_be_final_acceptance(self):
        report = engine.compare(self.data, methods=['structured_only', 'tfidf_regex'], repeats=1)
        protocol = {'primary_metric': 'top1_correct', 'min_top1': None,
                    'min_macro_f1': None, 'min_primary_gain': None}
        with tempfile.TemporaryDirectory(dir=TEST_TEMP) as directory:
            locked = engine.lock_selection(self.data, report, 'tfidf_regex', protocol,
                                           Path(directory) / 'lock.json')
            self.assertEqual(engine.lock_selection(self.data, report, 'tfidf_regex', protocol,
                                                  Path(directory) / 'lock.json'), locked)
            self.assertEqual(engine.final_test(self.data, locked, directory)['status'], 'not_run')
            self.data['cases'][0]['scores']['Programming'] += 1
            with self.assertRaisesRegex(ValueError, 'Dataset changed'):
                engine.final_test(self.data, locked, directory)

    def test_final_test_only_frozen_candidate_and_baseline_and_receipt(self):
        # Synthetic fake cohort tests plumbing, never real-world acceptance.
        for c in self.data['cases'][::2]:
            c['split'] = 'test'
        report = engine.compare(self.data, methods=['structured_only', 'tfidf_regex'], repeats=1)
        protocol = {'primary_metric': 'top1_correct', 'min_top1': None,
                    'min_macro_f1': None, 'min_primary_gain': None}
        with tempfile.TemporaryDirectory(dir=TEST_TEMP) as directory:
            locked = engine.lock_selection(self.data, report, 'tfidf_regex', protocol,
                                           Path(directory) / 'lock.json')
            result = engine.final_test(self.data, locked, directory, repeats=1)
            self.assertEqual(result['status'], 'complete')
            self.assertIn('Descriptive only', result['decision'])
            self.assertEqual([r['method'] for r in result['report']['results']],
                             ['structured_only', 'tfidf_regex'])
            with patch.object(engine, 'compare', side_effect=AssertionError('must reuse receipt')):
                self.assertEqual(engine.final_test(self.data, locked, directory), result)

    def test_paired_delta_is_paired_not_two_unrelated_averages(self):
        baseline = {'predictions': [{'case_id': str(i), 'group_id': str(i), 'top1_correct': v}
                                    for i, v in enumerate([0, 0, 1, 1])]}
        candidate = copy.deepcopy(baseline)
        for row in candidate['predictions']:
            row['top1_correct'] = 1
        result = engine.paired_delta(candidate, baseline, samples=100)
        self.assertEqual(result['delta'], .5)
        self.assertGreaterEqual(result['ci95'][0], 0)


if __name__ == '__main__':
    unittest.main()
