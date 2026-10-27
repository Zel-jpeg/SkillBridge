"""Scoped student recovery reads. Never recreate memberships or recalculate scores."""
from django.db.models import Max
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from .management_access import managed_batches
from .models import Batch, BatchEnrollment, CombinedCompetencyProfile, ManagementAction, OJTPlacement, User


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def previously_unenrolled(request, batch_id):
    batch = get_object_or_404(managed_batches(request.user), pk=batch_id)
    removed = ManagementAction.objects.filter(action='enrollment.remove', target_type='student',
                                               batch_id_snapshot=batch.id).values('target_id').annotate(removed_at=Max('created_at'))
    dates = {row['target_id']: row['removed_at'] for row in removed}
    students = User.objects.filter(role='student', id__in=dates).exclude(
        id__in=BatchEnrollment.objects.filter(batch=batch).values('student_id')).order_by('name', 'id')
    return Response({'batch': {'id': batch.id, 'name': batch.name, 'status': batch.status},
                     'students': [{'id': student.id, 'name': student.name, 'school_id': student.school_id,
                                   'email': student.email, 'course': student.course, 'photo_url': student.photo_url,
                                   'is_active': student.is_active, 'removed_at': dates[student.id]}
                                  for student in students],
                     'coverage_note': 'Only recorded unenrollments appear here. Older removals without an audit record may not be listed.'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def archived_student_history(request, student_id):
    if request.user.role != 'admin':
        raise PermissionDenied()
    student = get_object_or_404(User, pk=student_id, role='student', is_active=False)
    from .views import (serialize_student_assessment_results, serialize_combined_profile,
                        _serialize_placement, _placement_select_related)
    from .combined_competency import required_progress, serialize_combined_scores
    batch_ids = set(student.enrollments.values_list('batch_id', flat=True))
    batch_ids.update(student.responses.values_list('assessment__batch_id', flat=True))
    batch_ids.update(student.skill_scores.values_list('assessment__batch_id', flat=True))
    batch_ids.update(student.combined_profiles.values_list('batch_id', flat=True))
    batch_ids.update(student.ojt_placements.values_list('batch_id', flat=True))
    batches = Batch.objects.filter(id__in=[key for key in batch_ids if key is not None]).select_related('instructor').order_by('-created_at', '-id')
    # History also includes detached attempts without a batch, when present.
    contexts = list(batches)
    if None in batch_ids:
        contexts.append(None)
    records = []
    for batch in contexts:
        results = serialize_student_assessment_results(student, batch)
        if batch is None:
            results = [row for row in results if row['response_id'] or row['category_scores']]
        profile = CombinedCompetencyProfile.objects.filter(student=student, batch=batch).first() if batch else None
        records.append({'batch': {'id': batch.id, 'name': batch.name, 'status': batch.status} if batch else None,
                        'instructor': batch.instructor.name if batch else '',
                        **required_progress(student, batch), 'assessment_results': results,
                        'combined_category_scores': serialize_combined_scores(student, batch) if batch else [],
                        'combined_competency_profile': serialize_combined_profile(profile),
                        'placement_history': [_serialize_placement(row) for row in _placement_select_related(
                            OJTPlacement.objects.filter(student=student, batch=batch, is_active_suggestion=False)).order_by('-updated_at', '-id')]})
    return Response({'student_id': student.id, 'records': records, 'read_only': True})
