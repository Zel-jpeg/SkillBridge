"""Real disposable API + both staff UIs. No hosted requests or real identities."""
import json
import os
import re
import sys
import shutil
import subprocess
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright, expect

TESTS = Path(__file__).parent
AUTH = json.loads((TESTS / 'artifacts/admin-management/auth.json').read_text(encoding='utf-8'))
OUT = TESTS / 'artifacts/assessment-archives'
OUT.mkdir(parents=True, exist_ok=True)
BASE = 'http://127.0.0.1:' + os.environ['ADMIN_MANAGEMENT_FRONTEND_PORT']
API = 'http://127.0.0.1:' + os.environ['ADMIN_MANAGEMENT_API_PORT']
LIST = '/api/instructor/assessments/'
errors, checks = [], []


def request(context, path, method='get', data=None, identity='admin', expected=200):
    response = getattr(context.request, method)(API + path, headers={'Authorization': 'Bearer ' + AUTH[identity]['token']}, data=data)
    assert response.status == expected, (path, response.status, response.text()[:300])
    return response.json()


def session(browser, identity):
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce')
    user = AUTH[identity]['user']
    context.add_init_script('for(const [k,v] of Object.entries(' + json.dumps({
        'sb-token': AUTH[identity]['token'], 'sb-role': user['role'], 'sb-user': json.dumps(user),
    }) + ')) localStorage.setItem(k,v)')
    def route(route):
        url = urlparse(route.request.url)
        if url.path.endswith('/events/'):
            return route.fulfill(status=204)
        if url.path.startswith('/api/'):
            # Every actual request is redirected to the disposable API.
            response = route.fetch(url=API + url.path + ('?' + url.query if url.query else ''))
            return route.fulfill(response=response)
        return route.continue_() if url.hostname in ('localhost', '127.0.0.1') else route.abort()
    context.route('**/*', route)
    page = context.new_page()
    page.set_default_timeout(12000)
    page.on('pageerror', lambda error: errors.append(str(error)))
    return context, page


def close_context(context):
    # Drain routed refreshes before disposing their request context.
    context.unroute_all(behavior='wait')
    context.close()


def create(context, title):
    return request(context, LIST, 'post', {'title': title, 'batch_id': AUTH['batch_id'],
        'publication_status': 'draft', 'duration_minutes': 30, 'questions': [{
            'question_text': 'Original question', 'question_type': 'identification',
            'category': 'Synthetic Programming', 'correct_answer': 'Original answer'}]}, expected=201)['id']


def open_editor(page, role, title):
    page.goto(BASE + f'/{role}/assessments')
    page.wait_for_load_state('networkidle')
    if role == 'instructor':
        page.get_by_role('searchbox', name='Search assessments', exact=True).fill(title)
        page.get_by_role('button', name=f'Open assessment {title}', exact=True).click()
        dialog = page.get_by_role('dialog', name='Edit assessment', exact=True)
    else:
        page.get_by_role('searchbox', name='Search assessments', exact=True).fill(title)
        page.get_by_role('button', name=f'View details for {title}', exact=True).click()
        page.get_by_role('tab', name='Questions', exact=True).click()
        page.get_by_role('button', name='Edit assessment and questions', exact=True).click()
        dialog = page.get_by_role('dialog', name=f'Edit assessment: {title}', exact=True)
    expect(dialog.get_by_role('button', name='Question 1: Original question', exact=True)).to_be_visible()
    return dialog


def import_file(page, dialog, role, filename, content, mime, text=False):
    dialog.get_by_role('button', name='Import questions', exact=True).click()
    if role == 'instructor':
        if text: page.get_by_role('button', name='Text file (.txt)', exact=True).click()
        selector = 'input[type=file][accept=".txt"]' if text else 'input[type=file][accept=".xlsx,.xls,.csv"]'
        page.locator(selector).set_input_files({'name': filename, 'mimeType': mime, 'buffer': content})
        expect(page.get_by_text('1 question ready to add:', exact=True)).to_be_visible()
        page.get_by_role('button', name='Add 1 question to draft', exact=True).click()
    else:
        if text: dialog.get_by_label('Question import format', exact=True).select_option('text')
        dialog.get_by_label('Question import file', exact=True).set_input_files({'name': filename, 'mimeType': mime, 'buffer': content})
        button = dialog.get_by_role('button', name='Add 1 imported questions to draft', exact=True)
        expect(button).to_be_enabled()
        button.click()


