"""Read-only, program-isolated evaluation of the current recommendation policy.

The fixture contains fictional assessment evidence and independently authored
reference labels. It never imports database models or persistence helpers. Each
language model processes the same evidence/candidate corpus with fallback off.
"""
from collections import Counter
import hashlib
import json
import logging
import math
from pathlib import Path
from time import perf_counter
from types import SimpleNamespace as Obj

from sklearn.metrics import accuracy_score, precision_recall_fscore_support

from .nlp_evaluation import DatasetError, Items
from .recommendation_matching import MATCHING_INPUT_VERSION, position_specific_similarity
from .recommendation_nlp import (
    MODEL_OPTIONS, TEXT_GENERATION_VERSION, _load_model, build_position_description,
    build_student_profile, location_similarity,
)
from .recommendation_policy import (
    POLICY, VERSION as POLICY_VERSION, describe, numerical_key, pooled_evidence,
    position_requirements,
)
from .skill_taxonomy import TAXONOMY_VERSION

DATASET_PATH = Path(__file__).parent / 'data' / 'nlp_workflow_evaluation_v1.json'
PROGRAM_SCOPES = ('all', 'IT', 'IS', 'SW', 'TOURISM')
logger = logging.getLogger(__name__)
_ROLE_LOCATIONS = ((7.299, 125.677), (7.44, 125.809), (7.108, 125.615), (7.348, 125.711))


def _hash(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
                                    separators=(',', ':')).encode()).hexdigest()


def _percentage(value):
    return (isinstance(value, (int, float)) and not isinstance(value, bool)
            and math.isfinite(value) and 0 <= value <= 100)


