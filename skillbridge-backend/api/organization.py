"""Admin-managed organization catalog; existing cohorts are not changed here."""
import re

from django.db import IntegrityError, transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .change_events import notify_changes
from .management_access import record_action
from .models import Institute, Program
from .program_scope import label_key


class StrictBoolean(serializers.BooleanField):
    def to_internal_value(self, data):
        if type(data) is not bool:
            raise ValidationError('Use true or false.')
        return data


class CatalogSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=30)
    name = serializers.CharField(max_length=255)
    description = serializers.CharField(max_length=2000, allow_blank=True, required=False)
    is_active = StrictBoolean(required=False)

    def to_internal_value(self, data):
        if not isinstance(data, dict) or set(data) - set(self.fields):
            raise ValidationError({'non_field_errors': ['Provide an object containing only the supported fields.']})
        # Do not let DRF coerce numbers to category names/codes/descriptions.
        for key in ('code', 'name', 'description'):
            if key in data and not isinstance(data[key], str):
                raise ValidationError({key: 'Use text.'})
        return super().to_internal_value(data)

    def validate_code(self, value):
        value = ' '.join(value.split()).upper()
        if not re.fullmatch(r'[A-Z0-9][A-Z0-9 _-]{0,29}', value):
            raise ValidationError('Use letters, numbers, spaces, hyphens or underscores.')
        return value

    def validate_name(self, value):
        value = ' '.join(value.split())
        if not label_key(value):
            raise ValidationError('Enter a meaningful name.')
        return value


class ProgramSerializer(CatalogSerializer):
    aliases = serializers.ListField(child=serializers.CharField(max_length=255), max_length=12, required=False)

    def validate_aliases(self, value):
        raw = self.initial_data['aliases']
        if any(not isinstance(item, str) for item in raw):
            raise ValidationError('Each alias must be text.')
        aliases = [' '.join(item.split()) for item in value]
        keys = [label_key(alias) for alias in aliases]
        if not all(keys) or len(set(keys)) != len(keys):
            raise ValidationError('Aliases must be meaningful and distinct.')
        return aliases


def payload(row):
    result = {key: getattr(row, key) for key in ('id', 'code', 'name', 'description', 'is_active', 'created_at')}
    if isinstance(row, Program):
        result.update(institute_id=row.institute_id, aliases=row.aliases)
    else:
        result['program_count'] = getattr(row, 'program_count', None)
        if result['program_count'] is None:
            result['program_count'] = row.programs.count()
    return result


def page_payload(rows, params, *, serialize=payload, search_fields=('code', 'name'), inactive_label='archived', order_fields=('name', 'id')):
    if (set(params) - {'page', 'page_size', 'search', 'status', '_t'}
            or any(len(params.getlist(key)) != 1 for key in params)):
        raise ValidationError({'error': 'Unsupported collection parameter.'})
    state = params.get('status', 'all')
    if state not in ('all', 'active', inactive_label):
        raise ValidationError({'error': f'Choose all, active or {inactive_label}.', 'field': 'status'})
    if state != 'all':
        rows = rows.filter(is_active=state == 'active')
    search = params.get('search', '').strip()
    if len(search) > 255:
        raise ValidationError({'error': 'Search must contain at most 255 characters.'})
    if search:
        query = Q()
        for field in search_fields:
            query |= Q(**{f'{field}__icontains': search})
        rows = rows.filter(query)
    from .collection_queries import _integer
    page = _integer(params, 'page', 1, 1000000)
    size = _integer(params, 'page_size', 8, 50)
    total = rows.count()
    page = min(page, max(1, (total + size - 1) // size))
    return {'count': total, 'page': page, 'page_size': size,
            'results': [serialize(row) for row in rows.order_by(*order_fields)[(page - 1) * size:page * size]]}


def validated(data, program=False, partial=False):
    serializer = (ProgramSerializer if program else CatalogSerializer)(data=data, partial=partial)
    serializer.is_valid(raise_exception=True)
    return serializer.validated_data


def check_program_labels(institute, values, current=None):
    code = values.get('code', getattr(current, 'code', ''))
    name = values.get('name', getattr(current, 'name', ''))
    aliases = values.get('aliases', getattr(current, 'aliases', []))
    keys = {label_key(value) for value in [code, name, *aliases]}
    others = institute.programs.exclude(pk=current.pk if current else None)
    for other in others.only('code', 'name', 'aliases'):
        if keys & {label_key(value) for value in [other.code, other.name, *other.aliases]}:
            raise ValidationError({'error': 'A program code, name or alias is already used in this institute.'})


def write_institute(request, object_id=None):
    values = validated(request.data, partial=object_id is not None)
    try:
        with transaction.atomic():
            row = get_object_or_404(Institute.objects.select_for_update(), pk=object_id) if object_id else Institute()
            if object_id and values.get('is_active') is False and row.programs.filter(is_active=True).exists():
                return Response({'error': 'Archive active programs before archiving their institute.'}, status=409)
            for field, value in values.items():
                setattr(row, field, value)
            row.save()
            record_action(request.user, 'institute.update' if object_id else 'institute.create', 'institute', row.id)
            return Response(payload(row), status=200 if object_id else 201)
    except IntegrityError:
        return Response({'error': 'An institute already uses that code or name.'}, status=409)


def write_program(request, institute_id, object_id=None):
    values = validated(request.data, program=True, partial=object_id is not None)
    try:
        with transaction.atomic():
            # Serializes alias validation and parent archive/child restore races.
            institute = get_object_or_404(Institute.objects.select_for_update(), pk=institute_id)
            row = get_object_or_404(Program, pk=object_id, institute=institute) if object_id else Program(institute=institute)
            if not institute.is_active and values.get('is_active', row.is_active):
                return Response({'error': 'Restore the institute before adding or restoring an active program.'}, status=409)
            check_program_labels(institute, values, row if object_id else None)
            for field, value in values.items():
                setattr(row, field, value)
            row.save()
            record_action(request.user, 'program.update' if object_id else 'program.create', 'program', row.id,
                          institute_id=institute.id)
            return Response(payload(row), status=200 if object_id else 201)
    except IntegrityError:
        return Response({'error': 'A program already uses that code or name in this institute.'}, status=409)


def forbidden(request):
    return request.user.role != 'admin' or not request.user.is_active


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@notify_changes('organization')
def institutes(request):
    if forbidden(request):
        return Response({'error': 'Admins only'}, status=403)
    if request.method == 'GET':
        return Response(page_payload(Institute.objects.annotate(program_count=Count('programs')), request.query_params))
    return write_institute(request)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
@notify_changes('organization')
def institute_detail(request, object_id):
    if forbidden(request):
        return Response({'error': 'Admins only'}, status=403)
    if request.method == 'GET':
        return Response(payload(get_object_or_404(Institute, pk=object_id)))
    return write_institute(request, object_id)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@notify_changes('organization')
def programs(request, institute_id):
    if forbidden(request):
        return Response({'error': 'Admins only'}, status=403)
    if request.method == 'GET':
        institute = get_object_or_404(Institute, pk=institute_id)
        return Response(page_payload(institute.programs.all(), request.query_params))
    return write_program(request, institute_id)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
@notify_changes('organization')
def program_detail(request, institute_id, object_id):
    if forbidden(request):
        return Response({'error': 'Admins only'}, status=403)
    if request.method == 'GET':
        return Response(payload(get_object_or_404(Program, institute_id=institute_id, pk=object_id)))
    return write_program(request, institute_id, object_id)
