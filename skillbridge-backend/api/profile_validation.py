"""Validate own-profile PATCH fields before any save or recommendation writes."""
from copy import deepcopy
import re
from rest_framework.exceptions import ValidationError
from .models import User
from .recommendation_nlp import valid_coordinates


def invalid(field, message):
    raise ValidationError({'error': message, 'field': field})


def text(value, field, maximum, *, blank=False):
    if not isinstance(value, str) or len(value.strip()) > maximum or (not blank and not value.strip()):
        invalid(field, f'{field} must be text with {"up to" if blank else "1 to"} {maximum} characters.')
    return value.strip()


def profile_data(data, user):
    if not isinstance(data, dict):
        invalid('profile', 'Profile details must be an object.')
    result = {}
    for field, model_field, maximum in [('name', 'name', 255), ('studentId', 'school_id', 20),
                                         ('course', 'course', 100), ('phone', 'phone', 20)]:
        if field not in data:
            continue
        value = text(data[field], field, maximum)
        if field == 'studentId':
            if not re.fullmatch(r'\d{4}-\d{5}', value):
                invalid(field, 'Student ID must use YYYY-NNNNN format.')
            if User.objects.filter(school_id=value).exclude(pk=user.pk).exists():
                invalid(field, 'This student ID is already in use. Ask your instructor to check your enrollment.')
        if field == 'course' and value not in ('BSIT', 'BSIS'):
            invalid(field, 'Choose BSIT or BSIS.')
        if field == 'phone' and not re.fullmatch(r'09\d{9}', value):
            invalid(field, 'Phone must have 11 digits starting with 09.')
        result[model_field] = value

    address = deepcopy(user.address) if isinstance(user.address, dict) else {}
    changed = False
    for field, allowed in [('stayingAt', ('home', 'boarding', 'open')),
                           ('travelWilling', ('panabo', 'davao-norte', 'davao-region', 'anywhere'))]:
        if field in data:
            if not isinstance(data[field], str) or data[field] not in allowed:
                invalid(field, f'Choose a valid {field} option.')
            address[field] = data[field]
            changed = True
    for group in ('home', 'boarding'):
        parts = dict(address[group]) if isinstance(address.get(group), dict) else {}
        for part in ('Province', 'City', 'Barangay'):
            field = group + part
            if field in data:
                parts[part.lower()] = text(data[field], field, 255, blank=True)
                changed = True
        if any(group + part in data for part in ('Province', 'City', 'Barangay')):
            address[group] = parts
    if 'pinLat' in data or 'pinLng' in data:
        if 'pinLat' not in data or 'pinLng' not in data:
            invalid('pinLat', 'Provide both latitude and longitude, or clear both.')
        lat, lng = data['pinLat'], data['pinLng']
        coordinates = valid_coordinates(lat, lng)
        if coordinates is None and (lat is not None or lng is not None):
            invalid('pinLat', 'Provide finite latitude from −90 to 90 and longitude from −180 to 180, or clear both.')
        address['pinLat'], address['pinLng'] = coordinates if coordinates is not None else (None, None)
        changed = True
    if changed:
        result['address'] = address
    return result
