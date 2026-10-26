"""Synthetic navigation checks. No real credentials, Google, emails or database.

Run against local Vite: backend/venv Python tests/navigation_playwright.py [baseline]
Artifacts are ignored. Delays are fixture timings, never deployment claims.
"""
import asyncio
import json
import sys
import time
from pathlib import Path
from urllib.parse import urlparse
from playwright.async_api import async_playwright

BASE = 'http://127.0.0.1:' + ('5174' if 'baseline' in sys.argv and 'snapshot' in sys.argv else '5173')
ARTIFACTS = Path(__file__).parent / 'artifacts/navigation'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
BASELINE = 'baseline' in sys.argv
GOOGLE_STUB = """window.google={accounts:{oauth2:{initTokenClient(options){return {
requestAccessToken(){options.callback({access_token:'synthetic-google'});}};}}}};"""


def payload(path, role):
    if path == '/api/auth/me/':
        return user(role)
    if path == '/api/students/me/':
        return {**user(role), 'placement': None, 'address': {}}
    if path == '/api/assessments/':
        return {'assessments': [], 'completed_required_count': 0, 'total_required_count': 0}
    if path == '/api/student/results/combined/':
        return {'recommendations_locked': True, 'has_required_assessments': False}
    if path == '/api/admin/users/':
        return {'students': [], 'instructors': [], 'pending_instructors': []}
    if path == '/api/placements/suggestions/':
        return {'companies': [], 'eligible_students': []}
    if path == '/api/placements/':
        return {'placements': []}
    if path in ['/api/admin/stats/', '/api/admin/reports/', '/api/admin/placement-analytics/']:
        return {}
    return []


def user(role, **extra):
    return {'id': {'admin': 1, 'instructor': 2, 'student': 3}[role], 'role': role,
            'name': 'Synthetic User', 'is_approved': True, 'phone': 'synthetic', **extra}


