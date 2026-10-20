"""Student company browsing UI, with synthetic API data and a mocked map.

Run with Vite on 5178 using the backend venv's Python + installed Chrome.
No live API, company or student records are read or changed.
"""
import copy
import json
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright, expect

ARTIFACTS = Path(__file__).parent / 'artifacts/student-company-details'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
BASE = 'http://127.0.0.1:5178'
CATALOG_URL = '/api/student/companies/'
NOTICE = 'Final placement decisions are made by your OJT coordinator.'
TAGS = ['Programming', 'Web Development', 'HTML', 'CSS', 'JavaScript', 'React',
        'Responsive design', 'Web API', 'Testing', 'User interface', 'Python', 'Git']
USER = {'id': 1, 'name': 'Synthetic Student', 'role': 'student', 'is_approved': True,
        'course': 'BSIT', 'school_id': 'SYNTH-1', 'address': {'pinLat': 7, 'pinLng': 125}}
COMPANIES = [
    {'id': 10, 'name': 'Synthetic Technology Partnership', 'address': 'Example District, Synthetic City',
     'positions': [
         {'id': 103, 'title': 'Backend Intern', 'tags': ['Python'], 'slots': 2, 'match_score': 54.16},
         {'id': 104, 'title': 'Unscored Cloud Role', 'tags': [], 'slots': 1, 'match_score': None},
         {'id': 101, 'title': 'Frontend Developer Intern', 'tags': TAGS, 'slots': 3, 'match_score': 73.44},
         {'id': 102, 'title': 'Database Intern', 'tags': ['SQL', 'Data integrity'], 'slots': 1, 'match_score': 65.25},
         {'id': 105, 'title': 'Unscored Support Role', 'tags': [], 'slots': 1, 'match_score': None},
     ]},
    {'id': 20, 'name': 'Synthetic Company with a Very Long Name for Responsive Layout Verification',
     'address': None, 'positions': [
         {'id': 202, 'title': 'Unscored Network Role', 'tags': [], 'slots': 0, 'match_score': None},
         {'id': 203, 'title': 'Zero Score Role', 'tags': [], 'slots': 0, 'match_score': 0},
         {'id': 201, 'title': 'Network Intern', 'tags': [], 'slots': 0, 'match_score': 41.9},
     ]},
    {'id': 30, 'name': 'Synthetic New Partner', 'address': None, 'positions': []},
]
RESULT = {'recommendations_locked': False, 'all_required_completed': True,
          'combined_category_scores': [], 'included_assessments': [], 'recommendations': [
              {'id': 1, 'position_id': 101, 'company_id': 10, 'company': COMPANIES[0]['name'],
               'position': 'Frontend Developer Intern', 'match_score': 73.44, 'slots': 3,
               'address': COMPANIES[0]['address'], 'tags': TAGS, 'lat': 7, 'lng': 125,
               'category_score_component': 80, 'nlp_score_component': 60, 'location_score_component': 90},
              {'id': 2, 'position_id': 201, 'company_id': 20, 'company': COMPANIES[1]['name'],
               'position': 'Network Intern', 'match_score': 41.9, 'slots': 0,
               'address': '', 'tags': [], 'lat': None, 'lng': None},
              {'id': 3, 'position_id': 102, 'company_id': 10, 'company': COMPANIES[0]['name'],
               'position': 'Database Intern', 'match_score': 65.25, 'slots': 1, 'tags': ['SQL'], 'lat': 7, 'lng': 125},
              {'id': 4, 'position_id': 103, 'company_id': 10, 'company': COMPANIES[0]['name'],
               'position': 'Backend Intern', 'match_score': 54.16, 'slots': 2, 'tags': ['Python'], 'lat': 7, 'lng': 125},
              {'id': 5, 'position_id': 203, 'company_id': 20, 'company': COMPANIES[1]['name'],
               'position': 'Zero Score Role', 'match_score': 0, 'slots': 0, 'tags': [], 'lat': None, 'lng': None},
          ]}
MAP = """window.__markers=new Set(); window.L={
  map:()=>({setView(){return this},zoomControl:{setPosition(){}},invalidateSize(){},remove(){},fitBounds(){}}),
  tileLayer:()=>({addTo(){return this},on(){}}),divIcon: x=>x,
  marker:(pin)=>{const marker={addTo(){window.__markers.add(this);return this},bindPopup(){return this},remove(){window.__markers.delete(this)},isPopupOpen(){return false},getLatLng(){return pin}};return marker},
  featureGroup:()=>({getBounds:()=>({pad(){return this}})})};"""
checks, errors = [], []


