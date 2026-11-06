"""Explicit program grants; an institute alone never grants private batch access."""
from django.db import transaction
from django.db.models import Exists, OuterRef
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .change_events import notify_changes
from .management_access import record_action
from .models import Institute, Program, InstructorAssignment, User
from .organization import StrictBoolean, forbidden, organization_image_url, page_payload


def available_programs(user):
    rows = Program.objects.filter(is_active=True, institute__is_active=True).select_related('institute')
    if user.role == 'admin' and user.is_active:
        return rows
    if user.role != 'instructor':
        return rows.none()
    from .program_scope import assigned_program_ids
    return rows.filter(pk__in=assigned_program_ids(user))


def require_program(user, program_id):
    if type(program_id) is not int or program_id <= 0:
        raise ValidationError({'error': 'Choose a program.', 'field': 'program_id'})
    return get_object_or_404(available_programs(user), pk=program_id)


def program_payload(program):
    return {'id': program.id, 'code': program.code, 'name': program.name, 'is_active': program.is_active,
            'image_url': organization_image_url(program),
            'banner_color': program.banner_color,
            'institute_id': program.institute_id, 'institute_name': program.institute.name,
            'institute_code': program.institute.code}


def assignment_payload(row):
    user = row.instructor
    return {'id': row.id, 'instructor_id': user.id, 'program_id': row.program_id,
            'institute_id': row.program.institute_id, 'name': user.name, 'email': user.email,
            'school_id': user.school_id, 'photo_url': user.photo_url, 'is_active': row.is_active,
            'effective': bool(row.is_active and user.is_active and user.is_approved
                              and row.program.is_active and row.program.institute.is_active),
            'created_at': row.created_at, 'updated_at': row.updated_at}


def context(institute_id, program_id, *, lock=False):
    institutes = Institute.objects.select_for_update() if lock else Institute.objects.all()
    institute = get_object_or_404(institutes, pk=institute_id)
    return get_object_or_404(Program.objects.select_related('institute'), pk=program_id, institute=institute)


def validate_object(data, allowed):
    if not isinstance(data, dict) or not data or set(data) != set(allowed):
        raise ValidationError({'error': f'Provide only {", ".join(allowed)}.'})


def valid_instructor(user_id):
    if type(user_id) is not int or user_id <= 0:
        raise ValidationError({'error': 'Choose an active, approved instructor.', 'field': 'instructor_id'})
    return get_object_or_404(User.objects.select_for_update(), pk=user_id,
                            role='instructor', is_active=True, is_approved=True)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@notify_changes('assignment')
def program_instructors(request, institute_id, program_id):
    if forbidden(request):
        return Response({'error': 'Admins only'}, status=403)
    if request.method == 'GET':
        program = context(institute_id, program_id)
        rows = InstructorAssignment.objects.filter(program=program).select_related(
            'instructor', 'program__institute').order_by('instructor__name', 'id')
        return Response(page_payload(rows, request.query_params, serialize=assignment_payload,
            search_fields=('instructor__name', 'instructor__email', 'instructor__school_id'), inactive_label='revoked',
            order_fields=('instructor__name', 'id')))
    validate_object(request.data, ['instructor_id'])
    with transaction.atomic():
        program = context(institute_id, program_id, lock=True)
        if not program.is_active or not program.institute.is_active:
            return Response({'error': 'Restore the institute and program before assigning instructors.'}, status=409)
        instructor = valid_instructor(request.data['instructor_id'])
        row, created = InstructorAssignment.objects.get_or_create(instructor=instructor, program=program,
            defaults={'created_by': request.user, 'updated_by': request.user})
        if not created and row.is_active:
            response = Response(assignment_payload(row))
            response.skip_change_event = True
            return response
        if not created:
            row.is_active = True
            row.updated_by = request.user
            row.save(update_fields=['is_active', 'updated_by', 'updated_at'])
        record_action(request.user, 'instructor.assign' if created else 'instructor.assignment.restore',
                      'instructor_assignment', row.id, instructor_id=instructor.id, program_id=program.id,
                      institute_id=program.institute_id)
        return Response(assignment_payload(row), status=201 if created else 200)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
@notify_changes('assignment')
def assignment_detail(request, institute_id, program_id, assignment_id):
    if forbidden(request):
        return Response({'error': 'Admins only'}, status=403)
    validate_object(request.data, ['is_active'])
    active = StrictBoolean().run_validation(request.data['is_active'])
    with transaction.atomic():
        program = context(institute_id, program_id, lock=True)
        row = get_object_or_404(InstructorAssignment.objects.select_related('instructor', 'program__institute'),
                                pk=assignment_id, program=program)
        if active:
            if not program.is_active or not program.institute.is_active:
                return Response({'error': 'Restore the institute and program before restoring this assignment.'}, status=409)
            row.instructor = valid_instructor(row.instructor_id)
        if row.is_active == active:
            response = Response(assignment_payload(row))
            response.skip_change_event = True
            return response
        row.is_active = active
        row.updated_by = request.user
        row.save(update_fields=['is_active', 'updated_by', 'updated_at'])
        record_action(request.user, 'instructor.assignment.restore' if active else 'instructor.assignment.revoke',
                      'instructor_assignment', row.id, instructor_id=row.instructor_id, program_id=program.id,
                      institute_id=program.institute_id)
        return Response(assignment_payload(row))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def instructor_options(request, institute_id, program_id):
    if forbidden(request):
        return Response({'error': 'Admins only'}, status=403)
    program = context(institute_id, program_id)
    if not program.is_active or not program.institute.is_active:
        return Response({'error': 'Restore the institute and program before assigning instructors.'}, status=409)
    assigned = InstructorAssignment.objects.filter(program=program, instructor_id=OuterRef('id'), is_active=True)
    rows = User.objects.filter(role='instructor', is_active=True, is_approved=True).annotate(
        assigned=Exists(assigned)).order_by('name', 'id')
    return Response(page_payload(rows, request.query_params,
        serialize=lambda row: {'id': row.id, 'name': row.name, 'email': row.email, 'school_id': row.school_id,
                               'photo_url': row.photo_url, 'assigned': row.assigned},
        search_fields=('name', 'email', 'school_id')))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def program_options(request, program_id=None):
    if request.user.role not in ('admin', 'instructor') or not request.user.is_active:
        return Response({'error': 'Staff only'}, status=403)
    if program_id is not None:
        return Response(program_payload(require_program(request.user, program_id)))
    return Response(page_payload(available_programs(request.user), request.query_params, serialize=program_payload,
        search_fields=('code', 'name', 'institute__code', 'institute__name')))
