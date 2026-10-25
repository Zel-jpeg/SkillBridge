r"""Offline three-model comparison on the previous experiment's exact data.

Run: .\skillbridge-backend\venv\Scripts\python.exe outputs/nlp_repetition_experiment/compare_models.py
No Django, database, network downloads, application edits or model fallback.
"""
from __future__ import annotations

import csv
import hashlib
import json
import sys
from importlib.metadata import version
from pathlib import Path
from time import perf_counter

sys.dont_write_bytecode = True
import compare_repetition as base

np = base.np
nlp = base.nlp
cosine_similarity = base.cosine_similarity
TfidfVectorizer = base.TfidfVectorizer
ARMS = ('current', 'readable_position', 'readable_both')
MODELS = ('spacy_sm', 'spacy_md', 'stanza_en')
OUT = Path(__file__).resolve().parent / 'model_results'


def main():
    raw = base.DATASET.read_bytes()
    data = json.loads(raw)
    positions, profiles, descriptions, category = base.inputs(data)
    ids = np.array([p.id for p in positions])
    expected = np.array([c['expected_position_id'] for c in data['cases']])
    count = len(expected)
    structured = .60 * category + .15 * .5
    previous = json.loads((OUT.parent / 'results/results.json').read_text(encoding='utf-8'))
    dataset_hash = hashlib.sha256(raw).hexdigest()
    assert dataset_hash == previous['dataset_sha256'], 'Dataset changed since earlier experiment.'
    for arm in ARMS:
        assert profiles[arm][0] == previous['text_samples'][arm]['student']
        assert descriptions[arm][0] == previous['text_samples'][arm]['position']
    source_hashes = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in (
        base.ROOT / 'skillbridge-backend/api/recommendation_nlp.py',
        base.ROOT / 'skillbridge-backend/api/skill_taxonomy.py')}
    assert source_hashes == previous['source_sha256'], 'Generators changed since earlier experiment.'
    permuted = {**data, 'cases': [{**c, 'expected_position_id': data['cases'][i - 1]['expected_position_id']}
                                for i, c in enumerate(data['cases'])]}
    _, p_check, d_check, c_check = base.inputs(permuted)
    assert p_check == profiles and d_check == descriptions
    np.testing.assert_array_equal(c_check, category)
    control, _, _ = base.metrics(structured, expected, ids)
    result = {'scope': 'Same synthetic development data; three actual preprocessing models; native representations '
                       'where exposed. Not a claim of independent accuracy or equivalent model capabilities.',
              'cases': count, 'positions': len(ids), 'dataset_sha256': dataset_hash,
              'source_sha256': source_hashes, 'structured_control': control,
              'versions': {p: version(p) for p in ('numpy', 'scikit-learn', 'spacy', 'stanza')},
              'method': {'tfidf': 'Production preprocessing, strict actual model; per-student TF-IDF (1,3), '
                                  'min_df=1, sublinear_tf=True; cosine similarity.',
                         'native': 'spaCy raw Doc.vector over exact generated descriptions, then cosine. '
                                   'Medium uses mean static word vectors. Small uses mean contextual tok2vec '
                                   'features, an exploratory diagnostic NOT a trained sentence-similarity model. '
                                   'No stopword/metadata removal or post-result tuning. Stanza tokenize/lemma '
                                   'does not expose an equivalent document embedding.',
                         'hybrid': '0.60 category + 0.25 NLP + 0.15 neutral location (0.5). '
                                   'Negative native cosine clipped to zero for the hybrid only; NLP-only ranking '
                                   'retains raw cosine. Stable ascending position ID for ties.'},
              'input_sha256': {arm: hashlib.sha256(json.dumps(profiles[arm] + descriptions[arm],
                                                           ensure_ascii=False).encode()).hexdigest()
                               for arm in ARMS},
              'models': []}
    csv_rows = []
    OUT.mkdir(parents=True, exist_ok=True)

    def checkpoint():
        (OUT / 'results.json').write_text(json.dumps(result, indent=2), encoding='utf-8')

    def evaluate(model_result, arm, matcher, similarities, extra=None):
        assert similarities.shape == category.shape and np.isfinite(similarities).all()
        row = {'input': arm, 'matcher': matcher, **(extra or {}),
               'similarity_diagnostics': {'min': float(similarities.min()), 'max': float(similarities.max()),
                                          'mean_candidate_std': float(similarities.std(axis=1).mean()),
                                          'negative_pairs': int((similarities < 0).sum())}}
        for mode, scores in [('nlp', similarities), ('hybrid', structured + .25 * np.maximum(0, similarities))]:
            metrics, order, ranks = base.metrics(scores, expected, ids)
            metrics['per_expected_role'] = {
                p.title: {'cases': int((expected == p.id).sum()),
                          'top1': float(np.mean(ranks[expected == p.id] == 1))} for p in positions}
            metrics['predictions'] = [{'case_id': c['id'], 'expected_position_id': int(expected[i]),
                                       'predicted_position_id': int(ids[order[i, 0]]),
                                       'expected_rank': int(ranks[i]),
                                       'full_ranking': [int(ids[j]) for j in order[i]]}
                                      for i, c in enumerate(data['cases'])]
            row[mode] = metrics
            for i, case in enumerate(data['cases']):
                for rank, j in enumerate(order[i], 1):
                    csv_rows.append({'model': model_result['model'], 'input': arm, 'matcher': matcher,
                                     'ranking': mode, 'case_id': case['id'], 'expected_position_id': int(expected[i]),
                                     'position_id': int(ids[j]), 'position': positions[j].title, 'rank': rank,
                                     'category_points': float(category[i, j] * 100),
                                     'nlp_points': float(similarities[i, j] * 100), 'location_points': 50,
                                     'score_points': float(scores[i, j] * 100)})
        model_result['comparisons'].append(row)
        print(f'  {arm} / {matcher}: NLP {row["nlp"]["top1"]:.1%}, hybrid {row["hybrid"]["top1"]:.1%}', flush=True)
        checkpoint()

    for model_id in MODELS:
        start = perf_counter()
        model_result = {'model': model_id, 'status': 'running', 'comparisons': []}
        result['models'].append(model_result)
        print(f'Loading {model_id} (strict; no downloads or fallback)...', flush=True)
        try:
            model = nlp._load_model(model_id)
        except Exception as exc:
            model_result.update(status='unavailable', error=f'{type(exc).__name__}: {exc}',
                                native_status='unsupported' if model_id == 'stanza_en' else 'unavailable')
            print(f'  unavailable: {type(exc).__name__}: {exc}', flush=True)
            checkpoint()
            continue
        if model_id.startswith('spacy'):
            model_result['pipeline'] = {'name': model.meta.get('name'), 'version': model.meta.get('version'),
                                        'components': model.pipe_names, 'static_vectors': int(model.vocab.vectors.n_keys)}
            model_result['native_status'] = 'exploratory_contextual_features' if model_id == 'spacy_sm' else 'static_word_vectors'
        else:
            model_result['pipeline'] = {'processors': list(model.processors),
                                        'resource_directory': str(getattr(model, 'dir', 'unknown'))}
            model_result['native_status'] = 'unsupported'
            model_result['native_note'] = 'Configured tokenize/lemma pipeline has no document similarity vector API. '
            model_result['native_note'] += 'No substitute model or fabricated native score is used.'
        all_texts = [text for arm in ARMS for text in profiles[arm] + descriptions[arm]]
        # Run the model once per distinct document; use its output for both comparisons.
        unique = list(dict.fromkeys(all_texts))
        processed_map, vectors = {}, {}
        vector_diagnostics = {}
        try:
            if model_id.startswith('spacy'):
                for text, doc in zip(unique, model.pipe(unique, batch_size=32)):
                    processed_map[text] = ' '.join(t.lemma_.casefold().strip() for t in doc
                                                 if not t.is_stop and not t.is_punct and not t.is_space and t.lemma_.strip())
                    vectors[text] = np.asarray(doc.vector, dtype=float).copy()
                    if model_id == 'spacy_sm':
                        assert doc.tensor.shape[0] == len(doc) and doc.tensor.shape[1] > 0
                        np.testing.assert_allclose(doc.vector, doc.tensor.mean(axis=0), rtol=1e-5, atol=1e-6)
                    vector_diagnostics[text] = {'tokens': len(doc),
                                                'static_vector_token_fraction': sum(t.has_vector for t in doc) / max(1, len(doc))
                                                if model_id == 'spacy_md' else None}
            else:
                # Uses exactly the production Stanza filtering, with strict fallback disabled.
                processed, actual, reason = nlp.preprocess_texts(unique, model_id, allow_fallback=False)
                assert actual == model_id and reason is None and len(processed) == len(unique)
                processed_map = dict(zip(unique, processed))
            for arm in ARMS:
                ps = [processed_map[text] for text in profiles[arm]]
                ds = [processed_map[text] for text in descriptions[arm]]
                similarities = []
                for profile in ps:
                    matrix = TfidfVectorizer(ngram_range=(1, 3), min_df=1, sublinear_tf=True).fit_transform([profile] + ds)
                    similarities.append(cosine_similarity(matrix[:1], matrix[1:])[0])
                similarities = np.array(similarities)
                # Existing spaCy TF-IDF results must reproduce, before evaluating alternatives.
                old = next((m for m in previous['models'] if m['model'] == model_id and m['status'] == 'complete'), None)
                if old:
                    old_metrics = old['variants'][arm]['nlp']
                    actual_metrics, _, _ = base.metrics(similarities, expected, ids)
                    for key in ('top1', 'top3', 'macro_f1', 'mean_expected_rank'):
                        assert abs(old_metrics[key] - actual_metrics[key]) < 1e-12, f'Baseline mismatch: {model_id}/{arm}/{key}'
                evaluate(model_result, arm, 'tfidf', similarities)
                if vectors:
                    student_matrix = np.array([vectors[t] for t in profiles[arm]])
                    position_matrix = np.array([vectors[t] for t in descriptions[arm]])
                    assert (np.linalg.norm(student_matrix, axis=1) > 0).all()
                    assert (np.linalg.norm(position_matrix, axis=1) > 0).all()
                    similarities = cosine_similarity(student_matrix, position_matrix)
                    evaluate(model_result, arm, 'native_doc_vector', similarities,
                             {'vector_dimensions': int(student_matrix.shape[1]),
                              'representation': model_result['native_status'],
                              'mean_static_vector_coverage': float(np.mean([
                                  vector_diagnostics[t]['static_vector_token_fraction']
                                  for t in profiles[arm] + descriptions[arm]])) if model_id == 'spacy_md' else None})
            model_result['status'] = 'complete'
        except Exception as exc:
            model_result.update(status='error', error=f'{type(exc).__name__}: {exc}')
            print(f'  error: {model_result["error"]}', flush=True)
        model_result['elapsed_seconds'] = round(perf_counter() - start, 3)
        checkpoint()
    assert 'django.db' not in sys.modules
    assert hashlib.sha256(base.DATASET.read_bytes()).hexdigest() == dataset_hash
    for filename, digest in source_hashes.items():
        assert hashlib.sha256((base.ROOT / 'skillbridge-backend/api' / filename).read_bytes()).hexdigest() == digest
    result['integrity_checks'] = ['Same dataset/generator hashes as earlier run', 'Label permutation does not affect inputs',
                                  'No Django database import', 'Dataset/generator files unchanged',
                                  'Prior completed spaCy TF-IDF metrics reproduced exactly',
                                  'No fallback; no zero/nonfinite native vectors accepted']
    checkpoint()
    if csv_rows:
        with (OUT / 'rankings.csv').open('w', encoding='utf-8', newline='') as handle:
            writer = csv.DictWriter(handle, fieldnames=list(csv_rows[0]))
            writer.writeheader()
            writer.writerows(csv_rows)
    report = ['# Three-model offline comparison', '',
              'Same 60 synthetic cases, six positions, curated tags, labels and production text generators as the previous run. '
              'TF-IDF is fitted per student. Hybrid weights stay 60/25/15; location is neutral 50%. No system changes.', '',
              f'Structured control Top-1: **{control["top1"]:.1%}**.', '',
              '| Model | Input | Matcher | NLP Top-1 | NLP Top-3 | Hybrid Top-1 | Hybrid Top-3 |',
              '|---|---|---|---:|---:|---:|---:|']
    for model in result['models']:
        for row in model['comparisons']:
            label = row['matcher']
            if model['model'] == 'spacy_sm' and label == 'native_doc_vector':
                label = 'contextual feature average (exploratory)'
            if model['model'] == 'spacy_md' and label == 'native_doc_vector':
                label = 'static word-vector average'
            report += [f'| {model["model"]} | {row["input"]} | {label} | {row["nlp"]["top1"]:.1%} | '
                       f'{row["nlp"]["top3"]:.1%} | {row["hybrid"]["top1"]:.1%} | {row["hybrid"]["top3"]:.1%} |']
        if model['status'] != 'complete':
            report += [f'| {model["model"]} | {model["status"]} | no substituted result | — | — | — | — |']
        if model['model'] == 'stanza_en':
            report += ['| stanza_en | all | native vectors unsupported by configured pipeline | — | — | — | — |']
    report += ['', '## Interpretation', '',
               'Current = exact original repeated text. Readable position = remove only position evidence tail. '
               'Readable both = remove both evidence tails, retaining the original narrative, categories, percentages and vocabulary.', '',
               'spaCy Small has no static word-vector table. Its exploratory Doc.vector averages contextual tok2vec features; '
               'these features are not trained as sentence similarity embeddings. It must not be described as equivalent '
               'to Medium word vectors. Medium averages static word vectors. Stanza tokenize/lemma supplies linguistic '
               'annotations, not an equivalent document vector; native matching is unsupported with the existing pipeline.', '',
               'Native matching processes the exact raw descriptions, with no artificial extra preprocessing; default document '
               'averaging includes narrative boilerplate. Inspect similarity dispersion and coverage in results.json. '
               'Native cosine can be negative: NLP-only preserves signed cosine; hybrid clips negatives to zero to retain '
               'the existing nonnegative component scale. No parameters were tuned after inspecting outcomes.', '',
               'A higher hybrid result can come from the category component dominating weakly discriminating text scores. '
               'It does not automatically establish added value over the 90% structured control. These familiar synthetic '
               'labels cannot establish real placement accuracy or a universal best model. Models with missing resources '
               'are unavailable, not zero-accuracy results. Elapsed timings are not controlled performance benchmarks.', '',
               'Detailed per-role metrics, predictions, input hashes, coverage, similarity dispersion and integrity checks '
               'are in results.json. Every candidate score/rank is in rankings.csv.', '',
               'Sources: [spaCy document vectors](https://spacy.io/api/doc#vector), '
               '[spaCy Small limitations](https://spacy.io/usage/linguistic-features#vectors-similarity), '
               '[Stanza pipeline](https://stanfordnlp.github.io/stanza/pipeline.html).']
    (OUT / 'REPORT.md').write_text('\n'.join(report) + '\n', encoding='utf-8')
    print(f'Report: {OUT / "REPORT.md"}', flush=True)
    if any(m['status'] == 'error' for m in result['models']):
        raise SystemExit('One model errored; inspect partial results.')


if __name__ == '__main__':
    main()
