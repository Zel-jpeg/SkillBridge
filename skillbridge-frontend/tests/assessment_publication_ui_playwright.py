"""Publication presentation and recovery checks; all API calls use synthetic data.

Run against a local frontend with SKILLBRIDGE_TEST_BASE (default port 5189).
"""
import json
import os
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get('SKILLBRIDGE_TEST_BASE', 'http://127.0.0.1:5189')
OUT = Path(__file__).parent / 'artifacts/assessment-publication'
OUT.mkdir(parents=True, exist_ok=True)
TITLES = ['Programming', 'Database Management', 'Web Development', 'Networking', 'Cybersecurity', 'Tech Support']


class Fixture:
    def __init__(self, browser, role, multiple=False, count=6):
        self.records = [dict(id=i + 1, title=TITLES[i % 6], batch_id=2 if multiple and i == count - 1 else 1,
            batch_name='Second batch' if multiple and i == count - 1 else 'Batch 2026-2027',
            publication_status='draft', duration_minutes=60, question_count=10,
            is_required=i % 2 == 0, include_in_competency=i % 2 == 0,
            categories=[], created_at='2026-10-01T00:00:00Z', display_order=i,
            assigned_count=0, submission_count=0, completion_count=0, completion_rate=0)
            for i in range(count)]
        user = dict(id=1, role=role, name='Synthetic Staff', is_approved=True)
        self.context = browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce')
        self.context.add_init_script('for (const [k,v] of Object.entries(' + json.dumps({
            'sb-token': 'synthetic', 'sb-role': role, 'sb-user': json.dumps(user), 'sb-theme': 'light',
        }) + ')) localStorage.setItem(k,v)')
        self.user, self.pending, self.posts, self.errors = user, None, [], []
        self.context.route('**/*', self.route)
        self.page = self.context.new_page()
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.goto(BASE + f'/{role}/assessments', wait_until='networkidle')

    def route(self, route):
        url = urlparse(route.request.url)
        if url.path.startswith('/api/'):
            if url.path.endswith('/events/'):
                return route.fulfill(status=204)
            if url.path == '/api/auth/me/':
                return route.fulfill(json=self.user)
            if url.path == '/api/instructor/assessments/':
                return route.fulfill(json=self.records)
            if url.path == '/api/management/analytics/':
                return route.fulfill(json={
                    'role': self.user['role'], 'generated_at': '2026-10-30T00:00:00Z', 'scope': {},
                    'summary': {key: 0 for key in ('students', 'required_complete', 'approved', 'unplaced', 'awaiting_review', 'needs_followup', 'slots_remaining')},
                    'options': {key: [] for key in ('batches', 'instructors', 'courses', 'assessments', 'companies', 'positions', 'areas')},
                    **{key: [] for key in ('students', 'placement_students', 'assessments', 'batches', 'skills', 'capacity', 'match_bands', 'companies', 'areas', 'geography', 'activity')},
                })
            if url.path.endswith('/publish-assessments/'):
                self.posts.append((url.path, route.request.post_data_json))
                self.pending = route
                return
            if url.path.endswith('/batches/'):
                return route.fulfill(json=[dict(id=1, name='Batch 2026-2027', status='active'), dict(id=2, name='Second batch', status='active')])
            return route.fulfill(json=[])
        return route.continue_() if url.hostname in ('127.0.0.1', 'localhost') else route.abort()

    def open(self):
        self.page.get_by_role('button', name='Publish drafts together', exact=True).click()
        return self.page.get_by_role('dialog')

    def close(self):
        assert not self.errors, self.errors
        self.context.close()


def geometry(page, dialog):
    assert dialog.evaluate('n => n.scrollWidth <= n.clientWidth + 1'), 'Dialog horizontal overflow'
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), 'Page horizontal overflow'
    rect = dialog.bounding_box()
    viewport = page.viewport_size
    assert rect['x'] >= 0 and rect['y'] >= 0
    assert rect['x'] + rect['width'] <= viewport['width'] + 1
    assert rect['y'] + rect['height'] <= viewport['height'] + 1
    footer = dialog.locator('footer').bounding_box()
    assert footer['y'] + footer['height'] <= rect['y'] + rect['height'] + 1
    assert rect['y'] + rect['height'] - footer['y'] - footer['height'] <= 2, 'Unused space below footer'
    for button in dialog.locator('footer button').all():
        expect(button).to_be_in_viewport()


