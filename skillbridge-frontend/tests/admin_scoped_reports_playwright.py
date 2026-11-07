"""Real synthetic HTTP scopes, comparisons, exports and recovery for school reports."""
import csv
import io
import json
from urllib.parse import parse_qs, urlparse
from playwright.sync_api import expect, sync_playwright
from organization_playwright import BASE, OUT, api, errors, session


def download(page, kind, name):
    with page.expect_download() as event:
        page.get_by_role('button', name=f'Download displayed {kind.upper()}', exact=True).click()
    target = OUT / name
    event.value.save_as(target)
    return target


with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    context, page = session(browser)
    enterprise, tourism, third = json.loads((OUT / 'general-text.json').read_text(encoding='utf-8'))
    page.goto(BASE + '/admin/reports', wait_until='networkidle')
    expect(page.get_by_role('region', name='Institute comparison', exact=True)).to_be_visible()
    expect(page.get_by_label('Program', exact=True)).to_be_disabled()
    expect(page.get_by_label('Batch', exact=True)).to_be_disabled()
    expect(page.get_by_label('Instructor', exact=True)).to_be_hidden()
    data = api(context, '/api/management/analytics/').json()
    comparison = page.get_by_role('region', name='Institute comparison table', exact=True)
    ibpa = next(row for row in data['options']['institutes'] if row['id'] == enterprise['institute_id'])
    button = comparison.get_by_role('button', name=ibpa['name'], exact=True)
    expect(button).to_be_visible()
    button.press('Enter')
    expect(page.get_by_role('region', name='Program comparison', exact=True)).to_be_visible()
    expect(page.get_by_label('Institute', exact=True)).to_have_value(str(enterprise['institute_id']))
    page.get_by_role('region', name='Program comparison table', exact=True).get_by_role('button', name='Tourism Management', exact=True).click()
    expect(page.get_by_label('Program', exact=True)).to_have_value(str(tourism['program_id']))
    expect(page.get_by_role('region', name='Program comparison', exact=True)).to_have_count(0)
    page.get_by_label('Batch', exact=True).select_option(str(tourism['batch_id']))
    for tab in ('Skills', 'Placements', 'Assessments'):
        page.get_by_role('button', name=tab, exact=True).click()
        assert parse_qs(urlparse(page.url).query)['batch_id'] == [str(tourism['batch_id'])]
    page.get_by_text('More scope filters', exact=True).click()
    expect(page.get_by_label('Instructor', exact=True)).to_be_visible()
    page.get_by_label('Institute', exact=True).select_option(str(third['institute_id']))
    expect(page.get_by_label('Program', exact=True)).to_have_value('')
    expect(page.get_by_label('Batch', exact=True)).to_have_value('')
    assert not parse_qs(urlparse(page.url).query).get('instructor_id')
    print('PASS keyboard institute/program/batch drilldown, tab context and dependent scope resets')

    page.goto(BASE + '/admin/reports?group=organizations', wait_until='networkidle')
    records = page.get_by_role('region', name='Analytics records', exact=True)
    expect(records.get_by_role('heading', name='Institute comparison', exact=True)).to_be_visible()
    records.get_by_label('Search organizations', exact=True).fill('Empty Institute')
    expect(records.get_by_role('cell', name='Synthetic Empty Institute', exact=True)).to_be_visible()
    export = download(page, 'csv', 'empty-institute-comparison.csv')
    text = export.read_text(encoding='utf-8-sig')
    rows = list(csv.reader(io.StringIO(text)))
    row = next(row for row in rows if row and row[0] == 'Synthetic Empty Institute')
    assert row[1:] == ['0', '0', '', '0', ''], row
    assert 'Distinct students' in text and 'Generated' in text and 'All institutes' in text
    assert 'Student records view' not in records.inner_text()
    records.get_by_label('Search organizations', exact=True).fill('')
    records.get_by_role('button', name='Sort by Institute', exact=True).click()
    records.get_by_role('button', name='Sort by Institute', exact=True).click()
    ordered = list(csv.reader(io.StringIO(download(page, 'csv', 'all-institutes-descending.csv').read_text(encoding='utf-8-sig'))))
    header = next(i for i, row in enumerate(ordered) if row[:2] == ['Institute', 'Students'])
    assert [row[0] for row in ordered[header + 1:]] == sorted([row['name'] for row in data['options']['institutes']], reverse=True)
    print('PASS comparison search, zero denominators, matching CSV and no student-only view controls')

    options = api(context, '/api/management/analytics/').json()['options']
    empty = next(row for row in options['programs'] if row['name'] == 'Empty program')
    page.goto(BASE + f'/admin/reports?institute_id={empty["institute_id"]}&program_id={empty["id"]}', wait_until='networkidle')
    scope = page.get_by_role('region', name='Report scope', exact=True)
    expect(scope).to_contain_text('Program: Empty program')
    expect(scope).to_contain_text('Batches: none')
    text = download(page, 'csv', 'empty-program.csv').read_text(encoding='utf-8-sig')
    assert 'Program: Empty program' in text and ibpa['name'] in text and 'active' in text
    pdf = download(page, 'pdf', 'empty-program.pdf').read_bytes()
    assert pdf.startswith(b'%PDF') and b'Empty program' in pdf and b'Generated' in pdf
    print('PASS saved empty program choice and actual CSV/PDF scope metadata')

    page.goto(BASE + '/admin/reports?institute_id=999999&program_id=999999', wait_until='networkidle')
    expect(page.get_by_role('alert').first).to_be_visible()
    expect(page.get_by_role('region', name='Analytics records', exact=True)).to_have_count(0)
    page.goto(BASE + f'/admin/reports?institute_id={third["institute_id"]}&program_id={tourism["program_id"]}', wait_until='networkidle')
    expect(page.get_by_role('alert').first).to_be_visible()
    expect(page.get_by_role('region', name='Analytics records', exact=True)).to_have_count(0)
    print('PASS invalid and mismatched scopes never become a school-wide report')

    ic = next(row for row in options['institutes'] if row['code'] == 'IC')
    page.goto(BASE + f'/admin/reports?institute_id={ic["id"]}', wait_until='networkidle')
    expect(page.get_by_role('region', name='Program comparison table', exact=True)).to_contain_text('Shared institute batches')
    mixed = next(row for row in options['batches'] if row['name'] == 'Existing IC mixed batch')
    page.get_by_label('Batch', exact=True).select_option(str(mixed['id']))
    expect(page.get_by_role('region', name='Report scope', exact=True)).to_contain_text('Existing IC mixed batch')
    print('PASS existing mixed IC data remains in ordinary shared institute records')

    page.goto(BASE + f'/admin/reports?institute_id={ibpa["id"]}&program_id={tourism["program_id"]}', wait_until='networkidle')
    old_name = tourism['program_name'] if 'program_name' in tourism else 'Tourism Management'
    renamed = old_name + ' reviewed'
    response = api(context, f'/api/admin/institutes/{ibpa["id"]}/programs/{tourism["program_id"]}/', 'patch', {'name': renamed})
    assert response.status == 200, response.text()
    downloads = []
    page.on('download', lambda event: downloads.append(event))
    page.get_by_role('button', name='Download displayed CSV', exact=True).click()
    expect(page.get_by_text('The report changed. Review the updated records before downloading.', exact=False)).to_be_visible()
    expect(page.get_by_role('region', name='Report scope', exact=True)).to_contain_text(renamed)
    assert not downloads
    api(context, f'/api/admin/institutes/{ibpa["id"]}/programs/{tourism["program_id"]}/', 'patch', {'name': old_name})
    print('PASS renamed scope is detected by export freshness checks before file creation')

    page.route('**/api/management/analytics/**', lambda route: route.fulfill(status=503, json={'error': 'Synthetic report outage'}))
    page.get_by_label('Batch status', exact=True).select_option('archived')
    expect(page.get_by_role('alert').filter(has_text='The report could not be updated.')).to_be_visible()
    expect(page.get_by_role('button', name='Download displayed CSV', exact=True)).to_be_disabled()
    expect(page.get_by_text('The new filters have not been applied to these results.', exact=False)).to_be_visible()
    page.unroute('**/api/management/analytics/**')
    page.get_by_role('button', name='Retry report', exact=True).click()
    expect(page.get_by_role('alert').filter(has_text='The report could not be updated.')).to_have_count(0)
    expect(page.get_by_role('region', name='Report scope', exact=True)).to_contain_text('archived')
    print('PASS failed scope change retains an explicit old snapshot, blocks export and supports retry')

    page.goto(BASE + '/admin/reports', wait_until='networkidle')
    for tab in ('Assessments', 'Skills', 'Placements'):
        page.get_by_role('button', name=tab, exact=True).click()
        for width in (320, 390, 768, 1440):
            page.set_viewport_size({'width': width, 'height': 1000})
            page.evaluate('(dark) => document.documentElement.classList.toggle("dark",dark)', width == 390)
            page.wait_for_function('document.documentElement.scrollWidth <= innerWidth', timeout=5000)
            page.get_by_role('heading', name='Reports & Analytics', exact=True).scroll_into_view_if_needed()
            page.screenshot(path=str(OUT / f'reports-{tab.lower()}-{width}.png'), full_page=True, animations='disabled')
    expect(page.get_by_role('button', name='Advanced: recommendation model and evaluation', exact=True)).to_be_visible()
    context.close()
    print('PASS all three report sections at four responsive widths, dark mode and retained advanced tools')

    instructor, page = session(browser, 'instructor')
    page.goto(BASE + '/instructor/reports', wait_until='networkidle')
    expect(page.get_by_role('region', name='Institute comparison', exact=True)).to_have_count(0)
    expect(page.get_by_role('button', name='Advanced: recommendation model and evaluation', exact=True)).to_have_count(0)
    expect(page.get_by_label('Program', exact=True).locator(f'option[value="{tourism["program_id"]}"]')).to_have_count(0)
    instructor.close()
    instructor, page = session(browser, 'other_instructor')
    page.goto(BASE + '/instructor/reports', wait_until='networkidle')
    page.get_by_label('Program', exact=True).select_option(str(tourism['program_id']))
    expect(page.get_by_label('Batch', exact=True).locator('option').filter(has_text='Existing IC mixed batch')).to_have_count(0)
    expect(page.get_by_role('region', name='Report scope', exact=True)).to_contain_text('Program: Tourism Management')
    instructor.close()
    browser.close()
    assert not errors, errors
    print('PASS instructor report selection remains private and contains no admin tools')
