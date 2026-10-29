"""Production-build/real-local-API pagination, detail and recovery checks."""
import json
import os
from pathlib import Path
import re
import sys
from urllib.parse import urlparse, parse_qs

sys.path.insert(0, str(Path(__file__).parent / '.runtime-win'))
sys.path.insert(1, str(Path(__file__).parent / '.runtime'))
from playwright.sync_api import sync_playwright, expect

OUT = Path(__file__).parent / 'artifacts/database-collections'
AUTH = json.loads((OUT / 'auth.json').read_text(encoding='utf-8'))
BASE = os.environ.get('UI_TEST_BASE', 'http://127.0.0.1:5187')
API = 'http://127.0.0.1:' + os.environ.get('DB_COLLECTION_API_PORT', '8027')
expect.set_options(timeout=20000)
checks, errors, requests = [], [], []


def session(browser, role, width, dark):
    context = browser.new_context(viewport={'width': width, 'height': 1000}, reduced_motion='reduce')
    identity = AUTH[role]
    values = {'sb-token': identity['token'], 'sb-role': identity['user']['role'],
              'sb-user': json.dumps(identity['user']), 'sb-theme': 'dark' if dark else 'light'}
    context.add_init_script('for(const [k,v] of Object.entries(' + json.dumps(values) + '))localStorage.setItem(k,v);window.EventSource=class{close(){}}')
    def forward(route):
        url = urlparse(route.request.url)
        if url.path.startswith('/api/'):
            requests.append({'path': url.path, 'query': parse_qs(url.query), 'method': route.request.method})
            return route.continue_(url=API + url.path + ('?' + url.query if url.query else ''))
        return route.continue_() if url.hostname in ('localhost', '127.0.0.1') else route.abort()
    context.route('**/*', forward)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    return context, page


def cards(page):
    return page.locator('.sp-card:visible')


def apply_filters(page, toolbar, course, assessment, noun):
    toolbar.get_by_role('button', name=re.compile('^Filters')).click()
    panel = page.get_by_role('dialog', name=re.compile('filter.*options', re.I))
    panel.get_by_role('group', name='Course', exact=True).get_by_text(course, exact=True).click()
    panel.get_by_role('group', name='Assessment status', exact=True).get_by_text(assessment, exact=True).click()
    button = panel.get_by_role('button', name=re.compile(r'^Show \d+ ' + noun[:-1] + r's?$'))
    expect(button).to_be_enabled()
    button.click()
    expect(panel).to_have_count(0)


def run(browser, role, width, dark):
    context, page = session(browser, role, width, dark)
    admin = role == 'admin'
    path = '/admin/users' if admin else '/instructor/students'
    page.goto(BASE + path)
    page.wait_for_load_state('networkidle')
    toolbar = page.get_by_role('region', name='User filters' if admin else 'Student filters', exact=True)
    expect(cards(page)).to_have_count(10)
    expect(toolbar.get_by_role('status')).to_have_text('21 of 21 users' if admin else '24 of 24 students')
    page.get_by_role('button', name='2', exact=True).click()
    expect(page.get_by_text('Showing 11–20 of ' + ('21' if admin else '24'), exact=True)).to_be_visible()
    expect(cards(page)).to_have_count(10)
    search = toolbar.get_by_role('searchbox') if admin else toolbar.get_by_role('textbox', name='Search students')
    search.fill('DB-001')
    expect(cards(page)).to_have_count(1)
    expect(toolbar.get_by_role('status')).to_have_text('1 of 21 users' if admin else '1 of 24 students')
    before = len([request for request in requests if 'student_id' in request['query']])
    page.get_by_role('button', name='View student Synthetic Student 01', exact=True).click()
    dialog = page.get_by_role('dialog', name='Synthetic Student 01', exact=True)
    expect(dialog.get_by_role('tab', name=re.compile('Retake history'))).to_be_visible()
    dialog.get_by_role('tab', name=re.compile('Retake history')).click()
    expect(dialog.get_by_text('Archived attempt 1', exact=True)).to_be_visible()
    assert len([request for request in requests if 'student_id' in request['query']]) > before
    if width > 640:
        dialog.get_by_role('tab', name=re.compile('^Assessments')).click()
        for action, confirm in [('Approve retake', 'Approve retake'), ('Revoke retake', 'Revoke')]:
            dialog.get_by_role('button', name=action + ' for Required evidence', exact=True).click()
            confirmation = page.get_by_role('dialog', name=action + ' for Required evidence?', exact=True)
            with page.expect_response(lambda response: response.request.method == 'PATCH' and '/retake/' in response.url) as saved:
                confirmation.get_by_role('button', name=confirm, exact=True).click()
            assert saved.value.status == 200
            expect(dialog.get_by_role('button', name=('Revoke retake' if action == 'Approve retake' else 'Approve retake') + ' for Required evidence', exact=True)).to_be_visible()
        checks.append(f'{role}: real retake approval/revocation refreshes paged records and the open detail dialog')
    dialog.get_by_role('button', name='Close student details', exact=True).click()
    search.fill('')
    expect(cards(page)).to_have_count(10)
    apply_filters(page, toolbar, 'BSIS', 'Stopped / flagged', 'users' if admin else 'students')
    expect(toolbar.get_by_role('status')).to_have_text('1 of 21 users' if admin else '2 of 24 students')
    expect(cards(page)).to_have_count(1 if admin else 2)
    toolbar.get_by_role('button', name='Clear filters', exact=True).click()
    expect(cards(page)).to_have_count(10)
    # Both layouts preserve the current server page and full filtered total.
    page.get_by_role('button', name='2', exact=True).click()
    expect(page.get_by_text('Showing 11–20 of ' + ('21' if admin else '24'), exact=True)).to_be_visible()
    if width > 640:
        toolbar.get_by_role('button', name='List view' if admin else 'Show student list', exact=True).click()
        expect(page.get_by_text('Showing 11–20 of ' + ('21' if admin else '24'), exact=True)).to_be_visible()
        expect(page.locator('tbody tr:visible')).to_have_count(10)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(OUT / f'{role}-{width}-{"dark" if dark else "light"}.png'), full_page=True)
    checks.append(f'{role} {width}px {"dark" if dark else "light"}: counts, page 2, search reset, preview filters, lazy history and view preservation')
    context.close()


