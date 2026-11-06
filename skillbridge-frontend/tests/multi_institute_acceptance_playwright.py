"""Accept the whole program flow through normal APIs and production Chrome views."""
import csv
import json
import re

from playwright.sync_api import expect, sync_playwright

from organization_playwright import AUTH, BASE, OUT, checks, errors, session
from program_batches_playwright import call


def complete_assessment(browser, scenario, foreign, phone):
    role = scenario['auth']
    context, page = session(browser, role, width=390 if phone else 1440, dark=phone, mobile=phone)
    profile = call(context, '/api/students/me/', role=role)
    assert profile['program']['id'] == scenario['program_id']
    foreign_start = f'/api/assessments/{foreign["assessment_id"]}/start/'
    call(context, foreign_start, 'post', {}, role=role, status=404)
    prefix = f'/api/assessments/{scenario["assessment_id"]}/'
    before = call(context, '/api/student/results/combined/', role=role)
    assert not before['is_finalized'] and before['recommendations'] == []
    attempt = call(context, prefix + 'start/', 'post', {}, role=role)
    answers = []
    for question in attempt['questions']:
        assert all(set(choice) == {'id', 'text'} for choice in question['choices'])
        correct = next(choice['id'] for choice in question['choices'] if choice['text'] == 'Reviewed answer')
        answers.append({'question_id': question['id'], 'selected_choice_id': correct})
    submission = {'answers': answers, 'response_id': attempt['response_id'], 'attempt_started_at': attempt['attempt_started_at']}
    if scenario['name'] == 'Tourism Management':
        # The same backend attempt is taken through the real phone UI, including
        # local draft persistence and the server's interruption recovery path.
        page.goto(BASE + f'/student/assessments/{scenario["assessment_id"]}/take', wait_until='networkidle')
        page.get_by_role('checkbox').check()
        page.get_by_role('button', name='Agree & start', exact=True).click()
        page.get_by_role('button', name=re.compile('Reviewed answer')).click()
        expect(page.get_by_role('button', name='Next →', exact=True)).to_be_enabled()
        page.reload(wait_until='networkidle')
        page.get_by_role('checkbox').check()
        page.get_by_role('button', name='Agree & start', exact=True).click()
        expect(page.get_by_role('heading', name='Assessment interrupted', exact=True)).to_be_visible()
        page.get_by_role('button', name='Resume assessment', exact=True).click()
        expect(page.get_by_role('button', name='Next →', exact=True)).to_be_enabled()
        resumed = call(context, prefix + 'start/', 'post', {}, role=role)
        assert resumed['attempt_started_at'] == attempt['attempt_started_at'] and resumed['response_id'] == attempt['response_id']
        for index in range(10):
            page.get_by_role('button', name=re.compile('Reviewed answer')).click()
            page.get_by_role('button', name='Review answers' if index == 9 else 'Next →', exact=True).click()
        expect(page.get_by_role('heading', name='Review your answers', exact=True)).to_be_visible()
        page.screenshot(path=str(OUT / 'tourism-real-assessment-review-phone.png'), full_page=True, animations='disabled')
        page.get_by_role('button', name='Submit', exact=True).click()
        with page.expect_response(lambda response: response.request.method == 'POST' and prefix + 'submit/' in response.url) as response:
            page.get_by_role('button', name='Yes, submit', exact=True).click()
        assert response.value.status == 200
        graded = response.value.json()
        checks.append('Tourism phone UI: agreement, saved answer, reload, server recovery, same timed attempt, review and real submission.')
    else:
        graded = call(context, prefix + 'submit/', 'post', submission, role=role)
    assert len(answers) == 10 and graded['all_required_completed'] and not graded['recommendations_locked']
    call(context, prefix + 'submit/', 'post', submission, role=role, status=409)
    result = call(context, '/api/student/results/combined/', role=role)
    assert result['is_finalized'] and result['overall_percentage'] == 100
    assert [row['position_id'] for row in result['recommendations']] == [scenario['position_id']]
    ranking = result['recommendations'][0]['assessment_details']['ranking_inputs']
    assert ranking['program_id'] == scenario['program_id'] and ranking['framework_version'] == 1

    page.goto(BASE + '/student/results', wait_until='networkidle')
    expect(page.get_by_role('button', name='Recommendation Order', exact=True)).to_be_visible()
    expect(page.get_by_text('1 partner · 1 suggested position', exact=True)).to_be_visible()
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
    page.screenshot(path=str(OUT / f'{role}-result.png'), animations='disabled', full_page=True)
    context.close()
    checks.append(f'{scenario["name"]}: student scope, real submission, retry rejection, final score and eligible ranking.')


