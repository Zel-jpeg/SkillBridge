r"""Standalone description-only ablation on the original 60 cases/six positions.

Run from repository root:
  .\skillbridge-backend\venv\Scripts\python.exe outputs/nlp_repetition_experiment/compare_descriptions.py

Uses local spaCy Medium only, without fallback/downloads or Django initialization.
All artifacts are written inside description_results/ next to this file.
"""
from __future__ import annotations

import csv
import hashlib
import json
import sys
from pathlib import Path
from time import perf_counter

sys.dont_write_bytecode = True
import compare_repetition as base

np, nlp = base.np, base.nlp
OUT = Path(__file__).resolve().parent / 'description_results'
ARMS = ('current', 'previous_readable', 'concise_bands', 'concise_topics')


def concise(entries, *, bands=False, role_tags=None):
    """Each category and its vocabulary are rendered once; never infer duties/mastery.

    Uses exactly the production selected-tag rule to avoid changing vocabulary
    coverage while changing wording. Tags remain contextual, not measured skills.
    Percentages remain in display/numerical inputs rather than this matching text.
    """
    sentences = []
    for category, score in sorted(entries, key=lambda pair: nlp.canonical_category(pair[0].name)):
        if score <= 0:
            continue
        name = nlp.canonical_category(category.name)
        label = f' {nlp.competency_label(score)}' if bands else ''
        tags = nlp._selected_tags(category.tags, score, category.name)
        sentence = f'{name}{label}.'
        if tags:
            sentence += f' Contextual vocabulary: {", ".join(tags)}.'
        sentences.append(sentence)
    if role_tags is not None:
        tags = [tag for tag in nlp.normalize_tags(role_tags) if not nlp.is_generic_tag(tag)]
        if tags:
            sentences.append(f'Position vocabulary: {", ".join(tags)}.')
    return ' '.join(sentences)


def generate(data):
    positions, old_profiles, old_descriptions, category_scores = base.inputs(data)
    categories = [base.Obj(**item) for item in data['categories']]
    for category in categories:
        category.tags = nlp.suggest_skill_tags(category.name) or category.tags
    profiles = {'current': old_profiles['current'], 'previous_readable': old_profiles['readable_both'],
                'concise_bands': [], 'concise_topics': []}
    descriptions = {'current': old_descriptions['current'], 'previous_readable': old_descriptions['readable_both'],
                    'concise_bands': [], 'concise_topics': []}
    display_profiles, display_positions = [], []
    for case in data['cases']:
        entries = [(c, float(case['scores'][c.name])) for c in categories]
        for arm in ('concise_bands', 'concise_topics'):
            profiles[arm].append(concise(entries, bands=arm == 'concise_bands'))
        display_profiles.append('Assessment results: ' + '; '.join(
            f'{c.name} {score:g}% ({nlp.competency_label(score)})' for c, score in entries) +
            '. Category vocabulary is contextual and does not establish separately assessed technology skills.')
    for position in positions:
        entries = [(r.skill_category, float(r.required_percentage)) for r in position.requirements]
        for arm in ('concise_bands', 'concise_topics'):
            descriptions[arm].append(concise(entries, bands=arm == 'concise_bands', role_tags=position.tags))
        display_positions.append(f'{position.title} at {position.company.name}. Required category percentages: ' +
                                 '; '.join(f'{c.name} {score:g}%' for c, score in entries) +
                                 '. Position vocabulary: ' + ', '.join(position.tags) +
                                 '. Vocabulary does not confirm specific job duties.')
    return positions, profiles, descriptions, category_scores, display_profiles, display_positions


