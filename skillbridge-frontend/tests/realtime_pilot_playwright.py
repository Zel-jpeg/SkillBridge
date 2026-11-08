"""Opt-in transport checks with the real SDK and a synthetic Phoenix server.

Run Vite with VITE_SUPABASE_REALTIME_PILOT=true. HTTP and WebSocket traffic is
intercepted locally; this does not prove hosted Supabase authorization or latency.
"""
import asyncio
import json
import os
from pathlib import Path
import time
from urllib.parse import urlparse

from playwright.async_api import async_playwright, expect
from navigation_playwright import payload, user

BASE = os.environ.get('REALTIME_TEST_URL', 'http://127.0.0.1:5203')
OUT = Path(__file__).parent / 'artifacts/realtime-pilot'
OUT.mkdir(parents=True, exist_ok=True)
HOST = 'syntheticproject12345.supabase.co'
TOKEN = 'synthetic.dedicated.receiver'
checks, errors = [], []


class Fixture:
    def __init__(self, role='student', deny=False):
        self.role, self.deny = role, deny
        self.requests, self.joins, self.sockets = [], [], []

    async def create(self, browser):
        context = await browser.new_context(reduced_motion='reduce')
        identity = user(self.role)
        await context.add_init_script('''(() => {
          const role = ''' + json.dumps(self.role) + ''';
          localStorage.setItem('sb-token', 'synthetic-django-' + role);
          localStorage.setItem('sb-role', role);
          localStorage.setItem('sb-user', JSON.stringify(''' + json.dumps(identity) + '''));
          localStorage.setItem('sb-session-id', 'synthetic-session-' + role);
          window.__pilotChanges = [];
          window.__liveSSE = 0; window.__maxSSE = 0;
          window.EventSource = class {
            constructor() {
              this.closed = false; window.__liveSSE++;
              window.__maxSSE = Math.max(window.__maxSSE, window.__liveSSE);
              queueMicrotask(() => { if (!this.closed) this.onmessage?.({data:JSON.stringify({type:'connected'})}); });
            }
            close() { if (!this.closed) { this.closed = true; window.__liveSSE--; } }
          };
          window.addEventListener('sse:data_changed', event => window.__pilotChanges.push(event.detail));
        })()''')

        async def http(route):
            parsed = urlparse(route.request.url)
            path = parsed.path
            if path.startswith('/api/'):
                self.requests.append({'path': path, 'method': route.request.method,
                                      'authorization': route.request.headers.get('authorization')})
                if path == '/api/realtime/session/':
                    value = {'transport': 'supabase_broadcast', 'url': f'https://{HOST}/realtime/v1',
                        'publishable_key': 'sb_publishable_synthetic', 'token': TOKEN,
                        'topic': f'sb-pilot:synthetic_recipient_{self.role}_123456',
                        'expires_at': int(time.time()) + 60, 'event': 'refresh'}
                elif path.endswith('/events/'):
                    value = {'ok': True}
                else:
                    value = payload(path, self.role)
                await route.fulfill(json=value, headers={'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'})
            elif parsed.hostname in ('127.0.0.1', 'localhost'):
                await route.continue_()
            else:
                await route.abort()

        async def socket(route):
            state = {'route': route, 'topic': None, 'join_ref': None, 'closed': False}
            assert all(previous['closed'] for previous in self.sockets), 'Old WebSocket still open'
            self.sockets.append(state)
            # The Python route's on_close indexes optional code/reason fields
            # even when the driver omits them on a page teardown. Observe the
            # route event directly and let Playwright forward closure normally.
            def closed(_event):
                state['closed'] = True
            route._impl_obj._channel.on('closePage', closed)

            def message(raw):
                assert 'synthetic-django-' not in raw
                join_ref, ref, topic, event, value = json.loads(raw)
                if event == 'phx_join':
                    state.update(topic=topic, join_ref=join_ref)
                    self.joins.append(value)
                    assert value['config']['private'] is True
                    assert value['access_token'] == TOKEN
                    assert value['config']['postgres_changes'] == []
                    response = {'status': 'error', 'response': {'message': 'Synthetic denied'}} if self.deny else {'status': 'ok', 'response': {}}
                    route.send(json.dumps([join_ref, ref, topic, 'phx_reply', response]))
                elif event in ('phx_leave', 'heartbeat'):
                    route.send(json.dumps([join_ref, ref, topic, 'phx_reply', {'status': 'ok', 'response': {}}]))
                else:
                    raise AssertionError(f'Unexpected client publish: {event}')
            route.on_message(message)

        await context.route('**/*', http)
        await context.route_web_socket(f'wss://{HOST}/**', socket)
        page = await context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        suffix = 'assessments' if self.role == 'student' else 'dashboard'
        await page.goto(f'{BASE}/{self.role}/{suffix}')
        await page.wait_for_load_state('networkidle')
        return context, page

    async def joined(self, page, count=1):
        for _ in range(150):
            if len(self.joins) >= count:
                await page.wait_for_timeout(350)
                return
            await page.wait_for_timeout(50)
        raise AssertionError('Synthetic private subscription was not joined')

    async def broadcast(self, event_id='synthetic_event', **extra):
        state = self.sockets[-1]
        hint = {'type': 'data_changed', 'topics': ['results'], 'event_id': event_id, **extra}
        state['route'].send(json.dumps([state['join_ref'], None, state['topic'], 'broadcast',
            {'type': 'broadcast', 'event': 'refresh', 'payload': hint}]))

    async def wait_for_disconnect(self, page, sse_count=0):
        for _ in range(100):
            if all(socket['closed'] for socket in self.sockets):
                await page.wait_for_function('(count) => window.__liveSSE === count', arg=sse_count)
                return
            await page.wait_for_timeout(50)
        raise AssertionError('The routed WebSocket did not close')


