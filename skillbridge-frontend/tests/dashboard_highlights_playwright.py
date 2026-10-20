"""Synthetic dashboard UI checks; all API requests intercepted, no database writes.

Start Vite on 127.0.0.1:5197, or set DASHBOARD_TEST_URL to its local origin.
"""
import json
import os
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('DASHBOARD_TEST_URL', 'http://127.0.0.1:5197')
ARTIFACTS = Path(__file__).resolve().parents[2] / 'work/dashboard-ui'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
checks = []


def student(i):
    locked = i > 10
    scores = [{'category': cat, 'percentage': score, 'raw_score': score, 'max_score': 100}
              for cat, score in [('Database', 90 - i), ('Networking', 80 - i),
                                ('Programming', 70 - i), ('Web', 100 if i == 1 else 70 - i),
                                ('Information Security and Administration', 60 - i), ('Zero score', 0)]]
    return {'id': i, 'student_name': f'Synthetic Student {i:02d}', 'email': f'synthetic{i}@example.invalid',
            'school_id': f'SYN-{i:03d}', 'course': 'BSIT', 'instructor_name': 'Synthetic Instructor',
            'has_submitted': not locked, 'recommendations_locked': locked,
            'all_required_completed': not locked, 'completed_required_count': 0 if locked else 1,
            'total_required_count': 1, 'remaining_required_count': 1 if locked else 0,
            'combined_category_scores': [] if locked else scores,
            'combined_competency_profile': None if locked else {'orientation_label': 'Web', 'orientation_summary': 'Synthetic final evidence.'},
            'top_recommendations': [] if locked else [{'company': 'Synthetic Agency', 'position': 'Developer Intern', 'match_score': 90 - i}],
            'assessment_results': [{'id': 1, 'title': 'Synthetic Assessment', 'attempt_status': None if locked else 'submitted',
                                    'is_required': True, 'include_in_competency': True, 'category_scores': [] if locked else scores,
                                    'prior_attempts': [], 'is_flagged': False}]}


class Fixture:
    def __init__(self, browser, role, mode='normal'):
        self.role, self.mode = role, mode
        self.rows = [student(i) for i in range(1, 14)]
        self.errors, self.mutations = [], []
        self.context = browser.new_context(viewport={'width': 1366, 'height': 1000}, reduced_motion='reduce')
        user = {'id': 99, 'role': role, 'name': 'Synthetic Staff', 'is_approved': True}
        self.context.add_init_script('''localStorage.setItem('sb-token','synthetic-only');
          localStorage.setItem('sb-role', ''' + json.dumps(role) + ''');
          localStorage.setItem('sb-user', ''' + json.dumps(json.dumps(user)) + ''');
          window.EventSource=class { close() {} };''')
        self.user = user
        self.context.route('**/*', self.route)
        self.page = self.context.new_page()
        self.page.set_default_timeout(10000)
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))

    def route(self, route):
        parsed = urlparse(route.request.url)
        if parsed.hostname not in ('localhost', '127.0.0.1'):
            if parsed.path == '/gsi/client':
                return route.fulfill(body='window.google={accounts:{oauth2:{initTokenClient(){return {requestAccessToken(){}}}}}};', content_type='application/javascript')
            return route.abort()
        path = parsed.path
        if not path.startswith('/api/'):
            return route.continue_()
        if route.request.method != 'GET':
            self.mutations.append(path)
            return route.fulfill(status=405, json={'error': 'No mutations in dashboard checks'})
        if path == '/api/auth/me/':
            return route.fulfill(json=self.user)
        if path == '/api/management/analytics/':
            if self.mode == 'stats_failure':
                return route.fulfill(status=503, json={'error': 'Synthetic unavailable summary'})
            empty = self.mode == 'empty'
            summary = {'students': 0 if empty else 13, 'required_complete': 0 if empty else 10,
                'completion_rate': None if empty else 76.9, 'approved': 0 if empty else 5,
                'approved_other_batch': 0, 'unplaced': 0 if empty else 8,
                'awaiting_review': 0 if empty else 5, 'needs_followup': 0 if empty else 1,
                'slots_remaining': 0 if empty else 20, 'slots_total': 25, 'pending_instructors': 0}
            rows = [] if empty else [{'id': row['id'], 'name': row['student_name'], 'batch_id': 1,
                'reasons': ['Stopped / flagged'] if row['id'] == 2 else [], 'scores': {}, 'attempt_states': {}}
                for row in self.rows]
            return route.fulfill(json={'role': self.role, 'generated_at': '2026-10-20T08:00:00Z',
                'summary': summary, 'scope': {}, 'students': rows, 'placement_students': [],
                **{key: [] for key in ['assessments', 'batches', 'skills', 'capacity', 'match_bands', 'companies', 'areas', 'geography', 'activity']},
                'options': {key: [] for key in ['batches', 'instructors', 'courses', 'assessments', 'companies', 'positions', 'areas']}})
        if path.endswith('/students/recommendations/'):
            if self.mode == 'failure':
                return route.fulfill(status=503, json={'error': 'Synthetic unavailable dashboard'})
            rows = [] if self.mode == 'empty' else self.rows
            if self.role == 'instructor':
                rows = [{**row, 'batch': {'id': 1, 'name': 'Synthetic Cohort'}, 'placement': {'status': 'approved' if row['id'] <= 5 else 'unplaced'}} for row in rows]
                if rows:
                    # Multiple stopped/flagged attempts still count as one student.
                    rows[1]['assessment_results'] = [*rows[1]['assessment_results'],
                        {'id': 2, 'title': 'Synthetic optional review', 'attempt_status': 'stopped'},
                        {'id': 3, 'title': 'Synthetic optional flag', 'is_flagged': True}]
                if self.mode == 'complete_locked':
                    rows[0] = {**rows[0], 'has_submitted': False, 'recommendations_locked': True,
                        'combined_category_scores': [], 'top_recommendations': []}
            return route.fulfill(json=rows)
        if path == '/api/admin/users/':
            return route.fulfill(json={'students': [], 'instructors': [], 'pending_instructors': []})
        return route.fulfill(json={} if path.endswith(('/stats/', '/reports/')) else [])

    def open(self):
        self.page.goto(f'{BASE}/{self.role}/dashboard')
        self.page.wait_for_load_state('networkidle')
        return self.page

    def close(self):
        assert not self.errors, self.errors
        assert not self.mutations, self.mutations
        self.context.close()


