"""Real management pages with synthetic API responses; no live services or writes."""
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse
sys.path.insert(0, str(Path(__file__).parent / '.runtime'))
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:5198'
ARTIFACTS = Path(__file__).parent / 'artifacts' / 'student-cards'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
checks = []


def student(index):
    names = ['Alpha Student', 'Bravo Student', 'Charlie Student', 'Delta Student', 'Echo Student', 'Foxtrot Student', 'Golf Student', 'Hotel Student With A Very Long Synthetic Enrollment Name', 'India Student', 'Juliet Student', 'Kilo Student', 'Lima Student', 'Mike Student']
    scores = [{'category_id': i + 1, 'category': name, 'percentage': score, 'raw_score': score, 'max_score': 100} for i, (name, score) in enumerate([('Database Management', 66.67), ('Networking', 50), ('Programming', 50), ('Web Development', 100)])]
    row = {'id': index, 'name': names[index - 1], 'student_id': f'QA-{index:03d}', 'school_id': f'QA-{index:03d}',
        'email': f'student{index}@example.invalid', 'course': 'BSIS' if index % 3 == 0 else 'BSIT', 'instructor': 'QA Instructor',
        'status': 'completed', 'all_required_completed': True, 'completed_required_count': 1, 'total_required_count': 1, 'remaining_required_count': 0,
        'recommendations_locked': False, 'combined_category_scores': scores, 'skill_scores': {score['category']: score['percentage'] for score in scores},
        'combined_competency_profile': {'model_used': 'regex', 'finalized_at': '2026-10-21T01:00:00Z'},
        'assessment_results': [{'id': 101, 'title': 'QA Assessment', 'attempt_status': 'submitted', 'is_required': True, 'include_in_competency': True, 'retake_allowed': False, 'category_scores': scores, 'prior_attempts': []}],
        'top_recommendations': [{'company': 'Sample Tech', 'position': 'Web Developer Intern', 'match_score': 73.45}],
        'placement': {'status': 'unplaced'}, 'batch': {'id': 77, 'name': 'QA Active Batch'}}
    if index in [2, 3]:
        row['recommendations_locked'] = True
        row['combined_category_scores'] = [{'category': 'LOCKED_SCORE_SENTINEL', 'percentage': 99}]
        row['top_recommendations'] = [{'company': 'LOCKED_MATCH_SENTINEL', 'match_score': 99}]
    if index == 2:
        row.update(status='pending', all_required_completed=False, completed_required_count=0, remaining_required_count=1)
        row['assessment_results'][0]['attempt_status'] = None
    if index == 4:
        row.update(status='stopped', is_flagged=True, stopped_reason_display='Stopped after an integrity issue')
        row['assessment_results'][0].update(attempt_status='stopped', is_flagged=True)
    if index == 5:
        row['combined_category_scores'] = [{**score, 'percentage': 0, 'raw_score': 0} for score in scores]
    if index == 6:
        row['combined_category_scores'] = [{**score, 'percentage': None} for score in scores]
        row['top_recommendations'] = []
    if index == 7:
        row['combined_category_scores'] = [{'category': f'Extended Category {i + 1}', 'percentage': 80} for i in range(30)]
    if index == 8:
        row['course'] = 'BS Information Technology With An Extended Synthetic Course Label'
    if index in [1, 7]:
        row['top_recommendations'][0]['company_image_url'] = BASE + ('/card-company.svg' if index == 1 else '/broken-company.png')
    if index == 9:
        row['placement'] = {'status': 'approved', 'company': {'name': 'Approved Sample Company'}, 'position': {'title': 'Database Intern'}}
    if index == 10:
        row['top_recommendations'] = [{'company': 'STALE_MATCH_SENTINEL', 'match_score': 99, 'is_current': False}, {'company': 'Zero Fit Company', 'match_score': 0}]
    return row