def save(page, dialog, role):
    if role == 'instructor':
        dialog.get_by_role('button', name='Save All Changes', exact=True).click()
        page.get_by_role('button', name='Confirm Save', exact=True).click()
    else:
        dialog.get_by_role('button', name='Review & save authoring', exact=True).click()
        page.get_by_role('dialog', name='Save assessment authoring?', exact=True).get_by_role('button', name='Save changes', exact=True).click()


def exercise_imports(browser, role, identity):
    context, page = session(browser, identity)
    title = f'{role} import draft'
    aid = create(context, title)
    dialog = open_editor(page, role, title)
    if role == 'instructor':
        dialog.get_by_role('button', name='Edit assessment name', exact=True).click()
        dialog.get_by_role('textbox', name='Assessment title', exact=True).fill(title + ' renamed')
        dialog.get_by_role('button', name='Done', exact=True).click()
    else:
        dialog.get_by_label('Assessment title', exact=True).fill(title + ' renamed')
    dialog.get_by_role('button', name='Question 1: Original question', exact=True).click()
    dialog.get_by_placeholder('Type the question here...', exact=True).fill('Unsaved question retained')
    # A delayed parse from a canceled panel must not reappear on the next open.
    delayed = []
    def hold_suggestion(route): delayed.append(route)
    context.route('**/api/categories/suggest/', hold_suggestion)
    dialog.get_by_role('button', name='Import questions', exact=True).click()
    stale_csv = b'question,type,correct,category\nCanceled delayed import,identification,A,Synthetic Programming'
    if role == 'instructor':
        page.locator('input[type=file][accept=".xlsx,.xls,.csv"]').set_input_files({'name': 'canceled.csv', 'mimeType': 'text/csv', 'buffer': stale_csv})
        expect(page.get_by_text('Parsing file…', exact=True)).to_be_visible()
        page.wait_for_timeout(100)
        page.get_by_role('button', name='Cancel', exact=True).last.click()
    else:
        dialog.get_by_label('Question import file', exact=True).set_input_files({'name': 'canceled.csv', 'mimeType': 'text/csv', 'buffer': stale_csv})
        expect(dialog.get_by_text('Reading file…', exact=True)).to_be_visible()
        page.wait_for_timeout(100)
        dialog.get_by_role('button', name='Import questions', exact=True).click()
    assert delayed, 'Synthetic delayed parser request did not start'
    dialog.get_by_role('button', name='Import questions', exact=True).click()
    for route in delayed: route.fulfill(json={})
    context.unroute('**/api/categories/suggest/', hold_suggestion)
    expect(page.get_by_text('Canceled delayed import', exact=True)).to_have_count(0)
    if role == 'instructor': page.get_by_role('button', name='Cancel', exact=True).last.click()
    else: dialog.get_by_role('button', name='Import questions', exact=True).click()
    checks.append(f'{role}: canceled asynchronous import cannot populate a newly opened panel')
    csv = b'question,type,choice_a,choice_b,choice_c,choice_d,correct,category\nCSV import,mcq,Yes,No,,,A,Synthetic Programming\nInvalid row,mcq,Yes,No,,,C,Synthetic Programming\n'
    import_file(page, dialog, role, 'synthetic.csv', csv, 'text/csv')
    expect(dialog.get_by_placeholder('Type the question here...', exact=True).first).to_have_value('Unsaved question retained')
    assert request(context, LIST + f'{aid}/questions/')['questions'][0]['question_text'] == 'Original question'
    assert len(request(context, LIST + f'{aid}/questions/')['questions']) == 1
    txt = b'QUESTION: TXT import\nTYPE: identification\nCORRECT: CPU\nCATEGORY: Synthetic Programming'
    import_file(page, dialog, role, 'synthetic.txt', txt, 'text/plain', text=True)
    workbook = OUT / f'{role}-questions.xlsx'
    subprocess.run([shutil.which('node'), '-e', "const x=require('./node_modules/xlsx'); const w=x.utils.book_new(); x.utils.book_append_sheet(w,x.utils.json_to_sheet([{question:'XLSX import',type:'truefalse',correct:'False',category:'Synthetic Programming'}]),'Questions'); x.writeFile(w,process.argv[1]);", str(workbook.resolve())],
                   cwd=TESTS.parent, check=True, creationflags=subprocess.CREATE_NO_WINDOW)
    import_file(page, dialog, role, 'synthetic.xlsx', workbook.read_bytes(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    original_state = request(context, LIST + f'{aid}/questions/')['questions']
    assert len(original_state) == 1
    # The first composite save fails; all local edits/imports must remain retryable.
    failures = [1]
    def fail_once(route):
        if route.request.method == 'PATCH' and failures[0]:
            failures[0] -= 1
            return route.fulfill(status=400, json={'error': 'Synthetic authoring save failure'})
        return route.fallback()
    context.route('**/api/instructor/assessments/' + str(aid) + '/', fail_once)
    save(page, dialog, role)
    expect(dialog.get_by_text('Synthetic authoring save failure', exact=True)).to_be_visible()
    assert len(request(context, LIST + f'{aid}/questions/')['questions']) == 1
    save(page, dialog, role)
    expect(page.get_by_role('status').filter(has_text='Assessment saved successfully.')).to_be_visible()
    if role == 'admin': expect(dialog).not_to_be_visible()
    else: expect(dialog.get_by_role('heading', name=title + ' renamed', exact=True)).to_be_visible()
    final = request(context, LIST + f'{aid}/questions/')['questions']
    assert len(final) == 4, final
    assert final[0]['question_text'] == 'Unsaved question retained'
    assert final[0]['id'] == original_state[0]['id']
    assert {q['question_type'] for q in final} == {'mcq', 'truefalse', 'identification'}
    assert next(q for q in final if q['question_text'] == 'XLSX import')['choices'][1]['is_correct']
    checks.append(f'{role}: CSV/TXT/XLSX imports stage locally, preserve metadata/question edits, reject invalid key, survive failed save, and retry once atomically')
    # A staged import must disappear only after an explicit discard.
    if role == 'admin':
        # Open the authoring editor again for the saved name.
        page.goto(BASE + '/admin/assessments')
        page.wait_for_load_state('networkidle')
        page.get_by_role('searchbox', name='Search assessments', exact=True).fill(title + ' renamed')
        page.get_by_role('button', name=f'View details for {title} renamed', exact=True).click()
        page.get_by_role('tab', name='Questions', exact=True).click()
        page.get_by_role('button', name='Edit assessment and questions', exact=True).click()
        dialog = page.get_by_role('dialog', name=f'Edit assessment: {title} renamed', exact=True)
    import_file(page, dialog, role, 'discard.txt', b'QUESTION: Discard me\nTYPE: identification\nCORRECT: A\nCATEGORY: Synthetic Programming', 'text/plain', text=True)
    dialog.get_by_role('button', name='Cancel' if role == 'instructor' else 'Close editor', exact=True).click()
    discard = page.get_by_role('dialog', name='Discard unsaved changes?' if role == 'instructor' else 'Discard authoring changes?', exact=True)
    discard.get_by_role('button', name='Cancel', exact=True).click()
    expect(dialog.get_by_placeholder('Type the question here...', exact=True).last).to_have_value('Discard me')
    dialog.get_by_role('button', name='Cancel' if role == 'instructor' else 'Close editor', exact=True).click()
    discard.get_by_role('button', name='Discard changes' if role == 'instructor' else 'Discard', exact=True).click()
    assert len(request(context, LIST + f'{aid}/questions/')['questions']) == 4
    checks.append(f'{role}: canceled discard preserves imports; confirmed discard leaves saved questions unchanged')
    close_context(context)


def exercise_archives(browser):
    context, page = session(browser, 'admin')
    aids = []
    for i in range(12):
        aid = create(context, f'Archived fixture {i:02d}')
        request(context, LIST + f'{aid}/archive/', 'post')
        aids.append(aid)
    # A completed assessment retains authorized results and score history.
    locked_id = AUTH['locked_id']
    request(context, LIST + f'{locked_id}/', 'patch', {'publication_status': 'closed'})
    request(context, LIST + f'{locked_id}/archive/', 'post')
    for role, identity in [('admin', 'admin'), ('instructor', 'owner')]:
        if role == 'instructor':
            close_context(context)
            context, page = session(browser, identity)
        page.goto(BASE + f'/{role}/assessments')
        page.wait_for_load_state('networkidle')
        expect(page.get_by_role('button', name=re.compile('(?:View details for|Open assessment) Archived fixture'))).to_have_count(0)
        page.get_by_role('link', name='Assessment archives', exact=True).click()
        expect(page.get_by_role('heading', name='Assessment archives', exact=True)).to_be_visible()
        expect(page.get_by_text('13 archived assessments', exact=True)).to_be_visible()
        expect(page.get_by_text('Showing 1–10 of 13', exact=True)).to_be_visible()
        page.get_by_role('button', name=re.compile('Next')).click()
        expect(page.get_by_text('Showing 11–13 of 13', exact=True)).to_be_visible()
        page.get_by_role('searchbox', name='Search archives', exact=True).fill('Archived fixture 00')
        expect(page.get_by_text('1 archived assessment', exact=True)).to_be_visible()
        expect(page.get_by_role('button', name=re.compile('Next'))).to_have_count(0)
        page.get_by_role('button', name='Archived fixture 00', exact=True).click()
        details = page.get_by_role('dialog', name='Archived fixture 00', exact=True)
        expect(details.get_by_text('Archived assessment · Read-only.', exact=False)).to_be_visible()
        details.get_by_role('tab', name='Settings', exact=True).click()
        expect(details.get_by_role('textbox', name='Title', exact=True)).to_be_disabled()
        details.get_by_role('tab', name='Questions', exact=True).click()
        expect(details.get_by_role('button', name='Edit assessment and questions', exact=True)).to_have_count(0)
        details.get_by_role('button', name='View authorized answer key', exact=True).click()
        expect(details.get_by_text('Key: Original answer', exact=True)).to_be_visible()
        details.press('Escape')
        expect(details).not_to_be_visible()
        page.get_by_role('searchbox', name='Search archives', exact=True).fill('no matching fixture')
        expect(page.get_by_role('heading', name='No matching archives', exact=True)).to_be_visible()
        page.get_by_role('button', name='Clear filters', exact=True).click()
        for width, dark in [(1440, False), (768, False), (390, True), (320, False)]:
            page.set_viewport_size({'width': width, 'height': 900})
            page.evaluate('value => document.documentElement.classList.toggle("dark", value)', dark)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (role, width)
            page.screenshot(path=str(OUT / f'{role}-{width}-{"dark" if dark else "light"}.png'), full_page=True)
        page.set_viewport_size({'width': 1440, 'height': 1000})
        checks.append(f'{role}: archives hidden from library; dedicated page, search/reset, pagination, read-only settings, authorized keys, keyboard dismissal and responsive themes')
    # Retry restore failure without losing the archived record or confirmation.
    page.get_by_role('searchbox', name='Search archives', exact=True).fill('Archived fixture 00')
    attempts = [0]
    def restore_failure(route):
        attempts[0] += 1
        if attempts[0] == 1: return route.fulfill(status=503, json={'error': 'Synthetic restore outage'})
        return route.fallback()
    context.route('**/api/instructor/assessments/' + str(aids[0]) + '/restore/', restore_failure)
    page.get_by_role('button', name='Restore assessment', exact=True).click()
    confirm = page.get_by_role('dialog', name='Restore assessment?', exact=True)
    confirm.get_by_role('button', name='Restore assessment', exact=True).click()
    expect(confirm.get_by_role('alert').first).to_be_visible()
    confirm.get_by_role('button', name='Restore assessment', exact=True).click()
    expect(confirm).not_to_be_visible()
    expect(page.get_by_role('button', name='Archived fixture 00', exact=True)).to_have_count(0)
    restored = next(a for a in request(context, LIST, identity='owner') if a['id'] == aids[0])
    assert not restored['is_archived'] and restored['publication_status'] == 'draft'
    page.get_by_role('link', name='Back to assessments', exact=True).click()
    page.get_by_role('searchbox', name='Search assessments', exact=True).fill('Archived fixture 00')
    page.get_by_role('button', name='Open assessment Archived fixture 00', exact=True).click()
    editor = page.get_by_role('dialog', name='Edit assessment', exact=True)
    editor.get_by_role('button', name='Archive assessment', exact=True).click()
    page.get_by_role('dialog', name='Archive assessment?', exact=True).get_by_role('button', name='Cancel', exact=True).click()
    expect(editor).to_be_visible()
    editor.get_by_role('button', name='Archive assessment', exact=True).click()
    page.get_by_role('dialog', name='Archive assessment?', exact=True).get_by_role('button', name='Archive assessment', exact=True).click()
    expect(editor).not_to_be_visible()
    checks.append('Instructor archive/restore confirmations, canceled archive and failed restore/retry preserve state and restore to Draft')
    close_context(context)
    # The other instructor cannot read either active or archived assessments.
    context, page = session(browser, 'other')
    assert request(context, LIST, identity='other') == []
    page.goto(BASE + '/instructor/assessments/archives')
    page.wait_for_load_state('networkidle')
    expect(page.get_by_role('heading', name='No archived assessments', exact=True)).to_be_visible()
    request(context, LIST + f'{aids[0]}/restore/', 'post', identity='other', expected=404)
    close_context(context)
    checks.append('Foreign instructor has empty archive list and direct restore returns 404')
    # Admin uses the same confirmations from oversight and the dedicated page.
    context, page = session(browser, 'admin')
    admin_id = create(context, 'Admin archive action')
    page.goto(BASE + '/admin/assessments')
    page.wait_for_load_state('networkidle')
    page.get_by_role('searchbox', name='Search assessments', exact=True).fill('Admin archive action')
    page.get_by_role('button', name='View details for Admin archive action', exact=True).click()
    page.get_by_role('dialog', name='Admin archive action', exact=True).get_by_role('button', name='Archive assessment', exact=True).click()
    page.get_by_role('dialog', name='Archive assessment?', exact=True).get_by_role('button', name='Archive assessment', exact=True).click()
    expect(page.get_by_role('dialog', name='Admin archive action', exact=True)).not_to_be_visible()
    page.get_by_role('link', name='Assessment archives', exact=True).click()
    page.get_by_role('searchbox', name='Search archives', exact=True).fill('Admin archive action')
    page.get_by_role('button', name='Restore assessment', exact=True).click()
    page.get_by_role('dialog', name='Restore assessment?', exact=True).get_by_role('button', name='Restore assessment', exact=True).click()
    expect(page.get_by_role('button', name='Admin archive action', exact=True)).to_have_count(0)
    assert not next(a for a in request(context, LIST) if a['id'] == admin_id)['is_archived']
    close_context(context)
    checks.append('Admin oversight archive and archive-page restore use the shared confirmed lifecycle')

    context, page = session(browser, 'admin')
    fail = [True]
    def outage(route):
        if fail[0]: return route.fulfill(status=503, json={'error': 'Synthetic archive list outage'})
        return route.fallback()
    context.route(re.compile(r'/api/instructor/assessments/(?:\?.*)?$'), outage)
    page.goto(BASE + '/admin/assessments/archives')
    page.wait_for_load_state('networkidle')
    expect(page.get_by_role('button', name='Retry', exact=True)).to_be_visible()
    expect(page.get_by_role('heading', name='No archived assessments', exact=True)).to_have_count(0)
    fail[0] = False
    page.get_by_role('button', name='Retry', exact=True).click()
    expect(page.get_by_text('13 archived assessments', exact=True)).to_be_visible()
    close_context(context)
    checks.append('Archive load failure shows Retry instead of false emptiness; retry recovers real archive collection')


with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    try:
        exercise_imports(browser, 'instructor', 'owner')
        exercise_imports(browser, 'admin', 'admin')
        exercise_archives(browser)
    finally:
        browser.close()
assert not errors, errors
(OUT / 'checks.json').write_text(json.dumps({'checks': checks, 'page_errors': errors}, indent=2), encoding='utf-8')
print(json.dumps({'checks': checks, 'page_errors': errors}, indent=2))
