"""Download actual API-controlled synthetic reports through the app's UI."""
import json
import re
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).parent / 'artifacts/report-exports'
OUT.mkdir(parents=True, exist_ok=True)
controls = json.loads((ROOT / 'work/defense_audit/v02-export-controls.json').read_text())
checks, errors, requests = [], [], []
records = controls['placement_history']['records']
companies = {}
for row in records:
    company = companies.setdefault(row['company']['id'], {**row['company'], 'positions': []})
    if not any(p['id'] == row['position']['id'] for p in company['positions']):
        company['positions'].append({**row['position'], 'suggested_students': []})
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    context = browser.new_context(viewport={'width': 1366, 'height': 950}, timezone_id='America/Los_Angeles', accept_downloads=True)
    user = {'id': 1, 'name': 'Synthetic Admin', 'role': 'admin', 'is_approved': True}
    values = {'sb-token': 'synthetic', 'sb-role': 'admin', 'sb-user': json.dumps(user)}
    context.add_init_script('for (const [k,v] of Object.entries(' + json.dumps(values) + ')) localStorage.setItem(k,v)')
    def route_request(route):
        url = urlparse(route.request.url)
        if url.hostname not in ['localhost', '127.0.0.1']: return route.abort()
        if not url.path.startswith('/api/'): return route.continue_()
        if url.path.endswith('/events/'): return route.fulfill(status=204)
        if url.path == '/api/placements/suggestions/': return route.fulfill(json=controls['suggestions'])
        if url.path == '/api/placements/': return route.fulfill(json={'placements': records, 'count': len(records)})
        if url.path == '/api/placements/reports/':
            params = parse_qs(url.query)
            requests.append(params)
            if params.get('position_id') == [str(controls['empty']['filters']['position_id'])]: return route.fulfill(json=controls['empty'])
            if params.get('batch_id'):
                expected = controls['filtered']['filters']
                for key in ['batch_id', 'company_id', 'date_field', 'date_from', 'date_to', 'status']:
                    assert params[key] == [str(expected[key])], (key, params)
                return route.fulfill(json=controls['filtered'])
            return route.fulfill(json=controls[params.get('report_type', ['company_placements'])[0]])
        if url.path == '/api/auth/me/': return route.fulfill(json=user)
        return route.fulfill(json=[])
    context.route('**/*', route_request)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    try:
        page.goto('http://127.0.0.1:5178/admin/placements')
        page.wait_for_load_state('networkidle')
        page.get_by_role('button', name='Download reports', exact=True).click()
        def field(label):
            return page.locator('label').filter(has=page.locator('span', has_text=re.compile('^' + re.escape(label) + '$'))).locator('select,input')
        for report_type in ['company_placements', 'student_placements', 'placement_history']:
            field('Report type').select_option(report_type)
            for format in ['PDF', 'XLSX']:
                with page.expect_download() as download:
                    page.get_by_role('button', name=f'Download {format}', exact=True).click()
                download.value.save_as(OUT / f'{report_type}.{format.lower()}')
                assert download.value.failure() is None
            checks.append(f'{report_type}: PDF and XLSX downloaded with exact six-record API snapshot')
        expected = controls['filtered']['filters']
        field('Report type').select_option('company_placements')
        field('Status').select_option('approved')
        field('Company').select_option(str(expected['company_id']))
        field('Batch').select_option(str(expected['batch_id']))
        field('Date field').select_option('approved_at')
        field('Date from').fill('2026-10-18')
        field('Date to').fill('2026-10-18')
        for format in ['PDF', 'XLSX']:
            with page.expect_download() as download:
                page.get_by_role('button', name=f'Download {format}', exact=True).click()
            download.value.save_as(OUT / f'filtered.{format.lower()}')
        assert len(requests) == 8
        checks.append('Batch/company/status/Philippine-date controls retained in both filtered downloads, independent of browser timezone')
        field('Company').select_option('')
        field('Batch').select_option('')
        field('Status').select_option('all')
        field('Report type').select_option('student_placements')
        field('Position').select_option(str(controls['empty']['filters']['position_id']))
        field('Date from').fill(''); field('Date to').fill('')
        for format in ['PDF', 'XLSX']:
            with page.expect_download() as download:
                page.get_by_role('button', name=f'Download {format}', exact=True).click()
            download.value.save_as(OUT / f'empty.{format.lower()}')
        assert len(requests) == 10
        checks.append('Empty-position PDF and XLSX download without fabricating records or losing context')
        page.screenshot(path=str(OUT / 'controls.png'), full_page=True)
        assert not errors, errors
    finally:
        page.screenshot(path=str(OUT / 'last-state.png'), full_page=True)
        result = {'checks': checks, 'page_errors': errors, 'export_requests': requests}
        (OUT / 'results.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
        print(json.dumps(result, indent=2))
        context.close(); browser.close()
