"""Read-only evaluation. Never call generate_recommendations or persist profiles.

Prepared mode follows the rich NLP notebook's corpus-wide TF-IDF experiment.
Real mode fits TF-IDF per student, exactly as production does, then applies the
unchanged hybrid weights. See data/README.md for sampling and limitations.
"""
import hashlib
import json
import logging
from collections import Counter
from pathlib import Path
from time import perf_counter
from types import SimpleNamespace as Obj

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import accuracy_score, precision_recall_fscore_support
from sklearn.metrics.pairwise import cosine_similarity

from .recommendation_nlp import (
    MODEL_OPTIONS, _load_model, build_position_description,
    generate_competency_insights, location_similarity, preprocess_texts,
    suggest_skill_tags, suggest_position_tags, TEXT_GENERATION_VERSION,
)
from .skill_taxonomy import taxonomy_diagnostics, TAXONOMY_VERSION

DATASET_PATH = Path(__file__).parent / 'data' / 'nlp_evaluation.json'
MIN_REAL_CASES = 5  # Demo minimum, not a statistical validity threshold.
MAX_REAL_CASES = 100  # Bound synchronous local runs; newest eligible approvals.
logger = logging.getLogger(__name__)


class DatasetError(ValueError):
    pass


class Items(list):
    def all(self):
        return self


def prepared_data():
    try:
        raw = DATASET_PATH.read_bytes()
        data = json.loads(raw)
        categories = [Obj(**item) for item in data['categories']]
        source_taxonomy = taxonomy_diagnostics(categories)
        # Production-prepared variant: accept the curated suggestions only in
        # memory. Original JSON scores, labels, tags and database stay intact.
        for category in categories:
            category.tags = suggest_skill_tags(category.name) or category.tags
        if not categories or len({c.name for c in categories}) != len(categories):
            raise ValueError('Need unique skill categories.')
        positions = []
        for item in data['positions']:
            requirements = Items(Obj(skill_category=c, required_percentage=item['requirements'][c.name]) for c in categories)
            if not all(isinstance(r.required_percentage, (int, float)) and
                       np.isfinite(r.required_percentage) and 0 <= r.required_percentage <= 100
                       for r in requirements) or not any(r.required_percentage > 0 for r in requirements):
                raise ValueError('Invalid position requirements.')
            positions.append(Obj(id=item['id'], title=item['title'], tags=suggest_position_tags(item['title']) or item['tags'],
                                 company=Obj(name=item['company']), requirements=requirements))
        positions.sort(key=lambda p: p.id)
        ids = [p.id for p in positions]
        if len(ids) < 3 or len(set(ids)) != len(ids) or not data['cases']:
            raise ValueError('Need unique positions and labeled cases.')
        cases = []
        if len({item['id'] for item in data['cases']}) != len(data['cases']):
            raise ValueError('Case IDs must be unique.')
        for item in data['cases']:
            values = list(item['scores'].values())
            if item['expected_position_id'] not in ids or not all(
                isinstance(v, (int, float)) and np.isfinite(v) and 0 <= v <= 100 for v in values
            ):
                raise ValueError('Invalid label or score.')
            scores = [Obj(skill_category=c, percentage=item['scores'][c.name]) for c in categories]
            cases.append({'id': item['id'], 'expected': item['expected_position_id'],
                          'text': generate_competency_insights(scores)['competency_profile_text']})
        return cases, positions, {'version': data['version'], 'sha256': hashlib.sha256(raw).hexdigest(),
            'variant': 'Production prepared dataset', 'taxonomy': taxonomy_diagnostics(categories),
            'source_taxonomy': source_taxonomy, 'skipped_count': 0,
            'description': 'Production prepared dataset: the same 60 synthetic cases and 6 positions, with current neutral '
            'text generation and curated tag suggestions applied in memory. Scores and expected labels are unchanged. '
            'This is not exact notebook reproduction or an independent real-world accuracy study.'}
    except (OSError, ValueError, KeyError, TypeError, AttributeError) as exc:
        raise DatasetError('Prepared evaluation dataset could not be loaded. Check api/data/nlp_evaluation.json.') from exc


