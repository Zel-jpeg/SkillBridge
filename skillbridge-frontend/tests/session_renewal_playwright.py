"""Real short-token renewal against the isolated synthetic API; no live services."""
import atexit
import json
import re
import runpy
from pathlib import Path
from socketserver import ThreadingMixIn
from threading import Thread
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = Path(__file__).parent / 'artifacts/session-renewal'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
fixture = runpy.run_path(str(Path(__file__).with_name('attempt_timing_server.py')), run_name='__fixture_import__')
from django.core.handlers.wsgi import WSGIHandler
from django.core.servers.basehttp import WSGIServer, WSGIRequestHandler
from django.utils import timezone
from datetime import timedelta
from rest_framework_simplejwt.tokens import RefreshToken
from api.models import User

student = User.objects.get(pk=fixture['fixtures']['normal']['user']['id'])
refresh = RefreshToken.for_user(student)
expired_access = refresh.access_token
expired_access.set_exp(from_time=timezone.now() - timedelta(seconds=2), lifetime=timedelta(seconds=1))
expired_refresh = RefreshToken.for_user(student)
expired_refresh.set_exp(from_time=timezone.now() - timedelta(seconds=2), lifetime=timedelta(seconds=1))
auth = {**fixture['fixtures']['normal'], 'token': str(expired_access), 'refresh': str(refresh)}

class FixtureServer(ThreadingMixIn, WSGIServer):
    daemon_threads = True
class QuietHandler(WSGIRequestHandler):
    def log_message(self, *args):
        pass  # Do not log SSE query tokens, even from synthetic sessions.
server = FixtureServer(('127.0.0.1', 8018), QuietHandler)
server.set_app(WSGIHandler())
Thread(target=server.serve_forever, daemon=True).start()
atexit.register(server.server_close)
atexit.register(server.shutdown)
checks, errors, requests = [], [], []

