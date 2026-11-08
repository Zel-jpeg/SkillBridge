"""Exercise the shared import review with a real isolated assessment API."""
import os
import re
import uuid
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

from organization_playwright import AUTH, BASE, OUT, checks, errors, session
from program_batches_playwright import call


def setup(browser):
    context, _ = session(browser)
    institute = call(context, '/api/admin/institutes/', 'post', {'code': 'IMPORT', 'name': 'Synthetic Institute for Imports'}, status=201)
    programs = f'/api/admin/institutes/{institute["id"]}/programs/'
    program = call(context, programs, 'post', {'code': 'IMPRT', 'name': 'Synthetic Import Program'}, status=201)
    call(context, programs + f'{program["id"]}/instructors/', 'post', {'instructor_id': AUTH['instructor']['user']['id']}, status=201)
    frameworks = f'/api/management/programs/{program["id"]}/frameworks/'
    framework = call(context, frameworks, 'post', {'name': 'Reviewed import framework', 'request_id': str(uuid.uuid4())}, role='instructor', status=201)
    categories = [call(context, frameworks + f'{framework["id"]}/categories/', 'post', {
        'name': name, 'description': 'Reviewed practical records for synthetic tests.', 'tags': ['Record checking'],
    }, role='instructor', status=201) for name in ('Records knowledge', 'Service knowledge')]
    batch = call(context, '/api/instructor/batches/', 'post', {'name': 'Synthetic import cohort', 'program_id': program['id']}, role='instructor', status=201)
    context.close()
    return framework, categories, batch


def fill_creator(page, role, batch, framework, title):
    page.goto(BASE + f'/{role}/assessment/create?batch_id={batch["id"]}', wait_until='networkidle')
    page.get_by_placeholder('e.g. OJT Skills Assessment 2026–2027').fill(title)
    page.get_by_placeholder('e.g. 60', exact=True).fill('30')
    framework_select = page.get_by_role('combobox', name='Program skill set', exact=True)
    expect(framework_select).to_have_value(str(framework['id']))
    page.get_by_role('button', name='Upload file', exact=True).click()
    panel = page.get_by_role('region', name='Import questions', exact=True)
    expect(panel.get_by_label('Question import format', exact=True)).to_have_value('aiken')
    return panel


def upload(panel, text, name='synthetic-import.txt'):
    panel.get_by_label('Question import file', exact=True).set_input_files({
        'name': name, 'mimeType': 'text/plain', 'buffer': text.encode('utf-8'),
    })


def question_list(context, assessment_id, role='admin'):
    return call(context, f'/api/instructor/assessments/{assessment_id}/questions/', role=role)['questions']


def assessment_by_title(context, title, role='admin'):
    return next(row for row in call(context, '/api/instructor/assessments/', role=role) if row['title'] == title)


