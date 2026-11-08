"""Real HTTP CRUD, recovery, boundaries and responsive QA with synthetic records."""
import json
import os
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

OUT = Path(os.environ['SB_ORGANIZATION_RUN'])
AUTH = json.loads((OUT / 'auth.json').read_text(encoding='utf-8'))
BASE = 'http://127.0.0.1:' + os.environ['SB_ORGANIZATION_FRONTEND_PORT']
API = 'http://127.0.0.1:' + os.environ['SB_ORGANIZATION_API_PORT']
checks, errors = [], []


def session(browser, role='admin', width=1440, dark=False, mobile=False):
    options = dict(is_mobile=True, has_touch=True, user_agent='Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/156 Mobile Safari/537.36') if mobile else {}
    context = browser.new_context(viewport={'width': width, 'height': 900 if width > 500 else 844}, color_scheme='dark' if dark else 'light', **options)
    context.add_init_script(f"""const identity = {json.dumps(AUTH[role])};
        localStorage.setItem('sb-token', identity.token);
        localStorage.setItem('sb-role', identity.user.role);
        localStorage.setItem('sb-user', JSON.stringify(identity.user));
        localStorage.setItem('sb-login-time', String(Date.now()));
        localStorage.setItem('sb-theme', '{'dark' if dark else 'light'}');
    """)
    def route_request(route):
        url = urlparse(route.request.url)
        if url.path.startswith('/api/'):
            if url.path.endswith('/events/'):
                route.fulfill(status=204)
            else:
                route.continue_(url=API + url.path + ('?' + url.query if url.query else ''))
        elif url.hostname not in ('127.0.0.1', 'localhost'):
            route.abort()
        else:
            route.continue_()
    context.route('**/*', route_request)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    return context, page


def api(context, path, method='get', data=None, role='admin'):
    return getattr(context.request, method)(API + path, data=data, headers={'Authorization': 'Bearer ' + AUTH[role]['token']})


def open_page(page):
    page.goto(BASE + '/admin/institutes')
    expect(page.get_by_role('heading', name='Institutes & Programs')).to_be_visible()
    expect(page.get_by_role('button', name='Add institute', exact=True)).to_be_visible()
    page.wait_for_load_state('networkidle')


def form(page, kind, name, code):
    page.get_by_role('button', name=f'Add {kind}', exact=True).click()
    dialog = page.get_by_role('dialog', name=f'Add {kind}', exact=True)
    dialog.get_by_label('Name', exact=True).fill(name)
    dialog.get_by_label('Code', exact=True).fill(code)
    return dialog


