"""Selected-batch removal retains confirmation on failure; no live API calls."""
import json
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright, expect

ARTIFACTS = Path(__file__).parent / 'artifacts/unenrollment-recovery'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
checks, errors, deletes = [], [], []
student = {'id': 7, 'name': 'Synthetic Learner', 'school_id': '2026-00007',
           'email': 'synthetic@example.invalid', 'course': 'BSIT', 'skill_scores': {}}
roster = [student]
batches = [{'id': 50, 'name': 'Selected synthetic batch', 'status': 'active', 'student_count': 1},
           {'id': 51, 'name': 'Other synthetic batch', 'status': 'active', 'student_count': 1}]
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    context = browser.new_context(viewport={'width': 1280, 'height': 900})
    user = {'id': 1, 'name': 'Synthetic Instructor', 'role': 'instructor', 'is_approved': True}
    values = {'sb-token': 'synthetic', 'sb-role': 'instructor', 'sb-user': json.dumps(user)}
    context.add_init_script('for (const [k,v] of Object.entries(' + json.dumps(values) + ')) localStorage.setItem(k,v)')
    def route_request(route):
        url = urlparse(route.request.url)
        if url.hostname not in ['localhost', '127.0.0.1']: return route.abort()
        if not url.path.startswith('/api/'): return route.continue_()
        if url.path.endswith('/events/'): return route.fulfill(status=204)
        if url.path == '/api/auth/me/': return route.fulfill(json=user)
        if url.path == '/api/instructor/batches/': return route.fulfill(json=batches)
        if url.path == '/api/instructor/batches/50/students/': return route.fulfill(json={'students': roster, 'batch': batches[0]})
        if url.path == '/api/instructor/batches/51/students/': return route.fulfill(json={'students': [student], 'batch': batches[1]})
        if url.path == '/api/instructor/students/7/' and route.request.method == 'DELETE':
            deletes.append(parse_qs(url.query))
            assert deletes[-1] == {'batch_id': ['50']}
            if len(deletes) == 1: return route.fulfill(status=503, json={'error': 'Synthetic unavailable'})
            roster.clear()
            batches[0]['student_count'] = 0
            return route.fulfill(json={'message': 'Unenrolled'})
        return route.fulfill(json=[])
    context.route('**/*', route_request)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    try:
        page.goto('http://127.0.0.1:5178/instructor/students')
        page.wait_for_load_state('networkidle')
        expect(page.get_by_text('Synthetic Learner', exact=True)).to_be_visible()
        page.get_by_title('Remove', exact=True).first.click()
        dialog = page.get_by_role('dialog')
        expect(dialog).to_contain_text('Assessment scores and placement history are preserved.')
        remove = dialog.get_by_role('button', name='Remove', exact=True)
        remove.evaluate('(b)=>{b.click();b.click()}')
        expect(dialog.get_by_role('alert')).to_contain_text('Server is unavailable')
        expect(remove).to_be_enabled()
        assert len(deletes) == 1 and roster == [student]
        checks.append('Denied write retains confirmation and student; one selected-batch request per activation')
        remove.click()
        expect(dialog).to_have_count(0)
        expect(page.get_by_text('Synthetic Learner', exact=True)).to_have_count(0)
        assert len(deletes) == 2 and not roster and batches[1]['student_count'] == 1
        page.reload()
        page.wait_for_load_state('networkidle')
        expect(page.get_by_text('Synthetic Learner', exact=True)).to_have_count(0)
        checks.append('Explicit successful retry removes only the selected roster and remains removed after reload')
        page.screenshot(path=str(ARTIFACTS / 'removed.png'), full_page=True)
        assert not errors, errors
    finally:
        result = {'checks': checks, 'page_errors': errors, 'selected_batch_requests': deletes}
        (ARTIFACTS / 'results.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
        print(json.dumps(result, indent=2))
        context.close()
        browser.close()
