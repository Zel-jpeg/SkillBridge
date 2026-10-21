"""Assessment creator draft lifecycle regressions; only synthetic intercepted API data."""
import json
import os
import re
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('DRAFT_TEST_BASE', 'http://127.0.0.1:5178')
CATEGORIES = [{'id': 1, 'name': 'Programming'}]
QUESTION = {'id': 1, 'text': '', 'type': 'mcq', 'choices': ['', '', '', ''],
            'correct': None, 'identAnswer': '', 'categoryId': None, 'expanded': True}
BLANK = {'title': '', 'categories': CATEGORIES, 'questions': [QUESTION], 'savedAt': 1}
checks = []
errors = []

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    try:
        for role in ['instructor', 'admin']:
            context = browser.new_context()
            user = {'id': 1, 'role': role, 'name': 'Synthetic Staff', 'is_approved': True}
            key = f'sb_assessment_draft:{role}:1'
            context.add_init_script('for (const [k,v] of Object.entries(' + json.dumps({
                'sb-token': 'synthetic', 'sb-role': role, 'sb-user': json.dumps(user)
            }) + ')) localStorage.setItem(k,v)')

            def route_request(route):
                url = urlparse(route.request.url)
                if url.hostname not in ['localhost', '127.0.0.1']:
                    return route.abort()
                if not url.path.startswith('/api/'):
                    return route.continue_()
                if url.path.endswith('/events/'):
                    return route.fulfill(status=204)
                if url.path == '/api/auth/me/':
                    return route.fulfill(json=user)
                if url.path == '/api/categories/':
                    return route.fulfill(json=CATEGORIES)
                if url.path == '/api/instructor/batches/':
                    return route.fulfill(json=[{'id': 3, 'name': 'Synthetic Batch', 'status': 'active',
                                                'instructor_id': 1, 'instructor_name': 'Synthetic Staff'}])
                if url.path == '/api/instructor/assessments/' and route.request.method == 'POST':
                    return route.fulfill(status=201, json={'id': 7})
                if url.path == '/api/instructor/assessments/':
                    return route.fulfill(json=[{'id': 2, 'batch_id': 3, 'display_order': 4}])
                return route.fulfill(json=[])

            context.route('**/*', route_request)
            page = context.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            url = BASE + f'/{role}/assessment/create'

            def open_creator(suffix=''):
                page.goto(url + suffix)
                page.wait_for_load_state('networkidle')
                expect(page.get_by_role('heading', name='New assessment', exact=True)).to_be_visible()

            def stored():
                return page.evaluate('(key) => JSON.parse(localStorage.getItem(key))', key)

            def seed(value):
                page.evaluate('([key,value]) => localStorage.setItem(key, JSON.stringify(value))', [key, value])
                page.reload(wait_until='networkidle')

            title = page.get_by_placeholder(re.compile('e.g. BSIT OJT Skills Assessment'))
            restore = page.get_by_role('button', name='Restore draft', exact=True)
            discard = page.get_by_role('button', name='Discard', exact=True)
            open_creator('?batch_id=3')
            page.wait_for_timeout(1250)
            assert stored() is None
            expect(restore).to_have_count(0)
            expect(page.get_by_text(re.compile('Saved on this device'))).to_have_count(0)
            checks.append(f'{role}: untouched page including automatic batch/order/categories creates no draft')

            open_creator()
            seed(BLANK)
            page.wait_for_timeout(1250)
            expect(restore).to_have_count(0)
            assert stored() is None
            checks.append(f'{role}: legacy empty draft is ignored and cleared')

            original = {**BLANK, 'title': 'Recover original work'}
            seed(original)
            expect(restore).to_be_visible()
            title.fill('Do not overwrite recovery')
            page.wait_for_timeout(1250)
            assert stored() == original
            restore.click()
            expect(title).to_have_value(original['title'])
            page.wait_for_timeout(1250)
            assert stored()['title'] == original['title']
            checks.append(f'{role}: pending recovery survives editing/waiting; Restore restores original')

            page.reload(wait_until='networkidle')
            discard.click()
            page.wait_for_timeout(1250)
            assert stored() is None
            page.reload(wait_until='networkidle')
            expect(restore).to_have_count(0)
            checks.append(f'{role}: discard stays discarded after waiting and revisiting')

            title.fill('Immediate refresh')
            page.reload(wait_until='networkidle')
            expect(restore).to_be_visible()
            assert stored()['title'] == 'Immediate refresh'
            restore.click()
            title.fill('Immediate navigation')
            page.get_by_role('button', name='Dashboard', exact=True).click()
            expect(page.get_by_role('heading', name='New assessment', exact=True)).to_have_count(0)
            assert stored()['title'] == 'Immediate navigation'
            open_creator()
            restore.click()
            expect(title).to_have_value('Immediate navigation')
            title.fill('')
            page.wait_for_timeout(1250)
            assert stored() is None
            checks.append(f'{role}: edits flush on immediate refresh/navigation; reverting clears recovery')

            page.evaluate("() => { window.originalSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function(k,v) { if(String(k).startsWith('sb_assessment_draft:')) throw new Error('Synthetic quota'); return window.originalSetItem.call(this,k,v) } }")
            title.fill('Storage unavailable')
            page.wait_for_timeout(1250)
            expect(page.get_by_text(re.compile('Saved on this device'))).to_have_count(0)
            assert stored() is None
            page.evaluate('() => { Storage.prototype.setItem = window.originalSetItem }')
            title.fill('Submit draft')
            page.get_by_placeholder('e.g. 60').fill('30')
            page.get_by_role('button', name='Save draft', exact=True).click()
            expect(page.get_by_role('heading', name='Assessment saved as a draft!')).to_be_visible()
            assert stored() is None
            page.get_by_role('button', name='Create another', exact=True).click()
            page.wait_for_timeout(1250)
            expect(restore).to_have_count(0)
            assert stored() is None
            checks.append(f'{role}: storage failure never shows success; server save/Create another leave no ghost draft')

            page.get_by_placeholder('e.g. 60').fill('12')
            page.reload(wait_until='networkidle')
            expect(restore).to_be_visible()
            expect(page.get_by_text('1 question with content', exact=False)).to_have_count(0)
            restore.click()
            expect(title).to_have_value('')
            expect(page.get_by_placeholder('e.g. 60')).to_have_value('12')
            page.get_by_placeholder('e.g. 60').fill('')
            page.get_by_role('button', name='Upload file', exact=True).click()
            page.get_by_role('button', name='Text file (.txt)', exact=True).click()
            page.locator('input[type=file][accept=".txt"]').set_input_files({
                'name': 'synthetic.txt', 'mimeType': 'text/plain',
                'buffer': b'QUESTION: Synthetic import?\nTYPE: mcq\nA: Yes\nB: No\nCORRECT: A\nCATEGORY: Programming\n'
            })
            page.get_by_role('button', name='Import 1 question', exact=True).click()
            page.reload(wait_until='networkidle')
            expect(restore).to_be_visible()
            restore.click()
            assert stored()['questions'][0]['text'] == 'Synthetic import?'
            assert stored()['questions'][0]['correct'] == 0
            checks.append(f'{role}: settings-only edits and imported questions recover, without counting a blank placeholder')
            context.close()
        assert not errors, errors
    finally:
        print(json.dumps({'checks': checks, 'page_errors': errors}, indent=2), flush=True)
        browser.close()
