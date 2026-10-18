"""Offline SkillBridge experiments. No Django, database writes, or model downloads.

The sibling sb_snapshot package is a verbatim snapshot of production helpers.
Labels are consumed only by metrics/diagnostics, never by build_inputs/rank.
"""
from __future__ import annotations
import csv
import hashlib
import importlib.metadata
import json
import platform
import statistics
import time
from pathlib import Path
from types import SimpleNamespace as Obj

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import accuracy_score, confusion_matrix, precision_recall_fscore_support
from sklearn.metrics.pairwise import cosine_similarity

from sb_snapshot import recommendation_nlp as nlp
from sb_snapshot import skill_taxonomy

SEED = 20261018
WEIGHTS = (0.60, 0.25, 0.15)
DEFAULT_METHODS = ['structured_only', 'tfidf_regex', 'spacy_sm', 'spacy_md', 'stanza_en']


class Items(list):
    def all(self):
        return self


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False,
                                     allow_nan=False).encode()).hexdigest()


def environment():
    versions = {}
    for name in ['numpy', 'scikit-learn', 'spacy', 'stanza', 'en-core-web-sm', 'en-core-web-md']:
        try:
            versions[name] = importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError:
            versions[name] = 'not installed'
    return {'python': platform.python_version(), 'platform': platform.platform(),
            'cpu': platform.processor(), 'logical_cpu_count': __import__('os').cpu_count(),
            'packages': versions, 'seed': SEED, 'weights': list(WEIGHTS),
            'text_generation_version': nlp.TEXT_GENERATION_VERSION,
            'note': 'Record RAM/CPU model from the Colab environment cell too. CPU pipelines; no GPU comparison.'}


def validate(data):
    required = {'metadata', 'categories', 'positions', 'cases'}
    if not required <= data.keys():
        raise ValueError(f'Missing dataset sections: {required - data.keys()}')
    for section in ['categories', 'positions', 'cases']:
        rows = data[section]
        if not rows or len({str(r['id']) for r in rows}) != len(rows):
            raise ValueError(f'{section}: require nonempty rows and unique IDs')
    if any(not isinstance(p['id'], int) for p in data['positions']):
        raise ValueError('Position IDs must be integers, matching production IDs.')
    names = [c['name'] for c in data['categories']]
    if len(set(names)) != len(names):
        raise ValueError('Category names must be unique')
    ids = {p['id'] for p in data['positions']}
    if len(ids) < 3:
        raise ValueError('At least 3 candidate positions are required for @3 metrics')
    groups = {'dev': set(), 'test': set()}
    for row in data['positions'] + data['cases']:
        values = row['requirements'] if 'requirements' in row else row['scores']
        if set(values) != set(names):
            raise ValueError('Every score/requirement vector must cover exactly the category names')
        if any(isinstance(v, bool) or not isinstance(v, (int, float)) or
               not np.isfinite(v) or not 0 <= v <= 100 for v in values.values()):
            raise ValueError('Scores and requirements must be finite percentages in [0,100]')
        if not any(values.values()):
            raise ValueError('All-zero profiles/requirements are excluded by production; remove and report them')
    for p in data['positions']:
        coords = (p.get('lat'), p.get('lng'))
        if (coords[0] is None) != (coords[1] is None):
            raise ValueError('Supply both position coordinates or neither')
        if coords[0] is not None and not (-90 <= coords[0] <= 90 and -180 <= coords[1] <= 180):
            raise ValueError('Invalid position coordinates')
    for c in data['cases']:
        if c['split'] not in groups or not c.get('group_id'):
            raise ValueError('Each case needs split dev/test and a pseudonymous student group_id')
        groups[c['split']].add(c['group_id'])
        coordinates = nlp.extract_coordinates(c.get('address', {}))
        if coordinates is not None and (not all(np.isfinite(v) for v in coordinates) or
                                       not -90 <= coordinates[0] <= 90 or
                                       not -180 <= coordinates[1] <= 180):
            raise ValueError('Invalid student coordinates')
        if c['expected_position_id'] not in ids:
            raise ValueError('Expected position must occur in the candidate catalog')
        if 'relevant_position_ids' in c:
            relevant = c['relevant_position_ids']
            if not relevant or len(set(relevant)) != len(relevant) or not set(relevant) <= ids:
                raise ValueError('Relevance judgments must be nonempty, unique, and in the candidate catalog')
            if c['expected_position_id'] not in relevant:
                raise ValueError('Expected first-choice role must be included among relevant positions')
    if groups['dev'] & groups['test']:
        raise ValueError('A student/group occurs in both dev and test: split groups before evaluation')
    # Repeated profiles across splits are flagged, not silently treated as independent evidence.
    vectors = {split: {fingerprint(c['scores']) for c in data['cases'] if c['split'] == split}
               for split in groups}
    return {'duplicate_score_vectors_across_splits': len(vectors['dev'] & vectors['test']),
            'missing_student_coordinates': sum(nlp.extract_coordinates(c.get('address', {})) is None
                                               for c in data['cases']),
            'missing_position_coordinates': sum(p.get('lat') is None for p in data['positions'])}


