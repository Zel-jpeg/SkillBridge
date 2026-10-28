"""Delayed read, responsive placeholder and warm-refresh checks; synthetic data only."""
import asyncio
import json
import os
from pathlib import Path
from urllib.parse import urlparse
from playwright.async_api import async_playwright, expect
import navigation_states_playwright as navigation

BASE = os.environ.get('SKELETON_BASE', 'http://127.0.0.1:5196')
OUT = Path(__file__).parent / 'artifacts/loading'
OUT.mkdir(parents=True, exist_ok=True)
navigation.BASE = BASE


def analytics(role):
    return {
        'role': role, 'generated_at': '2026-10-26T03:00:00Z',
        'summary': {key: 0 for key in ['students', 'required_complete', 'approved', 'approved_other_batch', 'unplaced', 'awaiting_review', 'needs_followup', 'slots_remaining', 'slots_occupied', 'slots_total']},
        'scope': {'batch_ids': [], 'batch_status': 'active', 'cohort_unit': 'students', 'activity_period': 'monthly', 'activity_interval': 'day', 'activity_from': '2026-10-01', 'activity_to': '2026-10-26'},
        'options': {key: [] for key in ['batches', 'instructors', 'courses', 'assessments', 'companies', 'positions', 'areas']},
        **{key: [] for key in ['students', 'placement_students', 'assessments', 'batches', 'skills', 'capacity', 'match_bands', 'companies', 'areas', 'geography', 'activity', 'activity_days']},
    }


async def presentation(browser, checks):
    context = await browser.new_context(reduced_motion='reduce')
    page = await context.new_page()
    gate, requests = asyncio.Event(), []
    revision, fail = 1, False

    async def request(route):
        requests.append(route.request.url)
        await asyncio.wait_for(gate.wait(), timeout=15)
        await route.fulfill(status=503 if fail else 200, json={'error': 'Synthetic unavailable'} if fail else {'revision': revision}, headers={'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS'})

    await context.route(lambda url: urlparse(url).path.startswith('/api/'), request)
    print('Checking section loading lifecycle', flush=True)
    await page.goto(BASE + '/tests/loading/index.html', wait_until='domcontentloaded')
    await expect(page.get_by_role('status', name='Loading example students')).to_be_visible()
    await expect(page.get_by_role('heading', name='Existing section heading')).to_be_visible()
    await page.get_by_role('textbox', name='Search students').fill('Keep this search')
    gate.set()
    await expect(page.locator('#loaded-value')).to_have_text('Loaded revision 1')
    gate.clear()
    revision = 2
    await page.get_by_role('textbox', name='Retained draft').fill('Unsaved local draft')
    await page.get_by_role('button', name='Refresh example').click()
    await expect(page.locator('#loaded-value')).to_have_text('Loaded revision 1')
    await expect(page.get_by_role('status', name='Loading example students')).to_have_count(0)
    gate.set()
    await expect(page.locator('#loaded-value')).to_have_text('Loaded revision 2')
    await expect(page.get_by_role('textbox', name='Retained draft')).to_have_value('Unsaved local draft')
    fail = True
    await page.get_by_role('button', name='Refresh example').click()
    await expect(page.get_by_text('Could not refresh. Showing the last loaded data.')).to_be_visible()
    await expect(page.locator('#loaded-value')).to_have_text('Loaded revision 2')
    fail = False
    revision = 3
    await page.get_by_role('button', name='Retry').click()
    await expect(page.locator('#loaded-value')).to_have_text('Loaded revision 3')
    await expect(page.get_by_role('textbox', name='Search students')).to_have_value('Keep this search')
    assert len(requests) == 4, requests
    checks.append('Initial boundary, retained controls/draft, silent refresh, background error and retry; no extra loader requests')
    layouts = await page.get_by_role('combobox', name='Preview loader').locator('option').all_text_contents()
    for width in [360, 768, 1440]:
        print(f'Checking placeholder layouts at {width}px', flush=True)
        await page.set_viewport_size({'width': width, 'height': 1000})
        for dark in [False, True]:
            await page.evaluate('(dark) => document.documentElement.classList.toggle("dark", dark)', dark)
            for layout in layouts:
                await page.get_by_role('combobox', name='Preview loader').select_option(layout)
                assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (layout, width, dark)
                assert await page.locator('#preview').get_by_role('status').count() >= 1
                assert await page.locator('#preview').locator('button,input,select,a').count() == 0
                assert await page.locator('#preview .sk-block').evaluate_all('els => els.every(el => getComputedStyle(el).animationName === "none")')
            await page.get_by_role('combobox', name='Preview loader').select_option('student-table')
            await expect(page.locator('#preview .sk-mobile-cards')).to_be_visible() if width < 640 else await expect(page.locator('#preview .sk-desktop-table')).to_be_visible()
            await page.screenshot(path=str(OUT / f'list-{width}-{"dark" if dark else "light"}.png'), full_page=True)
    checks.append(f'{len(layouts)} loaders at phone/tablet/desktop widths in both themes; overflow, card fallback, semantics and reduced motion')
    await context.close()


