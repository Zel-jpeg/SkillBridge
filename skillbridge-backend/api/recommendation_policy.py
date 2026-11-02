"""Assessment-led evidence, ordering and compatibility contracts.

Existing hybrid fields remain historical/reference metrics. The saved rank and
details determine current personal order; they are never a success probability.
No model, position title, student identity or location changes numerical evidence.
"""
from collections import defaultdict
from copy import deepcopy
import math

from .recommendation_nlp import canonical_category, normalize_tags

POLICY = 'assessment-led-option3'
VERSION = 'assessment-led-20261103-v1'
SNAPSHOT_ACTION = 'placement.recommendation.snapshot'


def canonical_context(categories):
    """Virtual equivalence requires the same canonical name AND saved vocabulary.

    Original category rows/history are never merged or changed. Distinct
    vocabularies remain distinct, and conflicting equivalent targets are rejected.
    """
    by_id = {category.id: category for category in categories}
    groups = defaultdict(list)
    for category in categories:
        signature = (canonical_category(category.name), tuple(sorted(
            tag.casefold() for tag in normalize_tags(category.tags))))
        groups[signature].append(category.id)
    mapping = {key: min(ids) for ids in groups.values() for key in ids}
    return by_id, mapping


def pooled_evidence(skill_scores, categories):
    by_id, mapping = canonical_context(categories)
    totals = defaultdict(lambda: [0, 0])
    for score in skill_scores:
        if score.skill_category_id not in mapping:
            raise ValueError('Assessment category is absent from the current catalog')
        raw, maximum = getattr(score, 'raw_score', None), getattr(score, 'max_score', None)
        if raw is None or maximum is None or maximum <= 0:
            continue  # Missing raw/max evidence is not an assessed zero.
        if not all(math.isfinite(v) for v in (raw, maximum)) or not 0 <= raw <= maximum:
            raise ValueError('Invalid raw/max assessment evidence')
        target = totals[mapping[score.skill_category_id]]
        target[0] += raw
        target[1] += maximum
    scores = {key: 100 * raw / maximum for key, (raw, maximum) in totals.items()}
    names = {key: by_id[key].name for key in set(mapping.values())}
    return scores, dict(totals), names, mapping


def position_requirements(position, mapping):
    targets = {}
    for requirement in position.requirements.all():
        value = requirement.required_percentage
        if not math.isfinite(value) or not 0 <= value <= 100:
            raise ValueError('Position minimum must be a finite percentage')
        if value <= 0:
            continue
        key = mapping[requirement.skill_category_id]
        if key in targets and targets[key] != value:
            raise ValueError('Equivalent categories have conflicting position minimums; review the catalog')
        targets[key] = value
    return targets


def describe(scores, totals, names, requirements):
    from .recommendation_explanations import build
    rows = []
    for key, target in sorted(requirements.items()):
        value = scores.get(key)
        state = 'unassessed' if value is None else 'met' if value >= target else 'below target'
        rows.append(dict(category=names[key], target=target, state=state,
            attainment=100 * min((value or 0) / target, 1),
            gap=None if value is None else max(target - value, 0)))
    positive = sum(value for value in scores.values() if value > 0)
    highest = max(scores.values(), default=0)
    details = dict(coverage=sum(r['attainment'] for r in rows) / len(rows) if rows else None,
        strength=(100 * sum(min(value, max(requirements.get(key, 0), 0))
                  for key, value in scores.items() if value > 0) / positive) if positive else None,
        requirements=rows, all_targets_met=bool(rows) and all(r['state'] == 'met' for r in rows),
        unknown=sum(r['state'] == 'unassessed' for r in rows),
        strongest_categories_used=[names[key] for key, value in scores.items()
                                   if value > 0 and value == highest and key in requirements])
    details = build(scores, totals, requirements, names, details)
    details.update(policy=POLICY, version=VERSION,
        required_mean=(sum(scores[key] for key in requirements) / len(requirements)
                       if requirements and all(key in scores for key in requirements) else None),
        text_similarity_is_confidence=False)
    return details


def row_details(row):
    return row.get('assessment_details', {}) if isinstance(row, dict) else getattr(row, 'assessment_details', {})


def is_assessment_led(row):
    return row_details(row).get('policy') == POLICY


