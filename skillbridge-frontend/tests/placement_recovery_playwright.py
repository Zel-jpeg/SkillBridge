"""Synthetic placement write/refresh failures preserve remarks and avoid replay."""
import json
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

ARTIFACTS = Path(__file__).parent / 'artifacts/placement-recovery'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
checks, errors, writes = [], [], []
student = {'id': 3, 'name': 'Synthetic Placement Student', 'school_id': '2026-00003', 'course': 'BSIT'}
suggestion = {'recommendation_id': 8, 'placement_id': None, 'placement_status': 'unplaced', 'student': student,
              'batch': {'id': 1, 'name': 'Synthetic Batch'}, 'match_score': 80,
              'category_score_component': 80, 'nlp_score_component': 80, 'location_score_component': 80}
position = {'id': 1, 'title': 'Synthetic Intern', 'slots_available': 5, 'approved_count': 0,
            'remaining_slots': 5, 'suggested_students': [suggestion]}
company = {'id': 1, 'name': 'Synthetic Employer', 'address': {'city': 'Davao City'}, 'positions': [position]}
placement = {'id': 5, 'status': 'approved', 'student': student, 'company': company,
             'position': {'id': 1, 'title': 'Synthetic Intern'}, 'batch': {'id': 1, 'name': 'Synthetic Batch'},
             'created_at': '2026-10-18T00:00:00Z', 'updated_at': '2026-10-18T00:00:00Z',
             'approved_at': '2026-10-18T00:00:00Z', 'match_score_at_assignment': 80}
fail_read, approved = [False], [False]
draft = {'revision': 1, 'generated': True, 'stale': False, 'sync_key': 'synthetic-recovery',
         'proposed_counts': {'1': 1}, 'students': [{'student': student, 'batch': suggestion['batch'], 'status': 'proposed',
             'proposal': {'id': 8, 'position_id': 1, 'position': 'Synthetic Intern', 'company_id': 1, 'company': 'Synthetic Employer',
                          'match_score': 80, 'category_score_component': 80, 'nlp_score_component': 80, 'location_score_component': 80},
             'alternatives': []}]}
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    context = browser.new_context(viewport={'width': 1280, 'height': 950})
    user = {'id': 1, 'name': 'Synthetic Admin', 'role': 'admin', 'is_approved': True}
    values = {'sb-token': 'synthetic', 'sb-role': 'admin', 'sb-user': json.dumps(user)}
    context.add_init_script('for (const [k,v] of Object.entries(' + json.dumps(values) + ')) localStorage.setItem(k,v)')
    def route_request(route):
        url = urlparse(route.request.url)
        if url.hostname not in ['localhost', '127.0.0.1']: return route.abort()
        if not url.path.startswith('/api/'): return route.continue_()
        if url.path.endswith('/events/'): return route.fulfill(status=204)
        if url.path == '/api/placements/draft/':
            if route.request.method == 'GET' and fail_read[0]:
                return route.fulfill(status=503, json={'error': 'Synthetic refresh outage'})
            return route.fulfill(json={**draft, 'changed': False})
        if url.path == '/api/placements/approve/':
            writes.append(route.request.post_data_json)
            if len(writes) == 1: return route.fulfill(status=500, json={'error': {'private': 'Synthetic internal details'}})
            approved[0], fail_read[0] = True, True
            position.update(approved_count=1, remaining_slots=4)
            suggestion.update(placement_id=5, placement_status='approved')
            placement['remarks'] = writes[-1]['remarks']
            position['suggested_students'] = []
            draft.update(revision=2, students=[], proposed_counts={})
            return route.fulfill(status=201, json={'placement': placement})
        if url.path in ['/api/placements/suggestions/', '/api/placements/']:
            if fail_read[0]: return route.fulfill(status=503, json={'error': 'Synthetic refresh outage'})
            return route.fulfill(json={'companies': [company], 'eligible_students': [student], 'approved_placements': [placement] if approved[0] else []} if url.path.endswith('/suggestions/') else {'count': 1 if approved[0] else 0, 'placements': [placement] if approved[0] else []})
        return route.fulfill(json=[])
    context.route('**/*', route_request)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    try:
        page.goto('http://127.0.0.1:5178/admin/placements')
        page.wait_for_load_state('networkidle')
        page.get_by_role('button', name='Open partner Synthetic Employer', exact=True).click()
        page.get_by_role('button', name='Review candidate', exact=True).click()
        page.get_by_role('button', name='Approve placement', exact=True).click()
        remarks = page.get_by_placeholder('Add context for placement history…')
        remarks.fill('Synthetic retained review remark')
        page.get_by_role('button', name='Approve student', exact=True).evaluate('(b)=>{b.click();b.click()}')
        expect(page.get_by_role('dialog', name='Placement decision', exact=True).get_by_text('Server error. Please try again in a moment.', exact=True)).to_be_visible()
        expect(remarks).to_have_value('Synthetic retained review remark')
        assert len(writes) == 1 and not approved[0]
        assert 'Synthetic internal details' not in page.locator('body').inner_text()
        checks.append('Failed approval retains remarks, uses safe error text and sends one request per double activation')
        page.get_by_role('button', name='Approve student', exact=True).click()
        expect(remarks).to_have_count(0)
        expect(page.get_by_text('Could not refresh. Showing the last loaded data.').first).to_be_visible()
        assert len(writes) == 2 and approved[0]
        assert writes[1]['remarks'] == 'Synthetic retained review remark'
        fail_read[0] = False
        page.get_by_role('button', name='Refresh suggestions', exact=True).click()
        expect(page.get_by_text('4 available for suggestions', exact=True).first).to_be_visible()
        assert len(writes) == 2
        checks.append('Committed approval is not replayed on failed refresh; explicit read refresh reconciles remaining capacity')
        page.screenshot(path=str(ARTIFACTS / 'reconciled.png'), full_page=True)
        assert not errors, errors
    finally:
        (ARTIFACTS / 'results.json').write_text(json.dumps({'checks': checks, 'page_errors': errors}, indent=2), encoding='utf-8')
        print(json.dumps({'checks': checks, 'page_errors': errors}, indent=2))
        context.close()
        browser.close()
