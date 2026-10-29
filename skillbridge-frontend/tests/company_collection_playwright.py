"""Synthetic Companies UI regression. Every API, tile and address lookup is mocked.

Uses actual Leaflet 1.9.4 cached from the existing CDN in ignored artifacts.
Run with Vite on port 5176 and Python Playwright + Chrome installed.
"""
import base64
import copy
import json
import os
import re
import sys
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import urlopen

sys.path.insert(0, str(Path(__file__).parent / '.runtime-win'))
sys.path.insert(1, str(Path(__file__).parent / '.runtime'))
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('SKILLBRIDGE_TEST_BASE', 'http://127.0.0.1:5176')
API = '/api/admin/companies/'
ARTIFACTS = Path(__file__).parent / 'artifacts/company-collection'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
LEAFLET = {}
for suffix in ['js', 'css']:
    asset = ARTIFACTS / f'leaflet.min.{suffix}'
    if not asset.exists():
        asset.write_bytes(urlopen(f'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.{suffix}', timeout=30).read())
    LEAFLET[suffix] = asset.read_text(encoding='utf-8')
LEAFLET['js'] += ''';(() => { const create = L.map; window.__maps = [];
  L.map = function(...args) { const map = create.apply(this, args); map.__invalidations = 0;
    const invalidate = map.invalidateSize;
    map.invalidateSize = function(...options) { this.__invalidations++; return invalidate.apply(this, options); };
    window.__maps.push(map); return map; };
})();'''
TILE = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#eef2ed"/><path d="M0 80H256M0 190H256M65 0V256M180 0V256" stroke="#d4ddd1" stroke-width="9"/><path d="M0 140L256 40" stroke="#fff" stroke-width="14"/></svg>'
LOGO = '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" rx="12" fill="#15803d"/><text x="40" y="51" text-anchor="middle" font-size="36" fill="white">S</text></svg>'
PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQ0AAAAASUVORK5CYII=')
USER = {'id': 1, 'role': 'admin', 'name': 'Synthetic Admin', 'is_approved': True}
REQS = {'Web application engineering and responsive interface development': 75.5,
        'Database management and data modeling': 50, 'Networking': 90, 'Cloud': 25,
        'Security': 75, 'Communication': 50, 'Testing': 80, 'Documentation': 60, 'Problem solving': 85}
TAGS = ['React', 'JavaScript', 'Responsive layout', 'Database design', 'REST APIs', 'Git', 'Accessibility', 'Testing', 'Long keyword describing cross-team collaboration']
NAME = 'Synthetic Systems and Applied Technology Partnership'
ROLE = 'Frontend application engineer for accessible enterprise systems'


def records():
    return [{'id': 1, 'name': NAME, 'image_url': 'https://fixture.invalid/logo.svg',
             'address': {'street': 'Suite 1204, Building with a long institutional address', 'barangay': 'Synthetic Barangay', 'city': 'Synthetic City', 'province': 'Synthetic Province'},
             'lat': 7.3, 'lng': 125.68,
             'positions': [{'id': 11, 'title': ROLE, 'slots': 2, 'requirements': REQS.copy(), 'tags': TAGS.copy()},
                           {'id': 12, 'title': 'Exploratory internship', 'slots': 1, 'requirements': {}, 'tags': []}]},
            {'id': 2, 'name': 'Synthetic Empty Partner', 'image_url': None,
             'address': None, 'lat': None, 'lng': None, 'positions': []},
            {'id': 3, 'name': 'Synthetic Broken Logo Partner', 'image_url': 'https://fixture.invalid/broken.png',
             'address': 'Legacy building address, Synthetic City, Synthetic Province', 'lat': 7.34, 'lng': 125.72,
             'positions': [{'id': 31 + i, 'title': f'Research role {i + 1}', 'slots': 1, 'requirements': {}, 'tags': []} for i in range(7)]}]


