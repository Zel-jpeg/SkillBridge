"""Synthetic staff/student assessment card checks; no backend or external calls.

Run against a local production preview using SKILLBRIDGE_TEST_BASE.
"""
import json
import os
import re
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get('SKILLBRIDGE_TEST_BASE', 'http://127.0.0.1:5192')
OUT = Path(__file__).parent / 'artifacts/assessment-cards-layout'
OUT.mkdir(parents=True, exist_ok=True)
STAFF_URL = '/api/instructor/assessments/'
TITLES = ['Tech Support', 'Cybersecurity', 'Networking', 'Web Development', 'Database Management', 'Programming']


def staff_record(i):
    return dict(id=i, title=TITLES[(i - 1) % 6], batch_id=1, batch_name='Batch 2026-2027',
        instructor_name='Alex Rivera', duration_minutes=60, question_count=10,
        publication_status='published', is_required=True, include_in_competency=True,
        display_order=i, availability_status='available', available_at='2026-10-30T01:00:00Z',
        due_at='2026-11-06T01:00:00Z', categories=[TITLES[(i - 1) % 6]],
        assigned_count=10, submission_count=4, completion_count=3, completion_rate=30,
        flagged_count=0, created_at=f'2026-10-{i:02}T00:00:00Z')


def student_record(i, **changes):
    return {**staff_record(i), 'title': f'Assessment {i}', 'action': 'start',
        'attempt_status': 'not_started', 'categories': ['Private topic must stay hidden'], **changes}


class Fixture:
    def __init__(self, browser, role, hold=False):
        self.role = role
        self.url = '/api/assessments/' if role == 'student' else STAFF_URL
        self.records = [student_record(i) for i in range(1, 7)] if role == 'student' else [staff_record(i) for i in range(1, 14)]
        self.user = dict(id=1, name='Synthetic Staff' if role != 'student' else 'Synthetic Student', role=role,
            is_approved=True, profile_completed=True, course='BSIT', school_id='SYNTHETIC',
            batch={'id': 1, 'name': 'Batch 2026-2027'}, has_previous_batches=False)
        self.hold, self.pending, self.errors, self.writes = hold, [], [], []
        self.context = browser.new_context(viewport={'width': 1440, 'height': 1100}, reduced_motion='reduce')
        self.context.add_init_script('for (const [k,v] of Object.entries(' + json.dumps({
            'sb-token': 'synthetic', 'sb-role': role, 'sb-user': json.dumps(self.user), 'sb-theme': 'light',
        }) + ')) localStorage.setItem(k,v)')
        self.context.route('**/*', self.route)
        self.page = self.context.new_page()
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.goto(BASE + f'/{role}/assessments', wait_until='domcontentloaded' if hold else 'networkidle')

    def envelope(self):
        return self.records if self.role != 'student' else dict(assessments=self.records,
            batch=self.user['batch'], total_required_count=6, completed_required_count=0,
            remaining_required_count=6, all_required_completed=False)

    def route(self, route):
        url = urlparse(route.request.url)
        if url.path.startswith('/api/'):
            if route.request.method not in ('GET', 'OPTIONS'):
                self.writes.append(url.path)
                return route.abort()
            if url.path.endswith('/events/'):
                return route.fulfill(status=204)
            if url.path in ('/api/auth/me/', '/api/students/me/'):
                return route.fulfill(json=self.user)
            if url.path == self.url:
                if self.hold:
                    self.pending.append(route)
                    return
                return route.fulfill(json=self.envelope())
            if url.path == '/api/instructor/batches/':
                return route.fulfill(json=[dict(id=1, name='Batch 2026-2027', status='active')])
            if url.path == '/api/management/analytics/':
                return route.fulfill(json=dict(role=self.role, generated_at='2026-10-30T00:00:00Z', scope={},
                    summary={key: 0 for key in ('students', 'required_complete', 'approved', 'unplaced', 'awaiting_review', 'needs_followup', 'slots_remaining')},
                    options={key: [] for key in ('batches', 'instructors', 'courses', 'assessments', 'companies', 'positions', 'areas')},
                    **{key: [] for key in ('students', 'placement_students', 'assessments', 'batches', 'skills', 'capacity', 'match_bands', 'companies', 'areas', 'geography', 'activity')}))
            if url.path.endswith('/questions/'):
                return route.fulfill(json={'questions': []})
            return route.fulfill(json=[])
        return route.continue_() if url.hostname in ('127.0.0.1', 'localhost') else route.abort()

    def refresh(self):
        self.page.evaluate('url => window.dispatchEvent(new CustomEvent("sse:data_changed", {detail: {urls: [url]}}))', self.url)

    def close(self):
        assert not self.errors, self.errors
        assert not self.writes, self.writes
        self.context.close()


