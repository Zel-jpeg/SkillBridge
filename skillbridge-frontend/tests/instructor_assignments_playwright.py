"""Program membership journeys against real local HTTP with synthetic accounts."""
import json
from playwright.sync_api import sync_playwright, expect
import organization_playwright as support

OUT, AUTH = support.OUT, support.AUTH
checks = []


def open_program(page, name='Synthetic Program 00'):
    support.open_page(page)
    page.get_by_role('searchbox', name='Search by name or code').fill('Synthetic Institute 00')
    page.get_by_role('button', name='Manage programs in Synthetic Institute 00').click()
    page.get_by_role('searchbox', name='Search by name or code').fill(name)
    page.get_by_role('button', name=f'Manage instructors for {name}', exact=True).click()
    return page.get_by_role('dialog', name='Program instructors', exact=True)


def picker(page, panel, name):
    panel.get_by_role('button', name='Assign instructor', exact=True).click()
    result = page.get_by_role('dialog', name='Assign instructor', exact=True)
    result.get_by_role('searchbox').fill(name)
    return result


def run(browser):
    context, page = support.session(browser)
    institute = support.api(context, '/api/admin/institutes/?search=Synthetic+Institute+00').json()['results'][0]
    programs = support.api(context, f"/api/admin/institutes/{institute['id']}/programs/?page_size=50").json()['results']
    program, second = programs[:2]
    base = f"/api/admin/institutes/{institute['id']}/programs/{program['id']}/instructors/"
    second_base = f"/api/admin/institutes/{institute['id']}/programs/{second['id']}/instructors/"
    owner = AUTH['instructor']['user']
    name = owner['name']
    assert support.api(context, '/api/management/programs/', role='instructor').json()['count'] == 0
    panel = open_program(page)
    expect(panel.get_by_text('No assignments match. Assign an instructor or adjust these filters.', exact=True)).to_be_visible()
    selection = picker(page, panel, name)
    selection.get_by_role('button', name=f'Assign {name}', exact=True).click()
    expect(selection).to_have_count(0)
    expect(panel.get_by_role('heading', name=name, exact=True)).to_be_visible()
    assert support.api(context, '/api/management/programs/', role='instructor').json()['count'] == 1
    assert support.api(context, f"/api/management/programs/{program['id']}/", role='instructor').status == 200
    checks.append('admin assignment UI grants current program access on the existing JWT')

    selection = picker(page, panel, name)
    expect(selection.get_by_role('button', name=f'Assign {name}', exact=True)).to_be_disabled()
    # Escape in a native search input may first clear its query. Exercise
    # dialog dismissal from a regular control instead.
    selection.get_by_role('button', name='Cancel', exact=True).focus()
    page.keyboard.press('Escape')
    expect(selection).to_have_count(0)
    expect(panel.get_by_role('button', name='Assign instructor', exact=True)).to_be_focused()
    first = support.api(context, base).json()['results'][0]
    assert support.api(context, base, 'post', {'instructor_id': owner['id']}).json()['id'] == first['id']
    assert support.api(context, base).json()['count'] == 1
    checks.append('nested dialog focus/Escape and idempotent assignment without duplicate rows')

    assert support.api(context, second_base, 'post', {'instructor_id': owner['id']}).status == 201
    panel.get_by_role('button', name=f'Revoke assignment for {name}', exact=True).click()
    confirm = page.get_by_role('dialog', name='Revoke program assignment', exact=True)
    confirm.get_by_role('button', name='Revoke', exact=True).click()
    expect(confirm).to_have_count(0)
    expect(panel.get_by_text('Revoked assignment', exact=True)).to_be_visible()
    assert support.api(context, '/api/management/programs/', role='instructor').json()['count'] == 1
    assert support.api(context, f"/api/management/programs/{program['id']}/", role='instructor').status == 404
    assert support.api(context, f"/api/management/programs/{second['id']}/", role='instructor').status == 200
    panel.get_by_role('button', name=f'Restore assignment for {name}', exact=True).click()
    page.get_by_role('dialog', name='Restore program assignment', exact=True).get_by_role('button', name='Restore', exact=True).click()
    expect(page.get_by_role('dialog', name='Restore program assignment')).to_have_count(0)
    expect(panel.get_by_text('Active assignment', exact=True)).to_be_visible()
    assert support.api(context, base).json()['results'][0]['id'] == first['id']
    checks.append('revoke/restore retains row identity and affects only the selected program without relogin')

    selection = picker(page, panel, '')
    selection.get_by_role('button', name='Next →', exact=True).click()
    expect(selection.get_by_text('Showing 9–10 of 10', exact=False)).to_be_visible()
    selection.get_by_role('searchbox').fill('Synthetic Coordinator 00')
    expect(selection.get_by_role('button', name='Next →', exact=True)).to_have_count(0)
    selection.get_by_role('button', name='Cancel', exact=True).click()
    candidates = support.api(context, base.replace('instructors/', 'instructor-options/') + '?page_size=50').json()['results']
    for candidate in candidates:
        assert support.api(context, base, 'post', {'instructor_id': candidate['id']}).status in [200, 201]
    panel.get_by_role('searchbox', name='Search assigned instructors').fill('Synthetic Coordinator')
    expect(panel.get_by_text('9 assignments', exact=True)).to_be_visible()
    panel.get_by_role('button', name='Next →', exact=True).click()
    expect(panel.get_by_text('Showing 9–9 of 9', exact=False)).to_be_visible()
    checks.append('candidate and assignment lists share correct counts/search/page reset/clamping')

    panel.get_by_role('button', name='Done', exact=True).click()
    page.get_by_role('searchbox', name='Search by name or code').fill(second['name'])
    page.get_by_role('button', name=f"Manage instructors for {second['name']}", exact=True).click()
    panel = page.get_by_role('dialog', name='Program instructors', exact=True)
    failed = {'post': True}
    def interrupt(route):
        if route.request.method == 'POST' and failed['post']:
            failed['post'] = False
            route.fulfill(status=503, content_type='application/json', body='{"error":"Synthetic interruption"}')
        else:
            route.fallback()
    context.route('**' + second_base, interrupt)
    selection = picker(page, panel, 'Synthetic Coordinator 00')
    selection.get_by_role('button', name='Assign Synthetic Coordinator 00', exact=True).click()
    expect(selection.get_by_role('alert')).to_be_visible()
    assert support.api(context, second_base).json()['count'] == 1
    selection.get_by_role('button', name='Assign Synthetic Coordinator 00', exact=True).click()
    expect(selection).to_have_count(0)
    assert support.api(context, second_base).json()['count'] == 2
    checks.append('uncertain assignment retains selection and explicit retry saves once')

    for role in ['instructor', 'other_instructor', 'student']:
        assert support.api(context, base, role=role).status == 403
        assert support.api(context, base, 'post', {'instructor_id': owner['id']}, role=role).status == 403
    foreign = support.api(context, '/api/admin/institutes/?search=Synthetic+Institute+01').json()['results'][0]
    wrong = f"/api/admin/institutes/{foreign['id']}/programs/{program['id']}/instructors/"
    assert support.api(context, wrong, 'post', {'instructor_id': owner['id']}).status == 404
    assert support.api(context, '/api/instructor/batches/', role='other_instructor').json() == []
    assert len(support.api(context, '/api/instructor/batches/', role='instructor').json()) == 1
    checks.append('real HTTP self/foreign assignment denial and private cohort ownership retained')
    context.close()

    for width, dark in [(1440, False), (390, False), (390, True)]:
        context, page = support.session(browser, width=width, dark=dark)
        panel = open_program(page)
        if dark:
            page.evaluate("document.documentElement.classList.add('dark')")
        assert panel.evaluate('(node) => node.getBoundingClientRect().left >= 0 && node.getBoundingClientRect().right <= innerWidth')
        panel.get_by_role('button', name='Next →', exact=True).click()
        expect(panel.get_by_text('Showing 9–10 of 10', exact=False)).to_be_visible()
        page.screenshot(path=str(OUT / f'assignments-{width}-{dark}.png'), animations='disabled')
        selection = picker(page, panel, '')
        expect(selection.get_by_role('button', name='Next →', exact=True)).to_be_visible()
        selection.get_by_role('button', name='Next →', exact=True).click()
        expect(selection.get_by_text('Showing 9–10 of 10', exact=False)).to_be_visible()
        page.screenshot(path=str(OUT / f'assignment-picker-{width}-{dark}.png'), animations='disabled')
        selection.get_by_role('button', name='Cancel', exact=True).click()
        panel.get_by_role('button', name='Done', exact=True).click()
        checks.append(f'usable modal scrolling/pagination/footer at {width}px {"dark" if dark else "light"}')
        context.close()


if __name__ == '__main__':
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(channel='chrome', headless=True)
            try:
                run(browser)
            finally:
                browser.close()
        assert not support.errors, support.errors
    finally:
        (OUT / 'results.json').write_text(json.dumps({'checks': checks, 'page_errors': support.errors}, indent=2), encoding='utf-8')
    print(json.dumps({'passed': len(checks), 'checks': checks, 'page_errors': support.errors}))
