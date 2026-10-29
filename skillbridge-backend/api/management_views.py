from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .change_events import notify_changes
from .management_access import batch_payload, record_action, selected_instructor
from .models import Batch, ManagementAction, User
from .cycle_lifecycle import lifecycle_lock


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_batch_instructors(request):
    if request.user.role != 'admin':
        return Response({'error': 'Admins only'}, status=403)
    return Response([{'id': user.id, 'name': user.name} for user in
        User.objects.filter(role='instructor', is_active=True, is_approved=True).order_by('name', 'id')])


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
@notify_changes('batch')
@transaction.atomic
@lifecycle_lock
def admin_batch_detail(request, batch_id):
    if request.user.role != 'admin':
        return Response({'error': 'Admins only'}, status=403)
    if not isinstance(request.data, dict) or set(request.data) - {'name', 'instructor_id'}:
        return Response({'error': 'Only name and instructor_id can be updated.'}, status=400)
    batch = get_object_or_404(Batch.objects.select_for_update(), pk=batch_id)
    old_owner = batch.instructor_id
    fields = []
    if 'name' in request.data:
        name = request.data['name']
        if not isinstance(name, str) or not name.strip() or len(name.strip()) > 100:
            return Response({'error': 'Batch name must contain 1 to 100 characters.', 'field': 'name'}, status=400)
        batch.name = name.strip()
        fields.append('name')
    if 'instructor_id' in request.data:
        batch.instructor = selected_instructor(request.data['instructor_id'])
        fields.append('instructor')
    if fields:
        batch.save(update_fields=fields)
        record_action(request.user, 'batch.update', 'batch', batch.id, batch.id,
                      previous_instructor_id=old_owner, instructor_id=batch.instructor_id,
                      renamed='name' in fields)
    return Response(batch_payload(batch))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_management_actions(request):
    if request.user.role != 'admin':
        return Response({'error': 'Admins only'}, status=403)
    rows = ManagementAction.objects.select_related('actor')
    batch = request.query_params.get('batch_id')
    if batch:
        if not batch.isdigit() or int(batch) < 1:
            return Response({'error': 'Invalid batch_id'}, status=400)
        rows = rows.filter(batch_id_snapshot=int(batch))
    try:
        offset = max(int(request.query_params.get('offset', 0)), 0)
    except ValueError:
        return Response({'error': 'Invalid offset'}, status=400)
    return Response({'count': rows.count(), 'results': [{
        'id': row.id, 'actor_id': row.actor_id, 'actor_name': row.actor.name if row.actor else 'Former account',
        'action': row.action, 'target_type': row.target_type, 'target_id': row.target_id,
        'batch_id': row.batch_id_snapshot, 'metadata': row.metadata, 'created_at': row.created_at,
    } for row in rows[offset:offset + 50]]})