async def routes(browser, checks):
    cases = {
        'admin': [('dashboard', 'Admin Dashboard'), ('users', 'User Management'), ('batches', 'Batches & students'), ('skills', 'Skill Taxonomy'), ('assessments', 'Assessment oversight'), ('reports', 'Reports & Analytics'), ('placements', 'OJT Placement Management'), ('assessment/create', 'New assessment')],
        'instructor': [('dashboard', 'Student performance'), ('students', 'Enrolled students'), ('assessments', 'Assessments'), ('companies', 'OJT Partners'), ('reports', 'Reports & Analytics'), ('assessment/create', 'New assessment')],
        'student': [('profile', 'My profile'), ('assessments', 'Skills Assessments')],
    }
    for role, paths in cases.items():
        for suffix, heading in paths:
            print(f'Checking {role}/{suffix}', flush=True)
            fixture = navigation.Fixture(role)
            fixture.values['/api/management/analytics/'] = analytics(role)
            fixture.values['/api/student/results/combined/'] = {'recommendations_locked': True, 'has_required_assessments': False, 'recommendations': [], 'combined_category_scores': []}
            fixture.values['/api/placements/draft/'] = {'revision': 0, 'generated': True, 'stale': False, 'proposed_counts': {}, 'students': []}
            fixture.values['/api/admin/assessments/'] = {'assessments': [], 'totals': {}, 'summary': {}}
            delayed = ['/api/management/analytics/', '/api/admin/users/', '/api/admin/batches/', '/api/admin/skills/', '/api/admin/assessments/', '/api/instructor/students/recommendations/', '/api/admin/students/recommendations/', '/api/instructor/batches/', '/api/instructor/assessments/', '/api/instructor/companies/', '/api/students/me/', '/api/assessments/', '/api/categories/', '/api/placements/suggestions/', '/api/placements/draft/']
            fixture.delays = dict.fromkeys(delayed, 1.8)
            context, page = await fixture.context(browser)
            await page.set_viewport_size({'width': 1440, 'height': 1000})
            await page.goto(BASE + f'/{role}/{suffix}')
            await page.locator('.sb-skeleton').first.wait_for()
            # Heading is actual page content, not a skeleton placeholder.
            if suffix == 'assessments' and role == 'admin':
                await expect(page.locator('h1')).to_be_visible()
            else:
                await expect(page.get_by_role('heading', name=heading, exact=True)).to_be_visible()
            if suffix == 'users':
                await expect(page.get_by_role('button', name='Show cards', exact=True)).to_be_visible()
                await expect(page.get_by_role('status', name='Loading instructor requests')).to_have_count(0)
                await page.get_by_role('button', name='Show list', exact=True).click()
                await expect(page.locator('.sb-skeleton-user-table,.sb-skeleton-student-table')).to_be_visible()
            if suffix == 'reports':
                await expect(page.get_by_role('region', name='Report scope')).to_be_visible()
                await expect(page.get_by_role('navigation', name='Analytics sections')).to_be_visible()
            await page.screenshot(path=str(OUT / f'{role}-{suffix.replace("/", "-")}-loading.png'), full_page=True)
            await page.wait_for_timeout(2100)
            await expect(page.locator('.sb-skeleton')).to_have_count(0)
            assert not fixture.errors, (role, suffix, fixture.errors)
            assert not await page.get_by_text('Something went wrong', exact=True).count(), (role, suffix)
            checks.append(f'{role}/{suffix}: persistent heading, section load and settled render')
            await context.close()


async def main():
    checks = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel='chrome', headless=True)
        await presentation(browser, checks)
        await routes(browser, checks)
        await browser.close()
    (OUT / 'results.json').write_text(json.dumps(checks, indent=2), encoding='utf-8')
    print(json.dumps(checks, indent=2))


if __name__ == '__main__':
    asyncio.run(main())