def session(browser, refresh_value=None):
    context = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True,
        user_agent='Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36')
    values = {'sb-token': auth['token'], 'sb-refresh': refresh_value or auth['refresh'], 'sb-role': 'student',
              'sb-user': json.dumps(auth['user']), 'sb-session-id': 'synthetic-session-epoch'}
    context.add_init_script('for (const [k,v] of Object.entries(' + json.dumps(values) + ')) localStorage.setItem(k,v)')
    def route_request(route):
        parsed = urlparse(route.request.url)
        if parsed.hostname not in ['127.0.0.1', 'localhost']:
            return route.abort()
        if parsed.path.startswith('/api/'):
            requests.append((route.request.method, parsed.path))
        if parsed.path == '/api/uncertain-write/':
            return route.abort()
        return route.continue_()
    context.route('**/*', route_request)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    return context, page

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    try:
        context, page = session(browser)
        page.goto(f"http://127.0.0.1:5178/student/assessments/{auth['exam']}/take")
        expect(page.get_by_role('checkbox')).to_be_visible(timeout=30000)
        assert sum(path == '/api/auth/refresh/' for _, path in requests) == 1
        checks.append('Expired access on initial protected reads/preflight is renewed once with real refresh JWT')
        page.get_by_role('checkbox').check()
        page.get_by_role('button', name='Agree & start', exact=True).click()
        answer = page.get_by_role('button', name=re.compile('Synthetic correct'))
        expect(answer).to_be_visible()
        answer.click()
        suffix = f"{auth['user']['id']}_{auth['exam']}"
        saved = page.evaluate(f"localStorage.getItem('sb_answers_{suffix}')")
        assert saved
        baseline = sum(path == '/api/auth/refresh/' for _, path in requests)
        await_requests = page.evaluate('''async token => {
          const {default: api} = await import('/src/api/axios.js');
          localStorage.setItem('sb-token', token);
          return Promise.all(Array.from({length:20}, () => api.get('/api/students/me/').then(r=>r.status)));
        }''', auth['token'])
        assert await_requests == [200] * 20
        assert sum(path == '/api/auth/refresh/' for _, path in requests) == baseline + 1
        expect(answer).to_have_class(re.compile('border-green-500'))
        assert page.evaluate(f"localStorage.getItem('sb_answers_{suffix}')") == saved
        expect(page.get_by_text('Session Expired', exact=True)).to_have_count(0)
        checks.append('Twenty concurrent expired-access reads share one exchange; active answer/layout remains mounted through SSE reconnection')
        baseline = len(requests)
        network = page.evaluate('''async () => {
          const {default: api} = await import('/src/api/axios.js');
          try { await api.post('/api/uncertain-write/', {synthetic:true}) } catch(error) { return !error.response }
        }''')
        assert network
        assert requests[baseline:] == [('POST', '/api/uncertain-write/')]
        checks.append('An uncertain network-failed mutation is sent once and triggers neither renewal nor automatic replay')
        before = sum(path == f"/api/assessments/{auth['exam']}/submit/" for _, path in requests)
        result = page.evaluate('''async ({token, exam, suffix}) => {
          const {default: api} = await import('/src/api/axios.js');
          const marker = JSON.parse(localStorage.getItem('sb_integrity_active_'+suffix));
          const answers = Object.entries(JSON.parse(localStorage.getItem('sb_answers_'+suffix))).map(([id,value])=>({question_id:Number(id),...value}));
          localStorage.setItem('sb-token', token);
          return (await api.post('/api/assessments/'+exam+'/submit/', {...marker, answers})).data;
        }''', {'token': auth['token'], 'exam': auth['exam'], 'suffix': suffix})
        assert result['attempt_status'] == 'submitted' and not result['review_required']
        assert sum(path == f"/api/assessments/{auth['exam']}/submit/" for _, path in requests) == before + 2
        checks.append('Explicit DRF authentication 401 on submit is retried once after renewal; real server records ordinary submitted evidence')
        page.screenshot(path=str(ARTIFACTS / 'renewed-active.png'), full_page=True)
        context.close()

        context, page = session(browser, str(expired_refresh))
        context.add_init_script(f"localStorage.setItem('sb_answers_{suffix}', 'recoverable-synthetic-draft')")
        page.goto('http://127.0.0.1:5178/student/results')
        expect(page.get_by_text('Session Expired', exact=True)).to_be_visible(timeout=20000)
        assert page.evaluate(f"localStorage.getItem('sb_answers_{suffix}')") == 'recoverable-synthetic-draft'
        checks.append('Expired real refresh stops renewal and shows reauthentication while keeping only the owning student’s draft')
        context.close()

        context, page = session(browser)
        held = []
        context.route('**/api/auth/refresh/', lambda route: held.append(route))
        page.goto('http://127.0.0.1:5178/login')
        page.evaluate('''async () => {
          const {default: api} = await import('/src/api/axios.js');
          window.__pending = api.get('/api/students/me/').catch(error=>error.code);
        }''')
        for _ in range(50):
            if held: break
            page.wait_for_timeout(50)
        assert held
        page.evaluate("async () => {const {logoutSession}=await import('/src/api/logout.js'); logoutSession(()=>{});}")
        held[0].fulfill(json={'access': 'obsolete-synthetic-token'})
        assert page.evaluate('async () => await window.__pending') == 'ERR_CANCELED'
        assert page.evaluate("localStorage.getItem('sb-token')") is None
        checks.append('Logout during an in-flight refresh cannot restore credentials or replay the rejected request')
        context.close()
        assert not errors, errors
    finally:
        (ARTIFACTS / 'results.json').write_text(json.dumps({'checks': checks, 'page_errors': errors,
            'request_paths': requests, 'database': 'isolated SQLite; JWT/refresh API is real'}, indent=2), encoding='utf-8')
        print(json.dumps({'checks': checks, 'page_errors': errors}, indent=2))
        browser.close()
