"""Mocked provider/API browser checks for role-specific sign-in outcomes."""
import json
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

ARTIFACTS = Path(__file__).parent / 'artifacts/auth-contract'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
checks, errors = [], []
STUB = "window.google={accounts:{oauth2:{initTokenClient(options){return {requestAccessToken(){options.callback(window.__denyOAuth?{error:'access_denied'}:{access_token:'synthetic-google'});}};}}}};"

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    try:
        cases = [
            ('Google pending instructor', 'google', 403, 'pending', '/instructor/pending', None),
            ('Google unenrolled student', 'google', 403, 'student_not_enrolled', '/instructor/pending', None),
            ('Google token invalid', 'google', 401, 'Invalid token', None, 'Google token was invalid or expired.'),
            ('Google service unavailable', 'google', 503, 'Google sign-in is temporarily unavailable. Please try again.', None, 'Server is unavailable. Check your connection.'),
            ('Google disabled account', 'google', 403, 'account_disabled', None, 'This account is inactive.'),
            ('Google unverified email', 'google', 403, 'email_unverified', None, 'Verify your DNSC Google email'),
            ('Admin directed to password login', 'google', 403, 'admin_password_required', '/admin/login', None),
            ('OAuth denied', 'google-denied', 200, '', None, 'Google sign-in was cancelled or blocked.'),
            ('Password credentials invalid', 'password', 401, 'Invalid credentials.', None, 'Invalid credentials.'),
            ('Password rejects Google-only role', 'password', 403, 'google_required', None, 'Students and instructors sign in'),
            ('Password service unavailable', 'password', 503, 'Sign-in is temporarily unavailable.', None, 'Server is unavailable. Check your connection.'),
            ('Password admin succeeds', 'password', 200, '', '/admin/dashboard', None),
        ]
        for name, method, code, message, destination, visible_text in cases:
            context = browser.new_context(viewport={'width': 1280, 'height': 900})
            if method == 'google-denied':
                context.add_init_script('window.__denyOAuth=true')

            def route_request(route):
                path = urlparse(route.request.url).path
                if path == '/gsi/client':
                    return route.fulfill(body=STUB, content_type='application/javascript')
                if urlparse(route.request.url).hostname not in ['127.0.0.1', 'localhost']:
                    return route.abort()
                if path in ['/api/auth/google/', '/api/auth/login/']:
                    body = {'error': message} if code != 200 else {'access': 'synthetic-access', 'refresh': 'synthetic-refresh',
                        'user': {'id': 1, 'name': 'Synthetic Admin', 'role': 'admin', 'is_approved': True}}
                    return route.fulfill(status=code, json=body)
                if path.startswith('/api/'):
                    return route.fulfill(status=204) if path.endswith('/events/') else route.fulfill(json={})
                return route.continue_()

            context.route('**/*', route_request)
            page = context.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto('http://127.0.0.1:5178/admin/login' if method == 'password' else 'http://127.0.0.1:5178/login')
            if method == 'password':
                page.get_by_placeholder('Enter your admin email (e.g. admin@dnsc.edu.ph)').fill('synthetic@dnsc.edu.ph')
                page.locator('input[type="password"]').fill('Synthetic-local-password')
                page.get_by_role('button', name='Sign in', exact=True).click()
            else:
                page.get_by_role('button', name='Continue with DNSC Google Account', exact=True).click()
            if destination:
                expect(page).to_have_url('http://127.0.0.1:5178' + destination)
            if visible_text:
                expect(page.get_by_text(visible_text, exact=False)).to_be_visible()
            if code != 200 or method == 'google-denied':
                assert page.evaluate("localStorage.getItem('sb-token')") is None
            checks.append(name)
            context.close()
        assert not errors, errors
    finally:
        (ARTIFACTS / 'results.json').write_text(json.dumps({'checks': checks, 'page_errors': errors,
            'scope': 'Mocked provider/API in installed Chrome; actual Google hosting config remains V05'}, indent=2), encoding='utf-8')
        print(json.dumps({'checks': checks, 'page_errors': errors}, indent=2))
        browser.close()