def workflow_data(program_scope='all', *, balanced_subset=False):
    """Build only synthetic Python objects; preserve missing/zero distinctions."""
    if program_scope not in PROGRAM_SCOPES:
        raise ValueError('program_scope must be all, IT, IS, SW or TOURISM')
    try:
        raw = DATASET_PATH.read_bytes()
        definition = json.loads(raw)
        programs = definition['programs']
        if [p['id'] for p in programs] != list(PROGRAM_SCOPES[1:]):
            raise ValueError('Unexpected test programs')
        if len(definition['location_variants']) != 5:
            raise ValueError('Expected five fixed location variants')
        cases, all_positions, program_metadata = [], [], []
        for index, program in enumerate(programs, 1):
            if program_scope != 'all' and program['id'] != program_scope:
                continue
            framework = program['framework_id']
            categories = [Obj(id=index * 100 + i, framework_id=framework, **category)
                          for i, category in enumerate(program['categories'], 1)]
            if not categories or len({c.name for c in categories}) != len(categories):
                raise ValueError('Need unique categories inside each framework')
            positions = []
            for role_index, role in enumerate(program['positions']):
                requirements = Items()
                for cat_index, minimum in role['requirements'].items():
                    if not _percentage(minimum) or minimum <= 0:
                        raise ValueError('Invalid positive requirement')
                    category = categories[int(cat_index)]
                    requirements.append(Obj(skill_category=category,
                        skill_category_id=category.id, required_percentage=minimum))
                if not requirements:
                    raise ValueError('Need positive requirements')
                lat, lng = _ROLE_LOCATIONS[role_index]
                positions.append(Obj(id=index * 1000 + role_index + 1,
                    title=role['title'], description=role['description'], tags=role['tags'],
                    program_id=program['id'], framework_id=framework,
                    company=Obj(name=f'Synthetic {program["code"]} partner {role_index + 1}',
                                location_lat=lat, location_lng=lng), requirements=requirements))
            if len(positions) != 4 or len(program['scenarios']) != 10:
                raise ValueError('Expected four positions and ten evidence patterns per program')
            all_positions.extend(positions)
            program_cases = 0
            for scenario_index, scenario in enumerate(program['scenarios']):
                percentages = scenario['category_percentages']
                if len(percentages) != len(categories) or not all(
                        value is None or _percentage(value) for value in percentages):
                    raise ValueError('Invalid synthetic category evidence')
                expected = scenario['expected_role']
                if expected is not None and (isinstance(expected, bool)
                        or not isinstance(expected, int) or not 0 <= expected < len(positions)):
                    raise ValueError('Invalid reference label')
                # Two unequal assessment maxima expose accidental mean-of-means
                # regressions. Missing categories produce no rows, assessed zero
                # produces two zero rows, exactly as raw/max pooling expects.
                evidence = []
                for category, percentage in zip(categories, percentages):
                    if percentage is None:
                        continue
                    first = min(30, max(0, percentage - 40))
                    for assessment, raw_score, maximum in ((1, first, 30), (2, percentage - first, 70)):
                        evidence.append(Obj(skill_category=category, skill_category_id=category.id,
                            raw_score=raw_score, max_score=maximum,
                            percentage=100 * raw_score / maximum, assessment_id=assessment))
                scores, totals, names, mapping = pooled_evidence(evidence, categories, exact_categories=True)
                combined = [Obj(skill_category=category, skill_category_id=category.id,
                                percentage=scores[category.id], raw_score=totals[category.id][0],
                                max_score=totals[category.id][1])
                            for category in categories if category.id in scores]
                profile = build_student_profile(combined)
                locations = definition['location_variants']
                if balanced_subset:
                    # Rotate the start and alternate two and three variants. Over
                    # ten patterns this uses each location five times per program.
                    start = (scenario_index + index - 1) % len(locations)
                    locations = (locations[start:] + locations[:start])[:2 + scenario_index % 2]
                for location in locations:
                    cases.append({'id': f'{program["id"]}-{scenario["id"]}-{location["id"]}',
                        'program_id': program['id'], 'framework_id': framework,
                        'coverage': scenario['coverage'], 'expected': None if expected is None else positions[expected].id,
                        'scores': scores, 'totals': totals, 'names': names, 'mapping': mapping,
                        'evidence': evidence, 'combined': combined, 'text': profile,
                        'address': {'lat': location['lat'], 'lng': location['lng']},
                        'location_variant': location['id']})
                    program_cases += 1
            program_metadata.append({key: program[key] for key in ('id', 'code', 'name', 'institute')} |
                {'framework_id': framework, 'case_count': program_cases, 'position_count': len(positions)})
        if len({case['id'] for case in cases}) != len(cases):
            raise ValueError('Case identifiers must be unique')
        coverage = [{'id': key, 'label': key.replace('_', ' ').capitalize(), 'case_count': count}
                    for key, count in sorted(Counter(case['coverage'] for case in cases).items())]
        coverage.extend([
            {'id': 'pooled_assessments', 'label': 'Unequal assessment maxima pooled from raw points',
             'case_count': len(cases)},
            {'id': 'program_isolation', 'label': 'Program and framework isolation', 'case_count': len(cases)},
            {'id': 'copied_definitions', 'label': 'Shared IC definitions copied to separate IT/IS frameworks',
             'case_count': sum(case['program_id'] in ('IT', 'IS') for case in cases)},
            {'id': 'location_support', 'label': 'Location support with known coordinates',
             'case_count': sum(case['address']['lat'] is not None and any(v > 0 for v in case['scores'].values())
                               for case in cases)},
            {'id': 'missing_location', 'label': 'Missing coordinates use neutral location support',
             'case_count': sum(case['address']['lat'] is None and any(v > 0 for v in case['scores'].values())
                               for case in cases)},
        ])
        metadata = {'version': definition['version'], 'sha256': hashlib.sha256(raw).hexdigest(),
            'method': definition['method'], 'description': definition['description'],
            'programs': program_metadata,
            'coverage': coverage, 'coverage_note': 'Coverage checks overlap; a case can exercise several checks.',
            'limitations': definition['notes'], 'sources': definition['sources'],
            'expected_labels_note': 'Fixed reference labels are separate from generated inputs. '
                'Equal numerical scores can legitimately be reordered by NLP/location; reference-label agreement '
                'is not model accuracy on real students or a probability of placement success.',
            'independent_evidence_patterns': 10 * len(program_metadata),
            'location_variants_per_pattern': 5, 'skipped_count': 0}
        if balanced_subset:
            metadata.update(
                version='workflow-synthetic-100-v1',
                sha256=_hash({'source': metadata['sha256'], 'case_ids': [case['id'] for case in cases]}),
                description='The admin comparison uses 25 fixed cases per selected program. Each of its ten '
                    'assessment-evidence patterns uses two or three location variants. Each location variant '
                    'appears five times per program.',
                location_variants_per_pattern=None,
                limitations=[f'Full source dataset: {note}' if note.startswith('Five location variants') else note
                             for note in metadata['limitations']],
            )
        return cases, all_positions, metadata
    except (OSError, KeyError, TypeError, AttributeError, IndexError, ValueError) as exc:
        raise DatasetError('Current-workflow test data could not be loaded. Check api/data/nlp_workflow_evaluation_v1.json.') from exc


def _candidates(case, positions):
    candidates = [position for position in positions if position.program_id == case['program_id']
                  and position.framework_id == case['framework_id']]
    for position in candidates:
        if any(requirement.skill_category_id not in case['mapping']
               for requirement in position.requirements):
            raise ValueError('Foreign-framework requirement cannot enter a program comparison')
    return sorted(candidates, key=lambda p: p.id)


