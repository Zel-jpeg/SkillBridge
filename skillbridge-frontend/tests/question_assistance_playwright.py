"""Actual question builder: advisory requests cannot replace/revive a draft."""
import json
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

ARTIFACTS = Path(__file__).parent / 'artifacts/question-assistance'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
checks, errors, pending = [], [], []
mode = ['hold']
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    context = browser.new_context(viewport={'width': 1280, 'height': 900})
    user = {'id': 1, 'name': 'Synthetic Instructor', 'role': 'instructor', 'is_approved': True}
    values = {'sb-token': 'synthetic', 'sb-role': 'instructor', 'sb-user': json.dumps(user)}
    context.add_init_script('for (const [k,v] of Object.entries(' + json.dumps(values) + ')) localStorage.setItem(k,v)')
    def route_request(route):
        url = urlparse(route.request.url)
        if url.hostname not in ['localhost', '127.0.0.1']:
            return route.abort()
        if not url.path.startswith('/api/'):
            return route.continue_()
        if url.path.endswith('/events/'):
            return route.fulfill(status=204)
        if url.path == '/api/categories/suggest/':
            if mode[0] == 'hold':
                pending.append(route)
                return
            if mode[0] == 'fail':
                return route.fulfill(status=503, json={'error': 'Synthetic outage'})
            return route.fulfill(json={'suggested_category': 'Database'})
        if url.path == '/api/categories/':
            return route.fulfill(json=[{'id': 1, 'name': 'Database'}, {'id': 2, 'name': 'Networking'}])
        if url.path == '/api/auth/me/':
            return route.fulfill(json=user)
        return route.fulfill(json=[])
    context.route('**/*', route_request)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    try:
        page.goto('http://127.0.0.1:5178/instructor/assessment/create')
        page.wait_for_load_state('networkidle')
        question = page.get_by_placeholder('Type the question here…').first
        expect(question).to_be_visible(timeout=15000)
        question.fill('SQL primary key query')
        page.wait_for_timeout(450)
        assert pending
        question.fill('Short')
        pending.pop(0).fulfill(json={'suggested_category': 'Database'})
        page.wait_for_timeout(250)
        expect(page.get_by_text('Suggested category:', exact=False)).to_have_count(0)
        expect(question).to_have_value('Short')
        checks.append('Late response for old question text is ignored')
        mode[0] = 'success'
        question.fill('Which SQL primary key is used?')
        page.get_by_role('button', name='+ Database', exact=True).click()
        expect(question).to_have_value('Which SQL primary key is used?')
        expect(page.get_by_text('Suggested category:', exact=False)).to_have_count(0)
        manual = page.get_by_role('button', name='Networking', exact=True).last
        manual.click()
        expect(manual).to_have_class(__import__('re').compile('bg-green-600'))
        checks.append('Suggestion applies explicitly; manual category overrides it without replacing question')
        mode[0] = 'fail'
        question.fill('Question retained during suggestion outage')
        page.wait_for_timeout(650)
        expect(question).to_have_value('Question retained during suggestion outage')
        expect(manual).to_have_class(__import__('re').compile('bg-green-600'))
        expect(page.get_by_text('Suggested category:', exact=False)).to_have_count(0)
        checks.append('Suggestion service failure preserves manual classification and question draft')
        page.screenshot(path=str(ARTIFACTS / 'manual-fallback.png'), full_page=True)
        assert not errors, errors
    finally:
        (ARTIFACTS / 'results.json').write_text(json.dumps({'checks': checks, 'page_errors': errors}, indent=2), encoding='utf-8')
        print(json.dumps({'checks': checks, 'page_errors': errors}, indent=2))
        context.close()
        browser.close()
