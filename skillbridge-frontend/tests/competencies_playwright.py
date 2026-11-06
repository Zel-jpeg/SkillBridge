"""Real API program catalogs, private ownership, immutable versions and recovery."""
import json
import re
import uuid
from playwright.sync_api import expect, sync_playwright

import organization_playwright as support
from program_batches_playwright import call

OUT, AUTH, BASE, API = support.OUT, support.AUTH, support.BASE, support.API
checks, errors = support.checks, support.errors


def open_program(page, role='instructor', name='Synthetic Catalog Degree', advanced=True):
    page.goto(BASE + f'/{role}/competencies', wait_until='networkidle')
    expect(page.get_by_role('heading', name='Skill taxonomy', exact=True)).to_be_visible()
    if role == 'admin':
        page.get_by_label('Institute', exact=True).select_option(label='Arbitrary Catalog Institute')
        page.get_by_label('Program', exact=True).select_option(label=name)
    else:
        page.get_by_role('searchbox', name='Search assigned programs').fill(name)
        page.get_by_role('radio', name=re.compile(name)).check()
    if advanced:
        versions = page.get_by_role('button', name='Skill set versions', exact=True)
        create = page.get_by_role('button', name='Create framework', exact=True)
        expect(versions.or_(create)).to_be_visible()
        if versions.is_visible():
            versions.click()
        expect(create).to_be_visible()


