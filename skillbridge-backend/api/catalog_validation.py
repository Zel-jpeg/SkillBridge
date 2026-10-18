"""Validate catalog drafts completely before persistence or external uploads."""
import math
import re
from rest_framework.exceptions import ValidationError

from .models import SkillCategory
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
    categories = {category.name.casefold(): category for category in SkillCategory.objects.all()}
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
    if not partial or 'requirements' in data:
        result['requirements'] = requirements_value(data.get('requirements', {}))
    return result


def company_fields(data, *, partial=False):
    if not partial or 'name' in data:
        data['name'] = nonempty_text(data.get('name'), 'name')
    # company_data already validates the envelope, address and coordinate ranges.
    return data
