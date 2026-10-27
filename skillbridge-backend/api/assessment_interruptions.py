"""Neutral interruption recovery and validated drafts, separate from score evidence."""
from uuid import UUID
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from .models import Assessment, StudentResponse
from .attempt_timing import check_attempt_identity, timing
from .scoring import validate_submission_answers

POLICY = {'blur_seconds': 2, 'hidden_seconds': 10, 'maximum_seconds': 60, 'maximum_incidents': 3}
REASONS = {'window_lost_focus', 'tab_hidden', 'fullscreen_exited', 'page_closed'}


def state(attempt):
    events = attempt.interruption_events
    counted = sum(event.get('counted', False) for event in events)
    total = sum(event.get('duration_seconds', 0) for event in events)
    open_event = next((event for event in reversed(events) if not event.get('ended_at')), None)
    open_seconds = max(0, (timezone.now() - parse_datetime(open_event['started_at'])).total_seconds()) if open_event else 0
    return {'policy': POLICY, 'open_event': open_event, 'open_seconds': round(open_seconds, 2), 'incident_count': counted,
            'total_seconds': total, 'review_required': len(events) >= 100 or counted >= POLICY['maximum_incidents'] or
            total + open_seconds >= POLICY['maximum_seconds']}


def save_draft(attempt, data):
    if 'answers' not in data:
        return
    revision = data.get('revision')
    if type(revision) is not int or revision < 0 or revision > 9_007_199_254_740_991:
        raise ValidationError({'error': 'Invalid draft revision.'})
    answers = data['answers']
    if not isinstance(answers, list) or len(answers) > 2000 or any(
            isinstance(answer, dict) and isinstance(answer.get('text_answer'), str) and len(answer['text_answer']) > 5000 for answer in answers):
        raise ValidationError({'error': 'Invalid or oversized draft.'})
    validate_submission_answers(answers, list(attempt.assessment.questions.prefetch_related('choices')))
    if revision > attempt.draft_revision and timing(attempt)['remaining_seconds'] > 0:
        attempt.draft_answers = answers
        attempt.draft_revision = revision


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def assessment_interruption(request, assessment_id):
    from .views import _student_assessment
    _, error = _student_assessment(request, assessment_id, allow_overdue=True)
    if error is not None:
        return error
    data = request.data
    if not isinstance(data, dict):
        raise ValidationError({'error': 'Interruption data must be an object.'})
    action = data.get('action')
    if action not in ('begin', 'recover', 'draft'):
        raise ValidationError({'error': 'Invalid interruption action.'})
    with transaction.atomic():
        assessment = get_object_or_404(Assessment.objects.select_for_update(), pk=assessment_id)
        attempt = get_object_or_404(StudentResponse.objects.select_for_update(), assessment=assessment, student=request.user)
        check_attempt_identity(attempt, data)
        if attempt.status != 'in_progress' or attempt.submitted_at:
            return Response({'error': 'Attempt already finalized.'}, status=409)
        save_draft(attempt, data)
        events = list(attempt.interruption_events)
        if action != 'draft':
            try:
                event_id = str(UUID(data.get('event_id', '')))
            except (ValueError, AttributeError, TypeError):
                raise ValidationError({'error': 'Invalid interruption ID.'}) from None
            event = next((item for item in events if item['id'] == event_id), None)
            open_event = next((item for item in events if not item.get('ended_at')), None)
            if action == 'begin':
                reason = data.get('reason')
                if reason not in REASONS:
                    raise ValidationError({'error': 'Invalid interruption reason.'})
                if open_event:
                    event = open_event
                    if reason not in event['reasons']:
                        event['reasons'].append(reason)
                elif event is None:
                    if len(events) >= 100:
                        return Response({**timing(attempt), **state(attempt)})
                    events.append({'id': event_id, 'started_at': timezone.now().isoformat(), 'reasons': [reason]})
            elif event and not event.get('ended_at'):
                duration = max(0, (timezone.now() - parse_datetime(event['started_at'])).total_seconds())
                event.update(ended_at=timezone.now().isoformat(), duration_seconds=round(duration, 2),
                             counted=duration >= (POLICY['blur_seconds'] if event['reasons'] == ['window_lost_focus'] else POLICY['hidden_seconds']))
            elif event is None:
                return Response({'error': 'Interruption not recorded. Retry recovery.'}, status=409)
        attempt.interruption_events = events
        attempt.save(update_fields=['draft_answers', 'draft_revision', 'interruption_events'])
        result = state(attempt)
        result['review_required'] = result['review_required'] or timing(attempt)['review_required']
        return Response({**timing(attempt), **result, 'draft_revision': attempt.draft_revision})
