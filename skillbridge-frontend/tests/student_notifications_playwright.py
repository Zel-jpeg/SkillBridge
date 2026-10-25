"""Student reminder checks with synthetic own-account payloads; block all API writes."""
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
sys.path.insert(0, str(Path(__file__).parent / '.runtime'))
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:5199'
ARTIFACTS = Path(__file__).parent / 'artifacts' / 'student-notifications'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
NOW = datetime(2026, 10, 25, 1, tzinfo=timezone.utc)
checks = []


class Fixture:
    def __init__(self, browser, mode='normal'):
        self.mode, self.errors, self.writes, self.calls = mode, [], [], {}
        self.profile = {'id': 1, 'role': 'student', 'name': 'QA Student', 'email': 'student@example.invalid',
            'school_id': 'QA-001', 'course': 'BSIT', 'is_approved': True, 'profile_completed': True,
            'batch': {'id': 1, 'name': 'QA Batch'}, 'recommendations_locked': True, 'all_required_completed': False,
            'completed_required_count': 1, 'total_required_count': 10, 'remaining_required_count': 9,
            'address': {}, 'placement': {'id': 5, 'status': 'approved', 'company': {'id': 1, 'name': 'Sample Institution'},
                'position': {'id': 1, 'title': 'IT Intern'}, 'approved_at': '2026-10-24T01:00:00Z'}}
        def row(index, title, hours, **overrides):
            due = None if hours is None else datetime.fromtimestamp(NOW.timestamp() + hours * 3600, timezone.utc).isoformat()
            return {'id': index, 'title': title, 'due_at': due, 'publication_status': 'published', 'availability_status': 'available',
                'is_required': True, 'include_in_competency': True, 'categories': [], 'duration_minutes': 60, 'question_count': 10,
                'attempt_status': None, 'retake_allowed': False, 'action': 'start', **overrides}
        self.rows = [row(1, 'Day Three Assessment', 72), row(2, 'Day Two Assessment', 48),
            row(3, 'Day One Assessment', 24), row(4, 'Today Assessment', 8),
            row(5, 'COMPLETED_SENTINEL', 8, attempt_status='submitted'),
            row(6, 'Approved Retake Assessment', 168, attempt_status='stopped', is_flagged=True, retake_allowed=True),
            row(7, 'Review Assessment', 48, attempt_status='stopped', is_flagged=True),
            row(8, 'Scheduled Retake Assessment', 168, retake_allowed=True, availability_status='upcoming'),
            row(9, 'CLOSED_SENTINEL', -5, publication_status='closed', availability_status='closed'),
            row(10, 'NO_DATE_SENTINEL', None), row(11, 'Overdue Assessment', -2, availability_status='overdue'),
            row(12, 'FAR_SENTINEL', 96), row(13, 'DRAFT_SENTINEL', 24, publication_status='draft')]
        if mode == 'empty':
            self.rows, self.profile['placement'] = [], None
        if mode == 'unenrolled':
            self.profile['batch'], self.profile['placement'] = None, None
        self.context = browser.new_context(viewport={'width': 1366, 'height': 1000}, reduced_motion='reduce')
        self.context.add_init_script("localStorage.setItem('sb-token','synthetic-only');localStorage.setItem('sb-role','student');localStorage.setItem('sb-user'," + json.dumps(json.dumps(self.profile)) + ");window.EventSource=class {close(){}};")
        self.context.route('**/*', self.route)
        self.page = self.context.new_page()
        self.page.set_default_timeout(10000)
        self.page.set_default_navigation_timeout(30000)
        self.page.clock.install(time=NOW)
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))

    def route(self, route):
        parsed = urlparse(route.request.url)
        if parsed.hostname not in ['127.0.0.1', 'localhost']:
            return route.abort()
        path = parsed.path
        if not path.startswith('/api/'):
            return route.continue_()
        self.calls[path] = self.calls.get(path, 0) + 1
        if route.request.method != 'GET':
            self.writes.append(path)
            return route.fulfill(status=405, json={'error': 'No writes in reminder checks'})
        if path == '/api/students/me/':
            if self.mode == 'failure':
                return route.fulfill(status=503, json={'error': 'Synthetic unavailable'})
            return route.fulfill(json=self.profile)
        if path == '/api/auth/me/':
            return route.fulfill(json=self.profile)
        if path == '/api/assessments/':
            return route.fulfill(json={'batch': self.profile['batch'], 'assessments': self.rows,
                'completed_required_count': 1, 'total_required_count': 10, 'remaining_required_count': 9})
        if path == '/api/student/results/combined/':
            return route.fulfill(json={'recommendations_locked': True, 'combined_category_scores': [], 'recommendations': [], 'placement': self.profile['placement']})
        return route.fulfill(json=[])

    def open(self, width=1366, height=1000, dark=False, path='/student/assessments'):
        self.page.set_viewport_size({'width': width, 'height': height})
        self.page.goto(BASE + path)
        self.page.wait_for_load_state('networkidle')
        self.page.evaluate('(dark) => document.documentElement.classList.toggle("dark", dark)', dark)
        bell = self.page.get_by_role('button', name=re.compile('^Open notifications'))
        expect(bell).to_be_visible()
        bell.click()
        panel = self.page.get_by_role('region', name='Notifications', exact=True)
        expect(panel).to_be_visible()
        return self.page, panel, bell

    def refresh(self, url):
        self.page.evaluate('async url => { const {invalidateCache}=await import("/src/hooks/useApi.js"); invalidateCache(url) }', url)

    def close(self):
        assert not self.errors, self.errors
        assert not self.writes, self.writes
        assert not self.calls.get('/api/management/analytics/'), 'Student must not request staff analytics'
        self.context.close()


