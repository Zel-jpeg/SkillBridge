"""Program catalog management with explicit creator authority and reviewed edits."""
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.cache import never_cache
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .catalog_validation import company_fields, position_data, position_scope
from .change_events import notify_changes
from .collection_queries import _integer
from .company_images import CompanyImageChange, company_data, image_fields
from .competencies import context, staff
from .cycle_lifecycle import lifecycle_lock, release_suggestions
from .instructor_assignments import program_payload
from .management_access import record_action
from .models import Company, Position, PositionRequirement, Recommendation, User
from .opportunity_scope import catalog_position_payload, eligible_recommendations
from .placement_drafts import digest, lock_state
from .placement_scope import current_approvals
from .program_scope import active_program


class CatalogConflict(APIException):
    status_code = 409


def fields(data, allowed):
    if not isinstance(data, dict) or set(data) - set(allowed):
        raise ValidationError({'error': 'Provide only the supported catalog fields.'})


def lock_program(request, program_id):
    staff(request.user)
    program = active_program(request.user, program_id, lock=True)
    current = User.objects.select_for_update().filter(pk=request.user.pk, role=request.user.role, is_active=True)
    if request.user.role == 'instructor':
        current = current.filter(is_approved=True)
    if not current.exists():
        raise PermissionDenied('Current staff approval is required.')
    return program


def partners_for(program):
    return Company.objects.filter(Q(management_program=program) | Q(positions__eligible_programs=program)).distinct()


def positions_for(company, program):
    return company.positions.filter(Q(management_program=program) | Q(eligible_programs=program)).distinct()


def company_rows():
    return Company.objects.select_related('management_program').prefetch_related(
        'positions__eligible_programs__institute',
        'positions__requirements__skill_category__framework__program')


def company_revision(company):
    positions = [{'id': row.pk, 'owner': row.created_by_id, 'program': row.management_program_id,
                  **catalog_position_payload(row)} for row in company.positions.all()]
    return digest({'name': company.name, 'address': company.address,
        'lat': company.location_lat, 'lng': company.location_lng, 'image': company.image_key,
        'archived_at': company.archived_at, 'owner': company.added_by_id,
        'program': company.management_program_id, 'positions': sorted(positions, key=lambda row: row['id'])})


def position_revision(position):
    return digest({**catalog_position_payload(position), 'company_id': position.company_id,
                   'company_archived_at': position.company.archived_at,
                   'owner': position.created_by_id, 'program': position.management_program_id})


def can_edit_company(user, company, program):
    if not program.is_active or not program.institute.is_active:
        return False
    if user.role == 'admin':
        return True
    if company.added_by_id != user.pk or company.management_program_id != program.pk:
        return False
    return all(row.management_program_id == program.pk and
               all(item.pk == program.pk for item in row.eligible_programs.all())
               for row in company.positions.all())


def can_edit_position(user, position, program):
    if not program.is_active or not program.institute.is_active:
        return False
    return user.role == 'admin' or (
        position.created_by_id == user.pk and position.management_program_id == program.pk
        and {item.pk for item in position.eligible_programs.all()} == {program.pk})


def partner_payload(company, user, program):
    return {'id': company.pk, 'name': company.name, 'address': company.address,
        'lat': company.location_lat, 'lng': company.location_lng, **image_fields(company),
        'archived_at': company.archived_at, 'program': program_payload(program),
        'can_edit': can_edit_company(user, company, program), 'revision': company_revision(company),
        'positions': [position_payload(row, user, program) for row in company.positions.all()
                      if row.management_program_id == program.pk or
                      any(item.pk == program.pk for item in row.eligible_programs.all())]}


def position_payload(position, user, program):
    return {**catalog_position_payload(position), 'company_id': position.company_id,
            'can_edit': can_edit_position(user, position, program),
            'revision': position_revision(position)}


def reviewed(data, revision):
    if data.get('revision') != revision:
        raise CatalogConflict({'error': 'This catalog entry changed. Review the latest version before saving.'})


def require_edit(allowed):
    if not allowed:
        raise PermissionDenied('Only the authorized creator or an administrator can edit this entry. Shared entries require administrator review.')


