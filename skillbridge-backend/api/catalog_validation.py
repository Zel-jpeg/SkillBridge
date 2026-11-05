"""Validate catalog drafts completely before persistence or external uploads."""
import math
import re
from rest_framework.exceptions import ValidationError

from django.utils import timezone

from .models import CompetencyFramework, Institute, Program, SkillCategory
from .recommendation_nlp import normalize_tags

MAX_SLOTS = 2_147_483_647  # Portable PositiveIntegerField range; zero closes capacity.


def invalid(field, message):
    raise ValidationError({'error': message, 'field': field})


def nonempty_text(value, field):
    if not isinstance(value, str) or not value.strip() or len(value.strip()) > 255:
        invalid(field, f'{field} must be nonempty text with at most 255 characters.')
    return value.strip()


def slots_value(value):
    if isinstance(value, str) and len(value.strip()) <= 10 and re.fullmatch(r'\d+', value.strip()):
        value = int(value.strip())
    if type(value) is not int or not 0 <= value <= MAX_SLOTS:
        invalid('slots', f'slots must be an integer from 0 to {MAX_SLOTS}.')
    return value


def tags_value(value):
    if value is not None and not isinstance(value, (str, list)):
        invalid('tags', 'tags must be a list of text values or comma-separated text.')
    if isinstance(value, list) and any(not isinstance(tag, str) for tag in value):
        invalid('tags', 'Each tag must be text.')
    return normalize_tags(value)


def requirements_value(value):
    if not isinstance(value, dict):
        invalid('requirements', 'requirements must be an object mapping known category names to percentages.')
    categories = {category.name.casefold(): category for category in SkillCategory.objects.filter(framework__isnull=True).all()}
    rows, seen = [], set()
    for name, percentage in value.items():
        if not isinstance(name, str) or name.casefold() not in categories:
            invalid('requirements', 'Every requirement must reference a known skill category.')
        category = categories[name.casefold()]
        if category.id in seen:
            invalid('requirements', 'A skill category may only appear once.')
        seen.add(category.id)
        if isinstance(percentage, bool) or not isinstance(percentage, (str, int, float)):
            invalid('requirements', f'{name} percentage must be a finite number from 0 to 100.')
        try:
            percentage = float(percentage)
        except (ValueError, OverflowError):
            invalid('requirements', f'{name} percentage must be a finite number from 0 to 100.')
        if not math.isfinite(percentage) or not 0 <= percentage <= 100:
            invalid('requirements', f'{name} percentage must be a finite number from 0 to 100.')
        if percentage > 0:
            rows.append((category, percentage))
    return rows


def position_data(data, *, partial=False):
    if not isinstance(data, dict):
        invalid('position', 'Position details must be an object.')
    result = {}
    if not partial or 'title' in data:
        result['title'] = nonempty_text(data.get('title'), 'title')
    if not partial or 'slots' in data:
        result['slots_available'] = slots_value(data.get('slots', 1))
    if not partial or 'tags' in data:
        result['tags'] = tags_value(data.get('tags'))
    return result


def position_scope(data, position=None):
    """Validate the final program set and single versioned rubric under the catalog lock."""
    existing_program_ids = set(position.eligible_programs.values_list('pk', flat=True)) if position else set()
    if 'eligible_program_ids' in data:
        supplied = data['eligible_program_ids']
        if not isinstance(supplied, list) or any(type(pk) is not int or pk <= 0 for pk in supplied):
            invalid('eligible_program_ids', 'Select eligible programs by their IDs.')
        program_ids = set(supplied)
        if len(program_ids) != len(supplied):
            invalid('eligible_program_ids', 'Each eligible program may only be selected once.')
    else:
        program_ids = existing_program_ids

    if 'eligible_program_ids' in data or 'category_requirements' in data:
        # Competency edits and program archival serialize through the parent institute.
        institutes = Program.objects.filter(pk__in=program_ids).values('institute_id')
        list(Institute.objects.filter(pk__in=institutes).order_by('pk').select_for_update())
        programs = Program.objects.filter(pk__in=program_ids)
        active_additions = programs.exclude(pk__in=existing_program_ids)
        if programs.count() != len(program_ids) or active_additions.exclude(is_active=True, institute__is_active=True).exists():
            invalid('eligible_program_ids', 'Choose existing active institutes and programs.')

    if 'category_requirements' in data and 'requirements' in data:
        invalid('category_requirements', 'Choose either framework requirements or legacy requirements.')
    scoped = 'category_requirements' in data
    if scoped:
        raw = data['category_requirements']
        if not isinstance(raw, list):
            invalid('category_requirements', 'Provide a list of category IDs and minimum percentages.')
        targets = {}
        for item in raw:
            if not isinstance(item, dict) or set(item) != {'category_id', 'percentage'}:
                invalid('category_requirements', 'Each requirement needs a category ID and percentage.')
            category_id = item['category_id']
            percentage = item['percentage']
            if type(category_id) is not int or category_id <= 0 or category_id in targets:
                invalid('category_requirements', 'Use a unique positive category ID for each requirement.')
            if type(percentage) not in (int, float) or not 0 < percentage <= 100:
                invalid('category_requirements', 'Minimum percentages must be greater than 0 and at most 100.')
            targets[category_id] = percentage
        categories = SkillCategory.objects.select_related('framework').in_bulk(targets)
        if len(categories) != len(targets):
            invalid('category_requirements', 'A selected category no longer exists.')
        rubric = [(categories[pk], value) for pk, value in targets.items()]
    elif 'requirements' in data or not position:
        rubric = requirements_value(data.get('requirements', {}))
    else:
        rubric = [(row.skill_category, row.required_percentage)
                  for row in position.requirements.select_related('skill_category__framework')]

    if rubric and (program_ids or scoped):
        framework_ids = {category.framework_id for category, _ in rubric}
        if len(framework_ids) != 1 or None in framework_ids:
            invalid('category_requirements', 'Requirements must come from one program framework version.')
        framework = CompetencyFramework.objects.get(pk=next(iter(framework_ids)))
        if framework.program_id not in program_ids:
            invalid('category_requirements', 'The framework must belong to an eligible program.')
        if scoped:
            existing_frameworks = set(position.requirements.values_list('skill_category__framework_id', flat=True)) if position else set()
            if not framework.is_active and framework.pk not in existing_frameworks:
                invalid('category_requirements', 'Choose an active framework for new requirements.')
            if framework.locked_at is None:
                framework.locked_at = timezone.now()
                framework.save(update_fields=['locked_at'])
    return program_ids, rubric


def company_fields(data, *, partial=False):
    if not partial or 'name' in data:
        data['name'] = nonempty_text(data.get('name'), 'name')
    # company_data already validates the envelope, address and coordinate ranges.
    return data