def run(browser):
    framework, categories, batch = setup(browser)
    records, service = categories
    context, page = session(browser, 'instructor')
    panel = fill_creator(page, 'instructor', batch, framework, 'Imported AIKEN draft')
    sample = os.environ.get('SKILLBRIDGE_AIKEN_SAMPLE')
    source = Path(sample).read_bytes().decode('utf-8-sig') if sample else '\n\n'.join(
        f'Synthetic prompt {index + 1}?\nA. Alpha\nB. Beta\nC. Gamma\nD. Delta\nANSWER: {"ABCD"[index % 4]}'
        for index in range(20)
    )
    if sample:
        panel.get_by_label('Question import file', exact=True).set_input_files(sample)
    else:
        upload(panel, source)
    expect(panel.get_by_text('20 reviewed · 20 valid · 0 with errors · 20 unmapped', exact=False)).to_be_visible()
    panel.get_by_label('Category for selected questions').select_option(str(records['id']))
    panel.get_by_role('button', name='Apply category to selected', exact=True).click()
    panel.get_by_label('Category for question 2', exact=True).select_option(str(service['id']))
    expect(panel.get_by_text('0 unmapped · 20 selected', exact=False)).to_be_visible()
    panel.get_by_role('button', name='Add 20 questions to draft', exact=True).click()
    assert not any(row['title'] == 'Imported AIKEN draft' for row in call(context, '/api/instructor/assessments/', role='instructor'))
    page.get_by_role('button', name='Save draft', exact=True).click()
    expect(page.get_by_role('heading', name='Assessment saved as a draft!', exact=True)).to_be_visible()
    assessment = assessment_by_title(context, 'Imported AIKEN draft', 'instructor')
    questions = question_list(context, assessment['id'], 'instructor')
    original = [block.splitlines() for block in re.split(r'\r?\n\s*\r?\n', source.strip())]
    assert len(questions) == len(original) == 20
    for index, (question, expected) in enumerate(zip(questions, original)):
        assert question['question_text'] == expected[0].strip() and question['question_type'] == 'mcq'
        assert [choice['text'] for choice in question['choices']] == [line[3:].strip() for line in expected[1:-1]]
        assert [choice['is_correct'] for choice in question['choices']] == [letter == expected[-1].strip()[-1] for letter in 'ABCD']
        assert question['category']['id'] == (service['id'] if index == 1 else records['id'])
    checks.append(f'{"supplied DNSC file" if sample else "synthetic DNSC-shaped file"} stages and saves all 20 exact keys and ordered options with bulk and individual category IDs')

    page.goto(BASE + '/instructor/assessments', wait_until='networkidle')
    page.get_by_role('button', name='Open assessment Imported AIKEN draft', exact=True).click()
    editor = page.get_by_role('dialog', name='Edit assessment', exact=True)
    editor.get_by_role('button', name='Import questions', exact=True).click()
    panel = page.get_by_role('dialog', name='Import questions', exact=True)
    mixed = 'Missing choice?\nA. One\nANSWER: A\n\nMay tala ba sa café?\nA) True\nB) False\nANSWER: B'
    upload(panel, mixed)
    expect(panel.get_by_text('2 reviewed · 1 valid · 1 with errors', exact=False)).to_be_visible()
    expect(panel.get_by_role('button', name='Add 0 questions to draft', exact=True)).to_be_disabled()
    panel.get_by_role('button', name='Cancel import', exact=True).click()
    assert len(question_list(context, assessment['id'], 'instructor')) == 20
    editor.get_by_role('button', name='Import questions', exact=True).click()
    upload(panel, mixed)
    panel.get_by_label('Select question 2', exact=True).check()
    panel.get_by_role('button', name='Add 1 question to draft', exact=True).click()
    editor.get_by_role('combobox', name='Publication state').select_option('published')
    editor.get_by_role('button', name='Save All Changes', exact=True).click()
    with page.expect_response(lambda response: response.request.method == 'PATCH' and f'/assessments/{assessment["id"]}/' in response.url) as response:
        page.get_by_role('button', name='Confirm Save', exact=True).click()
    assert response.value.status == 400
    assert len(question_list(context, assessment['id'], 'instructor')) == 20
    editor.get_by_role('combobox', name='Publication state').select_option('draft')
    editor.get_by_role('button', name='Save All Changes', exact=True).click()
    page.get_by_role('button', name='Confirm Save', exact=True).click()
    expect(editor.get_by_role('button', name='Save All Changes', exact=True)).to_be_enabled()
    saved = question_list(context, assessment['id'], 'instructor')
    assert len(saved) == 21 and saved[-1]['category'] is None and saved[-1]['question_type'] == 'mcq'
    assert [choice['is_correct'] for choice in saved[-1]['choices']] == [False, True]
    checks.append('instructor edit requires explicit partial selection, cancels safely and retains an unmapped two-choice MCQ as draft after atomic publication rejection')
    context.close()

    context, page = session(browser, 'admin', width=390, dark=True)
    panel = fill_creator(page, 'admin', batch, framework, 'Admin native import draft')
    guide = panel.locator('summary', has_text='Question import guide')
    example = panel.locator('pre')
    expect(example).to_be_hidden()
    guide.press('Enter')
    expect(example).to_contain_text('ANSWER: A')
    panel.get_by_label('Question import format', exact=True).select_option('native')
    expect(example).to_contain_text('TYPE: truefalse')
    expect(example).to_contain_text('TYPE: identification')
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
    guide.scroll_into_view_if_needed()
    page.screenshot(path=str(OUT / 'question-import-guide-phone-dark.png'), animations='disabled')
    guide.press('Space')
    expect(example).to_be_hidden()
    checks.append('The phone import guide opens with the keyboard, follows the selected format and closes without changing it.')
    upload(panel, '# Native format\nQUESTION: The record exists.\nTYPE: truefalse\nCORRECT: False\nCATEGORY: Records knowledge\n---\nQUESTION: Entries in an empty record?\nTYPE: identification\nCORRECT: 0\nCATEGORY: Service knowledge')
    panel.get_by_role('button', name='Add 2 questions to draft', exact=True).click()
    page.get_by_role('button', name='Save draft', exact=True).click()
    expect(page.get_by_role('heading', name='Assessment saved as a draft!', exact=True)).to_be_visible()
    native = assessment_by_title(context, 'Admin native import draft')
    saved = question_list(context, native['id'])
    assert [row['question_type'] for row in saved] == ['truefalse', 'identification']
    assert [next(choice['text'] for choice in row['choices'] if choice['is_correct']) for row in saved] == ['False', '0']

    page.goto(BASE + f'/admin/assessments?institute={batch["institute_id"]}&program={batch["program_id"]}', wait_until='networkidle')
    page.get_by_role('button', name='View details for Admin native import draft', exact=True).click()
    page.get_by_role('tab', name='Questions', exact=False).click()
    page.get_by_role('button', name='Edit assessment and questions', exact=True).click()
    editor = page.get_by_role('dialog', name='Edit assessment: Admin native import draft', exact=True)
    editor.get_by_role('button', name='Import questions', exact=True).click()
    panel = editor.get_by_role('region', name='Import questions', exact=True)
    expect(panel.get_by_label('Question import format', exact=True)).to_have_value('aiken')
    upload(panel, 'Which record is reviewed?\nA. Current record\nB. Old record\nANSWER: A')
    panel.get_by_label('Category for question 1', exact=True).select_option(str(records['id']))
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
    panel.get_by_label('Category for question 1', exact=True).scroll_into_view_if_needed()
    page.screenshot(path=str(OUT / 'aiken-review-phone-dark.png'), animations='disabled')
    panel.get_by_role('button', name='Add 1 question to draft', exact=True).click()
    assert len(question_list(context, native['id'])) == 2
    save_url = f'**/api/instructor/assessments/{native["id"]}/'

    def fail_once(route):
        if route.request.method == 'PATCH':
            route.fulfill(status=409, json={'error': 'Synthetic save conflict. Try again.'})
        else:
            route.fallback()

    page.route(save_url, fail_once)
    for retry in (False, True):
        editor.get_by_role('button', name='Review & save authoring', exact=True).click()
        page.get_by_role('dialog', name='Save assessment authoring?', exact=True).get_by_role('button', name='Save changes', exact=True).click()
        if not retry:
            expect(editor.get_by_text('Synthetic save conflict. Try again.', exact=True)).to_be_visible()
            assert len(question_list(context, native['id'])) == 2
            page.unroute(save_url, fail_once)
    expect(editor).to_have_count(0)
    saved = question_list(context, native['id'])
    assert len(saved) == 3 and saved[-1]['category']['id'] == records['id']
    denied = call(context, f'/api/instructor/assessments/{native["id"]}/questions/', role='student', status=403)
    assert 'questions' not in denied
    checks.append('admin creates a native mixed draft and appends AIKEN on phone; a rejected save keeps the draft retryable and students cannot read keys')
    context.close()


if __name__ == '__main__':
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel='chrome', headless=True)
        run(browser)
        browser.close()
    assert not errors, errors
    for check in checks:
        print(f'PASS {check}')
