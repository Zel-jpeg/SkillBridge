"""Real admin UI: edits/archive/restore await confirmed synthetic writes."""
import json
import re
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

ARTIFACTS = Path(__file__).parent / 'artifacts/admin-account-recovery'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
teacher = {'id': 2, 'name': 'Original Instructor', 'email': 'original@dnsc.edu.ph', 'instructor_id': 'SYN-2',
           'department': 'Institute of Computing', 'courses': 'BSIT / BSIS', 'is_approved': True, 'is_active': True}
user = {'id': 1, 'name': 'Synthetic Admin', 'role': 'admin', 'is_approved': True}
checks, errors, patches, deletes = [], [], [], []
fail_read = [False]
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    context = browser.new_context(viewport={'width': 1280, 'height': 900})
    values = {'sb-token': 'synthetic', 'sb-role': 'admin', 'sb-user': json.dumps(user)}
    context.add_init_script('for (const [k,v] of Object.entries(' + json.dumps(values) + ')) localStorage.setItem(k,v)')
    def route_request(route):
        url, method = urlparse(route.request.url), route.request.method
        if url.hostname not in ['localhost', '127.0.0.1']: return route.abort()
        if not url.path.startswith('/api/'): return route.continue_()
        if url.path.endswith('/events/'): return route.fulfill(status=204)
        if url.path == '/api/auth/me/': return route.fulfill(json=user)
        if url.path == '/api/admin/users/':
            if fail_read[0]: return route.fulfill(status=503, json={'error': 'synthetic refresh outage'})
            return route.fulfill(json={'students': [], 'instructors': [teacher] if teacher['is_active'] else [],
                'pending_instructors': [], 'archived_students': [], 'archived_instructors': [] if teacher['is_active'] else [teacher]})
        if url.path == '/api/admin/users/2/' and method == 'PATCH':
            payload = route.request.post_data_json
            patches.append(payload)
            if len(patches) == 1: return route.fulfill(status=400, json={'error': 'Synthetic instructor edit rejected; correct the draft.'})
            teacher.update(payload)
            if 'is_active' not in payload: fail_read[0] = True
            return route.fulfill(json=teacher)
        if url.path == '/api/admin/users/2/' and method == 'DELETE':
            deletes.append(url.path)
            if len(deletes) == 1: return route.fulfill(status=409, json={'error': 'Synthetic account conflict; refresh before retry.'})
            teacher['is_active'] = False
            return route.fulfill(json=teacher)
        return route.fulfill(json=[])
    context.route('**/*', route_request)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    try:
        page.goto('http://127.0.0.1:5178/admin/users')
        page.wait_for_load_state('networkidle')
        page.get_by_role('button', name=re.compile('^Instructors')).click()
        page.get_by_text('Original Instructor', exact=True).click()
        dialog = page.get_by_role('dialog', name='Original Instructor', exact=True)
        dialog.get_by_role('button', name='Edit instructor', exact=True).click()
        dialog.get_by_label('name', exact=True).fill('Updated Instructor')
        dialog.get_by_role('button', name='Save changes', exact=True).evaluate('(b)=>{b.click();b.click()}')
        expect(dialog.locator('[role="alert"]:not(.sb-toast-message)')).to_have_text('Synthetic instructor edit rejected; correct the draft.')
        expect(dialog.get_by_label('name', exact=True)).to_have_value('Updated Instructor')
        assert len(patches) == 1
        dialog.get_by_role('button', name='Save changes', exact=True).click()
        expect(dialog).to_have_count(0)
        expect(page.get_by_text('Updated Instructor', exact=True)).to_be_visible()
        expect(page.get_by_text('Could not refresh. Showing the last loaded data.')).to_be_visible()
        assert len(patches) == 2
        checks.append('Failed edit retains fields; double click sends one write; confirmed update survives failed follow-up read')
        fail_read[0] = False
        page.get_by_role('button', name='Retry', exact=True).click()
        page.get_by_text('Updated Instructor', exact=True).click()
        page.get_by_role('dialog', name='Updated Instructor', exact=True).get_by_role('button', name='Remove instructor', exact=True).click()
        confirmation = page.get_by_role('dialog', name='Remove instructor?', exact=True)
        confirmation.get_by_role('button', name='Remove', exact=True).click()
        expect(confirmation.locator('[role="alert"]:not(.sb-toast-message)')).to_have_text('Synthetic account conflict; refresh before retry.')
        assert teacher['is_active']
        confirmation.get_by_role('button', name='Remove', exact=True).click()
        expect(confirmation).to_have_count(0)
        assert len(deletes) == 2 and not teacher['is_active']
        page.get_by_role('button', name=re.compile('^Archived')).click()
        page.get_by_text('Updated Instructor', exact=True).click()
        page.get_by_role('button', name='Restore account', exact=True).click()
        expect(page.get_by_role('button', name='Restore account', exact=True)).to_have_count(0)
        assert teacher['is_active']
        page.get_by_role('button', name=re.compile('^Instructors')).click()
        expect(page.get_by_text('Updated Instructor', exact=True)).to_be_visible()
        checks.append('Failed archive remains actionable; confirmed archive enters Archived; restore returns active account')
        page.evaluate('window.scrollTo(0,0)')
        page.screenshot(path=str(ARTIFACTS / 'restored.png'), full_page=True)
        assert not errors, errors
    finally:
        (ARTIFACTS / 'results.json').write_text(json.dumps({'checks': checks, 'page_errors': errors}, indent=2), encoding='utf-8')
        print(json.dumps({'checks': checks, 'page_errors': errors}, indent=2))
        context.close()
        browser.close()
