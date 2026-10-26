"""Dashboard-first sign-in and two-slot warming. Every provider/API response is synthetic."""
import asyncio
import json
import time
from pathlib import Path
from urllib.parse import urlparse
from playwright.async_api import async_playwright, expect
from loading_playwright import analytics, BASE
from navigation_playwright import GOOGLE_STUB, payload, user

OUT = Path(__file__).parent / 'artifacts/dashboard-first'
OUT.mkdir(parents=True, exist_ok=True)
CORE = {
    'admin': ['/api/management/analytics/', '/api/admin/students/recommendations/'],
    'instructor': ['/api/management/analytics/', '/api/instructor/students/recommendations/'],
    'student': ['/api/students/me/', '/api/assessments/', '/api/student/results/combined/'],
}
OPTIONAL = {
    'admin': ['/api/instructor/assessments/', '/api/admin/skills/', '/api/admin/companies/'],
    'instructor': ['/api/instructor/batches/', '/api/instructor/assessments/', '/api/instructor/companies/'],
    'student': [],
}


class SignIn:
    def __init__(self, role='admin', core_delay=.6, optional_delay=.7, auth_delay=.08, **extra):
        self.role, self.core_delay, self.optional_delay, self.auth_delay = role, core_delay, optional_delay, auth_delay
        self.account = user(role, **extra)
        self.events, self.errors, self.failures = [], [], {}
        self.auth_end = None

    async def context(self, browser, warm_code=True):
        context = await browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce')
        await context.add_init_script('window.EventSource = class { close() {} };')

        async def request(route):
            path = urlparse(route.request.url).path
            if urlparse(route.request.url).hostname not in ['127.0.0.1', 'localhost']:
                return await route.fulfill(body=GOOGLE_STUB, content_type='application/javascript') if path == '/gsi/client' else await route.abort()
            if not path.startswith('/api/'):
                return await route.continue_()
            if path.endswith('/events/'):
                return await route.fulfill(json={'ok': True})
            if path in ['/api/auth/login/', '/api/auth/google/']:
                await asyncio.sleep(self.auth_delay)
                self.auth_end = time.perf_counter()
                return await route.fulfill(json={'access': 'synthetic-access', 'refresh': 'synthetic-refresh', 'user': self.account})
            event = {'path': path, 'start': time.perf_counter(), 'end': None}
            self.events.append(event)
            await asyncio.sleep(self.core_delay if path in CORE[self.role] else self.optional_delay)
            event['end'] = time.perf_counter()
            data = analytics(self.role) if path == '/api/management/analytics/' else (
                {**self.account, 'placement': None, 'address': {}} if path == '/api/students/me/' else (
                    {'recommendations_locked': True, 'has_required_assessments': False, 'recommendations': [], 'combined_category_scores': []}
                    if path == '/api/student/results/combined/' else payload(path, self.role)))
            try:
                await route.fulfill(status=self.failures.get(path, 200), json={'error': 'Synthetic unavailable'} if path in self.failures else data)
            except Exception:
                # Navigation/logout may deliberately abort unobserved reads.
                pass

        await context.route('**/*', request)
        page = await context.new_page()
        page.on('pageerror', lambda error: self.errors.append(str(error)))
        await page.goto(BASE + ('/admin/login' if self.role == 'admin' else '/login'))
        await page.wait_for_load_state('networkidle')
        # Isolate the data barrier from variable development-server transforms.
        if warm_code:
            await page.evaluate('''async role => { const { preloadPage } = await import('/src/router/preloadPage.js'); await preloadPage('/' + role + '/dashboard'); }''', self.role)
        assert not self.events, 'Preparing code before login must not fetch private data'
        return context, page

    async def click(self, page):
        if self.role == 'admin':
            await page.get_by_placeholder('Enter your admin email', exact=False).fill('synthetic@dnsc.edu.ph')
            await page.get_by_placeholder('Enter your password', exact=True).fill('synthetic')
            await page.get_by_role('button', name='Sign in', exact=True).click()
        else:
            await page.get_by_role('button', name='Continue with DNSC Google Account', exact=True).click()

    async def wait_started(self, keys, count):
        for _ in range(120):
            if len([event for event in self.events if event['path'] in keys]) >= count:
                return
            await asyncio.sleep(.025)
        raise AssertionError(('Requests not started', keys, self.events))


