"""Position editor interactions and responsive layout; synthetic, intercepted API only."""
import copy
import json
import os
import time
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get('SKILLBRIDGE_TEST_BASE', 'http://127.0.0.1:5213')
ARTIFACTS = Path(__file__).resolve().parents[2] / 'work/position-dialog'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
NAMES = ['Web Development', 'Database', 'Design', 'Networking', 'Backend', 'Cloud',
         'Cybersecurity', 'Database Management', 'DevOps', 'Operating Systems',
         'Programming', 'Technical Support', 'Tools', 'Version Control']
USER = {'id': 1, 'role': 'admin', 'name': 'Synthetic Admin', 'is_approved': True}
COMPANY = {'id': 1, 'name': 'Sample Company', 'address': None, 'lat': None, 'lng': None,
           'positions': [{'id': 1, 'title': 'Backend Developer Intern', 'slots': 3,
                          'tags': ['Django', 'REST API'],
                          'requirements': {'Backend': 75, 'Cloud': 65, 'Database Management': 52.5,
                                           'Saved legacy category': 80}}]}


class Fixture:
    def __init__(self, browser, viewport=None):
        self.context = browser.new_context(viewport=viewport or {'width': 1440, 'height': 1080})
        self.context.add_init_script('for (const [k,v] of Object.entries(' + json.dumps({
            'sb-token': 'synthetic-local-token', 'sb-role': 'admin', 'sb-user': json.dumps(USER),
        }) + ')) localStorage.setItem(k,v)')
        self.context.route('**/*', self.route)
        self.page = self.context.new_page()
        self.errors, self.writes, self.suggestions = [], [], []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.company = copy.deepcopy(COMPANY)
        self.categories = NAMES.copy()
        self.fail_save, self.fail_tags, self.fail_categories = False, False, False

    def route(self, route):
        request = route.request
        parsed = urlparse(request.url)
        if parsed.hostname not in ['localhost', '127.0.0.1']:
            return route.abort()
        path = parsed.path
        if not path.startswith('/api/'):
            return route.continue_()
        if path.endswith('/events/'):
            return route.fulfill(status=204)
        if path == '/api/auth/me/':
            return route.fulfill(json=USER)
        if path == '/api/categories/':
            if self.fail_categories:
                return route.fulfill(status=503, json={'error': 'Synthetic category outage'})
            return route.fulfill(json=[{'id': i + 1, 'name': name} for i, name in enumerate(self.categories)])
        if path == '/api/admin/companies/' and request.method == 'GET':
            return route.fulfill(json=[self.company])
        if path == '/api/admin/management-actions/':
            return route.fulfill(json={'count': 0, 'results': []})
        if path == '/api/admin/users/':
            return route.fulfill(json={'students': [], 'instructors': [], 'pending_instructors': []})
        if path == '/api/management/analytics/':
            # The shared header reads this feed even when its menu is closed.
            return route.fulfill(json={
                'role': 'admin', 'generated_at': '2026-10-31T00:00:00Z', 'scope': {},
                'summary': {key: 0 for key in ['students', 'required_complete', 'approved',
                    'unplaced', 'awaiting_review', 'needs_followup', 'slots_remaining']},
                'options': {key: [] for key in ['batches', 'instructors', 'courses',
                    'assessments', 'companies', 'positions', 'areas']},
                **{key: [] for key in ['students', 'placement_students', 'assessments',
                    'batches', 'skills', 'capacity', 'match_bands', 'companies', 'areas',
                    'geography', 'activity']},
            })
        if path == '/api/tags/suggest/':
            self.suggestions.append(request.post_data_json)
            if self.fail_tags:
                return route.fulfill(status=400, json={'error': 'Synthetic tag service unavailable'})
            return route.fulfill(json={'suggested_tags': ['Django', 'REST API', 'PostgreSQL']})
        if request.method in ['POST', 'PATCH'] and ('/positions/' in path):
            data = request.post_data_json
            self.writes.append((request.method, path, data))
            time.sleep(.15)
            if self.fail_save:
                return route.fulfill(status=409, json={'error': 'Synthetic save conflict'})
            if request.method == 'POST':
                data = {**data, 'id': 2}
                self.company['positions'].append(data)
            else:
                self.company['positions'][0].update(data)
            return route.fulfill(json=data)
        return route.fulfill(json={} if path.endswith('/stats/') else [])

    def open(self, edit=False):
        self.page.goto(BASE + '/admin/companies', wait_until='networkidle')
        self.page.get_by_role('button', name=('Edit position Backend Developer Intern' if edit else 'Add position to Sample Company'), exact=True).click()
        dialog = self.page.get_by_role('dialog', name='Edit Position' if edit else 'Add Position', exact=True)
        expect(dialog.get_by_label('Position title', exact=False)).to_be_visible()
        return dialog

    def refresh_categories(self):
        self.page.evaluate("window.dispatchEvent(new CustomEvent('sse:data_changed', {detail:{urls:['/api/categories/']}}))")

    def close(self):
        assert not self.errors, self.errors
        self.context.close()


