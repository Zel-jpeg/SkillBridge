"""Synthetic taxonomy protection and assessment report/download failures."""
import json
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright, expect

ARTIFACTS = Path(__file__).parent / 'artifacts/taxonomy-report-recovery'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
checks, errors, saves = [], [], []
skills = [{'id': 1, 'name': 'Protected Programming', 'description': 'Synthetic referenced category', 'tags': []}]
generations, downloads = [0], [0]
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    context = browser.new_context(viewport={'width': 1280, 'height': 950})
    user = {'id': 1, 'name': 'Synthetic Admin', 'role': 'admin', 'is_approved': True}
    values = {'sb-token': 'synthetic', 'sb-role': 'admin', 'sb-user': json.dumps(user)}
    context.add_init_script('for (const [k,v] of Object.entries(' + json.dumps(values) + ')) localStorage.setItem(k,v)')
    def route_request(route):
        url, method = urlparse(route.request.url), route.request.method
        if url.hostname not in ['localhost', '127.0.0.1']: return route.abort()
        if not url.path.startswith('/api/'): return route.continue_()
        if url.path.endswith('/events/'): return route.fulfill(status=204)
        if url.path == '/api/auth/me/': return route.fulfill(json=user)
        if url.path == '/api/admin/skills/':
            if method == 'GET': return route.fulfill(json=skills)
            saves.append(route.request.post_data_json)
            if len(saves) == 1: return route.fulfill(status=400, json={'error': 'Synthetic taxonomy validation failed.'})
            row = {**saves[-1], 'id': 2}
            skills.append(row)
            return route.fulfill(status=201, json=row)
        if url.path == '/api/admin/skills/1/' and method == 'DELETE':
            return route.fulfill(status=409, json={'error': 'Synthetic category has score history and cannot be deleted.'})
        if url.path == '/api/management/assessment-reports/':
            if parse_qs(url.query).get('export') == ['csv']:
                downloads[0] += 1
                if downloads[0] == 1: return route.fulfill(status=503, json={'error': 'Synthetic CSV outage'})
                return route.fulfill(body='Student,Progress\nSynthetic Student,1/1\n', content_type='text/csv')
            generations[0] += 1
            if generations[0] == 2: return route.fulfill(json={'rows': {}, 'generated_at': '2026-10-18T00:00:00Z'})
            if generations[0] == 3: return route.fulfill(status=503, json={'error': {'internal': 'Synthetic private detail'}})
            return route.fulfill(json={'rows': [], 'generated_at': '2026-10-18T00:00:00Z', 'report_type': 'batch_progress'})
        if url.path == '/api/admin/reports/': return route.fulfill(json={})
        if url.path == '/api/admin/placement-analytics/': return route.fulfill(json={'summary': {}, 'area_breakdown': []})
        if url.path == '/api/admin/nlp-configuration/': return route.fulfill(json={'models': [], 'active_model': 'spacy_md'})
        return route.fulfill(json=[])
    context.route('**/*', route_request)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    try:
        page.goto('http://127.0.0.1:5178/admin/skills')
        page.wait_for_load_state('networkidle')
        page.get_by_role('button', name='Add Skill', exact=True).click()
        modal = page.locator('div.fixed.inset-0').filter(has=page.get_by_role('heading', name='Add Skill Category', exact=True)).last
        name = modal.get_by_placeholder('e.g. ReactJS')
        name.fill('Synthetic manual category')
        modal.get_by_role('button', name='Add Skill', exact=True).evaluate('(b)=>{b.click();b.click()}')
        expect(modal.get_by_text('Synthetic taxonomy validation failed.', exact=True)).to_be_visible()
        expect(name).to_have_value('Synthetic manual category')
        assert len(saves) == 1
        modal.get_by_role('button', name='Add Skill', exact=True).click()
        expect(modal).to_have_count(0)
        row = page.get_by_role('row').filter(has=page.get_by_text('Protected Programming', exact=True))
        row.get_by_title('Delete skill', exact=True).click()
        confirmation = page.get_by_role('dialog', name='Delete Skill Category?', exact=True)
        confirmation.get_by_role('button', name='Delete', exact=True).click()
        expect(confirmation.get_by_role('alert')).to_have_text('Synthetic category has score history and cannot be deleted.')
        confirmation.get_by_role('button', name='Cancel', exact=True).click()
        expect(row).to_be_visible()
        checks.append('Taxonomy validation retains draft and blocks double writes; protected delete retains confirmation and existing category')
        page.goto('http://127.0.0.1:5178/admin/reports')
        page.wait_for_load_state('networkidle')
        generate = page.get_by_role('button', name='Generate report', exact=True)
        generate.click()
        expect(page.get_by_text('No records match the selected filters.', exact=True)).to_be_visible()
        generate.click()
        expect(page.get_by_role('alert')).to_have_text('The server returned invalid data. Please retry.')
        expect(page.get_by_text('No records match the selected filters.', exact=True)).to_be_visible()
        expect(generate).to_be_enabled()
        generate.click()
        expect(page.get_by_role('alert')).to_have_text('Server is unavailable. Check your connection.')
        assert 'Synthetic private detail' not in page.locator('body').inner_text()
        generate.click()
        expect(page.get_by_role('alert')).to_have_count(0)
        csv = page.get_by_role('button', name='Download CSV', exact=True)
        csv.click()
        expect(page.get_by_role('alert')).to_have_text('CSV export failed.')
        expect(csv).to_be_enabled()
        with page.expect_download() as event:
            csv.click()
        download = event.value
        download.save_as(str(ARTIFACTS / 'synthetic-report.csv'))
        assert 'Synthetic Student,1/1' in (ARTIFACTS / 'synthetic-report.csv').read_text(encoding='utf-8')
        checks.append('Malformed/503 report responses retain prior snapshot and clear loading; failed CSV recovers to an actual synthetic download')
        page.screenshot(path=str(ARTIFACTS / 'report-recovery.png'), full_page=True)
        assert not errors, errors
    finally:
        (ARTIFACTS / 'results.json').write_text(json.dumps({'checks': checks, 'page_errors': errors}, indent=2), encoding='utf-8')
        print(json.dumps({'checks': checks, 'page_errors': errors}, indent=2))
        context.close()
        browser.close()