def confirmed_card_updates(browser):
    context, page = session(browser)
    open_page(page)
    page.get_by_role('searchbox', name='Search by name or code').fill('Synthetic Institute')
    page.get_by_role('button', name='Next →', exact=True).click()
    expect(page.get_by_role('heading', name='Synthetic Institute 09', exact=True)).to_be_visible()
    held = []
    def hold_reconciliation(route):
        path = urlparse(route.request.url).path
        if route.request.method == 'GET' and (path.startswith('/api/admin/institutes/') or path == '/api/management/organization-options/'):
            held.append(route)
        else:
            route.fallback()
    context.route('**/api/**', hold_reconciliation)
    page.get_by_role('button', name='Edit Synthetic Institute 09', exact=True).click()
    dialog = page.get_by_role('dialog', name='Edit institute', exact=True)
    dialog.get_by_label('Name', exact=True).fill('Synthetic Institute 09 reviewed')
    dialog.get_by_role('button', name='Save institute', exact=True).click()
    expect(dialog).to_have_count(0)
    expect(page.get_by_role('heading', name='Synthetic Institute 09 reviewed', exact=True)).to_be_visible()
    expect(page.get_by_role('searchbox', name='Search by name or code')).to_have_value('Synthetic Institute')
    expect(page.get_by_text('Showing 9–12 of 12', exact=True)).to_be_visible()
    assert held, 'The edit must be visible while reconciliation GETs remain pending'
    context.unroute('**/api/**', hold_reconciliation)
    for route in held:
        route.fallback()
    page.wait_for_load_state('networkidle')
    checks.append('confirmed institute response updates the card before delayed GETs while preserving page two and search')

    page.get_by_role('button', name='Edit Synthetic Institute 09 reviewed', exact=True).click()
    dialog = page.get_by_role('dialog', name='Edit institute', exact=True)
    dialog.get_by_label('Name', exact=True).fill('Synthetic Institute 00')
    dialog.get_by_role('button', name='Save institute', exact=True).click()
    expect(dialog.get_by_role('alert')).to_contain_text('already uses')
    expect(dialog.get_by_label('Name', exact=True)).to_have_value('Synthetic Institute 00')
    expect(page.get_by_role('heading', name='Synthetic Institute 09 reviewed', exact=True)).to_be_visible()
    dialog.get_by_role('button', name='Cancel', exact=True).click()
    checks.append('rejected institute PATCH retains the draft and the previous confirmed card')

    page.goto(BASE + '/admin/competencies', wait_until='networkidle')
    page.get_by_role('searchbox', name='Search institutes').fill('Synthetic Institute 09')
    held.clear()
    context.route('**/api/**', hold_reconciliation)
    page.get_by_role('button', name='Edit Synthetic Institute 09 reviewed', exact=True).click()
    dialog = page.get_by_role('dialog', name='Edit institute', exact=True)
    dialog.get_by_label('Name', exact=True).fill('Synthetic Institute 09 final')
    dialog.get_by_role('button', name='Save institute', exact=True).click()
    expect(dialog).to_have_count(0)
    expect(page.get_by_role('link', name='Synthetic Institute 09 final', exact=True)).to_be_visible()
    assert held
    context.unroute('**/api/**', hold_reconciliation)
    for route in held:
        route.fallback()
    page.wait_for_load_state('networkidle')
    checks.append('taxonomy card uses the confirmed write response before its delayed organization options GET')

    # An old account's delayed success must not repopulate the next session.
    pending = []
    def hold_patch(route):
        if route.request.method == 'PATCH':
            pending.append(route)
        else:
            route.fallback()
    context.route('**/api/admin/institutes/**', hold_patch)
    page.get_by_role('button', name='Edit Synthetic Institute 09 final', exact=True).click()
    dialog = page.get_by_role('dialog', name='Edit institute', exact=True)
    dialog.get_by_label('Name', exact=True).fill('OLD_ADMIN_RESPONSE_SENTINEL')
    dialog.get_by_role('button', name='Save institute', exact=True).click()
    page.wait_for_timeout(100)
    assert len(pending) == 1
    identity = AUTH['instructor']
    page.evaluate("""identity => {
        localStorage.setItem('sb-session-id', 'different-synthetic-session');
        localStorage.setItem('sb-token', identity.token);
        localStorage.setItem('sb-role', identity.user.role);
        localStorage.setItem('sb-user', JSON.stringify(identity.user));
        window.dispatchEvent(new StorageEvent('storage', { key: 'sb-session-id' }));
    }""", identity)
    route, = pending
    path = urlparse(route.request.url).path
    response = route.fetch(url=API + path)
    route.fulfill(response=response)
    expect(page).to_have_url(BASE + '/instructor/dashboard')
    page.wait_for_load_state('networkidle')
    expect(page.locator('.sb-toast')).to_have_count(0)
    assert page.evaluate("!JSON.stringify(sessionStorage).includes('OLD_ADMIN_RESPONSE_SENTINEL')")
    context.close()
    checks.append('account switch discards a late organization mutation response without cached rows or stale feedback')


