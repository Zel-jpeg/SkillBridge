import copy
import json
from pathlib import Path
import unittest
import tempfile
from unittest.mock import patch
import numpy as np
import proposal_experiment as p

HERE=Path(__file__).resolve().parent
(HERE/'test_temp').mkdir(exist_ok=True)

class ProposalTests(unittest.TestCase):
    def setUp(self):
        self.data=json.loads((HERE/'simulated_proposal_dataset.json').read_text())

    def test_outcomes_reconcile_and_do_not_depend_on_labels(self):
        p.validate_evidence(self.data)
        original=copy.deepcopy(self.data)
        for c in original['cases']:c['expected_position_id']=1
        rebuilt=p.make_simulated_questions(original)
        self.assertEqual([c['responses'] for c in self.data['cases']],[c['responses'] for c in rebuilt['cases']])
        for variant in p.SCENARIOS:
            self.assertEqual(p.scenario_inputs(self.data,'dev',variant)['input_hash'],
                             p.scenario_inputs(rebuilt,'dev',variant)['input_hash'])

    def test_variants_change_only_stated_inputs(self):
        current=p.scenario_inputs(self.data,'dev','current_text')
        for variant in p.SCENARIOS:
            other=p.scenario_inputs(self.data,'dev',variant)
            np.testing.assert_array_equal(current['category'],other['category'])
            np.testing.assert_array_equal(current['location'],other['location'])
            self.assertEqual(current['profiles']==other['profiles'],variant in ['current_text','duties_only'])
            self.assertEqual(current['descriptions']==other['descriptions'],variant in ['current_text','evidence_only'])

    def test_false_outcomes_do_not_become_positive_skills(self):
        c=self.data['cases'][0]
        for r in c['responses']:r['correct']=False
        text=p.student_text(self.data,c)
        self.assertNotIn('SQL queries',text)

    def test_unknown_roles_do_not_invent_duties(self):
        position=copy.deepcopy(self.data['positions'][0]);position['title']='Unknown custom role'
        self.assertEqual(p.suggested_tasks(position),[])
        with self.assertRaisesRegex(ValueError,'No selected tasks'):p.selected_tasks(self.data,position)

    def test_bad_evidence_rejected(self):
        self.data['cases'][0]['responses'][0]['correct']='yes'
        with self.assertRaisesRegex(ValueError,'boolean'):p.validate_evidence(self.data)

    def test_real_data_requires_reviewed_duties(self):
        self.data['metadata']['evidence_kind']='expert_independent'
        with self.assertRaisesRegex(ValueError,'confirmed_task_ids'):p.selected_tasks(self.data,self.data['positions'][0])

    def test_demo_comparison_and_final_guard(self):
        report=p.run_study(self.data,models=['tfidf_regex'],repeats=1)
        self.assertEqual(len(report['results']),6)
        for r in report['results']:self.assertEqual(r['status'],'available')
        with tempfile.TemporaryDirectory(dir=HERE/'test_temp') as d:
            frozen=p.freeze_candidate(self.data,report,'duties_and_evidence__tfidf_regex',Path(d)/'freeze.json')
            self.assertEqual(p.independent_test(self.data,frozen,d)['status'],'not_run')

    def test_same_evidence_control_uses_item_counts_not_expected_role(self):
        inputs=p.scenario_inputs(self.data,'dev','current_text')
        original=p.skill_coverage_scores(self.data,inputs['cases'])
        changed=copy.deepcopy(self.data)
        for c in changed['cases']:c['expected_position_id']=1
        np.testing.assert_array_equal(original,p.skill_coverage_scores(changed,changed['cases']))
        self.assertTrue(np.all((original>=0)&(original<=1)))

    def test_independent_path_and_receipt_plumbing_only(self):
        # Synthetic fixture exercises guards; no independent-data result is published.
        self.data['metadata'].update(evidence_kind='expert_independent',labeling_protocol='Unit test fixture only')
        for pos in self.data['positions']:
            pos['confirmed_task_ids']=[t['skill_id'] for t in p.suggested_tasks(pos)]
        for i,c in enumerate(self.data['cases']):
            c['evidence_source']='unit_test_fixture_not_real_observation'
            if i%2:c['split']='test'
        report=p.run_study(self.data,models=['tfidf_regex'],repeats=1,scenarios=['duties_and_evidence'])
        with tempfile.TemporaryDirectory(dir=HERE/'test_temp') as directory:
            frozen=p.freeze_candidate(self.data,report,'duties_and_evidence__tfidf_regex',Path(directory)/'freeze.json')
            result=p.independent_test(self.data,frozen,directory,repeats=1)
            self.assertEqual(result['status'],'complete')
            self.assertEqual(len(result['report']['results']),4)
            with patch.object(p,'run_study',side_effect=AssertionError('must reuse saved receipt')):
                self.assertEqual(p.independent_test(self.data,frozen,directory),result)

    def test_simulation_cannot_be_relabelled_independent_by_metadata_only(self):
        self.data['metadata']['evidence_kind']='expert_independent'
        with self.assertRaisesRegex(ValueError,'simulated/placeholder'):p.validate_evidence(self.data)

if __name__=='__main__':unittest.main()
