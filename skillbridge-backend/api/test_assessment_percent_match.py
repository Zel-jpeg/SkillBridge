"""Assessment match units, ordering, and saved-policy compatibility."""
from copy import deepcopy
from types import SimpleNamespace as Obj

from django.test import SimpleTestCase

from .recommendation_policy import (POLICY, PREVIOUS_POLICY, AVERAGE_POLICY, VERSION, api_fields,
    approval_snapshot, describe, numerical_key, pooled_evidence, report_label,
    top_api_fields)


class AssessmentPercentMatchTests(SimpleTestCase):
    def details(self, scores, requirements):
        names = {key: f'Synthetic category {key}' for key in set(scores) | set(requirements)}
        return describe(scores, {key: [value, 100] for key, value in scores.items()}, names, requirements)

    def test_equal_required_category_average_is_not_coverage_or_minimum_weighting(self):
        details = self.details({1: 60, 2: 100, 3: 5}, {1: 50, 2: 90})
        self.assertEqual(details['coverage'], 100)
        self.assertEqual(details['match_percentage'], 80)
        self.assertEqual(details['required_mean'], 80)
        self.assertEqual(details['match_calculation']['category_count'], 2)
        changed_minimums = self.details({1: 60, 2: 100, 3: 100}, {1: 55, 2: 95})
        self.assertEqual(changed_minimums['match_percentage'], 80)
        self.assertTrue(changed_minimums['all_targets_met'])

    def test_pool_raw_points_within_category_before_averaging_required_categories(self):
        categories = [Obj(id=1, name='Synthetic domain', tags=[]), Obj(id=2, name='Other domain', tags=[])]
        rows = [Obj(skill_category_id=1, raw_score=1, max_score=2),
                Obj(skill_category_id=1, raw_score=8, max_score=10),
                Obj(skill_category_id=2, raw_score=10, max_score=10)]
        scores, totals, names, _ = pooled_evidence(rows, categories, exact_categories=True)
        details = describe(scores, totals, names, {1: 50, 2: 50})
        self.assertEqual(scores[1], 75)
        self.assertEqual(details['match_percentage'], 87.5)

    def test_missing_category_earns_no_match_credit_but_is_not_a_zero_grade(self):
        missing = self.details({1: 80}, {1: 50, 2: 50})
        zero = self.details({1: 80, 2: 0}, {1: 50, 2: 50})
        self.assertEqual(missing['match_percentage'], 40)
        self.assertIsNone(missing['required_mean'])
        self.assertIsNone(missing['requirements'][1]['assessed_percentage'])
        self.assertEqual(missing['requirements'][1]['state'], 'unassessed')
        self.assertEqual(zero['requirements'][1]['assessed_percentage'], 0)
        self.assertFalse(missing['match_calculation']['complete'])
        self.assertEqual(missing['match_calculation']['assessed_category_count'], 1)
        self.assertEqual(zero['match_percentage'], 40)
        self.assertTrue(zero['match_calculation']['complete'])
        self.assertFalse(zero['all_targets_met'])
        self.assertIsNone(self.details({1: 100}, {})['match_percentage'])

    def test_failed_minimum_is_not_cancelled_by_a_high_average_or_support(self):
        met = self.details({1: 70, 2: 70}, {1: 60, 2: 60})
        below = self.details({1: 100, 2: 80}, {1: 90, 2: 90})
        missing = self.details({1: 100}, {1: 90, 2: 90})
        met['support'], below['support'], missing['support'] = 0, 100, 100
        self.assertEqual(below['match_percentage'], 90)
        self.assertFalse(below['all_targets_met'])
        self.assertEqual(sorted([below, missing, met], key=lambda row: numerical_key(row, 1)), [met, below, missing])

    def test_support_breaks_only_equal_assessment_averages_with_stable_final_ties(self):
        stronger = self.details({1: 85}, {1: 50})
        weaker = self.details({1: 84}, {1: 50})
        stronger['support'], weaker['support'] = 0, 100
        tied = {**stronger, 'support': 10}
        self.assertLess(numerical_key(stronger, 2), numerical_key(weaker, 1))
        self.assertLess(numerical_key(tied, 2), numerical_key(stronger, 1))
        self.assertLess(numerical_key(tied, 1), numerical_key(tied, 2))
        self.assertEqual(tied['match_percentage'], 85)

    def test_new_api_units_and_old_saved_rows_are_not_relabelled(self):
        current = dict(assessment_rank=2, match_score=12, assessment_details=self.details({1: 80}, {1: 50}))
        fields = api_fields(current)
        self.assertEqual(fields['ranking_policy'], POLICY)
        self.assertEqual(fields['match_percentage'], 80)
        self.assertEqual(fields['requirement_coverage'], 100)
        self.assertEqual(top_api_fields(current)['top_match_percentage'], 80)
        old = deepcopy(current)
        old['assessment_details'].update(policy=PREVIOUS_POLICY, version='saved-original-version')
        self.assertIsNone(api_fields(old)['match_percentage'])
        self.assertEqual(api_fields(old)['ranking_policy'], PREVIOUS_POLICY)
        self.assertIn('requirement coverage 100.0%', report_label(old))
        self.assertIn('80.0% assessment-based match', report_label(current))
        self.assertEqual(api_fields(dict(match_score=75))['ranking_policy'], 'legacy-hybrid')

    def test_approval_snapshot_freezes_original_policy_and_evidence(self):
        for policy, version in [(POLICY, VERSION), (AVERAGE_POLICY, 'saved-average-version'), (PREVIOUS_POLICY, 'saved-original-version')]:
            details = self.details({1: 80}, {1: 50})
            details.update(policy=policy, version=version)
            saved = approval_snapshot(Obj(assessment_rank=1, assessment_details=details))
            details['required_mean'] = 10
            self.assertEqual(saved['assessment_details']['required_mean'], 80)
            self.assertEqual(saved['ranking_policy'], policy)
            self.assertEqual(saved['version'], version)

    def test_screenshot_examples_and_non_round_percentages_use_one_denominator(self):
        for scores, required, expected in [({1: 90, 2: 90}, 3, 60), ({1: 80, 2: 90, 3: 100}, 5, 54),
                                         ({1: 82, 2: 90}, 2, 86), ({1: 74, 2: 80}, 2, 77), ({}, 3, 0)]:
            details = self.details(scores, {key: 50 for key in range(1, required + 1)})
            self.assertEqual(details['match_percentage'], expected)
            self.assertEqual(details['match_calculation']['category_count'], required)
        self.assertAlmostEqual(self.details({1: 80, 2: 90, 3: 90}, {1: 50, 2: 50, 3: 50})['match_percentage'], 86.6666666667)

    def test_review_options_use_the_same_percentage_instead_of_completeness_tiers(self):
        incomplete = self.details({1: 90, 2: 90}, {1: 50, 2: 50, 3: 50})
        below = self.details({1: 50, 2: 50}, {1: 80, 2: 80})
        incomplete['support'], below['support'] = 0, 100
        self.assertEqual(incomplete['match_percentage'], 60)
        self.assertEqual(below['match_percentage'], 50)
        self.assertLess(numerical_key(incomplete, 2), numerical_key(below, 1))

    def test_previous_average_policy_does_not_inherit_current_missing_credit_rule(self):
        old = dict(assessment_rank=1, match_score=99, assessment_details=self.details({1: 80}, {1: 50, 2: 50}))
        old['assessment_details']['policy'] = AVERAGE_POLICY
        self.assertIsNone(api_fields(old)['match_percentage'])
        self.assertEqual(api_fields(old)['ranking_policy'], AVERAGE_POLICY)
