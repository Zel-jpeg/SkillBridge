"""Student-owned batch history without loading snapshots or assessment details."""
from django.db.models import Q

from .models import Batch, BatchEnrollment, ManagementAction, OJTPlacement, StudentResponse


def recorded_batches(student):
    return Batch.objects.filter(
        Q(pk__in=BatchEnrollment.objects.filter(student=student).values('batch_id'))
        | Q(pk__in=StudentResponse.objects.filter(student=student).values('assessment__batch_id'))
        | Q(pk__in=OJTPlacement.objects.filter(student=student).values('batch_id'))
        | Q(pk__in=ManagementAction.objects.filter(
            action='enrollment.remove', target_type='student', target_id=student.pk,
        ).values('batch_id_snapshot'))
    )


def previous_batches(student, enrollment):
    batches = recorded_batches(student)
    return batches.exclude(pk=enrollment.batch_id) if enrollment else batches
