"""Offline/invalid external providers, bounded maps, stale rows and image fallback."""
import json
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

OUT = Path(__file__).parent / 'artifacts/external-recovery'
OUT.mkdir(parents=True, exist_ok=True)
checks, errors, pending, mutations = [], [], [], []
calls = {'provinces': 0, 'barangays': 0, 'script': 0}
province_mode = ['denied']
MAP = """window.__pins=[];window.L={map:()=>({setView(){return this},on(){return this},zoomControl:{setPosition(){}},invalidateSize(){},remove(){}}),
tileLayer:()=>({addTo(){return this},on(event,cb){window.__tileFail=cb;return this}}),divIcon:x=>x,
marker:pin=>{window.__pins.push(pin);return {addTo(){return this},on(){return this},setLatLng(){return this}}}};"""
user = {'id': 1, 'name': 'Synthetic Student', 'role': 'student', 'is_approved': True,
        'school_id': '2026-00001', 'course': 'BSIT', 'phone': '09123456789',
        'address': {'stayingAt': 'home', 'travelWilling': 'anywhere', 'pinLat': 0, 'pinLng': 0,
                    'home': {'province': 'Synthetic Province', 'city': 'Tagum', 'barangay': 'Synthetic Barangay'}}}
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    context = browser.new_context(viewport={'width': 1280, 'height': 900})
    values = {'sb-token': 'synthetic', 'sb-role': 'student', 'sb-user': json.dumps(user)}
    context.add_init_script('for (const [k,v] of Object.entries(' + json.dumps(values) + ')) localStorage.setItem(k,v)')
    def route_request(route):
        url = urlparse(route.request.url)
        if url.hostname == 'cdnjs.cloudflare.com':
            if url.path.endswith('.css'): return route.fulfill(content_type='text/css', body='/* synthetic */')
            calls['script'] += 1
            if calls['script'] == 1: return route.abort()
            return route.fulfill(content_type='text/javascript', body=MAP)
        if url.hostname == 'nominatim.openstreetmap.org':
            return route.fulfill(json=[{'lat': 'NaN', 'lon': 'Infinity'}], headers={'Access-Control-Allow-Origin': '*'})
        if url.hostname == 'psgc.gitlab.io':
            headers = {'Access-Control-Allow-Origin': '*'}
            if url.path.endswith('/provinces/'):
                calls['provinces'] += 1
                if province_mode[0] == 'denied': return route.fulfill(status=503, json={}, headers=headers)
                if province_mode[0] == 'invalid': return route.fulfill(json={'bad': 'envelope'}, headers=headers)
                return route.fulfill(json=[{'code': 'P1', 'name': 'First Province'}, {'code': 'P2', 'name': 'Second Province'}], headers=headers)
            if '/P1/' in url.path:
                pending.append(route)
                return
            if url.path.endswith('/cities-municipalities/'):
                return route.fulfill(json=[{'code': 'C2', 'name': 'Second City'}], headers=headers)
            calls['barangays'] += 1
            if calls['barangays'] == 1: return route.abort()
            return route.fulfill(json=[{'code': 'B2', 'name': 'Second Barangay'}], headers=headers)
        if url.hostname not in ['localhost', '127.0.0.1']: return route.abort()
        if not url.path.startswith('/api/'): return route.continue_()
        if url.path.endswith('/events/'): return route.fulfill(status=204)
        if url.path == '/api/students/me/profile/':
            mutations.append(route.request.post_data_json)
            return route.fulfill(json=user)
        if url.path in ['/api/students/me/', '/api/auth/me/']: return route.fulfill(json=user)
        return route.fulfill(json=[])
    context.route('**/*', route_request)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    try:
        page.goto('http://127.0.0.1:5178/student/profile')
        page.wait_for_load_state('networkidle')
        phone = page.get_by_placeholder('e.g. 09123456789')
        phone.fill('09987654321')
        expect(page.get_by_text('Map is unavailable. Saved locations and results are retained.', exact=True)).to_be_visible()
        expect(page.get_by_text('Address lookup unavailable; showing default Panabo view. Your pin is unchanged.', exact=True)).to_be_visible()
        page.get_by_role('button', name='Retry map', exact=True).click()
        expect(page.get_by_role('button', name='Retry map', exact=True)).to_have_count(0)
        assert page.evaluate('window.__pins') == [[0, 0]]
        page.evaluate('window.__tileFail()')
        expect(page.get_by_text('Map tiles are unavailable. Location pins are retained.', exact=True)).to_be_visible()
        page.get_by_role('button', name='Retry map', exact=True).click()
        expect(page.get_by_role('button', name='Retry map', exact=True)).to_have_count(0)
        expect(phone).to_have_value('09987654321')
        checks.append('Denied map script, tile failure and explicit retries preserve zero-coordinate saved pin and profile draft; invalid geocode is a truthful default view')
        retry = page.get_by_role('button', name='Retry address data', exact=True)
        province_mode[0] = 'invalid'
        retry.click()
        page.wait_for_load_state('networkidle')
        expect(page.get_by_role('alert')).to_contain_text('Could not load provinces')
        province_mode[0] = 'valid'
        retry.click()
        selects = page.get_by_role('combobox')
        province = selects.filter(has=page.locator('option[value="P1"]'))
        expect(province).to_have_count(1)
        province.select_option('P1')
        page.wait_for_timeout(100)
        province.select_option('P2')
        city = selects.filter(has=page.locator('option[value="C2"]'))
        expect(city).to_have_count(1)
        for route in pending:
            try: route.fulfill(json=[{'code': 'C1', 'name': 'Obsolete City'}], headers={'Access-Control-Allow-Origin': '*'})
            except Exception: pass  # The obsolete transport may already be cancelled.
        expect(page.locator('option[value="C1"]')).to_have_count(0)
        city.select_option('C2')
        expect(page.get_by_role('alert')).to_contain_text('Could not load barangays')
        retry.click()
        barangay = selects.filter(has=page.locator('option[value="Second Barangay"]'))
        barangay.select_option('Second Barangay')
        expect(phone).to_have_value('09987654321')
        page.get_by_role('button', name='Save changes', exact=True).click()
        expect(page.get_by_text('Profile saved successfully', exact=True)).to_be_visible()
        assert mutations[-1]['pinLat'] == mutations[-1]['pinLng'] == 0
        assert mutations[-1]['homeCity'] == 'Second City'
        checks.append('Address denial/invalid envelopes/offline child request recover explicitly; obsolete city response ignored and other draft fields retained')
        page.evaluate("""async () => {
          const React = await import('/node_modules/.vite/deps/react.js');
          const module = await import('/node_modules/.vite/deps/react-dom_client.js');
          const createRoot = module.createRoot ?? module.default.createRoot;
          const {default: CompanyImage} = await import('/src/components/CompanyImage.jsx');
          const node = document.createElement('div'); node.id='synthetic-image'; document.body.append(node);
          createRoot(node).render((React.createElement ?? React.default.createElement)(CompanyImage,{name:'Synthetic Agency',imageUrl:'https://offline.invalid/logo.png',loading:'eager'}));
        }""")
        expect(page.locator('#synthetic-image [role="img"]')).to_have_text('SA')
        checks.append('Broken remote company photo uses accessible initials fallback without a page error')
        page.evaluate('window.scrollTo(0,0)')
        page.screenshot(path=str(OUT / 'recovered.png'), full_page=True)
        assert not errors, errors
    finally:
        result = {'checks': checks, 'page_errors': errors, 'calls': calls}
        (OUT / 'results.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
        print(json.dumps(result, indent=2))
        context.close(); browser.close()
