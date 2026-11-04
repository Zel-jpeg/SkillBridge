"""Real HTTP program batch creation, enrollment/setup, boundaries and recovery."""
import base64
import json
from pathlib import Path
import re
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright
import organization_playwright as support

OUT, AUTH, BASE = support.OUT, support.AUTH, support.BASE
checks, errors = support.checks, support.errors


def call(context, path, method='get', data=None, role='admin', status=200):
    response = support.api(context, path, method, data, role)
    assert response.status == status, (path, response.status, response.text())
    return response.json()


def setup_services(context):
    """Use cached real Leaflet, synthetic addresses/tiles; keep all API writes real."""
    def external(route):
        url = urlparse(route.request.url)
        if url.hostname == 'cdnjs.cloudflare.com':
            suffix = 'css' if url.path.endswith('.css') else 'js'
            asset = Path(__file__).parent / 'artifacts/company-collection' / f'leaflet.min.{suffix}'
            return route.fulfill(body=asset.read_bytes(), content_type='text/css' if suffix == 'css' else 'text/javascript')
        if url.hostname and url.hostname.endswith('tile.openstreetmap.org'):
            return route.fulfill(body=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='), content_type='image/png')
        if url.hostname == 'psgc.gitlab.io':
            rows = [{'code': 'B1', 'name': 'Synthetic Barangay'}] if 'barangays' in url.path else [{'code': 'C1', 'name': 'Panabo City'}] if 'cities-municipalities' in url.path else [{'code': 'P1', 'name': 'Davao del Norte'}]
            return route.fulfill(json=rows, headers={'Access-Control-Allow-Origin': '*'})
        if url.hostname == 'nominatim.openstreetmap.org':
            return route.fulfill(json=[], headers={'Access-Control-Allow-Origin': '*'})
        return route.fallback()
    context.route('**/*', external)


def run(browser):
    context, page = support.session(browser)
    institute = call(context, '/api/admin/institutes/', 'post', {'name': 'Arbitrary Test Institute', 'code': 'ARBITRARY'}, status=201)
    base = f'/api/admin/institutes/{institute["id"]}/programs/'
    programs = [call(context, base, 'post', {'name': 'Any Configured Degree', 'code': 'ANY', 'aliases': ['Any degree alias']}, status=201)]
    for index in range(9):
        programs.append(call(context, base, 'post', {'name': f'Additional Degree {index:02}', 'code': f'ADD{index}'}, status=201))
    program = programs[0]
    owner = AUTH['instructor']['user']
    for item in programs:
        call(context, f'{base}{item["id"]}/instructors/', 'post', {'instructor_id': owner['id']}, status=201)
    call(context, f'{base}{program["id"]}/instructors/', 'post', {'instructor_id': AUTH['other_instructor']['user']['id']}, status=201)

    page.goto(BASE + '/admin/batches', wait_until='networkidle')
    page.get_by_role('button', name='Create batch', exact=True).click()
    dialog = page.get_by_role('dialog', name='Create batch', exact=True)
    dialog.get_by_label('Batch name', exact=True).fill('Admin arbitrary cohort')
    dialog.get_by_role('searchbox', name='Search assigned programs').fill('Arbitrary Test Institute')
    expect(dialog.get_by_text('Showing 1–8 of 10', exact=True)).to_be_visible()
    dialog.get_by_role('button', name='Next →', exact=True).click()
    expect(dialog.get_by_text('Showing 9–10 of 10', exact=True)).to_be_visible()
    dialog.get_by_role('searchbox').fill('Any Configured Degree')
    dialog.get_by_role('radio', name=re.compile('Any Configured Degree')).check()
    dialog.get_by_role('combobox', name='Responsible instructor').select_option(str(owner['id']))
    dialog.get_by_role('button', name='Review batch changes', exact=True).click()
    page.get_by_role('dialog', name='Create this batch?', exact=True).get_by_role('button', name='Save batch', exact=True).click()
    expect(dialog).to_have_count(0)
    batch = next(row for row in call(context, '/api/instructor/batches/') if row['name'] == 'Admin arbitrary cohort')
    assert batch['program_id'] == program['id'] and batch['institute_id'] == institute['id']
    checks.append('admin paginated program search, assigned owner and real batch creation')
    context.close()

    context, page = support.session(browser, 'instructor')
    page.goto(BASE + '/instructor/students', wait_until='networkidle')
    page.get_by_role('button', name=re.compile('New Batch', re.I)).click()
    dialog = page.get_by_role('dialog', name='Start New Batch', exact=True)
    dialog.get_by_role('button', name='Create Batch', exact=True).click()
    expect(dialog.get_by_role('alert')).to_contain_text('Choose an assigned program')
    dialog.get_by_label('Batch name', exact=True).fill('Instructor configured cohort')
    dialog.get_by_role('searchbox').fill('Any Configured Degree')
    dialog.get_by_role('radio', name=re.compile('Any Configured Degree')).check()
    expect(dialog.get_by_role('alert')).to_have_count(0)
    page.screenshot(path=str(OUT / 'instructor-program-batch-desktop.png'), animations='disabled')
    dialog.get_by_role('button', name='Create Batch', exact=True).click()
    expect(dialog).to_have_count(0)
    own_batch = next(row for row in call(context, '/api/instructor/batches/', role='instructor') if row['name'] == 'Instructor configured cohort')
    checks.append('instructor required program validation, scoped picker and real batch creation')

    page.get_by_role('button', name=re.compile('Enroll Student', re.I)).first.click()
    enrollment = page.get_by_role('dialog').last
    enrollment.get_by_role('button', name='Manual entry', exact=True).click()
    enrollment.get_by_role('textbox', name='Email', exact=False).fill('program-learner@dnsc.edu.ph')
    enrollment.get_by_role('textbox', name='Name', exact=False).fill('Synthetic Program Learner')
    enrollment.get_by_role('textbox', name='Student ID', exact=False).fill('2099-00001')
    expect(enrollment.get_by_role('button', name='ANY', exact=True)).to_be_visible()
    expect(enrollment.get_by_role('button', name='BSIT', exact=True)).to_have_count(0)
    enrollment.get_by_role('button', name='Preview student', exact=True).click()
    enrollment.get_by_label('Enrollment email timing').select_option('later')
    enrollment.get_by_role('checkbox').check()
    enrollment.get_by_role('button', name='Confirm 1 enrollments', exact=True).click()
    expect(enrollment.get_by_text('1 enrolled; 0 already enrolled', exact=False)).to_be_visible()
    enrollment.get_by_role('button', name='Done', exact=True).click()
    profile = call(context, '/api/students/me/', role='program_student')
    assert profile['program']['id'] == program['id'] and profile['course'] == 'ANY'
    AUTH['program_student']['user'] = profile
    expect(page.get_by_text('Synthetic Program Learner', exact=True)).to_be_visible()
    expect(page.get_by_text('1 of 1 student', exact=True)).to_be_visible()
    page.screenshot(path=str(OUT / 'program-roster-desktop.png'), animations='disabled')
    checks.append('manual enrollment derives configured program, signed review and held notification')
    context.close()

    context, page = support.session(browser, 'program_student', width=390)
    setup_services(context)
    page.goto(BASE + '/student/setup', wait_until='networkidle')
    expect(page.get_by_role('button', name='ANY', exact=True)).to_be_visible()
    expect(page.get_by_role('button', name='BSIT', exact=True)).to_have_count(0)
    page.get_by_placeholder('e.g. 09123456789').fill('09000000401')
    page.get_by_role('button', name='Next', exact=True).click()
    page.get_by_role('button', name='My family home (I will commute)', exact=True).click()
    page.get_by_label('Province', exact=True).select_option('P1')
    page.get_by_label('City / Municipality', exact=True).select_option('C1')
    page.get_by_label('Barangay', exact=True).select_option('Synthetic Barangay')
    page.get_by_role('button', name='Within Panabo City only', exact=True).click()
    page.get_by_role('button', name='Next', exact=True).click()
    expect(page.get_by_text('Tap anywhere to drop a pin', exact=True)).to_be_visible()
    page.locator('.leaflet-container').click(position={'x': 100, 'y': 100})
    page.get_by_role('button', name='Continue →', exact=True).click()
    page.screenshot(path=str(OUT / 'program-student-setup-phone.png'), animations='disabled')
    page.get_by_role('button', name='Finish & go to dashboard →', exact=True).click()
    expect(page).to_have_url(re.compile('/student/dashboard$'))
    saved = call(context, '/api/students/me/', role='program_student')
    assert saved['course'] == 'ANY' and saved['phone'] == '09000000401'
    assert isinstance(saved['address']['pinLat'], (int, float))
    checks.append('phone new-program onboarding through address, real Leaflet pin and saved dashboard handoff')
    context.close()

    context, page = support.session(browser, 'instructor', width=390, dark=True)
    page.goto(BASE + '/instructor/students', wait_until='networkidle')
    page.get_by_role('button', name=re.compile('New Batch', re.I)).click()
    dialog = page.get_by_role('dialog', name='Start New Batch', exact=True)
    expect(dialog.get_by_role('searchbox')).to_be_visible()
    assert dialog.evaluate('(node) => node.getBoundingClientRect().left >= 0 && node.getBoundingClientRect().right <= innerWidth')
    dialog.get_by_role('searchbox').fill('No matching degree')
    expect(dialog.get_by_text('No available programs.', exact=False)).to_be_visible()
    dialog.get_by_role('button', name='Cancel', exact=True).focus()
    page.keyboard.press('Escape')
    expect(dialog).to_have_count(0)
    checks.append('phone dark modal geometry, empty program search and keyboard cancellation')
    # Same-program assignment gives no co-teacher access.
    call(context, f'/api/instructor/batches/{own_batch["id"]}/students/', role='other_instructor', status=404)
    row = call(context, f'{base}{program["id"]}/instructors/?status=active')
    grant = next(item for item in row['results'] if item['instructor_id'] == owner['id'])
    call(context, f'{base}{program["id"]}/instructors/{grant["id"]}/', 'patch', {'is_active': False})
    call(context, f'/api/instructor/batches/{own_batch["id"]}/students/', role='instructor', status=404)
    remaining = call(context, '/api/instructor/batches/', role='instructor')
    assert any(item['name'] == 'Existing IC mixed batch' for item in remaining)
    assert not any(item['id'] == own_batch['id'] for item in remaining)
    checks.append('real API same-program private ownership and same-JWT revocation with legacy batch retained')
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
