"""Pure factual explanations for saved assessment-led recommendation evidence.

Inputs are already canonical, pooled category evidence. This module does not
merge category IDs, grade answers, rank positions, fit NLP, access a database or
write records. It preserves the candidate's existing numerical policy values.
"""
from copy import deepcopy
import math


VERSION = 'recommendation-evidence-explanations-v9'


def _finite(value, label):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f'{label} must be a finite number')
    return float(value)


def _percentage(value, label):
    value = _finite(value, label)
    if not 0 <= value <= 100:
        raise ValueError(f'{label} must be between zero and one hundred')
    return value


def _display(value):
    return f'{value:.2f}'.rstrip('0').rstrip('.')


def build(scores, totals, requirements, names, existing_details):
    """Return copied details with factual evidence, statuses and metric meanings.

    ``scores`` maps canonical category keys to assessed percentages; ``totals``
    maps those same keys to pooled ``[earned_points, maximum_points]``. A missing
    score means unassessed, whereas zero with a positive maximum is assessed.
    ``requirements`` maps canonical keys to minimum percentages. Positive targets
    are compared; zero targets do not create an assessment obligation.
    ``names`` maps canonical keys to display names. ``existing_details`` is the
    existing candidate's explanation, including its ordered requirements list.

    Existing values/keys are kept, including coverage, strength, all_targets_met,
    policy, support and legacy reference. Required-row names/targets/state must
    agree with these inputs; incompatible evidence raises instead of presenting
    a fabricated explanation. The caller owns all alias and ranking decisions.
    """
    clean_scores = {key: _percentage(value, 'Assessed percentage') for key, value in scores.items()}
    clean_requirements = {key: _percentage(value, 'Required minimum') for key, value in requirements.items()}
    positive_requirements = {key: value for key, value in clean_requirements.items() if value > 0}
    evidence = {}
    for key, percentage in clean_scores.items():
        if key not in totals or len(totals[key]) != 2:
            raise ValueError('Every assessed score requires pooled raw/max evidence')
        raw, maximum = (_finite(value, 'Evidence points') for value in totals[key])
        if maximum <= 0 or raw < 0 or raw > maximum:
            raise ValueError('Assessed evidence must have valid raw points and a positive maximum')
        # Allow a caller's stored two-decimal percentage as well as exact raw/max.
        if not math.isclose(percentage, 100 * raw / maximum, rel_tol=0, abs_tol=0.005000001):
            raise ValueError('Assessed percentage does not agree with pooled evidence')
        evidence[key] = (raw, maximum)

    result = deepcopy(existing_details)
    legacy_rows = result.get('requirements', [])
    keys = sorted(positive_requirements)
    if len(legacy_rows) != len(keys):
        raise ValueError('Existing requirement details do not match the positive requirements')
    counts = dict(required=len(keys), assessed=0, met=0, below_minimum=0, unassessed=0)
    reasons = []
    for row, key in zip(legacy_rows, keys):
        if key not in names or not isinstance(names[key], str) or not names[key].strip():
            raise ValueError('Every required category needs its existing display name')
        name, minimum = names[key], positive_requirements[key]
        if row.get('category') != name or row.get('target') != minimum:
            raise ValueError('Existing requirement order, name or target differs from canonical inputs')
        value = clean_scores.get(key)
        if value is None:
            state, code = 'unassessed', 'unassessed'
            raw, maximum, gap = None, None, None
            text = f'{name}: no assessed evidence is available; the listed minimum is {_display(minimum)}%.'
            counts['unassessed'] += 1
        else:
            counts['assessed'] += 1
            raw, maximum = evidence[key]
            gap = max(minimum - value, 0)
            if value >= minimum:
                state, code = 'met', 'minimum_met'
                text = (f'{name}: assessed score {_display(value)}% meets the listed minimum '
                        f'of {_display(minimum)}%.')
                counts['met'] += 1
            else:
                state, code = 'below target', 'below_minimum'
                text = (f'{name}: assessed score {_display(value)}% is below the listed minimum '
                        f'of {_display(minimum)}% by {_display(gap)} percentage points.')
                counts['below_minimum'] += 1
        if row.get('state') != state:
            raise ValueError('Existing requirement state disagrees with assessed evidence')
        row.update(assessed_percentage=value, raw_score=raw, max_score=maximum,
                   status_code=code, evidence_available=value is not None,
                   gap_percentage_points=gap, explanation=text)
        reasons.append(text)

    all_met = bool(keys) and counts['met'] == len(keys)
    if 'all_targets_met' in result and result['all_targets_met'] != all_met:
        raise ValueError('Existing target-met flag disagrees with factual requirements')
    if 'unknown' in result and result['unknown'] != counts['unassessed']:
        raise ValueError('Existing unknown count disagrees with factual evidence')
    if not keys:
        status, label = 'no_positive_requirements', 'No numerical minimums listed'
        summary = 'This position has no positive numerical minimums to compare.'
    elif all_met:
        status, label = 'all_minimums_met', 'All listed numerical minimums met'
        summary = f'Assessed evidence meets all {len(keys)} listed numerical minimums.'
    elif counts['unassessed']:
        status, label = 'unassessed_requirements', 'Some required categories are unassessed'
        summary = (f"{counts['unassessed']} of {len(keys)} required categories lack assessed evidence; "
                   f"{counts['below_minimum']} assessed categories are below their minimums.")
    else:
        status, label = 'below_minimums', 'Some assessed scores are below minimums'
        summary = f"{counts['below_minimum']} of {len(keys)} assessed categories are below their listed minimums."

    denominator = sum(value for value in clean_scores.values() if value > 0)
    numerator = sum(min(value, positive_requirements.get(key, 0))
                    for key, value in clean_scores.items() if value > 0)
    result.update(
        explanation_contract_version=VERSION,
        numerical_status=status,
        numerical_status_label=label,
        numerical_summary=summary,
        requirement_counts=counts,
        requirement_reasons=reasons,
        requirement_target_semantics='Minimum assessed proficiency; not an importance weight or maximum score.',
        coverage_meaning=('Average capped attainment of the listed numerical minimums. Unassessed categories '
                          'have no demonstrated attainment; they are not measured zero grades. '
                          '100% coverage means the listed minimums are met, not 100% assessment grades.'),
        demand_alignment=dict(
            label='Requirement-demand alignment',
            value=result.get('strength'),
            numerator=numerator,
            denominator=denominator,
            compared_scope='positions_for_one_student',
            meaning=('Declared demand-priority policy: sum of each assessed score capped at the role minimum, '
                     'divided by the sum of positive assessed scores. Among fully met roles for one student, '
                     'this orders total listed minimum demand.'),
            experimental=True,
            measures_job_importance=False,
            measures_verified_strength_utilization=False,
            suitable_for_comparing_students=False,
        ),
        explanation_limits=(
            'Numerical target attainment supports a recommendation; coordinator approval is separate. '
            'Category scores do not establish mastery of every contextual skill tag. '
            'These explanations do not provide an overall confidence or placement-success probability.'
        ),
    )
    return result
