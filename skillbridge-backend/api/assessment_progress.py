"""Batch-scoped assessment visibility and completion rules.

Final cross-assessment scoring is intentionally outside this module.
"""

from django.utils import timezone

from .models import Assessment, BatchEnrollment, StudentResponse


def current_enrollment(student):
    return (BatchEnrollment.objects.filter(student=student, batch__status='active')
            .select_related('batch').order_by('-enrolled_at', '-id').first())


def assessment_availability(assessment, now=None):
    now = now or timezone.now()
    if assessment.batch_id is None or assessment.batch.status != 'active':
        return 'batch_inactive'
    if assessment.publication_status != Assessment.PUBLICATION_PUBLISHED:
        return assessment.publication_status
    if assessment.available_at and now < assessment.available_at:
        return 'upcoming'
    if assessment.due_at and now > assessment.due_at:
        return 'overdue'
    return 'available'


def required_progress(student, batch):
    """Gate completion on currently assigned (published) required assessments.

    Score history is separate: a finalized assessment may still contribute
    historical SkillScore rows after it is closed.
    """
    required = Assessment.objects.filter(
        batch=batch,
        publication_status=Assessment.PUBLICATION_PUBLISHED,
        is_required=True,
        include_in_competency=True,
    )
    total = required.count()
    completed = required.filter(
        responses__student=student, responses__status=StudentResponse.STATUS_SUBMITTED,
        responses__submitted_at__isnull=False, responses__is_flagged=False,
    ).distinct().count()
    return {
        'has_required_assessments': total > 0,
        'all_required_completed': total > 0 and completed == total,
        'completed_required_count': completed,
        'total_required_count': total,
        'remaining_required_count': total - completed,
    }


def attempt_action(assessment, response):
    if response and response.retake_allowed and assessment_availability(assessment) == 'available':
        return 'retake_allowed'
    if response and response.submitted_at and response.status in (
        StudentResponse.STATUS_SUBMITTED, StudentResponse.STATUS_STOPPED,
    ):
        return 'awaiting_retake' if response.status == StudentResponse.STATUS_STOPPED else 'view_result'
    if assessment_availability(assessment) != 'available':
        return 'unavailable'
    if response is None:
        return 'start'
    if response.status == StudentResponse.STATUS_IN_PROGRESS:
        return 'continue'
    if response.status == StudentResponse.STATUS_STOPPED:
        return 'awaiting_retake'
    return 'view_result'
