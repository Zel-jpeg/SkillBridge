"""Responsive student greeting check against the isolated SQLite API."""
import json
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).parent / '.runtime'))
from playwright.sync_api import sync_playwright, expect

ARTIFACTS = Path(__file__).parent / 'artifacts/enrollment'
FRONTEND_PORT = int(os.environ.get('ENROLLMENT_FRONTEND_PORT', '5174'))
API_PORT = int(os.environ.get('ENROLLMENT_API_PORT', '8017'))
if len(sys.argv) >= 3:
    FRONTEND_PORT, API_PORT = map(int, sys.argv[1:3])
auth = json.loads((ARTIFACTS / 'auth.json').read_text())
errors = []

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel='chrome', headless=True)
    context = browser.new_context()
    context.add_init_script(
        f"localStorage.setItem('sb-token', {json.dumps(auth['student'])}); "
        "localStorage.setItem('sb-role', 'student');"
    )
    page = context.new_page()
    page.set_default_timeout(20_000)
    page.on('pageerror', lambda error: errors.append(str(error)))

    def route_api(route):
        source = urlparse(route.request.url)
        if source.path.startswith('/api/'):
            route.continue_(url=f'http://127.0.0.1:{API_PORT}' + source.path + ('?' + source.query if source.query else ''))
        elif source.hostname not in ('127.0.0.1', 'localhost'):
            route.abort()
        else:
            route.continue_()

    page.route('**/*', route_api)
    for width in (375, 1366):
        page.set_viewport_size({'width': width, 'height': 900})
        page.goto(f'http://127.0.0.1:{FRONTEND_PORT}/student/dashboard')
        heading = page.get_by_role('heading', level=1)
        expect(heading).to_contain_text('David Rey')
        assert 'Synthetic-greeting' not in heading.inner_text()
        assert '👋' in heading.inner_text(), 'Greeting should include the wave emoji'
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Student dashboard overflowed horizontally'
        page.screenshot(path=str(ARTIFACTS / f'student-dashboard-{width}.png'))

    context.close()
    browser.close()

assert not errors, errors
print(json.dumps({'passed': 2, 'page_errors': errors}))
