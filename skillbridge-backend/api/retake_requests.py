"""One reviewed retake request per current attempt; history stays on existing rows."""
import json
from uuid import UUID
from django.db import transaction
from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from .models import Assessment, StudentResponse, BatchEnrollment, AssessmentAttemptHistory, User
from .assessment_progress import assessment_availability
from .attempt_timing import check_attempt_identity, timing, mark_expired_for_review
from .change_events import notify_changes
from .management_access import record_action
from .cycle_lifecycle import lifecycle_lock
from . import retake_evidence


def request_snapshot(attempt):
    if not attempt.retake_request_status:
        return {}
    return {'status': attempt.retake_request_status, 'request_id': attempt.retake_request_id,
            'explanation': attempt.retake_explanation, 'no_image_reason': attempt.retake_no_image_reason,
            'image_key': attempt.retake_image_key,
            'requested_at': attempt.retake_requested_at.isoformat() if attempt.retake_requested_at else None,
            'reviewed_at': attempt.retake_reviewed_at.isoformat() if attempt.retake_reviewed_at else None,
            'unsubmitted_draft': attempt.draft_answers if attempt.stopped_reason == 'attempt_expired' else [],
            'reviewed_by_id': attempt.retake_reviewed_by_id, 'review_note': attempt.retake_review_note}


def summary(attempt):
    data = request_snapshot(attempt)
    data.pop('image_key', None)
    data.pop('unsubmitted_draft', None)
    data['has_image'] = bool(attempt.retake_image_key)
    return data


def request_eligible(attempt):
    available = assessment_availability(attempt.assessment)
    expired_draft = attempt.status == 'in_progress' and attempt.started_at and timing(attempt)['remaining_seconds'] <= 0
    return (not attempt.retake_request_status and not attempt.retake_allowed and
            (attempt.status in ('submitted', 'stopped') or expired_draft) and
            available in ('available', 'overdue', 'closed'))


def can_manage(user, attempt):
    return user.role == 'admin' or (user.role == 'instructor' and attempt.assessment.batch_id and
                                     attempt.assessment.batch.instructor_id == user.id)


def student_attempt(request, assessment_id):
    from .views import _student_assessment
    assessment, error = _student_assessment(request, assessment_id, require_available=False)
    if error is not None:
        return None, error
    attempt = StudentResponse.objects.select_related('assessment__batch').filter(student=request.user, assessment=assessment).first()
    return attempt, None


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@notify_changes('attempt')
def student_request(request, assessment_id):
    attempt, error = student_attempt(request, assessment_id)
    if error is not None:
        return error
    if attempt is None:
        return Response({'error': 'No recorded attempt for this assessment.'}, status=404)
    if request.method == 'GET':
        return Response({'assessment_id': assessment_id, 'student_id': request.user.id, 'assessment': attempt.assessment.title,
                         'attempt_started_at': attempt.started_at.isoformat() if attempt.started_at else None,
                         'status': attempt.status, 'retake_allowed': attempt.retake_allowed,
                         'request': summary(attempt),
                         'history': [{'history_id': item.id, **{key: value for key, value in item.retake_request.items() if key not in ('image_key', 'unsubmitted_draft')},
                                      'has_image': bool(item.retake_request.get('image_key'))}
                                     for item in attempt.prior_attempts.exclude(retake_request={}).order_by('-attempt_number')],
                         'can_request': bool(request_eligible(attempt))})
    data = request.data
    if request.content_type.startswith('multipart/'):
        if set(data) - {'payload', 'image'} or len(data.getlist('payload')) != 1 or len(request.FILES.getlist('image')) > 1:
            raise ValidationError({'error': 'Send one payload and at most one image.'})
        try:
            data = json.loads(data['payload'])
        except (ValueError, TypeError):
            raise ValidationError({'error': 'Invalid request payload.'}) from None
    if not isinstance(data, dict) or set(data) - {'attempt_started_at', 'response_id', 'explanation', 'no_image_reason', 'request_id'}:
        raise ValidationError({'error': 'Invalid request fields.'})
    explanation, no_image = data.get('explanation', ''), data.get('no_image_reason', '')
    if not isinstance(explanation, str) or not 30 <= len(explanation.strip()) <= 500:
        raise ValidationError({'error': 'Explain what happened using 30–500 characters.'})
    image = request.FILES.get('image')
    if not isinstance(no_image, str) or len(no_image) > 500 or (not image and len(no_image.strip()) < 15):
        raise ValidationError({'error': 'Attach an image or explain why none is available (15–500 characters).'})
    try:
        request_id = str(UUID(data.get('request_id', '')))
    except (ValueError, TypeError, AttributeError):
        raise ValidationError({'error': 'A valid request ID is required.'}) from None
    content = retake_evidence.convert_evidence(image) if image else None
    new_key = ''
    try:
        # Validate before Storage, then validate again under the row locks. Slow
        # uploads must not hold an assessment lock needed by active students.
        check_attempt_identity(attempt, data)
        if not attempt.retake_request_status and request_eligible(attempt) and content:
            new_key = retake_evidence.upload(content)
        with transaction.atomic():
            assessment = Assessment.objects.select_for_update().get(pk=assessment_id)
            attempt = StudentResponse.objects.select_for_update().get(pk=attempt.pk)
            if not BatchEnrollment.objects.filter(batch_id=assessment.batch_id, student=request.user).exists():
                raise PermissionDenied()
            check_attempt_identity(attempt, data)
            if attempt.retake_request_status:
                if attempt.retake_request_id == request_id:
                    return Response({'request': summary(attempt), 'already_requested': True})
                return Response({'error': 'This attempt already has a retake request.'}, status=409)
            attempt.assessment = assessment
            if not request_eligible(attempt):
                return Response({'error': 'A request needs a finalized or expired attempt in an active, unarchived assessment.'}, status=409)
            if content and not new_key:
                return Response({'error': 'The attempt changed while preparing evidence. Please retry.'}, status=409)
            if attempt.status == 'in_progress':
                # A device may have closed before auto-submit. Preserve only the
                # last server-validated draft; requests cannot add late answers.
                mark_expired_for_review(attempt, timezone.now())
            attempt.retake_request_status = 'pending'
            attempt.retake_request_id = request_id
            attempt.retake_explanation = explanation.strip()
            attempt.retake_no_image_reason = no_image.strip() if not image else ''
            attempt.retake_image_key = new_key
            attempt.retake_requested_at = timezone.now()
            attempt.save(update_fields=['retake_request_status', 'retake_request_id', 'retake_explanation',
                                       'retake_no_image_reason', 'retake_image_key', 'retake_requested_at'])
        return Response({'request': summary(attempt)}, status=201)
    finally:
        # Referenced current/history objects are retained; conflicts, rollback
        # and uncertain duplicate uploads leave no unreferenced object behind.
        if new_key:
            retake_evidence.cleanup(new_key)


