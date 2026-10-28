"""Responsive roster controls with synthetic reads only; no database or live services."""
import json
import os
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright, expect

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
        is_flagged=row['id'] == 6, retake_allowed=row['id'] in [2, 9])]
    row['recommendations_locked'] = row['id'] not in [1, 3, 9, 11]
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
    elif url.path.endswith('/email-progress/'):
        data = {'storage_ready': True, 'groups': []}
    else:
        data = []
    return request.fulfill(json=data)


def check_all_filters(browser):
    # Expected memberships are independent, explicit fixtures rather than the UI's predicates.
    status_ids = {'All': set(range(1, 14)), 'Complete': {1, 3, 5, 7, 9, 11, 13},
        'In progress': {2, 8, 10, 12}, 'Stopped / flagged': {4, 6},
        'Retake approved': {2, 9}, 'Recommendations unlocked': {1, 3, 9, 11},
        'Unplaced': {1, 2, 3, 5, 6, 7, 8, 10, 11, 12, 13}, 'Placed': {4, 9}}
    course_ids = {'All courses': set(range(1, 14)), 'BSIT': {1, 2, 4, 5, 7, 8, 10, 11, 13}, 'BSIS': {3, 6, 9, 12}}
    account_ids = {'all': set(range(1, 14)), 'active': set(range(1, 13)), 'archived': {13}}
    for width in [375, 1440]:
        context = browser.new_context(viewport={'width': width, 'height': 1000}, reduced_motion='reduce')
        context.add_init_script('localStorage.setItem("sb-token","synthetic-only");'
            'localStorage.setItem("sb-role","instructor");localStorage.setItem("sb-user",'
            + json.dumps(json.dumps(USER)) + ');window.EventSource=class{close(){}};')
        context.route('**/*', route)
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('console', lambda message: errors.append(message.text) if message.type == 'error' and 'same key' in message.text else None)
        page.goto(BASE + '/instructor/students')
        page.wait_for_load_state('networkidle')
        toolbar = page.get_by_role('region', name='Student filters', exact=True)
        course = toolbar.get_by_role('group', name='Course', exact=True)
        search = toolbar.get_by_label('Search students', exact=True)
        for view in (['grid', 'list'] if width == 1440 else ['grid']):
            if view == 'list': toolbar.get_by_role('button', name='Show student list').click()
            for label, members in status_ids.items():
                toolbar.get_by_role('button', name=label, exact=True).click()
                for course_label, course_members in course_ids.items():
                    course.get_by_role('button', name=course_label, exact=True).click()
                    for account, account_members in account_ids.items():
                        toolbar.get_by_label('Account status', exact=True).select_option(account)
                        expected = sorted(members & course_members & account_members)
                        expect(toolbar.get_by_role('status')).to_have_text(f'{len(expected)} student' + ('' if len(expected) == 1 else 's'))
                        if view == 'grid':
                            cards = page.locator('.sp-card:visible')
                            expect(cards).to_have_count(min(10, len(expected)))
                            actual = [int(value) for value in cards.evaluate_all('(els) => els.map(el => el.dataset.studentId)')]
                            assert actual == expected[:10], (label, course_label, account, actual, expected)
                        else:
                            rows = page.locator('tbody tr:visible')
                            expect(rows).to_have_count(min(10, len(expected)))
                            actual = rows.locator('td:first-child p:first-child').all_text_contents()
                            assert actual == [f'Sample Student {i:02d}' for i in expected[:10]], (label, course_label, account, actual, expected)
            checks.append(f'{width}px {view}: all 72 progress/course/account combinations and exact student membership')
            print(checks[-1], flush=True)
        toolbar.get_by_label('Account status', exact=True).select_option('all')
        course.get_by_role('button', name='All courses', exact=True).click()
        toolbar.get_by_role('button', name='All', exact=True).click()
        if width == 1440: toolbar.get_by_role('button', name='Show student cards').click()
        for query, expected in [('Sample Student 02', 2), ('QA-003', 3), ('STUDENT4@EXAMPLE.INVALID', 4), ('  QA-005  ', 5)]:
            search.fill(query)
            expect(page.locator('.sp-card:visible'), f'Search query: {query!r}').to_have_count(1)
            expect(page.locator('.sp-card:visible')).to_have_attribute('data-student-id', str(expected))
        search.fill('')
        page.get_by_label('Selected batch', exact=True).select_option('88')
        expect(page.locator('.sp-card:visible')).to_have_count(1)
        expect(page.locator('.sp-card:visible')).to_contain_text('Other Batch Student')
        page.get_by_label('Selected batch', exact=True).select_option('77')
        expect(page.locator('.sp-card:visible')).to_have_count(10)
        toolbar.get_by_label('Enrollment', exact=True).select_option('unenrolled')
        panel = page.get_by_role('region', name='Previously unenrolled students', exact=True)
        for previous_view in (['grid', 'list'] if width == 1440 else ['grid']):
            if previous_view == 'list': toolbar.get_by_role('button', name='Show student list').click()
            for course_label, course_members in course_ids.items():
                course.get_by_role('button', name=course_label, exact=True).click()
                for account, account_members in account_ids.items():
                    toolbar.get_by_label('Account status', exact=True).select_option(account)
                    expected = sorted(course_members & account_members)
                    expect(panel.get_by_role('status')).to_have_text(f'{len(expected)} previously unenrolled students')
                    records = panel.locator('article:visible') if previous_view == 'grid' else panel.locator('tbody tr:visible')
                    expect(records).to_have_count(min(10, len(expected)))
                    actual = records.locator('strong').all_text_contents()
                    assert actual == ['Former Student' if i == 1 else f'Former Student {i:02d}' for i in expected[:10]], (previous_view, course_label, account, actual, expected)
        if width == 1440: toolbar.get_by_role('button', name='Show student cards').click()
        toolbar.get_by_label('Account status', exact=True).select_option('all')
        course.get_by_role('button', name='All courses', exact=True).click()
        panel.get_by_role('button', name='2', exact=True).click()
        search.fill(' PRE-001 ')
        expect(panel.locator('article:visible')).to_have_count(1)
        expect(panel.locator('article:visible')).to_contain_text('Former Student')
        search.fill('former2@example.invalid')
        expect(panel.locator('article:visible')).to_have_count(1)
        expect(panel.locator('article:visible')).to_contain_text('Former Student 02')
        search.fill('')
        toolbar.get_by_label('Enrollment', exact=True).select_option('enrolled')
        expect(page.locator('.sp-card:visible')).to_have_count(10)
        checks.append(f'{width}px: name/ID/email/case/trim search, batch scoping, previous enrollment filters and page reset')
        print(checks[-1], flush=True)
        context.close()


