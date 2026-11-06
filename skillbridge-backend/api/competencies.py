"""Program catalogs with immutable consumed definitions and explicit revisions."""
import hashlib
import json
import uuid

from django.db import transaction
from django.db.models import Exists, Max, OuterRef
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .change_events import notify_changes
from .instructor_assignments import program_payload
from .management_access import record_action
from .models import (Assessment, Batch, CombinedCategoryScore, CompetencyFramework, Institute, Program,
                     PositionRequirement, Question, SkillCategory, SkillScore)
from .organization import organization_image_url, page_payload
from .program_scope import assigned_program_ids


def staff(user):
    if not user.is_active or user.role not in ('admin', 'instructor') or (
            user.role == 'instructor' and not user.is_approved):
        raise PermissionDenied('Approved staff access is required.')


def readable_programs(user):
    staff(user)
    rows = Program.objects.select_related('institute')
    return rows if user.role == 'admin' else rows.filter(pk__in=assigned_program_ids(user))


def shared_skill_institute(user):
    programs = readable_programs(user)
    institutes = Institute.objects.filter(code__iexact='IC')
    if user.role != 'admin':
        institutes = institutes.filter(pk__in=programs.filter(is_active=True, institute__is_active=True).values('institute_id'))
    return institutes.values_list('id', flat=True).first()


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def shared_ic_skills(request):
    if not shared_skill_institute(request.user):
        raise PermissionDenied('Access to shared IC skills requires an active IC program assignment.')
    return Response(list(SkillCategory.objects.filter(framework__isnull=True).order_by('name', 'id')
                         .values('id', 'name', 'description', 'tags')))


def context(user, program_id, *, lock=False):
    if lock:
        parent = get_object_or_404(Program.objects.only('institute_id'), pk=program_id)
        get_object_or_404(Institute.objects.select_for_update(), pk=parent.institute_id)
    return get_object_or_404(readable_programs(user), pk=program_id)


def writable_program(program):
    if not program.is_active or not program.institute.is_active:
        raise ValidationError({'error': 'Restore the institute and program before changing definitions.'})


def fields(data, allowed, required=()):
    if not isinstance(data, dict) or set(data) - set(allowed) or set(required) - set(data):
        raise ValidationError({'error': 'Provide the supported fields and required definition details.'})


def text(value, field, maximum, *, blank=False):
    if not isinstance(value, str) or len(value.strip()) > maximum or (not blank and not value.strip()):
        raise ValidationError({'error': f'{field} must contain {"up to" if blank else "1 to"} {maximum} text characters.', 'field': field})
    return value.strip()


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()


def category_content(category):
    return {'id': category.id, 'name': category.name, 'description': category.description, 'tags': category.tags}


def category_payload(category, user, locked):
    content = category_content(category)
    return {**content, 'framework_id': category.framework_id, 'created_by_id': category.created_by_id,
            'source_category_id': category.source_category_id, 'digest': digest(content),
            'can_edit': not locked and (user.role == 'admin' or category.created_by_id == user.id)}


def framework_rows(program):
    return CompetencyFramework.objects.filter(program=program).select_related('program__institute').prefetch_related(
        'categories').annotate(
        has_batches=Exists(Batch.objects.filter(framework_id=OuterRef('pk'))),
        has_assessments=Exists(Assessment.objects.filter(framework_id=OuterRef('pk'))),
        has_questions=Exists(Question.objects.filter(skill_category__framework_id=OuterRef('pk'))),
        has_requirements=Exists(PositionRequirement.objects.filter(skill_category__framework_id=OuterRef('pk'))),
        has_scores=Exists(SkillScore.objects.filter(skill_category__framework_id=OuterRef('pk'))),
        has_combined=Exists(CombinedCategoryScore.objects.filter(skill_category__framework_id=OuterRef('pk'))))


def frozen(framework):
    return bool(framework.locked_at or any(getattr(framework, field) for field in
        ('has_batches', 'has_assessments', 'has_questions', 'has_requirements', 'has_scores', 'has_combined')))


def framework_payload(framework, user):
    categories = sorted((category_content(category) for category in framework.categories.all()), key=lambda row: row['id'])
    locked = frozen(framework)
    content = {'id': framework.id, 'name': framework.name, 'description': framework.description,
               'is_active': framework.is_active, 'locked': locked, 'categories': categories}
    owner = user.role == 'admin' or framework.created_by_id == user.id
    return {key: value for key, value in {
        **content, 'categories': None, 'program_id': framework.program_id,
        'program': program_payload(framework.program), 'version': framework.version,
        'created_by_id': framework.created_by_id, 'source_framework_id': framework.source_framework_id,
        'category_count': len(categories), 'digest': digest(content),
        'can_manage': owner, 'can_edit': owner and not locked, 'created_at': framework.created_at,
    }.items() if key != 'categories'}


def current_framework(user, program, framework_id, *, lock=False):
    query = framework_rows(program)
    if lock:
        query = query.select_for_update(of=('self',))
    return get_object_or_404(query, pk=framework_id)


class DefinitionChanged(APIException):
    status_code = 409