def staff_checks(browser, enterprise, tourism, third):
    admin, page = session(browser)
    assert enterprise['institute_id'] == tourism['institute_id'] != third['institute_id']
    for scenario, role in ((enterprise, 'instructor'), (tourism, 'other_instructor')):
        categories = f'/api/management/programs/{scenario["program_id"]}/frameworks/{scenario["framework_id"]}/categories/'
        row = next(row for row in call(admin, categories, role=role)['results'] if row['name'] == 'Shared records')
        scenario['shared_category'] = row['id']
    assert enterprise['shared_category'] != tourism['shared_category']

    grant_path = f'/api/admin/institutes/{enterprise["institute_id"]}/programs/{enterprise["program_id"]}/instructors/'
    call(admin, grant_path, 'post', {'instructor_id': AUTH['other_instructor']['user']['id']}, status=201)
    categories = f'/api/management/programs/{enterprise["program_id"]}/frameworks/{enterprise["framework_id"]}/categories/'
    assert len(call(admin, categories, role='other_instructor')['results']) == 2
    export = f'/api/instructor/assessments/{enterprise["assessment_id"]}/questionnaire-export/'
    call(admin, export, role='other_instructor', status=404)
    call(admin, export, role=enterprise['auth'], status=403)
    call(admin, f'/api/instructor/batches/{tourism["batch_id"]}/students/', role='instructor', status=404)
    checks.append('Same-program category reuse preserves private roster and grading-key boundaries.')

    page.goto(BASE + '/admin/reports?tab=assessments&group=assessments', wait_until='networkidle')
    page.get_by_role('combobox', name='Institute', exact=True).select_option(str(enterprise['institute_id']))
    page.get_by_role('button', name='Assessment table', exact=True).click()
    records = page.get_by_role('region', name='Analytics records')
    expect(records.get_by_text(enterprise['assessment_title'], exact=True)).to_be_visible()
    expect(records.get_by_text(tourism['assessment_title'], exact=True)).to_be_visible()
    expect(records.get_by_text(third['assessment_title'], exact=True)).to_have_count(0)
    with page.expect_download() as download:
        records.get_by_role('button', name='Download displayed CSV', exact=True).click()
    report = OUT / 'ibpa-assessments.csv'
    download.value.save_as(str(report))
    with report.open(encoding='utf-8-sig', newline='') as stream:
        rows = list(csv.reader(stream))
    data = [row for row in rows if row and row[0] in {item['assessment_title'] for item in (enterprise, tourism, third)}]
    assert {row[0] for row in data} == {enterprise['assessment_title'], tourism['assessment_title']}
    header = next(row for row in rows if row and row[0] == 'Assessment')
    submitted_column = header.index('Valid submitted')
    assert all(row[submitted_column] == '1' for row in data)
    page.screenshot(path=str(OUT / 'ibpa-assessment-report.png'), animations='disabled', full_page=True)
    checks.append('Admin institute-scoped CSV contains the two IBPA assessment rows and their actual submission counts.')

    payload = {'student_id': enterprise['student_id'], 'batch_id': enterprise['batch_id'], 'position_id': tourism['position_id']}
    call(admin, '/api/placements/manual-assign/', 'post', payload, status=409)
    payload['position_id'] = enterprise['position_id']
    approved = call(admin, '/api/placements/manual-assign/', 'post', payload, status=201)
    assert approved['placement']['status'] == 'approved'
    scoped = call(admin, f'/api/management/analytics/?program_id={enterprise["program_id"]}')
    assert scoped['summary']['approved'] == 1 and scoped['summary']['slots_remaining'] == 0
    checks.append('Coordinator approval rejects a sibling program opening and consumes a slot in the eligible opening.')

    page.goto(BASE + '/admin/batches', wait_until='networkidle')
    page.get_by_role('textbox', name='Search batches').fill('Institute of Computing')
    card = page.get_by_role('region', name='Batch collection').get_by_role('button').filter(has_text='Existing IC mixed batch')
    expect(card.locator('.batch-status')).to_contain_text('Active')
    expect(card.get_by_text('2 students', exact=True)).to_be_visible()
    checks.append('Existing mixed IC cohort remains in normal active use alongside the new programs.')
    admin.close()


if __name__ == '__main__':
    scenarios = json.loads((OUT / 'general-text.json').read_text(encoding='utf-8'))
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel='chrome', headless=True)
        try:
            for index, scenario in enumerate(scenarios):
                complete_assessment(browser, scenario, scenarios[(index + 1) % len(scenarios)], phone=index > 0)
            staff_checks(browser, *scenarios)
        finally:
            browser.close()
    assert not errors, errors
    for check in checks:
        print(f'PASS {check}')
