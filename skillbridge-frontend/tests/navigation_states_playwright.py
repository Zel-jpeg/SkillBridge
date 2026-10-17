"""Local mocked route/loading/lifecycle checks, separate from live SSE checks."""
import asyncio
import json
import time
from urllib.parse import urlparse
from playwright.async_api import async_playwright, expect
from navigation_playwright import ARTIFACTS, BASE, GOOGLE_STUB, payload, user

QUERIES = {
    'admin': ['dashboard', 'users', 'assessments', 'skills', 'companies', 'placements', 'reports'],
    'instructor': ['dashboard', 'students', 'assessments', 'assessment/create', 'companies', 'placements'],
    'student': ['dashboard', 'assessments', 'results', 'profile', 'assessments/1/results', 'assessments/1/take', 'setup'],
}


class Fixture:
    def __init__(self, role):
        self.role, self.events, self.errors = role, [], []
        self.failures, self.delays = {}, {}
        self.values = {'/api/admin/stats/': {'total_students': 7},
            '/api/admin/skills/': [{'id': 1, 'name': 'Synthetic skill', 'description': '', 'tags': []}],
            '/api/student/results/': {'assessment': {'id': 1, 'title': 'Synthetic assessment'}, 'skill_scores': [], 'recommendations_locked': True},
            '/api/student/results/review/': {'questions': [], 'answers': {}},
            '/api/admin/nlp-configuration/': {'active_model': 'spacy_md', 'models': []}}

    async def context(self, browser):
        context = await browser.new_context(reduced_motion='reduce')
        values = {'sb-token': 'synthetic-session', 'sb-role': self.role, 'sb-user': json.dumps(user(self.role))}
        await context.add_init_script('''(() => {
          try { for (const [k,v] of Object.entries(''' + json.dumps(values) + ''')) localStorage.setItem(k,v); } catch {}
          window.EventSource = class { close() {} };
        })()''')

        async def route_request(route):
            parsed = urlparse(route.request.url)
            if parsed.hostname not in ('localhost', '127.0.0.1'):
                if parsed.path == '/gsi/client':
                    return await route.fulfill(body=GOOGLE_STUB, content_type='application/javascript')
                return await route.abort()
            path = parsed.path
            if not path.startswith('/api/'):
                return await route.continue_()
            if path.endswith('/events/'):
                return await route.fulfill(json={'ok': True})
            event = {'path': path, 'start': time.perf_counter(), 'end': None}
            self.events.append(event)
            await asyncio.sleep(self.delays.get(path, .12))
            event['end'] = time.perf_counter()
            if path in self.failures:
                if self.failures[path] == 'offline':
                    return await route.abort('internetdisconnected')
                return await route.fulfill(status=self.failures[path], json={'error': 'Synthetic failure'})
            return await route.fulfill(json=self.values.get(path, payload(path, self.role)))

        await context.route('**/*', route_request)
        page = await context.new_page()
        page.on('pageerror', lambda error: self.errors.append(str(error)))
        page.on('console', lambda message: self.errors.append(message.text) if message.type == 'error' and
                ('Cannot update a component' in message.text or 'Maximum update' in message.text) else None)
        return context, page

    async def started(self, path):
        for _ in range(1000):
            if any(event['path'] == path for event in self.events):
                return
            await asyncio.sleep(.02)
        raise AssertionError(f'Request never started: {path}')


async def settled(page):
    await page.wait_for_function('document.querySelector("h1") && !document.querySelector(".sb-skeleton")')
    assert not await page.get_by_text('Something went wrong', exact=True).count()


async def route_coverage(browser, checks):
    for role, routes in QUERIES.items():
        fixture = Fixture(role)
        context, page = await fixture.context(browser)
        for suffix in routes:
            path = f'/{role}/{suffix}'
            print('Checking ' + path, flush=True)
            await page.goto(BASE + path)
            if suffix.endswith('/take'):
                await page.get_by_text('Assessment unavailable', exact=True).wait_for()
                # Empty assessment list cannot trigger start/submit/stop or preparation.
                assert not any(e['path'].endswith(('/start/', '/submit/', '/stop/')) for e in fixture.events)
            elif suffix == 'setup':
                await page.get_by_text('Student ID', exact=False).first.wait_for()
            else:
                await settled(page)
            assert not fixture.errors, (path, fixture.errors)
            checks.append('Direct route: ' + path)
        # Ordinary warm navigation still works after preparation failures or no preparation.
        await page.goto(BASE + f'/{role}/dashboard')
        await settled(page)
        await page.get_by_role('link', name='Assessments', exact=True).click()
        await settled(page)
        assert page.url.endswith(f'/{role}/assessments')
        await page.go_back()
        await settled(page)
        checks.append(role + ': warmed navigation and history return')
        await context.close()