checks = []
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    try:
        for role in ('instructor', 'admin'):
            f = Fixture(browser, role)
            page, dialog = f.page, f.open()
            print(f'{role}: opened publication dialog', flush=True)
            expect(dialog.get_by_role('checkbox')).to_have_count(6)
            dialog.get_by_role('button', name='Clear selection', exact=True).click()
            expect(dialog.get_by_role('button', name='Review publication', exact=True)).to_be_disabled()
            dialog.get_by_role('button', name='Select all drafts', exact=True).click()
            dialog.get_by_role('checkbox').first.uncheck()
            dialog.get_by_role('button', name='Review publication', exact=True).click()
            expect(dialog.get_by_role('button', name='Publish 5 assessments', exact=True)).to_be_visible()
            dialog.get_by_role('button', name='Back', exact=True).click()
            expect(dialog.get_by_role('checkbox').first).not_to_be_checked()
            dialog.get_by_role('checkbox').first.focus()
            page.keyboard.press('Space')
            expect(dialog.get_by_role('checkbox').first).to_be_checked()
            # Every visible button provides hover and keyboard-focus feedback in both themes.
            for dark in (False, True):
                page.evaluate('dark => document.documentElement.classList.toggle("dark", dark)', dark)
                for reviewing in (False, True):
                    for button in dialog.locator(':scope > header button, .publication-body button, :scope > footer button').all():
                        page.mouse.move(0, 0)
                        page.wait_for_timeout(200)
                        original = button.evaluate('n => getComputedStyle(n).backgroundColor')
                        button.hover()
                        expect(button).not_to_have_css('background-color', original)
                        expect(button).to_have_css('cursor', 'pointer')
                        page.keyboard.press('Tab')
                        button.focus()
                        expect(button).to_be_focused()
                        expect(button).to_have_css('outline-style', 'solid')
                    dialog.get_by_role('button', name='Back' if reviewing else 'Review publication', exact=True).click()
            # Both steps remain bounded with accessible actions across narrow/short/large screens.
            for width, height in ((320, 568), (390, 844), (640, 720), (768, 1024), (1024, 600), (1440, 1000), (1920, 1080)):
                page.set_viewport_size({'width': width, 'height': height})
                for dark in (False, True):
                    page.evaluate('dark => document.documentElement.classList.toggle("dark", dark)', dark)
                    for reviewing in (False, True):
                        geometry(page, dialog)
                        page.screenshot(path=str(OUT / f'{role}-{width}-{height}-{"dark" if dark else "light"}-{"review" if reviewing else "select"}.png'))
                        dialog.get_by_role('button', name='Back' if reviewing else 'Review publication', exact=True).click()
            full_review_height = dialog.bounding_box()['height']
            checks.append(f'{role}: both steps at seven screen sizes in light/dark, all buttons hover/focus, selection and keyboard')
            print(checks[-1], flush=True)
            page.set_viewport_size({'width': 1440, 'height': 1000})
            dialog.get_by_role('button', name='Review publication', exact=True).click()
            dialog.get_by_role('button', name='Publish 6 assessments', exact=True).click()
            busy = dialog.get_by_role('button', name='Publishing…', exact=True)
            expect(busy).to_be_disabled()
            expect(busy).to_have_attribute('aria-busy', 'true')
            expect(dialog.locator('.publication-spinner')).to_be_visible()
            expect(dialog.get_by_role('button', name='Back', exact=True)).to_be_disabled()
            expect(dialog.get_by_role('button', name='Close draft publication', exact=True)).to_be_disabled()
            page.keyboard.press('Escape')
            expect(dialog).to_be_visible()
            busy.evaluate('n => n.click()')
            assert f.posts == [('/api/instructor/batches/1/publish-assessments/', {'assessment_ids': [1, 2, 3, 4, 5, 6]})]
            page.screenshot(path=str(OUT / f'{role}-publishing.png'))
            f.pending.fulfill(status=503, json={'error': 'Synthetic publication failure. Please retry.'})
            expect(dialog.locator('.publication-body').get_by_role('alert')).to_contain_text('Server is unavailable')
            expect(page.get_by_role('status').filter(has_text='6 assessments published.')).to_have_count(0)
            dialog.get_by_role('button', name='Publish 6 assessments', exact=True).click()
            expect(busy).to_be_disabled()
            assert len(f.posts) == 2 and f.posts[0] == f.posts[1]
            for item in f.records:
                item['publication_status'] = 'published'
            f.pending.fulfill(json={'published_count': 6})
            expect(dialog).to_have_count(0)
            expect(page.get_by_role('status').filter(has_text='6 assessments published.')).to_be_visible()
            page.screenshot(path=str(OUT / f'{role}-success.png'))
            checks.append(f'{role}: pending spinner/disabled controls, guarded duplicate, failure/retry exact payload and success notification')
            print(checks[-1], flush=True)
            f.close()
            f = Fixture(browser, role, multiple=True, count=30)
            page, dialog = f.page, f.open()
            expect(dialog.get_by_role('checkbox')).to_have_count(0)
            dialog.locator('select').select_option('1')
            expect(dialog.get_by_role('checkbox')).to_have_count(29)
            page.set_viewport_size({'width': 320, 'height': 568})
            geometry(page, dialog)
            dialog.get_by_role('checkbox').last.scroll_into_view_if_needed()
            geometry(page, dialog)
            dialog.locator('select').select_option('2')
            expect(dialog.get_by_role('checkbox')).to_have_count(1)
            dialog.get_by_role('button', name='Review publication', exact=True).click()
            expect(dialog.get_by_role('button', name='Publish 1 assessment', exact=True)).to_be_visible()
            geometry(page, dialog)
            page.set_viewport_size({'width': 1440, 'height': 1000})
            geometry(page, dialog)
            assert dialog.bounding_box()['height'] < full_review_height, 'Single-item review should shrink'
            page.screenshot(path=str(OUT / f'{role}-single-review.png'))
            page.keyboard.press('Escape')
            expect(dialog).to_have_count(0)
            expect(page.get_by_role('button', name='Publish drafts together', exact=True)).to_be_focused()
            assert not f.posts
            checks.append(f'{role}: multi-batch scoping, 29-row phone scrolling, singular label, Escape/focus return and no cancel writes')
            f.close()
        (OUT / 'results.json').write_text(json.dumps({'checks': checks, 'page_errors': []}, indent=2))
        for check in checks:
            print('PASS: ' + check, flush=True)
    finally:
        browser.close()
