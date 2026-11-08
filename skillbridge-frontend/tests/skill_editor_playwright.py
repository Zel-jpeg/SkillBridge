"""Program coordinators edit chips, recover suggestions and preserve used skills."""
import time
import uuid
from playwright.sync_api import sync_playwright, expect
import organization_playwright as support
from program_batches_playwright import call

OUT, AUTH, BASE, API = support.OUT, support.AUTH, support.BASE, support.API


def held_response(page, held):
    end = time.monotonic() + 10
    while not held and time.monotonic() < end:
        page.wait_for_timeout(25)
    assert held


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel='chrome', headless=True)
    context, page = support.session(browser)
    institute = call(context, '/api/admin/institutes/', 'post', {'name': 'Skill Editor Institute', 'code': 'EDIT'}, status=201)
    parent = f'/api/admin/institutes/{institute["id"]}/programs/'
    program = call(context, parent, 'post', {'name': 'Independent Skill Editor Degree', 'code': 'EDIT'}, status=201)
    for role in ('instructor', 'other_instructor'):
        call(context, f'{parent}{program["id"]}/instructors/', 'post', {'instructor_id': AUTH[role]['user']['id']}, status=201)
    frameworks = f'/api/management/programs/{program["id"]}/frameworks/'
    version = call(context, frameworks, 'post', {'name': 'Reviewed skills', 'request_id': str(uuid.uuid4())}, status=201)
    detail = frameworks + f'{version["id"]}/'
    skill = call(context, detail + 'categories/', 'post', {'name': 'Database Management',
        'description': 'Organize business data in relational tables, query records, and apply basic data integrity checks.',
        'tags': ['SQL', 'MySQL']}, status=201)
    unused = call(context, detail + 'categories/', 'post', {'name': 'Unused skill',
        'description': 'Booking records, guest relations.', 'tags': []}, status=201)
    context.close()

    context, page = support.session(browser, 'instructor')
    page.goto(BASE + f'/instructor/competencies?program={program["id"]}', wait_until='networkidle')
    page.get_by_role('button', name='Edit Database Management', exact=True).click()
    dialog = page.get_by_role('dialog', name='Edit Skill', exact=True)
    expect(dialog.get_by_role('button', name='Suggest tags', exact=True)).to_be_visible()
    expect(dialog.get_by_role('button', name='Find saved tags', exact=True)).to_be_hidden()
    page.screenshot(path=str(OUT / 'skill-editor-default.png'), animations='disabled')
    dialog.get_by_role('button', name='Remove tag MySQL', exact=True).click()
    dialog.get_by_label('Tags', exact=True).fill('PostgreSQL')
    dialog.get_by_label('Tags', exact=True).press('Enter')
    dialog.get_by_role('button', name='Suggest tags', exact=True).click()
    expect(dialog.get_by_text('Suggestions added to your draft. Review them before saving.', exact=True)).to_be_visible()
    expect(dialog.get_by_role('button', name='Remove tag SQL', exact=True)).to_be_visible()
    expect(dialog.get_by_role('button', name='Remove tag relational tables', exact=True)).to_be_visible()
    dialog.get_by_text('Reuse saved tags', exact=False).click()
    dialog.get_by_role('button', name='Find saved tags', exact=True).click()
    expect(dialog.get_by_role('button', name='Add suggested tags', exact=True)).to_be_visible()
    dialog.get_by_role('button', name='Add suggested tags', exact=True).click()
    for width in (320, 390, 768, 1440):
        page.set_viewport_size({'width': width, 'height': 844 if width < 500 else 900})
        assert page.evaluate('document.documentElement.scrollWidth === innerWidth')
        expect(dialog.get_by_role('heading', name='Edit Skill', exact=True)).to_be_in_viewport()
        expect(dialog.get_by_role('button', name='Save changes', exact=True)).to_be_in_viewport()
        assert dialog.locator('header').evaluate('node => node.scrollHeight <= node.clientHeight')
        if width in (320, 1440):
            page.screenshot(path=str(OUT / f'skill-editor-{width}.png'), animations='disabled')
    dialog.get_by_label('Tags', exact=True).fill('Pending manual tag')
    dialog.get_by_role('button', name='Save changes', exact=True).click()
    expect(dialog).to_have_count(0)
    saved = call(context, detail + f'categories/{skill["id"]}/', role='instructor')
    assert 'Pending manual tag' in saved['tags'] and 'SQL' in saved['tags']
    assert len({tag.casefold() for tag in saved['tags']}) == len(saved['tags'])
    print('PASS non-creator coordinator edits required fields, chips, visible suggestions, saved-tag reuse and pending text; four viewport widths fit')

    page.get_by_role('button', name='Edit Database Management', exact=True).click()
    held = []
    pattern = '**' + f'/api/management/programs/{program["id"]}/suggest-tags/'
    page.route(pattern, lambda route: held.append((route, route.fetch(url=API + f'/api/management/programs/{program["id"]}/suggest-tags/'))))
    dialog.get_by_role('button', name='Suggest tags', exact=True).click()
    held_response(page, held)
    dialog.get_by_label('Tags', exact=True).fill('During suggestion')
    dialog.get_by_label('Tags', exact=True).press('Enter')
    held[0][0].fulfill(response=held[0][1])
    expect(dialog.get_by_role('button', name='Remove tag During suggestion', exact=True)).to_be_visible()
    expect(dialog.get_by_text('Suggestions added to your draft.', exact=False)).to_be_visible()
    held.clear()
    dialog.get_by_role('button', name='Suggest tags', exact=True).click()
    held_response(page, held)
    dialog.get_by_label('Description', exact=True).fill('Completely different definition.')
    held[0][0].fulfill(response=held[0][1])
    expect(dialog.get_by_text('Suggestions added to your draft.', exact=False)).to_have_count(0)
    page.unroute(pattern)
    page.route(pattern, lambda route: route.fulfill(status=503, json={'error': 'Synthetic suggestion outage'}))
    dialog.get_by_role('button', name='Suggest tags', exact=True).click()
    expect(dialog.get_by_text('Could not suggest tags. You can still enter and save your own tags.', exact=True)).to_be_visible()
    dialog.get_by_role('button', name='Save changes', exact=True).click()
    expect(dialog).to_have_count(0)
    page.unroute(pattern)
    print('PASS changed-input suggestion response is ignored and failed suggestions leave manual save working')

    page.get_by_role('button', name='Remove Unused skill', exact=True).click()
    confirm = page.get_by_role('dialog', name='Remove Unused skill?', exact=True)
    confirm.get_by_role('button', name='Cancel', exact=True).click()
    assert call(context, detail + f'categories/{unused["id"]}/', role='instructor')['id'] == unused['id']
    page.get_by_role('button', name='Remove Unused skill', exact=True).click()
    confirm.get_by_role('button', name='Remove skill', exact=True).click()
    expect(confirm).to_have_count(0)
    call(context, detail + f'categories/{unused["id"]}/', role='instructor', status=404)
    print('PASS assigned coordinator cancels or confirms removal of an unused skill created by the admin')

    current = call(context, detail, role='instructor')
    call(context, detail, 'patch', {'expected_digest': current['digest'], 'freeze': True}, status=200)
    page.evaluate('sessionStorage.clear()')
    page.reload(wait_until='networkidle')
    expect(page.get_by_text('Definitions frozen or in use', exact=False)).to_be_visible()
    page.get_by_role('button', name='Edit Database Management', exact=True).click()
    expect(dialog.get_by_text('This skill set is already in use.', exact=False)).to_be_visible()
    dialog.get_by_label('Description', exact=True).fill('A reviewed future definition.')
    dialog.get_by_role('button', name='Save changes', exact=True).click()
    expect(dialog).to_have_count(0)
    expect(page.get_by_text('A reviewed future definition.', exact=True)).to_be_visible()
    expect(page.get_by_role('button', name='Skill set versions', exact=True)).to_have_count(0)
    expect(page.get_by_text('More options', exact=True)).to_have_count(0)
    original = call(context, detail + f'categories/{skill["id"]}/', role='instructor')
    assert original['description'] == 'Completely different definition.'
    page.goto(BASE + f'/instructor/competencies?program={program["id"]}', wait_until='networkidle')
    latest = call(context, frameworks, role='instructor')['results'][0]
    latest_detail = frameworks + f'{latest["id"]}/'
    call(context, latest_detail, 'patch', {'expected_digest': latest['digest'], 'freeze': True})
    page.evaluate('sessionStorage.clear()')
    page.reload(wait_until='networkidle')
    expect(page.get_by_text('Definitions frozen or in use', exact=False)).to_be_visible()
    page.get_by_role('button', name='Remove Database Management', exact=True).click()
    confirm = page.get_by_role('dialog', name='Remove Database Management?', exact=True)
    confirm.get_by_role('button', name='Create updated skill set', exact=True).click()
    expect(confirm).to_have_count(0)
    expect(page.get_by_text('No skill categories found.', exact=True)).to_be_visible()
    expect(page.get_by_role('button', name='Edit Database Management', exact=True)).to_have_count(0)
    assert call(context, detail + f'categories/{skill["id"]}/', role='instructor')['id'] == skill['id']
    print('PASS frozen skill edit/removal creates future versions while the original definition stays available')
    # Retire the updated copy so the earlier active library becomes current.
    latest = call(context, frameworks, role='instructor')['results'][0]
    call(context, frameworks + f'{latest["id"]}/', 'patch', {'expected_digest': latest['digest'], 'is_active': False})
    context.close()

    for role, width, dark in (('other_instructor', 390, True), ('admin', 1440, False)):
        context, page = support.session(browser, role, width=width, dark=dark)
        page.goto(BASE + f'/{"admin" if role == "admin" else "instructor"}/competencies?program={program["id"]}', wait_until='networkidle')
        expect(page.get_by_role('button', name='Skill set versions', exact=True)).to_have_count(0)
        expect(page.get_by_text('More options', exact=True)).to_have_count(0)
        page.get_by_role('button', name='Edit Database Management', exact=True).click()
        dialog = page.get_by_role('dialog', name='Edit Skill', exact=True)
        expect(dialog.get_by_role('button', name='Suggest tags', exact=True)).to_be_visible()
        page.screenshot(path=str(OUT / f'skill-editor-{role}.png'), animations='disabled')
        dialog.get_by_role('button', name='Cancel', exact=True).click()
        context.close()
    print('PASS peer and administrator use the same skill editor, including phone dark mode')

    context, page = support.session(browser)
    shared = call(context, '/api/admin/skills/', 'post', {'name': 'Cloud',
        'description': 'Deploy virtual machines, cloud storage.', 'tags': ['Manual keyword']}, status=201)
    page.goto(BASE + '/admin/skills', wait_until='networkidle')
    expect(page.get_by_text('More options', exact=True)).to_have_count(0)
    page.get_by_role('button', name='Edit Cloud', exact=True).click()
    dialog = page.get_by_role('dialog', name='Edit Skill Category', exact=True)
    dialog.get_by_role('button', name='Suggest tags', exact=True).click()
    expect(dialog.get_by_role('button', name='Remove tag AWS', exact=True)).to_be_visible()
    expect(dialog.get_by_role('button', name='Remove tag Manual keyword', exact=True)).to_be_visible()
    dialog.get_by_label('Tags', exact=True).fill('Pending shared tag')
    page.screenshot(path=str(OUT / 'shared-skill-editor.png'), animations='disabled')
    dialog.get_by_role('button', name='Save Changes', exact=True).click()
    expect(dialog).to_have_count(0)
    shared_saved = next(row for row in call(context, '/api/admin/skills/') if row['id'] == shared['id'])
    assert 'Pending shared tag' in shared_saved['tags'] and 'Manual keyword' in shared_saved['tags']
    context.close()
    print('PASS shared catalog uses the same chip editor and suggestions preserve manual and pending tags')
    assert not support.errors, support.errors
    browser.close()
