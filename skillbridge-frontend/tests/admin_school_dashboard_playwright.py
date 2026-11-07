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
    page.on('request', lambda request: writes.append(request) if '/api/admin/rerun-recommendations/' in request.url and request.method == 'POST' else None)
    page.goto(BASE + '/admin/dashboard', wait_until='networkidle')
    payload = api(context, '/api/management/analytics/').json()
    expect(metric(page, 'Students in active batches')).to_have_text(str(payload['summary']['students']))
    expect(page.get_by_role('region', name='Institute overview', exact=True)).to_be_visible()
    expect(page.get_by_role('link', name='Open Synthetic Empty Institute dashboard', exact=True)).to_be_visible()
    expect(page.get_by_role('region', name='Program skill highlights', exact=True)).to_have_count(0)
    expect(page.get_by_text('Synthetic Text Learner 1', exact=True)).to_have_count(0)
    expect(page.get_by_label('Program', exact=True)).to_be_disabled()
    expect(page.get_by_role('button', name='Refresh recommendations for this scope', exact=True)).to_be_hidden()
    print('PASS school-wide source metrics, saved institute cards, empty institute and scoped student disclosure')

    page.get_by_role('link', name='Open Institute of Business and Public Affairs dashboard', exact=True).press('Enter')
    overview = page.get_by_role('region', name='Program overview', exact=True)
    expect(overview.get_by_role('link', name='Open Entrepreneurship dashboard', exact=True)).to_be_visible()
    expect(overview.get_by_role('link', name='Open Tourism Management dashboard', exact=True)).to_be_visible()
    expect(overview.get_by_role('link', name='Open Empty program dashboard', exact=True)).to_be_visible()
    expect(metric(page, 'Students in active batches')).to_have_text('2')
    overview.get_by_role('group', name='Organization overview view').get_by_role('button', name='List view', exact=True).click()
    overview.get_by_role('searchbox', name='Search programs', exact=True).fill('Tourism')
    expect(overview.get_by_role('link', name='Open Entrepreneurship dashboard', exact=True)).to_have_count(0)
    overview.get_by_role('link', name='Open Tourism Management dashboard', exact=True).click()
    expect(page.get_by_role('region', name='Program skill highlights', exact=True)).to_be_visible()
    expect(metric(page, 'Students in active batches')).to_have_text('1')
    expect(page.get_by_role('heading', name='Synthetic Text Learner 1', exact=True)).to_be_visible()
    expect(page.get_by_role('heading', name='Synthetic Text Learner 0', exact=True)).to_have_count(0)
    report = page.get_by_role('link', name='View all program records', exact=True)
    query = parse_qs(urlparse(report.get_attribute('href')).query)
    assert query['institute_id'] == [str(tourism['institute_id'])] and query['program_id'] == [str(tourism['program_id'])]
    report.click()
    expect(page.get_by_role('heading', name='Reports & Analytics', exact=True)).to_be_visible()
    assert 'program_id=' + str(tourism['program_id']) in page.url
    page.go_back(wait_until='networkidle')
    expect(metric(page, 'Students in active batches')).to_have_text('1')
    print('PASS institute/program card keyboard flow, list/search, isolated student highlights and report scope')

    page.get_by_text('Recommendation maintenance', exact=True).click()
    page.get_by_role('button', name='Refresh recommendations for this scope', exact=True).click()
    dialog = page.get_by_role('dialog', name='Refresh recommendations for this scope?', exact=True)
    expect(dialog).to_contain_text('Tourism Management')
    dialog.get_by_role('button', name='Cancel', exact=True).click()
    assert not writes
    page.get_by_label('Batch scope', exact=True).select_option('archived')
    expect(metric(page, 'Students in archived batches')).to_have_text('0')
    page.get_by_text('Recommendation maintenance', exact=True).click()
    expect(page.get_by_role('button', name='Refresh recommendations for this scope', exact=True)).to_be_disabled()
    page.get_by_label('Institute', exact=True).select_option(str(third['institute_id']))
    expect(page.get_by_label('Program', exact=True)).to_have_value('')
    print('PASS secondary scoped maintenance confirmation, cancel safety, archived labels and dependent scope reset')

    page.goto(BASE + '/admin/dashboard', wait_until='networkidle')
    page.get_by_role('button', name='Pending retake requests', exact=False).click()
    dialog = page.get_by_role('dialog', name='Pending retake requests', exact=True)
    dialog.get_by_role('link').filter(has_text='Entrepreneurship').click()
    assert 'active_batches=1' in page.url
    expect(page.get_by_text('1 request', exact=True)).to_be_visible()
    expect(page.get_by_text('Active enrolled batches', exact=False).first).to_be_visible()
    page.get_by_role('link', name='Show all requests in this scope', exact=True).click()
    assert 'active_batches' not in page.url
    page.goto(BASE + '/admin/dashboard', wait_until='networkidle')
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
    page.get_by_role('link', name='Open Synthetic Empty Institute dashboard', exact=True).click()
    expect(metric(page, 'Students in active batches')).to_have_text('0')
    expect(page.get_by_text('No programs match this view.', exact=True)).to_be_visible()
    print('PASS invalid scope and genuinely empty institute remain explicit without global fallback')

    for width in (320, 390, 768, 1440):
        page.set_viewport_size({'width': width, 'height': 1000})
        page.goto(BASE + '/admin/dashboard', wait_until='networkidle')
        if width == 390:
            page.evaluate("document.documentElement.classList.add('dark')")
        expect(page.get_by_role('heading', name='Admin dashboard', exact=True)).to_be_visible()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.screenshot(path=str(OUT / f'school-dashboard-{width}.png'), full_page=True, animations='disabled')
    context.close()
    browser.close()
    assert not errors, errors
    print('PASS four light/dark responsive widths and zero browser page errors')