def _input_fingerprint(cases, positions):
    # Expected labels are deliberately absent, including for sampling order.
    return _hash({'method': 'current-assessment-led-position-specific-v1',
        'policy': POLICY_VERSION, 'matching': MATCHING_INPUT_VERSION, 'text': TEXT_GENERATION_VERSION,
        'cases': [{'program': c['program_id'], 'framework': c['framework_id'], 'text': c['text'],
                   'totals': c['totals'], 'address': c['address']} for c in cases],
        'positions': [{'id': p.id, 'program': p.program_id, 'text': build_position_description(p),
                       'lat': p.company.location_lat, 'lng': p.company.location_lng} for p in positions]})


def workflow_coverage(program_scope='all', *, balanced_subset=False):
    return _workflow_coverage(program_scope, *workflow_data(program_scope, balanced_subset=balanced_subset))


def _workflow_coverage(program_scope, cases, positions, metadata):
    # Bounded raw inputs are fictional and contain no question/answer content.
    sample_cases = [next(c for c in cases if c['program_id'] == program['id'])
                    for program in metadata['programs']]
    return {'mode': 'workflow_simulation', 'program_scope': program_scope,
        'case_count': len(cases), 'position_count': len(positions), 'dataset': metadata,
        'ranking': 'Current assessment-led Match; NLP/location supporting tie-breakers',
        'positions': [{'id': p.id, 'title': p.title, 'company': p.company.name,
                       'program_id': p.program_id} for p in positions],
        'text_samples': {'profiles': [{'case_id': c['id'], 'program_id': c['program_id'], 'text': c['text']}
                                     for c in sample_cases],
            'positions': [{'id': p.id, 'title': p.title, 'program_id': p.program_id,
                           'text': build_position_description(p)}
                          for p in positions if p.id % 1000 == 1],
            'note': 'Actual synthetic generated inputs before preprocessing. Category tags are contextual vocabulary, '
                    'not individually assessed subskills. No real student, answer or placement data is read.'},
        'input_sha256': _input_fingerprint(cases, positions),
        'matching_input_version': MATCHING_INPUT_VERSION, 'ranking_policy': POLICY,
        'ranking_version': POLICY_VERSION, 'text_generation_version': TEXT_GENERATION_VERSION,
        'taxonomy_version': TAXONOMY_VERSION}


def _metrics(predictions):
    if not predictions:
        raise ValueError('No cases to evaluate')
    expected = [str(p['expected_position_id']) for p in predictions]
    predicted = [str(p['top3_position_ids'][0] if p['top3_position_ids'] else None) for p in predictions]
    precision, recall, f1, _ = precision_recall_fscore_support(
        expected, predicted, average='macro', zero_division=0)
    top3 = sum((not p['top3_position_ids']) if p['expected_position_id'] is None else
               p['expected_position_id'] in p['top3_position_ids'] for p in predictions)
    ranked = [p for p in predictions if p['expected_position_id'] is not None]
    return {'top1_accuracy': float(accuracy_score(expected, predicted)),
        'top3_accuracy': top3 / len(predictions), 'precision': float(precision),
        'recall': float(recall), 'f1': float(f1), 'case_count': len(predictions),
        'ranked_case_count': len(ranked), 'no_evidence_case_count': len(predictions) - len(ranked),
        'no_evidence_gate_agreement': sum(not p['top3_position_ids'] for p in predictions
            if p['expected_position_id'] is None) / (len(predictions) - len(ranked))
            if len(predictions) != len(ranked) else None,
        'ranked_top1_agreement': sum(p['expected_rank'] == 1 for p in ranked) / len(ranked) if ranked else None,
        'ranked_top3_hit_rate': sum(p['expected_rank'] in (1, 2, 3) for p in ranked) / len(ranked) if ranked else None}


def _diagnostics(predictions):
    pairs = Counter((p['expected_position_id'], p['top3_position_ids'][0] if p['top3_position_ids'] else None)
                    for p in predictions if p['expected_rank'] != 1)
    return {'common_confusions': [{'expected_position_id': expected, 'predicted_position_id': predicted,
            'count': count} for (expected, predicted), count in sorted(pairs.items(),
                key=lambda item: (-item[1], str(item[0])))],
        'near_misses': [p for p in predictions if p['expected_rank'] in (2, 3)],
        'note': 'Reference labels were fixed before inference. Numeric ties are reviewable cases; '
                'do not rewrite expected labels to improve agreement.'}