def build_inputs(data, split):
    validate(data)
    categories = [Obj(**c) for c in data['categories']]
    positions = []
    for p in data['positions']:
        reqs = Items(Obj(skill_category=c, required_percentage=p['requirements'][c.name]) for c in categories)
        positions.append(Obj(id=p['id'], title=p['title'], tags=p.get('tags', []),
                             company=Obj(name=p.get('company', 'Synthetic company')), requirements=reqs))
    cases = [c for c in data['cases'] if c['split'] == split]
    if not cases:
        raise ValueError(f'No {split} cases')
    # Explicit allowlist: no label, archetype, expected role, split, or approval text enters generators.
    profiles = []
    for c in cases:
        scores = [Obj(skill_category=cat, percentage=c['scores'][cat.name]) for cat in categories]
        profiles.append(nlp.generate_competency_insights(scores)['competency_profile_text'])
    descriptions = [nlp.build_position_description(p) for p in positions]
    students = np.array([[c['scores'][cat.name] / 100 for cat in categories] for c in cases])
    requirements = np.array([[p['requirements'][cat.name] / 100 for cat in categories]
                             for p in data['positions']])
    category = cosine_similarity(students, requirements)
    location = np.array([[nlp.location_similarity(c.get('address', {}), p.get('lat'), p.get('lng'))[0]
                          for p in data['positions']] for c in cases])
    return {'cases': cases, 'positions': data['positions'], 'profiles': profiles,
            'descriptions': descriptions, 'category': category, 'location': location,
            'input_hash': fingerprint({'profiles': profiles, 'descriptions': descriptions,
                                       'category': category.tolist(), 'location': location.tolist()})}


def preprocess(texts, method):
    if method == 'tfidf_regex':
        return nlp._simple_preprocess(texts)
    processed, actual, reason = nlp.preprocess_texts(texts, method, allow_fallback=False)
    if actual != method or reason:
        raise ValueError('Requested model unavailable: no fallback metrics allowed')
    return processed


def text_scores(profiles, descriptions):
    # Production scope: fit a separate vectorizer for each student + all candidates.
    scores = []
    for profile in profiles:
        try:
            vectors = TfidfVectorizer(ngram_range=(1, 3), min_df=1,
                                      sublinear_tf=True).fit_transform([profile] + descriptions)
            scores.append(cosine_similarity(vectors[:1], vectors[1:])[0])
        except ValueError as exc:
            if 'empty vocabulary' not in str(exc):
                raise
            scores.append(np.zeros(len(descriptions)))
    return np.asarray(scores)


def rank(scores):
    # Production sorts stored percentage scores rounded to 2 decimal places.
    # Preserve supplied candidate order for rounded ties; DB query order may differ.
    rounded = np.array([[round(float(value) * 100, 2) for value in row] for row in scores])
    return np.argsort(-rounded, axis=1, kind='stable')


