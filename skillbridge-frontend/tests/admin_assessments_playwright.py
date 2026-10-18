"""Synthetic real-route UI checks. Intercepts every API; never writes live data.

Run with local Vite on port 5175. Uses Python Playwright and installed Chrome.
"""
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).parent / '.runtime-win'))
sys.path.insert(1, str(Path(__file__).parent / '.runtime'))
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:5175'
API = '/api/instructor/assessments/'
ARTIFACTS = Path(__file__).parent / 'artifacts/admin-assessments'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
USER = {'id': 1, 'role': 'admin', 'name': 'Synthetic Admin', 'is_approved': True}
GOOGLE = 'window.google={accounts:{oauth2:{initTokenClient(){return {requestAccessToken(){}}}}}};'


def assessment(i):
    state = ['published', 'draft', 'closed'][i % 3]
    return {'id': i, 'title': f'Assessment {i:02d} — Database foundations',
            'instructor_name': 'Alex Rivera' if i % 2 else 'Sam Cruz',
            'batch_id': i % 2 + 1, 'batch_name': 'Blue cohort' if i % 2 else 'Green cohort',
            'duration_minutes': 30, 'question_count': 14, 'publication_status': state,
            'is_required': i % 2 == 1, 'include_in_competency': True, 'display_order': i,
            'available_at': None, 'due_at': '2026-11-10T09:00:00Z' if i % 2 else None,
            'availability_status': 'available' if state == 'published' else state,
            'categories': ['Database', 'Networking', 'Cloud', 'Security', 'Development'],
            'assigned_count': 23, 'submission_count': 12, 'completion_count': 10,
            'completion_rate': 43.5, 'flagged_count': 2 if i == 27 else 0,
            'created_at': '2026-10-01T00:00:00Z'}


class Fixture:
    def __init__(self, browser, delay=0, fail=False, empty=False):
        self.records = [] if empty else [assessment(i) for i in range(1, 28)]
        self.calls, self.errors, self.patches = [], [], []
        self.denied = False
        self.hold_save, self.hold_retake = False, False
        self.pending_save, self.pending_retake = None, None
        self.hold_roster, self.hold_questions = False, False
        self.pending_roster, self.pending_questions = None, None
        self.delay, self.fail, self.save_fail, self.roster_fail, self.question_fail = delay, fail, False, False, False
        self.context = browser.new_context(viewport={'width': 1440, 'height': 1050}, reduced_motion='reduce')
        self.context.add_init_script('''(() => {
          localStorage.setItem('sb-token','synthetic-session'); localStorage.setItem('sb-role','admin');
          localStorage.setItem('sb-user', ''' + json.dumps(json.dumps(USER)) + ''');
          window.EventSource = class { close() {} };
        })()''')
        self.context.route('**/*', self.route)
        self.page = self.context.new_page()
        self.page.set_default_timeout(10000)
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.retake_allowed = False

    def roster(self):
        return {'students': [{'id': i, 'name': f'Synthetic Student {i:02d}', 'school_id': f'SYN-{i:03d}',
          'completed_required_count': 1, 'total_required_count': 2, 'remaining_required_count': 1,
          'recommendations_locked': True, 'batch': {'name': 'Blue cohort'},
          'assessment_results': [{'id': 27, 'title': 'Assessment 27 — Database foundations',
              'attempt_status': 'submitted', 'retake_allowed': self.retake_allowed, 'is_required': True,
              'include_in_competency': True, 'category_scores': [], 'prior_attempts': []},
              {'id': 26, 'title': 'Other assessment', 'attempt_status': 'submitted'}]}
          for i in range(1, 24)]}

    def route(self, route):
        request, parsed = route.request, urlparse(route.request.url)
        if parsed.hostname not in ('127.0.0.1', 'localhost'):
            if parsed.path == '/gsi/client':
                return route.fulfill(body=GOOGLE, content_type='application/javascript')
            return route.abort()
        path = parsed.path
        if not path.startswith('/api/'):
            return route.continue_()
        self.calls.append((request.method, path))
        if path == API and request.method == 'GET':
            if self.denied:
                return route.fulfill(status=403, json={'error': 'Synthetic access loss'})
            if self.delay:
                self.page.wait_for_timeout(self.delay)
            return route.fulfill(status=503 if self.fail else 200,
                                 json={'error': 'Synthetic assessment failure'} if self.fail else self.records)
        if request.method == 'PATCH' and path == API + '27/':
            self.patches.append(request.post_data_json)
            if self.save_fail:
                return route.fulfill(status=409, json={'error': 'Synthetic save conflict'})
            next_record = next(a for a in self.records if a['id'] == 27)
            next_record.update(request.post_data_json)
            if self.hold_save:
                self.pending_save = route
                return
            return route.fulfill(json=next_record)
        if path.endswith('/retake/'):
            self.patches.append(request.post_data_json)
            self.retake_allowed = request.post_data_json['retake_allowed']
            if self.hold_retake:
                self.pending_retake = route
                return
            return route.fulfill(json={'assessment_id': 27, 'retake_allowed': self.retake_allowed})
        if '/batches/' in path and path.endswith('/students/'):
            if self.hold_roster:
                self.pending_roster = route
                return
            return route.fulfill(status=503 if self.roster_fail else 200,
                                 json={'error': 'Synthetic roster failure'} if self.roster_fail else self.roster())
        if path.endswith('/questions/'):
            if self.hold_questions:
                self.pending_questions = route
                return
            if self.question_fail:
                return route.fulfill(status=503, json={'error': 'Synthetic key failure'})
            return route.fulfill(json={'questions': [{'id': i, 'question_text': f'Synthetic question {i}',
                'category': {'name': 'Database'}, 'question_type': 'multiple_choice',
                'choices': [{'text': 'SYNTHETIC KEY', 'is_correct': True}]} for i in range(1, 15)]})
        if path == '/api/auth/me/':
            return route.fulfill(json=USER)
        if path == '/api/admin/users/':
            return route.fulfill(json={'students': [], 'instructors': [], 'pending_instructors': []})
        return route.fulfill(json={} if path.endswith(('/stats/', '/reports/')) else [])

    def open(self):
        self.page.goto(BASE + '/admin/assessments')
        self.page.wait_for_load_state('networkidle')
        return self.page

    def refresh(self, *urls):
        self.page.evaluate('(urls) => window.dispatchEvent(new CustomEvent("sse:data_changed", {detail:{urls}}))', list(urls) or [API])

    def shot(self, name):
        self.page.screenshot(path=str(ARTIFACTS / (name + '.png')), full_page=False)

    def close(self):
        assert not self.errors, self.errors
        self.context.close()


