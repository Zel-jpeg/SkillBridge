"""Actual instructor editor sends one transactional save and retains failed drafts."""
import json
import os
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

ARTIFACTS = Path(__file__).parent / 'artifacts/assessment-save-recovery'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
BASE = os.environ.get('SKILLBRIDGE_TEST_BASE', 'http://127.0.0.1:5178')
assessment = {'id': 1, 'title': 'Synthetic assessment', 'batch_id': 1, 'batch_name': 'Synthetic batch',
              'duration_minutes': 30, 'publication_status': 'draft', 'is_required': True, 'include_in_competency': True,
              'display_order': 1, 'available_at': None, 'due_at': None, 'question_count': 1, 'questions_locked': False}
questions = [{'id': 1, 'question_text': 'Original question', 'question_type': 'identification', 'question_order': 1,
              'category': {'id': 1, 'name': 'Programming'}, 'choices': [{'id': 1, 'text': 'Synthetic answer', 'is_correct': True}]}]
checks, errors, writes, reads = [], [], [], []
fail_list = [False]
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    context = browser.new_context(viewport={'width': 1280, 'height': 950})
    user = {'id': 1, 'name': 'Synthetic Instructor', 'role': 'instructor', 'is_approved': True}
    values = {'sb-token': 'synthetic', 'sb-role': 'instructor', 'sb-user': json.dumps(user)}
    context.add_init_script('for (const [k,v] of Object.entries(' + json.dumps(values) + ')) localStorage.setItem(k,v)')
    def route_request(route):
        url, method = urlparse(route.request.url), route.request.method
        if not url.path.startswith('/api/'):
            return route.continue_() if url.hostname in ['localhost', '127.0.0.1'] else route.abort()
        if url.path.endswith('/events/'): return route.fulfill(status=204)
        if url.path == '/api/auth/me/': return route.fulfill(json=user)
        # This existing advisory POST is a read, not an assessment mutation.
        if url.path == '/api/categories/suggest/' and method == 'POST':
            return route.fulfill(json={'suggested_category': None})
        if method != 'GET':
            writes.append((method, url.path, route.request.post_data_json))
        if url.path == '/api/instructor/assessments/':
            return route.fulfill(status=503, json={'error': 'Synthetic list refresh outage'}) if fail_list[0] else route.fulfill(json=[assessment])
        if url.path == '/api/instructor/batches/': return route.fulfill(json=[{'id': 1, 'name': 'Synthetic batch'}])
        if url.path == '/api/categories/': return route.fulfill(json=[{'id': 1, 'name': 'Programming'}])
        if url.path == '/api/instructor/assessments/1/questions/':
            reads.append(url.path)
            return route.fulfill(json={'assessment': assessment, 'questions': questions})
        if url.path == '/api/instructor/assessments/1/' and method == 'PATCH':
            if len(writes) == 1: return route.fulfill(status=400, json={'error': 'Synthetic complete-save validation failed.'})
            payload = route.request.post_data_json
            assert payload['question_changes']['update'][0]['id'] == 1
            questions[0]['question_text'] = payload['question_changes']['update'][0]['question_text']
            assessment['title'] = payload['title']
            fail_list[0] = True
            return route.fulfill(json={**assessment, 'questions': questions})
        return route.fulfill(json=[])
    context.route('**/*', route_request)
    page = context.new_page()
    page.set_default_timeout(10000)
    page.set_default_navigation_timeout(30000)
    page.on('pageerror', lambda error: errors.append(str(error)))
    try:
        page.goto(BASE + '/instructor/assessments')
        page.wait_for_load_state('networkidle')
        page.get_by_role('button', name='Open assessment Synthetic assessment', exact=True).click()
        title = page.get_by_placeholder('Assessment title', exact=True)
        expect(title).to_have_count(0)
        page.get_by_role('button', name='Edit assessment name', exact=True).click()
        expect(title).to_be_focused()
        title.fill('Updated complete assessment')
        page.get_by_role('button', name='Done', exact=True).click()
        page.get_by_text('Original question', exact=True).click()
        question = page.get_by_placeholder('Type the question here...', exact=True)
        question.fill('Updated question retained on failure')
        page.get_by_role('button', name='Save All Changes', exact=True).click()
        page.get_by_role('button', name='Confirm Save', exact=True).evaluate('(b)=>{b.click();b.click()}')
        expect(page.get_by_role('dialog', name='Edit assessment', exact=True).get_by_role('alert')).to_have_text('Synthetic complete-save validation failed.')
        expect(page.get_by_role('dialog', name='Edit assessment', exact=True).get_by_role('heading', name='Updated complete assessment', exact=True)).to_be_visible()
        expect(question).to_have_value('Updated question retained on failure')
        assert len(writes) == 1
        assert assessment['title'] == 'Synthetic assessment' and questions[0]['question_text'] == 'Original question'
        checks.append('Failed complete save retains title/question draft and performs one PATCH, no separate question writes')
        page.get_by_role('button', name='Save All Changes', exact=True).click()
        page.get_by_role('button', name='Confirm Save', exact=True).click()
        expect(page.get_by_role('status').filter(has_text='Assessment saved successfully.')).to_be_visible()
        expect(page.get_by_text('Updated question retained on failure', exact=True)).to_be_visible()
        assert len(writes) == 2 and all(method == 'PATCH' and path == '/api/instructor/assessments/1/' for method, path, _ in writes)
        assert len(reads) == 1
        checks.append('Confirmed response supplies canonical question state despite failed list refresh; no follow-up question fetch or replay')
        page.screenshot(path=str(ARTIFACTS / 'confirmed.png'), full_page=True)
        assert not errors, errors
    finally:
        (ARTIFACTS / 'results.json').write_text(json.dumps({'checks': checks, 'page_errors': errors}, indent=2), encoding='utf-8')
        print(json.dumps({'checks': checks, 'page_errors': errors}, indent=2))
        context.close()
        browser.close()