def metrics(inputs, scores):
    cases, positions = inputs['cases'], inputs['positions']
    ids = [p['id'] for p in positions]
    order = rank(scores)
    expected = [c['expected_position_id'] for c in cases]
    predictions = [ids[row[0]] for row in order]
    labels = sorted(set(expected) | set(predictions))
    precision, recall, f1, _ = precision_recall_fscore_support(
        expected, predictions, labels=labels, average='macro', zero_division=0)
    rows = []
    for i, (c, indices) in enumerate(zip(cases, order)):
        ranked_ids = [ids[j] for j in indices]
        expected_rank = ranked_ids.index(c['expected_position_id']) + 1
        row = {'case_id': c['id'], 'group_id': c['group_id'], 'expected': c['expected_position_id'],
               'predicted': ranked_ids[0], 'expected_rank': expected_rank,
               'top3_ids': ranked_ids[:3], 'top1_correct': int(expected_rank == 1),
               'hit_rate3': int(expected_rank <= 3), 'reciprocal_rank': 1 / expected_rank,
               'margin_percent': round(float(scores[i, indices[0]]) * 100, 2) -
                                 round(float(scores[i, indices[1]]) * 100, 2)}
        if 'relevant_position_ids' in c:
            relevant = set(c['relevant_position_ids'])
            hits = [int(p in relevant) for p in ranked_ids[:3]]
            dcg = sum(v / np.log2(j + 2) for j, v in enumerate(hits))
            ideal = sum(1 / np.log2(j + 2) for j in range(min(3, len(relevant))))
            row.update(precision3=sum(hits) / 3, recall3=sum(hits) / len(relevant), ndcg3=dcg / ideal)
        rows.append(row)
    summary = {'top1_accuracy': float(accuracy_score(expected, predictions)),
               'macro_precision': float(precision), 'macro_recall': float(recall), 'macro_f1': float(f1),
               'hit_rate3': float(np.mean([r['hit_rate3'] for r in rows])),
               'mrr': float(np.mean([r['reciprocal_rank'] for r in rows]))}
    if all('ndcg3' in r for r in rows):
        summary.update({key: float(np.mean([r[key] for r in rows]))
                        for key in ['precision3', 'recall3', 'ndcg3']})
    # Report every catalog role (including zero support) for diagnosis.
    per = precision_recall_fscore_support(expected, predictions, labels=ids, zero_division=0)
    per_role = [{'position_id': id_, 'title': positions[i]['title'],
                 'precision': float(per[0][i]), 'recall': float(per[1][i]),
                 'f1': float(per[2][i]), 'support': int(per[3][i])} for i, id_ in enumerate(ids)]
    return summary, rows, {'position_ids': ids, 'confusion_matrix': confusion_matrix(
        expected, predictions, labels=ids).tolist(), 'per_role': per_role}


def run_method(inputs, method, repeats=3):
    if repeats < 1:
        raise ValueError('Use at least one timed repeat')
    trials = []
    for repeat in range(-1, repeats):  # first untimed warm-up, including model loading
        start = time.perf_counter()
        if method == 'structured_only':
            text = np.zeros_like(inputs['category'])
            preprocessing_end = time.perf_counter()
        else:
            processed = preprocess(inputs['profiles'] + inputs['descriptions'], method)
            preprocessing_end = time.perf_counter()
            text = text_scores(processed[:len(inputs['cases'])], processed[len(inputs['cases']):])
        total = .60 * inputs['category'] + .25 * text + .15 * inputs['location']
        rank(total)
        end = time.perf_counter()
        if repeat >= 0:
            trials.append({'repeat': repeat + 1, 'preprocessing_seconds': preprocessing_end - start,
                           'feature_scoring_ranking_seconds': end - preprocessing_end,
                           'total_seconds': end - start})
    # Category/location arrays were precomputed: add no end-to-end latency claim.
    summary, rows, diagnostic = metrics(inputs, total)
    nlp_summary = metrics(inputs, text)[0] if method != 'structured_only' else None
    for row, cat, txt, loc, scores in zip(rows, inputs['category'], text, inputs['location'], total):
        row.update(category_scores=cat.tolist(), nlp_scores=txt.tolist(),
                   location_scores=loc.tolist(), final_scores=scores.tolist())
    return {'method': method, 'status': 'available', 'hybrid': summary, 'nlp_only': nlp_summary,
            'diagnostic': diagnostic, 'predictions': rows, 'timing_trials': trials,
            'median_batch_seconds': statistics.median(t['total_seconds'] for t in trials),
            'note': 'Structured-only removes NLP without changing relative category/location weights. '
                    'Its scores max at .75; only ranking metrics are compared. '
                    'Timed work excludes profile generation, category/location construction, model load, '
                    'data reads, metrics, DB and network. This is a partial warm batch measurement.'}