def real_data():
    from .models import OJTPlacement, Position, SkillCategory, SkillScore, StudentResponse

    categories = list(SkillCategory.objects.order_by('id'))
    positions = [p for p in Position.objects.select_related('company').prefetch_related(
        'requirements__skill_category').order_by('id') if any(r.required_percentage > 0 for r in p.requirements.all())]
    position_ids = {p.id for p in positions}
    requirement_vectors = [[next((r.required_percentage for r in p.requirements.all()
                                 if r.skill_category_id == c.id), 0) for c in categories] for p in positions]
    placements = OJTPlacement.objects.filter(status='approved').select_related('student').order_by('-approved_at', '-id')
    total = placements.count()
    cases, skipped = [], 0
    for placement in placements.iterator():
        # No historical profile snapshot exists: use the latest submitted assessment
        # at/before approval. Never use subsequent assessments or placement text.
        if not placement.approved_at or placement.position_id not in position_ids:
            skipped += 1
            continue
        response = StudentResponse.objects.filter(student_id=placement.student_id,
            status='submitted', submitted_at__lte=placement.approved_at).order_by('-submitted_at', '-id').first()
        scores = list(SkillScore.objects.filter(student_id=placement.student_id,
            assessment_id=response.assessment_id).select_related('skill_category')) if response else []
        if not scores or not any(s.percentage > 0 for s in scores):
            skipped += 1
            continue
        score_map = {s.skill_category_id: s.percentage for s in scores}
        category = cosine_similarity([[score_map.get(c.id, 0) for c in categories]], requirement_vectors)[0]
        location = np.array([location_similarity(placement.student.address,
            p.company.location_lat, p.company.location_lng)[0] for p in positions])
        cases.append({'id': f'placement-{placement.id}', 'expected': placement.position_id,
                      'text': generate_competency_insights(scores)['competency_profile_text'],
                      'base_scores': .60 * category + .15 * location})
        if len(cases) == MAX_REAL_CASES:
            break
    return cases, positions, {'approved_count': total, 'skipped_count': skipped,
        'taxonomy': taxonomy_diagnostics(categories),
        'unexamined_count': total - skipped - len(cases), 'minimum_cases': MIN_REAL_CASES,
        'description': 'Agreement with approved placements using current position requirements, tags and locations, '
        'and the latest submitted assessment at/before approval. Assessment retakes may overwrite scores; '
        'historical inputs are not fully snapshotted. Approval may reflect the existing recommender and is not an independent accuracy study.'}


def text_similarity(texts, profile_count):
    vectorizer = TfidfVectorizer(ngram_range=(1, 3), min_df=1, sublinear_tf=True)
    matrix = vectorizer.fit_transform(texts)
    return cosine_similarity(matrix[:profile_count], matrix[profile_count:])


def ranking_metrics(cases, positions, similarities):
    ids = [p.id for p in positions]
    # Stable ties follow ascending position ID, never expected labels.
    full_ranks = np.argsort(-np.asarray(similarities), axis=1, kind='stable')
    top = full_ranks[:, :3]
    ranked = [[ids[i] for i in row] for row in top]
    expected = [c['expected'] for c in cases]
    predicted = [row[0] for row in ranked]
    precision, recall, f1, _ = precision_recall_fscore_support(
        expected, predicted, average='macro', zero_division=0)
    return {
        'top1_accuracy': float(accuracy_score(expected, predicted)),
        'top3_accuracy': sum(label in row for label, row in zip(expected, ranked)) / len(cases),
        'precision': float(precision), 'recall': float(recall), 'f1': float(f1),
    }, [{'case_id': c['id'], 'expected_position_id': c['expected'], 'top3_position_ids': row,
         'expected_rank': [ids[j] for j in full_ranks[i]].index(c['expected']) + 1,
         'top3_scores': [float(np.asarray(similarities)[i, j]) for j in top[i]]}
        for i, (c, row) in enumerate(zip(cases, ranked))]