async def loading_lifecycle(browser, checks, metrics):
    fixture = Fixture('admin')
    fixture.delays['/api/admin/students/recommendations/'] = .8
    fixture.delays['/api/admin/companies/'] = 1.2
    context, page = await fixture.context(browser)
    await page.goto(BASE + '/admin/dashboard')
    await page.get_by_text('Total Students', exact=True).wait_for()
    assert await page.locator('.sb-skeleton-table').count() == 1
    assert await page.get_by_role('link', name='Users', exact=True).is_enabled()
    await page.screenshot(path=str(ARTIFACTS / 'independent-dashboard.png'), full_page=True)
    await settled(page)
    await fixture.started('/api/admin/companies/')
    essential_end = max(e['end'] for e in fixture.events if e['path'] in
        ['/api/admin/stats/', '/api/admin/students/recommendations/'])
    optional = [e for e in fixture.events if e['path'] in ['/api/instructor/assessments/', '/api/admin/skills/', '/api/admin/companies/']]
    assert all(e['start'] >= essential_end for e in optional)
    checks.append('Independent dashboard sections render; preparation starts after essential data')
    # A mounted consumer adopts an in-flight prepared GET without a duplicate.
    start = time.perf_counter()
    await page.get_by_role('link', name='Companies', exact=True).click()
    await settled(page)
    assert sum(e['path'] == '/api/admin/companies/' for e in fixture.events) == 1
    checks.append('Navigation adopts an in-flight prepared request')
    metrics['prepared_inflight_navigation_ms'] = round((time.perf_counter() - start) * 1000)

    await page.get_by_role('link', name='Skills', exact=True).click()
    await page.get_by_text('Synthetic skill', exact=True).wait_for()
    fixture.failures['/api/admin/skills/'] = 503
    await page.evaluate("async () => { const { fetchWithDedup } = await import('/src/hooks/useApi.js'); await fetchWithDedup('/api/admin/skills/').catch(()=>{}); }")
    await page.get_by_text('Could not refresh. Showing the last loaded data.', exact=True).wait_for()
    assert await page.get_by_text('Synthetic skill', exact=True).is_visible()
    assert await page.locator('.sb-skeleton').count() == 0
    checks.append('Transient refresh failure preserves last-good content')
    del fixture.failures['/api/admin/skills/']
    await page.get_by_role('button', name='Retry', exact=True).click()
    await page.get_by_text('Could not refresh. Showing the last loaded data.', exact=True).wait_for(state='hidden')

    # Cold navigation after clearing the shared cache, then a warm revisit.
    await page.evaluate("async () => { const { clearAllCache } = await import('/src/hooks/useApi.js'); clearAllCache(); }")
    start = time.perf_counter()
    await page.goto(BASE + '/admin/skills')
    await page.get_by_text('Synthetic skill', exact=True).wait_for()
    metrics['cold_skills_navigation_ms'] = round((time.perf_counter() - start) * 1000)
    await page.get_by_role('link', name='Dashboard', exact=True).click(); await settled(page)
    start = time.perf_counter()
    await page.get_by_role('link', name='Skills', exact=True).click()
    await page.get_by_text('Synthetic skill', exact=True).wait_for()
    metrics['warm_skills_navigation_ms'] = round((time.perf_counter() - start) * 1000)
    fixture.values['/api/admin/skills/'] = []
    await page.evaluate("async () => { const { fetchWithDedup } = await import('/src/hooks/useApi.js'); await fetchWithDedup('/api/admin/skills/'); }")
    await page.get_by_text('No skill categories found.', exact=True).wait_for()
    checks.append('Cold, warm, retry and successful empty states')
    assert not fixture.errors, fixture.errors
    await context.close()

    # Initial failure has an explicit retry, rather than a misleading empty list.
    fixture = Fixture('admin'); fixture.failures['/api/admin/skills/'] = 'offline'
    context, page = await fixture.context(browser)
    await page.goto(BASE + '/admin/skills')
    await page.get_by_text('Could not load this section. Please try again.', exact=True).wait_for()
    assert not await page.get_by_text('No skill categories found.', exact=True).count()
    del fixture.failures['/api/admin/skills/']
    await page.get_by_role('button', name='Retry', exact=True).click()
    await page.get_by_text('Synthetic skill', exact=True).wait_for()
    checks.append('Initial transport/offline failure is retryable and distinct from empty data')
    await context.close()


