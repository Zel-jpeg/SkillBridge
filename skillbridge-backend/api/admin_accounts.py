"""Persist the existing admin account editor and reversible archive actions."""
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .change_events import notify_changes
from .models import User


def instructor_payload(user):
    return {'id': user.id, 'name': user.name, 'email': user.email, 'instructor_id': user.school_id or '',
            'department': user.department, 'courses': user.course or 'BSIT / BSIS',
            'is_approved': user.is_approved, 'is_active': user.is_active, 'photo_url': user.photo_url}


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
@notify_changes('users')
def admin_account_detail(request, user_id):
    if request.user.role != 'admin':
        return Response({'error': 'Admins only'}, status=403)
    try:
        with transaction.atomic():
            try:
                user = User.objects.select_for_update().get(pk=user_id, role__in=['student', 'instructor'])
            except User.DoesNotExist:
                return Response({'error': 'Account not found'}, status=404)
            if request.method == 'DELETE':
                user.is_active = False
                user.save(update_fields=['is_active'])
            else:
                data, changes = request.data, {}
                allowed = {'is_active'} | ({'name', 'email', 'instructor_id', 'department', 'courses'} if user.role == 'instructor' else set())
                if set(data) - allowed:
                    return Response({'error': 'Unsupported account fields. Roles and approval are managed separately.'}, status=400)
                for field, limit, model_field in [('name', 255, 'name'), ('email', 254, 'email'),
                        ('instructor_id', 20, 'school_id'), ('department', 255, 'department'), ('courses', 100, 'course')]:
                    if field not in data:
                        continue
                    value = data[field]
                    if not isinstance(value, str) or not value.strip() or len(value.strip()) > limit:
                        return Response({'error': f'{field} must be text with 1 to {limit} characters.', 'field': field}, status=400)
                    value = value.strip()
                    if field == 'email':
                        value = value.lower()
                        try:
                            validate_email(value)
                        except DjangoValidationError:
                            return Response({'error': 'Enter a valid DNSC email.', 'field': field}, status=400)
                        if not value.endswith('@dnsc.edu.ph'):
                            return Response({'error': 'Instructor email must use @dnsc.edu.ph', 'field': field}, status=400)
                        if User.objects.filter(email__iexact=value).exclude(pk=user.pk).exists():
                            return Response({'error': 'Email already exists', 'field': field}, status=409)
                    if field == 'instructor_id' and User.objects.filter(school_id=value).exclude(pk=user.pk).exists():
                        return Response({'error': 'Instructor ID already exists', 'field': field}, status=409)
                    changes[model_field] = value
                if 'is_active' in data:
                    if type(data['is_active']) is not bool:
                        return Response({'error': 'is_active must be true or false.', 'field': 'is_active'}, status=400)
                    changes['is_active'] = data['is_active']
                for field, value in changes.items():
                    setattr(user, field, value)
                if changes:
                    user.save(update_fields=list(changes))
    except IntegrityError:
        return Response({'error': 'Email or institutional ID conflicts with an existing account.'}, status=409)
    return Response(instructor_payload(user) if user.role == 'instructor' else
                    {'id': user.id, 'name': user.name, 'is_active': user.is_active, 'role': user.role})
