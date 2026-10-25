"""Server-authoritative attempt identity and duration policy."""
from django.utils import timezone
from rest_framework.exceptions import ValidationError

SUBMISSION_GRACE_SECONDS = 30
EXPIRY_REVIEW_REASON = 'attempt_expired'
EXPIRY_REVIEW_MESSAGE = 'The submission grace period has ended. Answers were saved for instructor review; this attempt does not count as completed. Ask your instructor to review it and allow a retake.'


def attempt_identity(response):
    # started_at changes for every approved retake even though the row ID is reused.
    return response.started_at.isoformat() if response.started_at else None


def check_attempt_identity(response, data):
    if not data.get('attempt_started_at') or data['attempt_started_at'] != attempt_identity(response):
        raise ValidationError({'error': 'Attempt has changed or its identity is missing. Reload the assessment list before continuing.', 'code': 'attempt_changed'})
    if data.get('response_id') is not None and str(data['response_id']) != str(response.id):
        raise ValidationError({'error': 'Attempt does not match response_id.', 'code': 'attempt_changed'})


def snapshot_timing(response):
    """Assign once at start/legacy resume; callers hold the attempt's row lock."""
    if response.started_at is None:
        return
    if response.duration_seconds is None or response.expires_at is None:
        response.duration_seconds = response.assessment.duration_minutes * 60
        response.due_at_snapshot = response.assessment.due_at
        duration_end = response.started_at + timezone.timedelta(seconds=response.duration_seconds)
        response.expires_at = min(duration_end, response.due_at_snapshot) if response.due_at_snapshot else duration_end
        response.extra_time_seconds = 0
        response.save(update_fields=['duration_seconds', 'due_at_snapshot', 'expires_at', 'extra_time_seconds'])


def timing(response, now=None):
    now = now or timezone.now()
    # Legacy finalized rows may have no snapshot. This fallback is read-only;
    # active rows are snapshotted under lock before delivery/finalization.
    duration = response.duration_seconds if response.duration_seconds is not None else response.assessment.duration_minutes * 60
    natural_end = response.started_at + timezone.timedelta(seconds=duration)
    cutoff = response.due_at_snapshot if response.expires_at is not None else response.assessment.due_at
    base_end = response.expires_at or (min(natural_end, cutoff) if cutoff else natural_end)
    deadline = base_end + timezone.timedelta(seconds=response.extra_time_seconds)
    grace_deadline = deadline + timezone.timedelta(seconds=SUBMISSION_GRACE_SECONDS)
    # The same brief transport allowance covers a deadline-capped auto-submit;
    # the student countdown still stops at deadline, not at the grace boundary.
    return {
        'attempt_started_at': attempt_identity(response),
        'server_now': now.isoformat(),
        'deadline_at': deadline.isoformat(),
        'grace_deadline_at': grace_deadline.isoformat(),
        'remaining_seconds': max(0, (deadline - now).total_seconds()),
        'duration_seconds': duration,
        'extra_time_seconds': response.extra_time_seconds,
        'due_at_snapshot': cutoff.isoformat() if cutoff else None,
        'review_required': now > grace_deadline,
    }


def mark_expired_for_review(response, now):
    response.status = response.STATUS_STOPPED
    response.submitted_at = now
    response.stopped_at = now
    response.stopped_reason = EXPIRY_REVIEW_REASON
    response.stopped_reason_display = EXPIRY_REVIEW_MESSAGE
    response.is_flagged = True
    response.retake_allowed = False
    response.save(update_fields=['status', 'submitted_at', 'stopped_at', 'stopped_reason',
                                 'stopped_reason_display', 'is_flagged', 'retake_allowed'])
