"""Cold route skeletons and code preparation with a deliberately held API read."""
import asyncio
import json
import sys
import time
from pathlib import Path
from playwright.async_api import async_playwright, expect
from loading_playwright import analytics, BASE
from navigation_states_playwright import Fixture

OUT = Path(__file__).parent / 'artifacts/loading'
BASELINE = '--baseline' in sys.argv


async def cold_routes(browser, checks):
    cases = [
        ('admin', 'assessment/create', 'instructor/InstructorUpload.jsx', 'New assessment'),
        ('admin', 'reports?tab=skills', 'admin/AdminReports.jsx', 'Reports & Analytics'),
        ('instructor', 'dashboard', 'instructor/InstructorDashboard.jsx', 'Student performance'),
        ('student', 'profile', 'student/StudentProfile.jsx', 'My profile'),
    ]
    for width in [360, 1440]:
        for role, path, module, title in cases:
            print(f'Checking cold {role}/{path} at {width}px', flush=True)
            fixture = Fixture(role)
            fixture.values['/api/management/analytics/'] = analytics(role)
            context, page = await fixture.context(browser)
            await page.set_viewport_size({'width': width, 'height': 950})

            async def delayed_code(route):
                await asyncio.sleep(2)
                await route.continue_()

            await context.route('**/src/pages/' + module + '*', delayed_code)
            await page.goto(BASE + f'/{role}/{path}', wait_until='domcontentloaded')
            fallback = page.locator('.sk-route-page')
            await expect(fallback).to_be_visible()
            await expect(page.get_by_text('Loading page…', exact=True)).to_have_count(0)
            assert await page.locator('.sk-route-indicator').count() == 0
            assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (role, path, width, await page.evaluate('''() => [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0,6).map(el => ({tag:el.tagName, cls:el.className, width:el.getBoundingClientRect().width}))'''))
            if path == 'assessment/create' or path == 'profile':
                assert await fallback.locator('.sk-stats,.sk-table').count() == 0
            if 'tab=skills' in path:
                await expect(fallback.get_by_role('heading', name='Skill results by category')).to_be_visible()
            await page.screenshot(path=str(OUT / f'cold-{role}-{path.split("?")[0].replace("/", "-")}-{width}.png'), full_page=True)
            await expect(page.get_by_role('heading', name=title, exact=True)).to_be_visible()
            await expect(fallback).to_have_count(0)
            assert not fixture.errors, fixture.errors
            checks.append(f'{role}/{path} at {width}px: matching skeleton while code is held, no indicator, successful handoff')
            await context.close()


async def intent_preparation(browser):
    fixture = Fixture('instructor')
    fixture.values['/api/management/analytics/'] = analytics('instructor')
    fixture.delays['/api/management/analytics/'] = 4
    fixture.delays['/api/instructor/students/recommendations/'] = 4
    context, page = await fixture.context(browser)
    code_requests = []
    page.on('request', lambda request: code_requests.append(time.perf_counter()) if '/src/pages/reports/ReportsAnalytics.jsx' in request.url else None)
    await page.goto(BASE + '/instructor/dashboard', wait_until='domcontentloaded')
    await expect(page.get_by_role('heading', name='Student performance', exact=True)).to_be_visible()
    link = page.get_by_role('link', name='Reports & Analytics', exact=True)
    before = len(fixture.events)
    hovered = time.perf_counter()
    await link.hover()
    await asyncio.sleep(.6)
    prepared = bool(code_requests)
    during_read = any(event['end'] is None for event in fixture.events)
    assert len(fixture.events) == before, 'Code preparation must not add data GETs'
    if not BASELINE:
        assert prepared and during_read, 'Page code still waits for foreground data'
    clicked = time.perf_counter()
    await link.click()
    await expect(page.get_by_role('heading', name='Reports & Analytics', exact=True)).to_be_visible()
    result = {'synthetic_api_delay_ms': 4000, 'prepared_before_click': prepared,
        'code_started_while_data_pending': prepared and during_read,
        'hover_to_code_request_ms': round((code_requests[0] - hovered) * 1000, 1),
        'click_to_report_heading_ms': round((time.perf_counter() - clicked) * 1000, 1),
        'analytics_gets': len([event for event in fixture.events if event['path'] == '/api/management/analytics/'])}
    assert result['analytics_gets'] == 1, result
    assert not fixture.errors, fixture.errors
    await context.close()
    return result


async def main():
    checks = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel='chrome', headless=True)
        if not BASELINE and '--intent-only' not in sys.argv:
            await cold_routes(browser, checks)
        result = await intent_preparation(browser)
        await browser.close()
    OUT.mkdir(parents=True, exist_ok=True)
    result['checks'] = checks
    (OUT / ('code-baseline.json' if BASELINE else 'code-updated.json')).write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    asyncio.run(main())