async def hidden_logout(browser, checks):
    fixture = Fixture('admin'); fixture.delays['/api/admin/stats/'] = .6
    fixture.delays['/api/instructor/assessments/'] = .8
    context, page = await fixture.context(browser)
    await page.goto(BASE + '/admin/dashboard')
    await page.evaluate("window.testVisibility='hidden'; Object.defineProperty(document,'visibilityState',{get:()=>window.testVisibility,configurable:true});document.dispatchEvent(new Event('visibilitychange'))")
    await settled(page)
    await page.wait_for_timeout(150)
    assert not any(e['path'] == '/api/instructor/assessments/' for e in fixture.events)
    await page.evaluate("window.testVisibility='visible';document.dispatchEvent(new Event('visibilitychange'))")
    await fixture.started('/api/instructor/assessments/')
    await page.get_by_role('button', name='Open profile menu', exact=True).click()
    await page.get_by_role('button', name='Log out', exact=True).click()
    await page.get_by_role('dialog').get_by_role('button', name='Log out', exact=True).click()
    await page.wait_for_url('**/admin/login')
    count = len(fixture.events)
    await page.wait_for_timeout(1000)
    assert len(fixture.events) == count
    assert await page.evaluate("localStorage.getItem('sb-token')") is None
    checks.append('Hidden-tab pause/return and logout during preparation')
    await context.close()


async def positive_initial_lists(browser, checks):
    for role, path, endpoint, value, marker, forbidden_empty in [
        ('admin', '/admin/users', '/api/admin/users/',
         {'students': [{'id': 101, 'name': 'Synthetic populated user', 'student_id': 'SYNTH-101', 'course': 'BSIT'}], 'instructors': [], 'pending_instructors': []},
         'Synthetic populated user', ['No users match your filters.']),
        ('admin', '/admin/companies', '/api/admin/companies/',
         [{'id': 1, 'name': 'Synthetic populated company', 'positions': [], 'address': {}}],
         'Synthetic populated company', ['No companies yet', 'No companies match your search.']),
        ('instructor', '/instructor/students', '/api/instructor/batches/',
         [{'id': 1, 'name': 'Synthetic populated cohort', 'status': 'active'}],
         'Synthetic populated learner', ['No active batch', 'No students enrolled', 'No students match your search.']),
    ]:
        fixture = Fixture(role); fixture.values[endpoint] = value; fixture.delays[endpoint] = .5
        if role == 'instructor':
            fixture.values['/api/instructor/batches/1/students/'] = {'batch': {'id': 1, 'name': 'Synthetic populated cohort'},
                'students': [{'id': 101, 'name': marker, 'school_id': 'SYNTH-101', 'course': 'BSIT'}]}
            fixture.delays['/api/instructor/batches/1/students/'] = .4
        context, page = await fixture.context(browser)
        await context.add_init_script('''(() => {
          window.falseEmpty = [];
          new MutationObserver(() => {
            const text = document.querySelector('#sb-main')?.innerText || '';
            for (const empty of ''' + json.dumps(forbidden_empty) + ''') {
              if (text.includes(empty)) window.falseEmpty.push(empty);
            }
          }).observe(document, {childList:true,subtree:true,characterData:true});
        })()''')
        await page.goto(BASE + path)
        await page.get_by_text(marker, exact=True).first.wait_for()
        assert await page.evaluate('window.falseEmpty') == [], path
        assert not fixture.errors, fixture.errors
        checks.append('Slow populated initial list avoids empty/count flash: ' + path)
        await context.close()


