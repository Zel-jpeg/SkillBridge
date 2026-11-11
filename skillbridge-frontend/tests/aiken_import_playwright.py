"""Exercise the shared import review with a real isolated assessment API."""
import os
import re
import shutil
import subprocess
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


def open_creator(page, role, batch, framework, title):
    page.goto(BASE + f'/{role}/assessment/create?batch_id={batch["id"]}', wait_until='networkidle')
    page.get_by_placeholder('e.g. OJT Skills Assessment 2026–2027').fill(title)
    page.get_by_placeholder('e.g. 60', exact=True).fill('30')
    framework_select = page.get_by_role('combobox', name='Program skill set', exact=True)
    expect(framework_select).to_have_value(str(framework['id']))


def open_upload(page):
    page.get_by_role('button', name='Upload file', exact=True).click()
    panel = page.get_by_role('region', name='Import questions', exact=True)
    expect(panel.get_by_role('button', name='AIKEN (.txt)', exact=True)).to_have_attribute('aria-pressed', 'true')
    return panel


def fill_creator(page, role, batch, framework, title):
    open_creator(page, role, batch, framework, title)
    return open_upload(page)


def upload(panel, text, name='synthetic-import.txt'):
    panel.get_by_label('Question import file', exact=True).set_input_files({
        'name': name, 'mimeType': 'text/plain', 'buffer': text.encode('utf-8'),
    })


def question_list(context, assessment_id, role='admin'):
    return call(context, f'/api/instructor/assessments/{assessment_id}/questions/', role=role)['questions']


def assessment_by_title(context, title, role='admin'):
    return next(row for row in call(context, '/api/instructor/assessments/', role=role) if row['title'] == title)


def publish_mixed_assessment(context, page, batch, framework, categories):
    title = 'Manual and imported questions together'
    records, service = categories
    open_creator(page, 'instructor', batch, framework, title)
    page.get_by_placeholder('Choice A', exact=True).fill('Original choice entered before the stem')
    panel = open_upload(page)
    upload(panel, 'Imported question?\nA. Old record\nB. Confirmed record\nANSWER: B')
    panel.get_by_role('button', name='Review questions', exact=True).click()
    panel.get_by_role('region', name='Question review').get_by_role('button', name=service['name'], exact=True).click()
    panel.get_by_role('button', name='Add 1 question to draft', exact=True).click()
    page.get_by_text('No question text yet…', exact=True).click()
    expect(page.get_by_placeholder('Choice A', exact=True)).to_have_value('Original choice entered before the stem')
    question = page.get_by_placeholder('Type the question here…', exact=True)
    question.fill('Manual multiple choice?')
    page.get_by_placeholder('Choice B', exact=True).fill('Other choice')
    page.get_by_role('button', name='A', exact=True).click()
    page.get_by_role('button', name=records['name'], exact=True).click()

    page.get_by_role('button', name='Add True / False', exact=True).click()
    question.fill('Manual true or false?')
    page.get_by_role('button', name='False', exact=True).click()
    page.get_by_role('button', name=records['name'], exact=True).click()
    page.get_by_role('button', name='Add Identification', exact=True).click()
    question.fill('Manual identification?')
    page.get_by_role('button', name=service['name'], exact=True).click()
    expect(page.get_by_title('Has errors', exact=True)).to_have_count(0)
    page.get_by_role('button', name='Collapse all', exact=True).click()
    expect(question).to_have_count(0)

    page.get_by_label('Publication state').select_option('published')
    page.get_by_role('button', name='Publish assessment', exact=True).click()
    confirmation = page.get_by_role('dialog', name='Publish assessment?', exact=True)
    confirmation.get_by_role('button', name='Publish', exact=True).click()
    expect(page.get_by_text('Enter the correct answer for this question', exact=True)).to_be_visible()
    assert not any(row['title'] == title for row in call(context, '/api/instructor/assessments/', role='instructor'))
    page.get_by_placeholder('e.g. Central Processing Unit', exact=True).fill('0')

    panel = open_upload(page)
    panel.get_by_role('button', name='Excel / CSV', exact=True).click()
    panel.get_by_label('Question import file', exact=True).set_input_files({
        'name': 'mixed-creator.csv', 'mimeType': 'text/csv',
        'buffer': b'question,type,correct,category\nImported spreadsheet identification?,identification,0,Service knowledge',
    })
    panel.get_by_role('button', name='Add 1 question to draft', exact=True).click()
    page.get_by_role('button', name='Publish assessment', exact=True).click()
    confirmation.get_by_role('button', name='Publish', exact=True).click()
    expect(page.get_by_role('heading', name='Assessment published!', exact=True)).to_be_visible()
    saved = assessment_by_title(context, title, 'instructor')
    assert saved['publication_status'] == 'published' and saved['batch_id'] == batch['id']
    questions = question_list(context, saved['id'], 'instructor')
    assert [(row['question_text'], row['question_type'], row['category']['id'],
             next(choice['text'] for choice in row['choices'] if choice['is_correct'])) for row in questions] == [
        ('Manual multiple choice?', 'mcq', records['id'], 'Original choice entered before the stem'),
        ('Imported question?', 'mcq', service['id'], 'Confirmed record'),
        ('Manual true or false?', 'truefalse', records['id'], 'False'),
        ('Manual identification?', 'identification', service['id'], '0'),
        ('Imported spreadsheet identification?', 'identification', service['id'], '0'),
    ]
    checks.append('One assessment keeps partial manual work through imports, collapses the cards, blocks an incomplete publish, and saves all five manual and imported keys in order.')


