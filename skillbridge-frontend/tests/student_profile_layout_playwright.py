"""Profile layout/functionality checks using synthetic API/address/map fixtures."""
import json
import os
from copy import deepcopy
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('SKILLBRIDGE_TEST_BASE', 'http://127.0.0.1:5178')
OUT = Path(__file__).parent / 'artifacts/student-profile-layout'
OUT.mkdir(parents=True, exist_ok=True)
checks, errors = [], []
USER = {'id': 991, 'name': 'Alex Reyes', 'school_id': '2026-00001', 'course': 'BSIT', 'role': 'student',
    'phone': '09000000000', 'is_approved': True, 'profile_completed': True, 'photo_url': '',
    'address': {'stayingAt': 'boarding', 'travelWilling': 'panabo', 'pinLat': 7.30701, 'pinLng': 125.66684,
        'home': {'province': 'Davao del Norte', 'city': 'City of Panabo', 'barangay': 'Dapco'},
        'boarding': {'province': 'Davao del Norte', 'city': 'City of Panabo', 'barangay': 'New Visayas'}}}
MAP = '''window.__markers=[];window.__map=null;window.L={
  map:el=>{ const handlers={}; const map={el,handlers,setView(center){window.__center=center;return this},
    on(name,fn){handlers[name]=fn;return this},zoomControl:{setPosition(){}},invalidateSize(){},remove(){},
    fire(name,payload){handlers[name]?.(payload)}};window.__map=map;return map },
  tileLayer:()=>({addTo(){return this},on(){return this}}),divIcon:x=>x,
  marker:pin=>{ const handlers={}; const marker={pin,removed:false,handlers,addTo(){return this},
    on(name,fn){handlers[name]=fn;return this},setLatLng(pin){this.pin=pin;return this},remove(){this.removed=true},
    drag(lat,lng){this.pin=[lat,lng];handlers.dragend?.({target:{getLatLng:()=>({lat,lng})}})}};
    window.__markers.push(marker);return marker }
};'''


class Fixture:
    def __init__(self, browser, width=1440, user=None):
        self.user = deepcopy(user or USER)
        self.writes = []
        self.geocodes = []
        self.context = browser.new_context(viewport={'width': width, 'height': 1000})
        self.context.add_init_script('for(const [k,v] of Object.entries(' + json.dumps({
            'sb-token': 'synthetic', 'sb-role': 'student', 'sb-user': json.dumps(self.user),
            'sb_pin_location': json.dumps({'lat': 40, 'lng': 40})}) + ')) localStorage.setItem(k,v);' + MAP)
        self.context.route('**/*', self.route)
        self.page = self.context.new_page()
        self.page.on('pageerror', lambda error: errors.append(str(error)))
        self.page.goto(BASE + '/student/profile', wait_until='networkidle')
        expect(self.page.get_by_role('heading', name='My profile')).to_be_visible()

    def route(self, route):
        url = urlparse(route.request.url)
        if url.hostname == 'nominatim.openstreetmap.org':
            query = parse_qs(url.query)['q'][0]
            self.geocodes.append(query)
            return route.fulfill(json=[{'lat': '7.30' if 'Dapco' in query else '7.31', 'lon': '125.68'}], headers={'Access-Control-Allow-Origin': '*'})
        if url.hostname == 'psgc.gitlab.io':
            if url.path.endswith('/provinces/'):
                data = [{'code': 'P1', 'name': 'Davao del Norte'}, {'code': 'P2', 'name': 'Bukidnon'}]
            elif url.path.endswith('/cities-municipalities/'):
                data = [{'code': 'C1', 'name': 'City of Panabo'}, {'code': 'C2', 'name': 'City of Tagum'}]
            else: data = [{'code': 'B1', 'name': 'Dapco'}, {'code': 'B2', 'name': 'New Visayas'}, {'code': 'B3', 'name': 'San Francisco'}]
            return route.fulfill(json=data, headers={'Access-Control-Allow-Origin': '*'})
        if url.hostname not in ('localhost', '127.0.0.1'): return route.abort()
        if not url.path.startswith('/api/'): return route.continue_()
        if url.path.endswith('/events/'): return route.fulfill(status=204)
        if url.path in ('/api/students/me/', '/api/auth/me/'): return route.fulfill(json=self.user)
        if url.path == '/api/students/me/profile/':
            payload = route.request.post_data_json
            self.writes.append(payload)
            self.user.update(name=payload['name'], school_id=payload['studentId'], course=payload['course'], phone=payload['phone'])
            self.user['address'] = {'stayingAt': payload['stayingAt'], 'travelWilling': payload['travelWilling'],
                'pinLat': payload['pinLat'], 'pinLng': payload['pinLng'],
                'home': {key: payload['home' + key.title()] for key in ('province', 'city', 'barangay')},
                'boarding': {key: payload['boarding' + key.title()] for key in ('province', 'city', 'barangay')}}
            return route.fulfill(json=self.user)
        return route.fulfill(json=[])

    def close(self):
        self.context.unroute_all(behavior='ignoreErrors'); self.context.close()