def dialog(page):
    return page.locator('dialog[open]')


def geometry(page):
    if page.evaluate('document.documentElement.scrollWidth > innerWidth'):
        page.screenshot(path=str(ARTIFACTS / 'overflow.png'))
        print(page.evaluate('''() => ({width: innerWidth, scroll: document.documentElement.scrollWidth,
          elements: [...document.querySelectorAll('main *, section *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 15).map(el => ({tag:el.tagName, cls:el.className, right:el.getBoundingClientRect().right, text:el.textContent.slice(0,80)}))})'''), flush=True)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Page horizontal overflow'
    if dialog(page).count():
        bounds = dialog(page).bounding_box()
        assert bounds['x'] >= 0 and bounds['y'] >= 0
        assert bounds['x'] + bounds['width'] <= page.viewport_size['width'] + 1
        assert dialog(page).evaluate('el => el.scrollWidth <= el.clientWidth + 1')


with sync_playwright() as p:
    print('Launching synthetic dashboard browser checks', flush=True)
    browser = p.chromium.launch(channel='chrome', headless=True)
    for role in ['admin', 'instructor']:
        print(f'Checking {role} dashboard', flush=True)
        fixture = Fixture(browser, role)
        page = fixture.open()
        summary = page.locator('dl[aria-label="Dashboard summary"]')
        expect(summary.locator(':scope > div')).to_have_count(5 if role == 'admin' else 4)
        expected = ['13', '10', '5', '5 / 13', '20'] if role == 'admin' else ['13', '10', '1', '5 / 13']
        assert summary.locator(':scope > div > dd:first-of-type').all_text_contents() == expected
        assert summary.locator('dt').all_text_contents() == (
            ['Students in active batches', 'Required complete', 'Awaiting placement review', 'Placement progress', 'Remaining OJT slots']
            if role == 'admin' else ['Enrolled students', 'Required complete', 'Students needing follow-up', 'Placement progress'])
        page.screenshot(path=str(ARTIFACTS / f'{role}-summary-desktop.png'))
        checks.append(f'{role}: role-specific linked summary cards; completion, placement and follow-up stay separate')
        matches = page.get_by_role('region', name='Top matches', exact=True)
        skills = page.get_by_role('region', name='Top performers by skill', exact=True)
        expect(matches.get_by_role('button')).to_have_count(4)
        expect(skills.get_by_role('button')).to_have_count(6)
        top = matches.get_by_role('button', name='View top match for Synthetic Student 01', exact=True)
        top.focus()
        page.keyboard.press('Enter')
        expect(dialog(page).get_by_role('heading', name='Synthetic Student 01', exact=True)).to_be_visible()
        dialog(page).get_by_role('tab', name='Recommendations', exact=True).click()
        expect(dialog(page).get_by_text('Developer Intern', exact=True)).to_be_visible()
        page.keyboard.press('Escape')
        expect(top).to_be_focused()
        skill = skills.get_by_role('button', name='View Web ranking', exact=True)
        skill.click()
        expect(dialog(page).get_by_role('heading', name='Web Leaderboard', exact=True)).to_be_visible()
        expect(dialog(page).get_by_text('10 assessed · 3 pending', exact=True)).to_be_visible()
        # Native buttons support keyboard selection from podium and lower ranks.
        podium = dialog(page).get_by_role('button', name="View Synthetic Student 01's details", exact=True)
        podium.focus()
        page.keyboard.press('Space')
        expect(dialog(page).get_by_role('heading', name='Synthetic Student 01', exact=True)).to_be_visible()
        dialog(page).get_by_role('tab', name='Assessments').click()
        expect(dialog(page).get_by_role('heading', name='Individual assessment results')).to_be_visible()
        expect(dialog(page).get_by_role('button', name='Approve retake', exact=False)).to_have_count(0)
        page.keyboard.press('Escape')
        expect(skill).to_be_focused()
        skills.get_by_role('button', name='View Zero score ranking', exact=True).click()
        expect(dialog(page).get_by_role('heading', name='Zero score Leaderboard', exact=True)).to_be_visible()
        expect(dialog(page).get_by_text('No results yet', exact=True)).to_have_count(0)
        page.keyboard.press('Escape')
        checks.append(f'{role}: matching highlights, keyboard dialogs, rankings, earned zero and read-only details')

        page.get_by_role('button', name='Show student cards', exact=True).click()
        if role == 'admin':
            card = page.get_by_role('button', name='View student Synthetic Student 01', exact=True)
        else:
            card = page.locator('[role="button"]').filter(has_text='Synthetic Student 01')
        card.focus()
        page.keyboard.press('Space')
        expect(dialog(page).get_by_role('heading', name='Synthetic Student 01', exact=True)).to_be_visible()
        if role == 'admin':
            expect(dialog(page).get_by_text('View batch details in Students / Batches', exact=True).first).to_be_visible()
            expect(dialog(page).get_by_text('Placement status is not included in this dashboard.', exact=False)).to_be_visible()
        page.keyboard.press('Escape')
        page.get_by_role('button', name='Show student list', exact=True).click()
        table_row = page.get_by_role('row').filter(has_text='Synthetic Student 02')
        table_row.click()
        expect(dialog(page).get_by_role('heading', name='Synthetic Student 02', exact=True)).to_be_visible()
        page.keyboard.press('Escape')
        search = page.get_by_placeholder('Search students…' if role == 'admin' else 'Search by name or ID…')
        search.fill('SYN-013')
        expect(page.get_by_text('1 students', exact=True)).to_be_visible()
        expect(matches.get_by_role('button')).to_have_count(4)
        search.fill('')
        checks.append(f'{role}: card and row details; search keeps highlights scoped to whole dashboard')

        for width in [375, 768, 1366]:
            page.set_viewport_size({'width': width, 'height': 1000})
            for dark in [False, True]:
                page.evaluate('(dark) => document.documentElement.classList.toggle("dark", dark)', dark)
                skills.scroll_into_view_if_needed()
                geometry(page)
                if width in [375, 1366]:
                    page.screenshot(path=str(ARTIFACTS / f'{role}-{width}-{"dark" if dark else "light"}.png'))
            skills.get_by_role('button', name='View Web ranking', exact=True).click()
            geometry(page)
            page.keyboard.press('Escape')
        page.set_viewport_size({'width': 375, 'height': 1000})
        summary.scroll_into_view_if_needed()
        geometry(page)
        page.screenshot(path=str(ARTIFACTS / f'{role}-summary-mobile-dark.png'))
        checks.append(f'{role}: 375/768/1366px, dark/light, dialog and page geometry')
        fixture.close()

        for mode in ['empty', 'failure']:
            fixture = Fixture(browser, role, mode)
            page = fixture.open()
            if mode == 'empty':
                summary = page.locator('dl[aria-label="Dashboard summary"]')
                expect(summary.locator(':scope > div')).to_have_count(5 if role == 'admin' else 4)
                assert summary.locator(':scope > div > dd:first-of-type').all_text_contents() == (['0', '0', '0', '0 / 0', '0'] if role == 'admin' else ['0', '0', '0', '0 / 0'])
                expect(page.get_by_text('No current matches available.', exact=False)).to_be_visible()
                expect(page.get_by_text('No final skill results available yet.', exact=False)).to_be_visible()
            else:
                expect(page.get_by_role('button', name='Retry', exact=True).first).to_be_visible()
            fixture.close()
        checks.append(f'{role}: empty and failed API states')
        if role == 'instructor':
            fixture = Fixture(browser, role, 'complete_locked')
            page = fixture.open()
            summary = page.locator('dl[aria-label="Dashboard summary"]')
            assert summary.locator(':scope > div > dd:first-of-type').all_text_contents() == ['13', '10', '1', '5 / 13']
            expect(page.get_by_role('button', name='View top match for Synthetic Student 01', exact=True)).to_have_count(0)
            fixture.close()
            checks.append('instructor: completed required work stays complete when final recommendations are locked')
        else:
            fixture = Fixture(browser, role, 'stats_failure')
            page = fixture.open()
            expect(page.locator('dl[aria-label="Dashboard summary"]')).to_have_count(0)
            expect(page.get_by_role('button', name='Retry', exact=True)).to_be_visible()
            fixture.close()
            checks.append('admin: failed summary API shows retry instead of zero counts')
    browser.close()

(ARTIFACTS / 'checks.json').write_text(json.dumps({'checks': checks}, indent=2), encoding='utf-8')
print(json.dumps({'passed': len(checks), 'checks': checks}, indent=2))