def run(browser):
    context, page = support.session(browser)
    institute = call(context, '/api/admin/institutes/', 'post', {'name': 'Arbitrary Catalog Institute', 'code': 'CATALOG'}, status=201)
    parent = f'/api/admin/institutes/{institute["id"]}/programs/'
    program = call(context, parent, 'post', {'name': 'Synthetic Catalog Degree', 'code': 'ANY'}, status=201)
    other = call(context, parent, 'post', {'name': 'Independent Catalog Degree', 'code': 'OTHER'}, status=201)
    for role in ['instructor', 'other_instructor']:
        call(context, f'{parent}{program["id"]}/instructors/', 'post', {'instructor_id': AUTH[role]['user']['id']}, status=201)
    context.close()

    context, page = support.session(browser, 'instructor')
    open_program(page, advanced=False)
    expect(page.get_by_text('Add the first skill', exact=False)).to_be_visible()
    page.get_by_role('button', name='Add Skill', exact=True).click()
    dialog = page.get_by_role('dialog', name='Add Skill', exact=True)
    dialog.get_by_label('Name', exact=True).fill('Shared service knowledge')
    dialog.get_by_label('Description', exact=True).fill('Recognizes service records and explains an appropriate response.')
    dialog.get_by_label('Tags', exact=True).fill('Service records, Clear communication')
    dialog.get_by_role('button', name='Add Skill', exact=True).click()
    expect(dialog).to_have_count(0)
    expect(page.get_by_role('heading', name='Shared service knowledge', exact=True)).to_be_visible()
    frameworks = f'/api/management/programs/{program["id"]}/frameworks/'
    version = call(context, frameworks, role='instructor')['results'][0]
    base = frameworks + f'{version["id"]}/'
    original = call(context, base + 'categories/', role='instructor')['results'][0]
    checks.append('instructor adds the first skill and the program skill set is created atomically through real HTTP')

    # Seed extra synthetic definitions to exercise the actual paginated UI.
    for index in range(9):
        call(context, base + 'categories/', 'post', {'name': f'Extra category {index:02}',
            'description': 'Recognizes and explains a distinct synthetic knowledge area.', 'tags': []}, role='instructor', status=201)
    open_program(page)
    page.get_by_role('button', name='Open v1', exact=True).click()
    with page.expect_response(lambda response: response.request.method == 'GET' and response.url.split('?')[0].endswith(base)):
        page.get_by_role('button', name='Refresh catalog', exact=True).click()
    expect(page.get_by_text('10 categories', exact=True)).to_be_visible()
    page.get_by_role('button', name='Next →', exact=True).click()
    expect(page.get_by_text('Showing 9–10 of 10', exact=True)).to_be_visible()
    page.get_by_role('searchbox', name='Search categories').fill('No matching knowledge')
    expect(page.get_by_text('No categories match this search.', exact=True)).to_be_visible()
    page.get_by_role('searchbox', name='Search categories').fill('Shared service')
    expect(page.get_by_role('heading', name='Shared service knowledge', exact=True)).to_be_visible()
    page.get_by_role('button', name='Edit Shared service knowledge', exact=True).click()
    dialog = page.get_by_role('dialog', name='Edit category', exact=True)
    dialog.get_by_label('Description', exact=True).fill('Cancelled definition edit')
    dialog.get_by_role('button', name='Cancel', exact=True).click()
    page.get_by_role('dialog', name='Discard definition changes?', exact=True).get_by_role('button', name='Discard changes', exact=True).click()
    assert call(context, base + f'categories/{original["id"]}/', role='instructor')['description'] == original['description']
    checks.append('category search/page reset/count/empty state and nested discard retain original definition')

    # An external edit makes the open editor's digest stale; no overwrite is allowed.
    page.get_by_role('button', name='Edit Shared service knowledge', exact=True).click()
    dialog = page.get_by_role('dialog', name='Edit category', exact=True)
    call(context, base + f'categories/{original["id"]}/', 'patch', {'name': original['name'],
        'description': 'A reviewed concurrent change.', 'tags': original['tags'], 'expected_digest': original['digest']}, role='instructor')
    dialog.get_by_label('Description', exact=True).fill('Unsaved stale draft')
    dialog.get_by_role('button', name='Save changes', exact=True).click()
    expect(dialog.locator('form [role="alert"]')).to_contain_text('changed')
    expect(dialog.get_by_label('Description', exact=True)).to_have_value('Unsaved stale draft')
    dialog.get_by_role('button', name='Cancel', exact=True).click()
    page.get_by_role('dialog', name='Discard definition changes?', exact=True).get_by_role('button', name='Discard changes', exact=True).click()
    open_program(page)
    page.get_by_role('button', name='Open v1', exact=True).click()
    with page.expect_response(lambda response: response.request.method == 'GET' and response.url.split('?')[0].endswith(base)):
        page.get_by_role('button', name='Refresh catalog', exact=True).click()
    page.get_by_role('searchbox', name='Search categories').fill('Shared service')
    expect(page.get_by_text('A reviewed concurrent change.', exact=True)).to_be_visible()
    page.get_by_role('button', name='Freeze definitions', exact=True).click()
    page.get_by_role('dialog', name='Freeze this version?', exact=True).get_by_role('button', name='Freeze definitions', exact=True).click()
    expect(page.get_by_text('These definitions stay with their recorded evidence.', exact=False)).to_be_visible()
    expect(page.get_by_role('button', name='Add category', exact=True)).to_have_count(0)
    checks.append('stale editor preserves its draft and cannot overwrite; reviewed freeze removes definition editing')

    page.get_by_role('button', name='Create new version', exact=True).click()
    dialog = page.get_by_role('dialog', name='Create new version', exact=True)
    # Lose only the first response after the API commits. Retry uses the same UUID.
    lost = {'count': 0}
    def lose_once(route):
        if route.request.method == 'POST':
            lost['count'] += 1
            if lost['count'] == 1:
                response = route.fetch(url=API + frameworks)
                assert response.status == 201
                return route.abort('failed')
        return route.fallback()
    context.route('**' + frameworks, lose_once)
    dialog.get_by_role('button', name='Create version', exact=True).click()
    expect(dialog.locator('form [role="alert"]')).to_be_visible()
    expect(dialog.get_by_label('Name', exact=True)).to_have_value('ANY skills')
    dialog.get_by_role('button', name='Create version', exact=True).click()
    expect(dialog).to_have_count(0)
    versions = call(context, frameworks, role='instructor')['results']
    assert [row['version'] for row in versions] == [2, 1]
    clone = versions[0]
    copied = call(context, frameworks + f'{clone["id"]}/categories/?search=Shared', role='instructor')['results'][0]
    assert copied['id'] != original['id'] and copied['source_category_id'] == original['id']
    assert call(context, base, role='instructor')['locked']
    page.get_by_role('button', name='Open v2', exact=True).click()
    page.get_by_role('searchbox', name='Search categories').fill('Shared')
    expect(page.get_by_role('button', name='Edit Shared service knowledge', exact=True)).to_be_visible()
    page.screenshot(path=str(OUT / 'program-competencies-desktop.png'), animations='disabled')
    checks.append('lost clone response retries idempotently, preserves frozen source IDs/content and opens an editable new version')
    context.close()

    context, page = support.session(browser, 'other_instructor', width=390, dark=True)
    open_program(page)
    page.get_by_role('button', name='Open v2', exact=True).click()
    page.get_by_role('searchbox', name='Search categories').fill('Shared')
    expect(page.get_by_role('heading', name='Shared service knowledge', exact=True)).to_be_visible()
    expect(page.get_by_role('button', name='Edit Shared service knowledge', exact=True)).to_have_count(0)
    expect(page.get_by_role('button', name='Freeze definitions', exact=True)).to_have_count(0)
    call(context, f'/api/management/programs/{other["id"]}/frameworks/', role='other_instructor', status=404)
    page.get_by_role('button', name='Add category', exact=True).click()
    dialog = page.get_by_role('dialog', name='Add category', exact=True)
    dialog.get_by_label('Name', exact=True).fill('Peer knowledge')
    dialog.get_by_label('Description', exact=True).fill('Explains a distinct knowledge outcome for this program.')
    assert dialog.evaluate('(node) => node.getBoundingClientRect().left >= 0 && node.getBoundingClientRect().right <= innerWidth')
    page.screenshot(path=str(OUT / 'category-dialog-phone-dark.png'), animations='disabled')
    dialog.get_by_role('button', name='Add category', exact=True).click()
    expect(dialog).to_have_count(0)
    page.get_by_role('searchbox', name='Search categories').fill('Peer knowledge')
    expect(page.get_by_role('button', name='Edit Peer knowledge', exact=True)).to_be_visible()
    checks.append('phone dark same-program peer reuses catalog and adds own definition while creator/foreign-program boundaries hold')
    context.close()

    context, page = support.session(browser)
    open_program(page, 'admin')
    page.get_by_role('button', name='Open v2', exact=True).click()
    page.get_by_role('button', name='Retire version', exact=True).click()
    page.get_by_role('dialog', name='Retire this version?', exact=True).get_by_role('button', name='Retire version', exact=True).click()
    expect(page.get_by_role('button', name='Restore version', exact=True)).to_be_visible()
    expect(page.get_by_role('button', name='Create new version', exact=True)).to_be_visible()
    page.get_by_role('button', name='Restore version', exact=True).click()
    page.get_by_role('dialog', name='Restore this version?', exact=True).get_by_role('button', name='Restore version', exact=True).click()
    expect(page.get_by_role('button', name='Retire version', exact=True)).to_be_visible()
    assert call(context, frameworks + f'{clone["id"]}/categories/')['count'] == 11
    call(context, base, role='student', status=403)
    grants = call(context, f'{parent}{program["id"]}/instructors/?status=active')['results']
    grant = next(row for row in grants if row['instructor_id'] == AUTH['other_instructor']['user']['id'])
    call(context, f'{parent}{program["id"]}/instructors/{grant["id"]}/', 'patch', {'is_active': False})
    call(context, frameworks, role='other_instructor', status=404)
    checks.append('admin retire/restore keeps category identities; student access and same-JWT revoked program access are denied')
    context.close()


if __name__ == '__main__':
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(channel='chrome', headless=True)
            try:
                run(browser)
            except Exception:
                for context in browser.contexts:
                    for index, page in enumerate(context.pages):
                        page.screenshot(path=str(OUT / f'failure-{index}.png'), animations='disabled')
                        (OUT / f'failure-{index}.txt').write_text(page.locator('body').inner_text(), encoding='utf-8')
                raise
            finally:
                browser.close()
        assert not errors, errors
    finally:
        (OUT / 'results.json').write_text(json.dumps({'checks': checks, 'page_errors': errors}, indent=2), encoding='utf-8')
    print(json.dumps({'passed': len(checks), 'checks': checks, 'page_errors': errors}))