class Fixture:
    def __init__(self, browser, empty=False, fail=False, hold=False):
        self.records = [] if empty else records()
        self.fail, self.hold, self.fail_save = fail, hold, False
        self.pending, self.calls, self.writes, self.errors = None, [], [], []
        self.context = browser.new_context(viewport={'width': 1440, 'height': 1100}, reduced_motion='reduce')
        self.context.add_init_script('''localStorage.setItem('sb-token','synthetic-session');
          localStorage.setItem('sb-role','admin'); localStorage.setItem('sb-user', ''' + json.dumps(json.dumps(USER)) + ''');
          window.EventSource = class { close() {} };''')
        self.context.route('**/*', self.route)
        self.page = self.context.new_page()
        self.page.set_default_timeout(12000)
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))

    def route(self, route):
        request, parsed = route.request, urlparse(route.request.url)
        path = parsed.path
        if parsed.hostname == 'cdnjs.cloudflare.com':
            suffix = 'js' if path.endswith('.js') else 'css'
            return route.fulfill(body=LEAFLET[suffix], content_type='application/javascript' if suffix == 'js' else 'text/css')
        if parsed.hostname and parsed.hostname.endswith('tile.openstreetmap.org'):
            return route.fulfill(body=TILE, content_type='image/svg+xml')
        if parsed.hostname == 'fixture.invalid':
            return route.fulfill(status=404) if path.endswith('broken.png') else route.fulfill(body=LOGO, content_type='image/svg+xml')
        if parsed.hostname == 'psgc.gitlab.io':
            data = [{'code': 'P1', 'name': 'Synthetic Province'}]
            if 'barangays' in path:
                data = [{'code': 'B1', 'name': 'Synthetic Barangay'}]
            elif 'cities-municipalities' in path:
                data = [{'code': 'C1', 'name': 'Synthetic City'}]
            return route.fulfill(json=data, headers={'Access-Control-Allow-Origin': '*'})
        if parsed.hostname == 'nominatim.openstreetmap.org':
            return route.fulfill(json=[], headers={'Access-Control-Allow-Origin': '*'})
        if path == '/gsi/client':
            return route.fulfill(body='window.google={accounts:{oauth2:{initTokenClient(){return {requestAccessToken(){}}}}}};', content_type='application/javascript')
        if parsed.hostname not in ['127.0.0.1', 'localhost']:
            return route.abort()
        if not path.startswith('/api/'):
            return route.continue_()
        self.calls.append((request.method, path))
        if request.method == 'GET':
            if path == API:
                if self.hold:
                    self.pending = route
                    return
                return route.fulfill(status=503 if self.fail else 200, json={'error': 'Synthetic companies failure'} if self.fail else self.records)
            if path == '/api/auth/me/':
                return route.fulfill(json=USER)
            if path == '/api/categories/':
                return route.fulfill(json=[{'id': i + 1, 'name': name} for i, name in enumerate(REQS)])
            if path.startswith('/api/nlp/positions/'):
                return route.fulfill(json={'texts': [{'label': 'Position description', 'text': 'Synthetic generated role description. Required skill percentages: Networking 90%; Cloud 25%.'}]})
            if path == '/api/admin/users/':
                return route.fulfill(json={'students': [], 'instructors': [], 'pending_instructors': []})
            return route.fulfill(json={} if path.endswith(('/stats/', '/reports/')) else [])
        self.writes.append((request.method, path, (request.post_data_buffer or b'').decode('utf-8', errors='replace')))
        data = request.post_data_json if 'application/json' in request.headers.get('content-type', '') else None
        if data is None and 'multipart' in request.headers.get('content-type', ''):
            text = request.post_data_buffer.decode('utf-8', errors='replace')
            payload = re.search(r'name="payload"\r\n\r\n(.*?)\r\n--', text, re.S)
            data = json.loads(payload.group(1))
        if request.method == 'POST' and path == API:
            company = {**data, 'id': 90, 'positions': [], 'image_url': 'https://fixture.invalid/new-logo.svg' if 'multipart' in request.headers.get('content-type', '') else None}
            self.records.insert(0, company)
            return route.fulfill(json=company)
        company_match = re.fullmatch(API + r'(\d+)/', path)
        if company_match:
            cid = int(company_match.group(1))
            if request.method == 'DELETE':
                self.records = [c for c in self.records if c['id'] != cid]
                return route.fulfill(status=204)
            if self.fail_save:
                return route.fulfill(status=409, json={'error': 'Synthetic company save conflict'})
            company = next(c for c in self.records if c['id'] == cid)
            company.update(data)
            if data.get('image_action') == 'remove':
                company['image_url'] = None
            elif data.get('image_action') == 'replace':
                company['image_url'] = 'https://fixture.invalid/replaced-logo.svg'
            return route.fulfill(json=company)
        if path.endswith('/positions/') and request.method == 'POST':
            company = next(c for c in self.records if c['id'] == int(path.split('/')[-3]))
            position = {**data, 'id': 99}
            company['positions'].append(position)
            return route.fulfill(json=position)
        position_match = re.fullmatch(r'/api/admin/positions/(\d+)/', path)
        if position_match:
            pid = int(position_match.group(1))
            company = next(c for c in self.records if any(p['id'] == pid for p in c['positions']))
            if request.method == 'DELETE':
                company['positions'] = [p for p in company['positions'] if p['id'] != pid]
                return route.fulfill(status=204)
            position = next(p for p in company['positions'] if p['id'] == pid)
            position.update(data)
            return route.fulfill(json=position)
        if path == '/api/tags/suggest/':
            return route.fulfill(json={'suggested_tags': ['Synthetic tag']})
        return route.fulfill(json={})

    def open(self):
        self.page.goto(BASE + '/admin/companies', wait_until='domcontentloaded' if self.hold else 'load')
        if not self.hold:
            self.page.wait_for_load_state('networkidle')
        return self.page

    def refresh(self):
        self.page.evaluate('(url) => window.dispatchEvent(new CustomEvent("sse:data_changed", {detail:{urls:[url]}}))', API)

    def shot(self, name):
        self.page.screenshot(path=str(ARTIFACTS / (name + '.png')), full_page=False)

    def close(self):
        assert not self.errors, self.errors
        self.context.close()


