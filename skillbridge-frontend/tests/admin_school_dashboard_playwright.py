"""School-wide overview and recorded-cohort drilldowns using synthetic HTTP data."""
import json
from urllib.parse import parse_qs, urlparse
from playwright.sync_api import expect, sync_playwright
from organization_playwright import BASE, OUT, api, errors, session


def metric(page, name):
    return page.get_by_role('link', name=name, exact=True).locator('..').locator('..').locator('dd').first


with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    context, page = session(browser)
    enterprise, tourism, third = json.loads((OUT / 'general-text.json').read_text(encoding='utf-8'))
    writes = []
    analytics_requests = []
    page.on('request', lambda request: analytics_requests.append(parse_qs(urlparse(request.url).query))
            if request.method == 'GET' and urlparse(request.url).path == '/api/management/analytics/' else None)
    page.on('request', lambda request: writes.append(request) if '/api/admin/rerun-recommendations/' in request.url and request.method == 'POST' else None)
    page.goto(BASE + '/admin/dashboard', wait_until='networkidle')
    payload = api(context, '/api/management/analytics/').json()
    expect(metric(page, 'Students')).to_have_text(str(payload['summary']['students']))
    expect(page.get_by_role('region', name='Top matches by institute', exact=True)).to_be_visible()
    expect(page.get_by_role('button', name='View matches for Synthetic Empty Institute', exact=True)).to_be_visible()
    expect(page.get_by_role('region', name='Top performers by skill', exact=True)).to_have_count(0)
    expect(page.get_by_role('region', name='All students', exact=True).locator('table').get_by_text('Synthetic Text Learner 1', exact=True)).to_be_visible()
    expect(page.get_by_label('Program', exact=True)).to_be_disabled()
    page.get_by_text('Attention and administration', exact=False).click()
    expect(page.get_by_role('region', name='Needs attention', exact=True)).to_be_visible()
    expect(page.get_by_role('button', name='Refresh saved recommendations', exact=True)).to_have_count(0)
    assert [{key: value for key, value in params.items() if key != '_t'} for params in analytics_requests] == [
        {'view': ['dashboard']},
    ], analytics_requests
    print('PASS school-wide source metrics, saved institute cards, empty institute and scoped student disclosure')

    page.get_by_role('button', name='View matches for Institute of Business and Public Affairs', exact=True).press('Enter')
    overview = page.get_by_role('region', name='Top matches by program', exact=True)
    expect(overview.get_by_role('button', name='View matches for Entrepreneurship', exact=True)).to_be_visible()
    expect(overview.get_by_role('button', name='View matches for Tourism Management', exact=True)).to_be_visible()
    expect(overview.get_by_role('button', name='View matches for Empty program', exact=True)).to_be_visible()
    expect(metric(page, 'Students')).to_have_text('2')
    overview.get_by_role('button', name='View matches for Tourism Management', exact=True).click()
    expect(page.get_by_role('region', name='Top performers by skill', exact=True)).to_be_visible()
    expect(metric(page, 'Students')).to_have_text('1')
    expect(page.get_by_role('region', name='All students', exact=True).locator('table').get_by_text('Synthetic Text Learner 1', exact=True)).to_be_visible()
    expect(page.get_by_role('heading', name='Synthetic Text Learner 0', exact=True)).to_have_count(0)
    page.get_by_text('Attention and administration', exact=False).click()
    report = page.get_by_role('link', name='Open reports', exact=True)
    query = parse_qs(urlparse(report.get_attribute('href')).query)
    assert query['institute_id'] == [str(tourism['institute_id'])] and query['program_id'] == [str(tourism['program_id'])]
    report.click()
    expect(page.get_by_role('heading', name='Reports & Analytics', exact=True)).to_be_visible()
    expect(page.get_by_role('region', name='Analytics records')).to_be_visible()
    assert any('view' not in params and params.get('program_id') == [str(tourism['program_id'])] for params in analytics_requests), analytics_requests
    assert 'program_id=' + str(tourism['program_id']) in page.url
    page.go_back(wait_until='networkidle')
    expect(metric(page, 'Students')).to_have_text('1')
    print('PASS institute/program card keyboard flow, carousel navigation, isolated student highlights and report scope')

    page.get_by_label('Batch scope', exact=True).select_option('archived')
    expect(metric(page, 'Students')).to_have_text('0')
    page.get_by_label('Institute', exact=True).select_option(str(third['institute_id']))
    expect(page.get_by_label('Program', exact=True)).to_have_value('')
    print('PASS archived labels and dependent scope reset')

    page.route('**/api/admin/rerun-recommendations/', lambda route: route.fulfill(json={'ok': True, 'students_processed': 1, 'errors': 0}))
    page.goto(BASE + '/admin/placements', wait_until='networkidle')
    maintenance = page.get_by_role('button', name='Refresh saved recommendations', exact=True)
    maintenance.press('Enter')
    picker = page.get_by_role('dialog', name='Refresh saved recommendations', exact=True)
    expect(picker.get_by_role('combobox', name='Program', exact=True)).to_be_disabled()
    picker.get_by_role('combobox', name='Institute', exact=True).select_option(str(tourism['institute_id']))
    expect(picker.get_by_role('radio', name='Selected batch', exact=False)).to_be_checked()
    expect(picker.get_by_role('button', name='Review refresh', exact=True)).to_be_disabled()
    picker.get_by_role('combobox', name='Program', exact=True).select_option(str(tourism['program_id']))
    expect(picker.get_by_role('button', name='Review refresh', exact=True)).to_be_disabled()
    picker.get_by_role('combobox', name='Batch', exact=True).select_option(str(tourism['batch_id']))
    picker.get_by_role('combobox', name='Institute', exact=True).select_option(str(third['institute_id']))
    expect(picker.get_by_role('combobox', name='Program', exact=True)).to_have_value('')
    expect(picker.get_by_role('combobox', name='Batch', exact=True)).to_have_value('')
    picker.get_by_role('combobox', name='Institute', exact=True).select_option(str(tourism['institute_id']))
    picker.get_by_role('combobox', name='Program', exact=True).select_option(str(tourism['program_id']))
    picker.get_by_role('combobox', name='Batch', exact=True).select_option(str(tourism['batch_id']))
    picker.get_by_role('button', name='Review refresh', exact=True).click()
    confirmation = page.get_by_role('dialog', name='Refresh recommendations?', exact=True)
    expect(confirmation).to_contain_text('Tourism Management')
    confirmation.get_by_role('button', name='Cancel', exact=True).click()
    assert not writes
    picker.get_by_role('button', name='Review refresh', exact=True).click()
    confirmation.get_by_role('button', name='Refresh recommendations', exact=True).click()
    expect(page.get_by_role('status').filter(has_text='Recommendations refreshed for 1 student.')).to_be_visible()
    assert [request.post_data_json for request in writes] == [{'batch_id': tourism['batch_id']}]
    expect(maintenance).to_be_focused()
    page.set_viewport_size({'width': 390, 'height': 844})
    maintenance.click()
    expect(picker).to_be_visible()
    assert picker.evaluate('node => node.scrollWidth <= node.clientWidth')
    page.screenshot(path=str(OUT / 'placement-maintenance-390.png'), animations='disabled')
    page.keyboard.press('Escape')
    expect(maintenance).to_be_focused()
    page.set_viewport_size({'width': 1440, 'height': 1000})
    print('PASS placement maintenance scope selection, active-batch choices, confirmation, exact POST and focus restoration')

    ic = next(row for row in api(context, '/api/management/organization-options/').json()['institutes'] if row['code'] == 'IC')
    page.unroute('**/api/admin/rerun-recommendations/')
    page.route('**/api/admin/rerun-recommendations/', lambda route: route.fulfill(status=503, json={'error': 'Synthetic outage'}))
    maintenance.click()
    picker.get_by_role('combobox', name='Institute', exact=True).select_option(str(ic['id']))
    picker.get_by_role('radio', name='Whole system', exact=False).check()
    picker.get_by_role('button', name='Review refresh', exact=True).click()
    expect(confirmation).to_contain_text('Whole system · All institutes and programs')
    confirmation.get_by_role('button', name='Refresh recommendations', exact=True).click()
    expect(page.get_by_role('status').filter(has_text='Could not confirm that the rerun completed.')).to_be_visible()
    assert len(writes) == 2 and writes[-1].post_data_json == {}
    print('PASS explicit whole-system payload and uncertain completion feedback')

    page.goto(BASE + '/admin/dashboard', wait_until='networkidle')
    page.get_by_text('Attention and administration', exact=False).click()
    page.get_by_role('button', name='Pending retake requests', exact=False).click()
    dialog = page.get_by_role('dialog', name='Pending retake requests', exact=True)
    dialog.get_by_role('link').filter(has_text='Entrepreneurship').click()
    assert 'active_batches=1' in page.url
    expect(page.get_by_text('1 request', exact=True)).to_be_visible()
    expect(page.get_by_text('Active enrolled batches', exact=False).first).to_be_visible()
    page.get_by_role('link', name='Show all requests in this scope', exact=True).click()
    assert 'active_batches' not in page.url
    page.goto(BASE + '/admin/dashboard', wait_until='networkidle')
    page.get_by_text('Attention and administration', exact=False).click()
    page.get_by_role('button', name='Batches without required assessments', exact=False).click()
    dialog = page.get_by_role('dialog', name='Batches without required assessments', exact=True)
    dialog.get_by_role('link').filter(has_text='Existing IC mixed batch').click()
    expect(page.get_by_role('region', name='Selected batch', exact=True)).to_be_visible()
    expect(page.get_by_role('heading', name='Existing IC mixed batch', exact=True)).to_be_visible()
    print('PASS attention scopes, active retake count reconciliation and current shared IC batch setup link')

    page.goto(BASE + '/admin/dashboard?institute=999999&program=999999', wait_until='networkidle')
    expect(page.get_by_role('alert').filter(has_text='This dashboard institute')).to_be_visible()
    expect(page.get_by_label('Dashboard summary', exact=True)).to_have_count(0)
    page.goto(BASE + '/admin/dashboard', wait_until='networkidle')
    page.get_by_role('button', name='View matches for Synthetic Empty Institute', exact=True).click()
    expect(metric(page, 'Students')).to_have_text('0')
    expect(page.get_by_text('No cards available in this scope yet.', exact=True).first).to_be_visible()
    print('PASS invalid scope and genuinely empty institute remain explicit without global fallback')

    for width in (320, 390, 768, 1440):
        page.set_viewport_size({'width': width, 'height': 1000})
        page.goto(BASE + '/admin/dashboard', wait_until='networkidle')
        if width == 390:
            page.evaluate("document.documentElement.classList.add('dark')")
        expect(page.get_by_role('heading', name='Student performance', exact=True)).to_be_visible()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.screenshot(path=str(OUT / f'school-dashboard-{width}.png'), full_page=True, animations='disabled')
    context.close()
    browser.close()
    assert not errors, errors
    print('PASS four light/dark responsive widths and zero browser page errors')