class Fixture:
    def __init__(self, browser, role):
        self.role = role
        self.rows = [student(i) for i in range(1, 14)]
        self.errors, self.mutations = [], []
        self.context = browser.new_context(reduced_motion='reduce', viewport={'width': 1366, 'height': 1000})
        self.user = {'id': 99, 'role': role, 'name': 'QA Instructor', 'email': 'staff@example.invalid', 'is_approved': True}
        self.context.add_init_script("localStorage.setItem('sb-token','synthetic-only');localStorage.setItem('sb-role'," + json.dumps(role) + ");localStorage.setItem('sb-user'," + json.dumps(json.dumps(self.user)) + ");window.EventSource=class {close(){}};")
        self.context.route('**/*', self.route)
        self.page = self.context.new_page()
        self.page.set_default_timeout(10000)
        self.page.set_default_navigation_timeout(30000)
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))

    def route(self, route):
        parsed = urlparse(route.request.url)
        if parsed.hostname not in ['127.0.0.1', 'localhost']:
            return route.abort()
        path = parsed.path
        if path == '/card-company.svg':
            return route.fulfill(content_type='image/svg+xml', body='<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" rx="8" fill="#2563eb"/><path d="M10 20h20M20 10v20" stroke="white" stroke-width="4"/></svg>')
        if path == '/broken-company.png':
            return route.fulfill(status=404, body='Missing synthetic logo')
        if not path.startswith('/api/'):
            return route.continue_()
        if route.request.method != 'GET':
            self.mutations.append(path)
            return route.fulfill(status=405, json={'error': 'No writes in card checks'})
        if path.endswith('/me/'):
            return route.fulfill(json=self.user)
        if path.endswith('/admin/users/'):
            return route.fulfill(json={'students': self.rows, 'instructors': [{'id': 999, 'name': 'QA Other Instructor', 'email': 'instructor@example.invalid', 'instructor_id': 'QA-IN', 'department': 'Computing'}], 'pending_instructors': [], 'archived_students': [{'id': 900, 'name': 'Archived QA Student', 'is_active': False, 'status': 'archived', 'recommendations_locked': True}]})
        if path.endswith('/batches/'):
            return route.fulfill(json=[{'id': 77, 'name': 'QA Active Batch', 'status': 'active', 'student_count': 13}, {'id': 88, 'name': 'QA Archived Batch', 'status': 'archived', 'student_count': 13}])
        if path.endswith('/students/'):
            archived = '/88/' in path
            return route.fulfill(json={'batch': {'id': 88 if archived else 77, 'name': 'QA Archived Batch' if archived else 'QA Active Batch'}, 'students': self.rows})
        return route.fulfill(json=[])

    def open(self, width=1366, height=1000, dark=False, archived=False):
        self.page.set_viewport_size({'width': width, 'height': height})
        url = '/admin/users' if self.role == 'admin' else '/instructor/students' + ('?batch_id=88' if archived else '')
        self.page.goto(BASE + url)
        self.page.wait_for_load_state('networkidle')
        self.page.evaluate('(dark) => document.documentElement.classList.toggle("dark", dark)', dark)
        expect(self.page.locator('.sp-card:visible').first).to_be_visible()
        return self.page

    def close(self):
        assert not self.errors, self.errors
        assert not self.mutations, self.mutations
        self.context.close()


def card(page, student_id):
    return page.locator(f'.sp-card[data-student-id="{student_id}"]:visible')


def geometry(page):
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Document horizontal overflow'
    for element in page.locator('.sp-card:visible').all():
        assert element.evaluate('el => el.scrollWidth <= el.clientWidth + 1'), 'Card horizontal overflow'


