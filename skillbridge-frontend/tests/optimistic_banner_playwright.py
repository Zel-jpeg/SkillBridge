"""Preset-only feedback against real disposable HTTP, with controlled failures."""
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import expect, sync_playwright

import organization_playwright as support

ROOT = '/api/admin/institutes/'
NAMES = ['Emerald', 'Teal', 'Blue', 'Indigo', 'Violet', 'Magenta', 'Rose', 'Coral', 'Amber', 'Olive', 'Lime', 'Green']


def collection(page, name):
    support.open_page(page)
    page.get_by_role('searchbox', name='Search by name or code').fill(name)
    expect(card(page, name)).to_be_visible()


def card(page, name):
    return page.get_by_role('listitem').filter(has=page.get_by_role('heading', name=name, exact=True))


def edit(page, name, color, kind='institute'):
    card(page, name).get_by_role('button', name=f'Edit {name}', exact=True).click()
    dialog = page.get_by_role('dialog', name=f'Edit {kind}', exact=True)
    dialog.get_by_role('radio', name=f'{NAMES[color]} geometric banner', exact=True).check()
    return dialog


def save(dialog, kind='institute'):
    dialog.get_by_role('button', name=f'Save {kind}', exact=True).click()


def preview(row, color):
    expect(row.locator('img').first).to_have_css('filter', f'hue-rotate({color * 30}deg)')


def saved(context, path, color):
    response = support.api(context, path)
    assert response.ok
    assert response.json()['banner_color'] == color


def request_path(request):
    return urlparse(request.url).path


def expect_preview_not_cached(page, institute_id, expected):
    colors = page.evaluate("""id => Object.keys(sessionStorage)
      .filter(key => key.startsWith('sb_api_/api/admin/institutes/'))
      .flatMap(key => {
        const data = JSON.parse(sessionStorage.getItem(key))?.data
        return (data?.results ?? [data]).filter(row => row?.id === id).map(row => row.banner_color)
      })""", institute_id)
    assert colors and all(color == expected for color in colors), colors


def show_stale_collection(page, search):
    def matching(response):
        url = urlparse(response.url)
        return url.path == ROOT and parse_qs(url.query).get('search') == [search]
    with page.expect_response(matching) as result:
        page.evaluate("""path => {
          const input = document.querySelector('input[type=search]')
          const url = path + '?' + new URLSearchParams({ search: input.value, status: 'all', page: 1, page_size: 8 })
          window.dispatchEvent(new CustomEvent('sse:data_changed', { detail: { urls: [url] } }))
        }""", ROOT)
    assert result.value.ok
    return result.value.json()['results'][0]


def hold_method(context, path, method):
    held = []
    pattern = '**' + path + '*'

    def intercept(route):
        if request_path(route.request) == path and route.request.method == method:
            held.append(route)
        else:
            route.fallback()

    context.route(pattern, intercept)
    return held, lambda: context.unroute(pattern, intercept)


def wait_for_route(page, held):
    # Playwright's request event can precede its Python route callback.
    for _ in range(100):
        if held:
            assert len(held) == 1
            return held[0]
        page.wait_for_timeout(20)
    raise AssertionError('The expected request did not reach its held route')


def successful_preset(context, page, institute):
    name, row_id = institute['name'], institute['id']
    path = f'{ROOT}{row_id}/'
    row = card(page, name)
    preview(row, 1)
    patches, stop = hold_method(context, path, 'PATCH')
    dialog = edit(page, name, 2)
    with page.expect_request(lambda request: request.method == 'PATCH' and request_path(request) == path):
        save(dialog)
    expect(dialog).to_have_count(0)
    preview(row, 2)
    expect(row.get_by_role('status')).to_contain_text('Saving')
    expect(row.get_by_role('button', name=f'Edit {name}', exact=True)).to_be_disabled()
    expect(row.get_by_role('button', name=f'Archive {name}', exact=True)).to_be_disabled()
    expect(row.get_by_role('button', name=f'Edit {name}', exact=True)).to_be_focused()
    assert wait_for_route(page, patches).request.post_data_json == {'banner_color': 2}
    assert show_stale_collection(page, name)['banner_color'] == 1
    preview(row, 2)
    expect_preview_not_cached(page, row_id, 1)
    saved(context, path, 1)

    # Another tab's change to a non-banner field must survive our one-field PATCH.
    second = support.api(context, path, 'patch', {'description': 'Description from the other editor'})
    assert second.ok
    stop()
    wait_for_route(page, patches).fallback()
    expect(row.get_by_role('status')).to_have_count(0)
    expect(row.get_by_text('Description from the other editor', exact=True)).to_be_visible()
    preview(row, 2)
    saved(context, path, 2)
    print('PASS immediate preset, one narrow PATCH, no early cache publication, intervening GET and independent concurrent field')


