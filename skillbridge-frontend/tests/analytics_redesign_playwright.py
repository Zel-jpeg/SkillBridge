"""Real synthetic API, real Leaflet/heat renderer, offline tiles, both roles."""
import json
import os
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'skillbridge-frontend/tests/artifacts/analytics'
AUTH = json.loads((OUT / 'auth.json').read_text(encoding='utf-8'))
BASE = 'http://127.0.0.1:' + os.environ['ADMIN_MANAGEMENT_FRONTEND_PORT']
API = 'http://127.0.0.1:' + os.environ['ADMIN_MANAGEMENT_API_PORT']
errors = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel='chrome')
    for role in ['admin', 'instructor']:
        context = browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce')
        context.add_init_script('const identity=' + json.dumps(AUTH[role]) + ';localStorage.setItem("sb-token",identity.token);localStorage.setItem("sb-role",identity.user.role);localStorage.setItem("sb-user",JSON.stringify(identity.user));window.EventSource=class{close(){}};')
        def route(r):
            parsed = urlparse(r.request.url)
            if parsed.path.endswith('/events/'): return r.fulfill(json={})
            if parsed.path.startswith('/api/'): return r.continue_(url=API + parsed.path + ('?' + parsed.query if parsed.query else ''))
            if 'cdnjs.cloudflare.com' == parsed.hostname and '/leaflet/' in parsed.path:
                name = 'leaflet.css' if parsed.path.endswith('.css') else 'leaflet.js'
                return r.fulfill(path=str(ROOT / 'work/analytics-map-runtime' / name), content_type='text/css' if name.endswith('.css') else 'application/javascript')
            if parsed.hostname not in ['localhost', '127.0.0.1']: return r.abort()
            return r.continue_()
        context.route('**/*', route)
        page = context.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        snapshot = context.request.get(API + '/api/management/analytics/', headers={'Authorization': 'Bearer ' + AUTH[role]['token']}).json()
        for tab in ['assessments', 'skills', 'placements']:
            page.goto(BASE + f'/{role}/reports?tab={tab}')
            expect(page.get_by_role('heading', name='Reports & Analytics', exact=True)).to_be_visible()
            expect(page.locator('.ar-summary')).to_be_visible()
            expect(page.locator('.analytics-redesign details')).to_have_count(0)
            if tab == 'assessments':
                page.get_by_role('button', name='More filters', exact=True).click()
                expect(page.get_by_role('dialog', name='Report filters', exact=True)).to_be_visible()
                page.get_by_role('button', name='Done', exact=True).click()
            if tab == 'placements':
                expect(page.locator('.am-map .leaflet-heatmap-layer')).to_have_count(1, timeout=20000)
                page.get_by_role('button', name='Area boundaries', exact=True).click()
                expect(page.locator('.am-map path.leaflet-interactive')).to_have_count(1642)
                expect(page.locator('.am-map .leaflet-tile-pane img')).to_have_count(0)
                page.get_by_label('Area level', exact=True).select_option('province')
                expect(page.locator('.am-map path.leaflet-interactive')).to_have_count(123)
                expect(page.locator('.am-list')).not_to_contain_text('Ilocos Norte')
                page.locator('.am-list').get_by_role('button', name='Davao City', exact=False).first.click()
                expected = snapshot['placement_map']['student_count']
                page.locator('.am-selected').get_by_role('button', name=f'View {expected} students', exact=True).click()
                expect(page.locator('#analytics-records')).to_contain_text('Approved placements · Davao City')
                expect(page.locator('#analytics-records')).to_contain_text(f'{expected} records')
                page.get_by_role('button', name='Suggested', exact=True).click()
                expect(page.get_by_role('heading', name='Suggested placements by partner location', exact=True)).to_be_visible()
                page.locator('.am-list').get_by_role('button', name='City of Cebu', exact=False).first.click()
                page.locator('.am-selected').get_by_role('button', name='View 1 students', exact=True).click()
                expect(page.locator('#analytics-records')).to_contain_text('Suggested placements · City of Cebu')
                expect(page.locator('#analytics-records')).to_contain_text('1 records')
                expect(page.locator('#analytics-records')).to_contain_text('Synthetic Cebu Partner')
                expect(page.locator('#analytics-records').get_by_text('30%', exact=True)).to_be_visible()
                page.set_viewport_size({'width': 1440, 'height': 1000})
                page.locator('#analytics-records').get_by_role('button', name='Card view', exact=True).click()
                expect(page.locator('#analytics-records').get_by_text('Suggested allocation', exact=True)).to_be_visible()
                expect(page.locator('#analytics-records').get_by_text('30%', exact=True)).to_be_visible()
                expect(page.locator('#analytics-records')).to_contain_text('Synthetic Cebu Partner')
                page.locator('#analytics-records').get_by_role('button', name='List view', exact=True).click()
                page.get_by_role('button', name='Heatmap', exact=True).click()
                expect(page.locator('.am-map .leaflet-heatmap-layer')).to_have_count(1)
                page.screenshot(path=str(OUT / f'redesign-{role}-suggested-heatmap.png'), full_page=True)
                page.get_by_role('button', name='Area boundaries', exact=True).click()
                expect(page.locator('.am-map .leaflet-tile-pane img')).to_have_count(0)
                page.get_by_role('button', name='Show Philippines', exact=True).click()
            for width in [1440, 768, 390]:
                page.set_viewport_size({'width': width, 'height': 1000})
                page.evaluate('window.scrollTo(0,0)')
                try:
                    page.wait_for_function('document.documentElement.scrollWidth <= innerWidth', timeout=5000)
                except Exception:
                    page.screenshot(path=str(OUT / f'overflow-{role}-{tab}-{width}.png'), full_page=True)
                    print(role, tab, width, page.evaluate('Array.from(document.querySelectorAll("body *")).filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,12).map(e=>[e.tagName,e.className,e.getBoundingClientRect().width])'))
                    print('Unclipped overflow', page.evaluate('Array.from(document.querySelectorAll("body *")).filter(e=>{if(e.getBoundingClientRect().right<=innerWidth+1)return false;let p=e.parentElement;while(p&&p!==document.body){if(["hidden","auto","scroll","clip"].includes(getComputedStyle(p).overflowX))return false;p=p.parentElement}return true}).slice(0,15).map(e=>[e.tagName,String(e.className),e.getBoundingClientRect().left,e.getBoundingClientRect().right,getComputedStyle(e).position])'))
                    raise
                if width == 390: page.evaluate('document.documentElement.classList.add("dark")')
                page.screenshot(path=str(OUT / f'redesign-{role}-{tab}-{width}.png'), full_page=True)
            page.evaluate('document.documentElement.classList.remove("dark")')
        if role == 'instructor':
            page.goto(BASE + '/instructor/placements')
            link = page.get_by_role('link', name='View placement map', exact=True)
            expect(link).to_be_visible()
            link.click()
            expect(page.get_by_role('heading', name='Approved placements by partner location', exact=True)).to_be_visible()
            assert 'batch_scope=matching' in page.url
        context.close()
    browser.close()
assert not errors, errors
print('PASS: both roles, three open report tabs, nationwide 1642/123 outlines without tiles, partner-only lists, approved/suggested heatmaps and records, responsive/themes, workspace entry; no page errors')
