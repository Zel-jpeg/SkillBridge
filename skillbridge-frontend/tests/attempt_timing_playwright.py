"""Real local API + browser; network failure, monotonic clock and expiry review."""
import json
import re
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ARTIFACTS = Path(__file__).parent / 'artifacts/attempt-timing'
if '--api-thread' in sys.argv:
    import atexit
    import runpy
    from socketserver import ThreadingMixIn
    from threading import Thread
    runpy.run_path(str(Path(__file__).with_name('attempt_timing_server.py')), run_name='__fixture_import__')
    from django.core.handlers.wsgi import WSGIHandler
    from django.core.servers.basehttp import WSGIServer, WSGIRequestHandler
    class FixtureServer(ThreadingMixIn, WSGIServer):
        daemon_threads = True
    server = FixtureServer(('127.0.0.1', 8018), WSGIRequestHandler)
    server.set_app(WSGIHandler())
    Thread(target=server.serve_forever, daemon=True).start()
    atexit.register(server.server_close)
    atexit.register(server.shutdown)
    print('In-process synthetic API ready', flush=True)
AUTH = json.loads((ARTIFACTS / 'auth.json').read_text(encoding='utf-8'))
BASE = 'http://127.0.0.1:5178'
checks, errors = [], []

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    try:
        for name in ['normal', 'expired']:
            fixture = AUTH[name]
            suffix = f"{fixture['user']['id']}_{fixture['exam']}"
            context = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True,
                user_agent='Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36')
            context.route(re.compile(r'^https?://(?!127\.0\.0\.1|localhost)'), lambda route: route.abort())
            values = {'sb-token': fixture['token'], 'sb-role': 'student', 'sb-user': json.dumps(fixture['user'])}
            context.add_init_script('for (const [k,v] of Object.entries(' + json.dumps(values) + ')) localStorage.setItem(k,v)')
            page = context.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(f"{BASE}/student/assessments/{fixture['exam']}/take", wait_until='domcontentloaded')
            # SSE remains open: await the actual agreement rather than networkidle.
            expect(page.get_by_role('checkbox')).to_be_visible(timeout=30000)
            page.get_by_role('checkbox').check()
            page.get_by_role('button', name='Agree & start', exact=True).click()
            if name == 'normal':
                answer = page.get_by_role('button', name=re.compile('Synthetic correct'))
                expect(answer).to_be_visible()
                answer.click()
                saved = page.evaluate(f"localStorage.getItem('sb_answers_{suffix}')")
                marker = json.loads(page.evaluate(f"localStorage.getItem('sb_integrity_active_{suffix}')"))
                assert marker['attempt_started_at']
                page.evaluate('Date.now = () => 0')
                expect(page.get_by_text(re.compile(r'^0?9:\d{2}$|^10:00$'))).to_be_visible()
                checks.append('Server countdown remains near ten minutes after browser wall-clock changes')
                page.get_by_role('button', name='Review answers', exact=True).click()
                page.get_by_role('button', name='Submit', exact=True).click()
                page.route('**/api/assessments/*/submit/', lambda route: route.abort())
                dialogs = []
                page.on('dialog', lambda dialog: (dialogs.append(dialog.message), dialog.accept()))
                page.get_by_role('button', name='Yes, submit', exact=True).click()
                expect(page.get_by_role('button', name='Submit', exact=True)).to_be_visible()
                assert page.evaluate(f"localStorage.getItem('sb_answers_{suffix}')") == saved
                assert dialogs and 'kept on this device' in dialogs[0]
                checks.append('Failed submission clears loading and retains local answers with truthful recovery message')
                page.unroute('**/api/assessments/*/submit/')
                page.get_by_role('button', name='Submit', exact=True).click()
                with page.expect_response(lambda response: '/submit/' in response.url) as submitted:
                    page.get_by_role('button', name='Yes, submit', exact=True).click()
                assert submitted.value.ok, submitted.value.text()
                assert not submitted.value.json()['review_required']
                expect(page).to_have_url(re.compile('/results$'))
                checks.append('Explicit retry submits once with matching attempt identity and opens recorded results')
            else:
                expect(page.get_by_text('Submission requires instructor review', exact=True)).to_be_visible(timeout=15000)
                expect(page.get_by_text(re.compile('grace period has ended'))).to_be_visible()
                marker = page.evaluate(f"localStorage.getItem('sb_integrity_active_{suffix}')")
                assert marker is None
                checks.append('Expired resumed attempt auto-saves as stopped review evidence without claiming completion')
            page.screenshot(path=str(ARTIFACTS / f'{name}.png'), full_page=True)
            context.close()
        assert not errors, errors
    finally:
        (ARTIFACTS / 'results.json').write_text(json.dumps({'checks': checks, 'page_errors': errors,
            'database': 'isolated SQLite; not PostgreSQL concurrency', 'browser': 'installed Chrome headless'}, indent=2), encoding='utf-8')
        print(json.dumps({'checks': checks, 'page_errors': errors}, indent=2))
        browser.close()
