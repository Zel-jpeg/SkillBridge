"""Synthetic demand/area display checks; backend arithmetic has separate API tests."""
import json
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

ARTIFACTS = Path(__file__).parent / 'artifacts/capacity-areas'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
checks, errors = [], []
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    context = browser.new_context(viewport={'width': 1280, 'height': 900})
    user = {'id': 1, 'name': 'Synthetic Admin', 'role': 'admin', 'is_approved': True}
    values = {'sb-token': 'synthetic', 'sb-role': 'admin', 'sb-user': json.dumps(user)}
    context.add_init_script('for (const [k,v] of Object.entries(' + json.dumps(values) + ')) localStorage.setItem(k,v)')
    companies = [{'id': i, 'name': f'Synthetic Agency {i}', 'address': {'city': 'Davao City'},
                  'positions': [{'id': i, 'title': f'Intern {i}', 'slots_available': 5,
                                 'approved_count': 3, 'remaining_slots': 2, 'suggested_students': []}]} for i in [1, 2]]
    analytics = {'summary': {'total_ojt_slots': 10, 'approved_placements': 6, 'remaining_slots': 4,
                             'unplaced_students': 0, 'placement_fill_rate': 60},
                 'area_breakdown': [{'area': 'Davao City', 'student_count': 0, 'approved_placements': 6,
                                     'unplaced_students': 0, 'company_count': 2, 'total_slots': 10, 'available_slots': 4},
                                    {'area': 'Tagum', 'student_count': 6, 'approved_placements': 0,
                                     'unplaced_students': 0, 'company_count': 0, 'total_slots': 0, 'available_slots': 0}]}
    def route_request(route):
        url = urlparse(route.request.url)
        if url.hostname not in ['localhost', '127.0.0.1']:
            return route.abort()
        if not url.path.startswith('/api/'):
            return route.continue_()
        if url.path.endswith('/events/'):
            return route.fulfill(status=204)
        data = []
        if url.path == '/api/auth/me/': data = user
        if url.path == '/api/placements/suggestions/': data = {'companies': companies, 'eligible_students': []}
        if url.path == '/api/placements/': data = {'placements': []}
        if url.path == '/api/admin/placement-analytics/': data = analytics
        if url.path == '/api/admin/reports/': data = {}
        if url.path == '/api/admin/nlp-configuration/': data = {'models': [], 'active_model': 'spacy_md'}
        return route.fulfill(json=data)
    context.route('**/*', route_request)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    try:
        page.goto('http://127.0.0.1:5178/admin/placements')
        page.wait_for_load_state('networkidle')
        expect(page.get_by_text('2 remaining', exact=True)).to_have_count(4)  # Company and position badges.
        expect(page.get_by_text('5 slots', exact=True)).to_have_count(2)
        expect(page.get_by_text('3 approved', exact=True)).to_have_count(2)
        checks.append('Both companies show configured five seats, three approved and two remaining')
        page.get_by_role('button', name='Download reports', exact=True).click()
        expect(page.get_by_text('Partner area / city / province', exact=True)).to_be_visible()
        page.screenshot(path=str(ARTIFACTS / 'companies.png'), full_page=True)
        page.goto('http://127.0.0.1:5178/admin/reports')
        page.wait_for_load_state('networkidle')
        table = page.get_by_role('table').filter(has=page.get_by_role('columnheader', name='Deployed Students', exact=True))
        expect(table).to_be_visible()
        assert table.get_by_role('row').filter(has=page.get_by_text('Davao City', exact=True)).get_by_role('cell').all_text_contents() == ['Davao City', '0', '6', '0', '2', '10', '4']
        assert table.get_by_role('row').filter(has=page.get_by_text('Tagum', exact=True)).get_by_role('cell').all_text_contents() == ['Tagum', '6', '0', '0', '0', '0', '0']
        checks.append('Area table distinguishes six deployed in Davao City from six resident students in Tagum')
        page.screenshot(path=str(ARTIFACTS / 'areas.png'), full_page=True)
        assert not errors, errors
    finally:
        (ARTIFACTS / 'results.json').write_text(json.dumps({'checks': checks, 'page_errors': errors}, indent=2), encoding='utf-8')
        print(json.dumps({'checks': checks, 'page_errors': errors}, indent=2))
        context.close()
        browser.close()