def compare(data, split='dev', methods=None, repeats=3):
    inputs = build_inputs(data, split)
    results = []
    for method in methods or DEFAULT_METHODS:
        if method not in DEFAULT_METHODS:
            raise ValueError(f'Unknown method: {method}')
        print(f'{split}: {method}', flush=True)
        try:
            results.append(run_method(inputs, method, repeats))
        except (ImportError, OSError, RuntimeError, ValueError) as exc:
            results.append({'method': method, 'status': 'unavailable_or_error',
                            'error': f'{type(exc).__name__}: {exc}'})
    return {'split': split, 'case_count': len(inputs['cases']),
            'position_count': len(inputs['positions']), 'dataset_hash': fingerprint(data),
            'input_hash': inputs['input_hash'], 'environment': environment(),
            'dataset_metadata': data['metadata'], 'warnings': validate(data), 'results': results,
            'candidate_order': [p['id'] for p in inputs['positions']]}


def paired_delta(candidate, baseline, key='top1_correct', samples=2000):
    a, b = candidate['predictions'], baseline['predictions']
    if [r['case_id'] for r in a] != [r['case_id'] for r in b]:
        raise ValueError('Paired comparison requires identical case order')
    if any(key not in r for r in a + b):
        raise ValueError(f'{key} requires complete relevance judgments')
    groups = sorted({r['group_id'] for r in a})
    diffs = np.array([a[i][key] - b[i][key] for i in range(len(a))])
    group_indices = [[i for i, r in enumerate(a) if r['group_id'] == g] for g in groups]
    rng = np.random.default_rng(SEED)
    boot = [float(diffs[np.concatenate([group_indices[j] for j in rng.integers(
        0, len(groups), len(groups))])].mean()) for _ in range(samples)]
    return {'metric': key, 'delta': float(diffs.mean()),
            'ci95': [float(x) for x in np.quantile(boot, [.025, .975])],
            'group_count': len(groups), 'note': 'Paired group bootstrap; synthetic/related templates '
                    'still limit generalization. A CI is not a real-world guarantee.'}


def lock_selection(data, dev_report, method, protocol, path):
    if dev_report['split'] != 'dev' or dev_report['dataset_hash'] != fingerprint(data):
        raise ValueError('Select using the matching development report only')
    candidates = [r for r in dev_report['results'] if r['method'] == method and r['status'] == 'available']
    if not candidates or method == 'structured_only':
        raise ValueError('Select an available NLP candidate')
    if protocol.get('primary_metric') not in ['top1_correct', 'ndcg3']:
        raise ValueError('Primary metric must be top1_correct or ndcg3')
    for key in ['min_top1', 'min_macro_f1', 'min_primary_gain']:
        value = protocol.get(key)
        if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float)) or
                                  not 0 <= value <= 1):
            raise ValueError(f'{key}: use a fraction in [0,1] or None')
    selection = {'method': method, 'weights': list(WEIGHTS), 'tfidf_scope': 'per_student_plus_candidates',
                 'protocol': protocol, 'dataset_hash': fingerprint(data), 'engine_hash':
                 hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                 'helper_hash': hashlib.sha256(Path(nlp.__file__).read_bytes()).hexdigest(),
                 'taxonomy_hash': hashlib.sha256(Path(skill_taxonomy.__file__).read_bytes()).hexdigest(),
                 'environment': environment(), 'dev_metrics': candidates[0]['hybrid']}
    path = Path(path)
    if path.exists():
        if json.loads(path.read_text()) != selection:
            raise ValueError('Selection already locked. Do not tune against test results; start a new study/cohort.')
    else:
        path.write_text(json.dumps(selection, indent=2), encoding='utf-8')
    return selection


