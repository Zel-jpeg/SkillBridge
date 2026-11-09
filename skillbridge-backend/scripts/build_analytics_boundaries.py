"""Build pinned Philippines reference boundaries; build-only dependency: Shapely.

Run from the repo root. Downloads only public licensed source data when uncached.
The retained source-ph.json records every source path and checksum.
"""
import hashlib
import json
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import urlopen
from shapely.geometry import shape, mapping
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[2]
REVISION = '680e32e62baeccbcd8845d3b1387bc67c1baf78a'
BASE = f'https://raw.githubusercontent.com/faeldon/philippines-json-maps/{REVISION}/'
# PSA independent component cities: https://psa.gov.ph/classification/psgc/iccs
ICCS = {'0105518000', '0203135000', '0501724000', '0803738000', '1908703000'}


def main():
    out = ROOT / 'skillbridge-frontend/public/maps'
    cache = ROOT / 'work/analytics-national-source'
    cache.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((out / 'source-ph.json').read_text(encoding='utf-8'))
    assert manifest['revision'] == REVISION
    sources = manifest['sources']

    def download(item):
        target = cache / Path(item['path']).name
        if not target.exists():
            with urlopen(BASE + item['path'], timeout=30) as response:
                target.write_bytes(response.read())
        assert hashlib.sha256(target.read_bytes()).hexdigest() == item['sha256']
        return target

    with ThreadPoolExecutor(max_workers=6) as pool:
        paths = list(pool.map(download, sources))
    names, kinds = {}, {}
    for path in paths:
        if not path.name.startswith('provdists-'):
            continue
        for f in json.loads(path.read_text(encoding='utf-8'))['features']:
            p = f['properties']; key = str(p['adm2_psgc']).zfill(10)
            names[key], kinds[key] = p['adm2_en'], p['geo_level']
    cities = []
    for path in sorted(paths):
        if not path.name.startswith('municities-'):
            continue
        for f in json.loads(path.read_text(encoding='utf-8'))['features']:
            p = f['properties']
            city, province, region = (str(p[key]).zfill(10) for key in ('adm3_psgc', 'adm2_psgc', 'adm1_psgc'))
            independent = p['geo_level'] == 'City' and (city[:5] != province[:5] or city in ICCS)
            ncr_municipality = region == '1300000000' and p['geo_level'] == 'Mun'
            parent = city if independent or ncr_municipality else province
            kind = 'independent_city' if independent else 'ncr_municipality' if ncr_municipality else p['geo_level'].lower()
            f['properties'] = {'code': city, 'name': p['adm3_en'], 'parent': parent,
                               'province': names[province], 'province_code': province, 'region_code': region, 'kind': kind}
            geometry = shape(f['geometry'])
            assert geometry.is_valid and not geometry.is_empty
            cities.append(f)
    assert len({f['properties']['code'] for f in cities}) == len(cities) == 1642
    assert sum(f['properties']['kind'] == 'independent_city' for f in cities) == 38
    groups = defaultdict(list)
    for f in cities:
        groups[f['properties']['parent']].append(f)
    overview = []
    for code, features in sorted(groups.items()):
        geometry = unary_union([shape(f['geometry']) for f in features])
        assert geometry.is_valid and not geometry.is_empty
        own = features[0]['properties']['code'] == code
        name = features[0]['properties']['name'] if own else names[code]
        kind = features[0]['properties']['kind'] if own else (kinds[code] or 'special_area').lower()
        if name == 'City of Davao': name = 'Davao City'
        overview.append({'type': 'Feature', 'properties': {'code': code, 'name': name, 'kind': kind}, 'geometry': mapping(geometry)})
    for name, features in [('cities', cities), ('provinces', overview)]:
        (out / f'philippines-{name}.geojson').write_bytes(json.dumps({'type': 'FeatureCollection', 'features': features}, separators=(',', ':')).encode('utf-8'))
    (ROOT / 'skillbridge-backend/api/geo_catalog.json').write_bytes(json.dumps({
        'version': REVISION + '-ph', 'provinces': {f['properties']['code']: f['properties']['name'] for f in overview},
        'cities': [f['properties'] for f in cities]}, indent=2).encode('utf-8'))
    manifest.update(cities=len(cities), overview_units=len(overview),
        classification_sources=['https://psa.gov.ph/classification/psgc/hucs', 'https://psa.gov.ph/classification/psgc/iccs'],
        independent_cities=38, note='Overview includes NCR municipality and special geographic units from the pinned source.')
    (out / 'source-ph.json').write_bytes(json.dumps(manifest, indent=2).encode('utf-8'))
    print(f'Validated {len(cities)} cities/municipalities and {len(overview)} overview units, including 38 independent cities.')


if __name__ == '__main__':
    main()
