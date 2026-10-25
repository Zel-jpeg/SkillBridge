r"""Disposable offline ablation. No Django setup, database, API, or model downloads.

Run from the repository root:
  .\skillbridge-backend\venv\Scripts\python.exe outputs/nlp_repetition_experiment/compare_repetition.py
Delete this directory to remove the experiment and its generated results.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sys
from importlib.metadata import version
from pathlib import Path
from time import perf_counter
from types import SimpleNamespace as Obj

ROOT = Path(__file__).resolve().parents[2]
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / 'skillbridge-backend'))

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import accuracy_score, f1_score
from sklearn.metrics.pairwise import cosine_similarity
from api import recommendation_nlp as nlp

VARIANTS = ('current', 'position_once', 'both_once', 'readable_position', 'readable_both')
DATASET = ROOT / 'skillbridge-backend/api/data/nlp_evaluation.json'


class Items(list):
    def all(self):
        return self


def transform(text, entries, *, position_tags=None, readable=False):
    """Change only the deliberately expanded evidence section, not the narrative.

    'once' retains each distinct evidence phrase once (including role phrases).
    'readable' removes the evidence tail; categories/bands/tags remain in prose.
    This intentionally does NOT globally deduplicate words such as JavaScript.
    """
    marker = 'Requirement evidence: ' if position_tags is not None else 'Skill evidence: '
    prefix, found, tail = text.partition(marker)
    if not found:
        return text
    if readable:
        disclaimer = (' Category vocabulary is contextual; these terms were not separately assessed.'
                      if position_tags is None else '')
        return prefix.rstrip() + disclaimer
    _, evidence = nlp._evidence_parts(entries)
    if position_tags is not None:
        tags = [tag for tag in nlp.normalize_tags(position_tags) if not nlp.is_generic_tag(tag)]
        evidence += [tag for tag in tags[:12] for _ in range(2)]
    original = ' '.join(evidence)
    assert tail.startswith(original + '.'), 'Production evidence format changed; review experiment.'
    unique = list(dict.fromkeys(evidence))
    result = prefix + marker + ' '.join(unique) + tail[len(original):]
    assert result.startswith(prefix + marker)
    assert len(result) <= len(text)
    return result


def inputs(data):
    categories = [Obj(**item) for item in data['categories']]
    for category in categories:
        category.tags = nlp.suggest_skill_tags(category.name) or category.tags
    positions = []
    for item in sorted(data['positions'], key=lambda item: item['id']):
        requirements = Items(Obj(skill_category=c, required_percentage=item['requirements'][c.name])
                             for c in categories)
        positions.append(Obj(id=item['id'], title=item['title'], company=Obj(name=item['company']),
                             tags=nlp.suggest_position_tags(item['title']) or item['tags'],
                             requirements=requirements))
    profiles = {key: [] for key in VARIANTS}
    descriptions = {key: [] for key in VARIANTS}
    for case in data['cases']:
        scores = [Obj(skill_category=c, percentage=case['scores'][c.name]) for c in categories]
        entries = [(s.skill_category, float(s.percentage)) for s in scores]
        text = nlp.generate_competency_insights(scores)['competency_profile_text']
        for key in VARIANTS:
            profiles[key].append(transform(text, entries, readable=key == 'readable_both')
                                 if key in ('both_once', 'readable_both') else text)
    for position in positions:
        text = nlp.build_position_description(position)
        entries = [(r.skill_category, float(r.required_percentage)) for r in position.requirements]
        for key in VARIANTS:
            descriptions[key].append(text if key == 'current' else transform(
                text, entries, position_tags=position.tags, readable=key.startswith('readable')))
    # Labels never enter either generator. Position-only arms retain exact student inputs.
    for key in ('position_once', 'readable_position'):
        assert profiles[key] == profiles['current']
    assert all('Requirement evidence:' not in t for t in descriptions['readable_both'])
    assert all('Skill evidence:' not in t for t in profiles['readable_both'])
    student_vectors = [[case['scores'][c.name] for c in categories] for case in data['cases']]
    requirement_vectors = [[r.required_percentage for r in p.requirements] for p in positions]
    return positions, profiles, descriptions, cosine_similarity(student_vectors, requirement_vectors)


def metrics(scores, expected, ids):
    order = np.argsort(-scores, axis=1, kind='stable')
    predicted = [ids[row[0]] for row in order]
    ranks = [list(ids[order[i]]).index(label) + 1 for i, label in enumerate(expected)]
    return {'top1': float(accuracy_score(expected, predicted)),
            'top3': float(np.mean(np.array(ranks) <= 3)),
            'macro_f1': float(f1_score(expected, predicted, average='macro', zero_division=0)),
            'mean_expected_rank': float(np.mean(ranks))}, order, np.array(ranks)


def screenshot_sample():
    values = {'Cloud': 75, 'Database': 25, 'DevOps': 50, 'Networking': 25,
              'Operating Systems': 25, 'Programming': 75, 'Tools': 75,
              'Version Control': 90, 'Web Development': 90}
    requirements = Items(Obj(skill_category=Obj(name=name, tags=nlp.suggest_skill_tags(name)),
                             required_percentage=value) for name, value in values.items())
    tags = ['frontend', 'React', 'JavaScript', 'responsive layout', 'CSS styling',
            'UI development', 'browser compatibility', 'Version Control', 'Web Development',
            'Cloud', 'Programming', 'Tools', 'DevOps', 'Database', 'Networking', 'Operating Systems']
    position = Obj(title='Frontend Developer', company=Obj(name='Sample Company'),
                   tags=tags, requirements=requirements)
    text = nlp.build_position_description(position)
    entries = [(r.skill_category, float(r.required_percentage)) for r in requirements]
    return {'note': 'Synthetic reconstruction of the supplied screenshot, not a database read. '
                    'Uses current curated tags; separate from the five-category benchmark.',
            'current': text,
            'once': transform(text, entries, position_tags=tags),
            'readable': transform(text, entries, position_tags=tags, readable=True)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--models', nargs='+', choices=['regex', *nlp.MODEL_OPTIONS],
                        default=['regex', 'spacy_sm', 'spacy_md'])
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parent / 'results')
    args = parser.parse_args()
    raw = DATASET.read_bytes()
    data = json.loads(raw)
    positions, profiles, descriptions, category = inputs(data)
    # A label permutation must leave every generated input and category score unchanged.
    permuted = {**data, 'cases': [{**case, 'expected_position_id': data['cases'][i - 1]['expected_position_id']}
                                for i, case in enumerate(data['cases'])]}
    _, check_profiles, check_descriptions, check_category = inputs(permuted)
    assert check_profiles == profiles and check_descriptions == descriptions
    np.testing.assert_array_equal(check_category, category)
    ids = np.array([p.id for p in positions])
    expected = np.array([case['expected_position_id'] for case in data['cases']])
    assert len(set(ids)) == len(ids) and set(expected) <= set(ids)
    location = np.full_like(category, .5)  # Neutral missing-coordinate location; identical in every arm.
    structured = .60 * category + .15 * location
    control, _, _ = metrics(structured, expected, ids)
    result = {'scope': 'Offline synthetic development ablation; no application or database writes.',
              'cases': len(expected), 'positions': len(ids), 'dataset_sha256': hashlib.sha256(raw).hexdigest(),
              'text_generation_version': nlp.TEXT_GENERATION_VERSION,
              'source_sha256': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in (
                  ROOT / 'skillbridge-backend/api/recommendation_nlp.py',
                  ROOT / 'skillbridge-backend/api/skill_taxonomy.py')},
              'versions': {name: version(name) for name in ('numpy', 'scikit-learn')},
              'structured_control': control,
              'input_sizes': {key: {'mean_student_words': float(np.mean([len(t.split()) for t in profiles[key]])),
                                   'mean_position_words': float(np.mean([len(t.split()) for t in descriptions[key]]))}
                              for key in VARIANTS},
              'models': [], 'text_samples': {key: {'student': profiles[key][0], 'position': descriptions[key][0]}
                                            for key in VARIANTS},
              'screenshot_example': screenshot_sample()}
    rows = []
    for model in args.models:
        print(f'Evaluating {model}...', flush=True)
        model_result = {'model': model, 'status': 'complete', 'variants': {}}
        start = perf_counter()
        baseline = {}
        try:
            # Process one combined batch so every arm uses the same actual model.
            combined = [t for key in VARIANTS for t in profiles[key] + descriptions[key]]
            if model == 'regex':
                processed = nlp._simple_preprocess(combined)
                actual = 'simple_fallback (explicit regex control)'
            else:
                processed, actual, reason = nlp.preprocess_texts(combined, model, allow_fallback=False)
                assert actual == model and reason is None
            model_result['actual_model'] = actual
            offset = 0
            for key in VARIANTS:
                count = len(expected) + len(ids)
                texts = processed[offset:offset + count]
                offset += count
                scores = []
                # Production fits a fresh corpus per student, NOT all students together.
                for i in range(len(expected)):
                    vectorizer = TfidfVectorizer(ngram_range=(1, 3), min_df=1, sublinear_tf=True)
                    matrix = vectorizer.fit_transform([texts[i]] + texts[len(expected):])
                    scores.append(cosine_similarity(matrix[:1], matrix[1:])[0])
                scores = np.array(scores)
                arm = {}
                for mode, values in [('nlp', scores), ('hybrid', structured + .25 * scores)]:
                    summary, order, ranks = metrics(values, expected, ids)
                    if key == 'current':
                        baseline[mode] = (order.copy(), ranks.copy(), values.copy())
                    old_order, old_ranks, old_values = baseline[mode]
                    summary.update(top1_changed=int(np.sum(order[:, 0] != old_order[:, 0])),
                                   full_order_changed=int(np.sum(np.any(order != old_order, axis=1))),
                                   helped_top1=int(np.sum((old_ranks != 1) & (ranks == 1))),
                                   hurt_top1=int(np.sum((old_ranks == 1) & (ranks != 1))),
                                   mean_absolute_score_change_points=float(np.mean(np.abs(values - old_values)) * 100))
                    summary['per_expected_role'] = {
                        p.title: {'cases': int(np.sum(expected == p.id)),
                                  'top1': float(np.mean(ranks[expected == p.id] == 1))} for p in positions}
                    arm[mode] = summary
                    for i, case in enumerate(data['cases']):
                        for rank, j in enumerate(order[i], 1):
                            rows.append({'model': model, 'variant': key, 'ranking': mode,
                                         'case_id': case['id'], 'expected_position_id': int(expected[i]),
                                         'position_id': int(ids[j]), 'position': positions[j].title, 'rank': rank,
                                         'expected_rank': int(ranks[i]), 'category_points': float(category[i, j] * 100),
                                         'nlp_points': float(scores[i, j] * 100), 'location_points': 50,
                                         'score_points': float(values[i, j] * 100)})
                model_result['variants'][key] = arm
        except Exception as exc:
            model_result.update(status='unavailable_or_error', error=f'{type(exc).__name__}: {exc}')
            print(f'  {model}: {model_result["error"]}', flush=True)
        model_result['elapsed_seconds'] = round(perf_counter() - start, 3)
        result['models'].append(model_result)
        print(f'  {model_result["status"]} ({model_result["elapsed_seconds"]}s)', flush=True)
    assert 'django.db' not in sys.modules, 'Experiment must not initialize Django.'
    assert hashlib.sha256(DATASET.read_bytes()).hexdigest() == result['dataset_sha256']
    for filename, digest in result['source_sha256'].items():
        assert hashlib.sha256((ROOT / 'skillbridge-backend/api' / filename).read_bytes()).hexdigest() == digest
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / 'results.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    if rows:
        with (args.output / 'rankings.csv').open('w', newline='', encoding='utf-8') as handle:
            writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
            writer.writeheader()
            writer.writerows(rows)
    report = ['# Offline repetition experiment', '',
              f'{len(expected)} synthetic development cases; {len(ids)} candidate positions. No live data used.', '',
              'TF-IDF is fitted per student plus all positions, as in production. Category inputs are fixed; '
              'location is neutral 50% throughout. Hybrid uses 60/25/15. Ties follow position ID.', '',
              f'Structured category/location control Top-1: {control["top1"]:.1%}.', '',
              '| Model | Input | NLP Top-1 | NLP Top-3 | Hybrid Top-1 | Hybrid Top-3 | Hybrid winners changed | Helped / hurt |',
              '|---|---|---:|---:|---:|---:|---:|---:|']
    for model in result['models']:
        if model['status'] != 'complete':
            report += [f'| {model["model"]} | unavailable/error | — | — | — | — | — | — |']
            continue
        for key, arm in model['variants'].items():
            a, b = arm['nlp'], arm['hybrid']
            report += [f'| {model["model"]} | {key} | {a["top1"]:.1%} | {a["top3"]:.1%} | '
                       f'{b["top1"]:.1%} | {b["top3"]:.1%} | {b["top1_changed"]} | '
                       f'{b["helped_top1"]} / {b["hurt_top1"]} |']
    report += ['', '## Text size', '', '| Input | Mean student words | Mean position words |', '|---|---:|---:|']
    for key, sizes in result['input_sizes'].items():
        report += [f'| {key} | {sizes["mean_student_words"]:.1f} | {sizes["mean_position_words"]:.1f} |']
    report += ['', '## Interpretation limits', '',
               'These familiar synthetic labels are development references, not independent judgments of placement '
               'quality. The benchmark has five categories; the screenshot example has nine and is shown separately. '
               'No thresholds, tags, labels, model choices or weights were tuned after viewing results. '
               'Elapsed times include loading, preprocessing and scoring, with cache reuse; they are not a speed benchmark.', '',
               'Inspect rankings.csv for every candidate and component; results.json includes macro F1, expected ranks, '
               'per-role agreement, model failures, hashes and actual before/after texts. No model fallback is silently substituted.', '',
               'A cleaner input is not automatically a more accurate input. Before a system change, review helped/hurt '
               'cases with instructors and repeat on independent labeled evidence. Any production text change would '
               'need generator tests, evaluation, recommendation provenance/freshness review and an explicit refresh '
               'decision for existing results. This experiment does none of those production operations.']
    (args.output / 'REPORT.md').write_text('\n'.join(report) + '\n', encoding='utf-8')
    sample = result['screenshot_example']
    (args.output / 'POSITION_EXAMPLE.md').write_text('\n\n'.join(
        ['# Synthetic screenshot example', sample['note']] +
        [f'## {key}\n\n{sample[key]}' for key in ('current', 'once', 'readable')]) + '\n', encoding='utf-8')
    print(f'Report: {args.output.resolve() / "REPORT.md"}', flush=True)
    if not any(row['status'] == 'complete' for row in result['models']):
        raise SystemExit('No model completed; inspect results.json.')


if __name__ == '__main__':
    main()