def _rank_case(case, positions, model_id):
    candidates = _candidates(case, positions)
    positive = any(value > 0 for value in case['scores'].values())
    if not positive:
        return [], []  # Production refuses to generate recommendations without positive evidence.
    matched = position_specific_similarity(case['text'], case['combined'], candidates,
        case['mapping'], model_id, allow_fallback=False)
    if matched.model_used != model_id or matched.fallback_reason:
        raise ValueError('Comparison requires strict requested-model execution')
    rows = []
    for index, position in enumerate(candidates):
        details = describe(case['scores'], case['totals'], case['names'],
                           position_requirements(position, case['mapping']))
        location, distance = location_similarity(case['address'], position.company.location_lat,
                                                  position.company.location_lng)
        # Match current saved support rounding/order, not the retired hybrid score.
        nlp_percent = round(float(matched.scores[index]) * 100, 2)
        location_percent = round(location * 100, 2)
        details['support'] = (25 * nlp_percent + 15 * location_percent) / 40
        rows.append({'position_id': position.id, 'match_percentage': details['match_percentage'],
                     'all_targets_met': details['all_targets_met'], 'unknown_categories': details['unknown'],
                     'nlp_percent': nlp_percent, 'location_percent': location_percent,
                     'distance_km': distance, 'assessment_details': details})
    ranked = sorted(rows, key=lambda row: numerical_key(row['assessment_details'], row['position_id']))
    nlp_only = sorted(rows, key=lambda row: (-row['nlp_percent'], row['position_id']))
    return ranked, nlp_only


def run_workflow_comparison(program_scope='all', *, balanced_subset=False):
    cases, positions, metadata = workflow_data(program_scope, balanced_subset=balanced_subset)
    result = _workflow_coverage(program_scope, cases, positions, metadata)
    result.update(status='complete', models=[],
        metric_note='Top-1 agreement and Top-3 hit rate compare fixed synthetic reference labels with the current '
            'full workflow. No-positive-evidence cases expect no recommendation and are counted separately. '
            'Macro precision, recall and F1 use the union of expected/predicted classes, including no recommendation. '
            'NLP-only diagnostics exclude those gated cases and are separate from assessment-led ordering.',
        timing_note='Processing time includes strict preprocessing, per-student common TF-IDF fitting and ranking. '
            'Model loading is measured separately. Dataset loading, text generation and metric calculation are excluded. '
            'Warm caches, repeated evidence patterns, execution order and hardware affect timings; this is not an independent speed benchmark.')
    for model_id, info in MODEL_OPTIONS.items():
        row = {'id': model_id, **info, 'status': 'unavailable', 'metrics': None}
        load_start = perf_counter()
        try:
            _load_model(model_id)
        except Exception:
            logger.warning('Workflow evaluation model %s could not load', model_id, exc_info=True)
            row['message'] = f'{info["label"]} could not load its local resources. No fallback metrics are substituted.'
            result['models'].append(row)
            continue
        load_seconds = perf_counter() - load_start
        try:
            start = perf_counter()
            predictions, nlp_predictions = [], []
            for case in cases:
                ranked, nlp_only = _rank_case(case, positions, model_id)
                ids = [r['position_id'] for r in ranked]
                expected_rank = (ids.index(case['expected']) + 1 if case['expected'] in ids else
                                 1 if case['expected'] is None and not ids else None)
                predictions.append({'case_id': case['id'], 'program_id': case['program_id'],
                    'coverage': case['coverage'], 'expected_position_id': case['expected'],
                    'expected_rank': expected_rank, 'top3_position_ids': ids[:3],
                    'top3_scores': [r['match_percentage'] for r in ranked[:3]],
                    'top3_details': [{k: v for k, v in r.items() if k != 'assessment_details'} for r in ranked[:3]]})
                if nlp_only:
                    nlp_ids = [r['position_id'] for r in nlp_only]
                    nlp_predictions.append({'expected_position_id': case['expected'],
                        'top3_position_ids': nlp_ids[:3], 'expected_rank': nlp_ids.index(case['expected']) + 1})
            elapsed = perf_counter() - start
            metrics = _metrics(predictions)
            nlp_metrics = _metrics(nlp_predictions) if nlp_predictions else {}
            metrics.update(processing_time_seconds=elapsed, load_time_seconds=load_seconds,
                nlp_top1_accuracy=nlp_metrics.get('top1_accuracy'),
                nlp_top3_accuracy=nlp_metrics.get('top3_accuracy'), nlp_only_case_count=len(nlp_predictions))
            row.update(status='available', metrics=metrics, predictions=predictions,
                diagnostics=_diagnostics(predictions),
                program_metrics=[{'program_id': program['id'], **_metrics([
                    prediction for prediction in predictions if prediction['program_id'] == program['id']])}
                    for program in result['dataset']['programs']])
        except Exception:
            logger.exception('Workflow comparison failed for model %s', model_id)
            row.update(status='error', message='Strict model processing or current-workflow ranking failed. '
                       'No fallback is evaluated; other models continue.', metrics=None)
        result['models'].append(row)
    return result