def fits(page):
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Page overflow'
    for dialog in page.get_by_role('dialog').all():
        assert dialog.evaluate('(el) => el.scrollWidth <= el.clientWidth'), 'Dialog overflow'


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel='chrome', headless=True)
    try:
        for width, dark in [(1440, False), (768, False), (375, False), (320, True)]:
            context = browser.new_context(viewport={'width': width, 'height': 960})
            values = {'sb-token': 'synthetic', 'sb-user': json.dumps(USER), 'sb-role': 'student'}
            context.add_init_script('for (const [k,v] of Object.entries(' + json.dumps(values) + ')) localStorage.setItem(k,v);' + MAP)
            catalog = copy.deepcopy(COMPANIES)
            state = {'fail_catalog': width == 1440}

            def route_request(route):
                url = urlparse(route.request.url)
                if url.path.endswith('/events/'):
                    return route.fulfill(status=204)
                if url.path == '/api/student/results/combined/':
                    return route.fulfill(json=RESULT)
                if url.path == '/api/students/me/':
                    return route.fulfill(json=USER)
                if url.path == CATALOG_URL:
                    return route.fulfill(status=503, json={'error': 'synthetic outage'}) if state['fail_catalog'] else route.fulfill(json=catalog)
                if url.path == '/api/assessments/':
                    return route.fulfill(json={'assessments': []})
                if url.path.startswith('/api/'):
                    return route.fulfill(json=[])
                if url.hostname not in ['127.0.0.1', 'localhost']:
                    return route.abort()
                return route.continue_()

            context.route('**/*', route_request)
            page = context.new_page()
            page.set_default_timeout(10_000)
            pending = set()
            page.on('request', lambda request: pending.add(request.url))
            page.on('requestfinished', lambda request: pending.discard(request.url))
            page.on('requestfailed', lambda request: pending.discard(request.url))
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(BASE + '/student/results')
            try:
                page.wait_for_load_state('networkidle', timeout=10_000)
            except Exception:
                print('Pending requests:', sorted(pending), flush=True)
                page.screenshot(path=str(ARTIFACTS / 'loading-debug.png'))
                raise
            if dark:
                page.evaluate("document.documentElement.classList.add('dark')")
            card = page.locator('article').first
            expect(page.locator('article')).to_have_count(2)
            expect(page.get_by_text('2 companies · 5 suggested positions', exact=True)).to_be_visible()
            expect(card.get_by_text('3 suggested positions', exact=True)).to_be_visible()
            expect(card.get_by_text('73.44%', exact=True)).to_be_visible()
            expect(page.get_by_text('Database Intern', exact=True)).to_have_count(0)
            page.wait_for_function('window.__markers.size === 2')  # One company pin + own student pin.
            expect(card.get_by_text('+9 more', exact=True)).to_be_visible()
            expect(card.get_by_text('React', exact=True)).to_have_count(0)
            notice = page.get_by_label('OJT placement guidance')
            expect(notice).to_contain_text(NOTICE)
            assert notice.bounding_box()['y'] < card.bounding_box()['y']
            card.scroll_into_view_if_needed()
            fits(page)
            page.screenshot(path=str(ARTIFACTS / f'cards-{width}.png'))

            # The whole non-interactive card surface opens details; tooltips remain independent.
            card.get_by_role('button', name='Best position match: explanation').click()
            expect(page.get_by_role('tooltip')).to_be_visible()
            expect(page.get_by_role('dialog')).to_have_count(0)
            page.keyboard.press('Escape')
            expect(page.get_by_role('tooltip')).to_have_count(0)
            card.get_by_text('Programming', exact=True).scroll_into_view_if_needed()
            preview = card.get_by_text('Programming', exact=True).bounding_box()
            page.mouse.click(preview['x'] + preview['width'] / 2, preview['y'] + preview['height'] / 2)
            dialog = page.get_by_role('dialog')
            expect(dialog).to_be_visible()
            if state['fail_catalog']:
                expect(dialog.get_by_role('alert')).to_contain_text('Could not load')
                state['fail_catalog'] = False
                dialog.get_by_role('button', name='Retry', exact=True).click()
            expect(dialog.get_by_role('heading', name=COMPANIES[0]['name'], exact=True)).to_be_visible()
            expect(dialog.get_by_text('React', exact=True)).to_be_visible()
            expect(dialog.get_by_text('#1 in this company · Top suggested position', exact=True)).to_be_visible()
            expect(dialog.locator('h4')).to_have_text(['Frontend Developer Intern', 'Database Intern', 'Backend Intern', 'Unscored Cloud Role', 'Unscored Support Role'])
            expect(dialog.get_by_text('No current match score', exact=True)).to_have_count(2)
            expect(dialog.get_by_label('OJT placement guidance')).to_contain_text(NOTICE)
            fits(page)
            page.screenshot(path=str(ARTIFACTS / f'details-{width}.png'))
            close = dialog.get_by_role('button', name='Close company details')
            close.focus()
            page.keyboard.press('Shift+Tab')
            assert page.evaluate("document.activeElement.closest('dialog') !== null"), 'Dialog focus escaped'
            page.keyboard.press('Escape')
            expect(dialog).to_have_count(0)
            opener = card.get_by_role('button', name='View company details', exact=False)
            expect(opener).to_be_focused()
            page.keyboard.press('Enter')
            expect(dialog).to_be_visible()

            if width == 1440:
                # Open details resolve new catalog data rather than keeping a selection snapshot.
                catalog[0]['name'] = 'Synthetic Updated Company'
                page.evaluate("window.dispatchEvent(new CustomEvent('sse:data_changed', {detail: {urls: ['/api/student/companies/']}}))")
                expect(dialog.get_by_role('heading', name='Synthetic Updated Company', exact=True)).to_be_visible()
                catalog.clear()
                page.evaluate("window.dispatchEvent(new CustomEvent('sse:data_changed', {detail: {urls: ['/api/student/companies/']}}))")
                expect(dialog.get_by_text('This company or position is no longer listed.', exact=False)).to_be_visible()
                catalog.extend(copy.deepcopy(COMPANIES))
                page.evaluate("window.dispatchEvent(new CustomEvent('sse:data_changed', {detail: {urls: ['/api/student/companies/']}}))")
                expect(dialog.get_by_role('heading', name=COMPANIES[0]['name'], exact=True)).to_be_visible()
                # Changing position scores reorders the open company's local ranks.
                next(pos for pos in catalog[0]['positions'] if pos['id'] == 102)['match_score'] = 80.01
                page.evaluate("window.dispatchEvent(new CustomEvent('sse:data_changed', {detail: {urls: ['/api/student/companies/']}}))")
                expect(dialog.locator('h4').first).to_have_text('Database Intern')
                catalog[:] = copy.deepcopy(COMPANIES)
                page.evaluate("window.dispatchEvent(new CustomEvent('sse:data_changed', {detail: {urls: ['/api/student/companies/']}}))")
                expect(dialog.locator('h4').first).to_have_text('Frontend Developer Intern')
            page.keyboard.press('Escape')
            page.get_by_role('button', name='All Companies', exact=False).click()
            expect(page.locator('article')).to_have_count(3)
            page.locator('article').nth(1).click(position={'x': 20, 'y': 20})
            expect(dialog.get_by_text('Address not provided.', exact=True)).to_be_visible()
            expect(dialog.get_by_text('No skill requirements listed.', exact=True)).to_have_count(3)
            expect(dialog.get_by_text('No current match score', exact=True)).to_be_visible()
            expect(dialog.get_by_text('0%', exact=True)).to_be_visible()
            expect(dialog.locator('h4')).to_have_text(['Network Intern', 'Zero Score Role', 'Unscored Network Role'])
            fits(page)
            page.keyboard.press('Escape')
            page.locator('article').nth(2).get_by_role('button').click()
            expect(dialog.get_by_text('No positions are currently listed.', exact=True)).to_be_visible()
            page.keyboard.press('Escape')

            page.goto(BASE + '/student/dashboard')
            page.wait_for_load_state('networkidle')
            match = page.get_by_role('button', name='View company details for Synthetic Technology Partnership, Frontend Developer Intern', exact=True)
            expect(match).to_be_visible()
            expect(page.get_by_role('button', name='View company details for ', exact=False)).to_have_count(2)
            expect(page.get_by_role('button', name='View nearby company details for ', exact=False)).to_have_count(1)
            page.wait_for_function('window.__markers.size === 2')
            expect(page.get_by_label('OJT placement guidance')).to_have_count(0)
            match.focus()
            page.keyboard.press('Space')
            expect(dialog.get_by_text('#1 in this company · Top suggested position', exact=True)).to_be_visible()
            page.keyboard.press('Escape')
            expect(match).to_be_focused()
            page.get_by_role('button', name='View nearby company details', exact=False).click()
            expect(dialog.get_by_text('#1 in this company · Top suggested position', exact=True)).to_be_visible()
            page.keyboard.press('Escape')
            fits(page)
            checks.append(f'{width}px {"dark" if dark else "light"}: two company cards for five suggestions, five roles ranked in details, zero versus unscored, both tabs, unique dashboard/map entries, keyboard/focus, notice')
            context.close()
        assert not errors, errors
    finally:
        browser.close()
        summary = {'checks': checks, 'page_errors': errors}
        (ARTIFACTS / 'results.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
        print(json.dumps(summary, indent=2))
