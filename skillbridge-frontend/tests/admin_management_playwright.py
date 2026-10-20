"""Real browser/API checks using admin_management_server.py, never hosted data."""
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse

TESTS = Path(__file__).parent
sys.path.insert(0, str(TESTS / '.runtime-win'))
sys.path.insert(1, str(TESTS / '.runtime'))
from playwright.sync_api import sync_playwright, expect

ARTIFACTS = TESTS / 'artifacts/admin-management'
AUTH = json.loads((ARTIFACTS / 'auth.json').read_text(encoding='utf-8'))
BASE = 'http://127.0.0.1:' + os.environ.get('ADMIN_MANAGEMENT_FRONTEND_PORT', '5183')
API = 'http://127.0.0.1:' + os.environ.get('ADMIN_MANAGEMENT_API_PORT', '8023')
errors = []
checks = []


def api_request(context, path, method='get', data=None, identity='admin'):
    response = getattr(context.request, method)(API + path,
        headers={'Authorization': 'Bearer ' + AUTH[identity]['token']}, data=data)
    return response


def geometry(page, name):
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), name
    page.screenshot(path=str(ARTIFACTS / f'{name}.png'), full_page=True)


def open_authoring(page, title):
    page.goto(BASE + '/admin/assessments')
    page.wait_for_load_state('networkidle')
    page.get_by_placeholder('Search title, instructor, or batch…').fill(title)
    page.get_by_role('button', name=f'View details for {title}', exact=True).click()
    page.get_by_role('tab', name='Questions', exact=True).click()
    page.get_by_role('button', name='Edit assessment and questions', exact=True).click()
    dialog = page.get_by_role('dialog', name=f'Edit assessment: {title}', exact=True)
    expect(dialog.get_by_text('Loading authorized questions…')).to_have_count(0)
    return dialog


