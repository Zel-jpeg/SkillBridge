"""Read-only geographic projection of the already-authorized analytics cohort."""
import json
import math
import re
from collections import Counter
from pathlib import Path

CATALOG = json.loads(Path(__file__).with_name('geo_catalog.json').read_text(encoding='utf-8'))


def normalized(value):
    value = str(value or '').strip().casefold()
    value = re.sub(r'^city of | city$', '', value)
    return re.sub(r'[^a-z0-9]', '', value)


CITY_NAMES = {}
PROVINCE_NAMES = {}
for item in CATALOG['cities']:
    name = normalized(item['name'])
    if name == 'islandgardencityofsamal':
        name = 'samal'
    CITY_NAMES.setdefault(name, []).append(item)
    PROVINCE_NAMES[normalized(item['province'])] = item['province_code']
for code, name in CATALOG['provinces'].items():
    PROVINCE_NAMES.setdefault(normalized(name), code)
PROVINCE_NAMES['compostelavalley'] = '1108200000'


def area_identity(address):
    if not isinstance(address, dict):
        return '', ''
    province = normalized(address.get('province'))
    city = normalized(address.get('city') or address.get('municipality'))
    if city == 'islandgardencityofsamal':
        city = 'samal'
    parent = PROVINCE_NAMES.get(province, '')
    matches = CITY_NAMES.get(city, [])
    if province:
        matches = [item for item in matches if item['province_code'] == parent or item['parent'] == parent
                   or (province in ('metromanila', 'ncr', 'nationalcapitalregion') and item['region_code'] == '1300000000')]
    if len(matches) == 1:
        return matches[0]['parent'], matches[0]['code']
    # Preserve only a trusted overview unit for province-only/ambiguous addresses.
    return parent if parent in CATALOG['provinces'] else '', ''


def valid_pin(company):
    lat, lng = company.location_lat, company.location_lng
    if lat is None or lng is None:
        return 'missing'
    if (isinstance(lat, bool) or isinstance(lng, bool) or not math.isfinite(lat)
            or not math.isfinite(lng) or abs(lat) > 90 or abs(lng) > 180):
        return 'invalid'
    return 'mapped'


def placement_geography(rows, companies, partners=None, status='approved'):
    approved = [row for row in rows if row['placement_status'] == status]
    weights, pins, provinces, cities = Counter(), Counter(), Counter(), Counter()
    for row in approved:
        company = companies[row['company_id']]
        parent, city = area_identity(company.address)
        pin = valid_pin(company)
        row.update(partner_province_id=parent, partner_city_id=city, partner_pin_status=pin)
        weights[company.id] += 1
        pins[pin] += 1
        provinces[parent] += 1
        cities[city] += 1
    partner_provinces, partner_cities = Counter(), Counter()
    for company in {**companies, **{item.id: item for item in (partners or [])}}.values():
        province, city = area_identity(company.address)
        partner_provinces[province] += 1
        partner_cities[city] += 1
    overview = dict(CATALOG['provinces'])
    return {
        'schema_version': 2, 'measure': f'{status}_by_partner_location',
        'address_basis': 'Current saved partner address and pin', 'boundary_set_id': CATALOG['version'],
        'approved_students': len(approved) if status == 'approved' else 0,
        'student_count': len(approved), 'status': status,
        'coverage': {'pins': {key: pins[key] for key in ('mapped', 'missing', 'invalid')},
                     'areas': {'province': {'matched': len(approved) - provinces[''], 'unresolved': provinces['']},
                               'city': {'matched': len(approved) - cities[''], 'unresolved': cities['']}}},
        'points': [{'company_id': key, 'name': companies[key].name,
                    'lat': companies[key].location_lat, 'lng': companies[key].location_lng, 'count': count}
                   for key, count in weights.items() if valid_pin(companies[key]) == 'mapped'],
        'areas': {'province': [{'id': code, 'name': name, 'count': provinces[code], 'partner_count': partner_provinces[code]}
                               for code, name in overview.items() if partner_provinces[code] or provinces[code]],
                  'city': [{'id': item['code'], 'name': item['name'], 'parent': item['parent'],
                            'count': cities[item['code']], 'partner_count': partner_cities[item['code']]}
                           for item in CATALOG['cities'] if partner_cities[item['code']] or cities[item['code']]]},
    }