def main():
    raw = base.DATASET.read_bytes()
    data = json.loads(raw)
    old = json.loads((OUT.parent / 'results/results.json').read_text(encoding='utf-8'))
    assert hashlib.sha256(raw).hexdigest() == old['dataset_sha256']
    for filename, digest in old['source_sha256'].items():
        assert hashlib.sha256((base.ROOT / 'skillbridge-backend/api' / filename).read_bytes()).hexdigest() == digest
    positions, profiles, descriptions, category, display_profiles, display_positions = generate(data)
    # Check invariants before fitting or looking at labels.
    shuffled_labels = {**data, 'cases': [{**c, 'expected_position_id': data['cases'][i - 1]['expected_position_id']}
                                       for i, c in enumerate(data['cases'])]}
    _, check_profiles, check_descriptions, check_category, _, _ = generate(shuffled_labels)
    assert check_profiles == profiles and check_descriptions == descriptions
    np.testing.assert_array_equal(check_category, category)
    test_category = base.Obj(name='Web Development', tags=['HTML', 'CSS', 'JavaScript'])
    assert concise([(test_category, 0)]) == ''
    assert 'HTML' not in concise([(test_category, 0)], role_tags=[])
    probe = concise([(test_category, 90)])
    assert probe.count('web development') == 1 and probe.count('HTML') == 1
    assert '90' not in probe and 'excellent' not in probe
    assert 'excellent' in concise([(test_category, 90)], bands=True)
    assert concise([(test_category, 90), (base.Obj(name='Database', tags=['SQL']), 75)]) == concise(
        [(base.Obj(name='Database', tags=['SQL']), 75), (test_category, 90)])
    ids = np.array([p.id for p in positions])
    expected = np.array([c['expected_position_id'] for c in data['cases']])
    structured = .60 * category + .15 * .5
    control, control_order, control_ranks = base.metrics(structured, expected, ids)
    result = {'scope': 'Offline description experiment; same synthetic development cases, no new evidence or system writes.',
              'cases': len(expected), 'positions': len(ids), 'model': 'spacy_md',
              'dataset_sha256': old['dataset_sha256'], 'source_sha256': old['source_sha256'],
              'plan': {'arms': {'current': 'Exact production-generated text with repeated evidence.',
                                'previous_readable': 'Previous narrative-only input; unchanged reference.',
                                'concise_bands': 'Canonical category, competency band and unchanged selected tags, once. '
                                                 'No title/company/orientation; position vocabulary once; numbers remain numerical.',
                                'concise_topics': 'Same concise input with bands removed; numerical component retains scores. '
                                                  'Selected-tag counts still depend on scores as in production.'},
                       'matchers': ['Production spaCy preprocessing + per-student TF-IDF/cosine',
                                    'Exploratory raw spaCy Medium Doc.vector/cosine'],
                       'fixed': 'Same category vectors, tags, labels, stable ID ties, 60/25/15; neutral location 0.5.',
                       'limits': 'No question-level assessed skill annotations or confirmed duties available. '
                                 'Do not describe contextual tags as proven skills. No post-result tuning.'},
              'structured_control': control, 'variants': {}, 'integrity_checks': [],
              'samples': {arm: {'student_matching_input': profiles[arm][0],
                                'position_matching_input': descriptions[arm][0]} for arm in ARMS},
              'display_example': {'student': display_profiles[0], 'position': display_positions[0]},
              'input_sizes': {arm: {'mean_student_words': float(np.mean([len(t.split()) for t in profiles[arm]])),
                                    'mean_position_words': float(np.mean([len(t.split()) for t in descriptions[arm]]))}
                              for arm in ARMS}}
    OUT.mkdir(parents=True, exist_ok=True)
    model = nlp._load_model('spacy_md')  # Strict load; no API or fallback.
    assert model.vocab.vectors.n_keys > 0
    result['model_version'] = model.meta.get('version')
    unique = list(dict.fromkeys(t for arm in ARMS for t in profiles[arm] + descriptions[arm]))
    processed, vectors = {}, {}
    start = perf_counter()
    for text, doc in zip(unique, model.pipe(unique, batch_size=32)):
        processed[text] = ' '.join(t.lemma_.casefold().strip() for t in doc
                                   if not t.is_stop and not t.is_punct and not t.is_space and t.lemma_.strip())
        vectors[text] = np.asarray(doc.vector, dtype=float).copy()
    rows, baseline = [], {}
    for arm in ARMS:
        ps, ds = profiles[arm], descriptions[arm]
        tfidf_scores = []
        for text in ps:
            matrix = base.TfidfVectorizer(ngram_range=(1, 3), min_df=1, sublinear_tf=True).fit_transform(
                [processed[text]] + [processed[d] for d in ds])
            tfidf_scores.append(base.cosine_similarity(matrix[:1], matrix[1:])[0])
        student_vectors = np.array([vectors[t] for t in ps])
        position_vectors = np.array([vectors[t] for t in ds])
        assert (np.linalg.norm(student_vectors, axis=1) > 0).all()
        assert (np.linalg.norm(position_vectors, axis=1) > 0).all()
        native_scores = base.cosine_similarity(student_vectors, position_vectors)
        result['variants'][arm] = {}
        for matcher, scores in [('tfidf', np.array(tfidf_scores)), ('native_vectors', native_scores)]:
            assert scores.shape == category.shape and np.isfinite(scores).all()
            item = {'candidate_similarity_std_mean': float(scores.std(axis=1).mean()),
                    'min_similarity': float(scores.min()), 'max_similarity': float(scores.max())}
            for mode, values in [('nlp', scores), ('hybrid', structured + .25 * np.maximum(scores, 0))]:
                metrics, order, ranks = base.metrics(values, expected, ids)
                if arm == 'current':
                    baseline[(matcher, mode)] = (order.copy(), ranks.copy())
                old_order, old_ranks = baseline[(matcher, mode)]
                metrics.update(top1_changed=int((order[:, 0] != old_order[:, 0]).sum()),
                               helped_top1=int(((old_ranks != 1) & (ranks == 1)).sum()),
                               hurt_top1=int(((old_ranks == 1) & (ranks != 1)).sum()),
                               full_order_changed=int(np.any(order != old_order, axis=1).sum()))
                metrics['per_role'] = {p.title: {'cases': int((expected == p.id).sum()),
                                                'top1': float(np.mean(ranks[expected == p.id] == 1))} for p in positions}
                metrics['changed_cases'] = [{'case_id': case['id'], 'expected': int(expected[i]),
                                             'before': int(ids[old_order[i, 0]]), 'after': int(ids[order[i, 0]]),
                                             'before_expected_rank': int(old_ranks[i]), 'after_expected_rank': int(ranks[i])}
                                            for i, case in enumerate(data['cases'])
                                            if order[i, 0] != old_order[i, 0]]
                metrics['versus_structured_top1'] = {'helped': int(((control_ranks != 1) & (ranks == 1)).sum()),
                                                    'hurt': int(((control_ranks == 1) & (ranks != 1)).sum())}
                item[mode] = metrics
                if matcher == 'tfidf' and arm in ('current', 'previous_readable'):
                    old_arm = 'current' if arm == 'current' else 'readable_both'
                    prior = next(m for m in old['models'] if m['model'] == 'spacy_md')['variants'][old_arm][mode]
                    for key in ('top1', 'top3', 'macro_f1', 'mean_expected_rank'):
                        assert abs(prior[key] - metrics[key]) < 1e-12
                for i, case in enumerate(data['cases']):
                    for rank, j in enumerate(order[i], 1):
                        rows.append({'variant': arm, 'matcher': matcher, 'ranking': mode, 'case_id': case['id'],
                                     'expected_position_id': int(expected[i]), 'position_id': int(ids[j]),
                                     'position': positions[j].title, 'rank': rank, 'expected_rank': int(ranks[i]),
                                     'category_points': float(category[i, j] * 100), 'nlp_points': float(scores[i, j] * 100),
                                     'location_points': 50, 'score_points': float(values[i, j] * 100)})
            result['variants'][arm][matcher] = item
            print(f'{arm} / {matcher}: NLP {item["nlp"]["top1"]:.1%}; hybrid {item["hybrid"]["top1"]:.1%}', flush=True)
    assert 'django.db' not in sys.modules
    assert hashlib.sha256(base.DATASET.read_bytes()).hexdigest() == old['dataset_sha256']
    for filename, digest in old['source_sha256'].items():
        assert hashlib.sha256((base.ROOT / 'skillbridge-backend/api' / filename).read_bytes()).hexdigest() == digest
    result['integrity_checks'] = ['Same dataset and production generator hashes as earlier test',
                                  'Expected-label permutation leaves text/category inputs unchanged',
                                  'Zero-score category supplies no positive vocabulary',
                                  'New text uses no expanded evidence repetitions', 'Stable category ordering',
                                  'Prior Medium TF-IDF baseline metrics reproduced exactly',
                                  'No Django database imports; source/data unchanged; no fallback/downloads']
    result['elapsed_seconds_after_load'] = round(perf_counter() - start, 3)
    result['input_sha256'] = {arm: hashlib.sha256(json.dumps(profiles[arm] + descriptions[arm],
                                                         ensure_ascii=False).encode()).hexdigest() for arm in ARMS}
    (OUT / 'results.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    with (OUT / 'rankings.csv').open('w', encoding='utf-8', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    report = ['# Concise description experiment', '',
              'Same 60 synthetic development cases and six positions. Actual spaCy Medium; no fallback, new model, '
              'new facts, application edits or database access. All numerical category inputs are unchanged; '
              'hybrid stays 60/25/15 with neutral location. TF-IDF fits per student.', '',
              f'Structured category/location control: **{control["top1"]:.1%} Top-1**.', '',
              '| Text | Matcher | NLP Top-1 | NLP Top-3 | Hybrid Top-1 | Hybrid helped / hurt vs current |',
              '|---|---|---:|---:|---:|---:|']
    for arm, matchers in result['variants'].items():
        for matcher, item in matchers.items():
            a, b = item['nlp'], item['hybrid']
            report.append(f'| {arm} | {matcher} | {a["top1"]:.1%} | {a["top3"]:.1%} | '
                          f'{b["top1"]:.1%} | {b["helped_top1"]} / {b["hurt_top1"]} |')
    report += ['', '## Fixed comparison plan', '']
    report += [f'- **{arm}:** {description}' for arm, description in result['plan']['arms'].items()]
    report += ['', 'The new matching text renders each category and its selected vocabulary once. Shared terms can '
               'legitimately occur in multiple categories. It drops titles, companies, orientation sentences and numeric '
               'percentages. Display descriptions retain exact percentages and distinguish contextual vocabulary '
               'from individually assessed technology skills. Bands are tested separately. The existing score-dependent '
               'tag selection is preserved, so this does not remove all score influence from text.', '',
               '## What the test can establish', '',
               'It measures wording/representation effects using existing category tags and position vocabulary. '
               'It does not test confirmed duties or question-level skill evidence: those are absent, and none were '
               'invented. Improving prose cannot supply missing evidence. Student text receives no expected or '
               'inferred position title. Position vocabulary is retained as context, not asserted as confirmed duties.', '',
               'TF-IDF is the current system method. Native vectors are a separate exploratory comparator, using raw '
               'Doc.vector cosine with negatives clipped only for hybrid scoring. Neither model nor weights were '
               'tuned after results. These familiar synthetic labels are not independent real placement validation.', '',
               'Compare each result with both its current matcher baseline and the 90% structured control. '
               'A hybrid gain alone does not establish better NLP. results.json contains per-role metrics, '
               'helped/hurt cases, score dispersion and integrity checks; rankings.csv contains every candidate score.', '',
               '## Example display text', '', '**Student:** ' + display_profiles[0], '',
               '**Position:** ' + display_positions[0], '', '## Example matching inputs', '']
    for arm, sample in result['samples'].items():
        if arm.startswith('concise'):
            report += [f'### {arm}', '', '**Student:** ' + sample['student_matching_input'], '',
                       '**Position:** ' + sample['position_matching_input'], '']
    report += ['## Verification', ''] + ['- ' + check for check in result['integrity_checks']]
    (OUT / 'REPORT.md').write_text('\n'.join(report) + '\n', encoding='utf-8')
    print(f'Report: {OUT / "REPORT.md"}', flush=True)


if __name__ == '__main__':
    main()