def rejected_preset(context, page, institute):
    name, row_id = institute['name'], institute['id']
    path = f'{ROOT}{row_id}/'
    row = card(page, name)
    patches, stop = hold_method(context, path, 'PATCH')
    dialog = edit(page, name, 3)
    with page.expect_request(lambda request: request.method == 'PATCH' and request_path(request) == path):
        save(dialog)
    expect(dialog).to_have_count(0)
    preview(row, 3)
    stop()
    wait_for_route(page, patches).fulfill(status=400, json={'error': 'Synthetic preset rejection.'})
    preview(row, 2)
    expect(page.get_by_role('alert').filter(has_text='Synthetic preset rejection.')).to_be_visible()
    saved(context, path, 2)
    row.get_by_role('button', name='Edit banner', exact=True).click()
    expect(dialog.get_by_role('radio', name='Indigo geometric banner', exact=True)).to_be_checked()
    dialog.get_by_role('button', name='Cancel', exact=True).click()
    print('PASS explicit rejection restores saved banner and retains the selected color for review')


def ambiguous_preset(context, page, institute, commit):
    name, row_id = institute['name'], institute['id']
    path = f'{ROOT}{row_id}/'
    row = card(page, name)
    color = 4 if commit else 5
    patches, stop_patch = hold_method(context, path, 'PATCH')
    checks, stop_check = hold_method(context, path, 'GET')
    dialog = edit(page, name, color)
    with page.expect_request(lambda request: request.method == 'PATCH' and request_path(request) == path):
        save(dialog)
    expect(dialog).to_have_count(0)
    preview(row, color)
    with page.expect_request(lambda request: request.method == 'GET' and request_path(request) == path):
        if commit:
            written = wait_for_route(page, patches).fetch(url=support.API + path)
            assert written.ok and written.json()['banner_color'] == color
        wait_for_route(page, patches).abort('failed')
    checked = wait_for_route(page, checks)
    expect(row.get_by_role('status')).to_contain_text('Checking')
    preview(row, color)
    stop_check()
    if commit:
        checked.fallback()
        expect(row.get_by_role('status')).to_have_count(0)
        preview(row, color)
        saved(context, path, color)
    else:
        checked.abort('failed')
        expect(page.get_by_role('button', name='Check saved banner', exact=True)).to_be_visible()
        preview(row, 4)
        saved(context, path, 4)
        page.get_by_role('button', name='Check saved banner', exact=True).click()
        expect(row.get_by_role('status')).to_have_count(0)
        preview(row, 4)
        saved(context, path, 4)
    assert len(patches) == 1, 'An ambiguous PATCH must never be replayed automatically'
    stop_patch()
    print(f'PASS {"lost successful response verified with GET" if commit else "offline failure recovered via explicit check without replay"}')


def competing_presets(browser, context, page, institute):
    name, row_id = institute['name'], institute['id']
    path = f'{ROOT}{row_id}/'
    row = card(page, name)
    patches, stop = hold_method(context, path, 'PATCH')
    dialog = edit(page, name, 6)
    with page.expect_request(lambda request: request.method == 'PATCH' and request_path(request) == path):
        save(dialog)
    first_response = wait_for_route(page, patches).fetch(url=support.API + path)
    assert first_response.ok and first_response.json()['banner_color'] == 6
    other_context, other_page = support.session(browser)
    try:
        collection(other_page, name)
        save(edit(other_page, name, 7))
        expect(other_page.locator('.sb-toast').filter(has_text='Banner saved.')).to_be_visible()
        saved(other_context, path, 7)
        assert show_stale_collection(page, name)['banner_color'] == 7
        page.wait_for_function('''id => Object.keys(sessionStorage).some(key =>
            key.startsWith('sb_api_/api/admin/institutes/?search=Synthetic+Banner+Pilot') &&
            JSON.parse(sessionStorage.getItem(key)).data.results.some(row => row.id === id && row.banner_color === 7))''', arg=row_id)
        preview(row, 6)
        stop()
        with page.expect_request(lambda request: request.method == 'GET' and request_path(request) == path):
            wait_for_route(page, patches).fulfill(response=first_response)
        expect(row.get_by_role('status')).to_have_count(0)
        preview(row, 7)
        saved(context, path, 7)
    finally:
        other_context.close()
    print('PASS two browser sessions, a newer confirmed color and a late older response converge on the current value')


