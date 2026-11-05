"""Verify that an institute-linked mixed cohort remains an ordinary active batch."""
from playwright.sync_api import expect, sync_playwright

from organization_playwright import BASE, OUT, errors, session
from program_batches_playwright import call


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel='chrome', headless=True)
    admin, page = session(browser, width=390)
    page.goto(BASE + '/admin/batches', wait_until='networkidle')
    page.get_by_role('textbox', name='Search batches').fill('Institute of Computing')
    collection = page.get_by_role('region', name='Batch collection')
    card = collection.get_by_role('button').filter(has_text='Existing IC mixed batch')
    expect(card.get_by_text('Institute of Computing', exact=True)).to_be_visible()
    expect(card.locator('.batch-status')).to_contain_text('Active')
    expect(card.get_by_text('2 students', exact=True)).to_be_visible()
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
    page.screenshot(path=str(OUT / 'active-ic-batch-phone.png'), animations='disabled')
    card.click()
    expect(page.get_by_role('button', name='View student Second synthetic learner', exact=True)).to_be_visible()
    print('PASS Admin finds the active mixed batch by institute and can open its retained roster.')

    instructor, page = session(browser, 'instructor')
    page.goto(BASE + '/instructor/reports?tab=assessments', wait_until='networkidle')
    page.get_by_role('combobox', name='Institute', exact=True).select_option(label='Institute of Computing')
    expect(page.get_by_role('combobox', name='Batch', exact=True).get_by_role('option',
        name='Existing IC mixed batch')).to_have_count(1)
    result = call(instructor, '/api/instructor/batches/', role='instructor')
    batch = next(item for item in result if item['name'] == 'Existing IC mixed batch')
    call(admin, f'/api/instructor/batches/{batch["id"]}/students/', role='other_instructor', status=404)
    assert batch['program_id'] is None and batch['status'] == 'active'
    print('PASS Institute reporting includes the batch and an unrelated instructor cannot read the roster.')

    admin.close()
    instructor.close()
    browser.close()
    assert not errors, errors
