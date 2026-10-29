"""Responsive roster controls with synthetic reads only; no database or live services."""
import json
import os
import re
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright, expect
expect.set_options(timeout=15000)

BASE = os.environ.get('UI_TEST_BASE', 'http://127.0.0.1:5178')
OUT = Path(__file__).parent / 'artifacts' / 'student-roster-toolbar'
OUT.mkdir(parents=True, exist_ok=True)
ROWS = [dict(id=i, name=f'Sample Student {i:02d}', school_id=f'QA-{i:03d}',
             email=f'student{i}@example.invalid', course='BSIS' if i % 3 == 0 else 'BSIT',
             is_active=i != 13, all_required_completed=bool(i % 2),
             completed_required_count=i % 2, total_required_count=1,
             recommendations_locked=True, assessment_results=[], placement={'status': 'unplaced'})
        for i in range(1, 14)]
USER = dict(id=99, role='instructor', name='Sample Instructor', is_approved=True)
for row in ROWS:
    row['assessment_results'] = [dict(id=501, title='Sample assessment',
        attempt_status='stopped' if row['id'] == 4 else 'submitted' if row['id'] % 2 else 'in_progress',
        is_flagged=row['id'] in [5, 6], retake_allowed=row['id'] in [2, 9])]
    row['recommendations_locked'] = row['id'] not in [1, 3, 9, 11]
    row['top_recommendations'] = [dict(id=row['id'], company='Sample Partner', position='Sample Role', match_score=75)] if row['id'] in [1, 3, 9] else []
    if row['id'] in [4, 9]:
        row['placement'] = dict(status='approved', company={'name': 'Sample Partner'}, position={'title': 'Sample Intern'})
PREVIOUS = [dict(id=100+i, name='Former Student' if i == 1 else f'Former Student {i:02d}',
    school_id=f'PRE-{i:03d}', email=f'former{i}@example.invalid', course='BSIS' if i % 3 == 0 else 'BSIT',
    is_active=i != 13, removed_at='2026-10-27T02:00:00Z') for i in range(1, 14)]
errors, writes, checks = [], [], []


def route(request):
    url = urlparse(request.request.url)
    if url.hostname not in ('127.0.0.1', 'localhost') and not url.path.startswith('/api/'):
        return request.abort()
    if not url.path.startswith('/api/'):
        return request.continue_()
    if request.request.method != 'GET':
        writes.append(url.path)
        return request.fulfill(status=405, json={'error': 'Read-only fixture'})
    if url.path.endswith('/me/'):
        data = USER
    elif url.path.endswith('/batches/'):
        data = [dict(id=77, name='Sample Batch', status='active', student_count=len(ROWS)),
                dict(id=88, name='Other Batch', status='archived', student_count=1)]
    elif url.path.endswith('/students/'):
        data = dict(batch=dict(id=77, name='Sample Batch', status='active'), students=ROWS) if '/77/' in url.path else dict(
            batch=dict(id=88, name='Other Batch', status='archived'), students=[dict(ROWS[0], id=201, name='Other Batch Student')])
    elif url.path.endswith('/unenrolled/'):
        data = dict(batch=dict(id=77, name='Sample Batch', status='active'), students=PREVIOUS if '/77/' in url.path else [])
    elif url.path == '/api/placements/suggestions/':
        data = {'companies': [], 'eligible_students': []}
    elif url.path == '/api/placements/draft/':
        data = {'revision': 0, 'generated': False, 'stale': False, 'proposed_counts': {}, 'students': []}
    elif url.path == '/api/placements/':
        data = {'placements': []}
    elif url.path == '/api/placements/reports/':
        data = {'records': [], 'summary': {}}
    elif url.path.endswith('/email-progress/'):
        data = {'storage_ready': True, 'groups': []}
    else:
        data = []
    return request.fulfill(json=data)


def visit(browser, width, dark=False):
    context = browser.new_context(viewport={'width': width, 'height': 1000}, reduced_motion='reduce')
    values = {'sb-token': 'synthetic-only', 'sb-role': 'instructor', 'sb-user': json.dumps(USER),
              'sb-theme': 'dark' if dark else 'light'}
    context.add_init_script('for (const [k,v] of Object.entries(' + json.dumps(values) + ')) localStorage.setItem(k,v);window.EventSource=class{close(){}};')
    context.route('**/*', route)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('console', lambda message: errors.append(message.text) if message.type == 'error' and 'same key' in message.text else None)
    page.goto(BASE + '/instructor/students'); page.wait_for_load_state('networkidle')
    toolbar = page.get_by_role('region', name='Student filters', exact=True)
    expect(page.locator('.sp-card:visible')).to_have_count(10)
    return context, page, toolbar



