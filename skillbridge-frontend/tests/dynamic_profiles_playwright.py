"""F04 real API profile, program filter, instructor creation and neutral copy."""
import json
import re
from playwright.sync_api import expect, sync_playwright
import organization_playwright as support
import program_batches_playwright as batches

OUT, AUTH, BASE = support.OUT, support.AUTH, support.BASE
call, checks, errors = batches.call, support.checks, support.errors


def run(browser):
    # Retain F03's actual enrollment, setup, revocation and compatibility checks.
    batches.run(browser)
    context, page = support.session(browser)
    institute = call(context, '/api/admin/institutes/?search=Arbitrary Test Institute')['results'][0]
    program = call(context, f'/api/admin/institutes/{institute["id"]}/programs/?search=Any Configured Degree')['results'][0]
    AUTH['program_student']['user'] = call(context, '/api/students/me/', role='program_student')
    context.close()

    context, page = support.session(browser, 'program_student')
    batches.setup_services(context)
    page.goto(BASE + '/student/profile', wait_until='networkidle')
    expect(page.get_by_role('heading', name='My profile', exact=True)).to_be_visible()
    program_field = page.get_by_role('textbox', name='Program', exact=True)
    expect(program_field).to_have_value('ANY')
    expect(program_field).to_have_attribute('readonly', '')
    expect(page.get_by_text(re.compile('Arbitrary Test Institute · Any Configured Degree'))).to_be_visible()
    page.get_by_role('textbox', name='Phone number', exact=True).fill('09000000402')
    page.get_by_role('button', name='Save changes', exact=True).click()
    expect(page.get_by_text('Profile saved successfully.', exact=False).first).to_be_visible()
    saved = call(context, '/api/students/me/', role='program_student')
    assert saved['phone'] == '09000000402' and saved['program']['id'] == program['id']
    call(context, '/api/students/me/profile/', 'patch', {'course': 'OTHER'}, role='program_student', status=400)
    page.screenshot(path=str(OUT / 'assigned-program-profile-desktop.png'), animations='disabled')
    checks.append('real profile read-only configured program, contact save, current institute label and direct self-transfer denial')
    context.close()

    context, page = support.session(browser)
    page.goto(BASE + '/admin/users', wait_until='networkidle')
    page.get_by_role('button', name='Add Instructor', exact=True).click()
    dialog = page.get_by_role('dialog', name='Add Instructor', exact=True)
    dialog.get_by_label('DNSC Email', exact=True).fill('optional.instructor@dnsc.edu.ph')
    dialog.get_by_label(re.compile('Full name', re.I)).fill('Synthetic Configured Instructor')
    dialog.get_by_label('Instructor ID', exact=True).fill('SYN-CONFIGURED')
    dialog.locator('summary').filter(has_text='Assign a program now').click()
    dialog.get_by_role('searchbox').fill('Any Configured Degree')
    dialog.get_by_role('radio', name=re.compile('Any Configured Degree')).check()
    page.screenshot(path=str(OUT / 'configured-instructor-create-desktop.png'), animations='disabled')
    dialog.get_by_role('button', name='Add Instructor', exact=True).click()
    expect(dialog).to_have_count(0)
    users = call(context, '/api/admin/users/')
    instructor = next(row for row in users['instructors'] if row['email'] == 'optional.instructor@dnsc.edu.ph')
    assert instructor['assigned_programs'][0]['id'] == program['id']
    assert instructor['department'] == 'Arbitrary Test Institute' and instructor['courses'] == 'ANY'
    checks.append('admin creates instructor with optional configured program and atomic real assignment')

    page.get_by_role('button', name='Add Instructor', exact=True).click()
    dialog = page.get_by_role('dialog', name='Add Instructor', exact=True)
    dialog.get_by_label('DNSC Email', exact=True).fill('stale.instructor@dnsc.edu.ph')
    dialog.get_by_label(re.compile('Full name', re.I)).fill('Synthetic Stale Selection')
    dialog.get_by_label('Instructor ID', exact=True).fill('SYN-STALE')
    dialog.locator('summary').filter(has_text='Assign a program now').click()
    dialog.get_by_role('searchbox').fill('Any Configured Degree')
    dialog.get_by_role('radio', name=re.compile('Any Configured Degree')).check()
    program_url = f'/api/admin/institutes/{institute["id"]}/programs/{program["id"]}/'
    call(context, program_url, 'patch', {'is_active': False})
    dialog.get_by_role('button', name='Add Instructor', exact=True).click()
    expect(dialog.locator('form [role="alert"]')).to_be_visible()
    expect(dialog.get_by_label('DNSC Email', exact=True)).to_have_value('stale.instructor@dnsc.edu.ph')
    assert not any(row['email'] == 'stale.instructor@dnsc.edu.ph' for row in call(context, '/api/admin/users/')['instructors'])
    call(context, program_url, 'patch', {'is_active': True})
    dialog.get_by_role('button', name='Add Instructor', exact=True).click()
    expect(dialog).to_have_count(0)
    assert sum(row['email'] == 'stale.instructor@dnsc.edu.ph' for row in call(context, '/api/admin/users/')['instructors']) == 1
    checks.append('stale archived program selection rejects account/grant atomically, retains draft and explicit retry creates once')

    # Course options come from the whole collection, not the current result page.
    page.get_by_role('button', name=re.compile(r'^Students\b')).click()
    page.get_by_role('button', name=re.compile('Filters')).first.click()
    filters = page.get_by_role('dialog', name=re.compile('filter', re.I))
    expect(filters.get_by_role('radio', name='ANY', exact=True)).to_be_visible()
    expect(filters.get_by_role('radio', name='BSIS', exact=True)).to_have_count(0)
    page.keyboard.press('Escape')
    checks.append('admin program-code filters use current catalog records rather than an IT/IS whitelist')
    context.close()

    context, page = support.session(browser, width=390, dark=True)
    page.goto(BASE + '/admin/users', wait_until='networkidle')
    page.get_by_role('button', name='Add Instructor', exact=True).click()
    dialog = page.get_by_role('dialog', name='Add Instructor', exact=True)
    dialog.get_by_label('DNSC Email', exact=True).fill('unassigned.instructor@dnsc.edu.ph')
    dialog.get_by_label(re.compile('Full name', re.I)).fill('Synthetic Unassigned Instructor')
    dialog.get_by_label('Instructor ID', exact=True).fill('SYN-UNASSIGNED')
    dialog.get_by_role('button', name='Add Instructor', exact=True).click()
    expect(dialog).to_have_count(0)
    users = call(context, '/api/admin/users/')
    unassigned = next(row for row in users['instructors'] if row['email'] == 'unassigned.instructor@dnsc.edu.ph')
    assert unassigned['department'] == unassigned['courses'] == '' and not unassigned['assigned_programs']
    checks.append('phone dark unassigned instructor creation retains neutral metadata and no implicit access')
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