def final_test(data, selection, output_dir, repeats=3):
    if selection['dataset_hash'] != fingerprint(data):
        raise ValueError('Dataset changed after lock. Freeze the complete dev/test dataset before selecting.')
    if selection['engine_hash'] != hashlib.sha256(Path(__file__).read_bytes()).hexdigest() or \
       selection['helper_hash'] != hashlib.sha256(Path(nlp.__file__).read_bytes()).hexdigest() or \
       selection['taxonomy_hash'] != hashlib.sha256(Path(skill_taxonomy.__file__).read_bytes()).hexdigest():
        raise ValueError('Code changed after selection; do not silently change the final method')
    if selection['environment']['packages'] != environment()['packages']:
        raise ValueError('Package/model versions changed after selection; reproduce the frozen environment')
    if not any(c['split'] == 'test' for c in data['cases']):
        return {'status': 'not_run', 'reason': 'Bundled cases are development only. Supply an independent test cohort.'}
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    receipt = output / 'final_test.json'
    if receipt.exists():
        saved = json.loads(receipt.read_text())
        if saved['selection_hash'] != fingerprint(selection):
            raise ValueError('This study already has a final test for another selection')
        return saved
    report = compare(data, 'test', ['structured_only', selection['method']], repeats)
    available = {r['method']: r for r in report['results'] if r['status'] == 'available'}
    if not {'structured_only', selection['method']} <= available.keys():
        return {'status': 'not_run', 'reason': 'A required method failed; inspect errors', 'report': report}
    candidate, baseline = available[selection['method']], available['structured_only']
    delta = paired_delta(candidate, baseline, selection['protocol']['primary_metric'])
    protocol = selection['protocol']
    independent = (data['metadata'].get('evidence_kind') == 'expert_independent' and
                   bool(data['metadata'].get('labeling_protocol')))
    thresholds = all(protocol.get(k) is not None for k in ['min_top1', 'min_macro_f1', 'min_primary_gain'])
    agreed = bool(protocol.get('agreed_by') and protocol.get('agreed_before_test_date'))
    if not independent or not thresholds or not agreed:
        decision = 'Descriptive only: independent labels and pre-agreed thresholds are required for acceptance.'
    else:
        passed = (candidate['hybrid']['top1_accuracy'] >= protocol['min_top1'] and
                  candidate['hybrid']['macro_f1'] >= protocol['min_macro_f1'] and
                  delta['ci95'][0] >= protocol['min_primary_gain'])
        decision = ('Meets' if passed else 'Does not establish') + ' the recorded criteria for this cohort.'
    result = {'status': 'complete', 'selection_hash': fingerprint(selection),
              'report': report, 'paired_delta': delta, 'decision': decision,
              'limitation': 'Independence/agreement metadata are researcher declarations, not externally verified. '
                            'Do not reset receipts or reuse this cohort for model selection.'}
    receipt.write_text(json.dumps(result, indent=2), encoding='utf-8')
    return result


def export_report(report, directory):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    (directory / 'report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    for result in report.get('results', []):
        if result['status'] != 'available':
            continue
        for name, rows in [('predictions', result['predictions']), ('timing', result['timing_trials']),
                           ('per_role', result['diagnostic']['per_role'])]:
            keys = sorted(set().union(*(r.keys() for r in rows)))
            with (directory / f'{result["method"]}_{name}.csv').open('w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=keys)
                writer.writeheader()
                writer.writerows([{k: json.dumps(v) if isinstance(v, (list, dict)) else v
                                   for k, v in r.items()} for r in rows])


def improvement_rows(report, method):
    selected = next(r for r in report['results'] if r['method'] == method and r['status'] == 'available')
    baseline = next(r for r in report['results'] if r['method'] == 'structured_only' and r['status'] == 'available')
    return [{'case_id': a['case_id'], 'expected': a['expected'], 'baseline_prediction': b['predicted'],
             'hybrid_prediction': a['predicted'], 'expected_rank': a['expected_rank'],
             'change': 'helped' if a['top1_correct'] > b['top1_correct'] else
                       'hurt' if a['top1_correct'] < b['top1_correct'] else 'unchanged',
             'margin_percent': a['margin_percent']}
            for a, b in zip(selected['predictions'], baseline['predictions'])]
