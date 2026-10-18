"""Staff overview/view/pin outages and escaped catalog text; synthetic APIs."""
import json
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

OUT = Path(__file__).parent / 'artifacts/company-map-recovery'
OUT.mkdir(parents=True, exist_ok=True)
checks, errors, writes = [], [], []
MAP = """window.__companyPins=[];window.__mapInjection=0;window.L={
map:element=>({element,setView(){return this},zoomControl:{setPosition(){}},invalidateSize(){},remove(){},fitBounds(){},on(){return this}}),
tileLayer:()=>({addTo(){return this},on(){return this}}),divIcon:x=>x,control:{zoom:()=>({addTo(){return this}})},
marker:(pin,options={})=>{window.__companyPins.push(pin);return {addTo(map){this.map=map;if(options.icon?.html)this.insert(options.icon.html);return this},
insert(html){const node=document.createElement('div');node.dataset.mapHtml='true';node.innerHTML=html;this.map.element.append(node)},
bindPopup(html){this.insert(html);return this},on(){return this},setLatLng(){return this},remove(){},isPopupOpen(){return false},getLatLng(){return pin}}},
featureGroup:()=>({getBounds:()=>({pad(){return this}})})};"""
company_name = 'Synthetic Agency <img src="https://synthetic.invalid/image" onerror="window.__mapInjection=1">'
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    try:
        for role in ['admin', 'instructor']:
            available = [False]
            company = {'id': 1, 'name': company_name, 'lat': 0, 'lng': 0,
                'address': {'province': 'Synthetic Province', 'city': 'Synthetic City'}, 'positions': []}
            user = {'id': 1, 'name': 'Synthetic Staff', 'role': role, 'is_approved': True}
            values = {'sb-token': 'synthetic', 'sb-role': role, 'sb-user': json.dumps(user)}
            context = browser.new_context(viewport={'width': 1280, 'height': 950})
            context.add_init_script('for(const [k,v] of Object.entries(' + json.dumps(values) + ')) localStorage.setItem(k,v)')
            def route_request(route):
                url = urlparse(route.request.url)
                if url.hostname == 'cdnjs.cloudflare.com':
                    if not available[0]: return route.abort()
                    return route.fulfill(content_type='text/css' if url.path.endswith('.css') else 'text/javascript', body='/* fixture */' if url.path.endswith('.css') else MAP)
                if url.hostname == 'nominatim.openstreetmap.org': return route.fulfill(json={'bad': 'envelope'}, headers={'Access-Control-Allow-Origin': '*'})
                if url.hostname == 'psgc.gitlab.io':
                    rows = [{'code': 'P', 'name': 'Synthetic Province'}] if url.path.endswith('/provinces/') else [{'code': 'C', 'name': 'Synthetic City'}]
                    return route.fulfill(json=rows, headers={'Access-Control-Allow-Origin': '*'})
                if url.hostname not in ['localhost', '127.0.0.1']: return route.abort()
                if not url.path.startswith('/api/'): return route.continue_()
                if url.path.endswith('/events/'): return route.fulfill(status=204)
                if url.path == '/api/auth/me/': return route.fulfill(json=user)
                if url.path == f'/api/{role}/companies/': return route.fulfill(json=[company])
                if url.path == f'/api/{role}/companies/1/' and route.request.method == 'PATCH':
                    writes.append({'role': role, 'payload': route.request.post_data_json})
                    return route.fulfill(json={**company, 'name': 'Retained draft name'})
                return route.fulfill(json=[])
            context.route('**/*', route_request)
            page = context.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(f'http://127.0.0.1:5178/{role}/companies')
            page.wait_for_load_state('networkidle')
            expect(page.get_by_role('button', name='Retry map', exact=True)).to_be_visible()
            if role == 'admin':
                page.get_by_role('button', name=f'Edit company {company_name}', exact=True).click()
            else:
                page.get_by_role('button').filter(has_text=company_name).first.click()
                expect(page.get_by_role('button', name='Retry map', exact=True).last).to_be_visible()
                checks.append('Instructor company view handles CDN denial with a valid zero-coordinate company')
                page.get_by_role('button', name='Edit', exact=True).click()
            dialog = page.get_by_role('dialog').filter(has=page.get_by_role('heading', name='Edit Company', exact=True))
            name = dialog.get_by_placeholder('e.g. Azeus Systems Philippines')
            name.fill('Retained draft name')
            expect(dialog.get_by_role('button', name='Retry map', exact=True)).to_be_visible()
            expect(name).to_have_value('Retained draft name')
            available[0] = True
            dialog.get_by_role('button', name='Retry map', exact=True).click()
            expect(dialog.get_by_role('button', name='Retry map', exact=True)).to_have_count(0)
            assert [0, 0] in page.evaluate('window.__companyPins')
            dialog.get_by_role('button', name='Change address', exact=True).click()
            selects = dialog.get_by_role('combobox')
            selects.nth(0).select_option('P')
            selects.nth(1).select_option('C')
            expect(dialog.get_by_text('Address lookup unavailable. Showing the default Davao view; your pin is unchanged.', exact=True)).to_be_visible()
            expect(name).to_have_value('Retained draft name')
            dialog.get_by_role('button', name='Save Changes' if role == 'admin' else 'Save changes', exact=True).click()
            expect(dialog).to_have_count(0)
            assert writes[-1]['role'] == role and writes[-1]['payload']['lat'] == writes[-1]['payload']['lng'] == 0
            checks.append(role + ' overview/edit-map denial and retry retain draft/zero pin; invalid geocode is truthful and does not prevent confirmed save')
            if role == 'instructor':
                page.get_by_role('button', name='Close company details', exact=True).click()
            # Recover the overview too, exercising escaped catalog labels/popups.
            retry = page.get_by_role('button', name='Retry map', exact=True)
            if retry.count(): retry.first.click()
            page.wait_for_function('document.querySelectorAll("[data-map-html]").length>0')
            expect(page.locator('[data-map-html] img')).to_have_count(0)
            assert page.evaluate('window.__mapInjection') == 0
            page.screenshot(path=str(OUT / f'{role}.png'), full_page=True)
            context.close()
        assert not errors, errors
    finally:
        result = {'checks': checks, 'page_errors': errors, 'confirmed_writes': writes}
        (OUT / 'results.json').write_text(json.dumps(result, indent=2))
        print(json.dumps(result, indent=2))
        browser.close()
