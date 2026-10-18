"""Profile failure retention and staff draft account isolation; synthetic API only."""
import json
import re
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

ARTIFACTS = Path(__file__).parent / 'artifacts/profile-draft-recovery'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
checks, errors, mutations = [], [], []
MAP = """window.__pins=[]; window.L={map:()=>({setView(){return this},on(){return this},zoomControl:{setPosition(){}},invalidateSize(){},remove(){}}),
tileLayer:()=>({addTo(){return this}}),divIcon:x=>x,
marker:pin=>{window.__pins.push(pin);return {addTo(){return this},on(){return this},setLatLng(){return this}}}};"""

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    try:
        user = {'id': 1, 'name': 'Synthetic Student', 'role': 'student', 'is_approved': True, 'school_id': '2026-00001',
                'course': 'BSIT', 'phone': '09123456789', 'address': {'home': {'province': 'Synthetic Province',
                'city': 'Tagum', 'barangay': 'Synthetic Barangay'}, 'stayingAt': 'home', 'travelWilling': 'anywhere', 'pinLat': None, 'pinLng': None}}
        context = browser.new_context(viewport={'width': 1280, 'height': 900})
        values = {'sb-token': 'synthetic-secret-token', 'sb-role': 'student', 'sb-user': json.dumps(user),
                  'sb_pin_location': json.dumps({'lat': 40, 'lng': 40})}
        context.add_init_script('for (const [k,v] of Object.entries(' + json.dumps(values) + ')) localStorage.setItem(k,v); sessionStorage.setItem("psgc_provinces", "{corrupt");' + MAP)
        def route_request(route):
            url = urlparse(route.request.url)
            if url.hostname == 'nominatim.openstreetmap.org': return route.fulfill(json=[])
            if url.hostname == 'psgc.gitlab.io': return route.fulfill(json=[{'code': 'SYN', 'name': 'Synthetic Province'}], headers={'Access-Control-Allow-Origin': '*'})
            if url.hostname not in ['localhost', '127.0.0.1']: return route.abort()
            if not url.path.startswith('/api/'): return route.continue_()
            if url.path.endswith('/events/'): return route.fulfill(status=204)
            if url.path == '/api/students/me/profile/':
                mutations.append(route.request.post_data_json)
                if len(mutations) == 1:
                    return route.fulfill(status=400, json={'error': 'Synthetic duplicate ID; correct your student ID.', 'field': 'studentId'})
                if len(mutations) == 2: return route.abort('failed')
                if len(mutations) == 3: return route.fulfill(json={})
                user['phone'] = route.request.post_data_json['phone']
                return route.fulfill(json=user)
            if url.path in ['/api/students/me/', '/api/auth/me/']: return route.fulfill(json=user)
            return route.fulfill(json=[])
        context.route('**/*', route_request)
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto('http://127.0.0.1:5178/student/profile')
        page.wait_for_load_state('networkidle')
        expect(page.get_by_text('Result notification emails are not available. View your latest results on the Results page.', exact=True)).to_be_visible()
        expect(page.get_by_role('checkbox')).to_have_count(0)
        phone = page.get_by_placeholder('e.g. 09123456789')
        expect(phone).to_have_value('09123456789')
        phone.fill('09987654321')
        save = page.get_by_role('button', name='Save changes', exact=True)
        save.evaluate('(b)=>{b.click();b.click()}')
        expect(page.get_by_text('Synthetic duplicate ID; correct your student ID.').first).to_be_visible()
        expect(phone).to_have_value('09987654321')
        expect(save).to_be_enabled()
        assert len(mutations) == 1
        assert mutations[0]['pinLat'] is None and mutations[0]['pinLng'] is None
        assert page.evaluate('window.__pins.length') == 0
        checks.append('Field rejection retains draft; one write per activation; unowned pin ignored; corrupt address cache refetches without a page crash')
        save.click()
        expect(page.get_by_text('The save could not be confirmed. Refresh the current records before trying again.', exact=True)).to_be_visible()
        expect(phone).to_have_value('09987654321')
        expect(save).to_be_enabled()
        assert len(mutations) == 2  # No transport replay for an uncertain mutation.
        expect(page.get_by_text('Profile saved successfully')).to_have_count(0)
        save.click()
        expect(page.get_by_text('The save could not be confirmed. Refresh the current records before trying again.', exact=True)).to_be_visible()
        expect(phone).to_have_value('09987654321')
        expect(page.get_by_text('Profile saved successfully')).to_have_count(0)
        assert page.evaluate("JSON.parse(localStorage.getItem('sb-user')).id") == 1
        save.click()
        expect(page.get_by_text('Profile saved successfully')).to_be_visible()
        assert len(mutations) == 4
        checks.append('Network/invalid-response failures clear loading without automatic replay, cache corruption or false success; explicit retry saves')
        page.evaluate('window.scrollTo(0,0)')
        page.screenshot(path=str(ARTIFACTS / 'profile.png'), full_page=True)
        context.close()

        draft = {'title': 'Own assessment draft', 'categories': [], 'questions': []}
        for owner in [1, 2]:
            context = browser.new_context(viewport={'width': 1280, 'height': 900})
            user = {'id': owner, 'name': 'Synthetic Instructor', 'role': 'instructor', 'is_approved': True}
            values = {'sb-token': 'synthetic', 'sb-role': 'instructor', 'sb-user': json.dumps(user),
                      'sb_assessment_draft': json.dumps(draft), 'sb_assessment_draft:instructor:1': json.dumps(draft)}
            context.add_init_script('for (const [k,v] of Object.entries(' + json.dumps(values) + ')) localStorage.setItem(k,v)')
            def staff_route(route):
                url = urlparse(route.request.url)
                if url.hostname not in ['localhost', '127.0.0.1']: return route.abort()
                if not url.path.startswith('/api/'): return route.continue_()
                if url.path.endswith('/events/'): return route.fulfill(status=204)
                return route.fulfill(json=[])
            context.route('**/*', staff_route)
            page = context.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto('http://127.0.0.1:5178/instructor/assessment/create')
            page.wait_for_load_state('networkidle')
            restore = page.get_by_role('button', name='Restore draft', exact=True)
            if owner == 1:
                restore.click()
                expect(page.get_by_placeholder(re.compile('e.g. BSIT OJT Skills Assessment'))).to_have_value('Own assessment draft')
            else:
                expect(restore).to_have_count(0)
                expect(page.get_by_placeholder(re.compile('e.g. BSIT OJT Skills Assessment'))).to_have_value('')
            context.close()
        checks.append('Only owning staff account can restore a scoped draft; legacy unowned content stays hidden')
        assert not errors, errors
    finally:
        (ARTIFACTS / 'results.json').write_text(json.dumps({'checks': checks, 'page_errors': errors}, indent=2), encoding='utf-8')
        print(json.dumps({'checks': checks, 'page_errors': errors}, indent=2))
        browser.close()