def open_filters(page, toolbar):
    toolbar.get_by_role('button', name=re.compile(r'^Filters')).click()
    panel = page.get_by_role('dialog', name='Student filter options', exact=True)
    expect(panel).to_be_visible()
    return panel


def choose(panel, group, option):
    panel.get_by_role('group', name=group, exact=True).get_by_text(option, exact=True).click()


def apply(panel, expected):
    try:
        panel.get_by_role('button', name=f'Show {expected} {"student" if expected == 1 else "students"}', exact=True).click()
    except Exception:
        print(f'Expected preview {expected}; panel count {panel.count()}', flush=True)
        if panel.count(): print(panel.inner_text(), flush=True)
        raise
    expect(panel).to_have_count(0)


def check_layouts(browser):
    for width, height in [(320,568), (375,812), (768,1024), (1024,768), (1440,1000), (812,375)]:
        if os.environ.get('UI_TEST_WIDTH') and width != int(os.environ['UI_TEST_WIDTH']): continue
        for dark in [False, True]:
            if os.environ.get('UI_TEST_DARK') and str(dark) != os.environ['UI_TEST_DARK']: continue
            context, page, toolbar = visit(browser, width, dark)
            page.set_viewport_size({'width': width, 'height': height})
            search = toolbar.get_by_label('Search students', exact=True)
            expect(toolbar.get_by_role('status')).to_have_text('13 of 13 students')
            assert abs(search.bounding_box()['height'] - 38) < 1
            toolbar.screenshot(path=str(OUT/f'grouped-toolbar-{width}-{"dark" if dark else "light"}.png'), animations='disabled')
            if width >= 640:
                assert toolbar.get_by_role('button', name='Show student cards').bounding_box()['height'] == 26
            panel = open_filters(page, toolbar)
            expect(panel.get_by_role('group')).to_have_count(5)
            for group in panel.get_by_role('group').all():
                expect(group.locator('input:checked')).to_have_count(1)
            assert not panel.locator('select').count()
            assert panel.locator('.sb-roster-filter-chip').first.bounding_box()['height'] == 28
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            assert panel.evaluate('(el) => el.scrollWidth <= el.clientWidth + 1')
            footer = panel.locator('footer').bounding_box()
            header = panel.locator('header').bounding_box()
            assert header['y'] >= -1 and footer['y'] + footer['height'] <= height + 1, (width,height,header,footer)
            if width < 640 or height <= 540:
                expect(page.locator('.sb-roster-filter-sheet')).to_be_visible()
                assert abs(panel.bounding_box()['y'] + panel.bounding_box()['height'] - height) < 2
            else:
                expect(page.locator('.sb-roster-filter-popover')).to_be_visible()
            page.screenshot(path=str(OUT/f'grouped-open-{width}-{"dark" if dark else "light"}.png'), animations='disabled')
            choose(panel, 'Course', 'BSIS')
            expect(panel.get_by_role('button', name='Show 4 students', exact=True)).to_be_enabled()
            expect(page.locator('.sb-roster-secondary [role=status]')).to_have_text('13 of 13 students')
            page.keyboard.press('Escape')
            expect(panel).to_have_count(0)
            expect(toolbar.get_by_role('button', name='Filters', exact=True)).to_be_focused()
            panel = open_filters(page, toolbar)
            expect(panel.get_by_role('group', name='Course', exact=True).get_by_role('radio', name='All courses', exact=True)).to_be_checked()
            choose(panel, 'Course', 'BSIS')
            choose(panel, 'Assessment status', 'Complete')
            choose(panel, 'Recommendation status', 'Awaiting review')
            apply(panel, 1)
            expect(toolbar.get_by_role('button', name='Filters (3)', exact=True)).to_be_focused()
            expect(toolbar.get_by_role('status')).to_have_text('1 of 13 students')
            expect(page.locator('.sp-card:visible')).to_have_attribute('data-student-id', '3')
            if width >= 640:
                toolbar.get_by_role('button', name='Show student list').click()
                expect(page.locator('tbody tr:visible')).to_have_count(1)
                expect(page.locator('tbody tr:visible')).to_contain_text('Sample Student 03')
                toolbar.get_by_role('button', name='Show student cards').click()
            toolbar.get_by_role('button', name='Clear filters', exact=True).click()
            page.get_by_role('button', name='2', exact=True).click()
            expect(page.locator('.sp-card:visible')).to_have_count(3)
            panel = open_filters(page, toolbar)
            choose(panel, 'Assessment status', 'Complete')
            apply(panel, 7)
            expect(page.locator('.sp-card:visible')).to_have_count(7)
            toolbar.get_by_role('button', name='Clear filters', exact=True).click()
            search.fill('  QA-002  ')
            expect(page.locator('.sp-card:visible')).to_have_attribute('data-student-id', '2')
            panel = open_filters(page, toolbar)
            panel.get_by_role('button', name='Clear filters', exact=True).click()
            apply(panel, 13)
            expect(search).to_have_value('')
            panel = open_filters(page, toolbar)
            choose(panel, 'Enrollment', 'Previously unenrolled')
            expect(panel.get_by_role('group', name='Assessment status', exact=True).get_by_role('radio', name='Complete', exact=True)).to_be_disabled()
            expect(panel.get_by_role('group', name='Recommendation status', exact=True).get_by_role('radio', name='Available', exact=True)).to_be_disabled()
            choose(panel, 'Course', 'BSIS')
            apply(panel, 4)
            previous = page.get_by_role('region', name='Previously unenrolled students', exact=True)
            expect(previous.locator('article:visible')).to_have_count(4)
            expect(toolbar.get_by_role('status')).to_have_text('4 of 13 students')
            toolbar.get_by_role('button', name='Clear filters', exact=True).click()
            expect(previous).to_have_count(0)
            expect(page.locator('.sp-card:visible')).to_have_count(10)
            checks.append(f'{width}x{height} {dark=}: compact sizing, panel/sheet bounds, staged apply/cancel, pagination, search reset and previous-enrollment scope')
            print(checks[-1], flush=True)
            context.close()


