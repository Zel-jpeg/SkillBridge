"""Real upload hooks and draft payloads; all API responses are intercepted.

Run against the production preview on 5199. No live database or provider calls.
"""
import csv
import json
from pathlib import Path
import shutil
import subprocess
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).parent / 'artifacts/assessment-numeric-import'
OUT.mkdir(parents=True, exist_ok=True)
BASE = 'http://127.0.0.1:5199'
HEADERS = ['question', 'type', 'choice_a', 'choice_b', 'choice_c', 'choice_d', 'correct', 'category']
records = []
for index, letter in enumerate('ABCD'):
    choices = [1, 2, 3, 4]
    choices[index] = 0
    records.append(dict(zip(HEADERS, [f'Zero in choice {letter}: what is printed?\nprint(0)', 'mcq', *choices, letter, 'Programming'])))
records += [
    dict(zip(HEADERS, ['Identify the number zero.', 'identification', '', '', '', '', 0, 'Programming'])),
    dict(zip(HEADERS, ['Zero equals one.', 'truefalse', '', '', '', '', False, 'Programming'])),
    dict(zip(HEADERS, ['Invalid: required A is blank.', 'mcq', '', 1, '', '', 'B', 'Programming'])),
    dict(zip(HEADERS, ['Invalid: the key points to blank C.', 'mcq', 1, 2, '', '', 'C', 'Programming'])),
    dict(zip(HEADERS, ['Ordinary numeric choices.', 'mcq', 7, 8, 9, 10, 'A', 'Programming'])),
    dict(zip(HEADERS, ['Default type retains zero.', '', 1, 0, 2, 3, 'B', 'Programming'])),
]
csv_path = OUT / 'numeric-answers.csv'
with csv_path.open('w', encoding='utf-8-sig', newline='') as output:
    writer = csv.DictWriter(output, fieldnames=HEADERS)
    writer.writeheader()
    writer.writerows(records)
xlsx_path = OUT / 'numeric-answers.xlsx'
# Fixture authoring uses the same installed SheetJS version as the importer.
subprocess.run([shutil.which('node'), '-e',
    "const fs=require('node:fs');const XLSX=require('xlsx');const rows=JSON.parse(fs.readFileSync(0,'utf8'));const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),'Questions');XLSX.writeFile(wb,process.argv[1]);",
    str(xlsx_path)], input=json.dumps(records), text=True, check=True, cwd=ROOT / 'skillbridge-frontend',
    creationflags=subprocess.CREATE_NO_WINDOW)

checks, errors = [], []
ASSESSMENT = {'id': 1, 'title': 'Synthetic zero import', 'batch_id': 1, 'batch_name': 'Synthetic Batch',
    'publication_status': 'draft', 'is_required': True, 'include_in_competency': True,
    'duration_minutes': 30, 'question_count': 0, 'categories': [], 'display_order': 0,
    'availability_status': 'draft', 'questions_locked': False, 'attempt_count': 0,
    'unfinished_attempt_count': 0, 'submission_count': 0, 'flagged_count': 0,
    'available_at': None, 'due_at': None, 'created_at': '2026-10-30T00:00:00Z'}


def verify_payload(questions):
    assert len(questions) == 8, questions
    for index, letter in enumerate('ABCD'):
        question = next(q for q in questions if q['question_text'].startswith('Zero in choice ' + letter))
        assert question['choices'][index] == {'text': '0', 'is_correct': True}, question
        assert len(question['choices']) == 4
    identification = next(q for q in questions if q['question_type'] == 'identification')
    assert identification['correct_answer'] == '0', identification
    boolean = next(q for q in questions if q['question_type'] == 'truefalse')
    assert next(choice for choice in boolean['choices'] if choice['is_correct'])['text'] == 'False'
    default = next(q for q in questions if q['question_text'] == 'Default type retains zero.')
    assert default['question_type'] == 'mcq' and default['choices'][1] == {'text': '0', 'is_correct': True}
    assert not any(q['question_text'].startswith('Invalid:') for q in questions)


