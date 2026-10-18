"""Catalog form recovery checks; synthetic API only, no external writes."""
import json
import re
import time
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

ARTIFACTS = Path(__file__).parent / 'artifacts/catalog-validation'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
checks, errors, mutations = [], [], []
company = {'id': 1, 'name': 'Synthetic Company', 'address': None, 'lat': None, 'lng': None,
           'positions': [{'id': 1, 'title': 'Original role', 'slots': 2, 'tags': [], 'requirements': {'Programming': 70}}]}
fail_create, fail_delete = True, True

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    context = browser.new_context(viewport={'width': 1280, 'height': 900})
    user = {'id': 1, 'role': 'admin', 'name': 'Synthetic Admin', 'is_approved': True}
    values = {'sb-token': 'synthetic-local-token', 'sb-role': 'admin', 'sb-user': json.dumps(user)}
    context.add_init_script('for (const [k,v] of Object.entries(' + json.dumps(values) + ')) localStorage.setItem(k,v)')

    def route_request(route):
        global fail_create, fail_delete
        path = urlparse(route.request.url).path
        method = route.request.method
        if urlparse(route.request.url).hostname not in ['127.0.0.1', 'localhost']:
            return route.abort()
        if not path.startswith('/api/'):
            return route.continue_()
        if path.endswith('/events/'):
            return route.fulfill(status=204)
        if path == '/api/auth/me/':
            return route.fulfill(json=user)
        if path == '/api/categories/':
            return route.fulfill(json=[{'id': 1, 'name': 'Programming', 'tags': []}])
        if path == '/api/admin/companies/' and method == 'GET':
            return route.fulfill(json=[company])
        if path == '/api/admin/companies/1/positions/' and method == 'POST':
            mutations.append((method, path))
            time.sleep(0.2)  # Keep request pending while repeated activation is tested.
            if fail_create:
                fail_create = False
                return route.fulfill(status=400, json={'error': 'Synthetic validation failed; correct the draft.'})
            data = route.request.post_data_json
            data['id'] = 2
            company['positions'].append(data)
            return route.fulfill(status=201, json=data)
        if path == '/api/admin/positions/1/' and method == 'DELETE':
            mutations.append((method, path))
            time.sleep(0.2)
            if fail_delete:
                fail_delete = False
                return route.fulfill(status=409, json={'error': 'Synthetic placement history protects this position.'})
            company['positions'] = [position for position in company['positions'] if position['id'] != 1]
            return route.fulfill(status=204)
        return route.fulfill(json={} if path.endswith('/stats/') else [])

    context.route('**/*', route_request)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    try:
        page.goto('http://127.0.0.1:5178/admin/companies', wait_until='domcontentloaded')
        expect(page.get_by_role('article', name='Synthetic Company')).to_be_visible(timeout=15000)
        page.get_by_role('button', name='Add position to Synthetic Company').click()
        modal = page.locator('div.fixed.inset-0').filter(has=page.get_by_role('heading', name='Add Position', exact=True)).last
        title = modal.get_by_placeholder('e.g. Frontend Developer Intern')
        title.fill('Recoverable role')
        slots = modal.locator('input[type="number"]')
        slots.fill('1.5')
        modal.get_by_role('button', name='Add Position', exact=True).click()
        expect(modal.get_by_text(re.compile('whole number'))).to_be_visible()
        assert not mutations
        slots.fill('0')
        modal.get_by_role('button', name='Add Position', exact=True).evaluate('(button) => { button.click(); button.click() }')
        expect(modal.get_by_text('Synthetic validation failed; correct the draft.', exact=True)).to_be_visible()
        expect(title).to_have_value('Recoverable role')
        expect(slots).to_have_value('0')
        assert len(mutations) == 1
        checks.append('Invalid decimal rejected locally; server validation failure retains title/zero-slot draft; repeated activation sends one request')
        modal.get_by_role('button', name='Add Position', exact=True).click()
        expect(page.get_by_role('heading', name='Recoverable role', exact=True)).to_be_visible()
        assert len(mutations) == 2
        checks.append('Explicit create retry succeeds and adds one position')
        page.get_by_role('button', name='Delete position Original role', exact=True).click()
        confirmation = page.get_by_role('dialog', name='Delete position?', exact=True)
        confirmation.get_by_role('button', name='Delete', exact=True).evaluate('(button) => { button.click(); button.click() }')
        expect(confirmation.get_by_role('alert')).to_have_text('Synthetic placement history protects this position.')
        expect(page.get_by_role('heading', name='Original role', exact=True)).to_be_visible()
        assert len(mutations) == 3
        checks.append('Protected deletion keeps row/dialog and shows error; repeated activation sends one delete')
        confirmation.get_by_role('button', name='Delete', exact=True).click()
        expect(page.get_by_role('heading', name='Original role', exact=True)).to_have_count(0)
        assert len(mutations) == 4
        checks.append('Successful retry removes the row only after server confirmation')
        page.set_viewport_size({'width': 390, 'height': 844})
        page.screenshot(path=str(ARTIFACTS / 'mobile.png'), full_page=True)
        assert not errors, errors
    finally:
        (ARTIFACTS / 'results.json').write_text(json.dumps({'checks': checks, 'page_errors': errors, 'mutations': mutations,
            'scope': 'Mocked catalog API, installed Chrome; backend validation covered separately'}, indent=2), encoding='utf-8')
        print(json.dumps({'checks': checks, 'page_errors': errors}, indent=2))
        browser.close()