async def ready_and_warming(browser, checks, metrics):
    for role in CORE:
        print('Checking ready dashboard and warming:', role, flush=True)
        fixture = SignIn(role)
        context, page = await fixture.context(browser)
        await fixture.click(page)
        await expect(page.get_by_text('Preparing your dashboard…', exact=True)).to_be_visible()
        assert page.url.endswith('/login')
        await page.wait_for_url('**/' + role + '/dashboard')
        elapsed = (time.perf_counter() - fixture.auth_end) * 1000
        core = [event for event in fixture.events if event['path'] in CORE[role]]
        assert len(core) == len(CORE[role]) and all(event['end'] for event in core), core
        assert all(event['start'] >= fixture.auth_end for event in fixture.events)
        await expect(page.locator('.sb-skeleton')).to_have_count(0)
        assert not fixture.errors, fixture.errors
        metrics[role + '_ready_handoff_ms'] = round(elapsed)
        checks.append(role + ': essential reads complete before navigation; shared cached data mounts without skeletons')
        if OPTIONAL[role]:
            await fixture.wait_started(OPTIONAL[role], len(OPTIONAL[role]))
            for _ in range(120):
                rows = [event for event in fixture.events if event['path'] in OPTIONAL[role]]
                if all(event['end'] for event in rows):
                    break
                await asyncio.sleep(.025)
            rows = [event for event in fixture.events if event['path'] in OPTIONAL[role]]
            current = maximum = 0
            for _, delta in sorted([(event['start'], 1) for event in rows] + [(event['end'], -1) for event in rows]):
                current += delta; maximum = max(current, maximum)
            assert maximum == 2, rows
            assert min(event['start'] for event in rows) >= max(event['end'] for event in core)
            checks.append(role + ': two background GETs overlap after core readiness, third remains bounded')
        else:
            await page.wait_for_timeout(400)
            assert len(fixture.events) == len(CORE[role]), fixture.events
            checks.append('student: already-loaded profile/assessments/results need no duplicate warming GETs')
        for key in CORE[role]:
            assert len([event for event in fixture.events if event['path'] == key]) == 1
        await context.close()


async def slow_failure_and_cancellation(browser, checks, metrics):
    print('Checking slow requests, recovery and cancellation', flush=True)
    fixture = SignIn(core_delay=3)
    context, page = await fixture.context(browser)
    await fixture.click(page)
    await expect(page.get_by_text('Preparing your dashboard…', exact=True)).to_be_visible()
    await page.wait_for_url('**/admin/dashboard')
    elapsed = (time.perf_counter() - fixture.auth_end) * 1000
    assert 1300 <= elapsed < 2400, elapsed
    assert any(event['end'] is None for event in fixture.events if event['path'] in CORE['admin'])
    await expect(page.locator('.sb-skeleton').first).to_be_visible()
    await expect(page.locator('.sb-skeleton')).to_have_count(0, timeout=5000)
    for key in CORE['admin']:
        assert len([event for event in fixture.events if event['path'] == key]) == 1
    metrics['slow_handoff_ms'] = round(elapsed)
    checks.append('Slow data opens after the bounded preparation window and adopts the same GETs')
    await context.close()

    fixture = SignIn(core_delay=.1)
    context, page = await fixture.context(browser, warm_code=False)
    async def slow_code(route):
        await asyncio.sleep(2.7)
        await route.continue_()
    await context.route('**/src/pages/admin/AdminDashboard.jsx*', slow_code)
    await fixture.click(page)
    await page.wait_for_url('**/admin/dashboard')
    await expect(page.locator('.sk-route-page')).to_be_visible()
    await expect(page.get_by_role('heading', name='Admin Dashboard', exact=True)).to_be_visible()
    await expect(page.locator('.sb-skeleton')).to_have_count(0)
    assert len([event for event in fixture.events if event['path'] in CORE['admin']]) == 2
    checks.append('A slow dashboard module also respects the deadline and hands off to its matching route skeleton')
    await context.close()

    fixture = SignIn(core_delay=.2)
    fixture.failures['/api/management/analytics/'] = 503
    context, page = await fixture.context(browser)
    await fixture.click(page)
    await page.wait_for_url('**/admin/dashboard')
    await expect(page.get_by_text('Could not load this section. Please try again.', exact=True).first).to_be_visible()
    fixture.failures.clear()
    await page.get_by_role('button', name='Retry', exact=True).first.click()
    await expect(page.get_by_text('Could not load this section. Please try again.', exact=True)).to_have_count(0)
    assert not fixture.errors, fixture.errors
    checks.append('Initial dashboard failure preserves successful sign-in and supports section retry')
    await context.close()

    fixture = SignIn(core_delay=3)
    context, page = await fixture.context(browser)
    await fixture.click(page)
    await expect(page.get_by_text('Preparing your dashboard…', exact=True)).to_be_visible()
    await page.evaluate("window.dispatchEvent(new Event('auth:expired'))")
    await expect(page.get_by_role('heading', name='Session Expired')).to_be_visible()
    await page.wait_for_timeout(1650)
    assert page.url.endswith('/admin/login')
    await expect(page.get_by_role('button', name='Sign in', exact=True)).to_be_enabled()
    checks.append('Session expiry cancels the older handoff and releases the sign-in button')
    await context.close()

    fixture = SignIn('instructor', core_delay=.15, auth_delay=.35)
    context, page = await fixture.context(browser)
    await fixture.click(page)
    await page.evaluate("window.dispatchEvent(new Event('auth:expired'))")
    await page.wait_for_url('**/instructor/dashboard')
    checks.append('Retiring-session expiry during the new authentication exchange cannot cancel successful sign-in')
    await context.close()

    fixture = SignIn(core_delay=3)
    context, page = await fixture.context(browser)
    await fixture.click(page)
    await expect(page.get_by_text('Preparing your dashboard…', exact=True)).to_be_visible()
    await page.get_by_role('button', name='Back to student / instructor login', exact=False).click()
    await page.wait_for_url('**/login')
    await page.wait_for_timeout(1650)
    assert page.url == BASE + '/login'
    checks.append('Leaving the login page cancels the older handoff without a delayed redirect')
    await context.close()

    fixture = SignIn(core_delay=3)
    context, page = await fixture.context(browser)
    await fixture.click(page)
    await expect(page.get_by_text('Preparing your dashboard…', exact=True)).to_be_visible()
    fixture.role, fixture.core_delay, fixture.account = 'instructor', .1, user('instructor', id=21)
    await page.evaluate('''account => {
      const old = localStorage.getItem('sb-session-id');
      localStorage.setItem('sb-session-id', 'synthetic-replacement');
      localStorage.setItem('sb-token', 'synthetic-new-access');
      localStorage.setItem('sb-role', account.role);
      localStorage.setItem('sb-user', JSON.stringify(account));
      window.dispatchEvent(new StorageEvent('storage', { key:'sb-session-id', oldValue:old, newValue:'synthetic-replacement' }));
    }''', fixture.account)
    await page.wait_for_url('**/instructor/dashboard')
    await page.wait_for_timeout(1650)
    assert page.url.endswith('/instructor/dashboard')
    assert not fixture.errors, fixture.errors
    checks.append('A cross-tab account switch invalidates old preparation and keeps the new role destination')
    await context.close()


