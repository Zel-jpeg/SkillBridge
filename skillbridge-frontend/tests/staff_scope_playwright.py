"""Admin institute and program navigation against the real synthetic API."""
import json

from playwright.sync_api import expect, sync_playwright
from organization_playwright import BASE, OUT, errors, session


def scope(page, label='Institute and program scope'):
    return page.get_by_role('group', name=label, exact=True)


def choose(page, institute, program=None):
    group = scope(page)
    group.get_by_label('Institute', exact=True).select_option(str(institute))
    if program:
        group.get_by_label('Program', exact=True).select_option(str(program))


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel='chrome', headless=True)
    context, page = session(browser)
    enterprise, tourism, third = json.loads((OUT / 'general-text.json').read_text(encoding='utf-8'))
    page.goto(BASE + '/admin/competencies', wait_until='networkidle')
    expect(page.get_by_role('heading', name='Skill taxonomy', exact=True)).to_be_visible()
    choose(page, tourism['institute_id'], tourism['program_id'])
    expect(scope(page).get_by_role('option', name=third['name'], exact=False)).to_have_count(0)
    page.get_by_role('button', name='Open v1', exact=True).click()
    expect(page.get_by_text('Service communication', exact=True)).to_be_visible()
    expect(page.get_by_text('Market analysis', exact=True)).to_have_count(0)
    page.get_by_role('link', name='Legacy IC taxonomy', exact=True).click()
    expect(page.get_by_text('Synthetic IC legacy skill', exact=True)).to_be_visible()
    print('PASS taxonomy selects the program library and provides a separate path to legacy IC skills')

    page.goto(BASE + '/admin/companies', wait_until='networkidle')
    scope(page).get_by_label('Institute', exact=True).select_option(label='Institute of Computing')
    expect(page.get_by_role('heading', name='Synthetic IC legacy partner')).to_be_visible()
    expect(page.get_by_role('heading', name='Synthetic cross-program partner')).to_have_count(0)
    choose(page, tourism['institute_id'], tourism['program_id'])
    expect(page.get_by_role('heading', name=f"Synthetic {enterprise['name']} opportunity")).to_be_visible()
    expect(page.get_by_role('heading', name=f"Synthetic {tourism['name']} opportunity")).to_be_visible()
    expect(page.get_by_role('heading', name=f"Synthetic {third['name']} opportunity")).to_have_count(0)
    page.get_by_role('button', name='List view', exact=True).click()
    expect(page.get_by_role('heading', name='Synthetic cross-program partner')).to_be_visible()
    expect(scope(page).get_by_label('Program', exact=True)).to_have_value(str(tourism['program_id']))
    page.screenshot(path=str(OUT / 'admin-partners-program.png'), animations='disabled')
    print('PASS IC catalog and shared program opening filters preserve scope when switching views')

    page.goto(BASE + '/admin/assessments', wait_until='networkidle')
    scope(page).get_by_label('Institute', exact=True).select_option(label='Institute of Computing')
    expect(page.get_by_role('button', name='View details for Synthetic IC mixed assessment')).to_be_visible()
    choose(page, tourism['institute_id'], tourism['program_id'])
    expect(page.get_by_role('button', name=f"View details for {tourism['assessment_title']}")).to_be_visible()
    expect(page.get_by_role('button', name=f"View details for {enterprise['assessment_title']}")).to_have_count(0)
    print('PASS assessment oversight follows the recorded batch or framework, including mixed IC institute scope')

    page.goto(BASE + '/admin/batches', wait_until='networkidle')
    scope(page).get_by_label('Institute', exact=True).select_option(label='Institute of Computing')
    expect(page.get_by_role('button').filter(has_text='Existing IC mixed batch')).to_be_visible()
    choose(page, tourism['institute_id'], tourism['program_id'])
    expect(page.get_by_role('button').filter(has_text=tourism['batch_name'])).to_be_visible()
    expect(page.get_by_role('button').filter(has_text=enterprise['batch_name'])).to_have_count(0)
    print('PASS batch collection filters by recorded institute and program')

    page.goto(BASE + '/admin/placements', wait_until='networkidle')
    choose(page, tourism['institute_id'], tourism['program_id'])
    page.get_by_role('button', name='Open partner Synthetic cross-program partner').click()
    expect(page.get_by_text('0 available for suggestions', exact=False).first).to_be_visible()
    page.get_by_role('button', name='Decision history', exact=True).click()
    expect(page.get_by_text('Synthetic Text Learner 1', exact=True).first).to_be_visible()
    expect(page.get_by_text('Synthetic Text Learner 0', exact=True)).to_have_count(0)
    print('PASS placement history filters by recorded program while a shared opening keeps both approvals')
    page.get_by_role('button', name='Download reports', exact=True).click()
    report_scope = scope(page).first
    report_scope.get_by_label('Institute', exact=True).select_option(str(tourism['institute_id']))
    report_scope.get_by_label('Program', exact=True).select_option(str(tourism['program_id']))
    with page.expect_download() as download, page.expect_response(lambda response: '/api/placements/reports/' in response.url) as report:
        page.get_by_role('button', name='Download XLSX', exact=True).click()
    assert report.value.ok
    summary = report.value.json()['summary']
    assert summary['total_records'] == 1 and summary['approved_count'] == 2 and summary['remaining_slots'] == 0
    assert download.value.failure() is None
    print('PASS scoped placement export downloads one program record with the global occupancy of its shared opening')
    context.close()
    browser.close()
    assert not errors, errors
