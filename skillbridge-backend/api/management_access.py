"""Shared management scopes and deliberately small audit metadata."""
from django.db import connection
from django.db.models import Q, F, Func, IntegerField
from rest_framework.exceptions import PermissionDenied, ValidationError
from .models import Assessment, Batch, ManagementAction, User


def require_manager(user):
    if user.role not in ('admin', 'instructor'):
        raise PermissionDenied('Staff only.')


def managed_batches(user):
    require_manager(user)
    rows = Batch.objects.all() if user.role == 'admin' else Batch.objects.filter(instructor=user)
    length = 'jsonb_array_length' if connection.vendor == 'postgresql' else 'json_array_length'
    return rows.annotate(closeout_version_count=Func(F('closeout_snapshots'), function=length,
                        output_field=IntegerField())).defer('closeout_snapshots')


def managed_assessments(user):
    require_manager(user)
    return Assessment.objects.all() if user.role == 'admin' else Assessment.objects.filter(
        Q(batch__instructor=user) | Q(batch__isnull=True, created_by=user))


def selected_instructor(value):
    if type(value) is not int or value <= 0:
        raise ValidationError({'error': 'Choose an active, approved instructor.', 'field': 'instructor_id'})
    owner = User.objects.select_for_update().filter(pk=value, role='instructor', is_active=True, is_approved=True).first()
    if owner is None:
        raise ValidationError({'error': 'Choose an active, approved instructor.', 'field': 'instructor_id'})
    return owner


def batch_payload(batch, student_count=None):
    return {'id': batch.id, 'name': batch.name, 'status': batch.status,
            'created_at': batch.created_at, 'archived_at': batch.archived_at,
            'instructor_id': batch.instructor_id, 'instructor_name': batch.instructor.name,
            'instructor_photo_url': batch.instructor.photo_url,
            'created_by_id': batch.created_by_id,
            'closeout_versions': batch.closeout_version_count if hasattr(batch, 'closeout_version_count') else len(batch.closeout_snapshots),
            'student_count': student_count if student_count is not None else batch.enrollments.count()}


def record_action(user, action, target_type, target_id, batch_id=None, **metadata):
    return ManagementAction.objects.create(actor=user, action=action, target_type=target_type,
        target_id=target_id, batch_id_snapshot=batch_id, metadata=metadata)


def assessment_state(assessment):
    return {field: getattr(assessment, field) for field in (
        'batch_id', 'duration_minutes', 'publication_status', 'is_required', 'include_in_competency', 'display_order')}