def run(browser):
    context, page = session(browser)
    open_page(page)
    expect(page.get_by_role('status').filter(has_text='12 institutes')).to_be_visible()
    page.get_by_role('button', name='Next →', exact=True).click()
    expect(page.get_by_text('Showing 9–12 of 12', exact=True)).to_be_visible()
    page.get_by_role('searchbox', name='Search by name or code').fill('Synthetic Institute 00')
    expect(page.get_by_role('heading', name='Synthetic Institute 00', exact=True)).to_be_visible()
    expect(page.get_by_role('button', name='Next →', exact=True)).to_have_count(0)
    page.get_by_role('searchbox').fill('No matching institute')
    expect(page.get_by_text('No institutes match these filters.', exact=True)).to_be_visible()
    page.get_by_role('button', name='Clear filters').first.click()
    checks.append('server search/count/pagination reset/empty/clear')

    page.get_by_role('button', name='Add institute', exact=True).click()
    dialog = page.get_by_role('dialog', name='Add institute', exact=True)
    dialog.get_by_label('Name', exact=True).fill('Cancelled institute')
    page.keyboard.press('Tab')
    assert dialog.evaluate('(node) => node.contains(document.activeElement)')
    page.keyboard.press('Escape')
    expect(dialog).to_have_count(0)
    expect(page.get_by_role('button', name='Add institute', exact=True)).to_be_focused()
    assert api(context, '/api/admin/institutes/?search=Cancelled').json()['count'] == 0
    checks.append('keyboard modality/Escape/focus restoration/cancel has no write')

    dialog = form(page, 'institute', 'Independent Test Institute', 'GENERIC')
    dialog.get_by_label('Description', exact=True).fill('A configurable institute for synthetic verification.')
    dialog.get_by_role('button', name='Save institute', exact=True).click()
    expect(dialog).to_have_count(0)
    page.get_by_role('searchbox').fill('Independent Test Institute')
    expect(page.get_by_role('heading', name='Independent Test Institute', exact=True)).to_be_visible()
    page.get_by_role('button', name='Manage programs in Independent Test Institute').click()
    expect(page.get_by_text('No programs yet. Add one to get started.', exact=True)).to_be_visible()
    dialog = form(page, 'program', 'Independent Test Program', 'ANY')
    dialog.locator('summary').filter(has_text='Other names or codes').click()
    dialog.get_by_label('Other names or codes', exact=True).fill('Synthetic degree\nIndependent course')
    dialog.get_by_role('button', name='Save program', exact=True).click()
    expect(dialog).to_have_count(0)
    expect(page.get_by_role('heading', name='Independent Test Program', exact=True)).to_be_visible()
    page.get_by_role('button', name='Edit Independent Test Program', exact=True).click()
    dialog = page.get_by_role('dialog', name='Edit program', exact=True)
    expect(dialog.get_by_label('Other names or codes', exact=True)).to_have_value('Synthetic degree\nIndependent course')
    dialog.get_by_label('Name', exact=True).fill('Renamed Independent Program')
    dialog.get_by_role('button', name='Save program', exact=True).click()
    expect(dialog).to_have_count(0)
    expect(page.get_by_role('heading', name='Renamed Independent Program', exact=True)).to_be_visible()
    checks.append('real API arbitrary institute/program create/edit and aliases')

    page.get_by_role('button', name='All institutes', exact=True).click()
    page.get_by_role('searchbox').fill('Independent Test Institute')
    page.get_by_role('button', name='Archive Independent Test Institute', exact=True).click()
    confirmation = page.get_by_role('dialog', name='Archive institute', exact=True)
    confirmation.get_by_role('button', name='Archive', exact=True).click()
    expect(confirmation.get_by_role('alert')).to_contain_text('Archive active programs')
    confirmation.get_by_role('button', name='Cancel', exact=True).click()
    page.get_by_role('button', name='Manage programs in Independent Test Institute').click()
    page.get_by_role('button', name='Archive Renamed Independent Program', exact=True).click()
    page.get_by_role('dialog', name='Archive program', exact=True).get_by_role('button', name='Archive', exact=True).click()
    expect(page.get_by_role('dialog')).to_have_count(0)
    page.get_by_label('Status', exact=True).select_option('active')
    expect(page.get_by_text('No programs match these filters.', exact=True)).to_be_visible()
    page.get_by_role('button', name='All institutes', exact=True).click()
    page.get_by_role('searchbox').fill('Independent Test Institute')
    page.get_by_role('button', name='Archive Independent Test Institute', exact=True).click()
    page.get_by_role('dialog', name='Archive institute', exact=True).get_by_role('button', name='Archive', exact=True).click()
    expect(page.get_by_role('dialog')).to_have_count(0)
    page.get_by_role('button', name='Manage programs in Independent Test Institute').click()
    expect(page.get_by_role('button', name='Add program', exact=True)).to_be_disabled()
    page.get_by_role('button', name='Restore Renamed Independent Program', exact=True).click()
    confirmation = page.get_by_role('dialog', name='Restore program', exact=True)
    confirmation.get_by_role('button', name='Restore', exact=True).click()
    expect(confirmation.get_by_role('alert')).to_contain_text('Restore the institute')
    confirmation.get_by_role('button', name='Cancel', exact=True).click()
    page.get_by_role('button', name='All institutes', exact=True).click()
    page.get_by_role('searchbox').fill('Independent Test Institute')
    page.get_by_role('button', name='Restore Independent Test Institute', exact=True).click()
    page.get_by_role('dialog', name='Restore institute', exact=True).get_by_role('button', name='Restore', exact=True).click()
    expect(page.get_by_role('dialog')).to_have_count(0)
    page.get_by_role('button', name='Manage programs in Independent Test Institute').click()
    page.get_by_role('button', name='Restore Renamed Independent Program', exact=True).click()
    page.get_by_role('dialog', name='Restore program', exact=True).get_by_role('button', name='Restore', exact=True).click()
    expect(page.get_by_role('dialog')).to_have_count(0)
    checks.append('archive/restore hierarchy, actionable errors, retained records and active filters')

    page.get_by_role('button', name='All institutes', exact=True).click()
    dialog = form(page, 'institute', 'Duplicate code attempt', 'GENERIC')
    dialog.get_by_role('button', name='Save institute', exact=True).click()
    expect(dialog.get_by_role('alert')).to_contain_text('already uses')
    expect(dialog.get_by_label('Name', exact=True)).to_have_value('Duplicate code attempt')
    dialog.get_by_role('button', name='Cancel', exact=True).click()
    checks.append('duplicate validation retains unsaved form')

    failures = {'post': True, 'get': False}
    def injected(route):
        if route.request.method == 'POST' and failures['post']:
            failures['post'] = False
            route.fulfill(status=503, content_type='application/json', body='{"error":"Synthetic service interruption"}')
        elif route.request.method == 'GET' and failures['get'] and 'Force' in route.request.url:
            failures['get'] = False
            route.fulfill(status=503, content_type='application/json', body='{"error":"Synthetic read interruption"}')
        else:
            route.fallback()
    context.route('**/api/admin/institutes/?*', injected)
    context.route('**/api/admin/institutes/', injected)
    dialog = form(page, 'institute', 'Recovered Institute', 'RETRY')
    dialog.get_by_role('button', name='Save institute', exact=True).click()
    expect(dialog.get_by_role('alert')).to_be_visible()
    expect(dialog.get_by_label('Name', exact=True)).to_have_value('Recovered Institute')
    assert api(context, '/api/admin/institutes/?search=Recovered').json()['count'] == 0
    dialog.get_by_role('button', name='Save institute', exact=True).click()
    expect(dialog).to_have_count(0)
    assert api(context, '/api/admin/institutes/?search=Recovered').json()['count'] == 1
    failures['get'] = True
    page.get_by_role('searchbox').fill('Force uncached error')
    collection = page.get_by_role('region', name='Institutes', exact=True)
    expect(collection.get_by_role('alert')).to_be_visible()
    page.get_by_role('button', name='Retry', exact=True).click()
    expect(collection.get_by_role('alert')).to_have_count(0)
    expect(page.get_by_text('No institutes match these filters.', exact=True)).to_be_visible()
    checks.append('failed save keeps draft/no replay; explicit retry saves once; GET retry recovers')

    for role in ['student', 'instructor']:
        assert api(context, '/api/admin/institutes/', role=role).status == 403
        assert api(context, '/api/admin/institutes/', 'post', {'code': 'DENIED', 'name': 'Denied'}, role=role).status == 403
    assert api(context, '/api/instructor/batches/').json()[0]['status'] == 'active'
    checks.append('real HTTP role denials and existing cohort status retained')
    context.close()

    for width, dark in [(1440, False), (768, False), (390, False), (390, True)]:
        context, page = session(browser, width=width, dark=dark)
        open_page(page)
        if dark:
            page.evaluate("document.documentElement.classList.add('dark')")
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        geometry = page.evaluate("""() => {
          const workspace = document.querySelector('.sb-workspace');
          const sidebar = document.querySelector('.sb-desktop-sidebar');
          return {width: innerWidth, workspace: workspace.getBoundingClientRect().left,
            margin: getComputedStyle(workspace).marginLeft, sidebar: sidebar.getBoundingClientRect().right,
            heading: document.querySelector('main h1').getBoundingClientRect().left,
            variable: getComputedStyle(workspace).getPropertyValue('--sb-sidebar-width')};
        }""")
        (OUT / f'geometry-{width}-{dark}.json').write_text(json.dumps(geometry), encoding='utf-8')
        if width >= 1024:
            assert geometry['workspace'] >= geometry['sidebar'], geometry
        page.screenshot(path=str(OUT / f'institutes-{width}-{dark}.png'), full_page=True, animations='disabled')
        page.screenshot(path=str(OUT / f'viewport-{width}-{dark}.png'), animations='disabled')
        if width >= 1024:
            assert page.locator('main h1').bounding_box()['x'] >= geometry['sidebar']
        dialog = form(page, 'institute', 'Responsive example', 'RESP')
        assert dialog.evaluate('(node) => node.getBoundingClientRect().right <= innerWidth && node.getBoundingClientRect().left >= 0')
        page.screenshot(path=str(OUT / f'form-{width}-{dark}.png'), animations='disabled')
        dialog.get_by_role('button', name='Cancel', exact=True).click()
        checks.append(f'responsive collection/form geometry {width}px {"dark" if dark else "light"}')
        context.close()


if __name__ == '__main__':
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(channel='chrome', headless=True)
            try:
                run(browser)
                confirmed_card_updates(browser)
            finally:
                browser.close()
        assert not errors, errors
    finally:
        (OUT / 'results.json').write_text(json.dumps({'checks': checks, 'page_errors': errors}, indent=2), encoding='utf-8')
    print(json.dumps({'passed': len(checks), 'checks': checks, 'page_errors': errors}))