def ranking_diagnostics(predictions):
    pairs = Counter((p['expected_position_id'], p['top3_position_ids'][0])
                    for p in predictions if p['expected_rank'] != 1)
    return {'common_confusions': [{'expected_position_id': expected, 'predicted_position_id': predicted, 'count': count}
                                  for (expected, predicted), count in sorted(pairs.items(), key=lambda p: (-p[1], p[0]))],
            'near_misses': [p for p in predictions if p['expected_rank'] in (2, 3)],
            'note': 'High Top-3 with lower Top-1 means the labeled position is often close, but another position ranks first. '
                    'Inspect category evidence and label ambiguity; do not change labels to match predictions.'}


def run_comparison(mode):
    if mode not in ('evaluation_dataset', 'real_placement_data'):
        raise ValueError('mode must be evaluation_dataset or real_placement_data')
    cases, positions, metadata = prepared_data() if mode == 'evaluation_dataset' else real_data()
    result = {'mode': mode, 'status': 'complete', 'case_count': len(cases),
        'position_count': len(positions), 'dataset': metadata,
        'ranking': 'NLP text similarity' if mode == 'evaluation_dataset' else 'Hybrid 60/25/15',
        'positions': [{'id': p.id, 'title': p.title, 'company': p.company.name} for p in positions],
        'models': [], 'metric_note': 'Precision, recall and F1 are macro averages of Top-1 predictions over the union of expected and predicted classes; undefined values are zero.',
        'text_generation_version': TEXT_GENERATION_VERSION, 'taxonomy_version': TAXONOMY_VERSION,
        'timing_note': 'Processing time includes preprocessing and ranking; model loading, data reads, profile generation and metric calculation are excluded. Cached models and hardware affect time.'}
    if mode == 'real_placement_data' and (len(cases) < MIN_REAL_CASES or len(positions) < 3):
        result.update(status='insufficient_data', message=f'At least {MIN_REAL_CASES} eligible approved placements and 3 positions with requirements are needed. Found {len(cases)} eligible placements and {len(positions)} positions.')
        return result
    texts = [c['text'] for c in cases] + [build_position_description(p) for p in positions]
    result['input_sha256'] = hashlib.sha256(json.dumps(texts, ensure_ascii=False).encode()).hexdigest()
    # A bounded diagnostic sample; labels are used only to select varied examples
    # AFTER text generation, never by the generators or preprocessors.
    sampled_labels, samples = set(), []
    for case in cases:
        if case['expected'] not in sampled_labels and len(samples) < 6:
            samples.append({'case_id': case['id'], 'text': case['text']})
            sampled_labels.add(case['expected'])
    result['text_samples'] = {'profiles': samples,
        'positions': [{'id': p.id, 'title': p.title, 'text': texts[len(cases) + i]} for i, p in enumerate(positions[:6])],
        'note': 'Raw generated inputs used in this run, before model preprocessing. Category tags describe category vocabulary, not separately verified subskills. Read-only; no question or answer text is queried.'}
    for model_id, info in MODEL_OPTIONS.items():
        row = {'id': model_id, **info, 'status': 'unavailable', 'metrics': None}
        try:
            _load_model(model_id)  # Warm-up excluded, matching notebooks. Never download.
        except Exception:
            logger.warning('Evaluation model %s could not load', model_id, exc_info=True)
            row['message'] = f'{info["package"]} could not load. Install compatible local model resources; no fallback is evaluated.'
            result['models'].append(row)
            continue
        try:
            start = perf_counter()
            processed, actual, reason = preprocess_texts(texts, model_id, allow_fallback=False)
            if actual != model_id or reason:
                raise ValueError('Evaluation requires the requested model.')
            if mode == 'evaluation_dataset':
                similarities = text_similarity(processed, len(cases))
            else:
                descriptions = processed[len(cases):]
                similarities = [c['base_scores'] + .25 * text_similarity([processed[i]] + descriptions, 1)[0]
                                for i, c in enumerate(cases)]
            elapsed = perf_counter() - start
            metrics, predictions = ranking_metrics(cases, positions, similarities)
            metrics['processing_time_seconds'] = elapsed
            row.update(status='available', metrics=metrics, predictions=predictions,
                       diagnostics=ranking_diagnostics(predictions))
        except Exception:
            logger.exception('Evaluation failed for %s', model_id)
            row.update(status='error', message='This model could not preprocess or rank the evaluation texts. Check backend logs; other models continue.')
        result['models'].append(row)
    return result
