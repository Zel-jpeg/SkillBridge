"""Public recovery guidance is consistent and performs no account lookup/mail."""
import json
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

ARTIFACTS = Path(__file__).parent / 'artifacts/recovery-help'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
checks, writes = [], []
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    context = browser.new_context(viewport={'width': 390, 'height': 844})
    def route_request(route):
        parsed = urlparse(route.request.url)
        if parsed.path.startswith('/api/'):
            writes.append((route.request.method, parsed.path))
            return route.fulfill(status=429, json={'error': 'Too many login attempts. Please wait a minute and try again.'})
        if parsed.hostname not in ['127.0.0.1', 'localhost']:
            return route.abort()
        return route.continue_()
    context.route('**/*', route_request)
    page = context.new_page()
    try:
        copies = []
        for email in ['', 'invalid-input', 'unknown-synthetic@example.com']:
            page.goto('http://127.0.0.1:5178/admin/login')
            page.get_by_placeholder('Enter your admin email (e.g. admin@dnsc.edu.ph)').fill(email)
            page.get_by_role('button', name='Forgot password?', exact=True).click()
            help_text = page.get_by_role('status')
            expect(help_text).to_contain_text('After verifying your identity')
            expect(help_text).to_contain_text('does not send a reset email')
            copies.append(help_text.inner_text())
        assert len(set(copies)) == 1
        assert not writes
        checks.append('Blank, malformed and unknown email show identical assisted-recovery guidance without lookup or mail requests')
        page.locator('input[type="password"]').fill('Synthetic-local-password')
        page.get_by_role('button', name='Sign in', exact=True).click()
        expect(page.get_by_text('Too many login attempts. Please wait a minute and try again.', exact=True)).to_be_visible()
        expect(page.get_by_role('button', name='Sign in', exact=True)).to_be_enabled()
        checks.append('Rate-limited login shows actionable message and clears loading; recovery help still available')
        page.screenshot(path=str(ARTIFACTS / 'admin-mobile.png'), full_page=True)
        page.goto('http://127.0.0.1:5178/login')
        page.get_by_role('button', name='Need help signing in?', exact=True).click()
        expect(page.get_by_role('status')).to_contain_text('contact your college IT support')
        expect(page.get_by_role('status')).to_contain_text('contact your instructor or OJT coordinator')
        assert writes == [('POST', '/api/auth/login/')]
        checks.append('Google password recovery and SkillBridge enrollment/access review are distinguished without provider requests')
        page.screenshot(path=str(ARTIFACTS / 'google-mobile.png'), full_page=True)
    finally:
        (ARTIFACTS / 'results.json').write_text(json.dumps({'checks': checks, 'requests': writes}, indent=2), encoding='utf-8')
        print(json.dumps({'checks': checks, 'requests': writes}, indent=2))
        browser.close()