async def forms_and_account_switch(browser, checks):
    fixture = Fixture('student')
    context, page = await fixture.context(browser)
    await page.goto(BASE + '/student/profile'); await settled(page)
    name = page.get_by_placeholder('e.g. Juan Dela Cruz')
    await name.fill('Unsaved synthetic profile')
    fixture.values['/api/students/me/'] = {**user('student'), 'name': 'Remote synthetic profile', 'address': {}}
    await page.evaluate("async () => { const { fetchWithDedup } = await import('/src/hooks/useApi.js'); await fetchWithDedup('/api/students/me/'); }")
    assert await name.input_value() == 'Unsaved synthetic profile'
    checks.append('Student profile draft survives background refresh')
    await context.close()

    fixture = Fixture('instructor')
    fixture.values['/api/instructor/assessments/'] = [{
        'id': 1, 'title': 'Synthetic editable assessment', 'publication_status': 'draft',
        'duration_minutes': 60, 'question_count': 1, 'categories': [], 'batch_id': 1,
        'batch_name': 'Synthetic cohort', 'is_required': True, 'include_in_competency': True,
    }]
    question_url = '/api/instructor/assessments/1/questions/'
    fixture.values[question_url] = {'questions': [{'id': 1, 'question_text': 'Synthetic editable question',
        'question_type': 'mcq', 'choices': [{'id': 1, 'text': 'Synthetic correct', 'is_correct': True}]}]}
    fixture.failures[question_url] = 503
    context, page = await fixture.context(browser)
    await page.goto(BASE + '/instructor/assessments'); await settled(page)
    assert not any(e['path'] == question_url for e in fixture.events)
    await page.get_by_role('heading', name='Synthetic editable assessment', exact=True).click()
    await page.get_by_text('Could not load questions and categories. Please try again.', exact=True).wait_for()
    # This editor has a title input separate from the list search field.
    title = page.locator('input[value="Synthetic editable assessment"]')
    await title.fill('Unsaved retry metadata')
    del fixture.failures[question_url]
    await page.get_by_role('button', name='Retry', exact=True).click()
    await page.get_by_text('Synthetic editable question', exact=True).wait_for()
    assert await page.locator('input[value="Unsaved retry metadata"]').count() == 1
    checks.append('Authorized question read is on demand; failure retry preserves metadata draft')
    await context.close()

    fixture = Fixture('instructor')
    context, page = await fixture.context(browser)
    await page.goto(BASE + '/instructor/assessment/create'); await settled(page)
    title = page.locator('input[type="text"]').first
    await title.fill('Unsaved synthetic upload')
    await page.evaluate("async () => { const { fetchWithDedup } = await import('/src/hooks/useApi.js'); await Promise.all([fetchWithDedup('/api/instructor/batches/'),fetchWithDedup('/api/instructor/assessments/'),fetchWithDedup('/api/categories/')]); }")
    assert await title.input_value() == 'Unsaved synthetic upload'
    checks.append('Assessment creation draft survives reference-data refresh')
    await context.close()

    fixture = Fixture('admin'); fixture.delays['/api/admin/companies/'] = 1.2
    context, page = await fixture.context(browser)
    await page.goto(BASE + '/admin/dashboard'); await settled(page)
    await fixture.started('/api/admin/companies/')
    other = await context.new_page()
    await other.goto(BASE + '/login')
    fixture.role = 'instructor'
    await other.evaluate('''values => { for(const [k,v] of Object.entries(values)) localStorage.setItem(k,v) }''',
        {'sb-token': 'synthetic-next-session', 'sb-role': 'instructor', 'sb-user': json.dumps(user('instructor'))})
    await page.wait_for_url('**/instructor/dashboard'); await settled(page)
    assert await page.get_by_role('link', name='Students', exact=True).is_visible()
    assert not await page.get_by_role('link', name='Users', exact=True).count()
    assert await page.evaluate("async () => { const { getCachedData } = await import('/src/hooks/useApi.js'); return getCachedData('/api/admin/stats/') === null }")
    checks.append('Cross-tab account switch cancels old work, clears cache and replaces role navigation')
    await context.close()

    fixture = Fixture('admin'); fixture.failures['/api/instructor/assessments/'] = 401
    context, page = await fixture.context(browser)
    await page.goto(BASE + '/admin/dashboard')
    await page.get_by_text('Session Expired', exact=True).wait_for()
    count = len(fixture.events)
    await page.wait_for_timeout(300)
    assert len(fixture.events) == count
    await page.get_by_role('button', name='Sign in again', exact=True).click()
    await page.wait_for_url('**/admin/login')
    checks.append('Expired optional request stops preparation and uses the existing session-expiry flow')
    await context.close()


async def main():
    checks, metrics = [], {}
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel='chrome', headless=True)
        await route_coverage(browser, checks)
        await loading_lifecycle(browser, checks, metrics)
        await hidden_logout(browser, checks)
        await positive_initial_lists(browser, checks)
        await forms_and_account_switch(browser, checks)
        await browser.close()
    result = {'environment': 'Synthetic local browser; no deployment timing', 'checks': checks, 'metrics': metrics}
    (ARTIFACTS / 'states.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result))


if __name__ == '__main__':
    asyncio.run(main())