with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    fixture = Fixture(browser)
    for width, height in [(320, 568), (375, 812), (768, 1024), (1024, 768), (1366, 1000), (812, 375)]:
        for dark in [False, True]:
            print(f'Checking student reminders {width}x{height} {dark=}', flush=True)
            page, panel, bell = fixture.open(width, height, dark)
            expect(panel.get_by_role('link')).to_have_count(9)
            for days in [3, 2, 1]:
                expect(panel.get_by_role('link', name=re.compile(f'^Assessment due in {days} day'))).to_have_count(1)
            expect(panel.get_by_role('link', name=re.compile('^Assessment due today'))).to_have_count(1)
            expect(panel.get_by_role('link').filter(has_text='Approved Retake Assessment')).to_have_attribute('href', '/student/assessments/6/take')
            expect(panel.get_by_role('link').filter(has_text='Scheduled Retake Assessment')).to_have_attribute('href', '/student/assessments')
            expect(panel.get_by_role('link').filter(has_text='Sample Institution')).to_have_attribute('href', '/student/results')
            assert 'SENTINEL' not in panel.inner_text()
            assert '(Manila)' in panel.inner_text()
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            rect = panel.bounding_box()
            assert rect['x'] >= 0 and rect['y'] >= 0 and rect['x'] + rect['width'] <= width + 1
            assert rect['y'] + rect['height'] <= height + 1
            assert panel.evaluate('el => el.scrollWidth <= el.clientWidth + 1')
            if width in [375, 1366]:
                page.screenshot(path=str(ARTIFACTS / f'student-{width}-{"dark" if dark else "light"}.png'))
            page.keyboard.press('Escape')
            expect(panel).to_have_count(0)
            expect(bell).to_be_focused()
            checks.append(f'{width}x{height} {dark=}: own reminders, deadline windows, retake links, placement, geometry and Escape')
    fixture.close()

    fixture = Fixture(browser)
    page, panel, bell = fixture.open()
    assert fixture.calls['/api/students/me/'] == 1
    assert fixture.calls['/api/assessments/'] == 1
    day_three = panel.get_by_role('link').filter(has_text='Day Three Assessment')
    page.clock.fast_forward(86_400_000)
    expect(day_three).to_contain_text('Assessment due in 2 days')
    fixture.rows[0]['attempt_status'] = 'submitted'
    fixture.rows[5]['retake_allowed'] = False
    fixture.refresh('/api/assessments/')
    expect(day_three).to_have_count(0)
    expect(panel.get_by_role('link').filter(has_text='Approved Retake Assessment')).to_contain_text('Assessment needs review')
    fixture.profile['placement'] = None
    fixture.refresh('/api/students/me/')
    expect(panel.get_by_role('link').filter(has_text='Sample Institution')).to_have_count(0)
    fixture.profile['placement'] = {'id': 6, 'status': 'approved', 'company': {'name': 'New Sample Company'}, 'position': {'title': 'Web Intern'}}
    fixture.refresh('/api/students/me/')
    updated = panel.get_by_role('link').filter(has_text='New Sample Company')
    expect(updated).to_be_visible()
    updated.click()
    expect(page).to_have_url(BASE + '/student/results')
    expect(panel).to_have_count(0)
    fixture.close()
    checks.append('Display clock advances 3 to 2 days; submission, revoked retake, placement removal/replacement and actual placement navigation update through shared queries')

    fixture = Fixture(browser)
    fixture.page.goto(BASE + '/student/assessments/6/take')
    fixture.page.wait_for_load_state('networkidle')
    expect(fixture.page.get_by_role('button', name=re.compile('^Open notifications'))).to_have_count(0)
    expect(fixture.page.locator('.sb-focused-brand')).to_be_visible()
    fixture.close()
    checks.append('Assessment-taking route has no notification bell and no automatic start/write')

    for mode in ['empty', 'unenrolled', 'failure']:
        fixture = Fixture(browser, mode)
        page, panel, bell = fixture.open(path='/student/profile')
        if mode == 'failure':
            expect(panel.get_by_text('Reminders are unavailable.', exact=True)).to_be_visible()
            expect(panel.get_by_text("You're all caught up", exact=True)).to_have_count(0)
            fixture.mode = 'empty'
            fixture.rows, fixture.profile['placement'] = [], None
            panel.get_by_role('button', name='Retry reminders').click()
            expect(panel.get_by_text("You're all caught up", exact=True)).to_be_visible()
        else:
            expect(panel.get_by_text("You're all caught up", exact=True)).to_be_visible()
        if mode == 'unenrolled':
            assert not fixture.calls.get('/api/assessments/'), 'No assessment read before an active enrollment exists'
        fixture.close()
        checks.append(f'{mode}: truthful state, role isolation and retry/enrollment behavior')
    browser.close()

(ARTIFACTS / 'results.json').write_text(json.dumps({'checks': checks}, indent=2), encoding='utf-8')
print(json.dumps({'passed_groups': len(checks), 'artifacts': str(ARTIFACTS.resolve())}, indent=2), flush=True)
