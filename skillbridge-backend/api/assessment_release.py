"""Publish a reviewed set of drafts atomically, using the existing tables."""
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .change_events import notify_changes
from .combined_competency import recalculate_enrolled_students
from .cycle_lifecycle import lifecycle_lock
from .management_access import managed_batches, managed_assessments, record_action
from .models import Assessment


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@notify_changes('assessment')
@transaction.atomic
@lifecycle_lock
def publish_assessments(request, batch_id):
    batch = get_object_or_404(managed_batches(request.user).select_for_update(), pk=batch_id)
    if batch.status != 'active':
        return Response({'error': 'Choose an active batch.'}, status=409)
    ids = request.data.get('assessment_ids') if isinstance(request.data, dict) else None
    if (not isinstance(ids, list) or not 1 <= len(ids) <= 1000
            or any(type(pk) is not int or pk <= 0 for pk in ids) or len(set(ids)) != len(ids)):
        return Response({'error': 'Choose between 1 and 1000 distinct assessment IDs.'}, status=400)
    assessments = list(managed_assessments(request.user).select_for_update().filter(
        batch=batch, pk__in=ids,
    ).order_by('id'))
    if len(assessments) != len(ids):
        return Response({'error': 'One or more assessments are not in this batch or your scope.'}, status=404)
    from .views import _stored_question_error
    drafts = []
    # Validate the whole release before any writes. Published records make a
    # retry after a lost response idempotent, with no duplicate audit events.
    for assessment in assessments:
        if assessment.is_archived or assessment.publication_status not in ('draft', 'published'):
            return Response({'error': 'Only current drafts can be published together.'}, status=409)
        if assessment.publication_status == 'published':
            continue
        error = _stored_question_error(assessment)
        if error:
            return Response({'error': error, 'assessment_id': assessment.id, 'field': 'questions'}, status=400)
        if not assessment.title.strip() or assessment.duration_minutes < 1:
            return Response({'error': 'Each draft needs a title and positive duration.', 'assessment_id': assessment.id}, status=400)
        if assessment.available_at and assessment.due_at and assessment.due_at <= assessment.available_at:
            return Response({'error': 'The deadline must follow the opening time.', 'assessment_id': assessment.id}, status=400)
        drafts.append(assessment)
    for assessment in drafts:
        assessment.publication_status = Assessment.PUBLICATION_PUBLISHED
        assessment.save(update_fields=['publication_status'])
        record_action(request.user, 'assessment.publish', 'assessment', assessment.id, batch.id,
                      release_assessment_ids=sorted(ids))
    if drafts:
        recalculate_enrolled_students(batch)
    result = Response({'batch_id': batch.id, 'assessment_ids': sorted(ids), 'published_count': len(drafts)})
    if not drafts:
        result.skip_change_event = True
    return result
