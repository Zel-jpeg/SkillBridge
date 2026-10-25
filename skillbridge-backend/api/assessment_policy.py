"""Server-enforced assessment lifecycle rules, under the assessment row lock."""
from rest_framework.exceptions import APIException
from .models import StudentResponse


class AssessmentPolicyConflict(APIException):
    status_code = 409


def validate_settings_change(assessment, before):
    attempts = StudentResponse.objects.filter(assessment=assessment)
    if not attempts.exists():
        return
    def reject(message, field):
        raise AssessmentPolicyConflict({'error': message, 'field': field})
    if assessment.duration_minutes != before['duration_minutes']:
        reject('The standard time limit is locked after the first attempt. Use an explicit attempt extension or duplicate as draft.', 'duration_minutes')
    if assessment.available_at != before['available_at']:
        reject('The opening time is locked after the first attempt.', 'available_at')
    old_due, new_due = before['due_at'], assessment.due_at
    if new_due is not None and (old_due is None or new_due < old_due):
        reject('After the first attempt, the deadline can only be extended or removed. Existing attempt timers stay unchanged.', 'due_at')
    if assessment.publication_status != before['publication_status'] and attempts.filter(status=StudentResponse.STATUS_IN_PROGRESS, submitted_at__isnull=True).exists():
        reject('Resolve active attempts before changing publication. Closing now would interrupt student submissions.', 'publication_status')