def check_keyboard(browser):
    context, page, toolbar = visit(browser, 1440)
    trigger = toolbar.get_by_role('button', name='Filters', exact=True)
    trigger.focus(); page.keyboard.press('Enter')
    panel = page.get_by_role('dialog', name='Student filter options')
    course = panel.get_by_role('group', name='Course', exact=True)
    course.get_by_role('radio', name='All courses', exact=True).focus()
    page.keyboard.press('ArrowRight')
    expect(course.get_by_role('radio', name='BSIT', exact=True)).to_be_checked()
    expect(course.locator('input:checked')).to_have_count(1)
    for _ in range(18):
        page.keyboard.press('Tab')
        assert panel.evaluate('el => el.contains(document.activeElement)'), 'Focus left the open filter dialog'
    panel.get_by_role('button', name='Close filters').click()
    expect(trigger).to_be_focused()
    panel = open_filters(page, toolbar)
    # React Aria's outside interaction dismisses without applying draft changes.
    choose(panel, 'Course', 'BSIS')
    page.mouse.click(10, 10)
    expect(panel).to_have_count(0)
    expect(toolbar.get_by_role('status')).to_have_text('13 of 13 students')
    page.get_by_label('Selected batch', exact=True).select_option('88')
    expect(toolbar.get_by_role('status')).to_have_text('1 of 1 student')
    expect(page.locator('.sp-card:visible')).to_contain_text('Other Batch Student')
    page.get_by_label('Selected batch', exact=True).select_option('77')
    expect(toolbar.get_by_role('status')).to_have_text('13 of 13 students')
    checks.append('Native radio arrows, one choice per group, trapped dialog focus, close/outside cancellation and focus restoration')
    print(checks[-1], flush=True)
    context.close()


def check_previous_error(browser):
    context, page, toolbar = visit(browser, 1440)
    failing = [True]
    def previous(route):
        if failing[0]: return route.fulfill(status=503, json={'error': 'Synthetic failure'})
        return route.fulfill(json={'batch': {'id': 77, 'name': 'Sample Batch', 'status': 'active'}, 'students': PREVIOUS})
    context.route(re.compile(r'.*/api/instructor/batches/77/unenrolled/(?:\?.*)?$'), previous)
    panel = open_filters(page, toolbar)
    choose(panel, 'Enrollment', 'Previously unenrolled')
    expect(panel.get_by_role('alert')).to_contain_text('Could not load')
    expect(panel.get_by_role('button', name='Students unavailable', exact=True)).to_be_disabled()
    failing[0] = False
    panel.get_by_role('button', name='Retry', exact=True).click()
    apply(panel, 13)
    expect(toolbar.get_by_role('status')).to_have_text('13 of 13 students')
    expect(page.get_by_role('region', name='Previously unenrolled students').locator('article:visible')).to_have_count(10)
    checks.append('Previous-enrollment load failure blocks Apply; Retry refreshes shared preview and collection data')
    print(checks[-1], flush=True)
    context.close()


