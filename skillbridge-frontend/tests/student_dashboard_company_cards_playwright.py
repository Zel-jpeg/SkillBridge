"""Student dashboard company-card presentation; synthetic read-only API/map fixtures."""
import copy
import json
import os
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).parent
BASE = os.environ.get('STUDENT_CARD_TEST_URL', 'http://127.0.0.1:5178')
ARTIFACTS = ROOT/'artifacts/student-dashboard-companies'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
fixture = ROOT/'student_company_details_playwright.py'
namespace = {'__file__': str(fixture), '__name__': 'company_card_fixture'}
exec(compile(fixture.read_text(encoding='utf-8').split('\nwith sync_playwright() as playwright:')[0], str(fixture), 'exec'), namespace)
PROFILE = {**namespace['USER'], 'profile_completed': True}
recommendations = [
    {'id': 1, 'company_id': 10, 'position_id': 101, 'company': 'Example Development Studio', 'position': 'Frontend Web Developer Intern', 'match_score': 73.45, 'distance_km': 22.9, 'lat': 7.2, 'lng': 125},
    {'id': 2, 'company_id': 20, 'position_id': 201, 'company': 'Example City Institution', 'position': 'LGU Database Encoder & Administrator', 'match_score': 65.99, 'distance_km': 2.7, 'lat': 7.02, 'lng': 125},
    {'id': 3, 'company_id': 30, 'position_id': 301, 'company': 'Example Company With A Very Long Name For Responsive Verification', 'position': 'IT Network Specialist Intern with extended administration responsibilities', 'match_score': 54.17, 'distance_km': 4.2, 'lat': 7.03, 'lng': 125},
]
catalog = [{'id': row['company_id'], 'name': row['company'], 'positions': [{'id': row['position_id'], 'title': row['position'], 'match_score': row['match_score'], 'tags': [], 'slots': 1}]} for row in recommendations]
for row in recommendations:
    row['tags'] = []

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    for width, dark in [(320,False),(375,True),(768,False),(1024,False),(1440,False),(1440,True)]:
        context = browser.new_context(viewport={'width':width,'height':1000})
        context.add_init_script('for (const [k,v] of Object.entries('+json.dumps({'sb-token':'synthetic', 'sb-role':'student', 'sb-user':json.dumps(PROFILE)})+')) localStorage.setItem(k,v);'+namespace['MAP'])
        result = {**copy.deepcopy(namespace['RESULT']), 'recommendations':copy.deepcopy(recommendations)}
        profile = copy.deepcopy(PROFILE)
        errors = []
        def route_request(route):
            parsed = urlparse(route.request.url)
            if parsed.hostname not in ['127.0.0.1','localhost']: return route.abort()
            path = parsed.path
            if not path.startswith('/api/'): return route.continue_()
            assert route.request.method == 'GET', 'No API writes permitted'
            if path == '/api/student/results/combined/': return route.fulfill(json=result)
            if path in ['/api/students/me/','/api/auth/me/']: return route.fulfill(json=profile)
            if path == '/api/student/companies/': return route.fulfill(json=catalog)
            if path == '/api/assessments/': return route.fulfill(json={'assessments':[]})
            if '/events/' in path: return route.fulfill(status=204)
            return route.fulfill(json=[])
        context.route('**/*',route_request)
        page = context.new_page()
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto(BASE+'/student/dashboard',wait_until='networkidle')
        page.evaluate('(dark)=>document.documentElement.classList.toggle("dark",dark)',dark)
        ranked = page.locator('.student-company-highlights.is-ranked')
        nearest = page.locator('.student-company-highlights.is-nearest')
        expect(page.get_by_text('Straight-line distance · nearest first',exact=True)).to_be_visible()
        expect(page.get_by_text('Closest: Example City Institution · 2.7 km',exact=True)).to_have_count(1)
        expect(ranked.locator('.student-company-row')).to_have_count(3)
        expect(nearest.locator('.student-company-row')).to_have_count(3)
        expect(ranked.locator('.student-company-name').first).to_contain_text(recommendations[0]['company'])
        expect(nearest.locator('.student-company-name').first).to_contain_text(recommendations[1]['company'])
        expect(nearest.locator('.student-company-distance')).to_have_text(['2.7 km','4.2 km','22.9 km'])
        expect(ranked.locator('.student-company-track')).to_have_count(3)
        expect(nearest.locator('.student-company-track')).to_have_count(0)
        assert ranked.locator('.student-company-track > span').first.evaluate('(el)=>el.style.width') == '73.45%'
        for card in [ranked,nearest]:
            card.scroll_into_view_if_needed()
            assert card.locator('.student-company-row').evaluate_all('(els)=>els.every(el=>el.getBoundingClientRect().height<=60)'), 'Compact rows must not grow with long labels'
            assert card.evaluate('(el)=>el.scrollWidth<=el.clientWidth')
            assert card.locator('.student-company-row').evaluate_all('(els)=>els.every(el=>el.scrollWidth<=el.clientWidth)')
            page.screenshot(path=str(ARTIFACTS/f'{"nearest" if card==nearest else "ranked"}-{width}-{dark}.png'))
            button=card.locator('.student-company-row').first
            button.focus();page.keyboard.press('Enter')
            expect(page.locator('dialog[open]')).to_be_visible()
            page.keyboard.press('Escape')
            expect(button).to_be_focused()
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        for label in ['See all matches','See distance & match details']:
            page.get_by_role('button',name=label,exact=True).click()
            expect(page).to_have_url(BASE+'/student/results')
            page.goto(BASE+'/student/dashboard',wait_until='networkidle')
        if width == 1440 and not dark:
            result['recommendations']=[]
            page.evaluate("window.dispatchEvent(new CustomEvent('sse:data_changed',{detail:{urls:['/api/student/results/combined/']}}))")
            expect(ranked.get_by_text('No eligible partner positions are currently available.',exact=True)).to_be_visible()
            expect(nearest.get_by_text('No recommended partners with a known location are currently available.',exact=True)).to_be_visible()
            result['recommendations_locked']=True
            result['all_required_completed']=False
            page.evaluate("window.dispatchEvent(new CustomEvent('sse:data_changed',{detail:{urls:['/api/student/results/combined/']}}))")
            expect(ranked).to_have_count(0)
            expect(page.get_by_text('Unlocks after all required assessments',exact=True).first).to_be_visible()
        assert not errors, errors
        print(f'PASS {width}px {dark=}: separate rank/distance ordering, compact rows, score bars, dialogs, focus and result links',flush=True)
        context.close()
    browser.close()
