"""Benign synthetic markup must remain text in Leaflet labels/popups."""
import json
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

OUT = Path(__file__).parent / 'artifacts/map-markup-security'
OUT.mkdir(parents=True, exist_ok=True)
errors, checks = [], []
MAP = """window.__mapInjection=0;window.L={
map:element=>({element,setView(){return this},zoomControl:{setPosition(){}},invalidateSize(){},remove(){},fitBounds(){},on(){return this}}),
tileLayer:()=>({addTo(){return this},on(){return this}}),divIcon:x=>x,
marker:(pin,options={})=>({addTo(map){this.map=map;if(options.icon?.html)this.insert(options.icon.html);return this},
insert(html){const node=document.createElement('div');node.dataset.mapHtml='true';node.innerHTML=html;this.map.element.append(node)},
bindPopup(html){this.insert(html);return this},remove(){},isPopupOpen(){return false},getLatLng(){return pin}}),
featureGroup:()=>({getBounds:()=>({pad(){return this}})})};"""
company = '<img src="https://synthetic.invalid/unavailable" onerror="window.__mapInjection=1">'
position = '<svg onload="window.__mapInjection=2"></svg>'
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    context = browser.new_context(viewport={'width': 1280, 'height': 900})
    user = {'id': 1, 'name': 'Synthetic Student', 'role': 'student', 'is_approved': True, 'course': 'BSIT',
            'school_id': '2026-00001', 'address': {'pinLat': 7, 'pinLng': 125}}
    values = {'sb-token': 'synthetic', 'sb-role': 'student', 'sb-user': json.dumps(user)}
    context.add_init_script('for(const [k,v] of Object.entries(' + json.dumps(values) + ')) localStorage.setItem(k,v);' + MAP)
    def route_request(route):
        url = urlparse(route.request.url)
        if url.hostname not in ['localhost', '127.0.0.1']: return route.abort()
        if url.path.endswith('/events/'): return route.fulfill(status=204)
        if url.path in ['/api/auth/me/', '/api/students/me/']: return route.fulfill(json=user)
        if url.path == '/api/student/results/combined/':
            return route.fulfill(json={'recommendations_locked': False, 'recommendations': [{
                'id': 1, 'position_id': 1, 'company': company, 'position': position,
                'match_score': 72.345, 'lat': 7, 'lng': 125, 'tags': []}],
                'combined_category_scores': [], 'included_assessments': [], 'model_used': 'simple_fallback'})
        if url.path.startswith('/api/'): return route.fulfill(json=[])
        return route.continue_()
    context.route('**/*', route_request)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    try:
        page.goto('http://127.0.0.1:5178/student/results')
        page.wait_for_load_state('networkidle')
        page.wait_for_function('document.querySelectorAll("[data-map-html]").length>=2')
        expect(page.locator('[data-map-html] img')).to_have_count(0)
        expect(page.locator('[data-map-html] svg[onload]')).to_have_count(0)
        assert page.evaluate('window.__mapInjection') == 0
        assert company in page.locator('[data-map-html]').all_text_contents()[0]
        checks.append('Untrusted company/position markup is literal map text, with no created handlers or injected elements')
        assert not errors, errors
    finally:
        result = {'checks': checks, 'page_errors': errors, 'executed_markup': page.evaluate('window.__mapInjection')}
        (OUT / 'results.json').write_text(json.dumps(result, indent=2))
        print(json.dumps(result, indent=2))
        context.close(); browser.close()