def recovery(browser):
    context, page = session(browser, 'admin', 1280, False)
    page.goto(BASE + '/admin/users')
    page.wait_for_load_state('networkidle')
    expect(cards(page)).to_have_count(10)
    failed = [False]
    block_clamped_page = [False]
    clamped_page_requests = []
    def fail_page(route):
        url = urlparse(route.request.url)
        if parse_qs(url.query).get('page') == ['2'] and block_clamped_page[0]:
            clamped_page_requests.append(route.request.url)
            return route.fulfill(status=503, json={'error': 'Synthetic canonical page outage'})
        if parse_qs(url.query).get('page') == ['2'] and not failed[0]:
            failed[0] = True
            return route.fulfill(status=503, json={'error': 'Synthetic temporary collection outage'})
        return route.fallback()
    page.route('**/api/admin/users/**', fail_page)
    page.get_by_role('button', name='2', exact=True).click()
    expect(page.get_by_role('alert').filter(has_text='Could not load this section')).to_be_visible()
    page.get_by_role('button', name='Retry', exact=True).click()
    expect(cards(page)).to_have_count(10)
    expect(page.get_by_text('Showing 11–20 of 21', exact=True)).to_be_visible()
    # Real server denies a different instructor's paginated and detail reads.
    for query in ('page=1', 'student_id=' + str(AUTH['student_id'])):
        response = context.request.get(API + f"/api/instructor/batches/{AUTH['batch_id']}/students/?{query}",
            headers={'Authorization': 'Bearer ' + AUTH['other']['token']})
        assert response.status == 404
    checks.append('Failed uncached page has Retry; successful retry restores page 2; foreign staff page/detail reads denied')
    page.get_by_role('button', name='3', exact=True).click()
    expect(cards(page)).to_have_count(1)
    page.get_by_role('button', name='View student Synthetic Student 24', exact=True).click()
    dialog = page.get_by_role('dialog', name='Synthetic Student 24', exact=True)
    expect(dialog.get_by_role('tab', name=re.compile('^Assessments'))).to_be_visible()
    dialog.get_by_role('button', name='Archive student account', exact=True).click()
    block_clamped_page[0] = True
    page.get_by_role('dialog', name='Archive student account?', exact=True).get_by_role('button', name='Archive account', exact=True).click()
    expect(page.get_by_text('Showing 11–20 of 20', exact=True)).to_be_visible()
    page.wait_for_load_state('networkidle')
    expect(page.get_by_text('Showing 11–20 of 20', exact=True)).to_be_visible()
    assert not clamped_page_requests, 'A successful clamped response must seed its canonical page instead of fetching it again.'
    block_clamped_page[0] = False
    expect(cards(page)).to_have_count(10)
    page.get_by_role('button', name=re.compile('^Archived')).click()
    page.get_by_text('Synthetic Student 24', exact=True).click()
    page.get_by_role('dialog', name='Synthetic Student 24', exact=True).get_by_role('button', name='Restore account', exact=True).click()
    expect(page.get_by_role('button', name='Restore account', exact=True)).to_have_count(0)
    page.get_by_role('button', name=re.compile('^Students')).click()
    expect(page.get_by_role('region', name='User filters').get_by_role('status')).to_have_text('21 of 21 users')
    checks.append('Last-page archive retains the successful clamped response despite a canonical-page outage; restore reconciles active totals')
    context.close()