def expect_digest(received, actual):
    if received != actual:
        raise DefinitionChanged({'error': 'This definition changed. Reload it before saving or freezing this version.', 'code': 'definition_changed'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def catalog_programs(request, program_id=None):
    rows = readable_programs(request.user)
    if program_id is not None:
        return Response(program_payload(get_object_or_404(rows, pk=program_id)))
    return Response(page_payload(rows, request.query_params, serialize=program_payload,
        search_fields=('code', 'name', 'institute__code', 'institute__name')))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def organization_options(request):
    programs = [program_payload(row) for row in readable_programs(request.user).order_by('name', 'pk')]
    institutes = Institute.objects.order_by('name', 'pk')
    if request.user.role != 'admin':
        institutes = institutes.filter(pk__in={row['institute_id'] for row in programs})
    return Response({
        'institutes': [{'id': row.id, 'name': row.name, 'code': row.code, 'is_active': row.is_active,
                        'image_url': organization_image_url(row)} for row in institutes],
        'programs': programs,
        'shared_skill_institute_id': shared_skill_institute(request.user),
    })


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@notify_changes('competency')
def frameworks(request, program_id):
    if request.method == 'GET':
        program = context(request.user, program_id)
        return Response(page_payload(framework_rows(program), request.query_params,
            serialize=lambda row: framework_payload(row, request.user), order_fields=('-version', 'id')))
    fields(request.data, ['name', 'description', 'source_framework_id', 'request_id', 'initial_category'], ['name', 'request_id'])
    name = text(request.data['name'], 'name', 160)
    description = text(request.data.get('description', ''), 'description', 2000, blank=True)
    source_id = request.data.get('source_framework_id')
    if source_id is not None and (type(source_id) is not int or source_id <= 0):
        raise ValidationError({'error': 'Choose a source version from this program.'})
    initial = None
    if 'initial_category' in request.data:
        if source_id is not None:
            raise ValidationError({'error': 'Add the skill to the copied set after reviewing its definitions.'})
        category = request.data['initial_category']
        fields(category, ['name', 'description', 'tags'], ['name', 'description'])
        initial = definition(category)
    try:
        creation_key = uuid.UUID(request.data['request_id'])
    except (ValueError, TypeError, AttributeError):
        raise ValidationError({'error': 'Provide a valid creation request ID.'})
    with transaction.atomic():
        program = context(request.user, program_id, lock=True)
        writable_program(program)
        previous = CompetencyFramework.objects.filter(program=program, creation_key=creation_key).first()
        if previous:
            if (previous.program_id, previous.created_by_id, previous.name, previous.description, previous.source_framework_id) != (
                    program.id, request.user.id, name, description, source_id):
                return Response({'error': 'This creation request ID is already in use.'}, status=409)
            if initial and not previous.categories.filter(**initial).exists():
                return Response({'error': 'The saved starter skill has changed. Refresh the skill list.'}, status=409)
            response = Response(framework_payload(current_framework(request.user, program, previous.id), request.user))
            response.skip_change_event = True
            return response
        source = current_framework(request.user, program, source_id, lock=True) if source_id else None
        version = (program.competency_frameworks.aggregate(latest=Max('version'))['latest'] or 0) + 1
        if initial and version != 1:
            return Response({'error': 'A skill set already exists. Refresh the skill list and add the skill there.'}, status=409)
        framework = CompetencyFramework.objects.create(program=program, version=version, name=name,
            description=description, created_by=request.user, source_framework=source, creation_key=creation_key)
        if source:
            SkillCategory.objects.bulk_create([SkillCategory(name=category.name, description=category.description,
                tags=category.tags, framework=framework, source_category=category, created_by=request.user)
                for category in source.categories.all()])
        record_action(request.user, 'framework.create', 'competency_framework', framework.id,
                      program_id=program.id, source_framework_id=source_id)
        if initial:
            category = SkillCategory.objects.create(framework=framework, created_by=request.user, **initial)
            record_action(request.user, 'category.create', 'skill_category', category.id, program_id=program.id,
                          framework_id=framework.id)
        return Response(framework_payload(current_framework(request.user, program, framework.id), request.user), status=201)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
@notify_changes('competency')
def framework_detail(request, program_id, framework_id):
    if request.method == 'GET':
        program = context(request.user, program_id)
        return Response(framework_payload(current_framework(request.user, program, framework_id), request.user))
    fields(request.data, ['name', 'description', 'is_active', 'freeze', 'expected_digest'], ['expected_digest'])
    with transaction.atomic():
        program = context(request.user, program_id, lock=True)
        framework = current_framework(request.user, program, framework_id, lock=True)
        if request.user.role != 'admin' and framework.created_by_id != request.user.id:
            raise PermissionDenied('Only the creator or an administrator can manage this version.')
        state = framework_payload(framework, request.user)
        expect_digest(request.data['expected_digest'], state['digest'])
        changes = []
        if 'name' in request.data or 'description' in request.data or 'freeze' in request.data:
            writable_program(program)
            if not framework.is_active:
                return Response({'error': 'Restore this version before changing or freezing its definitions.'}, status=409)
        for field, maximum in [('name', 160), ('description', 2000)]:
            if field in request.data:
                value = text(request.data[field], field, maximum, blank=field == 'description')
                if value != getattr(framework, field):
                    if state['locked']:
                        return Response({'error': 'Used or frozen definitions are preserved. Create a new version.'}, status=409)
                    setattr(framework, field, value)
                    changes.append(field)
        if 'is_active' in request.data:
            if type(request.data['is_active']) is not bool:
                raise ValidationError({'error': 'Use true or false for is_active.'})
            if request.data['is_active']:
                writable_program(program)
            if framework.is_active != request.data['is_active']:
                framework.is_active = request.data['is_active']
                changes.append('is_active')
        if 'freeze' in request.data:
            if request.data['freeze'] is not True:
                raise ValidationError({'error': 'A frozen definition set cannot be unfrozen. Create a new version.'})
            if not framework.categories.exists():
                return Response({'error': 'Add at least one defined category before freezing this version.'}, status=409)
            if framework.locked_at is None:
                framework.locked_at = timezone.now()
                changes.append('locked_at')
        if changes:
            framework.save(update_fields=changes)
            record_action(request.user, 'framework.update', 'competency_framework', framework.id,
                          program_id=program.id, fields=changes)
        else:
            response = Response(state)
            response.skip_change_event = True
            return response
        return Response(framework_payload(current_framework(request.user, program, framework.id), request.user))


def definition(data):
    name = ' '.join(text(data.get('name'), 'name', 100).split())
    description = text(data.get('description'), 'description', 2000)
    tags = data.get('tags', [])
    if not isinstance(tags, list) or len(tags) > 30:
        raise ValidationError({'error': 'Provide at most 30 text tags.', 'field': 'tags'})
    result, seen = [], set()
    for tag in tags:
        tag = ' '.join(text(tag, 'tags', 80).split())
        if tag.casefold() not in seen:
            seen.add(tag.casefold())
            result.append(tag)
    return {'name': name, 'description': description, 'tags': result}


@api_view(['GET', 'POST', 'PATCH'])
@permission_classes([IsAuthenticated])
@notify_changes('competency')
def framework_categories(request, program_id, framework_id, category_id=None):
    if request.method == 'GET':
        program = context(request.user, program_id)
        framework = current_framework(request.user, program, framework_id)
        rows = framework.categories.order_by('name', 'id')
        locked = frozen(framework) or not framework.is_active or not program.is_active or not program.institute.is_active
        if category_id is not None:
            return Response(category_payload(get_object_or_404(rows, pk=category_id), request.user, locked))
        # Category rows follow the shared search/page contract, but retirement is
        # at version level; preserve every category in a retained version.
        params = request.query_params.copy()
        if params.get('status', 'all') != 'all':
            raise ValidationError({'error': 'Category retirement is managed at version level. Use status=all.'})
        params['status'] = 'all'
        return Response(page_payload(rows, params,
            serialize=lambda row: category_payload(row, request.user, locked), search_fields=('name', 'description'),
            order_fields=('name', 'id')))
    if request.method == 'POST' and category_id is not None or request.method == 'PATCH' and category_id is None:
        return Response({'error': 'Use the category collection to create and its detail to edit.'}, status=405)
    fields(request.data, ['name', 'description', 'tags', 'expected_digest'], ['name', 'description'])
    values = definition(request.data)
    with transaction.atomic():
        program = context(request.user, program_id, lock=True)
        writable_program(program)
        framework = current_framework(request.user, program, framework_id, lock=True)
        if frozen(framework) or not framework.is_active:
            return Response({'error': 'Used, frozen or retired definitions are preserved. Create a new version.'}, status=409)
        if request.method == 'POST':
            existing = framework.categories.filter(name__iexact=values['name']).first()
            if existing:
                if all(getattr(existing, key) == value for key, value in values.items()):
                    response = Response(category_payload(existing, request.user, False))
                    response.skip_change_event = True
                    return response
                return Response({'error': 'A category with this name already exists in this version. Reuse it or choose a distinct name.'}, status=409)
            category = SkillCategory.objects.create(framework=framework, created_by=request.user, **values)
            action, code = 'category.create', 201
        else:
            category = get_object_or_404(framework.categories.select_for_update(), pk=category_id)
            if request.user.role != 'admin' and category.created_by_id != request.user.id:
                raise PermissionDenied('Only the creator or an administrator can edit this unused definition. Other instructors can reuse it or copy its version.')
            expect_digest(request.data.get('expected_digest'), digest(category_content(category)))
            if framework.categories.filter(name__iexact=values['name']).exclude(pk=category.id).exists():
                return Response({'error': 'Another category already uses this name in this version.'}, status=409)
            if all(getattr(category, key) == value for key, value in values.items()):
                response = Response(category_payload(category, request.user, False))
                response.skip_change_event = True
                return response
            for key, value in values.items():
                setattr(category, key, value)
            category.save(update_fields=list(values))
            action, code = 'category.update', 200
        record_action(request.user, action, 'skill_category', category.id, program_id=program.id, framework_id=framework.id)
        return Response(category_payload(category, request.user, False), status=code)
