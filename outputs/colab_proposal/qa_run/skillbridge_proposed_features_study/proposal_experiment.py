"""Isolated feature proposal. No Django imports, database, or application writes."""
import copy
import hashlib
import json
from collections import defaultdict
from pathlib import Path
import time

import numpy as np
import evaluation_engine as core

SKILLS = {
    'Programming': {'python_logic': 'Python program logic', 'api_development': 'API endpoint development',
                    'software_debugging': 'software debugging', 'test_case_design': 'test case design'},
    'Database': {'sql_queries': 'SQL queries', 'schema_design': 'relational schema design',
                 'database_backup': 'database backup', 'data_validation': 'data validation'},
    'Networking': {'routing': 'network routing', 'subnetting': 'IP subnetting',
                   'connectivity_troubleshooting': 'network connectivity troubleshooting',
                   'device_configuration': 'network device configuration'},
    'Web Development': {'html_css': 'HTML and CSS interfaces', 'javascript_ui': 'JavaScript interfaces',
                        'responsive_design': 'responsive web design', 'browser_testing': 'browser testing'},
    'Cybersecurity': {'authentication': 'user authentication', 'secure_coding': 'secure coding',
                      'security_testing': 'security testing', 'access_control': 'access control'},
}
LABELS = {k: v for skills in SKILLS.values() for k, v in skills.items()}
ROLE_TASKS = {
    'backend developer': [('api_development', 'Develop and test API endpoints'),
                          ('python_logic', 'Implement Python program logic'),
                          ('sql_queries', 'Read and update data using SQL queries'),
                          ('authentication', 'Implement user authentication')],
    'frontend developer': [('html_css', 'Build HTML and CSS interfaces'),
                           ('javascript_ui', 'Implement interactive JavaScript interfaces'),
                           ('responsive_design', 'Adapt responsive web layouts'),
                           ('browser_testing', 'Check interfaces using browser testing')],
    'database administrator': [('sql_queries', 'Write and inspect SQL queries'),
                               ('schema_design', 'Maintain relational schema design'),
                               ('database_backup', 'Perform database backup procedures'),
                               ('data_validation', 'Check stored records through data validation')],
    'qa tester': [('test_case_design', 'Prepare test cases for software behavior'),
                  ('browser_testing', 'Perform browser testing'),
                  ('data_validation', 'Check application data validation'),
                  ('security_testing', 'Perform basic security testing')],
    'network administrator': [('routing', 'Configure network routing'),
                              ('subnetting', 'Plan IP subnetting'),
                              ('device_configuration', 'Perform network device configuration'),
                              ('access_control', 'Maintain network access control')],
    'it support': [('connectivity_troubleshooting', 'Investigate network connectivity problems'),
                   ('device_configuration', 'Set up network devices'),
                   ('software_debugging', 'Investigate software problems'),
                   ('access_control', 'Assist with permitted access control tasks')],
}
SCENARIOS = ['current_text', 'duties_only', 'evidence_only', 'duties_and_evidence']


def suggested_tasks(position):
    title = position['title'].casefold()
    for role, tasks in ROLE_TASKS.items():
        if role in title:
            return [{'skill_id': skill, 'task': task} for skill, task in tasks]
    return []  # unknown roles do not acquire invented company duties


def selected_tasks(data, position):
    suggestions = suggested_tasks(position)
    selected = position.get('confirmed_task_ids')
    if data['metadata']['evidence_kind'] == 'expert_independent' and selected is None:
        raise ValueError('Independent-data study requires reviewed confirmed_task_ids for each position')
    if selected is not None:
        valid = {t['skill_id'] for t in suggestions}
        if not set(selected) <= valid:
            raise ValueError('Selected task IDs must belong to this versioned role-task catalog')
        suggestions = [t for t in suggestions if t['skill_id'] in selected]
    if not suggestions:
        raise ValueError(f'No selected tasks for position {position["id"]}; review/extend the development catalog')
    return suggestions