def roster_clamp_recovery(browser):
    context, page = session(browser, 'owner', 1280, False)
    page.goto(BASE + '/instructor/students')
    page.wait_for_load_state('networkidle')
    expect(cards(page)).to_have_count(10)
    page.get_by_role('button', name='2', exact=True).click()
    expect(page.get_by_text('Showing 11–20 of 24', exact=True)).to_be_visible()
    page.get_by_role('button', name='3', exact=True).click()
    expect(cards(page)).to_have_count(4)
    source = f"/api/instructor/batches/{AUTH['batch_id']}/students/?page=3"
    headers = {'Authorization': 'Bearer ' + AUTH['owner']['token']}
    last = context.request.get(API + source, headers=headers).json()['students']
    for student in last:
        response = context.request.delete(API + f"/api/instructor/students/{student['id']}/?batch_id={AUTH['batch_id']}", headers=headers)
        assert response.status == 200
    redundant = []
    def fail_canonical(route):
        if parse_qs(urlparse(route.request.url).query).get('page') == ['2']:
            redundant.append(route.request.url)
            return route.fulfill(status=503, json={'error': 'Synthetic roster page outage'})
        return route.fallback()
    page.route('**/api/instructor/batches/*/students/**', fail_canonical)
    # Deliver the legacy local invalidation that the real hook handles. The SSE
    # transport is stubbed; record changes and all resulting GETs use the real API.
    page.evaluate('(url) => window.dispatchEvent(new CustomEvent("sse:data_changed", { detail: { urls: [url] } }))', source)
    expect(page.get_by_text('Showing 11–20 of 20', exact=True)).to_be_visible()
    page.wait_for_load_state('networkidle')
    expect(page.get_by_role('region', name='Student filters').get_by_role('status')).to_have_text('20 of 20 students')
    expect(cards(page)).to_have_count(10)
    assert not redundant
    checks.append('Instructor last-page removal and simulated invalidation retain the successful clamp without a canonical-page GET')
    context.close()


def preview_failure_recovery(browser, role):
    context, page = session(browser, role, 1280, False)
    admin = role == 'admin'
    page.goto(BASE + ('/admin/users' if admin else '/instructor/students'))
    page.wait_for_load_state('networkidle')
    expect(cards(page)).to_have_count(10)
    toolbar = page.get_by_role('region', name='User filters' if admin else 'Student filters', exact=True)
    toolbar.get_by_role('button', name=re.compile('^Filters')).click()
    panel = page.get_by_role('dialog', name=re.compile('filter.*options', re.I))
    course = panel.get_by_role('group', name='Course', exact=True)
    course.get_by_text('BSIT', exact=True).click()
    expect(panel.get_by_role('button', name='Show 14 users' if admin else 'Show 16 students', exact=True)).to_be_enabled()
    def fail_bs_is(route):
        query = parse_qs(urlparse(route.request.url).query)
        if query.get('counts_only') == ['1'] and query.get('course') == ['BSIS']:
            return route.fulfill(status=503, json={'error': 'Synthetic one-filter outage'})
        return route.fallback()
    pattern = '**/api/admin/users/**' if admin else '**/api/instructor/batches/*/students/**'
    page.route(pattern, fail_bs_is)
    course.get_by_text('BSIS', exact=True).click()
    expect(panel.get_by_role('alert')).to_be_visible()
    course.get_by_text('BSIT', exact=True).click()
    expect(panel.get_by_role('button', name='Show 14 users' if admin else 'Show 16 students', exact=True)).to_be_enabled()
    expect(panel.get_by_role('alert')).to_have_count(0)
    checks.append(f'{role}: a failed filter preview does not poison a different successfully cached filter')
    context.close()


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel='chrome', headless=True)
    try:
        if os.environ.get('DB_COLLECTION_CASE') != 'preview':
            for role in ('admin', 'owner'):
                for width, dark in ((1440, False), (375, True)):
                    run(browser, role, width, dark)
            recovery(browser)
        for role in ('admin', 'owner'):
            preview_failure_recovery(browser, role)
        if os.environ.get('DB_COLLECTION_CASE') != 'preview':
            roster_clamp_recovery(browser)
        assert not errors, errors
        (OUT / 'results.json').write_text(json.dumps({'checks': checks, 'errors': errors, 'requests': requests}, indent=2), encoding='utf-8')
        print(json.dumps({'checks': checks, 'errors': errors}, indent=2))
    finally:
        browser.close()