with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    for role in ['instructor', 'admin']:
        fixture = Fixture(browser, role)
        for width, height in [(320, 568), (375, 812), (768, 1024), (1024, 768), (1366, 1000)]:
            for dark in [False, True]:
                print(f'Checking {role} {width}px {"dark" if dark else "light"}', flush=True)
                page = fixture.open(width, height, dark)
                geometry(page)
                expect(page.locator('.sp-card:visible')).to_have_count(10)
                normal = card(page, 1)
                expect(normal.get_by_role('progressbar')).to_have_attribute('aria-valuenow', '67')
                expect(normal.locator('.sp-card-chip')).to_have_count(4)
                expect(normal.get_by_text('Web Development', exact=True).last).to_be_visible()
                expect(normal.get_by_text('Sample Tech', exact=True)).to_be_visible()
                logo = normal.get_by_role('img', name='Sample Tech logo')
                expect(logo).to_be_visible()
                assert logo.evaluate('el => el.tagName === "IMG" && el.complete && el.naturalWidth > 0'), 'Company logo did not load'
                expect(card(page, 5).get_by_role('img', name='Sample Tech logo')).to_have_text('ST')
                card(page, 7).scroll_into_view_if_needed()
                expect(card(page, 7).get_by_role('img', name='Sample Tech logo')).to_have_text('ST')
                expect(card(page, 2).get_by_text('Waiting for assessment', exact=True)).to_be_visible()
                expect(card(page, 3).get_by_text('Final results locked', exact=True)).to_be_visible()
                expect(card(page, 4).get_by_text('Stopped after an integrity issue', exact=True)).to_be_visible()
                expect(card(page, 5).get_by_role('progressbar')).to_have_attribute('aria-valuenow', '0')
                expect(card(page, 6).get_by_role('progressbar')).to_have_count(0)
                expect(card(page, 7).locator('.sp-card-chip')).to_have_count(4)
                expect(card(page, 7).get_by_text('+26 more categories in student details', exact=True)).to_be_visible()
                expect(card(page, 9).get_by_text('Approved', exact=True)).to_be_visible()
                expect(card(page, 10).get_by_text('Zero Fit Company', exact=True)).to_be_visible()
                text = page.locator('.sp-card').all_text_contents()
                assert not any(sentinel in ' '.join(text) for sentinel in ['LOCKED_SCORE_SENTINEL', 'LOCKED_MATCH_SENTINEL', 'STALE_MATCH_SENTINEL', 'undefined%', 'null%'])
                if width in [375, 1366]:
                    normal.screenshot(path=str(ARTIFACTS / f'{role}-completed-{width}-{"dark" if dark else "light"}.png'))
                    card(page, 2).screenshot(path=str(ARTIFACTS / f'{role}-pending-{width}-{"dark" if dark else "light"}.png'))
                checks.append(f'{role} {width}px {"dark" if dark else "light"}: clean cards, responsive geometry, evidence guards, zero/missing/tied/long/approved states')

        page = fixture.open()
        normal = card(page, 1)
        normal.scroll_into_view_if_needed()
        page.mouse.move(1, 1)
        before = normal.evaluate('el => getComputedStyle(el).borderColor')
        normal.hover()
        assert before != normal.evaluate('el => getComputedStyle(el).borderColor')
        opener = normal.get_by_role('button', name='View student Alpha Student', exact=True)
        opener.focus()
        page.keyboard.press('Enter')
        expect(page.get_by_role('dialog', name='Alpha Student', exact=True)).to_be_visible()
        expect(page.get_by_role('tab', name='Overview', exact=True)).to_be_visible()
        page.keyboard.press('Escape')
        expect(opener).to_be_focused()
        if role == 'instructor':
            normal.get_by_role('button', name='Remove Alpha Student', exact=True).click()
            expect(page.get_by_role('dialog', name='Remove student?', exact=True)).to_be_visible()
            page.get_by_role('button', name='Cancel', exact=True).click()
            expect(page.locator('dialog[open]')).to_have_count(0)
        checks.append(f'{role}: hover, keyboard details, focus restoration and separate management actions')

        page.get_by_role('button', name='2', exact=True).click()
        expect(page.locator('.sp-card:visible')).to_have_count(3)
        page.get_by_role('button', name='Show student list' if role == 'instructor' else 'Show list', exact=True).click()
        expect(page.locator('.sp-card:visible')).to_have_count(0)
        expect(page.get_by_role('row').filter(has_text='Kilo Student')).to_be_visible()
        page.get_by_role('button', name='Show student cards' if role == 'instructor' else 'Show cards', exact=True).click()
        expect(page.locator('.sp-card:visible')).to_have_count(3)
        search = page.get_by_placeholder('Search by name, ID, or email…' if role == 'instructor' else 'Search…', exact=True)
        search.fill('QA-002')
        expect(page.locator('.sp-card:visible')).to_have_count(1)
        expect(card(page, 2)).to_be_visible()
        search.fill('NO-MATCH')
        expect(page.locator('.sp-card:visible')).to_have_count(0)
        search.fill('')
        expect(page.locator('.sp-card:visible')).to_have_count(10)
        expect(page.locator('button[aria-current="page"]')).to_have_text('1')
        checks.append(f'{role}: full-count pagination, same card/list page, search resets and empty recovery')

        if role == 'admin':
            page.get_by_role('button', name=re.compile('^Instructors')).click()
            expect(page.locator('.sp-card')).to_have_count(0)
            expect(page.get_by_text('QA Other Instructor', exact=True)).to_be_visible()
            page.get_by_role('button', name=re.compile('^Archived')).click()
            archived = card(page, 900)
            expect(archived.get_by_text('Archived student', exact=True)).to_be_visible()
            expect(archived.get_by_text('Placement not provided', exact=True)).to_be_visible()
        else:
            page = fixture.open(archived=True)
            expect(page.locator('.sp-card-remove')).to_have_count(0)
        checks.append(f'{role}: archived boundaries and non-student cards preserved')
        fixture.close()

    browser.close()
(ARTIFACTS / 'results.json').write_text(json.dumps({'checks': checks, 'page_errors': []}, indent=2), encoding='utf-8')
print(json.dumps({'passed_groups': len(checks), 'artifacts': str(ARTIFACTS.resolve())}, indent=2), flush=True)