with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    try:
        for role in ('instructor', 'admin'):
            for flow in ('create', 'existing'):
                for file in (csv_path, xlsx_path):
                    user = {'id': 1, 'role': role, 'name': 'Synthetic Import Staff', 'is_approved': True}
                    context = browser.new_context(viewport={'width': 1440, 'height': 1100}, reduced_motion='reduce')
                    context.add_init_script('for(const [k,v] of Object.entries(' + json.dumps({
                        'sb-token': 'synthetic', 'sb-role': role, 'sb-user': json.dumps(user)}) + ')) localStorage.setItem(k,v)')
                    writes = []
                    def route_request(route):
                        url = urlparse(route.request.url)
                        if url.path.startswith('/api/'):
                            if url.path.endswith('/events/'):
                                return route.fulfill(status=204)
                            if url.path in ('/api/auth/me/', '/api/students/me/'):
                                return route.fulfill(json=user)
                            if url.path == '/api/categories/':
                                return route.fulfill(json=[{'id': 1, 'name': 'Programming'}])
                            if url.path == '/api/categories/suggest/':
                                return route.fulfill(json={'suggested_category': None})
                            if url.path == '/api/instructor/batches/':
                                return route.fulfill(json=[{'id': 1, 'name': 'Synthetic Batch', 'status': 'active', 'instructor_id': 1, 'instructor_name': 'Synthetic Staff'}])
                            if url.path.endswith('/questions/'):
                                return route.fulfill(json={'questions': []})
                            if url.path == '/api/instructor/assessments/' and route.request.method == 'GET':
                                return route.fulfill(json=[ASSESSMENT])
                            if url.path == '/api/instructor/assessments/' and route.request.method == 'POST':
                                writes.append(route.request.post_data_json)
                                return route.fulfill(status=201, json={'id': 2, 'title': 'Synthetic numeric answers'})
                            if url.path == '/api/instructor/assessments/1/' and route.request.method == 'PATCH':
                                writes.append(route.request.post_data_json)
                                return route.fulfill(json={**ASSESSMENT, 'questions': []})
                            assert route.request.method == 'GET', (route.request.method, url.path)
                            return route.fulfill(json=[])
                        if url.hostname not in ('127.0.0.1', 'localhost'):
                            return route.abort()
                        route.continue_()
                    context.route('**/*', route_request)
                    page = context.new_page()
                    page.set_default_navigation_timeout(60000)
                    page.set_default_timeout(15000)
                    page.on('pageerror', lambda error: errors.append(str(error)))
                    if flow == 'create':
                        page.goto(BASE + f'/{role}/assessment/create', wait_until='networkidle')
                        page.get_by_role('button', name='Upload file', exact=True).click()
                        upload = page.locator('input[type=file][accept=".xlsx,.xls,.csv"]')
                        if file == csv_path:
                            with page.expect_download() as download:
                                page.get_by_role('button', name='Download ↓', exact=True).click()
                            template = OUT / f'{role}-downloaded-template.csv'
                            download.value.save_as(str(template))
                            upload.set_input_files(str(template))
                            expect(page.get_by_role('button', name='Import 3 questions', exact=True)).to_be_visible()
                        upload.set_input_files(str(file))
                        expect(page.get_by_role('button', name='Import 8 questions', exact=True)).to_be_visible()
                        expect(page.get_by_text('2 rows with issues (skipped):', exact=True)).to_be_visible()
                        expect(page.get_by_text('Row 8: At least choice_a and choice_b are required for MCQ', exact=True)).to_be_visible()
                        expect(page.get_by_text('Row 9: Correct answer must point to a non-empty choice', exact=True)).to_be_visible()
                        page.get_by_role('button', name='Import 8 questions', exact=True).click()
                        page.get_by_placeholder('e.g. BSIT OJT Skills Assessment 2025–2026').fill('Synthetic numeric answers')
                        page.get_by_placeholder('e.g. 60', exact=True).fill('30')
                        page.get_by_role('button', name='Save draft', exact=True).click()
                        expect(page.get_by_role('heading', name='Assessment saved as a draft!', exact=True)).to_be_visible()
                        assert len(writes) == 1
                        verify_payload(writes[0]['questions'])
                    else:
                        page.goto(BASE + f'/{role}/assessments', wait_until='networkidle')
                        page.get_by_role('button', name=('Open assessment ' if role == 'instructor' else 'View details for ') + ASSESSMENT['title'], exact=True).click()
                        if role == 'admin':
                            page.get_by_role('tab', name='Questions', exact=True).click()
                            page.get_by_role('button', name='Edit assessment and questions', exact=True).click()
                        page.get_by_role('button', name='Import questions', exact=True).click()
                        if role == 'admin':
                            page.get_by_label('Question import file', exact=True).set_input_files(str(file))
                            expect(page.get_by_role('button', name='Add 8 imported questions to draft', exact=True)).to_be_enabled()
                            expect(page.get_by_role('alert').filter(has_text='Row 8:')).to_have_count(1)
                            expect(page.get_by_role('alert').filter(has_text='Row 9:')).to_have_count(1)
                            page.get_by_role('button', name='Add 8 imported questions to draft', exact=True).click()
                            page.get_by_role('button', name='Review & save authoring', exact=True).click()
                            page.get_by_role('button', name='Save changes', exact=True).click()
                        else:
                            page.locator('input[type=file][accept=".xlsx,.xls,.csv"]').set_input_files(str(file))
                            expect(page.get_by_role('button', name='Add 8 questions to draft', exact=True)).to_be_enabled()
                            expect(page.get_by_text('2 rows with issues (skipped):', exact=True)).to_be_visible()
                            page.get_by_role('button', name='Add 8 questions to draft', exact=True).click()
                            page.get_by_role('button', name='Save All Changes', exact=True).click()
                            page.get_by_role('button', name='Confirm Save', exact=True).click()
                        expect(page.get_by_role('status').filter(has_text='Assessment saved successfully.')).to_be_visible()
                        assert len(writes) == 1
                        verify_payload(writes[0]['question_changes']['add'])
                    checks.append({'role': role, 'flow': flow, 'format': file.suffix, 'accepted': 8, 'rejected': 2, 'zero_in_save_payload': True})
                    print('PASS:', role, flow, file.suffix, 'zeros/False preserved through save; invalid blanks rejected', flush=True)
                    context.close()
        assert not errors, errors
        (OUT / 'results.json').write_text(json.dumps({'checks': checks, 'page_errors': errors}, indent=2), encoding='utf-8')
    finally:
        browser.close()