def make_simulated_questions(data, seed=20261018):
    """Allocate correct items conditional on category totals, NEVER on role labels.

    A design illustration, not a reconstruction of actual historic responses.
    """
    out = copy.deepcopy(data)
    out['metadata'].update(evidence_kind='simulated_proposal_development',
        evidence_note='Item outcomes randomly allocated within fixed category totals. '
                      'No observed responses or independently verified task requirements are supplied. '
                      'This simulation cannot validate benefit from real question-level evidence.',
        evidence_seed=seed)
    questions = []
    for category in out['categories']:
        for skill in SKILLS[category['name']]:
            for item in range(5):
                questions.append({'id': f'{skill}-{item+1}', 'category': category['name'],
                                  'skill_id': skill,
                                  'description': f'Synthetic item {item+1} about {LABELS[skill]}.'})
    out['questions'] = questions
    for case in out['cases']:
        if case['split'] != 'dev':
            raise ValueError('Never simulate evidence for a final-test cohort')
        # Stable per-case randomness avoids dependence on input ordering or expected roles.
        case_seed = int(hashlib.sha256(f'{seed}:{case["id"]}'.encode()).hexdigest()[:8], 16)
        rng = np.random.default_rng(case_seed)
        responses = []
        for category in out['categories']:
            items = [q for q in questions if q['category'] == category['name']]
            target = case['scores'][category['name']] * len(items) / 100
            if not np.isclose(target, round(target)):
                raise ValueError('Demo assumes 20 equally weighted questions per category (5% steps)')
            correct = set(rng.choice(len(items), int(round(target)), replace=False).tolist())
            responses.extend({'question_id': q['id'], 'correct': i in correct} for i, q in enumerate(items))
        case.update(responses=responses, evidence_status='eligible_submitted',
                    evidence_source='simulated_allocation_not_observed')
    return out


def validate_evidence(data):
    core.validate(data)
    questions = data.get('questions', [])
    lookup = {q['id']: q for q in questions}
    if not lookup or len(lookup) != len(questions):
        raise ValueError('Supply uniquely identified questions')
    categories = {c['name'] for c in data['categories']}
    for q in questions:
        if q['category'] not in categories or q['skill_id'] not in SKILLS.get(q['category'], {}):
            raise ValueError('Question skills must match the reviewed category/skill catalog')
    for case in data['cases']:
        if case.get('evidence_status') != 'eligible_submitted' or not case.get('evidence_source'):
            raise ValueError('Supply only eligible, submitted evidence and its source')
        if (data['metadata']['evidence_kind'] == 'expert_independent' and
            ('simulated' in case['evidence_source'].casefold() or
             'replace' in case['evidence_source'].casefold())):
            raise ValueError('Independent evidence cannot retain simulated/placeholder response provenance')
        rows = case.get('responses', [])
        if not rows or len({r['question_id'] for r in rows}) != len(rows):
            raise ValueError('Responses require unique question IDs')
        if any(r['question_id'] not in lookup or not isinstance(r['correct'], bool) for r in rows):
            raise ValueError('Unknown question or non-boolean grading outcome')
        # This prototype studies one equally weighted, complete assessment evidence set.
        # Do not pretend it implements production batch aggregation/retake selection.
        if {r['question_id'] for r in rows} != set(lookup):
            raise ValueError('Prototype requires a complete response set, including unanswered/wrong items as false')
        for category in categories:
            subset = [r for r in rows if lookup[r['question_id']]['category'] == category]
            if not subset or not np.isclose(100 * sum(r['correct'] for r in subset) / len(subset),
                                           case['scores'][category]):
                raise ValueError('Question outcomes must reconcile with category totals in this equal-weight prototype')
    for position in data['positions']:
        selected_tasks(data, position)


def evidence_counts(data, case):
    lookup = {q['id']: q for q in data['questions']}
    counts = defaultdict(lambda: [0, 0])
    for response in case['responses']:
        skill = lookup[response['question_id']]['skill_id']
        counts[skill][0] += int(response['correct'])
        counts[skill][1] += 1
    return dict(counts)