def partner_page(rows, params, serialize):
    if set(params) - {'page', 'page_size', 'search', 'status', '_t'} or any(len(params.getlist(key)) != 1 for key in params):
        raise ValidationError({'error': 'Unsupported or repeated catalog filter.'})
    state = params.get('status', 'active')
    if state not in ('active', 'archived', 'all'):
        raise ValidationError({'error': 'Choose active, archived or all.'})
    if state != 'all':
        rows = rows.filter(archived_at__isnull=state == 'active')
    search = params.get('search', '').strip()
    if len(search) > 255:
        raise ValidationError({'error': 'Search must contain at most 255 characters.'})
    if search:
        rows = rows.filter(name__icontains=search)
    size = _integer(params, 'page_size', 8, 50)
    page = _integer(params, 'page', 1, 1000000)
    count = rows.count()
    page = min(page, max(1, (count + size - 1) // size))
    return {'count': count, 'page': page, 'page_size': size,
            'results': [serialize(row) for row in rows.order_by('name', 'pk')[(page - 1) * size:page * size]]}


@never_cache
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def partner_options(request, program_id):
    context(request.user, program_id)
    # Shared organization identity supports explicit reuse. Foreign openings,
    # ownership, requirements and student matches never enter this response.
    rows = Company.objects.filter(archived_at__isnull=True)
    return Response(partner_page(rows, request.query_params, lambda company: {
        'id': company.pk, 'name': company.name, 'address': company.address}))


@never_cache
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@notify_changes('catalog')
def partners(request, program_id):
    program = context(request.user, program_id)
    if request.method == 'GET':
        rows = company_rows().filter(pk__in=partners_for(program).values('pk'))
        return Response(partner_page(rows, request.query_params, lambda row: partner_payload(row, request.user, program)))
    data = company_data(request)
    fields(data, {'name', 'address', 'lat', 'lng', 'image_action'})
    company_fields(data)
    with CompanyImageChange(request, data) as image_change:
        with transaction.atomic():
            lock_state()
            program = lock_program(request, program_id)
            if Company.objects.filter(name__iexact=data['name']).exists():
                raise CatalogConflict({'error': 'A partner with this name already exists. Review existing partners before creating another organization.'})
            company = Company(name=data['name'], address=data.get('address'),
                location_lat=data.get('lat'), location_lng=data.get('lng'),
                added_by=request.user, management_program=program)
            image_change.save(company)
            record_action(request.user, 'partner.create', 'partner', company.pk, program_id=program.pk)
            payload = partner_payload(company, request.user, program)
    return Response(payload, status=201)


@never_cache
@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
@notify_changes('catalog')
def partner_detail(request, program_id, company_id):
    program = context(request.user, program_id)
    if request.method == 'GET':
        company = get_object_or_404(company_rows().filter(pk__in=partners_for(program).values('pk')), pk=company_id)
        return Response(partner_payload(company, request.user, program))
    data = company_data(request)
    fields(data, {'name', 'address', 'lat', 'lng', 'image_action', 'revision'})
    company_fields(data, partial=True)
    with CompanyImageChange(request, data) as image_change:
        with transaction.atomic():
            lock_state()
            program = lock_program(request, program_id)
            company = get_object_or_404(Company.objects.select_for_update().filter(
                pk__in=partners_for(program).values('pk')), pk=company_id)
            require_edit(can_edit_company(request.user, company, program))
            reviewed(data, company_revision(company))
            if company.archived_at:
                raise CatalogConflict({'error': 'Restore the partner before editing it.'})
            if 'name' in data and Company.objects.filter(name__iexact=data['name']).exclude(pk=company.pk).exists():
                raise CatalogConflict({'error': 'Another partner uses this name. Review the existing organization.'})
            for key, field in (('name', 'name'), ('address', 'address'), ('lat', 'location_lat'), ('lng', 'location_lng')):
                if key in data:
                    setattr(company, field, data[key])
            image_change.save(company)
            record_action(request.user, 'partner.update', 'partner', company.pk, program_id=program.pk)
            payload = partner_payload(company, request.user, program)
    return Response(payload)


def scoped_requirements(data, program, position=None):
    fields(data, {'title', 'slots', 'tags', 'category_requirements', 'revision', 'reuse_existing'})
    rubric = data.get('category_requirements')
    if rubric is not None:
        if not isinstance(rubric, list) or any(not isinstance(row, dict) for row in rubric):
            raise ValidationError({'error': 'Provide a list of category requirements.'})
        ids = [row.get('category_id') for row in rubric]
        if any(type(pk) is not int or pk <= 0 for pk in ids):
            raise ValidationError({'error': 'Choose saved category IDs from this program.'})
        from .models import SkillCategory
        if SkillCategory.objects.filter(pk__in=ids, framework__program=program).count() != len(set(ids)):
            raise ValidationError({'error': 'Requirements must use this program’s saved framework categories.'})
    if position is None:
        data = {**data, 'eligible_program_ids': [program.pk]}
    return position_scope(data, position)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@notify_changes('catalog')
@lifecycle_lock
def positions(request, program_id, company_id):
    program = lock_program(request, program_id)
    ids, requirements = scoped_requirements(request.data, program)
    values = position_data(request.data)
    company = get_object_or_404(Company.objects.select_for_update(), pk=company_id, archived_at__isnull=True)
    reuse = request.data.get('reuse_existing', False)
    if type(reuse) is not bool:
        raise ValidationError({'error': 'reuse_existing must be true or false.'})
    if not reuse and not partners_for(program).filter(pk=company.pk).exists():
        raise PermissionDenied('Review and explicitly reuse this organization before adding an opening.')
    if positions_for(company, program).filter(title__iexact=values['title']).exists():
        raise CatalogConflict({'error': 'This program already has a position with that title at this partner.'})
    position = Position.objects.create(company=company, management_program=program, created_by=request.user,
        eligibility_configured_at=timezone.now(), **values)
    position.eligible_programs.set(ids)
    for category, percentage in requirements:
        PositionRequirement.objects.create(position=position, skill_category=category, required_percentage=percentage)
    record_action(request.user, 'position.create', 'position', position.pk, program_id=program.pk, company_id=company.pk)
    return Response(position_payload(position, request.user, program), status=201)


@never_cache
@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
@notify_changes('catalog')
@lifecycle_lock
def position_detail(request, program_id, position_id):
    program = context(request.user, program_id)
    if request.method == 'PATCH':
        program = lock_program(request, program_id)
    position = get_object_or_404(Position.objects.select_related('company').filter(
        Q(management_program=program) | Q(eligible_programs=program)).distinct(), pk=position_id)
    if request.method == 'GET':
        return Response(position_payload(position, request.user, program))
    require_edit(can_edit_position(request.user, position, program))
    reviewed(request.data, position_revision(position))
    if position.archived_at or position.company.archived_at:
        raise CatalogConflict({'error': 'Restore the partner and position before editing this opening.'})
    _, requirements = scoped_requirements(request.data, program, position)
    values = position_data(request.data, partial=True)
    if values.get('slots_available', position.slots_available) < current_approvals(position=position).count():
        raise CatalogConflict({'error': 'Slots cannot be lower than the current approved placement count.'})
    if 'title' in values and positions_for(position.company, program).filter(
            title__iexact=values['title']).exclude(pk=position.pk).exists():
        raise CatalogConflict({'error': 'This program already has a position with that title at this partner.'})
    for field, value in values.items():
        setattr(position, field, value)
    position.save()
    if 'category_requirements' in request.data:
        position.requirements.all().delete()
        for category, percentage in requirements:
            PositionRequirement.objects.create(position=position, skill_category=category, required_percentage=percentage)
        current = Recommendation.objects.filter(position=position, is_current=True)
        current.exclude(pk__in=eligible_recommendations(current).values('pk')).update(is_current=False)
    record_action(request.user, 'position.update', 'position', position.pk, program_id=program.pk)
    return Response(position_payload(position, request.user, program))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@notify_changes('catalog')
@lifecycle_lock
def archive(request, program_id, object_id, kind):
    program = lock_program(request, program_id)
    fields(request.data, {'revision', 'restore'})
    restore = request.data.get('restore', False)
    if type(restore) is not bool:
        raise ValidationError({'error': 'restore must be true or false.'})
    if kind == 'partner':
        row = get_object_or_404(partners_for(program), pk=object_id)
        require_edit(can_edit_company(request.user, row, program))
        reviewed(request.data, company_revision(row))
        scope = {'company_id': row.pk}
    else:
        row = get_object_or_404(Position.objects.filter(Q(management_program=program) | Q(eligible_programs=program))
                               .distinct().select_related('company'), pk=object_id)
        require_edit(can_edit_position(request.user, row, program))
        reviewed(request.data, position_revision(row))
        if restore and row.company.archived_at:
            raise CatalogConflict({'error': 'Restore the partner before restoring the position.'})
        scope = {'position_id': row.pk}
    if not restore and current_approvals(**scope).exists():
        raise CatalogConflict({'error': 'Resolve current approved decisions before archiving this entry.'})
    if bool(row.archived_at) == (not restore):
        response = Response({'id': row.pk, 'archived_at': row.archived_at, 'idempotent': True})
        response.skip_change_event = True
        return response
    if not restore:
        release_suggestions(request.user, **scope)
    row.archived_at = None if restore else timezone.now()
    row.save(update_fields=['archived_at'])
    record_action(request.user, f'{kind}.restore' if restore else f'{kind}.archive',
                  kind, row.pk, program_id=program.pk)
    return Response({'id': row.pk, 'archived_at': row.archived_at})
