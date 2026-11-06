"""Framework-bound creator/editor/import/copy workflows over the real isolated API."""
import json
import re
import uuid
from playwright.sync_api import expect, sync_playwright
import organization_playwright as support
from program_batches_playwright import call

OUT, AUTH, BASE = support.OUT, support.AUTH, support.BASE
checks, errors = support.checks, support.errors


def run(browser):
    context, page = support.session(browser)
    institute = call(context, '/api/admin/institutes/', 'post', {'code': 'AUTHOR', 'name': 'Arbitrary Authoring Institute'}, status=201)
    parent = f'/api/admin/institutes/{institute["id"]}/programs/'
    program = call(context, parent, 'post', {'code': 'ANY', 'name': 'Arbitrary Authoring Degree'}, status=201)
    call(context, parent + f'{program["id"]}/instructors/', 'post', {'instructor_id': AUTH['instructor']['user']['id']}, status=201)
    frameworks = f'/api/management/programs/{program["id"]}/frameworks/'
    versions = []
    for index in range(2):
        version = call(context, frameworks, 'post', {'name': f'Reviewed definitions {index + 1}', 'request_id': str(uuid.uuid4())}, role='instructor', status=201)
        category = call(context, frameworks + f'{version["id"]}/categories/', 'post', {'name': 'Records knowledge',
            'description': 'Recognizes booking records and explains arrival reservations.', 'tags': ['Booking records']}, role='instructor', status=201)
        versions.append((version, category))
    batch = call(context, '/api/instructor/batches/', 'post', {'name': 'Authoring cohort', 'program_id': program['id']}, role='instructor', status=201)
    other_batch = call(context, '/api/instructor/batches/', 'post', {'name': 'Future version cohort', 'program_id': program['id']}, role='instructor', status=201)
    version, category = versions[0]
    other, other_category = versions[1]
    other_detail = call(context, frameworks + f'{other["id"]}/', role='instructor')
    call(context, '/api/instructor/assessments/', 'post', {'title': 'Other version assessment', 'batch_id': other_batch['id'],
        'framework_id': other['id'], 'framework_digest': other_detail['digest'], 'publication_status': 'draft', 'questions': []}, role='instructor', status=201)
    context.close()

    context, page = support.session(browser, 'instructor')
    legacy_requests = []
    page.on('request', lambda request: legacy_requests.append(request.url) if '/api/categories/' in request.url else None)
    page.goto(BASE + f'/instructor/assessment/create?batch_id={batch["id"]}', wait_until='networkidle')
    page.get_by_placeholder('e.g. OJT Skills Assessment 2026–2027').fill('Framework browser draft')
    page.get_by_placeholder('e.g. 60', exact=True).fill('35')
    skill_set = page.get_by_role('combobox', name='Program skill set', exact=True)
    expect(skill_set).to_have_value('')
    skill_set.select_option(str(version['id']))
    question = page.get_by_placeholder('Type the question here…', exact=True)
    question.fill('Explain booking records for arrival reservations.')
    page.get_by_placeholder('Choice A', exact=True).fill('Reviewed record')
    page.get_by_placeholder('Choice B', exact=True).fill('Other')
    page.get_by_role('button', name='Suggest from this framework', exact=True).click()
    expect(page.get_by_role('button', name='Use Records knowledge', exact=True)).to_be_visible()
    page.get_by_role('button', name='Use Records knowledge', exact=True).click()
    # Choosing another version clears only category assignments, then permits review.
    page.get_by_role('combobox', name='Program skill set', exact=True).select_option(str(other['id']))
    expect(question).to_have_value('Explain booking records for arrival reservations.')
    expect(page.get_by_placeholder('Choice A', exact=True)).to_have_value('Reviewed record')
    page.get_by_role('combobox', name='Program skill set', exact=True).select_option(str(version['id']))
    page.get_by_role('button', name='Records knowledge', exact=True).click()
    definition = call(context, frameworks + f'{version["id"]}/', role='instructor')
    call(context, frameworks + f'{version["id"]}/', 'patch', {'expected_digest': definition['digest'],
        'description': 'Reviewed external revision before first binding.'}, role='instructor')
    page.get_by_role('button', name='Save draft', exact=True).click()
    expect(page.get_by_text('This definition changed.', exact=False).first).to_be_visible()
    expect(question).to_have_value('Explain booking records for arrival reservations.')
    with page.expect_response(lambda response: response.request.method == 'GET' and '/authoring/' in response.url):
        page.get_by_role('button', name='Refresh framework definitions', exact=True).click()
    page.get_by_role('button', name='Save draft', exact=True).click()
    expect(page.get_by_role('heading', name='Assessment saved as a draft!', exact=True)).to_be_visible()
    records = call(context, '/api/instructor/assessments/', role='instructor')
    assessment = next(row for row in records if row['title'] == 'Framework browser draft')
    assert assessment['framework_id'] == version['id'] and assessment['program_id'] == program['id']
    questions = call(context, f'/api/instructor/assessments/{assessment["id"]}/questions/', role='instructor')['questions']
    assert questions[0]['category']['id'] == category['id']
    assert not legacy_requests, legacy_requests
    checks.append('instructor creates scoped draft with real saved-category suggestions; changing versions preserves question/keys, clears assignments and never calls global category endpoints')
    checks.append('stale framework digest rejects first save, preserves all draft content and succeeds after explicit definition refresh')

    page.goto(BASE + '/instructor/assessments', wait_until='networkidle')
    page.get_by_role('button', name='Open assessment Framework browser draft', exact=True).click()
    dialog = page.get_by_role('dialog', name='Edit assessment', exact=True)
    expect(dialog.get_by_text('Reviewed definitions 1 · v1.', exact=False)).to_be_visible()
    dialog.get_by_role('button', name=re.compile('Question 1:')).click()
    expect(dialog.get_by_role('button', name='Suggest from this framework', exact=True)).to_be_visible()
    dialog.get_by_placeholder('Type the question here...', exact=True).fill('Updated booking records question')
    dialog.get_by_role('button', name='Save All Changes', exact=True).click()
    page.get_by_role('dialog', name='Save all changes?', exact=True).get_by_role('button', name='Confirm Save', exact=True).click()
    expect(dialog.get_by_role('button', name='Save All Changes', exact=True)).to_be_enabled()
    saved = call(context, f'/api/instructor/assessments/{assessment["id"]}/questions/', role='instructor')['questions']
    assert saved[0]['question_text'] == 'Updated booking records question' and saved[0]['category']['id'] == category['id']
    dialog.get_by_role('button', name='Duplicate as draft', exact=True).click()
    duplicate = page.get_by_role('dialog', name='Duplicate assessment as draft', exact=True)
    assert duplicate.get_by_role('combobox', name='Target batch').get_by_role('option', name='Future version cohort', exact=False).count() == 0
    duplicate.get_by_role('button', name='Create draft copy', exact=True).click()
    expect(duplicate).to_have_count(0)
    copied = next(row for row in call(context, '/api/instructor/assessments/', role='instructor') if row['title'] == 'Framework browser draft (copy)')
    assert copied['framework_id'] == version['id'] and copied['batch_id'] is None
    checks.append('instructor editor retains category IDs; duplicate UI excludes incompatible versions and creates a scoped batchless draft without scores')
    page.goto(BASE + '/instructor/assessments', wait_until='networkidle')
    page.get_by_role('button', name='Open assessment Framework browser draft (copy)', exact=True).click()
    dialog = page.get_by_role('dialog', name='Edit assessment', exact=True)
    dialog.get_by_role('combobox', name='Assign draft to batch').select_option(str(batch['id']))
    dialog.get_by_role('combobox', name='Publication state').select_option('published')
    dialog.get_by_role('button', name=re.compile('Question 1:')).click()
    dialog.get_by_role('button', name='Mark choice A as correct', exact=True).click()
    dialog.get_by_role('button', name='Save All Changes', exact=True).click()
    page.get_by_role('dialog', name='Save all changes?', exact=True).get_by_role('button', name='Confirm Save', exact=True).click()
    expect(dialog.get_by_role('button', name='Save All Changes', exact=True)).to_be_enabled()
    assigned = next(row for row in call(context, '/api/instructor/assessments/', role='instructor') if row['id'] == copied['id'])
    assert assigned['batch_id'] == batch['id'] and assigned['publication_status'] == 'published'
    assert assigned['is_required'] is False and assigned['include_in_competency'] is False
    checks.append('batchless copy assigns only to compatible batch and publishes an optional excluded assessment with reviewed answer key')
    context.close()

    # Admin uses the shared authoring dialog; imports remain a local draft until save.
    context, page = support.session(browser, 'admin', width=390, dark=True)
    page.goto(BASE + '/admin/assessments', wait_until='networkidle')
    page.get_by_role('button', name='View details for Framework browser draft', exact=True).click()
    page.get_by_role('tab', name='Questions', exact=False).click()
    page.get_by_role('button', name='Edit assessment and questions', exact=True).click()
    dialog = page.get_by_role('dialog', name='Edit assessment: Framework browser draft', exact=True)
    expect(dialog.get_by_text('Program framework: Reviewed definitions 1', exact=False)).to_be_visible()
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
    page.screenshot(path=str(OUT / 'authoring-phone-editor.png'), animations='disabled')
    dialog.get_by_role('button', name='Import questions', exact=True).click()
    dialog.get_by_role('combobox', name='Question import format').select_option('native')
    payload = 'QUESTION: A synthetic imported fact is true.\nTYPE: truefalse\nCORRECT: True\nCATEGORY: Unknown imported category\n'
    dialog.get_by_label('Question import file', exact=True).set_input_files({'name': 'synthetic-native.txt', 'mimeType': 'text/plain', 'buffer': payload.encode()})
    dialog.get_by_role('button', name='Add 1 question to draft', exact=True).click()
    assert len(call(context, f'/api/instructor/assessments/{assessment["id"]}/questions/')['questions']) == 1
    imported = dialog.get_by_role('button', name=re.compile('Question 2:'))
    expect(imported).to_be_visible()
    # New questions are expanded; select this framework's authorized category.
    dialog.get_by_role('button', name='Records knowledge', exact=True).click()
    dialog.get_by_role('button', name='Review & save authoring', exact=True).click()
    page.get_by_role('dialog', name='Save assessment authoring?', exact=True).get_by_role('button', name='Save changes', exact=True).click()
    expect(dialog).to_have_count(0)
    saved = call(context, f'/api/instructor/assessments/{assessment["id"]}/questions/')['questions']
    assert len(saved) == 2 and saved[1]['category']['id'] == category['id'] and saved[1]['question_type'] == 'truefalse'
    checks.append('phone dark admin imports native true/false into local draft, explicitly maps unknown category and atomically saves authorized IDs')
    page.screenshot(path=str(OUT / 'authoring-phone-dark.png'), animations='disabled')
    page.goto(BASE + '/admin/assessment/create', wait_until='networkidle')
    page.get_by_placeholder('e.g. OJT Skills Assessment 2026–2027').fill('Recover scoped draft')
    page.get_by_placeholder('e.g. 60', exact=True).fill('25')
    page.get_by_role('searchbox', name='Search assigned programs').fill(program['name'])
    page.get_by_role('radio', name=re.compile(program['name'])).check()
    page.get_by_role('combobox', name='Program skill set', exact=True).select_option(str(version['id']))
    page.get_by_placeholder('Type the question here…', exact=True).fill('Recover this booking records question')
    page.get_by_role('button', name='Records knowledge', exact=True).click()
    page.reload(wait_until='networkidle')
    page.get_by_role('button', name='Restore draft', exact=True).click()
    expect(page.get_by_role('combobox', name='Program skill set')).to_have_value(str(version['id']))
    expect(page.get_by_placeholder('Type the question here…', exact=True)).to_have_value('Recover this booking records question')
    page.get_by_role('button', name='Save draft', exact=True).click()
    expect(page.get_by_role('heading', name='Assessment saved as a draft!', exact=True)).to_be_visible()
    recovered = next(row for row in call(context, '/api/instructor/assessments/') if row['title'] == 'Recover scoped draft')
    assert recovered['framework_id'] == version['id'] and recovered['batch_id'] is None
    checks.append('admin phone creates a program-scoped batchless draft and reload recovery preserves program/framework/category identity')
    context.close()


if __name__ == '__main__':
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(channel='chrome', headless=True)
            try:
                run(browser)
            except Exception:
                for context in browser.contexts:
                    for index, page in enumerate(context.pages):
                        page.screenshot(path=str(OUT / f'failure-{index}.png'), animations='disabled')
                        (OUT / f'failure-{index}.txt').write_text(page.locator('body').inner_text(), encoding='utf-8')
                raise
            finally:
                browser.close()
        assert not errors, errors
    finally:
        (OUT / 'results.json').write_text(json.dumps({'checks': checks, 'page_errors': errors}, indent=2), encoding='utf-8')
    print(json.dumps({'passed': len(checks), 'checks': checks, 'page_errors': errors}))