async def run_case(browser, role, google=False, approved=True, setup=False, failure=None, old_session=False, oauth_expiry=False):
    context = await browser.new_context(reduced_motion='reduce')
    # Keep stream behavior out of these ordering fixtures. Live SSE is exercised
    # separately against the isolated Django fixture by freshness_playwright.py.
    await context.add_init_script('window.EventSource = class { close() {} };')
    if old_session:
        await context.add_init_script("localStorage.setItem('sb-token','synthetic-old-session'); localStorage.setItem('sb-role','admin'); localStorage.setItem('sb-user'," + json.dumps(json.dumps(user('admin'))) + ");")
    events, errors = [], []
    clock = time.perf_counter
    started = clock()
    auth_at = None
    u = user(role, is_approved=approved, phone='' if setup else 'synthetic')

    async def route_request(route):
        nonlocal auth_at
        request = route.request
        parsed = urlparse(request.url)
        path = parsed.path
        if parsed.hostname not in ('127.0.0.1', 'localhost'):
            if path == '/gsi/client':
                stub = GOOGLE_STUB.replace("options.callback({access_token:'synthetic-google'});", "setTimeout(()=>options.callback({access_token:'synthetic-google'}),150);") if oauth_expiry else GOOGLE_STUB
                return await route.fulfill(body=stub, content_type='application/javascript')
            return await route.abort()
        if not path.startswith('/api/'):
            return await route.continue_()
        if path.endswith('/events/'):
            return await route.fulfill(json={'ok': True})
        if path == '/api/old-session/':
            await asyncio.sleep(.05)
            return await route.fulfill(status=401, json={'error': 'Synthetic obsolete session'})
        if path in ['/api/auth/login/', '/api/auth/google/']:
            await asyncio.sleep(.1)
            auth_at = clock()
            if failure:
                return await route.fulfill(status=403, json={'error': failure})
            return await route.fulfill(json={'access': 'synthetic-session', 'refresh': 'synthetic-refresh', 'user': u})
        begin = clock()
        events.append({'path': path, 'start_ms': round((begin-started)*1000), 'end_ms': None})
        event = events[-1]
        # A slow unrelated endpoint demonstrates the login barrier.
        await asyncio.sleep(1.5 if path in ['/api/admin/companies/', '/api/instructor/companies/', '/api/student/results/review/'] else .18)
        event['end_ms'] = round((clock()-started)*1000)
        if path.endswith('/companies/'):
            return await route.fulfill(status=503, json={'error': 'Synthetic optional failure'})
        return await route.fulfill(json=payload(path, role))

    await context.route('**/*', route_request)
    page = await context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    await page.goto(BASE + ('/login' if google else '/admin/login'))
    await page.wait_for_load_state('networkidle')
    startup = await page.evaluate('performance.now()')
    startup_resources = await page.evaluate('''(() => ({
      dom_content_loaded_ms: Math.round(performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd),
      javascript_decoded_bytes: performance.getEntriesByType('resource').filter(e=>e.name.includes('.js')).reduce((sum,e)=>sum+e.decodedBodySize,0)
    }))()''')
    if google:
        if oauth_expiry:
            await page.evaluate("document.querySelector('button').addEventListener('pointerdown', () => setTimeout(()=>window.dispatchEvent(new Event('auth:expired')),50), {once:true,capture:true})")
        await page.get_by_role('button', name='Continue with DNSC Google Account').click()
    else:
        await page.get_by_placeholder('Enter your admin email', exact=False).fill('synthetic@dnsc.edu.ph')
        await page.get_by_placeholder('Enter your password').fill('synthetic')
        if old_session:
            await page.evaluate("async () => { const { fetchWithDedup } = await import('/src/hooks/useApi.js'); document.querySelector('button[type=submit]').addEventListener('pointerdown', () => { fetchWithDedup('/api/old-session/').catch(()=>{}); }, {once:true,capture:true}); }")
        await page.get_by_role('button', name='Sign in', exact=True).click()
    expected = '/instructor/pending' if failure or not approved else '/student/setup' if setup else f'/{role}/dashboard'
    await page.wait_for_url('**' + expected)
    nav_at = clock()
    essential_at = None
    if approved and not setup and not failure:
        heading = {'admin': 'Admin Dashboard', 'instructor': 'Student performance', 'student': 'Good ' }[role]
        await page.wait_for_function('(text) => Array.from(document.querySelectorAll("h1")).some(el => el.textContent.includes(text))', arg=heading)
        if not BASELINE:
            await page.wait_for_function('!document.querySelector("#sb-main .sb-skeleton")')
        else:
            essentials = {'admin': ['/api/admin/stats/', '/api/admin/students/recommendations/'],
                'instructor': ['/api/instructor/students/recommendations/', '/api/instructor/assessments/'],
                'student': ['/api/students/me/', '/api/assessments/', '/api/student/results/combined/']}[role]
            for _ in range(500):
                if all(any(e['path'] == key and e['end_ms'] is not None for e in events) for key in essentials):
                    break
                await asyncio.sleep(.02)
            else:
                raise AssertionError('Essential requests never completed')
        essential_at = clock()
    await page.wait_for_timeout(100)
    suffix = failure or ('setup' if setup else 'pending' if not approved else 'landing')
    await page.screenshot(path=str(ARTIFACTS / f'{"before" if BASELINE else "after"}-{role}-{suffix}.png'), full_page=True)
    result = {'role': role, 'google_stub': google, 'destination': expected,
              'auth_success_to_navigation_ms': round((nav_at-auth_at)*1000),
              'essential_usable_after_auth_ms': round((essential_at-auth_at)*1000) if essential_at else None,
              'network_idle_observation_ms': round(startup),
              'startup_resources': startup_resources,
              'obsolete_session_race': old_session,
              'expiry_during_oauth': oauth_expiry,
              'requests': events, 'page_errors': errors}
    if not BASELINE:
        assert nav_at-auth_at < (2.2 if approved and not setup and not failure else .8), result
        assert not errors, errors
        assert not await page.get_by_text('Session Expired', exact=True).count()
        if approved and not setup and not failure:
            assert await page.get_by_role('navigation').count() >= 1
            assert not any('/review/' in e['path'] for e in events)
    if approved and not setup and not failure:
        optional = {'admin': ['/api/instructor/assessments/', '/api/admin/skills/', '/api/admin/companies/'],
                    'instructor': ['/api/instructor/batches/', '/api/instructor/assessments/', '/api/instructor/companies/'], 'student': []}[role]
        if not BASELINE:
            for _ in range(500):
                if all(any(e['path'] == key and e['end_ms'] is not None for e in events) for key in optional):
                    break
                await asyncio.sleep(.02)
            else:
                raise AssertionError('Preparation did not finish')
        result['landing_request_count'] = len(events)
        completed = [e for e in events if e['end_ms'] is not None]
        result['all_landing_gets_completed_after_auth_ms'] = max(e['end_ms'] for e in completed) - round((auth_at-started)*1000)
        # Network intervals measure overlap, independently of queue internals.
        sweep = sorted([(e['start_ms'], 1) for e in completed] + [(e['end_ms'], -1) for e in completed])
        current = maximum = 0
        for _, delta in sweep:
            current += delta; maximum = max(maximum, current)
        result['max_landing_get_concurrency'] = maximum
        if not BASELINE and optional:
            intervals = [e for e in completed if e['path'] in optional]
            pool = sorted([(event['start_ms'], 1) for event in intervals] + [(event['end_ms'], -1) for event in intervals])
            active = maximum = 0
            for _, change in pool:
                active += change
                maximum = max(maximum, active)
            assert maximum <= 2
            result['optional_preparation_duration_ms'] = max(e['end_ms'] for e in intervals) - min(e['start_ms'] for e in intervals)
        # A genuinely cold data visit, followed by a cache-warmed client navigation.
        await page.wait_for_load_state('networkidle')
        await page.evaluate("async () => { const loaded = performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname === '/src/api/prefetch.js'); const { resetPrefetch } = await import(loaded?.name ?? '/src/api/prefetch.js'); resetPrefetch(); const { clearAllCache } = await import('/src/hooks/useApi.js'); clearAllCache(); }")
        marker = {'student': 'No published assessments are assigned', 'instructor': 'No assessments published yet',
                  'admin': 'No assessments match these filters.'}[role]
        start = clock()
        await page.get_by_role('link', name='Assessments', exact=True).click()
        await page.get_by_text(marker, exact=False).first.wait_for()
        result['cold_assessments_navigation_ms'] = round((clock()-start)*1000)
        await page.get_by_role('link', name='Dashboard', exact=True).click()
        await page.wait_for_function('(text) => Array.from(document.querySelectorAll("h1")).some(el => el.textContent.includes(text))', arg=heading)
        start = clock()
        await page.get_by_role('link', name='Assessments', exact=True).click()
        await page.get_by_text(marker, exact=False).first.wait_for()
        result['warm_assessments_navigation_ms'] = round((clock()-start)*1000)
        assert not errors, errors
    await context.close()
    return result


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel='chrome', headless=True)
        results = [await run_case(browser, 'admin')]
        for role in ['instructor', 'student']:
            results.append(await run_case(browser, role, google=True))
        if not BASELINE:
            results.append(await run_case(browser, 'student', google=True, setup=True))
            results.append(await run_case(browser, 'instructor', google=True, approved=False))
            results.append(await run_case(browser, 'student', google=True, approved=False))
            for error in ['pending', 'role_selection_required', 'student_not_enrolled', 'student_pending']:
                results.append(await run_case(browser, 'student', google=True, failure=error))
            results.append(await run_case(browser, 'admin', old_session=True))
            results.append(await run_case(browser, 'student', google=True, old_session=True, oauth_expiry=True))
        await browser.close()
    label = 'baseline' if BASELINE else 'after'
    (ARTIFACTS / f'{label}.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
    print(json.dumps([{k: v for k, v in r.items() if k != 'requests'} | {'request_count': len(r['requests'])} for r in results]))


if __name__ == '__main__':
    asyncio.run(main())