with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    try:
        for width in [320, 375, 768, 1024, 1440]:
            for dark in [False, True]:
                context = browser.new_context(viewport={'width': width, 'height': 1000}, reduced_motion='reduce')
                context.add_init_script('localStorage.setItem("sb-token","synthetic-only");'
                    'localStorage.setItem("sb-role","instructor");localStorage.setItem("sb-user",'
                    + json.dumps(json.dumps(USER)) + ');window.EventSource=class{close(){}};')
                context.route('**/*', route)
                page = context.new_page()
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.on('console', lambda message: errors.append(message.text) if message.type == 'error' and 'same key' in message.text else None)
                page.goto(BASE + '/instructor/students')
                page.wait_for_load_state('networkidle')
                page.evaluate('(dark) => document.documentElement.classList.toggle("dark", dark)', dark)
                toolbar = page.get_by_role('region', name='Student filters', exact=True)
                expect(page.locator('.sp-card:visible')).to_have_count(10)
                for label in ['Search students', 'Enrollment', 'Account status']:
                    expect(toolbar.get_by_label(label, exact=True)).to_be_visible()
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (width, dark)
                assert toolbar.evaluate('(el) => el.scrollWidth <= el.clientWidth + 1'), (width, dark)
                boxes = [toolbar.get_by_label(label, exact=True).bounding_box()
                         for label in ['Search students', 'Enrollment', 'Account status']]
                if width == 1440:
                    assert max(b['y'] for b in boxes) - min(b['y'] for b in boxes) < 2, boxes
                if width <= 375:
                    assert boxes[2]['y'] > boxes[1]['y'] > boxes[0]['y'], boxes
                if width == 768:
                    assert abs(boxes[1]['y'] - boxes[2]['y']) < 2, boxes
                toolbar.screenshot(path=str(OUT / f'toolbar-{width}-{"dark" if dark else "light"}.png'))
                # Changing filters from a later page returns to the first matching page.
                page.get_by_role('button', name='2', exact=True).click()
                expect(page.locator('.sp-card:visible')).to_have_count(3)
                toolbar.get_by_label('Account status', exact=True).select_option('archived')
                expect(page.locator('.sp-card:visible')).to_have_count(1)
                expect(page.locator('.sp-card:visible')).to_contain_text('Sample Student 13')
                expect(toolbar.get_by_role('status')).to_have_text('1 student')
                toolbar.get_by_label('Account status', exact=True).select_option('all')
                course = toolbar.get_by_role('group', name='Course', exact=True)
                course.get_by_role('button', name='BSIS', exact=True).click()
                expect(page.locator('.sp-card:visible')).to_have_count(4)
                toolbar.get_by_role('button', name='Complete', exact=True).click()
                expect(page.locator('.sp-card:visible')).to_have_count(2)
                if width >= 640:
                    toolbar.get_by_role('button', name='Show student list').click()
                    expect(page.locator('tbody tr:visible')).to_have_count(2)
                    expect(course.get_by_role('button', name='BSIS', exact=True)).to_have_attribute('aria-pressed', 'true')
                    toolbar.get_by_role('button', name='Show student cards').click()
                course.get_by_role('button', name='All courses', exact=True).click()
                toolbar.get_by_label('Enrollment', exact=True).select_option('unenrolled')
                expect(page.get_by_role('region', name='Previously unenrolled students')).to_contain_text('Former Student')
                expect(toolbar.get_by_role('button', name='Complete', exact=True)).to_have_count(0)
                toolbar.get_by_label('Enrollment', exact=True).select_option('enrolled')
                expect(page.locator('.sp-card:visible')).to_have_count(10)
                expect(toolbar.get_by_role('button', name='All', exact=True)).to_have_attribute('aria-pressed', 'true')
                search = toolbar.get_by_label('Search students', exact=True)
                search.focus()
                page.keyboard.type('QA-002')
                expect(page.locator('.sp-card:visible')).to_have_count(1)
                expect(toolbar.get_by_role('status')).to_have_text('1 student')
                search.fill('no-match')
                expect(page.get_by_text('No students match your search.', exact=True)).to_be_visible()
                page.get_by_role('button', name='Clear filters', exact=True).click()
                expect(page.locator('.sp-card:visible')).to_have_count(10)
                checks.append(f'{width}px {"dark" if dark else "light"}: layout, filters, pagination, views, enrollment, keyboard search and empty recovery')
                print(checks[-1], flush=True)
                context.close()
        check_all_filters(browser)
        assert not errors, errors
        assert not writes, writes
    finally:
        browser.close()
        (OUT / 'results.json').write_text(json.dumps(dict(checks=checks, errors=errors, writes=writes), indent=2))
