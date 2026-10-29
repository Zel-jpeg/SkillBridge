"""Scoped assessment reuse and explicit per-attempt time extensions."""
from uuid import UUID
from django.db import transaction
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .attempt_timing import check_attempt_identity, snapshot_timing, timing
from .change_events import notify_changes
from .management_access import managed_assessments, managed_batches, record_action
from .models import Assessment, AnswerChoice, ManagementAction, Question, StudentResponse, User
from .cycle_lifecycle import lifecycle_lock


def request_id(data):
    try:
        return str(UUID(data.get('request_id', '')))
    except (ValueError, TypeError, AttributeError):
        return None


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@notify_changes('assessment')
@transaction.atomic
@lifecycle_lock
def assessment_duplicate(request, assessment_id):
    if request.user.role not in ('admin', 'instructor'):
        return Response({'error': 'Forbidden'}, status=403)
    try:
        source = managed_assessments(request.user).select_for_update(of=('self',)).get(pk=assessment_id)
    except Assessment.DoesNotExist:
        return Response({'error': 'Assessment not found'}, status=404)
    nonce = request_id(request.data)
    if nonce is None:
        return Response({'error': 'A valid request_id is required.'}, status=400)
    prior = ManagementAction.objects.filter(actor=request.user, action='assessment.duplicate',
        metadata__source_assessment_id=source.id, metadata__request_id=nonce).first()
    if prior:
        copy = managed_assessments(request.user).filter(pk=prior.target_id).first()
        if copy is None:
            return Response({'error': 'The existing copy is no longer in your scope.'}, status=409)
        response = Response({'id': copy.id, 'title': copy.title, 'publication_status': copy.publication_status})
        response.skip_change_event = True
        return response
    title = request.data.get('title', (source.title[:248] + ' (copy)'))
    if not isinstance(title, str) or not title.strip() or len(title.strip()) > 255:
        return Response({'error': 'Enter a copy title of at most 255 characters.', 'field': 'title'}, status=400)
    batch = None
    if request.data.get('batch_id') is not None:
        batch_id = request.data['batch_id']
        if type(batch_id) is not int or batch_id <= 0:
            return Response({'error': 'Choose a valid active batch.', 'field': 'batch_id'}, status=400)
        batch = managed_batches(request.user).filter(pk=batch_id, status='active').first()
        if batch is None:
            return Response({'error': 'Active batch not found.', 'field': 'batch_id'}, status=404)
    copy = Assessment.objects.create(title=title.strip(), created_by=request.user, batch=batch,
        duration_minutes=source.duration_minutes, publication_status='draft', is_required=False,
        include_in_competency=False, display_order=0)
    for question in source.questions.prefetch_related('choices').order_by('question_order', 'id'):
        new_question = Question.objects.create(assessment=copy, question_text=question.question_text,
            question_type=question.question_type, skill_category_id=question.skill_category_id,
            question_order=question.question_order)
        AnswerChoice.objects.bulk_create([AnswerChoice(question=new_question, choice_text=choice.choice_text,
            is_correct=choice.is_correct) for choice in question.choices.all().order_by('id')])
    record_action(request.user, 'assessment.duplicate', 'assessment', copy.id, copy.batch_id,
                  source_assessment_id=source.id, request_id=nonce)
    return Response({'id': copy.id, 'title': copy.title, 'publication_status': 'draft'}, status=201)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def assessment_attempt_timing(request, assessment_id):
    if request.user.role != 'student':
        return Response({'error': 'Students only'}, status=403)
    response = StudentResponse.objects.select_related('assessment', 'assessment__batch').filter(
        student=request.user, assessment_id=assessment_id,
        assessment__batch__enrollments__student=request.user).first()
    if response is None or response.started_at is None:
        return Response({'error': 'Attempt not found'}, status=404)
    check_attempt_identity(response, request.query_params)
    a = response.assessment
    if a.is_archived or not a.batch_id or a.batch.status != 'active' or a.publication_status != 'published':
        return Response({'error': 'Assessment is unavailable'}, status=409)
    result = Response({'status': response.status, **timing(response)})
    result['Cache-Control'] = 'no-store'
    return result


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@notify_changes('attempt')
@transaction.atomic
@lifecycle_lock
def assessment_extra_time(request, assessment_id, student_id):
    if request.user.role not in ('admin', 'instructor'):
        return Response({'error': 'Forbidden'}, status=403)
    try:
        assessment = managed_assessments(request.user).select_for_update(of=('self',)).get(pk=assessment_id)
    except Assessment.DoesNotExist:
        return Response({'error': 'Assessment not found'}, status=404)
    if assessment.is_archived or assessment.publication_status != 'published' or not assessment.batch_id or assessment.batch.status != 'active':
        return Response({'error': 'Extra time requires an available, unarchived assessment in an active batch.'}, status=409)
    response = StudentResponse.objects.select_for_update(of=('self',)).filter(
        student_id=student_id, assessment=assessment, student__enrollments__batch_id=assessment.batch_id).first()
    if response is None:
        return Response({'error': 'Attempt not found in the assessment batch'}, status=404)
    if not User.objects.select_for_update().filter(pk=student_id, is_active=True).exists():
        return Response({'error': 'Archived student accounts are read-only.'}, status=409)
    check_attempt_identity(response, request.data)
    nonce, minutes, reason = request_id(request.data), request.data.get('minutes'), request.data.get('reason')
    if nonce is None or type(minutes) is not int or not 1 <= minutes <= 180 or not isinstance(reason, str) or not reason.strip() or len(reason.strip()) > 500:
        return Response({'error': 'Provide 1–180 whole extra minutes, a reason of at most 500 characters and a valid request_id.'}, status=400)
    prior = ManagementAction.objects.filter(actor=request.user, action='attempt.extra_time', target_id=response.id,
        metadata__request_id=nonce, metadata__attempt_started_at=request.data['attempt_started_at']).exists()
    if prior:
        result = Response({'student_id': student_id, 'assessment_id': assessment.id, **timing(response)})
        result.skip_change_event = True
        return result
    if response.status != 'in_progress' or response.submitted_at is not None or response.started_at is None:
        return Response({'error': 'Only a current, unfinished attempt can receive extra time. Use the reviewed retake workflow for finalized attempts.'}, status=409)
    response.assessment = assessment
    snapshot_timing(response)
    now = timezone.now()
    current = timing(response, now)
    if current['remaining_seconds'] <= 0:
        return Response({'error': 'This attempt has already expired. Use the reviewed retake workflow.'}, status=409)
    new_deadline = response.expires_at + timezone.timedelta(seconds=response.extra_time_seconds + minutes * 60)
    if assessment.due_at and new_deadline > assessment.due_at:
        return Response({'error': 'The extension would exceed the assessment deadline. Extend that deadline first or grant fewer minutes.'}, status=409)
    response.extra_time_seconds += minutes * 60
    response.save(update_fields=['extra_time_seconds'])
    record_action(request.user, 'attempt.extra_time', 'response', response.id, assessment.batch_id,
                  assessment_id=assessment.id, student_id=student_id, minutes=minutes,
                  reason=reason.strip(), request_id=nonce, attempt_started_at=request.data['attempt_started_at'],
                  deadline_at=new_deadline.isoformat())
    return Response({'student_id': student_id, 'assessment_id': assessment.id, **timing(response, now)})
