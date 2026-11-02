"""Shared capacity uses assessed minimums and actual performance, not the demand ratio."""
import math
from .recommendation_policy import POLICY


def allocate_assessment_led(edges, capacities):
    from .placement_allocator import allocate
    # Explicit compatibility for historical/unversioned fixtures; new generation
    # always persists versioned details and old real profiles fail freshness.
    if not any(e.get('assessment_details', {}).get('policy') == POLICY for e in edges):
        return allocate(edges, capacities)
    usable = []
    for edge in edges:
        details = edge.get('assessment_details', {})
        mean = details.get('required_mean')
        if (details.get('policy') != POLICY or not details.get('all_targets_met')
                or not isinstance(mean, (int, float)) or not math.isfinite(mean)
                or capacities.get(edge['position_id'], 0) <= 0):
            continue
        usable.append(dict(edge, required_mean=mean, support=details['support']))
    by_student = {}
    for row in usable:
        by_student.setdefault(row['student_id'], []).append(row)
    maximum_rank = max((len(rows) for rows in by_student.values()), default=0)
    base = len(by_student) * 10000 + 1
    for rows in by_student.values():
        rows.sort(key=lambda row: (row['assessment_rank'], row['position_id'], row['id']))
        for rank, row in enumerate(rows, 1):
            competence = round(max(0, min(100, row['required_mean'])) * 100)
            support = round(max(0, min(100, row['support'])) * 100)
            preference = maximum_rank + 1 - rank
            row['allocation_utility'] = (preference * base + competence) * base + support
    return allocate(usable, capacities, utility_key='allocation_utility')