def run_checks(browser):
    context, page = session(browser)
    suffix = str(os.getpid())
    assert api_request(context, f"/api/admin/batches/{AUTH['batch_id']}/", 'patch',
        {'instructor_id': AUTH['owner_id']}).status == 200
    page.goto(BASE + '/admin/batches')
    page.wait_for_load_state('networkidle')
    initial_count = len(api_request(context, '/api/instructor/batches/').json())
    expect(page.get_by_text(f'{initial_count} batches', exact=True)).to_be_visible()
    page.get_by_role('button', name=re.compile('Next')).click()
    expect(page.get_by_text(f'Showing 11–20 of {initial_count}', exact=True)).to_be_visible()
    page.get_by_role('button', name='Show batch list', exact=True).click()
    expect(page.get_by_text(f'Showing 11–20 of {initial_count}', exact=True)).to_be_visible()
    page.get_by_label('Search batches', exact=True).fill('Main synthetic cohort')
    expect(page.get_by_text('1 batches', exact=True)).to_be_visible()
    page.get_by_role('button', name='Show batch cards', exact=True).click()
    page.get_by_role('button', name=re.compile('^Main synthetic cohort')).click()
    expect(page.get_by_role('button', name='Unenroll from batch', exact=True)).to_be_visible()
    geometry(page, 'batch-desktop')
    checks.append('Batch collection filtering, pagination, shared card/list page and roster')
    page.get_by_label('Open skill leaderboard', exact=True).select_option('Synthetic Programming')
    leaderboard = page.get_by_role('dialog', name='Synthetic Programming Leaderboard', exact=True)
    expect(leaderboard.get_by_text('Synthetic Student', exact=True)).to_be_visible()
    geometry(page, 'admin-skill-leaderboard')
    leaderboard.press('Escape')
    expect(leaderboard).not_to_be_visible()
    checks.append('Admin skill leaderboard uses unlocked combined evidence and native keyboard dismissal')

    page.get_by_role('button', name='Create batch', exact=True).click()
    dialog = page.get_by_role('dialog', name='Create batch', exact=True)
    created_name = f'Admin owned by instructor {suffix}'
    dialog.get_by_label('Batch name', exact=True).fill(created_name)
    dialog.get_by_label('Responsible instructor', exact=True).select_option(str(AUTH['owner_id']))
    dialog.get_by_role('button', name='Review batch changes', exact=True).click()
    page.get_by_role('dialog', name='Create this batch?', exact=True).get_by_role('button', name='Save batch', exact=True).click()
    expect(dialog).not_to_be_visible()
    batches = api_request(context, '/api/instructor/batches/').json()
    created = next(batch for batch in batches if batch['name'] == created_name)
    assert created['instructor_id'] == AUTH['owner_id']
    assert created['created_by_id'] == AUTH['admin']['user']['id']
    checks.append('Admin creates batch for selected instructor; creator stays separate')

    page.get_by_role('button', name='Enroll students', exact=True).click()
    enrollment = page.get_by_role('dialog', name='Enroll students', exact=True)
    expect(enrollment.get_by_text('Assigned instructor: Synthetic Owner', exact=True)).to_be_visible()
    enrollment.get_by_role('button', name='Manual entry', exact=True).click()
    enrollment.get_by_label('DNSC Email', exact=True).fill('management.student@dnsc.edu.ph')
    enrollment.get_by_label('Full Name', exact=True).fill('Synthetic Student')
    enrollment.get_by_label('Student ID', exact=True).fill('2099-90001')
    enrollment.get_by_role('button', name='Preview student', exact=True).click()
    enrollment.get_by_role('checkbox', name='I verified the Student IDs and final DNSC email addresses.', exact=True).check()
    enrollment.get_by_role('button', name='Confirm 1 enrollments', exact=True).click()
    enrollment.get_by_role('button', name='Done', exact=True).click()
    checks.append('Admin batch workspace reuses reviewed enrollment and the assigned instructor context')

    # Reassignment is tested on the original batch, with existing attempts/scores.
    page.get_by_role('button', name=re.compile('^Main synthetic cohort')).click()
    page.get_by_role('button', name='Manage batch', exact=True).click()
    dialog = page.get_by_role('dialog', name='Manage batch', exact=True)
    dialog.get_by_label('Responsible instructor', exact=True).select_option(str(AUTH['other_id']))
    dialog.get_by_role('button', name='Review batch changes', exact=True).click()
    page.get_by_role('dialog', name='Save batch ownership and name?', exact=True).get_by_role('button', name='Save batch', exact=True).click()
    expect(dialog).not_to_be_visible()
    path = f"/api/instructor/assessments/{AUTH['locked_id']}/questions/"
    assert api_request(context, path, identity='owner').status == 404
    assert api_request(context, path, identity='other').status == 200
    page.get_by_role('button', name='Archive batch', exact=True).click()
    page.get_by_role('dialog', name='Archive this batch?', exact=True).get_by_role('button', name='Confirm batch status', exact=True).click()
    expect(page.get_by_role('button', name='Reactivate batch', exact=True)).to_be_visible()
    page.get_by_role('button', name='Reactivate batch', exact=True).click()
    page.get_by_role('dialog', name='Reactivate this batch?', exact=True).get_by_role('button', name='Confirm batch status', exact=True).click()
    expect(page.get_by_role('button', name='Archive batch', exact=True)).to_be_visible()
    page.get_by_role('button', name='View action history', exact=True).click()
    expect(page.get_by_text('batch.update', exact=True).first).to_be_visible()
    checks.append('Batch reassignment transfers access and preserves history; archive/reactivation/audit work')

    # Real creator: manually author and publish an assessment into the new instructor-owned batch.
    title = f'Admin browser assessment {suffix}'
    page.goto(BASE + f"/admin/assessment/create?batch_id={created['id']}")
    page.wait_for_load_state('networkidle')
    page.get_by_placeholder('e.g. BSIT OJT Skills Assessment 2025–2026').fill(title)
    page.get_by_placeholder('e.g. 60', exact=True).fill('30')
    expect(page.get_by_label('Assign to batch', exact=True)).to_have_value(str(created['id']))
    page.get_by_placeholder('Type the question here…', exact=True).fill('Which synthetic option is correct?')
    page.get_by_placeholder('Choice A', exact=True).fill('Synthetic correct')
    page.get_by_placeholder('Choice B', exact=True).fill('Synthetic wrong')
    page.get_by_role('button', name='A', exact=True).click()
    page.get_by_role('button', name='Synthetic Programming', exact=True).click()
    page.get_by_label('Publication state').select_option('published')
    page.get_by_role('button', name='Publish assessment', exact=True).click()
    page.get_by_role('dialog', name='Publish assessment?', exact=True).get_by_role('button', name='Publish', exact=True).click()
    expect(page.get_by_text('Assessment published!', exact=True)).to_be_visible()
    assessments = api_request(context, '/api/instructor/assessments/').json()
    assessment = next(row for row in assessments if row['title'] == title)
    assert assessment['created_by_id'] == AUTH['admin']['user']['id']
    assert assessment['instructor_id'] == AUTH['owner_id']
    assert api_request(context, f"/api/instructor/assessments/{assessment['id']}/questions/", identity='owner').status == 200
    checks.append('Admin manually creates/publishes through shared form; assigned instructor can manage it')
    student_context, student_page = session(browser, 'student')
    student_page.goto(BASE + '/student/assessments')
    student_page.wait_for_load_state('networkidle')
    expect(student_page.get_by_role('heading', name=title, exact=True)).to_be_visible()
    assert api_request(student_context, f"/api/instructor/assessments/{assessment['id']}/questions/", identity='student').status == 403
    student_context.close()
    checks.append('Enrolled student sees the admin-published assessment and cannot read its answer key')

    editor = open_authoring(page, title)
    editor.get_by_role('button', name=re.compile('^Question 1:')).click()
    editor.get_by_placeholder('Type the question here...', exact=True).fill('Changed through shared editor')
    editor.get_by_role('button', name='Import questions', exact=True).click()
    editor.get_by_label('Question import format', exact=True).select_option('text')
    # Current parser format is the same one used by the instructor.
    fixture = TESTS / 'artifacts/admin-management/import.txt'
    fixture.write_text('QUESTION: What is the synthetic key?\nTYPE: identification\nCORRECT: Synthetic key\nCATEGORY: Synthetic Programming\n', encoding='utf-8')
    editor.get_by_label('Question import file', exact=True).set_input_files(str(fixture))
    expect(editor.get_by_role('button', name='Add 1 imported questions to draft', exact=True)).to_be_enabled()
    editor.get_by_role('button', name='Add 1 imported questions to draft', exact=True).click()
    geometry(page, 'authoring-desktop')
    editor.get_by_role('button', name='Review & save authoring', exact=True).click()
    page.get_by_role('dialog', name='Save assessment authoring?', exact=True).get_by_role('button', name='Save changes', exact=True).click()
    expect(editor).not_to_be_visible()
    saved = api_request(context, f"/api/instructor/assessments/{assessment['id']}/questions/").json()['questions']
    assert len(saved) == 2 and saved[0]['question_text'] == 'Changed through shared editor'
    checks.append('Question editing and text import save together with canonical question IDs')

    # Both spreadsheet formats use the installed parser; external requests stay blocked.
    csv_file = ARTIFACTS / 'import.csv'
    csv_file.write_text('question,type,choice_a,choice_b,correct,category\nCSV synthetic question?,mcq,Yes,No,A,Synthetic Programming\n', encoding='utf-8')
    xlsx_file = ARTIFACTS / 'import.xlsx'
    subprocess.run(['node', '-e', "const X=require('xlsx'); const w=X.utils.book_new(); X.utils.book_append_sheet(w,X.utils.json_to_sheet([{question:'Excel synthetic question?',type:'truefalse',correct:'True',category:'Synthetic Programming'}]),'Questions'); X.writeFile(w,process.argv[1]);", str(xlsx_file.resolve())], cwd=TESTS.parent, check=True)
    editor = open_authoring(page, title)
    for source in [csv_file, xlsx_file]:
        editor.get_by_role('button', name='Import questions', exact=True).click()
        editor.get_by_label('Question import format', exact=True).select_option('excel')
        editor.get_by_label('Question import file', exact=True).set_input_files(str(source.resolve()))
        expect(editor.get_by_role('button', name='Add 1 imported questions to draft', exact=True)).to_be_enabled()
        editor.get_by_role('button', name='Add 1 imported questions to draft', exact=True).click()
    editor.get_by_role('button', name='Review & save authoring', exact=True).click()
    page.get_by_role('dialog', name='Save assessment authoring?', exact=True).get_by_role('button', name='Save changes', exact=True).click()
    expect(editor).not_to_be_visible()
    saved = api_request(context, f"/api/instructor/assessments/{assessment['id']}/questions/").json()['questions']
    assert len(saved) == 4 and saved[-1]['question_type'] == 'truefalse'
    checks.append('CSV and XLSX import use the shared installed parser with external requests blocked')

    editor = open_authoring(page, title)
    editor.get_by_role('button', name='Remove question', exact=True).nth(1).click()
    page.get_by_role('dialog', name='Remove question from draft?', exact=True).get_by_role('button', name='Remove question', exact=True).click()
    editor.get_by_role('button', name='Review & save authoring', exact=True).click()
    page.get_by_role('dialog', name='Save assessment authoring?', exact=True).get_by_role('button', name='Save changes', exact=True).click()
    expect(editor).not_to_be_visible()
    assert len(api_request(context, f"/api/instructor/assessments/{assessment['id']}/questions/").json()['questions']) == 3
    checks.append('Persisted question deletion requires confirmation and saves atomically')

    editor = open_authoring(page, title)
    editor.get_by_label('Duration in minutes', exact=True).fill('31')
    failure_path = re.compile(r'.*/api/instructor/assessments/' + str(assessment['id']) + r'/$')
    fail_once = [True]
    def fail_save(route):
        if route.request.method == 'PATCH' and fail_once[0]:
            fail_once[0] = False
            route.fulfill(status=503, content_type='application/json', body='{"error":"Synthetic temporary save failure"}')
        else:
            route.continue_(url=API + urlparse(route.request.url).path)
    page.route(failure_path, fail_save)
    editor.get_by_role('button', name='Review & save authoring', exact=True).click()
    page.get_by_role('dialog', name='Save assessment authoring?', exact=True).get_by_role('button', name='Save changes', exact=True).click()
    expect(editor.get_by_role('alert').first).to_be_visible()
    expect(editor.get_by_label('Duration in minutes', exact=True)).to_have_value('31')
    page.unroute(failure_path, fail_save)
    editor.get_by_role('button', name='Review & save authoring', exact=True).click()
    page.get_by_role('dialog', name='Save assessment authoring?', exact=True).get_by_role('button', name='Save changes', exact=True).click()
    expect(editor).not_to_be_visible()
    checks.append('A failed save preserves authoring drafts and an explicit retry succeeds')

    editor = open_authoring(page, title)
    editor.get_by_label('Assessment title', exact=True).fill(title + ' Unsaved')
    editor.get_by_role('button', name='Close editor', exact=True).click()
    page.get_by_role('dialog', name='Discard authoring changes?', exact=True).get_by_role('button', name='Cancel', exact=True).click()
    expect(editor.get_by_label('Assessment title', exact=True)).to_have_value(title + ' Unsaved')
    editor.get_by_role('button', name='Close editor', exact=True).click()
    page.get_by_role('dialog', name='Discard authoring changes?', exact=True).get_by_role('button', name='Discard', exact=True).click()
    expect(editor).not_to_be_visible()
    checks.append('Dirty authoring drafts require discard confirmation and survive cancellation')

    editor = open_authoring(page, 'Unassigned synthetic draft')
    editor.get_by_label('Assign draft to batch', exact=True).select_option(str(created['id']))
    editor.get_by_role('button', name='Review & save authoring', exact=True).click()
    page.get_by_role('dialog', name='Save assessment authoring?', exact=True).get_by_role('button', name='Save changes', exact=True).click()
    expect(editor).not_to_be_visible()
    assigned = next(row for row in api_request(context, '/api/instructor/assessments/').json() if row['id'] == AUTH['unassigned_id'])
    assert assigned['batch_id'] == created['id']
    checks.append('Admin assigns an existing batchless draft')

    editor = open_authoring(page, 'Attempted synthetic assessment')
    expect(editor.get_by_text('A student attempt exists.', exact=False)).to_be_visible()
    expect(editor.get_by_role('button', name='Add Multiple Choice', exact=True)).to_have_count(0)
    editor.get_by_role('button', name='Close editor', exact=True).click()
    checks.append('Attempted questions remain locked for admins')

    page.goto(BASE + '/admin/batches')
    page.wait_for_load_state('networkidle')
    page.get_by_label('Search batches', exact=True).fill('Main synthetic cohort')
    page.get_by_role('button', name=re.compile('^Main synthetic cohort')).click()
    page.get_by_role('button', name='Unenroll from batch', exact=True).click()
    page.get_by_role('dialog', name='Unenroll from this batch?', exact=True).get_by_role('button', name='Unenroll student', exact=True).click()
    expect(page.get_by_text('No students enrolled in this batch.', exact=True)).to_be_visible()
    historical = api_request(context, f"/api/instructor/batches/{AUTH['second_batch_id']}/students/").json()
    assert any(student['id'] == AUTH['student_id'] for student in historical['students'])
    assert api_request(context, '/api/auth/me/', identity='student').status == 200
    checks.append('Unenrollment leaves other memberships and the active account intact')

    for width in [375, 768, 1366]:
        page.set_viewport_size({'width': width, 'height': 1000})
        page.goto(BASE + '/admin/batches')
        page.wait_for_load_state('networkidle')
        geometry(page, f'batches-{width}')
        page.get_by_role('button', name='Create batch', exact=True).click()
        dialog = page.get_by_role('dialog', name='Create batch', exact=True)
        expect(dialog).to_be_visible()
        geometry(page, f'batch-dialog-{width}')
        dialog.get_by_role('button', name='Cancel', exact=True).click()
    page.evaluate("document.documentElement.classList.add('dark')")
    geometry(page, 'batches-dark')
    checks.append('Phone/tablet/desktop batch collection and native-dialog layout')
    context.close()
    assert not errors, errors
    (ARTIFACTS / 'checks.json').write_text(json.dumps({'checks': checks, 'page_errors': errors}, indent=2), encoding='utf-8')
    for check in checks:
        print('PASS:', check)