def run(browser):
    framework, categories, batch = setup(browser)
    records, service = categories
    context, page = session(browser, 'instructor')
    panel = fill_creator(page, 'instructor', batch, framework, 'Imported AIKEN draft')
    scope = page.get_by_role('region', name='Program and skills', exact=True)
    expect(scope.get_by_role('combobox', name='Program skill set', exact=True).get_by_role('option', name=f'{framework["name"]} · Current', exact=True)).to_have_count(1)
    expect(scope.get_by_text('Synthetic Import Program', exact=True)).to_be_visible()
    expect(scope.get_by_role('button', name='Reload skill categories', exact=True)).to_have_count(0)
    scope.evaluate("element => element.scrollIntoView({ block: 'center' })")
    scope.screenshot(path=str(OUT / 'program-and-skills-desktop.png'), animations='disabled')
    picker = panel.get_by_label('Question import file', exact=True)
    with page.expect_file_chooser() as chooser:
        picker.click()
    assert not chooser.value.is_multiple()
    sample = os.environ.get('SKILLBRIDGE_AIKEN_SAMPLE')
    source = Path(sample).read_bytes().decode('utf-8-sig') if sample else '\n\n'.join(
        f'{index + 1:02}. Which record should the trainee verify before confirming the change?\nA. Alpha\nB. Beta\nC. Gamma\nD. Delta\nANSWER: {"ABCD"[index % 4]}'
        for index in range(20)
    )
    if sample:
        panel.get_by_label('Question import file', exact=True).set_input_files(sample)
    else:
        transfer = page.evaluate_handle('''text => {
            const data = new DataTransfer()
            data.items.add(new File([text], 'synthetic-aiken.txt', { type: 'text/plain' }))
            return data
        }''', source)
        picker.dispatch_event('drop', {'dataTransfer': transfer})
    expect(panel.get_by_text('20 reviewed · 20 valid · 0 with errors · 20 unmapped', exact=False)).to_be_visible()
    preview = panel.get_by_role('region', name='Valid questions preview')
    expect(preview.get_by_role('combobox')).to_have_count(0)
    trigger = panel.get_by_role('button', name='Question import guide', exact=True)
    tabs = panel.get_by_role('group', name='Question import format').bounding_box()
    button = trigger.bounding_box()
    assert button['x'] > tabs['x'] + tabs['width']
    assert abs(button['y'] + button['height'] / 2 - tabs['y'] - tabs['height'] / 2) <= 1
    trigger.click()
    guide = page.get_by_role('dialog', name='Question import guide', exact=True)
    guide.get_by_role('button', name='Excel / CSV', exact=True).click()
    expect(guide.get_by_role('heading', name='CSV example', exact=True)).to_be_visible()
    guide.get_by_role('button', name='Close question import guide', exact=True).click()
    expect(trigger).to_be_focused()
    expect(preview).to_be_visible()
    expect(picker).to_have_attribute('accept', '.txt')
    panel.get_by_role('button', name='Review questions', exact=True).press('Enter')
    review = panel.get_by_role('region', name='Question review')
    expect(review.get_by_role('button', name=re.compile(r'^Question 1:'))).to_be_visible()
    if not sample:
        expect(review.get_by_role('button', name=re.compile(r'^Question 1: Which record'))).to_be_visible()
    first_key = re.search(r'ANSWER: ([A-D])', source)[1]
    expect(review.get_by_role('button', name=f'Mark choice {first_key} as correct', exact=True)).to_have_attribute('aria-pressed', 'true')
    question = review.get_by_role('textbox', name='Question text', exact=True)
    original_text = question.input_value()
    if not sample:
        expect(question).to_have_value('Which record should the trainee verify before confirming the change?')
    question.fill('')
    expect(panel.get_by_role('button', name='Add 20 questions to draft', exact=True)).to_be_disabled()
    question.fill(original_text)
    panel.get_by_label('Category for selected questions').select_option(str(records['id']))
    panel.get_by_role('button', name='Apply category to selected', exact=True).click()
    review.get_by_role('button', name=re.compile(r'^Question 2:')).click()
    review.get_by_role('button', name=service['name'], exact=True).click()
    expect(panel.get_by_text('0 unmapped · 20 selected', exact=False)).to_be_visible()
    if not sample:
        card = review.locator('#q_import-2')
        card.scroll_into_view_if_needed()
        card.screenshot(path=str(OUT / 'import-question-review-desktop.png'), animations='disabled')
    panel.get_by_role('button', name='Done reviewing', exact=True).click()
    expect(preview.get_by_role('combobox')).to_have_count(0)
    expect(preview.get_by_role('cell', name=service['name'], exact=True)).to_be_visible()
    panel.get_by_role('button', name='Next →', exact=True).click()
    expect(preview.get_by_role('row').nth(1).get_by_role('cell').first).to_have_text('7')
    panel.get_by_role('button', name='Review questions', exact=True).click()
    expect(review.get_by_role('button', name=re.compile(r'^Question 7:'))).to_be_visible()
    expect(review.get_by_role('checkbox', name='Select question 7', exact=True)).to_be_checked()
    panel.get_by_role('button', name='← Prev', exact=True).click()
    panel.get_by_role('button', name='Done reviewing', exact=True).click()
    if not sample:
        viewport = page.viewport_size
        page.set_viewport_size({**viewport, 'height': 1700})
        panel.evaluate("element => element.scrollIntoView({ block: 'center' })")
        panel.screenshot(path=str(OUT / 'upload-panel-desktop.png'), animations='disabled')
        page.set_viewport_size(viewport)
    panel.get_by_role('button', name='Add 20 questions to draft', exact=True).click()
    assert not any(row['title'] == 'Imported AIKEN draft' for row in call(context, '/api/instructor/assessments/', role='instructor'))
    page.get_by_role('button', name='Save draft', exact=True).click()
    expect(page.get_by_role('heading', name='Assessment saved as a draft!', exact=True)).to_be_visible()
    assessment = assessment_by_title(context, 'Imported AIKEN draft', 'instructor')
    questions = question_list(context, assessment['id'], 'instructor')
    original = [block.splitlines() for block in re.split(r'\r?\n\s*\r?\n', source.strip())]
    assert len(questions) == len(original) == 20
    numbered = [re.match(r'^0*' + str(index) + r'([.)])[ \t]+(\S.*)$', block[0].strip())
                for index, block in enumerate(original, 1)]
    clean_stems = all(numbered) and len({match[1] for match in numbered}) == 1
    for index, (question, expected) in enumerate(zip(questions, original)):
        stem = numbered[index][2] if clean_stems else expected[0].strip()
        assert question['question_text'] == stem and question['question_type'] == 'mcq'
        assert [choice['text'] for choice in question['choices']] == [line[3:].strip() for line in expected[1:-1]]
        assert [choice['is_correct'] for choice in question['choices']] == [letter == expected[-1].strip()[-1] for letter in 'ABCD']
        assert question['category']['id'] == (service['id'] if index == 1 else records['id'])
    checks.append(f'{"supplied DNSC file" if sample else "synthetic DNSC-shaped file"} saves reviewed stems, all 20 exact keys and ordered options with bulk and individual category IDs')

    panel = fill_creator(page, 'instructor', batch, framework, 'Spreadsheet import draft')
    panel.get_by_role('button', name='Excel / CSV', exact=True).click()
    with page.expect_download() as download:
        panel.get_by_role('button', name='Download template', exact=True).click()
    assert download.value.suggested_filename == 'questions_template.csv'
    csv_template = OUT / download.value.suggested_filename
    download.value.save_as(csv_template)
    xlsx_template = csv_template.with_suffix('.xlsx')
    subprocess.run([shutil.which('node'), '-e',
                    "const xlsx = require('xlsx'); xlsx.writeFile(xlsx.readFile(process.argv[1]), process.argv[2]);",
                    str(csv_template), str(xlsx_template)], check=True, cwd=Path(__file__).resolve().parents[1])
    for template in (csv_template, xlsx_template):
        panel.get_by_label('Question import file', exact=True).set_input_files(template)
        expect(panel.get_by_text('3 reviewed · 3 valid · 0 with errors', exact=False)).to_be_visible()
        expect(panel.get_by_role('cell', name='0', exact=True)).to_be_visible()
        expect(panel.get_by_role('row').nth(1).get_by_role('cell').first).to_have_text('1')
    panel.get_by_role('button', name='Review questions', exact=True).click()
    expect(panel.get_by_role('button', name=re.compile(r'^Question 1: Which record'))).to_be_visible()
    expect(panel.get_by_role('checkbox', name='Select question 3', exact=True)).to_be_checked()
    panel.get_by_label('Category for selected questions').select_option(str(records['id']))
    panel.get_by_role('button', name='Apply category to selected', exact=True).click()
    panel.get_by_role('button', name='Add 3 questions to draft', exact=True).click()
    page.get_by_role('button', name='Save draft', exact=True).click()
    expect(page.get_by_role('heading', name='Assessment saved as a draft!', exact=True)).to_be_visible()
    spreadsheet_assessment = assessment_by_title(context, 'Spreadsheet import draft', 'instructor')
    spreadsheet_questions = question_list(context, spreadsheet_assessment['id'], 'instructor')
    assert [question['question_type'] for question in spreadsheet_questions] == ['mcq', 'truefalse', 'identification']
    assert [next(choice['text'] for choice in question['choices'] if choice['is_correct'])
            for question in spreadsheet_questions] == ['Reservation record', 'True', '0']
    checks.append('Excel / CSV downloads a working CSV template, previews both formats, and saves all three answer types from XLSX.')

    page.goto(BASE + '/instructor/assessments', wait_until='networkidle')
    page.get_by_role('button', name='Open assessment Imported AIKEN draft', exact=True).click()
    editor = page.get_by_role('dialog', name='Edit assessment', exact=True)
    editor.get_by_role('button', name='Import questions', exact=True).click()
    panel = page.get_by_role('dialog', name='Import questions', exact=True)
    trigger = panel.get_by_role('button', name='Question import guide', exact=True)
    trigger.press('Enter')
    expect(guide).to_be_visible()
    page.keyboard.press('Escape')
    expect(guide).to_have_count(0)
    expect(panel).to_be_visible()
    expect(trigger).to_be_focused()
    mixed = 'Missing choice?\nA. One\nANSWER: A\n\n02. May tala ba sa café?\nA) True\nB) False\nANSWER: B'
    upload(panel, mixed)
    expect(panel.get_by_text('2 reviewed · 1 valid · 1 with errors', exact=False)).to_be_visible()
    expect(panel.get_by_role('button', name='Add 0 questions to draft', exact=True)).to_be_disabled()
    panel.get_by_role('button', name='Cancel import', exact=True).click()
    assert len(question_list(context, assessment['id'], 'instructor')) == 20
    editor.get_by_role('button', name='Import questions', exact=True).click()
    upload(panel, mixed)
    expect(panel.get_by_text('File question 1 · line 1', exact=True)).to_be_visible()
    expect(panel.get_by_role('button', name='Question 1: 02. May tala ba sa café?', exact=True)).to_be_visible()
    panel.get_by_label('Select question 1', exact=True).check()
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
    assert saved[-1]['question_text'] == '02. May tala ba sa café?'
    assert [choice['is_correct'] for choice in saved[-1]['choices']] == [False, True]
    checks.append('instructor edit requires explicit partial selection, cancels safely and retains an unmapped two-choice MCQ as draft after atomic publication rejection')
    publish_mixed_assessment(context, page, batch, framework, categories)
    context.close()

    context, page = session(browser, 'admin', width=390, dark=True)
    panel = fill_creator(page, 'admin', batch, framework, 'Admin native import draft')
    panel.get_by_role('button', name='Excel / CSV', exact=True).click()
    trigger = panel.get_by_role('button', name='Question import guide', exact=True)
    guide = page.get_by_role('dialog', name='Question import guide', exact=True)
    expect(guide).to_have_count(0)
    trigger.press('Enter')
    expect(guide.get_by_role('button', name='Excel / CSV', exact=True)).to_have_attribute('aria-pressed', 'true')
    expect(guide.locator('pre')).to_contain_text('question,type,choice_a')
    expect(guide.get_by_role('group', name='Guide format').get_by_role('button')).to_have_count(2)
    close = guide.get_by_role('button', name='Close question import guide', exact=True)
    expect(close).to_be_focused()
    page.keyboard.press('Shift+Tab')
    expect(guide.get_by_role('button', name='Excel / CSV', exact=True)).to_be_focused()
    page.keyboard.press('Tab')
    expect(close).to_be_focused()
    guide.get_by_role('button', name='AIKEN (.txt)', exact=True).click()
    expect(guide.locator('pre')).to_contain_text('ANSWER: A')
    expect(guide.get_by_text('Upload older SkillBridge text files in the AIKEN tab.', exact=False)).to_be_visible()
    assert guide.evaluate('element => element.scrollWidth <= element.clientWidth + 1')
    page.screenshot(path=str(OUT / 'question-import-guide-phone-dark.png'), animations='disabled')
    page.keyboard.press('Escape')
    expect(guide).to_have_count(0)
    expect(trigger).to_be_focused()
    expect(panel.get_by_role('button', name='Excel / CSV', exact=True)).to_have_attribute('aria-pressed', 'true')
    expect(panel.get_by_label('Question import file', exact=True)).to_have_attribute('accept', '.xlsx,.xls,.csv')
    checks.append('The guide sits beside the format controls, retains uploads, traps and restores focus, and closes independently of its parent dialog.')
    panel.get_by_role('button', name='AIKEN (.txt)', exact=True).click()
    upload(panel, '# Native format\nQUESTION: The record exists.\nTYPE: truefalse\nCORRECT: False\nCATEGORY: Records knowledge\n---\nQUESTION: Entries in an empty record?\nTYPE: identification\nCORRECT: 0\nCATEGORY: Service knowledge')
    expect(panel.get_by_text('Detected SkillBridge text.', exact=False)).to_be_visible()
    panel.get_by_role('button', name='Add 2 questions to draft', exact=True).click()
    page.get_by_role('button', name='Save draft', exact=True).click()
    expect(page.get_by_role('heading', name='Assessment saved as a draft!', exact=True)).to_be_visible()
    native = assessment_by_title(context, 'Admin native import draft')
    saved = question_list(context, native['id'])
    assert [row['question_type'] for row in saved] == ['truefalse', 'identification']
    assert [next(choice['text'] for choice in row['choices'] if choice['is_correct']) for row in saved] == ['False', '0']
    assert [row['category']['id'] for row in saved] == [records['id'], service['id']]

    page.goto(BASE + f'/admin/assessments?institute={batch["institute_id"]}&program={batch["program_id"]}', wait_until='networkidle')
    page.get_by_role('button', name='View details for Admin native import draft', exact=True).click()
    page.get_by_role('tab', name='Questions', exact=False).click()
    page.get_by_role('button', name='Edit assessment and questions', exact=True).click()
    editor = page.get_by_role('dialog', name='Edit assessment: Admin native import draft', exact=True)
    editor.get_by_role('button', name='Import questions', exact=True).click()
    panel = editor.get_by_role('region', name='Import questions', exact=True)
    expect(panel.get_by_role('button', name='AIKEN (.txt)', exact=True)).to_have_attribute('aria-pressed', 'true')
    upload(panel, 'Which record is reviewed?\nA. Current record\nB. Old record\nANSWER: A')
    panel.get_by_role('button', name='Review questions', exact=True).click()
    review = panel.get_by_role('region', name='Question review')
    review.get_by_role('textbox', name='Question text', exact=True).fill('Which record is reviewed after the update?')
    review.get_by_role('textbox', name='Choice B', exact=True).fill('Updated record')
    review.get_by_role('button', name='Mark choice B as correct', exact=True).click()
    review.get_by_role('button', name=records['name'], exact=True).click()
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
    review.get_by_role('textbox', name='Question text', exact=True).scroll_into_view_if_needed()
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
    assert saved[-1]['question_text'] == 'Which record is reviewed after the update?'
    assert [(choice['text'], choice['is_correct']) for choice in saved[-1]['choices']] == [('Current record', False), ('Updated record', True)]
    denied = call(context, f'/api/instructor/assessments/{native["id"]}/questions/', role='student', status=403)
    assert 'questions' not in denied
    checks.append('admin auto-detects native text, then edits an AIKEN stem, choice, and key on phone; a rejected save keeps the draft retryable and students cannot read keys')
    context.close()


if __name__ == '__main__':
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel='chrome', headless=True)
        run(browser)
        browser.close()
    assert not errors, errors
    for check in checks:
        print(f'PASS {check}')