def company(page, name=NAME):
    return page.get_by_role('article', name=name, exact=True)


def position(page, title=ROLE):
    return page.get_by_role('region', name=title, exact=True)


def modal(page, title):
    return page.locator('div.fixed.inset-0').filter(has=page.get_by_role('heading', name=title, exact=True)).last


with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    f = Fixture(browser)
    page = f.open()
    page.wait_for_selector('#partner-locations-map .leaflet-tile-loaded')
    toggle = page.get_by_role('button', name=re.compile('Partner Locations'))
    expect(toggle).to_have_attribute('aria-expanded', 'true')
    expect(page.locator('#partner-locations-map')).to_be_visible()
    assert page.evaluate('window.__maps.length') == 1
    map_id = page.locator('#partner-locations-map .leaflet-container').evaluate('el => el._leaflet_id')
    checks = ['Map initially expanded, actual Leaflet initialized once and synthetic tiles loaded']
    expect(company(page).get_by_text('2 positions · 3 active configured slots', exact=True)).to_be_visible()
    expect(position(page).get_by_text('9 requirements · 9 keywords', exact=True)).to_be_visible()
    expect(page.get_by_role('button', name='Preview Position NLP Description')).to_have_count(0)
    expect(company(page, 'Synthetic Empty Partner').get_by_text(re.compile('No positions yet'))).to_be_visible()
    logo = page.get_by_role('img', name=NAME + ' logo')
    logo.scroll_into_view_if_needed()
    expect(logo).to_have_js_property('complete', True)
    expect(logo).to_have_js_property('naturalWidth', 80)
    broken_logo = page.get_by_role('img', name='Synthetic Broken Logo Partner logo')
    broken_logo.scroll_into_view_if_needed()
    expect(broken_logo).to_have_js_property('tagName', 'SPAN')
    company(page).get_by_label('Full address for ' + NAME).click()
    expect(company(page).get_by_text(re.compile('Suite 1204'))).to_be_visible()
    company(page).get_by_label('Full address for ' + NAME).click()
    expect(company(page, 'Synthetic Broken Logo Partner').get_by_role('heading', name=re.compile('Research role'))).to_have_count(7)
    f.shot('desktop-map-expanded-cards-collapsed')
    pos = position(page)
    disclosure = pos.get_by_role('button', name='Show details for ' + ROLE)
    disclosure.focus()
    disclosure.press('Enter')
    expect(pos.get_by_role('heading', name='Skill requirements')).to_be_visible()
    assert pos.locator('dl > div').count() == 9
    assert pos.get_by_role('list', name='Position keywords').get_by_role('listitem').all_text_contents() == TAGS
    assert pos.locator('dt').all_text_contents() == list(REQS)
    expect(pos.get_by_text('≥75.5%', exact=True)).to_be_visible()
    assert not any('/nlp/positions/' in path for _, path in f.calls)
    toggle.click()
    expect(toggle).to_have_attribute('aria-expanded', 'false')
    page.evaluate('window.scrollTo(0,0)')
    f.shot('desktop-map-collapsed')
    page.screenshot(path=str(ARTIFACTS / 'desktop-position-expanded-map-collapsed.png'), full_page=True)
    # Expanding one company must not stretch its sibling to the same height.
    assert company(page, 'Synthetic Empty Partner').bounding_box()['height'] < company(page).bounding_box()['height']
    pos.get_by_role('button', name='Preview Position NLP Description').click()
    expect(pos.get_by_text('Synthetic generated role description.', exact=True)).to_be_visible()
    assert sum('/api/nlp/positions/11/text/' == path for _, path in f.calls) == 1
    pos.get_by_role('button', name='Hide generated NLP text').click()
    pos.get_by_role('button', name='Hide details for ' + ROLE).press('Space')
    expect(pos.get_by_role('heading', name='Skill requirements')).to_have_count(0)
    pos.get_by_role('button', name='Show details for ' + ROLE).press('Enter')
    expect(pos.get_by_role('button', name='Preview Position NLP Description')).to_have_attribute('aria-expanded', 'false')
    assert sum('/api/nlp/positions/11/text/' == path for _, path in f.calls) == 1
    f.records[0]['positions'][0]['requirements']['Cloud'] = 30
    f.refresh()
    expect(pos.get_by_text('≥30%', exact=True)).to_be_visible()
    expect(pos.get_by_role('button', name='Preview Position NLP Description')).to_have_attribute('aria-expanded', 'false')
    expect(toggle).to_have_attribute('aria-expanded', 'false')
    search = page.get_by_role('textbox', name='Search partners')
    search.fill('Empty Partner')
    expect(page.get_by_role('article')).to_have_count(1)
    search.fill('')
    expect(position(page).get_by_role('button', name='Hide details for ' + ROLE)).to_have_attribute('aria-expanded', 'true')
    expect(toggle).to_have_attribute('aria-expanded', 'false')
    position(page, 'Exploratory internship').get_by_role('button', name=re.compile('Show details')).click()
    expect(position(page, 'Exploratory internship').get_by_text('No skill requirements configured.')).to_be_visible()
    expect(position(page, 'Exploratory internship').get_by_text('No keywords configured.')).to_be_visible()
    # Removing and restoring an ID clears obsolete disclosure state.
    saved = copy.deepcopy(f.records[0]['positions'][1])
    f.records[0]['positions'].pop(1)
    f.refresh()
    expect(position(page, 'Exploratory internship')).to_have_count(0)
    f.records[0]['positions'].append(saved)
    f.refresh()
    expect(position(page, 'Exploratory internship').get_by_role('button', name=re.compile('Show details'))).to_have_attribute('aria-expanded', 'false')
    checks.append('Full requirements/percentages/order and every keyword, explicit NLP only, missing details, search/live expansion preservation and deleted-ID pruning')
    toggle.focus()
    toggle.press('Space')
    page.wait_for_function('window.__maps[0].getSize().x === document.querySelector("#partner-locations-map .leaflet-container").clientWidth')
    assert page.evaluate('window.__maps.length') == 1
    assert page.locator('#partner-locations-map .leaflet-container').evaluate('el => el._leaflet_id') == map_id
    assert page.evaluate('window.__maps[0].__invalidations') > 0
    page.locator('#partner-locations-map .leaflet-marker-icon').first.click()
    expect(page.locator('#partner-locations-map .leaflet-popup')).to_be_visible()
    page.locator('#partner-locations-map .leaflet-popup-close-button').click()
    checks.append('Keyboard map reopen, preserved instance, resized viewport and marker popup after hidden background refresh')

    # All existing editors still receive complete records; draft is independent of SSE.
    company(page).get_by_role('button', name='Edit partner ' + NAME).click()
    editor = page.get_by_role('dialog', name='Edit Partner', exact=True)
    editor.locator('#company-edit-name').fill('Unsaved company draft')
    f.refresh()
    expect(editor.locator('#company-edit-name')).to_have_value('Unsaved company draft')
    editor.get_by_role('button', name='Remove image', exact=True).click()
    editor.get_by_role('button', name='Undo image change', exact=True).click()
    editor.locator('input[type=file]').set_input_files({'name': 'synthetic.png', 'mimeType': 'image/png', 'buffer': PNG})
    expect(editor.get_by_text('Ready to save', exact=True)).to_be_visible()
    f.fail_save = True
    editor.get_by_role('button', name='Save Changes', exact=True).click()
    expect(editor.get_by_text('Synthetic company save conflict', exact=True)).to_be_visible()
    expect(editor.locator('#company-edit-name')).to_have_value('Unsaved company draft')
    f.fail_save = False
    editor.get_by_role('button', name='Save Changes', exact=True).click()
    expect(editor).to_have_count(0)
    expect(company(page, 'Unsaved company draft')).to_be_visible()
    company(page, 'Unsaved company draft').get_by_role('button', name='Edit partner Unsaved company draft').click()
    editor = page.get_by_role('dialog', name='Edit Partner', exact=True)
    editor.get_by_role('button', name='Remove image', exact=True).click()
    editor.get_by_role('button', name='Save Changes', exact=True).click()
    expect(editor).to_have_count(0)
    assert '"image_action":"remove"' in f.writes[-1][2]
    pos = position(page)
    pos.get_by_role('button', name='Edit position ' + ROLE).click()
    edit_pos = modal(page, 'Edit Position')
    expect(edit_pos.locator('textarea')).to_have_value(', '.join(TAGS))
    expect(edit_pos.get_by_text(list(REQS)[0], exact=True).first).to_be_visible()
    edit_pos.locator('input[type=number]').first.fill('4')
    edit_pos.get_by_role('button', name='Save Changes', exact=True).click()
    expect(edit_pos).to_have_count(0)
    expect(position(page).get_by_label('4 configured slots')).to_be_visible()
    company(page, 'Synthetic Empty Partner').get_by_role('button', name='Add position to Synthetic Empty Partner').click()
    add = modal(page, 'Add Position')
    add.get_by_role('button', name='Add Position', exact=True).click()
    expect(add.get_by_text('Position title is required.', exact=True)).to_be_visible()
    add.locator('input[type=text], input:not([type])').first.fill('Synthetic added position')
    add.get_by_role('button', name='Add Position', exact=True).click()
    expect(position(page, 'Synthetic added position')).to_be_visible()
    position(page, 'Synthetic added position').get_by_role('button', name='Delete position Synthetic added position').click()
    confirm = page.get_by_role('dialog', name='Delete position?', exact=True)
    confirm.get_by_role('button', name='Cancel', exact=True).click()
    expect(position(page, 'Synthetic added position')).to_be_visible()
    position(page, 'Synthetic added position').get_by_role('button', name='Delete position Synthetic added position').click()
    page.get_by_role('dialog', name='Delete position?', exact=True).get_by_role('button', name='Delete', exact=True).click()
    expect(position(page, 'Synthetic added position')).to_have_count(0)
    checks.append('Company image replace/remove/undo and saved edit, dirty company draft during refresh, position edit/slots/all keywords, add validation and delete confirmation')

    # Existing two-step create and address/map-pinning flow.
    page.get_by_role('button', name='+ Add Partner', exact=True).click()
    add_co = modal(page, 'Add Partner')
    add_co.get_by_placeholder('e.g. Azeus Systems Philippines').fill('Synthetic Created Company')
    add_co.locator('select').nth(0).select_option('P1')
    add_co.locator('select').nth(1).select_option('C1')
    add_co.locator('select').nth(2).select_option(label='Synthetic Barangay')
    add_co.get_by_role('button', name=re.compile('Next')).click()
    add_co.locator('.leaflet-container').click(position={'x': 100, 'y': 100})
    add_co.get_by_role('button', name='Add Partner', exact=True).click()
    expect(company(page, 'Synthetic Created Company')).to_be_visible()
    company(page, 'Synthetic Created Company').get_by_role('button', name='Delete partner Synthetic Created Company').click()
    page.get_by_role('dialog', name='Delete partner?', exact=True).get_by_role('button', name='Cancel', exact=True).click()
    company(page, 'Synthetic Created Company').get_by_role('button', name='Delete partner Synthetic Created Company').click()
    page.get_by_role('dialog', name='Delete partner?', exact=True).get_by_role('button', name='Delete', exact=True).click()
    expect(company(page, 'Synthetic Created Company')).to_have_count(0)
    checks.append('Two-step company creation, synthetic address selection, Leaflet pinning, company delete/cancel confirmation')
    page.wait_for_timeout(3200)  # Let expected success toasts finish before visual captures.
    for width in [375, 768, 1440]:
        page.set_viewport_size({'width': width, 'height': 1000})
        for dark in [False, True]:
            page.evaluate('(dark) => document.documentElement.classList.toggle("dark", dark)', dark)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (width, dark)
            toggle.click() if toggle.get_attribute('aria-expanded') == 'false' else None
            page.wait_for_function('window.__maps[0].getSize().x === document.querySelector("#partner-locations-map .leaflet-container").clientWidth')
            page.evaluate('window.scrollTo(0,0)')
            f.shot(f'map-{width}-' + ('dark' if dark else 'light'))
            toggle.click()
            company(page, 'Unsaved company draft').evaluate('el => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 72)')
            f.shot(f'expanded-{width}-' + ('dark' if dark else 'light'))
    search.fill('no-such-company')
    expect(page.get_by_text('No partners match these filters.', exact=True)).to_be_visible()
    f.close()
    checks.append('Phone/tablet/desktop and dark mode, long text without overflow, independent card heights, all seven positions reachable, no-match state')
    for mode in ['empty', 'failure', 'loading']:
        f = Fixture(browser, empty=mode == 'empty', fail=mode == 'failure', hold=mode == 'loading')
        page = f.open()
        if mode == 'empty':
            expect(page.get_by_text(re.compile('No partners yet'))).to_be_visible()
        elif mode == 'failure':
            expect(page.get_by_text('Could not load this section. Please try again.').first).to_be_visible()
            f.fail = False
            page.get_by_role('button', name='Retry', exact=True).first.click()
            expect(page.get_by_role('article')).to_have_count(3)
            f.fail = True
            f.refresh()
            expect(page.get_by_text('Could not refresh. Showing the last loaded data.').first).to_be_visible()
            expect(page.get_by_role('article')).to_have_count(3)
        else:
            expect(page.get_by_role('status', name='Loading partners and positions')).to_be_visible()
            f.shot('loading-map-and-cards')
            f.hold = False
            f.pending.fulfill(json=f.records)
            expect(page.get_by_role('article')).to_have_count(3)
        f.close()
    checks.append('Matching initial skeleton, successful empty collection, initial failure/retry and last-good cards during background errors')
    browser.close()
    print(json.dumps({'checks': checks, 'screenshots': str(ARTIFACTS)}, indent=2))