def check_combinations(browser):
    assessment = {'All': set(range(1,14)), 'Complete': {1,3,5,7,9,11,13}, 'Incomplete': {2,4,6,8,10,12}, 'Stopped / flagged': {4,5,6}, 'Retake approved': {2,9}}
    recommendation = {'All': set(range(1,14)), 'Available': {1,3,9}, 'Awaiting review': {1,3}, 'Approved decision': {4,9}}
    courses = {'All courses': set(range(1,14)), 'BSIT': {1,2,4,5,7,8,10,11,13}, 'BSIS': {3,6,9,12}}
    accounts = {'All accounts': set(range(1,14)), 'Active': set(range(1,13)), 'Archived': {13}}
    for width, view in [(375,'grid'), (1440,'grid'), (1440,'list')]:
        if os.environ.get('UI_TEST_VIEW') and view != os.environ['UI_TEST_VIEW']: continue
        context, page, toolbar = visit(browser, width)
        if view == 'list': toolbar.get_by_role('button', name='Show student list').click()
        for a, a_ids in assessment.items():
            for r, r_ids in recommendation.items():
                for c, c_ids in courses.items():
                    for account, account_ids in accounts.items():
                        expected = sorted(a_ids & r_ids & c_ids & account_ids)
                        panel = open_filters(page, toolbar)
                        choose(panel, 'Course', c); choose(panel, 'Account status', account)
                        choose(panel, 'Assessment status', a); choose(panel, 'Recommendation status', r)
                        try:
                            apply(panel, len(expected))
                            expect(toolbar.get_by_role('status')).to_have_text(f'{len(expected)} of 13 students')
                        except Exception:
                            print(json.dumps({'width': width, 'view': view, 'assessment': a, 'recommendation': r, 'course': c, 'account': account, 'toolbar': toolbar.inner_text()}), flush=True)
                            page.screenshot(path=str(OUT/'grouped-matrix-failure.png'))
                            raise
                        records = page.locator('.sp-card:visible') if view == 'grid' else page.locator('tbody tr:visible')
                        expect(records).to_have_count(min(10,len(expected)))
                        if view == 'grid':
                            actual = [int(value) for value in records.evaluate_all('els => els.map(el => el.dataset.studentId)')]
                            assert actual == expected[:10]
                        elif expected:
                            assert records.locator('td:first-child p.font-medium').all_text_contents() == [f'Sample Student {i:02d}' for i in expected[:10]]
                        else:
                            expect(page.get_by_text('No students match these filters.', exact=True)).to_be_visible()
        # Previous-enrollment dimensions use the same radio panel and preview.
        for c, c_ids in courses.items():
            for account, account_ids in accounts.items():
                expected = sorted(c_ids & account_ids)
                panel = open_filters(page, toolbar)
                choose(panel, 'Enrollment', 'Previously unenrolled')
                choose(panel, 'Course', c); choose(panel, 'Account status', account)
                apply(panel, len(expected))
                previous = page.get_by_role('region', name='Previously unenrolled students', exact=True)
                records = previous.locator('article:visible') if view == 'grid' else previous.locator('tbody tr:visible')
                expect(records).to_have_count(min(10,len(expected)))
                assert records.locator('strong').all_text_contents() == ['Former Student' if i == 1 else f'Former Student {i:02d}' for i in expected[:10]]
        checks.append(f'{width}px {view}: 180 enrolled and 9 previous-enrollment combinations, preview counts and exact identities')
        print(checks[-1], flush=True)
        context.close()


with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    try:
        scope = os.environ.get('UI_TEST_SCOPE', 'all')
        if scope in ['all', 'layout']:
            check_layouts(browser)
            check_keyboard(browser)
        if scope in ['all', 'error']: check_previous_error(browser)
        if scope in ['all', 'matrix']: check_combinations(browser)
        assert not errors, errors
        assert not writes, writes
    finally:
        browser.close()
        (OUT/f'grouped-{scope}-results.json').write_text(json.dumps(dict(checks=checks, errors=errors, writes=writes), indent=2))