def details(page):
    return page.locator('dialog[open]').first


def tab(page, name):
    details(page).get_by_role('tab', name=name, exact=True).click()


def geometry(page):
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Page horizontal overflow'
    if page.locator('dialog[open]').count():
        rect = details(page).bounding_box()
        assert rect['x'] >= 0 and rect['y'] >= 0
        assert rect['x'] + rect['width'] <= page.viewport_size['width'] + 1
        assert rect['y'] + rect['height'] <= page.viewport_size['height'] + 1
        assert page.evaluate('document.body.style.overflow') == 'hidden'
        assert details(page).evaluate('el => el.scrollWidth <= el.clientWidth + 1')


with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    checks = []
    fixture = Fixture(browser)
    page = fixture.open()
    expect(page.get_by_role('button', name='Card view')).to_have_attribute('aria-pressed', 'true')
    expect(page.get_by_role('article')).to_have_count(10)
    card = page.get_by_role('article').first
    assert 'View details' not in card.inner_text()
    card.click(position={'x': card.bounding_box()['width'] - 8, 'y': card.bounding_box()['height'] - 8})
    expect(details(page).get_by_role('heading', name='Assessment 27 — Database foundations')).to_be_visible()
    page.keyboard.press('Escape')
    card_button = card.get_by_role('button', name='View details for Assessment 27 — Database foundations')
    expect(card_button).to_be_focused()
    for key in ['Enter', 'Space']:
        card_button.press(key)
        expect(page.locator('dialog[open]')).to_have_count(1)
        page.keyboard.press('Escape')
        expect(card_button).to_be_focused()
    card.locator('summary').click()
    expect(card.get_by_text('Security', exact=True)).to_be_visible()
    expect(page.locator('dialog[open]')).to_have_count(0)
    card.locator('summary').press('Space')
    expect(card.get_by_text('Security', exact=True)).not_to_be_visible()
    expect(page.locator('dialog[open]')).to_have_count(0)
    checks.append('Whole-card click, native Enter/Space activation, card focus restoration, independent category disclosure and no View details text')
    expect(page.get_by_text('Showing 1–10 of 27', exact=True)).to_be_visible()
    fixture.shot('desktop-cards')
    page.get_by_role('button', name='Next →').click()
    expect(page.get_by_text('Showing 11–20 of 27', exact=True)).to_be_visible()
    page.get_by_role('button', name='List view').click()
    expect(page.locator('tbody tr')).to_have_count(10)
    expect(page.get_by_text('Showing 11–20 of 27', exact=True)).to_be_visible()
    page.get_by_role('button', name='Next →').click()
    expect(page.locator('tbody tr')).to_have_count(7)
    fixture.records = fixture.records[:11]
    fixture.refresh()
    expect(page.get_by_text('Showing 11–11 of 11', exact=True)).to_be_visible()
    fixture.records = [assessment(i) for i in range(1, 28)]
    fixture.refresh()
    expect(page.get_by_text('Showing 11–20 of 27', exact=True)).to_be_visible()
    page.get_by_role('searchbox', name='Search assessments').fill('Alex')
    expect(page.get_by_text('Showing 1–10 of 14', exact=True)).to_be_visible()
    page.get_by_label('All batches', exact=True).select_option('2')
    assert page.get_by_label('All batches', exact=True).locator('option').count() == 3
    page.get_by_role('group', name='Publication status').get_by_role('button', name=re.compile('^Published')).click()
    expect(page.locator('tbody tr')).to_have_count(5)
    page.get_by_role('button', name=re.compile('More filters')).click()
    page.get_by_label('Requirement', exact=True).select_option('required')
    page.get_by_label('Category', exact=True).select_option('Database')
    expect(page.locator('tbody tr')).to_have_count(5)
    expect(page.get_by_label('Global assessment totals').get_by_text('27', exact=True)).to_be_visible()
    page.get_by_role('button', name='Clear all', exact=True).click()
    page.get_by_role('button', name=re.compile('More filters')).click()
    fixture.shot('desktop-list')
    page.locator('summary').first.click()
    expect(page.locator('tbody').get_by_text('Security', exact=True).first).to_be_visible()
    checks.append('Both views: pagination, stable ordering, live clamping, combined filters, global counts, batch deduplication, category disclosure')

    open_button = page.get_by_role('button', name='View details for Assessment 27 — Database foundations')
    open_button.click()
    expect(details(page).get_by_role('heading', name='Assessment 27 — Database foundations')).to_be_visible()
    assert not any(path.endswith(('/students/', '/questions/')) for _, path in fixture.calls)
    page.keyboard.press('Escape')
    expect(open_button).to_be_focused()
    page.get_by_role('button', name='Card view').click()
    open_button.click()
    tab(page, 'Settings')
    title = details(page).get_by_label('Title', exact=True)
    title.fill('')
    details(page).get_by_role('button', name='Review & save').click()
    expect(details(page).get_by_text('Enter an assessment title.', exact=True)).to_be_visible()
    title.fill('Unsaved local title')
    fixture.records[-1]['title'] = 'Server title changed'
    fixture.records[-1]['completion_rate'] = 65
    fixture.refresh()
    expect(title).to_have_value('Unsaved local title')
    expect(details(page).get_by_text(re.compile('Settings changed on the server'))).to_be_visible()
    tab(page, 'Overview')
    expect(details(page).get_by_role('progressbar')).to_have_attribute('aria-valuenow', '65')
    tab(page, 'Settings')
    page.keyboard.press('Escape')
    expect(page.locator('dialog[open]')).to_have_count(2)
    page.keyboard.press('Escape')
    expect(page.locator('dialog[open]')).to_have_count(1)
    expect(title).to_have_value('Unsaved local title')
    assert page.evaluate('document.body.style.overflow') == 'hidden'
    fixture.save_fail = True
    details(page).get_by_role('button', name='Review & save').click()
    page.locator('dialog[open]').last.get_by_role('button', name='Save', exact=True).click()
    expect(details(page).get_by_text('Synthetic save conflict', exact=True)).to_be_visible()
    fixture.save_fail = False
    fixture.hold_save = True
    details(page).get_by_role('button', name='Review & save').click()
    page.locator('dialog[open]').last.get_by_role('button', name='Save', exact=True).click()
    expect(details(page).get_by_role('button', name='Saving', exact=False)).to_be_disabled()
    page.keyboard.press('Escape')
    expect(page.locator('dialog[open]')).to_have_count(1)
    fixture.pending_save.fulfill(json=fixture.records[-1])
    fixture.hold_save = False
    expect(details(page).get_by_text(re.compile('Assessment updated.'))).to_be_visible()
    expect(details(page).get_by_text('All settings saved', exact=True)).to_be_visible()
    assert fixture.patches[-1]['title'] == 'Unsaved local title'
    assert fixture.patches[-1]['duration_minutes'] == 30
    fixture.shot('modal-settings')
    checks.append('Same modal from both views; validation, dirty SSE protection/read-only refresh, nested Escape, save failure/retry and successful confirmation')

    fixture.hold_roster = True
    tab(page, 'Students & attempts')
    expect(details(page).get_by_role('status', name='Loading assessments')).to_be_visible()
    fixture.shot('modal-loading-students')
    fixture.hold_roster = False
    fixture.pending_roster.fulfill(status=503, json={'error': 'Synthetic roster failure'})
    expect(details(page).get_by_text('Could not load student attempts.', exact=True)).to_be_visible()
    fixture.roster_fail = False
    details(page).get_by_role('button', name='Retry', exact=True).click()
    expect(details(page).get_by_text('Showing 1–10 of 23', exact=True)).to_be_visible()
    details(page).get_by_role('button', name='Next →').click()
    expect(details(page).get_by_text('Showing 11–20 of 23', exact=True)).to_be_visible()
    details(page).get_by_role('searchbox', name='Search students').fill('Student 01')
    details(page).get_by_role('button', name=re.compile('Synthetic Student 01')).click()
    details(page).get_by_role('tab', name=re.compile('^Assessments')).click()
    expect(details(page).get_by_role('heading', name='Other assessment', exact=True)).to_be_visible()
    expect(details(page).get_by_role('button', name=re.compile('^Approve retake for'))).to_have_count(1)
    details(page).get_by_role('button', name=re.compile('^Approve retake for')).click()
    fixture.hold_retake = True
    page.locator('dialog[open]').last.get_by_role('button', name='Approve retake', exact=True).click()
    expect(details(page).get_by_text('Updating retake approval', exact=False)).to_be_visible()
    fixture.pending_retake.fulfill(json={'assessment_id': 27, 'retake_allowed': True})
    fixture.hold_retake = False
    expect(details(page).get_by_text('Assessment-specific retake updated.', exact=True)).to_be_visible()
    assert fixture.patches[-1] == {'assessment_id': 27, 'retake_allowed': True}
    expect(details(page).get_by_role('button', name=re.compile('^Revoke retake for'))).to_be_visible()
    fixture.shot('modal-students')
    tab(page, 'Questions')
    assert not any(path.endswith('/questions/') for _, path in fixture.calls)
    fixture.hold_questions = True
    details(page).get_by_role('button', name='View authorized answer key', exact=True).click()
    expect(details(page).get_by_role('status', name='Loading assessments')).to_be_visible()
    fixture.shot('modal-loading-questions')
    fixture.hold_questions = False
    fixture.pending_questions.fulfill(status=503, json={'error': 'Synthetic key failure'})
    expect(details(page).get_by_text('Could not load the authorized answer key.', exact=True)).to_be_visible()
    fixture.question_fail = False
    details(page).get_by_role('button', name='Retry', exact=True).click()
    expect(details(page).get_by_text('Showing 1–10 of 14', exact=True)).to_be_visible()
    expect(details(page).get_by_text('Key: SYNTHETIC KEY', exact=True)).to_have_count(10)
    details(page).get_by_role('button', name='Next →').click()
    expect(details(page).get_by_text('Showing 11–14 of 14', exact=True)).to_be_visible()
    details(page).get_by_role('button', name='Hide answer key', exact=True).click()
    expect(details(page).get_by_text('Key: SYNTHETIC KEY', exact=True)).to_have_count(0)
    checks.append('Lazy roster/key loading, bounded student/question lists, retry states, exact assessment retake and refreshed attempt approval')

    page.wait_for_timeout(4100)  # Let expected failure toasts expire before visual captures.
    for width in [375, 768, 1440]:
        for dark in [False, True]:
            page.set_viewport_size({'width': width, 'height': 900})
            page.evaluate('(dark) => document.documentElement.classList.toggle("dark", dark)', dark)
            for name in ['Overview', 'Settings', 'Students & attempts', 'Questions']:
                tab(page, name)
                geometry(page)
            if width == 375:
                tab(page, 'Overview')
                fixture.shot('mobile-modal-' + ('dark' if dark else 'light'))
    tab(page, 'Overview')
    details(page).get_by_role('tab', name='Overview', exact=True).focus()
    page.keyboard.press('ArrowRight')
    expect(details(page).get_by_role('tab', name='Settings', exact=True)).to_be_focused()
    for _ in range(30):
        page.keyboard.press('Tab')
        assert details(page).evaluate('el => el.contains(document.activeElement)')
    page.keyboard.press('Escape')
    expect(page.locator('dialog[open]')).to_have_count(0)
    assert page.evaluate('document.body.style.overflow') == ''
    for width in [375, 768, 1440]:
        page.set_viewport_size({'width': width, 'height': 900})
        for view in ['Card view', 'List view']:
            page.get_by_role('button', name=view, exact=True).click()
            geometry(page)
            if width == 375:
                for title in ['All instructors', 'All batches']:
                    assert page.get_by_label(title, exact=True).bounding_box()['width'] >= 130
            if width in [375, 1440]:
                fixture.shot(f'{width}-{view.lower().replace(" ", "-")}-dark')
    checks.append('Mobile/tablet/desktop and dark layouts, table-contained scrolling, roving tabs, focus trap/restoration, Escape and scroll lock')
    page.set_viewport_size({'width': 1440, 'height': 900})
    page.get_by_role('button', name='View details for Unsaved local title').click()
    tab(page, 'Settings')
    details(page).get_by_label('Title', exact=True).fill('Draft to discard')
    details(page).get_by_role('button', name='Close assessment details').click()
    page.locator('dialog[open]').last.get_by_role('button', name='Discard changes').click()
    expect(page.locator('dialog[open]')).to_have_count(0)
    page.get_by_role('button', name='View details for Unsaved local title').click()
    fixture.records = fixture.records[:-1]
    fixture.refresh()
    expect(details(page).get_by_role('heading', name='Assessment unavailable')).to_be_visible()
    expect(details(page).get_by_role('tab')).to_have_count(0)
    details(page).get_by_role('button', name='Close details', exact=True).click()
    page.get_by_role('searchbox', name='Search assessments').fill('No such assessment')
    expect(page.get_by_role('heading', name='No matching assessments')).to_be_visible()
    assert '1–0' not in page.inner_text('body')
    fixture.close()
    checks.append('Discard confirmation, deletion while open, distinct no-match state and valid zero-result range')

    fixture = Fixture(browser)
    page = fixture.open()
    page.get_by_role('button', name='View details for Assessment 27 — Database foundations').click()
    tab(page, 'Settings')
    details(page).get_by_label('Title', exact=True).fill('Unsaved before access loss')
    fixture.denied = True
    fixture.refresh()
    expect(details(page).get_by_role('heading', name='Assessment unavailable')).to_be_visible()
    expect(details(page).get_by_role('tab')).to_have_count(0)
    assert page.get_by_label('Global assessment totals').count() == 0
    fixture.close()
    checks.append('Definitive 403 access loss removes cached assessment details and editing controls, even with a dirty draft')

    for fail, empty in [(True, False), (False, True)]:
        fixture = Fixture(browser, fail=fail, empty=empty)
        page = fixture.open()
        if fail:
            expect(page.get_by_text('Server is unavailable. Check your connection.', exact=True).first).to_be_visible()
            fixture.fail = False
            page.get_by_role('button', name='Retry', exact=True).click()
            expect(page.get_by_role('article')).to_have_count(10)
            fixture.fail = True
            fixture.refresh()
            expect(page.get_by_text('Could not refresh. Showing the last loaded assessments.', exact=True)).to_be_visible()
            expect(page.get_by_role('article')).to_have_count(10)
        else:
            expect(page.get_by_role('heading', name='No assessments yet')).to_be_visible()
        fixture.close()
    fixture = Fixture(browser, delay=1500)
    page = fixture.page
    page.goto(BASE + '/admin/assessments', wait_until='domcontentloaded')
    expect(page.get_by_role('status', name='Loading assessments').first).to_be_visible()
    assert page.get_by_label('Global assessment totals').count() == 0
    fixture.shot('loading-cards')
    page.get_by_role('button', name='List view').click()
    expect(page.get_by_role('status', name='Loading assessments').last).to_be_visible()
    fixture.shot('loading-list')
    expect(page.locator('tbody tr')).to_have_count(10)
    fixture.close()
    checks.append('Initial layout skeletons in both views, no false zero stats, initial failure/retry, last-good content on background errors and empty collection')
    browser.close()
    print(json.dumps({'checks': checks, 'screenshots': str(ARTIFACTS)}, indent=2))