def queue_row(attempt, history=None):
    stored = history.retake_request if history else request_snapshot(attempt)
    return {'id': attempt.id, 'history_id': history.id if history else None, 'assessment_id': attempt.assessment_id,
            'assessment': attempt.assessment.title, 'student_id': attempt.student_id,
            'student': attempt.student.name, 'school_id': attempt.student.school_id,
            'batch': attempt.assessment.batch.name if attempt.assessment.batch_id else '',
            'attempt_started_at': (history.started_at if history else attempt.started_at).isoformat(),
            'attempt_status': history.status if history else attempt.status,
            'stopped_reason': history.stopped_reason if history else attempt.stopped_reason_display,
            'interruptions': history.interruption_events if history else attempt.interruption_events,
            'request': {key: value for key, value in stored.items() if key not in ('image_key', 'unsubmitted_draft')},
            'unsubmitted_draft_count': len(stored.get('unsubmitted_draft', [])),
            'has_image': bool(stored.get('image_key')), 'read_only': bool(history) or attempt.assessment.is_archived or not attempt.student.is_active or bool(attempt.assessment.batch_id and attempt.assessment.batch.status != 'active')}


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def request_queue(request):
    if request.user.role not in ('admin', 'instructor'):
        raise PermissionDenied()
    rows = StudentResponse.objects.select_related('assessment__batch', 'student').exclude(retake_request_status='')
    if request.user.role == 'instructor':
        rows = rows.filter(assessment__batch__instructor=request.user)
    status = request.query_params.get('status', 'pending')
    if status not in ('pending', 'approved', 'declined', 'all', 'history'):
        raise ValidationError({'error': 'Invalid status filter.'})
    if status not in ('all', 'history'):
        rows = rows.filter(retake_request_status=status)
    query = request.query_params.get('search', '').strip()[:100]
    if query:
        rows = rows.filter(Q(student__name__icontains=query) | Q(student__school_id__icontains=query) | Q(assessment__title__icontains=query))
    # Archived request snapshots remain reviewable via the attempt history, below.
    try:
        page = max(1, int(request.query_params.get('page', '1')))
    except ValueError:
        raise ValidationError({'error': 'Invalid page.'}) from None
    if status == 'history':
        histories = AssessmentAttemptHistory.objects.select_related('response__assessment__batch', 'response__student').exclude(retake_request={})
        if request.user.role == 'instructor':
            histories = histories.filter(response__assessment__batch__instructor=request.user)
        if query:
            histories = histories.filter(Q(response__student__name__icontains=query) | Q(response__student__school_id__icontains=query) | Q(response__assessment__title__icontains=query))
        total = histories.count()
        page = min(page, max(1, (total + 7) // 8))
        return Response({'count': total, 'page': page, 'page_size': 8,
                         'results': [queue_row(item.response, item) for item in histories.order_by('-archived_at', '-id')[(page - 1) * 8:page * 8]]})
    total = rows.count()
    page = min(page, max(1, (total + 7) // 8))
    return Response({'count': total, 'page': page, 'page_size': 8,
                     'results': [queue_row(row) for row in rows.order_by('-retake_requested_at', '-id')[(page - 1) * 8:page * 8]]})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@notify_changes('attempt')
@lifecycle_lock
def review_request(request, assessment_id, student_id):
    if not isinstance(request.data, dict):
        raise ValidationError({'error': 'Review data must be an object.'})
    with transaction.atomic():
        assessment = get_object_or_404(Assessment.objects.select_for_update(of=('self',)).select_related('batch'), pk=assessment_id)
        attempt = get_object_or_404(StudentResponse.objects.select_for_update(of=('self',)).select_related('assessment__batch'), assessment=assessment, student_id=student_id)
        if not can_manage(request.user, attempt):
            raise PermissionDenied()
        if not User.objects.select_for_update().filter(pk=student_id, is_active=True).exists():
            return Response({'error': 'Archived student accounts are read-only.'}, status=409)
        check_attempt_identity(attempt, request.data)
        if request.data.get('request_id') != attempt.retake_request_id:
            return Response({'error': 'The request changed. Refresh before reviewing.'}, status=409)
        decision, note = request.data.get('decision'), request.data.get('note', '')
        if decision not in ('approved', 'declined') or not isinstance(note, str) or not 10 <= len(note.strip()) <= 1000:
            raise ValidationError({'error': 'Choose a decision and provide a review note (10–1000 characters).'})
        if attempt.retake_request_status != 'pending':
            return Response({'error': 'This request has already been reviewed.'}, status=409)
        if assessment.is_archived or (assessment.batch_id and assessment.batch.status != 'active') or not BatchEnrollment.objects.filter(batch=assessment.batch, student_id=student_id).exists():
            return Response({'error': 'The assessment is archived or enrollment changed.'}, status=409)
        if decision == 'approved' and assessment_availability(assessment) != 'available':
            return Response({'error': 'Reopen or extend this assessment before approving a retake.'}, status=409)
        attempt.retake_request_status = decision
        attempt.retake_reviewed_at = timezone.now()
        attempt.retake_reviewed_by = request.user
        attempt.retake_review_note = note.strip()
        attempt.retake_allowed = decision == 'approved'
        attempt.save(update_fields=['retake_request_status', 'retake_reviewed_at', 'retake_reviewed_by', 'retake_review_note', 'retake_allowed'])
        record_action(request.user, 'attempt.retake_request_review', 'student', student_id, assessment.batch_id,
                      assessment_id=assessment_id, decision=decision)
    return Response({'request': summary(attempt), 'retake_allowed': attempt.retake_allowed})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def evidence(request, assessment_id, student_id):
    attempt = get_object_or_404(StudentResponse.objects.select_related('assessment__batch'), assessment_id=assessment_id, student_id=student_id)
    if not (can_manage(request.user, attempt) or (request.user.role == 'student' and request.user.id == student_id)):
        raise PermissionDenied()
    key = attempt.retake_image_key
    if request.query_params.get('history_id'):
        try:
            history_id = int(request.query_params['history_id'])
        except (ValueError, TypeError):
            raise ValidationError({'error': 'Invalid history ID.'}) from None
        history = get_object_or_404(AssessmentAttemptHistory, pk=history_id, response=attempt)
        key = history.retake_request.get('image_key', '')
    if not key:
        return Response({'error': 'No evidence image.'}, status=404)
    response = HttpResponse(retake_evidence.download(key), content_type='image/webp')
    response['Cache-Control'] = 'private, no-store'
    response['X-Content-Type-Options'] = 'nosniff'
    response['Content-Disposition'] = 'inline; filename="retake-evidence.webp"'
    return response