def api_fields(recommendation):
    details = row_details(recommendation)
    rank = (recommendation.get('assessment_rank') if isinstance(recommendation, dict)
            else getattr(recommendation, 'assessment_rank', None))
    current = details.get('policy') == POLICY
    return dict(assessment_rank=rank, recommendation_rank=rank,
                assessment_details=details, ranking_policy=POLICY if current else 'legacy-hybrid',
                requirement_coverage=details.get('coverage') if current else None)


def rank_key(row):
    def value(key, default=None):
        return row.get(key, default) if isinstance(row, dict) else getattr(row, key, default)
    rank = value('assessment_rank')
    score = value('match_score', 0)
    return (rank is None, rank if rank is not None else 0,
            -score if rank is None else 0, value('position_id', value('id', 0)))


def numerical_key(details, position_id):
    return (details['coverage'] is None, -round(details['coverage'] or 0, 8),
            details['strength'] is None, -round(details['strength'] or 0, 8),
            -round(details['support'], 8), position_id)


def order_fields(*prefix):
    from django.db.models import F
    return (*prefix, F('assessment_rank').asc(nulls_last=True), '-match_score', 'position_id', 'id')


def candidate_order_fields():
    """Actual required-category evidence, not a personal rank, compares learners."""
    from django.db.models import Case, FloatField, IntegerField, Value, When
    from django.db.models.fields.json import KeyTextTransform
    from django.db.models.functions import Cast
    met = Case(When(assessment_details__all_targets_met=True, then=Value(1)),
               default=Value(0), output_field=IntegerField())
    mean = Cast(KeyTextTransform('required_mean', 'assessment_details'), FloatField())
    support = Cast(KeyTextTransform('support', 'assessment_details'), FloatField())
    return ('position_id', met.desc(), mean.desc(nulls_last=True),
            support.desc(nulls_last=True), '-match_score', 'student_id', 'id')


def top_api_fields(recommendation):
    fields = api_fields(recommendation)
    return dict(top_recommendation_rank=fields['recommendation_rank'],
                top_requirement_coverage=fields['requirement_coverage'],
                top_ranking_policy=fields['ranking_policy'],
                top_recommendation_details=fields['assessment_details'])


def report_label(row):
    """Explicit units for exported current and historical recommendation rows."""
    fields = api_fields(row)
    if fields['ranking_policy'] == POLICY:
        coverage = fields['requirement_coverage']
        label = 'unavailable' if coverage is None else ('<100%' if coverage < 100 and round(coverage, 1) == 100 else f'{coverage:.1f}%')
        return f"order #{fields['recommendation_rank']}; requirement coverage {label} (not confidence)"
    return f"legacy hybrid reference {row['match_score']}%"


def coverage_or_legacy(row):
    if is_assessment_led(row):
        return row_details(row).get('coverage')
    return row.get('match_score') if isinstance(row, dict) else row.match_score


def needs_review(row):
    if is_assessment_led(row):
        return not row_details(row).get('all_targets_met', False)
    return (row.get('match_score', 0) if isinstance(row, dict) else row.match_score) < 60


def assessment_band(row):
    if not is_assessment_led(row):
        return 'Strong' if row.match_score >= 80 else 'Fair' if row.match_score >= 60 else 'Low'
    details = row_details(row)
    return ('Minimums met' if details.get('all_targets_met') else
            'Unassessed requirements' if details.get('unknown') else 'Below minimums')


def approval_snapshot(recommendation):
    if not is_assessment_led(recommendation):
        return None
    return dict(version=VERSION, ranking_policy=POLICY,
                recommendation_rank=recommendation.assessment_rank,
                assessment_details=deepcopy(recommendation.assessment_details))


def placement_evidence(placement):
    """Never reconstruct a past decision from a mutable Recommendation row."""
    if placement is None:
        return None
    if hasattr(placement, '_assessment_snapshot'):
        return placement._assessment_snapshot
    from .models import ManagementAction
    placement._assessment_snapshot = (ManagementAction.objects.filter(action=SNAPSHOT_ACTION,
        target_type='placement', target_id=placement.pk).order_by('-id')
        .values_list('metadata', flat=True).first())
    return placement._assessment_snapshot


def attach_placement_evidence(placements):
    from .models import ManagementAction
    placements = list(placements)
    latest = {}
    for target, metadata in ManagementAction.objects.filter(action=SNAPSHOT_ACTION,
            target_type='placement', target_id__in=[p.pk for p in placements]).order_by('-id').values_list('target_id', 'metadata'):
        latest.setdefault(target, metadata)
    for placement in placements:
        placement._assessment_snapshot = latest.get(placement.pk)
    return placements
