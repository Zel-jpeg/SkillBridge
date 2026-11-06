"""Program eligibility for one shared opening and its placement decisions."""

from django.db.models import Exists, OuterRef, Q

from .models import BatchEnrollment, Position, PositionRequirement
from .instructor_assignments import program_payload


def position_scope_payload(position):
    return {
        'eligibility_configured': position.eligibility_configured_at is not None,
        'eligible_programs': [
            {**program_payload(program), 'is_active': program.is_active and program.institute.is_active}
            for program in position.eligible_programs.all()
        ],
    }


def catalog_position_payload(position):
    requirements = list(position.requirements.all())
    return {
        'id': position.pk, 'title': position.title, 'slots': position.slots_available,
        'archived_at': position.archived_at, 'tags': position.tags or [],
        **position_scope_payload(position),
        'management_program_id': position.management_program_id,
        'requirements': {row.skill_category.name: row.required_percentage for row in requirements},
        'category_requirements': [
            {'category_id': row.skill_category_id, 'name': row.skill_category.name,
             'percentage': row.required_percentage, 'framework_id': row.skill_category.framework_id,
             'program_id': row.skill_category.framework.program_id}
            for row in requirements if row.skill_category.framework_id
        ],
    }


def active_positions():
    return Position.objects.filter(archived_at__isnull=True, company__archived_at__isnull=True)


def for_programs(positions, program_ids):
    program_ids = set(program_ids)
    eligible = Q(pk__in=[])
    if None in program_ids:
        eligible |= Q(eligibility_configured_at__isnull=True)
    if program_ids - {None}:
        links = Position.eligible_programs.through.objects.filter(
            position_id=OuterRef('pk'), program_id__in=program_ids - {None},
            program__is_active=True, program__institute__is_active=True,
        )
        eligible |= Q(eligibility_configured_at__isnull=False) & Q(Exists(links))
    return positions.filter(eligible)


def accepts_batch(position, batch):
    return for_programs(active_positions().filter(pk=position.pk), [batch.program_id]).exists()


def eligible_recommendations(rows):
    links = Position.eligible_programs.through.objects.filter(
        position_id=OuterRef('position_id'), program_id=OuterRef('batch__program_id'),
        program__is_active=True, program__institute__is_active=True,
    )
    rubric = PositionRequirement.objects.filter(
        position_id=OuterRef('position_id'), required_percentage__gt=0,
        skill_category__framework_id=OuterRef('batch__framework_id'),
        skill_category__framework__program_id=OuterRef('batch__program_id'),
    )
    enrollment = BatchEnrollment.objects.filter(student_id=OuterRef('student_id'), batch_id=OuterRef('batch_id'))
    return rows.filter(
        Q(batch__program_id__isnull=True, position__eligibility_configured_at__isnull=True)
        | (Q(position__eligibility_configured_at__isnull=False) & Q(Exists(links)) & Q(Exists(rubric)) & Q(Exists(enrollment)))
    )


def legacy_positions():
    return for_programs(active_positions(), [None])
