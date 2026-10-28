"""Rendered result states with synthetic API and deterministic map adapter.

Checks marker inputs, not external tile/provider availability (E02/V05).
"""
import json
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

ARTIFACTS = Path(__file__).parent / 'artifacts/recommendation-contract'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
checks, errors = [], []
MAP = """window.__markers=[]; window.L={
  map:()=>({setView(){return this},zoomControl:{setPosition(){}},invalidateSize(){},remove(){},fitBounds(){}}),
  tileLayer:()=>({addTo(){return this}}),divIcon: x=>x,
  marker:(pin)=>{window.__markers.push(pin);return {addTo(){return this},bindPopup(){return this},remove(){},isPopupOpen(){return false},getLatLng(){return pin}}},
  featureGroup:()=>({getBounds:()=>({pad(){return this}})})};"""
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    try:
        for scenario in ['ranked', 'locked', 'stale', 'empty', 'error', 'malformed']:
            context = browser.new_context(viewport={'width': 1280, 'height': 900})
            user = {'id': 1, 'name': 'Synthetic Student', 'role': 'student', 'is_approved': True,
                    'course': 'BSIT', 'school_id': 'SYNTH-1', 'address': {'pinLat': 7, 'pinLng': 125}}
            values = {'sb-token': 'synthetic', 'sb-user': json.dumps(user), 'sb-role': 'student',
                      'sb_pin_location': json.dumps({'lat': 40, 'lng': 40})}
            context.add_init_script('for (const [k,v] of Object.entries(' + json.dumps(values) + ')) localStorage.setItem(k,v);' + MAP)
            rows = [dict(id=1, position_id=2, company='Synthetic Lower', position='Intern B', match_score=70.01,
                         lat=95, lng=125, tags=[], slots=0),
                    dict(id=2, position_id=1, company='Synthetic Higher', position='Intern A', match_score=70.02,
                         lat=7, lng=125, tags=[], slots=1)]
            result = {'recommendations_locked': scenario in ['locked', 'stale'],
                      'recommendations_stale': scenario == 'stale', 'combined_category_scores': [],
                      'recommendations': rows if scenario == 'ranked' else [], 'model_used': 'simple_fallback',
                      'included_assessments': [], 'has_required_assessments': False}
            failed = [scenario in ['error', 'malformed']]
            def route_request(route):
                url = urlparse(route.request.url)
                if url.hostname not in ['127.0.0.1', 'localhost']:
                    return route.abort()
                if url.path.endswith('/events/'):
                    return route.fulfill(status=204)
                if url.path == '/api/student/results/combined/':
                    if scenario == 'malformed' and failed[0]:
                        return route.fulfill(json={**result, 'recommendations': {'bad': 'shape'}})
                    return route.fulfill(status=503, json={'error': 'synthetic outage'}) if failed[0] else route.fulfill(json=result)
                if url.path == '/api/students/me/':
                    return route.fulfill(json=user)
                if url.path.startswith('/api/'):
                    return route.fulfill(json=[])
                return route.continue_()
            context.route('**/*', route_request)
            page = context.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto('http://127.0.0.1:5178/student/results')
            page.wait_for_load_state('networkidle')
            if scenario == 'ranked':
                expect(page.get_by_text('70.02%', exact=True)).to_be_visible()
                companies = page.get_by_text('Synthetic Higher', exact=True).or_(page.get_by_text('Synthetic Lower', exact=True))
                assert companies.all_text_contents() == ['Synthetic Higher', 'Synthetic Lower']
                page.wait_for_function('window.__markers.length >= 2')
                assert page.evaluate('window.__markers.every(p=>p[0]===7 && p[1]===125)')
                page.get_by_role('button', name='Nearest', exact=True).click()
                expect(page.get_by_text('0.0 km', exact=True)).to_be_visible()
                assert companies.all_text_contents() == ['Synthetic Higher', 'Synthetic Lower']
                checks.append('Exact score ordering; nearest with unknown last; only valid own-profile/company map pins')
            elif scenario == 'locked':
                expect(page.get_by_role('heading', name='Final Skill Profile Locked')).to_be_visible()
                expect(page.get_by_text('No required assessments are currently published.', exact=False)).to_be_visible()
                assert page.evaluate('window.__markers.length') == 0
                checks.append('No required assessments has explicit locked state and no map/results')
            elif scenario == 'stale':
                expect(page.get_by_role('heading', name='Recommendations need refreshing')).to_be_visible()
                expect(page.get_by_text('Your assessment scores are preserved.', exact=False)).to_be_visible()
                expect(page.get_by_text('Ask your administrator to re-run recommendations.', exact=False)).to_be_visible()
                assert page.evaluate('window.__markers.length') == 0
                checks.append('Stale saved rankings show refresh guidance without displaying old scores or map results')
            elif scenario in ['error', 'malformed']:
                expect(page.get_by_role('alert')).to_contain_text('Could not load this section')
                failed[0] = False
                page.get_by_role('button', name='Retry', exact=True).click()
                expect(page.get_by_text('No eligible partner positions are currently available.')).to_be_visible()
                checks.append(scenario + ' read offers Retry; retry recovers empty results without a false match')
            else:
                expect(page.get_by_text('No eligible partner positions are currently available.')).to_be_visible()
                expect(page.get_by_role('button', name='Browse all companies →')).to_be_visible()
                checks.append('No candidates keeps profile and a browse-companies action')
            page.screenshot(path=str(ARTIFACTS / (scenario + '.png')), full_page=True)
            context.close()
        assert not errors, errors
    finally:
        (ARTIFACTS / 'results.json').write_text(json.dumps({'checks': checks, 'page_errors': errors}, indent=2), encoding='utf-8')
        print(json.dumps({'checks': checks, 'page_errors': errors}, indent=2))
        browser.close()