async def special_destinations(browser, checks):
    for role, extra, destination in [('instructor', {'is_approved': False}, '/instructor/pending'),
            ('student', {'is_approved': False}, '/instructor/pending'), ('student', {'phone': ''}, '/student/setup')]:
        fixture = SignIn(role, core_delay=.1, **extra)
        context, page = await fixture.context(browser)
        await fixture.click(page)
        await page.wait_for_url('**' + destination)
        assert not any(event['path'] in ['/api/management/analytics/', '/api/student/results/combined/', '/api/assessments/'] for event in fixture.events)
        checks.append(role + destination + ': preserves approval/setup destination without dashboard warming')
        await context.close()
    fixture = SignIn('student', core_delay=.1, is_approved=None)
    context, page = await fixture.context(browser)
    await fixture.click(page)
    await page.wait_for_url('**/student/dashboard')
    await expect(page.locator('h1').first).to_be_visible()
    assert not fixture.errors, fixture.errors
    checks.append('Missing optional preparation metadata skips warming rather than adding a new sign-in/access gate')
    await context.close()


async def priority_and_visibility(browser, checks):
    fixture = SignIn('instructor', core_delay=.1, optional_delay=1)
    context, page = await fixture.context(browser)
    await page.evaluate("async () => { const { preloadPage } = await import('/src/router/preloadPage.js'); await preloadPage('/instructor/companies'); }")
    await fixture.click(page)
    await page.wait_for_url('**/instructor/dashboard')
    await fixture.wait_started(OPTIONAL['instructor'], 2)
    await page.get_by_role('link', name='Companies', exact=True).click()
    await fixture.wait_started(['/api/instructor/companies/'], 1)
    company = next(event for event in fixture.events if event['path'] == '/api/instructor/companies/')
    earlier = [event for event in fixture.events if event['path'] in ['/api/instructor/batches/', '/api/instructor/assessments/']][:2]
    assert all(event['end'] is None or company['start'] < event['end'] for event in earlier)
    await expect(page.get_by_role('heading', name='Partner Companies', exact=True)).to_be_visible()
    checks.append('Selected page begins its data request ahead of unrelated warming reads')
    await context.close()

    fixture = SignIn('instructor', core_delay=.1, optional_delay=.6)
    context, page = await fixture.context(browser)
    await fixture.click(page)
    await page.wait_for_url('**/instructor/dashboard')
    await fixture.wait_started(OPTIONAL['instructor'], 2)
    await page.evaluate("Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'}); document.dispatchEvent(new Event('visibilitychange'))")
    await page.wait_for_timeout(1000)
    assert len([event for event in fixture.events if event['path'] in OPTIONAL['instructor']]) == 2
    await page.evaluate("Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'}); document.dispatchEvent(new Event('visibilitychange'))")
    await fixture.wait_started(OPTIONAL['instructor'], 3)
    checks.append('Hidden tabs pause new warming work; visibility resumes the bounded queue')
    await context.close()


async def main():
    checks, metrics = [], {}
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel='chrome', headless=True)
        await ready_and_warming(browser, checks, metrics)
        await slow_failure_and_cancellation(browser, checks, metrics)
        await special_destinations(browser, checks)
        await priority_and_visibility(browser, checks)
        await browser.close()
    result = {'checks': checks, 'controlled_fixture_timings_ms': metrics}
    (OUT / 'results.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    asyncio.run(main())
