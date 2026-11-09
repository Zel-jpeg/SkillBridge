"""Catalog visibility only; never grants editing or placement eligibility.

Configured sharing follows explicit program links for every institute. Original
unconfigured openings belong to the retained IC catalog, not every new program.
"""
from django.db.models import Q

from .legacy_organization import INSTITUTE


def original_catalog_program(program):
    institute = program.institute
    return (institute.code.casefold() == INSTITUTE['code'].casefold()
            or institute.name.casefold() == INSTITUTE['name'].casefold())


def position_visibility_q(program):
    visible = Q(management_program=program) | Q(eligible_programs=program)
    if original_catalog_program(program):
        visible |= Q(management_program__isnull=True, eligibility_configured_at__isnull=True,
                     eligible_programs__isnull=True)
    return visible


def original_shared_position(position, program):
    return (original_catalog_program(program) and position.management_program_id is None
            and position.eligibility_configured_at is None
            and not list(position.eligible_programs.all()))


def position_visible(position, program):
    return (position.management_program_id == program.pk
            or any(item.pk == program.pk for item in position.eligible_programs.all())
            or original_shared_position(position, program))
