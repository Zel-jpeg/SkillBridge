"""Round-trip synthetic staff downloads through the real question importer."""

from playwright.sync_api import expect, sync_playwright

from aiken_import_playwright import assessment_by_title, question_list
from organization_playwright import BASE, OUT, checks, errors, session
from program_batches_playwright import call


def choices(*items):
    return [{'text': text, 'is_correct': correct} for text, correct in items]


def run(browser):
    instructor, page = session(browser, 'instructor')
    batch = call(instructor, '/api/instructor/batches/', role='instructor')[0]
    category = 'Synthetic records'
    source = [
        {'question_text': 'Which record is current?', 'question_type': 'mcq', 'choices': choices(('Old', False), ('Current', True))},
        {'question_text': 'Is the record archived?', 'question_type': 'truefalse', 'choices': choices(('True', False), ('False', True))},
        {'question_text': 'How many entries?', 'question_type': 'identification', 'correct_answer': '0'},
        {'question_text': 'Read the log:\n---\nprint(0)', 'question_type': 'mcq', 'choices': choices(('1', False), ('0', True))},
    ]
    saved = call(instructor, '/api/instructor/assessments/', 'post', {
        'title': 'Synthetic export source', 'batch_id': batch['id'], 'duration_minutes': 30, 'publication_status': 'draft',
        'questions': [{**question, 'category': category} for question in source],
    }, role='instructor', status=201)
    aid = saved['id']
    path = f'/api/instructor/assessments/{aid}/questionnaire-export/'
    call(instructor, path, role='student', status=403)
    call(instructor, path, role='other_instructor', status=404)

    page.goto(BASE + '/instructor/assessments', wait_until='networkidle')
    page.get_by_role('button', name='Open assessment Synthetic export source', exact=True).click()
    page.get_by_role('button', name='Export questionnaire', exact=True).click()
    dialog = page.get_by_role('dialog', name='Export questionnaire', exact=True)
    expect(dialog.get_by_role('combobox', name='Questionnaire export format')).to_have_value('aiken')
    expect(dialog.get_by_text('1 of 4 saved questions can be downloaded.')).to_be_visible()
    button = dialog.get_by_role('button', name='Download questionnaire', exact=True)
    expect(button).to_be_disabled()
    dialog.get_by_role('checkbox', name='Download only the 1 supported question').check()
    with page.expect_download() as result:
        button.click()
    aiken = OUT / 'supported-mcq.txt'
    result.value.save_as(str(aiken))
    assert aiken.read_text(encoding='utf-8') == 'Which record is current?\nA. Old\nB. Current\nANSWER: B\n'
    checks.append('Instructor downloads the explicitly confirmed AIKEN subset with the original choice order and key.')

    admin, page = session(browser, 'admin', width=390, dark=True)
    page.goto(BASE + '/admin/assessments', wait_until='networkidle')
    page.get_by_role('button', name='View details for Synthetic export source', exact=True).click()
    page.get_by_role('tab', name='Questions', exact=True).click()
    page.get_by_role('button', name='Export questionnaire', exact=True).click()
    dialog = page.get_by_role('dialog', name='Export questionnaire', exact=True)
    expect(dialog.get_by_text('1 of 4 saved questions can be downloaded.')).to_be_visible()
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
    page.screenshot(path=str(OUT / 'questionnaire-export-phone-dark.png'), animations='disabled')
    dialog.get_by_role('combobox', name='Questionnaire export format').select_option('native')
    expect(dialog.get_by_text('4 of 4 saved questions can be downloaded.')).to_be_visible()
    with page.expect_download() as result:
        dialog.get_by_role('button', name='Download questionnaire', exact=True).click()
    native = OUT / 'mixed-questionnaire.txt'
    result.value.save_as(str(native))

    page.goto(BASE + f'/admin/assessment/create?batch_id={batch["id"]}', wait_until='networkidle')
    page.get_by_placeholder('e.g. OJT Skills Assessment 2026–2027').fill('Reimported synthetic questionnaire')
    page.get_by_placeholder('e.g. 60', exact=True).fill('30')
    page.get_by_role('button', name='Upload file', exact=True).click()
    panel = page.get_by_role('region', name='Import questions', exact=True)
    panel.get_by_label('Question import file', exact=True).set_input_files(str(aiken))
    expect(panel.get_by_text('1 reviewed · 1 valid · 0 with errors', exact=False)).to_be_visible()
    panel.get_by_label('Question import format', exact=True).select_option('native')
    panel.get_by_label('Question import file', exact=True).set_input_files(str(native))
    expect(panel.get_by_text('4 reviewed · 4 valid · 0 with errors', exact=False)).to_be_visible()
    panel.get_by_role('button', name='Add 4 questions to draft', exact=True).click()
    page.get_by_role('button', name='Save draft', exact=True).click()
    expect(page.get_by_role('heading', name='Assessment saved as a draft!', exact=True)).to_be_visible()
    copy = assessment_by_title(admin, 'Reimported synthetic questionnaire')
    expected = question_list(admin, aid)
    actual = question_list(admin, copy['id'])
    assert len(actual) == len(expected) == 4
    for imported, original in zip(actual, expected):
        assert imported['question_text'] == original['question_text']
        assert imported['question_type'] == original['question_type']
        assert imported['category']['name'] == original['category']['name']
        assert [(choice['text'], choice['is_correct']) for choice in imported['choices']] == [
            (choice['text'], choice['is_correct']) for choice in original['choices']]
    checks.append('Admin downloads and reimports native mixed questions with category names, multiline text, false and zero keys on a phone viewport.')
    admin.close()
    instructor.close()


if __name__ == '__main__':
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel='chrome', headless=True)
        run(browser)
        browser.close()
    assert not errors, errors
    for check in checks:
        print(f'PASS {check}')