def layout(page, cards, columns):
    assert cards.count() == 6
    boxes = [card.bounding_box() for card in cards.all()]
    assert sum(abs(box['y'] - boxes[0]['y']) < 2 for box in boxes) == columns
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), page.evaluate('''() => [...document.querySelectorAll("main *")].filter(n => n.getBoundingClientRect().right > innerWidth + 1).map(n => ({tag:n.tagName, cls:n.className, text:n.textContent.slice(0,80)})).slice(-12)''')
    for card in cards.all():
        assert card.evaluate('n => n.scrollWidth <= n.clientWidth + 1'), 'Card overflow'


checks = []
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    try:
        for role in ('instructor', 'admin'):
            f = Fixture(browser, role)
            page = f.page
            cards = page.locator('.ac-card')
            expect(cards).to_have_count(6)
            expect(page.get_by_text('Showing 1–6 of 13', exact=True)).to_be_visible()
            layout(page, cards, 3)
            assert max(card.bounding_box()['height'] for card in cards.all()) < 385
            expect(cards.first.locator('.ac-schedule')).to_contain_text('Opens Oct 30, 2026')
            expect(cards.first.locator('.ac-schedule')).to_contain_text('Due Nov 6, 2026')
            if role == 'admin':
                expect(cards.first.get_by_role('progressbar')).to_have_attribute('aria-valuenow', '30')
                expect(cards.first.get_by_text('3 completed', exact=True)).to_be_visible()
                expect(cards.first.locator('.ac-metrics dd').last).to_contain_text('4')
            for width, height, columns in ((320, 568, 1), (390, 844, 1), (768, 1024, 2), (1024, 600, 2), (1280, 900, 3), (1440, 1100, 3), (1920, 1080, 3)):
                page.set_viewport_size({'width': width, 'height': height})
                for dark in (False, True):
                    page.evaluate('v => document.documentElement.classList.toggle("dark", v)', dark)
                    layout(page, cards, columns)
                    page.screenshot(path=str(OUT / f'{role}-{width}-{"dark" if dark else "light"}.png'), full_page=True)
            page.set_viewport_size({'width': 1440, 'height': 1100})
            page.get_by_role('button', name='Next →', exact=True).click()
            names = cards.locator('h2').all_text_contents()
            page.get_by_role('button', name='List view', exact=True).click()
            rows = page.locator('tbody tr')
            expect(rows).to_have_count(6)
            assert rows.locator('td:first-child button').all_text_contents() == names
            expect(page.get_by_text('Showing 7–12 of 13', exact=True)).to_be_visible()
            page.get_by_role('searchbox', name='Search assessments', exact=True).fill('Programming')
            expect(rows).to_have_count(2)
            expect(page.get_by_text('6 per page', exact=True)).to_be_visible()
            page.get_by_role('button', name='Clear filters', exact=True).click()
            expect(page.get_by_text('Showing 1–6 of 13', exact=True)).to_be_visible()
            page.get_by_role('button', name='Next →', exact=True).click()
            f.records = f.records[:7]
            f.refresh()
            expect(rows).to_have_count(1)
            expect(page.get_by_text('Showing 7–7 of 7', exact=True)).to_be_visible()
            f.records = f.records[:6]
            f.refresh()
            expect(rows).to_have_count(6)
            expect(page.get_by_role('button', name='Next →', exact=True)).to_have_count(0)
            expect(page.get_by_text('6 per page', exact=True)).to_be_visible()
            page.get_by_role('button', name='Card view', exact=True).click()
            f.records[0].update(title='Long title ' + 'Assessment' * 20, instructor_name='Instructor' * 20,
                categories=['Category' * 30, 'Networking', 'Database', 'Cloud', 'Support'])
            f.refresh()
            expect(cards.get_by_role('button', name='Show 2 more categories', exact=True)).to_have_count(1)
            page.set_viewport_size({'width': 320, 'height': 568})
            cards.get_by_role('button', name='Show 2 more categories', exact=True).click()
            expect(page.get_by_role('dialog')).to_have_count(0)
            layout(page, cards, 1)
            cards.get_by_role('button', name='Show fewer categories', exact=True).click()
            checks.append(f'{role}: compact 3/2/1-column cards, distinct metrics, six-row list, six/seven boundary, view/page preservation and filter/clamp behavior')
            f.close()
        f = Fixture(browser, 'student')
        page, cards = f.page, f.page.locator('.sac-card')
        expect(cards.locator('h2')).to_have_text([f'Assessment {i}' for i in range(1, 7)])
        expect(page.get_by_text('Private topic must stay hidden', exact=True)).to_have_count(0)
        expect(page.get_by_role('button', name='Start Assessment', exact=True)).to_have_count(6)
        for width, height, columns in ((320, 568, 1), (390, 844, 1), (768, 1024, 2), (1024, 600, 2), (1280, 900, 3), (1440, 1100, 3), (1920, 1080, 3)):
            page.set_viewport_size({'width': width, 'height': height})
            for dark in (False, True):
                page.evaluate('v => document.documentElement.classList.toggle("dark", v)', dark)
                layout(page, cards, columns)
                expect(cards.first.get_by_text('60 minutes', exact=True)).to_be_visible()
                expect(cards.first.get_by_text('10 questions', exact=True)).to_be_visible()
                button = cards.first.get_by_role('button')
                page.mouse.move(0, 0)
                original = button.evaluate('n => getComputedStyle(n).backgroundColor')
                button.hover()
                expect(button).not_to_have_css('background-color', original)
                page.keyboard.press('Tab')
                button.focus()
                expect(button).to_have_css('outline-style', 'solid')
                page.screenshot(path=str(OUT / f'student-{width}-{"dark" if dark else "light"}.png'), full_page=True)
        f.records = [
            student_record(1, action='continue', attempt_status='in_progress'),
            student_record(2, action='view_result', attempt_status='submitted', submitted_at='2026-10-30T01:00:00Z'),
            student_record(3, action='awaiting_retake', attempt_status='stopped', is_flagged=True, can_request_retake=True, submitted_at='2026-10-30T01:00:00Z', stopped_reason_display='Synthetic interruption'),
            student_record(4, action='start', retake_allowed=True, retake_request={'status': 'approved'}),
            student_record(5, action='start', availability_status='upcoming', is_required=False, include_in_competency=False),
            student_record(6, action='start', availability_status='overdue'),
        ]
        f.refresh()
        expect(cards.nth(0).get_by_role('button', name='Continue Assessment', exact=True)).to_be_enabled()
        expect(cards.nth(1).get_by_role('button', name='View Score', exact=True)).to_be_enabled()
        expect(cards.nth(2).get_by_role('button', name='View Recorded Attempt', exact=True)).to_be_enabled()
        expect(cards.nth(2).get_by_role('button', name='Request retake', exact=True)).to_be_enabled()
        expect(cards.nth(2).get_by_text('Synthetic interruption', exact=True)).to_be_visible()
        expect(cards.nth(3).get_by_role('button', name='Retake Assessment', exact=True)).to_be_enabled()
        expect(cards.nth(3).get_by_role('button', name='View retake request', exact=True)).to_be_enabled()
        expect(cards.nth(3)).to_contain_text('Your earlier attempt remains on record.')
        for index in (4, 5):
            expect(cards.nth(index).get_by_role('button', name='Unavailable', exact=True)).to_be_disabled()
        expect(cards.nth(4)).to_contain_text('Not included in your final skill profile')
        expect(cards.nth(4)).to_contain_text('Optional work does not block final results.')
        page.set_viewport_size({'width': 320, 'height': 568})
        layout(page, cards, 1)
        page.screenshot(path=str(OUT / 'student-mixed-states-phone.png'), full_page=True)
        checks.append('student: anonymous 3/2/1-column cards, hover/focus, exact start/continue/score/recorded/retake/disabled actions and explanatory states')
        f.close()
        for role in ('instructor', 'admin', 'student'):
            f = Fixture(browser, role, hold=True)
            skeleton = f.page.locator('.sk-collection-assessment')
            expect(skeleton).to_be_visible()
            expect(skeleton.locator('.sk-card')).to_have_count(6)
            assert skeleton.evaluate('n => getComputedStyle(n).gridTemplateColumns.split(" ").length') == 3
            f.hold = False
            for route in f.pending:
                route.fulfill(json=f.envelope())
            expect(f.page.locator('.sac-card' if role == 'student' else '.ac-card')).to_have_count(6)
            f.close()
        checks.append('all roles: six-card loading placeholders in three desktop columns, then real content')
        (OUT / 'results.json').write_text(json.dumps({'checks': checks, 'page_errors': []}, indent=2), encoding='utf-8')
        for check in checks:
            print('PASS: ' + check, flush=True)
    finally:
        browser.close()
