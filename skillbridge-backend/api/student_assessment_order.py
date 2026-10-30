"""Student aliases are separate from staff titles and assessment evidence."""
import secrets

from django.db import transaction
from django.db.models import Q

from .models import Assessment, Batch, BatchEnrollment, ManagementAction


def _ids(value):
    if not isinstance(value, list):
        return []
    return list(dict.fromkeys(item for item in value if type(item) is int and item > 0))


@transaction.atomic
def assessment_numbers(student, batch):
    """Reserve aliases once; append newly released IDs without renumbering.

    The same batch-before-enrollment lock is used by publication and enrollment
    writes. An atomic draft release therefore appears as one complete pool.
    Empty batches never freeze an empty order. No attempt is created here.
    """
    Batch.objects.only('id').select_for_update().get(pk=batch.pk)
    enrollment = BatchEnrollment.objects.select_for_update().filter(
        student=student, batch=batch,
    ).first()
    if enrollment:
        order = _ids(enrollment.assessment_order)
    else:
        order = []
    if not order:
        # Unenrollment removes membership, so keep its reserved aliases in the
        # existing staff audit, and restore them on same-batch re-enrollment.
        removal = ManagementAction.objects.filter(
            action='enrollment.remove', target_type='student', target_id=student.pk,
            batch_id_snapshot=batch.pk,
        ).order_by('-id').values_list('metadata', flat=True).first()
        order = _ids((removal or {}).get('assessment_order', []))
    candidates = list(Assessment.objects.filter(batch=batch).filter(
        Q(publication_status=Assessment.PUBLICATION_PUBLISHED, archived_at__isnull=True)
        | Q(responses__student=student)
    ).exclude(publication_status=Assessment.PUBLICATION_DRAFT).order_by('id').values_list('id', flat=True).distinct())
    known = set(order)
    new_ids = [pk for pk in candidates if pk not in known]
    if enrollment and new_ids:
        secrets.SystemRandom().shuffle(new_ids)
    # Detached historical records without a saved mapping use a stable ID order.
    order.extend(new_ids)
    if enrollment and enrollment.assessment_order != order:
        enrollment.assessment_order = order
        enrollment.save(update_fields=['assessment_order'])
    return {pk: number for number, pk in enumerate(order, 1)}


def assessment_title(numbers, assessment_id):
    number = numbers.get(assessment_id)
    return f'Assessment {number}' if number else 'Assessment'
