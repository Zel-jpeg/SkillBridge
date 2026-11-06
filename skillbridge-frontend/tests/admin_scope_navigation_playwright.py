"""Real API admin context selection, isolation and responsive navigation checks."""
import json
from playwright.sync_api import expect, sync_playwright
from organization_playwright import BASE, OUT, api, errors, session


def choose(page, item, path, all_programs=False):
    page.goto(BASE + path, wait_until='networkidle')
    page.get_by_role('region', name='Institutes', exact=True).get_by_role('link', name='Institute of Business and Public Affairs', exact=True).click()
    expect(page.get_by_role('region', name='Programs', exact=True)).to_be_visible()
    page.get_by_role('region', name='Programs', exact=True).get_by_role('link', name='All IBPA programs' if all_programs else item['name'], exact=True).click()
    expect(page.get_by_role('navigation', name='Institute and program path')).to_be_visible()


with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    context, page = session(browser)
    enterprise, tourism, third = json.loads((OUT / 'general-text.json').read_text(encoding='utf-8'))
    for path, hidden in [('/admin/batches', enterprise['batch_name']),
                         ('/admin/assessments', enterprise['assessment_title']),
                         ('/admin/assessments/archives', 'Archived assessments'),
                         ('/admin/retake-requests', 'All requests'),
                         ('/admin/placements', 'Students awaiting placement')]:
        page.goto(BASE + path, wait_until='networkidle')
        expect(page.get_by_role('region', name='Institutes', exact=True)).to_be_visible()
        expect(page.get_by_text(hidden, exact=True)).to_have_count(0)
    page.goto(BASE + '/admin/companies', wait_until='networkidle')
    expect(page.get_by_label('Program', exact=True)).to_be_disabled()
    expect(page.get_by_role('heading', name='Synthetic IC legacy partner', exact=True)).to_have_count(0)
    page.get_by_label('Institute', exact=True).select_option(label='Institute of Computing')
    expect(page.get_by_role('heading', name='Synthetic IC legacy partner', exact=True)).to_have_count(0)
    page.get_by_label('Program', exact=True).select_option('all')
    expect(page.get_by_role('heading', name='Synthetic IC legacy partner', exact=True)).to_be_visible()
    expect(page.get_by_role('button', name='Add Partner', exact=False)).to_be_disabled()
    print('PASS all requested admin pages require institute/program selection before displaying records')

    choose(page, tourism, '/admin/batches')
    expect(page.get_by_role('button', name=tourism['batch_name'], exact=False)).to_be_visible()
    expect(page.get_by_role('button', name=enterprise['batch_name'], exact=False)).to_have_count(0)
    page.get_by_role('button', name=tourism['batch_name'], exact=False).press('Enter')
    expect(page.get_by_role('region', name='Selected batch')).to_be_visible()
    page.get_by_role('button', name='Back to batches', exact=True).click()
    page.get_by_role('textbox', name='Search batches').fill('no matching batch')
    page.get_by_role('button', name='Clear filters', exact=True).click()
    expect(page.get_by_role('button', name=tourism['batch_name'], exact=False)).to_be_visible()
    assert f"program={tourism['program_id']}" in page.url
    page.reload(wait_until='networkidle')
    expect(page.get_by_role('button', name=tourism['batch_name'], exact=False)).to_be_visible()
    page.go_back(wait_until='networkidle')
    expect(page.get_by_role('region', name='Programs', exact=True)).to_be_visible()
    page.get_by_role('link', name=enterprise['name'], exact=True).click()
    expect(page.get_by_role('button', name=enterprise['batch_name'], exact=False)).to_be_visible()
    page.goto(BASE + f"/admin/batches?institute={tourism['institute_id']}&program={tourism['program_id']}&batch_id={enterprise['batch_id']}&emails=1", wait_until='networkidle')
    expect(page.get_by_role('region', name='Selected batch')).to_have_count(0)
    expect(page.get_by_role('dialog')).to_have_count(0)
    page.goto(BASE + f"/admin/batches?batch_id={tourism['batch_id']}", wait_until='networkidle')
    page.get_by_role('link', name='Institute of Business and Public Affairs', exact=True).click()
    page.get_by_role('link', name=tourism['name'], exact=True).click()
    expect(page.get_by_role('region', name='Selected batch')).to_be_visible()
    print('PASS batch card drilldown, roster/back, refresh/history and scope-preserving filter reset')

    choose(page, tourism, '/admin/assessments')
    expect(page.get_by_role('button', name=f"View details for {tourism['assessment_title']}", exact=True)).to_be_visible()
    expect(page.get_by_role('button', name=f"View details for {enterprise['assessment_title']}", exact=True)).to_have_count(0)
    page.get_by_role('link', name='Assessment archives', exact=True).click()
    assert f"program={tourism['program_id']}" in page.url
    expect(page.get_by_role('heading', name='Assessment archives', exact=True)).to_be_visible()
    page.get_by_role('link', name='Back to assessments', exact=True).click()
    expect(page.get_by_role('button', name=f"View details for {tourism['assessment_title']}", exact=True)).to_be_visible()
    print('PASS assessment/archives maintain selected institute and program')

    page.goto(BASE + '/admin/companies', wait_until='networkidle')
    page.get_by_label('Institute', exact=True).select_option(str(tourism['institute_id']))
    page.get_by_label('Program', exact=True).select_option(str(tourism['program_id']))
    expect(page.get_by_role('heading', name='Synthetic IC legacy partner', exact=True)).to_have_count(0)
    expect(page.get_by_role('heading', name='Synthetic cross-program partner', exact=True)).to_be_visible()
    expect(page.get_by_role('button', name='Add Partner', exact=False)).to_be_enabled()
    created = api(context, '/api/admin/companies/', 'post', {'name': 'Synthetic selected-program partner', 'management_program_id': tourism['program_id']})
    assert created.status == 201
    # This direct fixture write bypasses UI invalidation; model a fresh session.
    page.evaluate('sessionStorage.clear()')
    page.reload(wait_until='networkidle')
    expect(page.get_by_role('heading', name='Synthetic selected-program partner', exact=True)).to_be_visible()
    page.get_by_label('Institute', exact=True).select_option(label='Institute of Computing')
    expect(page.get_by_label('Program', exact=True)).to_have_value('')
    expect(page.get_by_role('heading', name='Synthetic selected-program partner', exact=True)).to_have_count(0)
    page.get_by_label('Program', exact=True).select_option('all')
    expect(page.get_by_role('heading', name='Synthetic IC legacy partner', exact=True)).to_be_visible()
    page.screenshot(path=str(OUT / 'admin-ic-partners.png'), animations='disabled')
    print('PASS cascading partner selectors, original IC isolation and selected-program partner persistence')

    choose(page, tourism, '/admin/retake-requests')
    expect(page.get_by_text('10 requests', exact=True)).to_be_visible()
    expect(page.get_by_role('table').get_by_text('IBPA · BSTM — Tourism Management', exact=True).first).to_be_visible()
    page.get_by_role('button', name='Next →', exact=True).click()
    expect(page.get_by_text('Showing 9–10 of 10', exact=False)).to_be_visible()
    page.get_by_role('button', name='Previous attempts', exact=True).click()
    expect(page.get_by_text('Showing 1–8 of 10', exact=False)).to_be_visible()
    page.get_by_role('button', name='Pending', exact=True).click()
    page.get_by_role('button', name='Review request', exact=False).first.click()
    review = page.get_by_role('dialog')
    expect(review.get_by_text('IBPA · BSTM — Tourism Management', exact=True)).to_be_visible()
    page.keyboard.press('Escape')
    print('PASS current/history retake server scope, pagination reset and review program context')

    choose(page, tourism, '/admin/placements')
    expect(page.get_by_text('Students awaiting placement', exact=True)).to_be_visible()
    expect(page.get_by_label('Student scope', exact=True).get_by_role('option', name=enterprise['batch_name'], exact=False)).to_have_count(0)
    expect(page.get_by_label('Student scope', exact=True).get_by_role('option', name=tourism['batch_name'], exact=False)).to_have_count(1)
    page.locator('.pl-search input').fill('no matching partner')
    page.get_by_role('button', name='Clear filters', exact=True).click()
    assert f"program={tourism['program_id']}" in page.url
    page.get_by_role('button', name='Decision history', exact=True).click()
    expect(page.get_by_text('Synthetic Text Learner 1', exact=True).first).to_be_visible()
    expect(page.get_by_text('Synthetic Text Learner 0', exact=True)).to_have_count(0)
    print('PASS placement batches and decision history follow selected program while shared capacity remains global')

    for path in ('/admin/batches', '/admin/assessments', '/admin/retake-requests', '/admin/placements', '/admin/companies'):
        page.goto(BASE + path + f"?institute={third['institute_id']}&program={tourism['program_id']}", wait_until='networkidle')
        expect(page.get_by_role('alert').filter(has_text='This institute or program is unavailable.')).to_be_visible()
        expect(page.get_by_text(tourism['assessment_title'], exact=True)).to_have_count(0)
    print('PASS mismatched institute/program links never fall back to global records')

    empty = api(context, f"/api/admin/institutes/{tourism['institute_id']}/programs/", 'post', {'code': 'EMPTY', 'name': 'Synthetic empty program'})
    assert empty.status == 201
    empty_id = empty.json()['id']
    assert api(context, f"/api/admin/institutes/{tourism['institute_id']}/programs/{empty_id}/", 'patch', {'is_active': False}).ok
    page.evaluate('sessionStorage.clear()')
    page.goto(BASE + f"/admin/batches?institute={tourism['institute_id']}&program={empty_id}", wait_until='networkidle')
    expect(page.get_by_text('No batches yet', exact=True)).to_be_visible()
    expect(page.get_by_role('button', name='Create batch', exact=False)).to_be_disabled()
    expect(page.get_by_role('button', name=tourism['batch_name'], exact=False)).to_have_count(0)
    page.goto(BASE + f"/admin/companies?institute={tourism['institute_id']}&program={empty_id}", wait_until='networkidle')
    expect(page.get_by_role('button', name='Add Partner', exact=False)).to_be_disabled()
    print('PASS empty and archived program selection remains scoped')

    context.close()
    context, page = session(browser, width=390, dark=True, mobile=True)
    page.route('**/api/management/organization-options/**', lambda route: route.fulfill(status=503, json={'error': 'Synthetic temporary failure'}))
    page.goto(BASE + '/admin/batches', wait_until='networkidle')
    expect(page.get_by_role('button', name='Retry choices', exact=True)).to_be_visible()
    expect(page.get_by_role('button', name=tourism['batch_name'], exact=False)).to_have_count(0)
    page.unroute('**/api/management/organization-options/**')
    page.get_by_role('button', name='Retry choices', exact=True).click()
    expect(page.get_by_role('region', name='Institutes', exact=True)).to_be_visible()
    print('PASS failed context load has explicit retry and never reveals unscoped records')
    for width in (320, 390, 768, 1440):
        page.set_viewport_size({'width': width, 'height': 900})
        page.goto(BASE + '/admin/batches', wait_until='networkidle')
        page.get_by_role('region', name='Institutes', exact=True).get_by_role('link', name='Institute of Business and Public Affairs', exact=True).click()
        expect(page.get_by_role('region', name='Programs', exact=True)).to_be_visible()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.screenshot(path=str(OUT / f'admin-program-navigation-{width}.png'), animations='disabled')
    context.close()
    context, page = session(browser, 'instructor', width=390, dark=True, mobile=True)
    page.goto(BASE + '/instructor/retake-requests', wait_until='networkidle')
    expect(page.get_by_role('region', name='Institutes', exact=True)).to_have_count(0)
    expect(page.get_by_text('20 requests', exact=True)).to_be_visible()
    context.close()
    browser.close()
    assert not errors, errors
    print('PASS responsive banner navigation, dark phone instructor retakes and zero page errors')
