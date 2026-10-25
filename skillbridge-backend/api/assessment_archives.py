"""Reversible library organization. Publication and scoring state stay unchanged."""
from django.db import transaction
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .change_events import notify_changes
from .assessment_progress import assessment_availability
from .management_access import managed_assessments, record_action
from .models import Assessment, StudentResponse


def archive_metadata(assessment):
    return {'is_archived': assessment.is_archived, 'archived_at': assessment.archived_at,
            'archived_by_id': assessment.archived_by_id,
            'archived_by_name': assessment.archived_by.name if assessment.archived_by_id else None}


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@notify_changes('assessment')
@transaction.atomic
def assessment_archive(request, assessment_id, restore=False):
    if request.user.role not in ('admin', 'instructor'):
        return Response({'error': 'Forbidden'}, status=403)
    try:
        # The same parent lock serializes authoring, starts, archive and restore.
        assessment = managed_assessments(request.user).select_for_update(of=('self',)).get(pk=assessment_id)
    except Assessment.DoesNotExist:
        return Response({'error': 'Assessment not found'}, status=404)
    if restore:
        if not assessment.is_archived:
            response = Response({'id': assessment.id, **archive_metadata(assessment)})
            response.skip_change_event = True
            return response
        assessment.archived_at = None
        assessment.archived_by = None
    else:
        if assessment.is_archived:
            response = Response({'id': assessment.id, **archive_metadata(assessment)})
            response.skip_change_event = True
            return response
        if assessment.publication_status == Assessment.PUBLICATION_PUBLISHED:
            return Response({'error': 'Close this assessment before archiving. Closing changes required completion and may affect recommendations.'}, status=409)
        if StudentResponse.objects.filter(assessment=assessment, status=StudentResponse.STATUS_IN_PROGRESS).exists():
            return Response({'error': 'An unfinished student attempt exists. Resolve it before archiving.'}, status=409)
        assessment.archived_at = timezone.now()
        assessment.archived_by = request.user
    assessment.save(update_fields=['archived_at', 'archived_by'])
    record_action(request.user, 'assessment.restore' if restore else 'assessment.archive',
                  'assessment', assessment.id, assessment.batch_id,
                  publication_status=assessment.publication_status)
    return Response({'id': assessment.id, 'availability_status': assessment_availability(assessment), **archive_metadata(assessment)})
