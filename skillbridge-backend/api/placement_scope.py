"""Current recommendation allocations are separate from saved decision history."""
from django.db.models import Exists, OuterRef, Q

from .models import Batch, BatchEnrollment, OJTPlacement


def current_approvals(**filters):
    """Share slots across active enrolled batches; retain detached legacy holds.

    Archiving/unenrollment does not rewrite an approval or assert OJT completion.
    EXISTS avoids duplicate counts and parent joins in locking queries.
    """
    return OJTPlacement.objects.filter(status='approved', **filters).alias(
        current_batch=Exists(Batch.objects.filter(pk=OuterRef('batch_id'), status='active')),
        current_member=Exists(BatchEnrollment.objects.filter(
            batch_id=OuterRef('batch_id'), student_id=OuterRef('student_id'))),
    ).filter(Q(batch__isnull=True) | Q(current_batch=True, current_member=True))


def reactivation_conflict(batch):
    """A reopened batch must not revive unavailable or overbooked allocations."""
    from collections import Counter
    candidates = list(OJTPlacement.objects.filter(batch=batch, status='approved',
        student_id__in=BatchEnrollment.objects.filter(batch=batch).values('student_id'))
        .select_related('position__company'))
    if not candidates:
        return None
    if current_approvals(student_id__in=[row.student_id for row in candidates]).exists():
        return 'Some students have a current or detached approved decision. Resolve it before reactivating this batch.'
    occupied = Counter(current_approvals(position_id__in=[row.position_id for row in candidates])
                       .values_list('position_id', flat=True))
    restored = Counter(row.position_id for row in candidates)
    for row in candidates:
        if row.position.archived_at or row.position.company.archived_at:
            return 'Restore the partners and positions used by this batch’s approved decisions before reactivating it.'
        if occupied[row.position_id] + restored[row.position_id] > row.position.slots_available:
            return 'Reactivating this batch would exceed current shared slots. Review its approved decisions and openings first.'
    return None


def enrollment_allocation_conflict(student, batch):
    """Re-enrollment can revive a saved approval, so validate its slot first."""
    saved = OJTPlacement.objects.filter(student=student, batch=batch, status='approved').select_related('position__company').first()
    if saved is None:
        return None
    if current_approvals(student=student).exclude(pk=saved.pk).exists():
        return 'An existing current or detached approval conflicts with restoring this batch enrollment.'
    if saved.position.archived_at or saved.position.company.archived_at:
        return 'Restore the partner and position used by the saved approved decision before re-enrollment.'
    if current_approvals(position=saved.position).exclude(pk=saved.pk).count() >= saved.position.slots_available:
        return 'The saved approved decision has no current slot. Review the decision or openings before re-enrollment.'
    return None