def save(fixture):
    before = len(fixture.writes)
    fixture.page.get_by_role('button', name='Save changes', exact=True).click()
    expect(fixture.page.get_by_text('Profile saved successfully', exact=True)).to_be_visible()
    assert len(fixture.writes) == before + 1
    return fixture.writes[-1]


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel='chrome', headless=True)
    try:
        fixture = Fixture(browser)
        page = fixture.page
        home_toggle = page.get_by_role('button', name='Permanent home address', exact=False)
        expect(home_toggle).to_have_attribute('aria-expanded', 'false')
        expect(page.get_by_role('tab')).to_have_count(0)
        expect(page.get_by_role('radio')).to_have_count(0)
        expect(page.get_by_role('checkbox')).to_have_count(0)
        payload = save(fixture)
        assert payload == {'name': 'Alex Reyes', 'studentId': '2026-00001', 'course': 'BSIT', 'phone': '09000000000',
            'stayingAt': 'boarding', 'travelWilling': 'panabo', 'homeProvince': 'Davao del Norte', 'homeCity': 'City of Panabo',
            'homeBarangay': 'Dapco', 'boardingProvince': 'Davao del Norte', 'boardingCity': 'City of Panabo',
            'boardingBarangay': 'New Visayas', 'pinLat': 7.30701, 'pinLng': 125.66684}
        page.get_by_label('Full name', exact=True).fill('Alex Updated')
        page.get_by_label('Student ID', exact=True).fill('2026-00002')
        page.get_by_label('Course', exact=True).fill('BSIS')
        page.get_by_label('Phone number', exact=True).fill('09987654321')
        page.get_by_role('button', name='Anywhere in Davao Region (incl. Davao City)', exact=True).click()
        payload = save(fixture)
        assert [payload[key] for key in ('name', 'studentId', 'course', 'phone', 'travelWilling')] == ['Alex Updated', '2026-00002', 'BSIS', '09987654321', 'davao-region']
        assert page.evaluate("JSON.parse(localStorage.getItem('sb-user')).name") == 'Alex Updated'
        checks.append('Unchanged profile PATCH fields/values, identity/contact editing, preferences, both saved addresses and single pin; successful save updates the local user cache')

        # Editing the saved home address must survive closing/reopening its disclosure.
        home_toggle.click()
        home = page.locator('#profile-home-fields')
        home.get_by_label('Province', exact=True).select_option('P1')
        home.get_by_label('City / Municipality', exact=True).select_option('C2')
        home.get_by_label('Barangay', exact=True).select_option('San Francisco')
        home_toggle.click(); home_toggle.click()
        expect(home.get_by_label('City / Municipality', exact=True)).to_have_value('C2')
        boarding = page.get_by_role('region', name='Boarding address', exact=True)
        boarding.get_by_label('Province', exact=True).select_option('P1')
        boarding.get_by_label('City / Municipality', exact=True).select_option('C1')
        boarding.get_by_label('Barangay', exact=True).select_option('Dapco')
        payload = save(fixture)
        assert payload['homeCity'] == 'City of Tagum' and payload['homeBarangay'] == 'San Francisco'
        assert payload['boardingCity'] == 'City of Panabo' and payload['boardingBarangay'] == 'Dapco'
        for label, value in [('Family home · commuting', 'home'), ('No fixed preference', 'open'), ('Boarding / rented room', 'boarding')]:
            page.get_by_role('button', name=label, exact=True).click()
            payload = save(fixture)
            assert payload['stayingAt'] == value and payload['boardingBarangay'] == 'Dapco'
        checks.append('Cascading province/city/barangay editors, home disclosure retention and all staying-at options preserve both addresses')

        pin = (payload['pinLat'], payload['pinLng'])
        view = page.get_by_role('group', name='Map view', exact=True)
        view.get_by_role('button', name='Permanent home', exact=True).click()
        expect(page.get_by_text('Centered on City of Tagum', exact=True)).to_be_visible()
        assert tuple(save(fixture)[key] for key in ('pinLat', 'pinLng')) == pin
        view.get_by_role('button', name='Boarding address', exact=True).click()
        expect(page.get_by_text('Centered on City of Panabo', exact=True)).to_be_visible()
        assert tuple(save(fixture)[key] for key in ('pinLat', 'pinLng')) == pin
        page.evaluate("window.__map.fire('click', {latlng:{lat:7.32,lng:125.69}})")
        expect(page.get_by_text('Pinned · 7.32000, 125.69000', exact=True)).to_be_visible()
        assert page.evaluate('window.__markers.filter(marker=>!marker.removed).length') == 1
        page.evaluate('window.__markers.at(-1).drag(0,0)')
        expect(page.get_by_text('Pinned · 0.00000, 0.00000', exact=True)).to_be_visible()
        payload = save(fixture)
        assert payload['pinLat'] == payload['pinLng'] == 0
        page.get_by_role('button', name='Remove pin', exact=True).click()
        expect(page.get_by_text('No pin set — tap the map above to place one.', exact=True)).to_be_visible()
        assert page.evaluate('window.__markers.filter(marker=>!marker.removed).length') == 0
        payload = save(fixture)
        assert payload['pinLat'] is None and payload['pinLng'] is None
        page.evaluate("window.__map.fire('click', {latlng:{lat:7.33,lng:125.70}})")
        assert page.evaluate('window.__markers.filter(marker=>!marker.removed).length') == 1
        assert save(fixture)['pinLat'] == 7.33
        checks.append('Map view only recenters; click/drag updates one pin, zero coordinates save, removal clears marker and sends null/null, and a pin can be placed again (Leaflet fixture)')
        fixture.close()

        incomplete = deepcopy(USER)
        incomplete['address']['home'] = {'province': '', 'city': '', 'barangay': ''}
        fixture = Fixture(browser, user=incomplete)
        page = fixture.page
        page.get_by_role('button', name='Save changes', exact=True).click()
        expect(page.get_by_role('button', name='Permanent home address', exact=False)).to_have_attribute('aria-expanded', 'true')
        expect(page.get_by_text('Please complete your home address', exact=True)).to_be_visible()
        assert not fixture.writes
        home = page.locator('#profile-home-fields')
        home.get_by_label('Province', exact=True).select_option('P1')
        expect(home).to_be_visible()
        home.get_by_label('City / Municipality', exact=True).select_option('C1')
        home.get_by_label('Barangay', exact=True).select_option('Dapco')
        assert save(fixture)['homeBarangay'] == 'Dapco'
        checks.append('Validation opens an incomplete home-address disclosure and blocks the write')
        fixture.close()

        for width in [320, 375, 640, 768, 1024, 1440]:
            fixture = Fixture(browser, width)
            page = fixture.page
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'{width}: page overflow'
            details = page.get_by_role('region', name='Personal details', exact=True).bounding_box()
            travel = page.get_by_role('region', name='Travel preference', exact=True).bounding_box()
            if width >= 1000:
                assert travel['x'] > details['x'] + details['width']
                assert details['width'] < 610, 'Personal details must stay compact'
            else: assert travel['y'] >= details['y'] + details['height']
            expect(page.get_by_role('tab')).to_have_count(0)
            page.screenshot(path=str(OUT / f'profile-{width}-light.png'), full_page=True, animations='disabled')
            page.evaluate('document.documentElement.classList.add("dark")')
            page.get_by_role('button', name='Save changes', exact=True).scroll_into_view_if_needed()
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            assert page.get_by_role('button', name='Save changes', exact=True).bounding_box()['height'] >= 44
            page.screenshot(path=str(OUT / f'profile-{width}-dark.png'), full_page=True, animations='disabled')
            page.set_viewport_size({'width': width, 'height': 420})
            page.get_by_role('button', name='Save changes', exact=True).scroll_into_view_if_needed()
            button = page.get_by_role('button', name='Save changes', exact=True).bounding_box()
            assert button['y'] >= 0 and button['y'] + button['height'] <= 420, 'Save must remain reachable on short screens'
            assert not fixture.writes
            fixture.close()
        checks.append('320/375/640/768/1024/1440px light/dark responsive layout, compact desktop details, stacked mobile, no tabs/radios, no horizontal overflow and 44px save target')
    finally:
        browser.close()

assert not errors, errors
(OUT / 'results.json').write_text(json.dumps({'checks': checks, 'page_errors': errors}, indent=2), encoding='utf-8')
print(json.dumps({'checks': checks, 'page_errors': errors}, indent=2))
