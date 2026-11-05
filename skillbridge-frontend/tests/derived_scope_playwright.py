"""Real staff report reads with a controlled scope event delivered to Chrome."""

from playwright.sync_api import expect, sync_playwright

from aiken_import_playwright import setup
from organization_playwright import AUTH, BASE, OUT, checks, errors, session
from program_batches_playwright import call


def run(browser):
    framework, _, batch = setup(browser)
    admin, _ = session(browser)
    program_id = batch['program_id']
    framework_url = f'/api/management/programs/{program_id}/frameworks/{framework["id"]}/'
    digest = call(admin, framework_url, role='instructor')['digest']
    title = 'Synthetic restricted assessment'
    call(admin, '/api/instructor/assessments/', 'post', {
        'title': title, 'batch_id': batch['id'], 'duration_minutes': 20, 'framework_id': framework['id'],
        'framework_digest': digest, 'publication_status': 'draft', 'questions': [],
    }, role='instructor', status=201)
    assignments = f'/api/admin/institutes/{batch["institute_id"]}/programs/{program_id}/instructors/'
    grants = call(admin, assignments)['results']
    grant = next(row for row in grants if row['instructor_id'] == AUTH['instructor']['user']['id'])

    instructor, page = session(browser, 'instructor', width=390, dark=True)
    instructor.add_init_script('''window.EventSource = class {
      constructor() { window.testScopeStream = this }
      close() {}
    }''')
    page.goto(BASE + '/instructor/reports?tab=assessments', wait_until='networkidle')
    page.get_by_role('combobox', name='Program', exact=True).select_option(str(program_id))
    expect(page.get_by_role('combobox', name='Batch', exact=True).locator('option').filter(has_text=batch['name'])).to_have_count(1)
    expect(page.get_by_role('combobox', name='Batch', exact=True).locator('option').filter(has_text='Existing IC mixed batch')).to_have_count(0)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
    page.screenshot(path=str(OUT / 'program-report-filter-phone-dark.png'), animations='disabled')
    page.get_by_role('button', name='Individual assessment reports', exact=True).click()
    panel = page.get_by_role('region', name='Individual assessment report controls', exact=True)
    panel.get_by_role('combobox', name='Report type', exact=True).select_option('assessment_completion')
    panel.get_by_role('combobox', name='Batch filter', exact=True).select_option(str(batch['id']))
    panel.get_by_role('button', name='Generate report', exact=True).click()
    expect(panel.get_by_role('cell', name=title, exact=True)).to_be_visible()
    checks.append('Program selection updates the report URL and limits its batch choices on a phone viewport.')

    page.wait_for_function('typeof window.testScopeStream?.onmessage === "function"')
    call(admin, assignments + f'{grant["id"]}/', 'patch', {'is_active': False})
    page.evaluate('window.testScopeStream.onmessage({ data: JSON.stringify({ type: "data_changed", topics: ["assignments", "scope"] }) })')
    expect(panel.get_by_role('cell', name=title, exact=True)).to_have_count(0)
    expect(page.get_by_text('No accessible batches in this scope.', exact=True)).to_be_visible()
    assert page.evaluate('id => !Object.keys(sessionStorage).some(key => key.includes(`analytics/?program_id=${id}`))', program_id)
    call(instructor, f'/api/management/assessment-reports/?batch_id={batch["id"]}&export=csv', role='instructor', status=404)
    checks.append('A delivered revocation evicts the open report and cached analytics, and the former CSV link is denied by the API.')
    instructor.close()
    admin.close()


if __name__ == '__main__':
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel='chrome', headless=True)
        run(browser)
        browser.close()
    assert not errors, errors
    for check in checks:
        print(f'PASS {check}')