def student_text(data, case):
    fragments = []
    for skill, (correct, total) in sorted(evidence_counts(data, case).items()):
        if correct:
            fragments.append(f'{LABELS[skill]}: {correct} correct of {total} assessed items')
    return ('Assessed item evidence: ' + '; '.join(fragments) +
            '. These item outcomes do not independently establish technology mastery.')


def position_text(data, position):
    tasks = selected_tasks(data, position)
    return (f'{position["title"]}. Selected duties: ' + '; '.join(t['task'] for t in tasks) +
            '. Required task skills: ' + '; '.join(LABELS[t['skill_id']] for t in tasks) + '.')


def scenario_inputs(data, split, scenario):
    validate_evidence(data)
    if scenario not in SCENARIOS:
        raise ValueError('Unknown scenario')
    inputs = core.build_inputs(data, split)
    if scenario in ['evidence_only', 'duties_and_evidence']:
        inputs['profiles'] = [student_text(data, c) for c in inputs['cases']]
    if scenario in ['duties_only', 'duties_and_evidence']:
        inputs['descriptions'] = [position_text(data, p) for p in inputs['positions']]
    inputs['input_hash'] = core.fingerprint({'profiles': inputs['profiles'], 'descriptions': inputs['descriptions'],
        'category': inputs['category'].tolist(), 'location': inputs['location'].tolist()})
    return inputs


def skill_coverage_scores(data, cases):
    """Non-NLP control with the SAME extra evidence and selected duties."""
    scores = []
    for case in cases:
        counts = evidence_counts(data, case)
        scores.append([float(np.mean([counts[t['skill_id']][0] / counts[t['skill_id']][1]
                                      if t['skill_id'] in counts else 0
                                      for t in selected_tasks(data, position)]))
                       for position in data['positions']])
    return np.array(scores)


def coverage_result(data, inputs):
    start = time.perf_counter()
    coverage = skill_coverage_scores(data, inputs['cases'])
    final = .60 * inputs['category'] + .25 * coverage + .15 * inputs['location']
    core.rank(final)
    elapsed = time.perf_counter() - start
    summary, predictions, diagnostics = core.metrics(inputs, final)
    return {'method': 'structured_skill_coverage', 'variant': 'structured_skill_coverage', 'status': 'available',
            'hybrid': summary, 'nlp_only': None, 'predictions': predictions, 'diagnostic': diagnostics,
            'timing_trials': [{'repeat': 1, 'total_seconds': elapsed}], 'median_batch_seconds': elapsed,
            'note': 'Non-NLP baseline using the SAME specific skill evidence and duties. Timing includes '
                    'coverage construction and ranking; scope differs from precomputed-category baseline.'}


def run_study(data, split='dev', models=None, repeats=3, scenarios=None):
    validate_evidence(data)
    models = models or ['tfidf_regex', 'spacy_sm']
    if any(m not in ['tfidf_regex', 'spacy_sm', 'spacy_md', 'stanza_en'] for m in models):
        raise ValueError('Unknown model')
    current = scenario_inputs(data, split, 'current_text')
    baseline = core.run_method(current, 'structured_only', repeats)
    baseline['variant'] = 'structured_only'
    results = [baseline, coverage_result(data, current)]
    for scenario in scenarios or SCENARIOS:
        inputs = scenario_inputs(data, split, scenario)
        for model in models:
            print(f'{split}: {scenario} / {model}', flush=True)
            try:
                result = core.run_method(inputs, model, repeats)
                result.update(variant=f'{scenario}__{model}', scenario=scenario, input_hash=inputs['input_hash'])
            except (ImportError, OSError, ValueError, RuntimeError) as exc:
                result = {'method': model, 'variant': f'{scenario}__{model}', 'scenario': scenario,
                          'status': 'unavailable_or_error', 'error': f'{type(exc).__name__}: {exc}'}
            results.append(result)
    return {'split': split, 'dataset_hash': core.fingerprint(data), 'metadata': data['metadata'],
            'case_count': len(current['cases']), 'position_count': len(current['positions']),
            'environment': core.environment(), 'warnings': core.validate(data), 'results': results,
            'interpretation': 'Simulation results are design diagnostics only. New evidence may help a '
                              'non-NLP baseline too. Improvement over category-only does not isolate NLP.'}