def session(browser, identity='admin', width=1366):
    context = browser.new_context(viewport={'width': width, 'height': 1000}, reduced_motion='reduce')
    credentials = AUTH[identity]
    context.add_init_script(f"""(() => {{
        const identity = {json.dumps(credentials)};
        localStorage.setItem('sb-token', identity.token);
        localStorage.setItem('sb-role', identity.user.role);
        localStorage.setItem('sb-user', JSON.stringify(identity.user));
        localStorage.setItem('sb-login-time', String(Date.now()));
    }})();""")
    def route_request(route):
        source = urlparse(route.request.url)
        if source.path.startswith('/api/'):
            route.continue_(url=API + source.path + ('?' + source.query if source.query else ''))
        elif source.hostname not in ('127.0.0.1', 'localhost'):
            route.abort()
        else:
            route.continue_()
    context.route('**/*', route_request)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('console', lambda message: errors.append(message.text) if message.type == 'error' and
        ('uncontrolled' in message.text or 'controlled input' in message.text) else None)
    return context, page


def inspect(browser):
    context, page = session(browser)
    for name, url in [('batches', '/admin/batches'), ('creator', '/admin/assessment/create'), ('assessments', '/admin/assessments')]:
        page.goto(BASE + url)
        page.wait_for_load_state('networkidle')
        (ARTIFACTS / f'inspect-{name}.txt').write_text(page.locator('body').inner_text(), encoding='utf-8')
        page.screenshot(path=str(ARTIFACTS / f'inspect-{name}.png'), full_page=True)
        print(name, json.dumps(page.locator('button, input, select').evaluate_all("els => els.map(el => ({tag: el.tagName, label: el.getAttribute('aria-label'), text: el.innerText?.slice(0,60), placeholder: el.getAttribute('placeholder')}))")))
    context.close()


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel='chrome', headless=True)
    if '--inspect' in sys.argv:
        inspect(browser)
    else:
        run_checks(browser)
    browser.close()
assert not errors, errors
