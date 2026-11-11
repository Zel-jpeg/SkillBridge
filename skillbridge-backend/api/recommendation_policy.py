"""Assessment-led evidence, ordering and compatibility contracts.

Existing hybrid fields remain historical/reference metrics. The saved rank and
details determine current personal order; they are never a success probability.
No model, position title, student identity or location changes numerical evidence.
"""
from collections import defaultdict
from copy import deepcopy
import math

from .recommendation_nlp import canonical_category, normalize_tags

PREVIOUS_POLICY = 'assessment-led-option3'
AVERAGE_POLICY = 'assessment-average-match-v1'
POLICY = 'assessment-evidence-match-v2'
VERSION = 'assessment-evidence-match-20261110-v2'
SNAPSHOT_ACTION = 'placement.recommendation.snapshot'
NATIONWIDE_TRAVEL = 'nationwide'


def is_nationwide_travel(address):
    return isinstance(address, dict) and address.get('travelWilling') == NATIONWIDE_TRAVEL


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


def pooled_evidence(skill_scores, categories, *, exact_categories=False):
    if exact_categories:
        by_id = {category.id: category for category in categories}
        mapping = {key: key for key in by_id}
    else:
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
    observed_total = sum(scores[key] for key in requirements if key in scores)
    details['match_percentage'] = observed_total / len(requirements) if requirements else None
    details['demand_alignment'].update(used_for_ranking=False,
        meaning='Historical demand-priority diagnostic, retained for explanation compatibility. '
                'It does not contribute to this policy’s percentage or ordering.')
    details['match_calculation'] = dict(method='observed-credit-over-all-required-categories-v2',
        label='Assessment-based Match', category_count=len(requirements),
        assessed_percentage_total=observed_total,
        assessed_category_count=len(requirements) - details['unknown'],
        complete=bool(requirements) and details['unknown'] == 0,
        meaning='Sum of assessed required-category percentages divided by all positive required categories. '
                'Unassessed categories earn no demonstrated match credit and remain unassessed, not graded zero. '
                'Minimum requirements are checked separately. NLP and location are tie-breakers, not part of this percentage.')
    return details


def row_details(row):
    return row.get('assessment_details', {}) if isinstance(row, dict) else getattr(row, 'assessment_details', {})


def is_assessment_led(row):
    return row_details(row).get('policy') in (POLICY, AVERAGE_POLICY, PREVIOUS_POLICY)


def is_percentage_match(row):
    return row_details(row).get('policy') in (POLICY, AVERAGE_POLICY)


def percentage_value(row):
    details = row_details(row)
    return details.get('match_percentage') if details.get('policy') == POLICY else details.get('required_mean')


def api_fields(recommendation):
    details = row_details(recommendation)
    rank = (recommendation.get('assessment_rank') if isinstance(recommendation, dict)
            else getattr(recommendation, 'assessment_rank', None))
    current = is_assessment_led(recommendation)
    return dict(assessment_rank=rank, recommendation_rank=rank,
                assessment_details=details, ranking_policy=details.get('policy') if current else 'legacy-hybrid',
                match_percentage=percentage_value(recommendation) if is_percentage_match(recommendation) else None,
                requirement_coverage=details.get('coverage') if current else None)


def rank_key(row):
    def value(key, default=None):
        return row.get(key, default) if isinstance(row, dict) else getattr(row, key, default)
    rank = value('assessment_rank')
    score = value('match_score', 0)
    return (rank is None, rank if rank is not None else 0,
            -score if rank is None else 0, value('position_id', value('id', 0)))


def numerical_key(details, position_id):
    if details.get('policy') == POLICY:
        value = details.get('match_percentage')
        available = isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)
        support = details.get('personal_support', details.get('support'))
        return (0 if details.get('all_targets_met') else 1, not available,
                -round(value if available else 0, 8), -round(support or 0, 8), position_id)
    mean = details.get('required_mean')
    complete = isinstance(mean, (int, float)) and math.isfinite(mean)
    tier = 0 if complete and details.get('all_targets_met') else 1 if complete else 2
    # Partial evidence has no headline percentage; coverage only orders those
    # incomplete options. No unrelated skill or minimum becomes a grade weight.
    value = mean if complete else details.get('coverage') or 0
    return (tier, -round(value, 8), -round(details.get('support') or 0, 8), position_id)


def order_fields(*prefix):
    from django.db.models import F
    return (*prefix, F('assessment_rank').asc(nulls_last=True), '-match_score', 'position_id', 'id')


def candidate_order_fields():
    """Actual required-category evidence, not a personal rank, compares learners."""
    from django.db.models import Case, F, FloatField, IntegerField, Value, When
    from django.db.models.fields.json import KeyTextTransform
    from django.db.models.functions import Cast
    met = Case(When(assessment_details__all_targets_met=True, then=Value(1)),
               default=Value(0), output_field=IntegerField())
    mean = Cast(KeyTextTransform('required_mean', 'assessment_details'), FloatField())
    evidence = Cast(KeyTextTransform('match_percentage', 'assessment_details'), FloatField())
    score = Case(When(assessment_details__policy=POLICY, then=evidence), default=mean, output_field=FloatField())
    reference = Case(When(assessment_details__policy=POLICY, then=Value(0.0)), default=F('match_score'), output_field=FloatField())
    support = Cast(KeyTextTransform('support', 'assessment_details'), FloatField())
    return ('position_id', met.desc(), score.desc(nulls_last=True),
            support.desc(nulls_last=True), reference.desc(), 'student_id', 'id')


def top_api_fields(recommendation):
    fields = api_fields(recommendation)
    return dict(top_recommendation_rank=fields['recommendation_rank'],
                top_requirement_coverage=fields['requirement_coverage'],
                top_match_percentage=fields['match_percentage'],
                top_ranking_policy=fields['ranking_policy'],
                top_recommendation_details=fields['assessment_details'])


def report_label(row):
    """Explicit units for exported current and historical recommendation rows."""
    fields = api_fields(row)
    if is_percentage_match(row):
        value = fields['match_percentage']
        label = 'incomplete assessment evidence' if value is None else f'{value:.1f}% assessment-based match'
        status = 'minimums met' if row_details(row).get('all_targets_met') else 'minimums not all met'
        count = row_details(row).get('match_calculation', {})
        assessed = (f"; {count['assessed_category_count']}/{count['category_count']} categories assessed"
                    if row_details(row).get('policy') == POLICY and count else '')
        return f"{label}; {status}; order #{fields['recommendation_rank']}{assessed}"
    if is_assessment_led(row):
        coverage = fields['requirement_coverage']
        label = 'unavailable' if coverage is None else ('<100%' if coverage < 100 and round(coverage, 1) == 100 else f'{coverage:.1f}%')
        return f"order #{fields['recommendation_rank']}; requirement coverage {label} (not confidence)"
    return f"legacy hybrid reference {row['match_score']}%"


def coverage_or_legacy(row):
    """Policy-specific headline value for collection sorting; never relabel units."""
    if is_percentage_match(row):
        return percentage_value(row)
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
    return dict(version=recommendation.assessment_details.get('version'),
                ranking_policy=recommendation.assessment_details.get('policy'),
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
