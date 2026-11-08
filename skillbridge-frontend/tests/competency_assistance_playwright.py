"""Real saved-definition suggestions, manual recovery and obsolete response isolation."""
import json
import time
import re
import uuid
from playwright.sync_api import expect, sync_playwright

import organization_playwright as support
from competencies_playwright import open_program
from program_batches_playwright import call

OUT, AUTH, BASE, API = support.OUT, support.AUTH, support.BASE, support.API
checks, errors = support.checks, support.errors


def await_held(page, responses):
    deadline = time.monotonic() + 10
    while not responses and time.monotonic() < deadline:
        page.wait_for_timeout(25)
    assert responses, 'The intercepted real API response did not arrive'


def assert_tags(dialog, expected):
    assert dialog.get_by_role('list', name='Selected skill tags').locator('li > span').all_text_contents() == expected.split(', ')


def show_reuse(dialog):
    summary = dialog.get_by_text('Reuse saved tags', exact=False)
    if dialog.get_by_role('button', name='Find saved tags', exact=True).is_hidden():
        summary.click()


def run(browser):
    context, page = support.session(browser)
    institute = call(context, '/api/admin/institutes/', 'post', {'name': 'Independent Assistance Institute', 'code': 'ASSIST'}, status=201)
    parent = f'/api/admin/institutes/{institute["id"]}/programs/'
    programs = [call(context, parent, 'post', {'name': name, 'code': code}, status=201)
                for name, code in [('Synthetic Catalog Degree', 'ANY'), ('Separate Assistance Degree', 'OTHER')]]
    bases = []
    for program in programs:
        call(context, f'{parent}{program["id"]}/instructors/', 'post', {'instructor_id': AUTH['instructor']['user']['id']}, status=201)
        frameworks = f'/api/management/programs/{program["id"]}/frameworks/'
        version = call(context, frameworks, 'post', {'name': 'Saved knowledge definitions', 'request_id': str(uuid.uuid4())}, role='instructor', status=201)
        bases.append(frameworks + f'{version["id"]}/')
    base = bases[0]
    category = call(context, base + 'categories/', 'post', {'name': 'Records knowledge',
        'description': 'Recognizes booking records and explains arrival reservations.', 'tags': ['Booking records', 'Arrival reservations']}, role='instructor', status=201)
    call(context, bases[1] + 'categories/', 'post', {'name': 'Records knowledge',
        'description': category['description'], 'tags': ['Independent vocabulary']}, role='instructor', status=201)
    context.close()

    context, page = support.session(browser, 'instructor')
    open_program(page)
    expect(page.get_by_text('More options', exact=True)).to_have_count(0)

    page.get_by_role('button', name='Edit Records knowledge', exact=True).click()
    dialog = page.get_by_role('dialog', name='Edit Skill', exact=True)
    while dialog.get_by_role('button', name=re.compile('^Remove tag ')).count():
        dialog.get_by_role('button', name=re.compile('^Remove tag ')).first.click()
    dialog.get_by_label('Tags', exact=True).fill('Manual First, BOOKING RECORDS')
    dialog.get_by_label('Tags', exact=True).press('Enter')
    show_reuse(dialog)
    dialog.get_by_role('button', name='Find saved tags', exact=True).click()
    expect(dialog.get_by_text('Saved tags from Records knowledge:', exact=False)).to_be_visible()
    assert_tags(dialog, 'Manual First, BOOKING RECORDS')
    dialog.get_by_role('button', name='Add suggested tags', exact=True).click()
    assert_tags(dialog, 'Manual First, BOOKING RECORDS, Arrival reservations')
    assert call(context, base + f'categories/{category["id"]}/', role='instructor')['tags'] == category['tags']
    checks.append('saved-name tags require explicit acceptance, preserve manual spelling/order and do not save until submit')
    dialog.get_by_role('button', name='Cancel', exact=True).click()
    page.get_by_role('dialog', name='Discard definition changes?', exact=True).get_by_role('button', name='Discard changes', exact=True).click()

    # Hold a real API response outside the browser, then release after draft changes.
    held = []
    def hold(route):
        response = route.fetch(url=API + base + 'assist/tags/')
        held.append((route, response))
    pattern = '**' + base + 'assist/tags/'
    page.route(pattern, hold)
    page.get_by_role('button', name='Add Skill', exact=True).click()
    dialog = page.get_by_role('dialog', name='Add Skill', exact=True)
    dialog.get_by_label('Name', exact=True).fill('Records knowledge')
    dialog.get_by_label('Description', exact=True).fill('Manual new category definition.')
    dialog.get_by_label('Tags', exact=True).fill('Keep manual')
    dialog.get_by_label('Tags', exact=True).press('Enter')
    show_reuse(dialog)
    dialog.get_by_role('button', name='Find saved tags', exact=True).click()
    expect(dialog.get_by_role('button', name='Finding…', exact=True)).to_be_visible()
    await_held(page, held)
    dialog.get_by_label('Name', exact=True).fill('New unfamiliar category')
    held[0][0].fulfill(response=held[0][1])
    expect(dialog.get_by_text('Saved tags from Records knowledge:', exact=False)).to_have_count(0)
    assert_tags(dialog, 'Keep manual')
    page.unroute(pattern, hold)
    page.route(pattern, lambda route: route.abort('failed'))
    show_reuse(dialog)
    dialog.get_by_role('button', name='Find saved tags', exact=True).click()
    expect(dialog.get_by_text('Cannot reach the server.', exact=False)).to_be_visible()
    assert_tags(dialog, 'Keep manual')
    page.unroute(pattern)
    page.route(pattern, lambda route: route.fulfill(status=503, json={'error': 'Synthetic assistance unavailable'}))
    show_reuse(dialog)
    dialog.get_by_role('button', name='Find saved tags', exact=True).click()
    expect(dialog.get_by_text('Manual entry is still available.', exact=False)).to_be_visible()
    dialog.get_by_label('Name', exact=True).fill('Manual fallback knowledge')
    dialog.get_by_role('button', name='Add Skill', exact=True).click()
    expect(dialog).to_have_count(0)
    expect(page.get_by_role('heading', name='Manual fallback knowledge', exact=True)).to_be_visible()
    saved = call(context, base + 'categories/?search=Manual%20fallback', role='instructor')['results'][0]
    assert saved['tags'] == ['Keep manual']
    checks.append('late response after draft edit is ignored; failed assistance preserves manual content and manual saving works')
    page.unroute(pattern)

    # Switching libraries still resolves vocabulary only from the chosen program.
    page.get_by_role('link', name='All skill libraries', exact=True).click()
    page.get_by_role('link', name='Separate Assistance Degree', exact=True).click()
    expect(page.get_by_text('More options', exact=True)).to_have_count(0)
    expect(page.get_by_role('heading', name='Records knowledge', exact=True)).to_be_visible()

    page.get_by_role('button', name='Edit Records knowledge', exact=True).click()
    dialog = page.get_by_role('dialog', name='Edit Skill', exact=True)
    show_reuse(dialog)
    dialog.get_by_role('button', name='Find saved tags', exact=True).click()
    expect(dialog.get_by_text('Saved tags from Records knowledge: Independent vocabulary', exact=True)).to_be_visible()
    expect(dialog.get_by_role('region', name='Optional tag assistance').get_by_role('status')).not_to_contain_text('Arrival reservations')
    dialog.get_by_role('button', name='Cancel', exact=True).click()
    checks.append('identical category names reuse only the selected program vocabulary')

    page.get_by_role('button', name='Edit Records knowledge', exact=True).click()
    dialog = page.get_by_role('dialog', name='Edit Skill', exact=True)
    record = call(context, bases[1] + 'categories/?search=Records', role='instructor')['results'][0]
    call(context, bases[1] + f'categories/{record["id"]}/', 'patch', {'name': record['name'],
        'description': record['description'], 'tags': ['Changed remotely'], 'expected_digest': record['digest']}, role='instructor')
    show_reuse(dialog)
    dialog.get_by_role('button', name='Find saved tags', exact=True).click()
    expect(dialog.get_by_text('The catalog changed.', exact=False)).to_be_visible()
    assert_tags(dialog, 'Independent vocabulary')
    expect(dialog.get_by_role('button', name='Add suggested tags', exact=True)).to_have_count(0)
    dialog.get_by_role('button', name='Cancel', exact=True).click()
    checks.append('a changed definition digest blocks suggestions from a catalog newer than the open draft')
    context.close()

    context, page = support.session(browser, 'instructor', width=390, dark=True)
    open_program(page)
    page.get_by_role('button', name='Edit Records knowledge', exact=True).click()
    dialog = page.get_by_role('dialog', name='Edit Skill', exact=True)
    show_reuse(dialog)
    dialog.get_by_role('button', name='Find saved tags', exact=True).click()
    expect(dialog.get_by_role('button', name='Add suggested tags', exact=True)).to_be_visible()
    page.keyboard.press('Tab')
    assert dialog.evaluate('(element) => element.contains(document.activeElement)')
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
    page.screenshot(path=str(OUT / 'assistance-phone-dark.png'), animations='disabled')
    page.keyboard.press('Escape')
    expect(dialog).to_have_count(0)
    checks.append('phone dark-mode optional assistance fits, keyboard stays modal and Escape restores the catalog without saving')
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