def level(dialog, category):
    return dialog.get_by_label('Minimum level for ' + category, exact=True)


def assert_layout(dialog):
    assert dialog.evaluate('el => el.scrollWidth <= el.clientWidth + 1'), 'Dialog overflows horizontally'
    assert dialog.locator('.position-editor-body').evaluate('el => el.scrollWidth <= el.clientWidth + 1')
    assert dialog.locator('.position-editor-list').evaluate('el => el.scrollWidth <= el.clientWidth + 1')
    assert dialog.locator('.position-editor-footer').evaluate('el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight }')


checks = []
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel='chrome', headless=True)
    try:
        f = Fixture(browser)
        dialog = f.open()
        dialog.get_by_role('button', name='Suggest / refresh tags', exact=True).click()
        expect(dialog.locator('.position-editor-error')).to_have_text('Enter a position title before suggesting tags.')
        dialog.get_by_role('button', name='Add Position', exact=True).click()
        expect(dialog.locator('.position-editor-error')).to_have_text('Position title is required.')
        dialog.get_by_label('Position title', exact=False).fill('Backend Developer Intern')
        dialog.get_by_label('Available slots', exact=False).fill('1.5')
        dialog.get_by_role('button', name='Add Position', exact=True).click()
        expect(dialog.locator('.position-editor-error')).to_contain_text('whole number')
        assert not f.writes and not f.suggestions
        dialog.get_by_label('Available slots', exact=False).fill('0')
        for value in ['25', '50', '75', '90', '0', '50']:
            level(dialog, 'Web Development').select_option(value)
            expect(level(dialog, 'Web Development')).to_have_value(value)
        level(dialog, 'Backend').select_option('75')
        level(dialog, 'Database').select_option('75')
        level(dialog, 'Cloud').select_option('custom')
        custom = dialog.get_by_label('Custom percentage for Cloud', exact=True)
        expect(custom).to_be_focused()
        custom.fill('65')
        search = dialog.get_by_role('searchbox', name='Find a skill')
        search.fill('cloud')
        expect(dialog.locator('.position-editor-row')).to_have_count(1)
        expect(custom).to_have_value('65')
        search.press('Enter')
        assert not f.writes
        search.fill('nothing-matches')
        expect(dialog.get_by_text('No skills match your search.', exact=True)).to_be_visible()
        dialog.get_by_role('button', name='Show all skills', exact=True).click()
        expect(level(dialog, 'Cloud')).to_have_value('custom')
        dialog.get_by_role('button', name='Selected (4)', exact=True).click()
        expect(dialog.locator('.position-editor-row')).to_have_count(4)
        level(dialog, 'Database').select_option('0')
        expect(search).to_be_focused()
        expect(dialog.locator('.position-editor-row')).to_have_count(3)
        dialog.get_by_role('button', name='All skills (14)', exact=True).click()
        level(dialog, 'Database').select_option('75')
        checks.append('Presets, custom percent, search/empty recovery and selected filter preserve requirements; removed selected row restores focus')
        f.fail_tags = True
        dialog.get_by_label('Position tags', exact=True).fill('Manual, Keep me')
        dialog.get_by_role('button', name='Suggest / refresh tags', exact=True).click()
        expect(dialog.locator('.position-editor-error')).to_have_text('Synthetic tag service unavailable')
        expect(dialog.get_by_label('Position tags', exact=True)).to_have_value('Manual, Keep me')
        f.fail_tags = False
        dialog.get_by_role('button', name='Suggest / refresh tags', exact=True).click()
        expect(dialog.get_by_label('Position tags', exact=True)).to_have_value('Django, REST API, PostgreSQL')
        assert f.suggestions[-1]['requirements'] == {'Web Development': 50, 'Database': 75, 'Backend': 75, 'Cloud': 65}
        dialog.get_by_label('Position tags', exact=True).fill('Django, REST API, PostgreSQL, Custom tag')
        dialog.get_by_role('button', name='All skills (14)', exact=True).click()
        f.page.screenshot(path=str(ARTIFACTS / 'desktop.png'))
        f.fail_save = True
        dialog.get_by_role('button', name='Add Position', exact=True).evaluate('(el) => { el.click(); el.click() }')
        expect(dialog.locator('.position-editor-error')).to_have_text('Synthetic save conflict')
        assert len(f.writes) == 1
        expect(dialog.get_by_label('Available slots', exact=False)).to_have_value('0')
        expect(dialog.get_by_label('Custom percentage for Cloud', exact=True)).to_have_value('65')
        f.fail_save = False
        dialog.get_by_role('button', name='Add Position', exact=True).click()
        expect(dialog).to_have_count(0)
        assert f.writes[-1] == ('POST', '/api/admin/companies/1/positions/', {
            'title': 'Backend Developer Intern', 'slots': 0,
            'requirements': {'Web Development': 50, 'Database': 75, 'Backend': 75, 'Cloud': 65},
            'tags': ['Django', 'REST API', 'PostgreSQL', 'Custom tag'],
        })
        checks.append('Unchanged create/suggest payloads, zero capacity, editable tags, failure preservation, single pending save and successful retry')
        f.close()

        f = Fixture(browser)
        dialog = f.open(edit=True)
        expect(dialog.get_by_role('button', name='Close position editor')).to_be_focused()
        expect(level(dialog, 'Cloud')).to_have_value('custom')
        expect(dialog.get_by_label('Custom percentage for Database Management', exact=True)).to_have_value('52.5')
        search = dialog.get_by_role('searchbox', name='Find a skill')
        search.fill('saved legacy')
        expect(level(dialog, 'Saved legacy category')).to_have_value('custom')
        search.fill('backend')
        dialog.get_by_label('Position title', exact=False).fill('Updated role')
        dialog.get_by_role('button', name='Save Changes', exact=True).click()
        expect(dialog).to_have_count(0)
        assert f.writes[-1][0:2] == ('PATCH', '/api/admin/positions/1/')
        assert f.writes[-1][2]['requirements'] == COMPANY['positions'][0]['requirements']
        checks.append('Edit preserves custom decimals, hidden requirements and saved categories absent from catalog')
        f.close()

        f = Fixture(browser)
        f.categories = [f'Synthetic skill {i:03d}' for i in range(80)]
        dialog = f.open()
        scroll = dialog.get_by_role('region', name='Skill requirements list')
        expect(dialog.get_by_role('button', name='All skills (80)', exact=True)).to_be_visible()
        assert scroll.evaluate('el => el.scrollHeight > el.clientHeight')
        scroll.evaluate('el => el.scrollTop = el.scrollHeight')
        dialog.get_by_role('searchbox', name='Find a skill').fill('079')
        expect(dialog.locator('.position-editor-row')).to_have_count(1)
        assert scroll.evaluate('el => el.scrollTop') == 0
        dialog.get_by_role('searchbox', name='Find a skill').fill('')
        f.categories = ['Synthetic skill 000', 'New category']
        f.refresh_categories()
        expect(dialog.get_by_role('button', name='All skills (2)', exact=True)).to_be_visible()
        expect(level(dialog, 'New category')).to_be_visible()
        short_height = scroll.evaluate('el => el.clientHeight')
        assert short_height < 200
        f.categories = []
        f.refresh_categories()
        expect(dialog.get_by_text('No skill categories available.', exact=True)).to_be_visible()
        dialog.get_by_role('button', name='Selected (0)', exact=True).click()
        f.categories = ['Restored category']
        f.refresh_categories()
        expect(dialog.get_by_text('No skills selected yet.', exact=True)).to_be_visible()
        dialog.get_by_role('button', name='Show all skills', exact=True).click()
        level(dialog, 'Restored category').select_option('25')
        f.categories = ['Replacement category']
        f.refresh_categories()
        expect(dialog.get_by_role('button', name='All skills (2)', exact=True)).to_be_visible()
        expect(level(dialog, 'Restored category')).to_have_value('25')
        f.page.screenshot(path=str(ARTIFACTS / 'short-list.png'))
        checks.append('80 categories scroll; search resets scroll; live shrink/grow/empty states work; removed configured category is preserved')
        f.close()

        f = Fixture(browser)
        f.fail_categories = True
        f.page.goto(BASE + '/admin/companies', wait_until='networkidle')
        f.page.get_by_role('button', name='Add position to Sample Company', exact=True).click()
        dialog = f.page.get_by_role('dialog', name='Add Position', exact=True)
        expect(dialog.locator('.sb-data-error')).to_contain_text('Could not load this section')
        f.fail_categories = False
        dialog.get_by_role('button', name='Retry', exact=True).click()
        expect(dialog.get_by_label('Position title', exact=False)).to_be_visible()
        f.close()
        checks.append('Category load error keeps accessible dialog and retries successfully')

        f = Fixture(browser)
        dialog = f.open(edit=True)
        for dark in [False, True]:
            f.page.evaluate('(dark) => document.documentElement.classList.toggle("dark", dark)', dark)
            for width, height in [(1440, 1080), (1280, 720), (768, 1024), (390, 844), (320, 640), (844, 390)]:
                f.page.set_viewport_size({'width': width, 'height': height})
                assert_layout(dialog)
                dialog.get_by_label('Position tags', exact=True).scroll_into_view_if_needed()
                dialog.get_by_label('Position tags', exact=True).fill('Django, REST API')
                assert_layout(dialog)
                if width in [1440, 390]:
                    f.page.screenshot(path=str(ARTIFACTS / f'layout-{width}-{"dark" if dark else "light"}.png'))
        # Global notification portals can add focusable controls after the form.
        for dismiss in f.page.get_by_role('button', name='Dismiss notification').all():
            dismiss.click()
        first = dialog.get_by_role('button', name='Close position editor')
        first.focus()
        first.press('Shift+Tab')
        expect(dialog.get_by_role('button', name='Save Changes', exact=True)).to_be_focused()
        f.page.keyboard.press('Tab')
        expect(first).to_be_focused()
        dialog.press('Escape')
        expect(dialog).to_have_count(0)
        expect(f.page.get_by_role('button', name='Edit position Backend Developer Intern', exact=True)).to_be_focused()
        f.close()
        checks.append('Desktop/tablet/phone/short-landscape light and dark layouts fit; sticky actions, focus trap, Escape and opener focus restoration pass')
    finally:
        (ARTIFACTS / 'results.json').write_text(json.dumps({'checks': checks}, indent=2), encoding='utf-8')
        print(json.dumps({'checks': checks}, indent=2))
        browser.close()