async def role_flow(browser, role):
    fixture = Fixture(role)
    context, page = await fixture.create(browser)
    await fixture.joined(page)
    assert await page.evaluate('window.__liveSSE === 0')
    assert len(fixture.sockets) == 1 and not fixture.sockets[0]['closed']
    assert not any(row['path'].endswith('/events/') for row in fixture.requests)
    assert await page.evaluate("[localStorage,sessionStorage].every(storage => Object.values(storage).every(value => !value.includes('synthetic.dedicated.receiver') && !value.includes('sb_publishable_synthetic')))")
    # Quiesce initial join resync, then verify one authorized reconciliation per burst.
    await page.wait_for_load_state('networkidle')
    before = len(fixture.requests)
    changes = await page.evaluate('window.__pilotChanges.length')
    await fixture.broadcast(student_ids=[999], urls=['/api/untrusted/'])
    await fixture.broadcast()
    await page.wait_for_function('(n) => window.__pilotChanges.length === n + 1', arg=changes)
    for _ in range(100):
        if len(fixture.requests) > before:
            break
        await page.wait_for_timeout(50)
    assert len(fixture.requests) > before, {
        'paths': [row['path'] for row in fixture.requests],
        'changes': await page.evaluate('window.__pilotChanges'),
        'body': (await page.locator('body').inner_text())[:2000]}
    assert all(row['authorization'] == f'Bearer synthetic-django-{role}' for row in fixture.requests)
    assert not any(row['path'] == '/api/untrusted/' for row in fixture.requests)
    detail = await page.evaluate('window.__pilotChanges.at(-1)')
    assert detail['resync'] is True and 'student_ids' not in detail
    await fixture.broadcast()
    await page.wait_for_timeout(250)
    assert await page.evaluate('window.__pilotChanges.length') == changes + 1
    checks.append(f'{role}: actual SDK private join uses dedicated token; hints reconcile through authorized GETs, dedupe and ignore supplied IDs/URLs')

    await page.evaluate("window.__visibility='hidden'; Object.defineProperty(document,'visibilityState',{get:()=>window.__visibility,configurable:true}); document.dispatchEvent(new Event('visibilitychange'))")
    await fixture.wait_for_disconnect(page)
    await page.evaluate("window.__visibility='visible'; document.dispatchEvent(new Event('visibilitychange'))")
    await fixture.joined(page, 2)
    assert await page.evaluate('window.__maxSSE === 0')
    assert fixture.sockets[0]['closed'] and not fixture.sockets[1]['closed']
    checks.append(f'{role}: hidden tab disconnects, visible return rejoins/resyncs with one selected transport')

    await page.get_by_role('button', name='Open profile menu', exact=True).click()
    await page.get_by_role('button', name='Log out', exact=True).click()
    await page.get_by_role('dialog').get_by_role('button', name='Log out', exact=True).click()
    await fixture.wait_for_disconnect(page)
    count = len(fixture.joins)
    await page.wait_for_timeout(350)
    assert len(fixture.joins) == count
    assert await page.evaluate("localStorage.getItem('sb-token')") is None
    checks.append(f'{role}: normal logout closes the pilot and cannot reconnect')
    await context.close()


async def denied_and_switch(browser):
    denied = Fixture('admin', deny=True)
    context, page = await denied.create(browser)
    await denied.joined(page)
    await denied.wait_for_disconnect(page, sse_count=1)
    assert await page.evaluate('window.__maxSSE === 1')
    assert await page.get_by_text('Session Expired', exact=True).count() == 0
    checks.append('failed private join closes the socket and selects one SSE connection without expiring valid Django login')
    await context.close()

    switched = Fixture('admin')
    context, page = await switched.create(browser)
    await switched.joined(page)
    switched.role = 'instructor'
    await page.evaluate('''identity => {
      localStorage.setItem('sb-token','synthetic-django-instructor');
      localStorage.setItem('sb-role','instructor'); localStorage.setItem('sb-user',JSON.stringify(identity));
      localStorage.setItem('sb-session-id','synthetic-new-session');
      window.dispatchEvent(new StorageEvent('storage',{key:'sb-session-id',oldValue:'synthetic-session-admin',newValue:'synthetic-new-session'}));
    }''', user('instructor'))
    await page.wait_for_url('**/instructor/dashboard')
    await switched.joined(page, 2)
    assert switched.sockets[0]['closed'] and not switched.sockets[1]['closed']
    assert await page.evaluate('window.__maxSSE === 0')
    assert switched.sockets[0]['topic'] != switched.sockets[1]['topic']
    checks.append('account switch closes the old socket and joins a distinct recipient topic')
    await page.evaluate("Object.defineProperty(document,'visibilityState',{get:()=> 'hidden',configurable:true}); document.dispatchEvent(new Event('visibilitychange'))")
    await switched.wait_for_disconnect(page)
    await context.close()


async def main():
    try:
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(channel='chrome', headless=True)
            try:
                for role in ('student', 'instructor', 'admin'):
                    await role_flow(browser, role)
                await denied_and_switch(browser)
                assert not errors, errors
            finally:
                await browser.close()
    finally:
        (OUT / 'results.json').write_text(json.dumps({'checks': checks, 'page_errors': errors}, indent=2), encoding='utf-8')
    print(json.dumps({'passed': len(checks), 'checks': checks, 'page_errors': errors}, indent=2))


if __name__ == '__main__':
    asyncio.run(main())
