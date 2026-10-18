"""No fake batch IDs/status changes after failed writes; synthetic API only."""
import json
import re
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

ARTIFACTS = Path(__file__).parent / 'artifacts/batch-recovery'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
checks, errors, creates = [], [], []
batches, actions = [], {'archive': 0, 'unarchive': 0}
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    context = browser.new_context(viewport={'width': 1280, 'height': 900})
    user = {'id': 1, 'name': 'Synthetic Instructor', 'role': 'instructor', 'is_approved': True}
    values = {'sb-token': 'synthetic', 'sb-role': 'instructor', 'sb-user': json.dumps(user)}
    context.add_init_script('for (const [k,v] of Object.entries(' + json.dumps(values) + ')) localStorage.setItem(k,v)')
    def route_request(route):
        url, method = urlparse(route.request.url), route.request.method
        if url.hostname not in ['localhost', '127.0.0.1']: return route.abort()
        if not url.path.startswith('/api/'): return route.continue_()
        if url.path.endswith('/events/'): return route.fulfill(status=204)
        if url.path == '/api/auth/me/': return route.fulfill(json=user)
        if url.path == '/api/instructor/batches/':
            if method == 'GET': return route.fulfill(json=batches)
            creates.append(route.request.post_data_json)
            if len(creates) == 1: return route.fulfill(status=400, json={'error': 'Synthetic batch validation failed.'})
            if len(creates) == 2: return route.fulfill(status=201, json={})
            row = {'id': 50, 'name': creates[-1]['name'], 'status': 'active', 'student_count': 0}
            batches.append(row)
            return route.fulfill(status=201, json=row)
        if url.path == '/api/instructor/batches/50/students/': return route.fulfill(json={'students': []})
        for action in actions:
            if url.path == f'/api/instructor/batches/50/{action}/':
                actions[action] += 1
                if actions[action] == 1: return route.fulfill(status=503, json={'error': 'Synthetic service unavailable'})
                batches[0]['status'] = 'archived' if action == 'archive' else 'active'
                return route.fulfill(json={**batches[0], 'archived_at': '2026-10-18T00:00:00Z' if action == 'archive' else None})
        return route.fulfill(json=[])
    context.route('**/*', route_request)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    try:
        page.goto('http://127.0.0.1:5178/instructor/students')
        page.wait_for_load_state('networkidle')
        page.get_by_role('button', name=re.compile('Start.*batch', re.I)).first.click()
        name = page.get_by_placeholder(re.compile('^AY '))
        name.fill('Synthetic recovery batch')
        create = page.get_by_role('button', name='Create Batch', exact=True)
        create.evaluate('(b)=>{b.click();b.click()}')
        expect(page.get_by_role('alert')).to_have_text('Synthetic batch validation failed.')
        expect(name).to_have_value('Synthetic recovery batch')
        assert len(creates) == 1 and not batches
        create.click()
        expect(page.get_by_role('alert')).to_contain_text('save could not be confirmed')
        expect(name).to_have_value('Synthetic recovery batch')
        assert len(creates) == 2 and not batches
        create.click()
        expect(name).to_have_count(0)
        assert len(creates) == 3 and batches[0]['id'] == 50
        checks.append('Rejected and malformed create responses preserve typed name and never fabricate a batch; one write per activation')
        page.get_by_role('button', name='Archive batch', exact=True).click()
        archive = page.get_by_role('button', name='Archive Batch', exact=True)
        archive.click()
        expect(page.get_by_role('alert')).to_contain_text('Server is unavailable')
        assert batches[0]['status'] == 'active'
        expect(archive).to_be_enabled()
        archive.click()
        expect(page.get_by_role('heading', name='Start New Batch', exact=True)).to_be_visible()
        page.get_by_role('button', name='Cancel', exact=True).click()
        page.get_by_role('button', name='Unarchive batch', exact=True).click()
        expect(page.get_by_role('alert')).to_contain_text('Server is unavailable')
        assert batches[0]['status'] == 'archived'
        page.get_by_role('button', name='Unarchive batch', exact=True).click()
        expect(page.get_by_role('button', name='Archive batch', exact=True)).to_be_visible()
        assert batches[0]['status'] == 'active'
        checks.append('Archive/unarchive failures preserve actual status and recover on explicit successful retry')
        page.evaluate('window.scrollTo(0,0)')
        page.screenshot(path=str(ARTIFACTS / 'recovered.png'), full_page=True)
        assert not errors, errors
    finally:
        (ARTIFACTS / 'results.json').write_text(json.dumps({'checks': checks, 'page_errors': errors}, indent=2), encoding='utf-8')
        print(json.dumps({'checks': checks, 'page_errors': errors}, indent=2))
        context.close()
        browser.close()