def revoked_while_checking(context, page, institute):
    name, row_id = institute['name'], institute['id']
    path = f'{ROOT}{row_id}/'
    row = card(page, name)
    patches, stop_patch = hold_method(context, path, 'PATCH')
    checks, stop_check = hold_method(context, path, 'GET')
    dialog = edit(page, name, 8)
    with page.expect_request(lambda request: request.method == 'PATCH' and request_path(request) == path):
        save(dialog)
    with page.expect_request(lambda request: request.method == 'GET' and request_path(request) == path):
        wait_for_route(page, patches).abort('failed')
    checked = wait_for_route(page, checks)
    stop_check()
    checked.fulfill(status=403, json={'error': 'Synthetic record access revoked.'})
    expect(page.locator('.sb-toast').filter(has_text='Synthetic record access revoked.')).to_be_visible()
    expect(row.get_by_role('status')).to_have_count(0)
    expect(row.get_by_role('button', name='Check saved banner', exact=True)).to_have_count(0)
    expect(row.get_by_role('button', name='Edit banner', exact=True)).to_have_count(0)
    preview(row, 7)
    stop_patch()
    print('PASS revoked record access clears the pending preview and recovery input without replay')


def program_and_session(context, page, institute):
    parent = f'{ROOT}{institute["id"]}/programs/'
    name = 'Synthetic Banner Program'
    response = support.api(context, parent, 'post', {'name': name, 'code': 'BP', 'banner_color': 0})
    assert response.ok, response.text()
    path = f'{parent}{response.json()["id"]}/'
    page.get_by_role('button', name=f'Manage programs in {institute["name"]}', exact=True).click()
    row = card(page, name)
    expect(row).to_be_visible()

    patches, stop = hold_method(context, path, 'PATCH')
    dialog = edit(page, name, 1, 'program')
    dialog.get_by_label('Description', exact=True).fill('Confirmed with program details')
    with page.expect_request(lambda request: request.method == 'PATCH' and request_path(request) == path):
        save(dialog, 'program')
    expect(dialog.get_by_role('button', name='Saving…', exact=True)).to_be_disabled()
    preview(row, 0)
    assert wait_for_route(page, patches).request.post_data_json['description'] == 'Confirmed with program details'
    stop()
    wait_for_route(page, patches).fallback()
    expect(dialog).to_have_count(0)
    preview(row, 1)
    saved(context, path, 1)
    print('PASS program changes that include business fields still wait for confirmation')

    patches, stop = hold_method(context, path, 'PATCH')
    dialog = edit(page, name, 11, 'program')
    with page.expect_request(lambda request: request.method == 'PATCH' and request_path(request) == path):
        save(dialog, 'program')
    preview(row, 11)
    expect(row.get_by_role('status')).to_contain_text('Saving')
    assert wait_for_route(page, patches).request.post_data_json == {'banner_color': 11}
    page.evaluate("""identity => {
      localStorage.setItem('sb-session-id', 'different-banner-pilot-session');
      localStorage.setItem('sb-token', identity.token);
      localStorage.setItem('sb-role', identity.user.role);
      localStorage.setItem('sb-user', JSON.stringify(identity.user));
      window.dispatchEvent(new StorageEvent('storage', { key: 'sb-session-id' }));
    }""", support.AUTH['instructor'])
    expect(page).to_have_url(support.BASE + '/instructor/dashboard')
    stop()
    written = wait_for_route(page, patches).fetch(url=support.API + path)
    assert written.ok
    wait_for_route(page, patches).fulfill(response=written)
    expect(page).to_have_url(support.BASE + '/instructor/dashboard')
    page.wait_for_load_state('networkidle')
    expect(page.locator('.sb-toast')).to_have_count(0)
    assert page.evaluate("!JSON.stringify(sessionStorage).includes('Synthetic Banner Program')")
    print('PASS a program preview does not publish a late response or toast after the account changes')


def run(browser):
    context, page = support.session(browser)
    response = support.api(context, ROOT, 'post', {'name': 'Synthetic Banner Pilot', 'code': 'PILOT', 'banner_color': 1})
    assert response.ok, response.text()
    institute = response.json()
    collection(page, institute['name'])
    successful_preset(context, page, institute)
    rejected_preset(context, page, institute)
    ambiguous_preset(context, page, institute, True)
    ambiguous_preset(context, page, institute, False)
    competing_presets(browser, context, page, institute)
    revoked_while_checking(context, page, institute)
    program_and_session(context, page, institute)
    context.close()


if __name__ == '__main__':
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel='chrome', headless=True)
        try:
            run(browser)
        finally:
            browser.close()
    assert not support.errors, support.errors