def summarize(report):
    return [{'variant': r['variant'], **r['hybrid'], 'partial_batch_seconds': r['median_batch_seconds'],
             'text_only_top1': None if r.get('nlp_only') is None else r['nlp_only']['top1_accuracy']}
            for r in report['results'] if r['status'] == 'available']


def save_report(report, folder):
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    (folder / 'study_report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    for result in report['results']:
        if result['status'] == 'available':
            core.export_report({'results': [result]}, folder / result['variant'])


def freeze_candidate(data, report, variant, path):
    if report['split'] != 'dev' or report['dataset_hash'] != core.fingerprint(data):
        raise ValueError('Choose using the matching development report')
    selected = next((r for r in report['results'] if r['variant'] == variant and r['status'] == 'available'), None)
    if not selected or '__' not in variant:
        raise ValueError('Select an available scenario/model combination')
    hashes = {p: hashlib.sha256((Path(__file__).parent / p).read_bytes()).hexdigest() for p in
              ['proposal_experiment.py', 'evaluation_engine.py', 'sb_snapshot/recommendation_nlp.py',
               'sb_snapshot/skill_taxonomy.py']}
    selection = {'variant': variant, 'dataset_hash': core.fingerprint(data), 'source_hashes': hashes,
                 'packages': core.environment()['packages'], 'note': 'Frozen on development only; no automatic acceptance threshold.'}
    path = Path(path)
    if path.exists() and json.loads(path.read_text()) != selection:
        raise ValueError('Selection already frozen; use a new untouched cohort for a new study')
    path.write_text(json.dumps(selection, indent=2), encoding='utf-8')
    return selection


def independent_test(data, frozen, folder, repeats=3):
    if (data['metadata'].get('evidence_kind') != 'expert_independent' or
        not data['metadata'].get('labeling_protocol') or not any(c['split'] == 'test' for c in data['cases'])):
        return {'status': 'not_run', 'reason': 'Supply independently labeled dev/test cohorts with observed item outcomes and reviewed duties.'}
    if frozen['dataset_hash'] != core.fingerprint(data):
        raise ValueError('Dataset changed after freeze')
    for file, digest in frozen['source_hashes'].items():
        if hashlib.sha256((Path(__file__).parent / file).read_bytes()).hexdigest() != digest:
            raise ValueError('Code changed after freeze')
    if frozen['packages'] != core.environment()['packages']:
        raise ValueError('Packages changed after freeze')
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    receipt = folder / 'independent_test.json'
    if receipt.exists():
        prior = json.loads(receipt.read_text())
        if prior['selection_hash'] != core.fingerprint(frozen):
            raise ValueError('A different final selection already used this output directory')
        return prior
    scenario, model = frozen['variant'].split('__')
    report = run_study(data, 'test', [model], repeats, ['current_text', scenario]
                       if scenario != 'current_text' else ['current_text'])
    available = {r['variant']: r for r in report['results'] if r['status'] == 'available'}
    if frozen['variant'] not in available or f'current_text__{model}' not in available:
        return {'status': 'not_run', 'reason': 'A required method failed', 'report': report}
    candidate = available[frozen['variant']]
    gains = {baseline: core.paired_delta(candidate, available[baseline]) for baseline in
             ['structured_only', 'structured_skill_coverage', f'current_text__{model}']}
    result = {'status': 'complete', 'selection_hash': core.fingerprint(frozen), 'report': report,
              'paired_top1_gains': gains, 'decision': 'Report against adviser-agreed preregistered criteria; no automatic pass is claimed.',
              'note': 'Independence is declared by researchers, not externally verified. Do not reset receipts to retune.'}
    receipt.write_text(json.dumps(result, indent=2), encoding='utf-8')
    save_report(report, folder / 'details')
    return result
