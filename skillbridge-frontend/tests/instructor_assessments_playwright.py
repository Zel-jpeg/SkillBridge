"""Synthetic instructor library checks. Start local Vite on port 5178.

All API responses are intercepted; external traffic is blocked. No backend/data writes.
"""
import json
from datetime import datetime
import os
import re
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('SKILLBRIDGE_TEST_BASE', 'http://127.0.0.1:5178')
API = '/api/instructor/assessments/'
OUT = Path(__file__).parent / 'artifacts/instructor-assessments'
OUT.mkdir(parents=True, exist_ok=True)
USER = {'id': 1, 'role': 'instructor', 'name': 'Synthetic Instructor', 'is_approved': True}


def assessment(i):
    state = ['published', 'draft', 'closed'][i % 3]
    return {'id': i, 'title': f'Assessment {i:02d} — Technical foundations',
            'batch_id': 1 if i % 2 else 2, 'batch_name': 'Blue cohort' if i % 2 else 'Green cohort',
            'duration_minutes': 60 if i % 2 else 30, 'question_count': 50 if i % 2 else 10,
            'publication_status': state, 'is_required': i % 2 == 1,
            'include_in_competency': i % 2 == 1, 'display_order': i,
            'availability_status': 'available' if state == 'published' else state,
            'available_at': None, 'due_at': None, 'questions_locked': True,
            'categories': ['Database', 'Networking', 'Programming', 'Cloud', 'Tools'],
            'submission_count': i % 2, 'flagged_count': 1 if i == 23 else 0,
            'created_at': '2026-10-01T00:00:00Z'}


class Fixture:
    def __init__(self, browser, fail=False, empty=False):
        self.records = [] if empty else [assessment(i) for i in range(1, 24)]
        self.questions = []
        self.fail, self.report_fail, self.calls, self.errors = fail, False, [], []
        self.context = browser.new_context(viewport={'width': 1440, 'height': 1100}, reduced_motion='reduce')
        self.context.add_init_script('for (const [k,v] of Object.entries(' + json.dumps({
            'sb-token': 'synthetic', 'sb-role': 'instructor', 'sb-user': json.dumps(USER),
        }) + ')) localStorage.setItem(k,v)')
        self.context.route('**/*', self.route)
        self.page = self.context.new_page()
        self.page.set_default_timeout(10000)
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))

    def route(self, route):
        url = urlparse(route.request.url)
        if url.path.startswith('/api/'):
            self.calls.append((route.request.method, url.path, parse_qs(url.query)))
            if url.path.endswith('/events/'):
                return route.fulfill(status=204)
            if url.path == '/api/auth/me/':
                return route.fulfill(json=USER)
            if url.path == API:
                return route.fulfill(status=503 if self.fail else 200, json={'error': 'Synthetic outage'} if self.fail else self.records)
            if url.path == '/api/instructor/batches/':
                return route.fulfill(json=[{'id': 1, 'name': 'Blue cohort', 'status': 'active'}, {'id': 2, 'name': 'Green cohort', 'status': 'active'}])
            if url.path.endswith('/questions/'):
                return route.fulfill(json={'questions': self.questions})
            if url.path == '/api/categories/':
                return route.fulfill(json=[{'id': 1, 'name': 'Programming'}])
            if url.path == '/api/management/assessment-reports/':
                if self.report_fail:
                    return route.fulfill(status=503, json={'error': 'Synthetic report outage'})
                if 'export' in parse_qs(url.query):
                    return route.fulfill(content_type='text/csv', body='Assessment,Submitted\nSynthetic,1\n')
                return route.fulfill(json={'report_type': parse_qs(url.query).get('type', ['batch_progress'])[0],
                    'role': 'instructor', 'rows': [], 'generated_at': '2026-10-25T04:00:00Z'})
            return route.fulfill(json=[])
        return route.continue_() if url.hostname in ['localhost', '127.0.0.1'] else route.abort()

    def open(self):
        self.page.goto(BASE + '/instructor/assessments')
        self.page.wait_for_load_state('networkidle')
        return self.page

    def refresh(self):
        self.page.evaluate('window.dispatchEvent(new CustomEvent("sse:data_changed", {detail:{urls:["' + API + '"]}}))')

    def close(self):
        assert not self.errors, self.errors
        self.context.close()


checks = []
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    try:
        f = Fixture(browser)
        page = f.open()
        library = page.get_by_role('region', name='Assessment library', exact=True)
        cards = library.locator('article')
        expect(cards).to_have_count(4)
        expect(page.get_by_role('button', name=re.compile('Manage assessment'))).to_have_count(0)
        assert not any(path.endswith('/questions/') for _, path, _ in f.calls)
        expect(library.get_by_text('23 assessments', exact=True)).to_be_visible()
        page.get_by_role('button', name='Next', exact=False).click()
        expect(page.get_by_text('Showing 5–8 of 23')).to_be_visible()
        before = cards.locator('h2').all_text_contents()
        page.get_by_role('button', name='List view', exact=True).click()
        expect(page.get_by_role('button', name='List view', exact=True)).to_have_attribute('aria-pressed', 'true')
        expect(page.get_by_text('Showing 5–8 of 23')).to_be_visible()
        rows = library.locator('tbody tr')
        expect(library.get_by_role('columnheader', name='Configuration', exact=True)).to_be_visible()
        expect(rows.first.locator('dt')).to_have_text(['Opens', 'Due'])
        expect(rows.first.locator('dd')).to_have_text(['—', '—'])
        assert rows.locator('td:first-child button').all_text_contents() == before
        page.get_by_role('button', name='6', exact=True).click()
        expect(rows).to_have_count(3)
        expect(page.get_by_role('button', name='Next', exact=False)).to_be_disabled()
        page.get_by_role('searchbox', name='Search assessments').fill('Assessment 23')
        expect(rows).to_have_count(1)
        expect(library.get_by_text('1 assessment', exact=True)).to_be_visible()
        expect(page.get_by_role('button', name='Next', exact=False)).to_have_count(0)
        page.get_by_role('button', name='Clear filters', exact=True).click()
        expect(page.get_by_text('Showing 1–4 of 23')).to_be_visible()
        checks.append('Four records per page in cards/list; shared ordering, view/page preservation, filter reset and last-page boundaries')

        page.get_by_role('button', name='More filters', exact=False).click()
        page.get_by_role('combobox', name='Requirement', exact=True).select_option('required')
        page.get_by_role('combobox', name='Competency inclusion', exact=True).select_option('included')
        page.get_by_role('combobox', name='Skill category', exact=True).select_option('Database')
        page.get_by_role('combobox', name='Availability', exact=True).select_option('available')
        expect(library.get_by_text('4 assessments', exact=True)).to_be_visible()
        page.get_by_role('button', name='More filters', exact=False).click()
        expect(page.get_by_role('button', name='Remove Requirement filter')).to_be_visible()
        page.get_by_role('combobox', name='All batches', exact=True).select_option('2')
        expect(library.get_by_text('No assessments match your filters')).to_be_visible()
        library.get_by_role('button', name='Clear filters', exact=True).first.click()
        statuses = page.get_by_role('group', name='Publication status')
        statuses.get_by_role('button', name='Published', exact=False).click()
        clear = statuses.get_by_role('button', name='Clear filters', exact=True)
        expect(clear).to_be_visible()
        closed_box = statuses.get_by_role('button', name='Closed', exact=False).bounding_box()
        clear_box = clear.bounding_box()
        assert clear_box['x'] > closed_box['x'] + closed_box['width'] - 1
        assert abs(clear_box['y'] - closed_box['y']) < 2
        expect(library.get_by_role('button', name='Clear filters', exact=True)).to_have_count(1)
        expect(library.get_by_text('7 assessments', exact=True)).to_be_visible()
        # Global totals stay independent of filtered result counts.
        expect(page.locator('[aria-label="Assessment totals"]').get_by_text('23', exact=True)).to_be_visible()
        page.get_by_role('button', name='Clear filters', exact=True).click()
        checks.append('Combined secondary filters, hidden active-filter chips, batch/status/reset and independent summary totals')

        page.get_by_role('button', name='Card view', exact=True).click()
        more_categories = cards.first.get_by_role('button', name='Show 2 more categories')
        expect(cards.first.get_by_text('Cloud', exact=True)).to_have_count(0)
        more_categories.click()
        expect(cards.first.get_by_text('Cloud', exact=True)).to_be_visible()
        expect(cards.first.get_by_text('Tools', exact=True)).to_be_visible()
        assert cards.first.get_by_text('Cloud', exact=True).get_attribute('class') == cards.first.get_by_text('Database', exact=True).get_attribute('class')
        expect(cards.first.locator('details, summary, ul')).to_have_count(0)
        collapse = cards.first.get_by_role('button', name='Show fewer categories')
        expect(collapse).to_have_attribute('aria-expanded', 'true')
        collapse.focus()
        page.keyboard.press('Enter')
        expect(cards.first.get_by_text('Cloud', exact=True)).to_have_count(0)
        expect(more_categories).to_have_attribute('aria-expanded', 'false')
        expect(page.get_by_title('Close without saving', exact=True)).to_have_count(0)
        assert not any(path.endswith('/questions/') for _, path, _ in f.calls)
        page.mouse.move(0, 0)
        page.wait_for_timeout(200)
        normal = cards.first.evaluate('n => getComputedStyle(n).borderColor')
        cards.first.hover(position={'x': 8, 'y': 8})
        page.wait_for_timeout(200)
        assert cards.first.evaluate('n => getComputedStyle(n).borderColor') != normal
        cards.first.click(position={'x': 8, 'y': 8})
        expect(page.get_by_role('dialog', name='Edit assessment', exact=True).get_by_role('heading', name='Assessment 23 — Technical foundations', exact=True)).to_be_visible()
        expect(page.get_by_text('Question editing is locked', exact=False)).to_be_visible()
        page.get_by_title('Close without saving', exact=True).click()
        trigger = cards.first.get_by_role('button', name=re.compile('Open assessment'))
        page.keyboard.press('Tab')
        trigger.focus()
        assert trigger.evaluate('n => getComputedStyle(n,"::after").outlineStyle') == 'solid'
        page.keyboard.press('Space')
        expect(page.get_by_title('Close without saving', exact=True)).to_be_visible()
        page.get_by_title('Close without saving', exact=True).click()
        page.get_by_role('button', name='List view', exact=True).click()
        rows.first.get_by_role('button', name='Show 2 more categories').click()
        expect(rows.first.get_by_text('Cloud', exact=True)).to_be_visible()
        expect(page.get_by_title('Close without saving', exact=True)).to_have_count(0)
        rows.first.get_by_role('button', name='Show fewer categories').click()
        expect(rows.first.get_by_text('Cloud', exact=True)).to_have_count(0)
        rows.first.locator('td').nth(1).click()
        expect(page.get_by_title('Close without saving', exact=True)).to_be_visible()
        page.get_by_title('Close without saving', exact=True).click()
        rows.first.get_by_role('button', name=re.compile('Open assessment')).focus()
        page.keyboard.press('Enter')
        expect(page.get_by_title('Close without saving', exact=True)).to_be_visible()
        page.get_by_title('Close without saving', exact=True).click()
        checks.append('Card surface and table row clicks, keyboard Enter/Space/focus, inline category pills and keyboard expansion/collapse, lazy question requests')

        f.records = f.records[:4]
        f.refresh()
        expect(library.get_by_text('4 assessments', exact=True)).to_be_visible()
        expect(page.get_by_role('button', name='Next', exact=False)).to_have_count(0)
        f.records = [assessment(i) for i in range(1, 6)]
        f.refresh()
        expect(library.get_by_text('5 assessments', exact=True)).to_be_visible()
        page.get_by_role('button', name='Next', exact=False).click()
        expect(rows).to_have_count(1)
        f.records = f.records[:2]
        f.refresh()
        expect(rows).to_have_count(2)
        f.records = [assessment(i) for i in range(1, 24)]
        f.refresh()
        expect(page.get_by_text('Showing 1–4 of 23')).to_be_visible()
        checks.append('Live result shrink clamps page and subsequent growth does not jump back')

        reports = page.get_by_role('region', name='Individual assessment report controls')
        expect(reports.get_by_role('button', name='Download PDF')).to_be_disabled()
        reports.get_by_role('combobox', name='Batch filter').select_option('1')
        reports.get_by_role('combobox', name='Assessment filter').select_option('23')
        f.report_fail = True
        reports.get_by_role('button', name='Generate report', exact=True).click()
        expect(reports.get_by_role('alert')).to_contain_text('Server is unavailable')
        f.report_fail = False
        reports.get_by_role('button', name='Generate report', exact=True).click()
        expect(reports.get_by_role('button', name='Download PDF')).to_be_enabled()
        report_calls = [query for method, path, query in f.calls if path == '/api/management/assessment-reports/']
        assert any(query.get('batch_id') == ['1'] and query.get('assessment_id') == ['23'] for query in report_calls)
        with page.expect_download() as download:
            reports.get_by_role('button', name='Download CSV').click()
        assert download.value.suggested_filename.endswith('.csv')
        with page.expect_download() as download:
            reports.get_by_role('button', name='Download PDF').click()
        assert download.value.suggested_filename.endswith('.pdf')
        reports.get_by_role('combobox', name='Report type').select_option('student_competency')
        expect(reports.get_by_role('textbox', name='Student database ID')).to_be_visible()
        expect(reports.get_by_role('button', name='Download PDF')).to_be_disabled()
        reports.get_by_role('combobox', name='Report type').select_option('batch_progress')
        checks.append('Independent report filters, failure/retry, exact report scope, CSV/PDF download and snapshot reset')

        while page.get_by_role('button', name='Dismiss notification', exact=True).count():
            page.get_by_role('button', name='Dismiss notification', exact=True).first.click()
        reports.get_by_role('combobox', name='Batch filter').select_option('')

        # Capture the two-record layout matching the design brief, then exercise both views.
        f.records = [assessment(3), assessment(2)]
        f.records[0]['title'] = 'Web & database skills'
        f.records[1]['title'] = 'Technical foundations'
        f.refresh()
        expect(library.get_by_text('2 assessments', exact=True)).to_be_visible()
        for width in [1440, 1024, 768, 390, 320]:
            page.set_viewport_size({'width': width, 'height': 1000})
            for dark in [False, True]:
                page.evaluate('dark => document.documentElement.classList.toggle("dark", dark)', dark)
                if width >= 640:
                    for view in ['Card view', 'List view']:
                        page.get_by_role('button', name=view, exact=True).click()
                        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                        if view == 'List view':
                            expect(library.get_by_text('Showing 1–2 of 2 assessments', exact=True)).to_be_visible()
                            expect(library.get_by_text('4 per page', exact=True)).to_be_visible()
                            if width == 1440:
                                assert library.locator('table').evaluate('n => n.scrollWidth <= n.parentElement.clientWidth')
                                assert rows.first.locator('td:last-child div.grid > span').last.bounding_box()['height'] < 24
                            rows.first.hover(position={'x': 8, 'y': 8})
                            library.screenshot(path=str(OUT / f'list-{width}-{"dark" if dark else "light"}.png'))
                    page.get_by_role('button', name='Card view', exact=True).click()
                else:
                    expect(cards.first).to_be_visible()
                    expect(page.get_by_role('group', name='Assessment view')).to_be_hidden()
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                page.evaluate('document.activeElement?.blur(); window.scrollTo(0, 0)')
                page.screenshot(path=str(OUT / f'{width}-{"dark" if dark else "light"}.png'), full_page=True)
        checks.append('Ten responsive light/dark layouts, contained table scrolling and mobile card fallback without page overflow')
        page.set_viewport_size({'width': 1440, 'height': 1000})
        page.get_by_role('button', name='Card view', exact=True).click()
        statuses.get_by_role('button', name='Published', exact=False).click()
        cards.first.get_by_role('button', name='Show 2 more categories').click()
        for dark in [False, True]:
            page.evaluate('dark => document.documentElement.classList.toggle("dark", dark)', dark)
            page.mouse.move(0, 0)
            page.evaluate('document.activeElement?.blur(); window.scrollTo(0, 0)')
            page.screenshot(path=str(OUT / f'refined-{"dark" if dark else "light"}.png'), full_page=True)
        page.get_by_role('button', name='Clear filters', exact=True).click()
        f.questions = [{'id': i, 'question_text': f'Synthetic question {i}: review the assessment topic.',
            'question_type': 'mcq' if i <= 5 else 'truefalse' if i <= 7 else 'identification',
            'category': {'id': 1, 'name': 'Programming'},
            'choices': [{'id': i * 10 + 1, 'text': 'True' if 6 <= i <= 7 else 'Synthetic answer', 'is_correct': True},
                        {'id': i * 10 + 2, 'text': 'False' if 6 <= i <= 7 else 'Other answer', 'is_correct': False}]
        } for i in range(1, 11)]
        cards.first.get_by_role('button', name=re.compile('Open assessment')).click()
        settings = page.locator('[aria-label="Assessment settings and questions"]')
        title_input = page.get_by_placeholder('Assessment title', exact=True)
        expect(title_input).to_have_count(0)
        page.get_by_role('dialog', name='Edit assessment', exact=True).get_by_role('heading', name='Web & database skills', exact=True).click()
        expect(title_input).to_have_count(0)
        edit_name = page.get_by_role('button', name='Edit assessment name', exact=True)
        edit_name.click()
        expect(title_input).to_be_focused()
        title_input.fill('Cancelled name')
        page.keyboard.press('Escape')
        expect(page.get_by_role('dialog', name='Edit assessment', exact=True).get_by_role('heading', name='Web & database skills', exact=True)).to_be_visible()
        expect(edit_name).to_be_focused()
        edit_name.click()
        title_input.fill('')
        expect(page.get_by_role('button', name='Done', exact=True)).to_be_disabled()
        expect(title_input).to_have_attribute('aria-invalid', 'true')
        page.get_by_role('button', name='Cancel name edit', exact=True).click()
        expect(page.get_by_role('dialog', name='Edit assessment', exact=True).get_by_role('heading', name='Web & database skills', exact=True)).to_be_visible()
        edit_name.click()
        title_input.fill('Renamed synthetic assessment')
        page.keyboard.press('Enter')
        expect(title_input).to_have_count(0)
        expect(page.get_by_role('dialog', name='Edit assessment', exact=True).get_by_role('heading', name='Renamed synthetic assessment', exact=True)).to_be_visible()
        checks.append('Name editing requires pencil click; focus, Enter, Escape, Cancel and empty-name validation work')
        expect(settings.get_by_text('5 MCQ', exact=True)).to_be_visible()
        expect(settings.get_by_text('2 T/F', exact=True)).to_be_visible()
        expect(settings.get_by_text('3 Identification', exact=True)).to_be_visible()
        expect(page.get_by_role('button', name='Import questions', exact=True)).to_have_count(0)
        expect(page.get_by_text('Import questions is unavailable after a student attempt exists.', exact=True)).to_be_visible()
        expect(settings.get_by_label('Publication state', exact=True)).to_be_enabled()
        expect(settings.get_by_label('Duration', exact=True)).to_be_disabled()
        expect(settings.get_by_role('button', name=re.compile('^Available at:'))).to_be_disabled()
        page.get_by_title('Close without saving', exact=True).click()
        page.get_by_role('dialog', name='Discard unsaved changes?', exact=True).get_by_role('button', name='Discard changes', exact=True).click()
        # Unattempted authoring keeps the original schedule-picker checks.
        f.records[0]['questions_locked'] = False
        f.refresh()
        cards.first.get_by_role('button', name=re.compile('Open assessment')).click()
        settings.get_by_label('Duration', exact=True).fill('45')
        settings.get_by_label('Publication state', exact=True).select_option('closed')
        settings.get_by_label('Student display order', exact=True).fill('6')
        settings.get_by_role('checkbox', name='Required assessment', exact=False).uncheck()
        settings.get_by_role('checkbox', name='Include in competency profile', exact=False).uncheck()
        def set_schedule(label, value):
            target = datetime.fromisoformat(value)
            settings.get_by_role('button', name=re.compile('^' + label + ':')).click()
            picker = page.get_by_role('dialog', name=label + ' date and time', exact=True)
            for _ in range(36):
                month = picker.locator('header h2').inner_text()
                current = datetime.strptime(month, '%B %Y')
                if (current.year, current.month) == (target.year, target.month):
                    break
                direction = 'Next month' if (current.year, current.month) < (target.year, target.month) else 'Previous month'
                picker.get_by_role('button', name=direction, exact=True).click()
            picker.get_by_role('button', name=re.compile(target.strftime('%B ') + str(target.day) + ', ' + str(target.year) + '$')).click()
            picker.locator('[data-type="hour"]').press_sequentially(str(target.hour % 12 or 12))
            picker.locator('[data-type="minute"]').press_sequentially(f'{target.minute:02d}')
            picker.locator('[data-type="dayPeriod"]').press('a' if target.hour < 12 else 'p')
            picker.get_by_role('button', name='Apply', exact=True).click()
        expect(settings.locator('input[type="datetime-local"]')).to_have_count(0)
        set_schedule('Available at', '2026-11-01T08:00')
        set_schedule('Due at', '2026-11-01T07:00')
        expect(settings.get_by_role('alert')).to_contain_text('Due date must be after')
        set_schedule('Due at', '2026-11-02T17:00')
        expect(settings.get_by_role('alert')).to_have_count(0)
        available_trigger = settings.get_by_role('button', name=re.compile('^Available at:'))
        available_trigger.click()
        popup = page.get_by_role('dialog', name='Available at date and time', exact=True)
        popup.locator('[data-type="hour"]').press('9')
        popup.get_by_role('button', name='Cancel', exact=True).click()
        expect(available_trigger).to_have_accessible_name(re.compile(r'8:00\s*am', re.I))
        available_trigger.click()
        page.get_by_role('dialog', name='Available at date and time', exact=True).get_by_role('button', name='Clear', exact=True).click()
        expect(available_trigger).to_have_accessible_name('Available at: Select date and time')
        set_schedule('Available at', '2026-11-01T08:00')
        checks.append('Styled picker replaces native date/time UI; selection, AM/PM, Apply/Cancel/Clear and due-date validation work')
        expect(settings.get_by_label('Duration', exact=True)).to_have_value('45')
        expect(settings.get_by_label('Publication state', exact=True)).to_have_value('closed')
        expect(settings.get_by_label('Student display order', exact=True)).to_have_value('6')
        expect(settings.get_by_role('button', name=re.compile('^Due at:'))).to_have_accessible_name(re.compile(r'5:00\s*pm', re.I))
        page.get_by_title('Close without saving', exact=True).click()
        page.get_by_role('dialog', name='Discard unsaved changes?', exact=True).get_by_role('button', name='Discard changes', exact=True).click()
        cards.first.get_by_role('button', name=re.compile('Open assessment')).click()
        expect(settings.get_by_label('Duration', exact=True)).to_have_value('60')
        expect(settings.get_by_label('Publication state', exact=True)).to_have_value('published')
        for width, height in [(1440, 1000), (768, 1000), (390, 844), (320, 640), (1024, 600)]:
            page.set_viewport_size({'width': width, 'height': height})
            for dark in [False, True]:
                page.evaluate('dark => document.documentElement.classList.toggle("dark", dark)', dark)
                settings.evaluate('n => n.scrollTop = 0')
                publication = settings.get_by_label('Publication state', exact=True).bounding_box()
                order = settings.get_by_label('Student display order', exact=True).bounding_box()
                assert abs(publication['width'] - order['width']) < 1
                assert abs(publication['height'] - order['height']) < 1
                assert abs(publication['y'] - order['y']) < 1
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                assert settings.evaluate('n => n.scrollWidth <= n.clientWidth')
                settings.evaluate('n => n.scrollTop = n.scrollHeight')
                expect(settings.get_by_text('Synthetic question 10:', exact=False)).to_be_visible()
                expect(page.get_by_role('button', name='Save All Changes', exact=True)).to_be_visible()
                settings.evaluate('n => n.scrollTop = 0')
                page.mouse.move(0, 0)
                page.screenshot(path=str(OUT / f'modal-{width}-{height}-{"dark" if dark else "light"}.png'))
                date_trigger = settings.get_by_role('button', name=re.compile('^Due at:'))
                date_trigger.click()
                picker = page.get_by_role('dialog', name='Due at date and time', exact=True)
                box = picker.bounding_box()
                assert box['x'] >= 0 and box['x'] + box['width'] <= width + 1
                assert box['y'] >= 0 and box['y'] + box['height'] <= height + 1
                expect(picker.get_by_role('group', name=re.compile('Due at time'))).to_be_visible()
                assert picker.get_by_role('button', name='Apply', exact=True).evaluate('n => {const r=n.getBoundingClientRect(); return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}')
                page.screenshot(path=str(OUT / f'picker-{width}-{height}-{"dark" if dark else "light"}.png'))
                page.keyboard.press('Escape')
                expect(picker).to_have_count(0)
                expect(date_trigger).to_be_focused()
        page.get_by_title('Close without saving', exact=True).click()
        page.set_viewport_size({'width': 1440, 'height': 1000})
        checks.append('Modal: balanced state/order geometry, editable metadata, lock/upload protection, discard/reopen, question counts and reachable questions/footer across ten light/dark layouts')
        f.fail = True
        f.refresh()
        expect(page.get_by_text('Could not refresh. Showing the last loaded data.').first).to_be_visible()
        expect(cards.first).to_be_visible()
        f.fail = False
        page.get_by_role('button', name='Retry', exact=True).first.click()
        expect(page.get_by_text('Could not refresh. Showing the last loaded data.')).to_have_count(0)
        f.close()
        for fail, empty in [(True, False), (False, True)]:
            f = Fixture(browser, fail=fail, empty=empty)
            page = f.open()
            if fail:
                expect(page.get_by_role('alert').first).to_contain_text('Could not load')
                f.fail = False
                page.get_by_role('button', name='Retry', exact=True).first.click()
                expect(page.locator('article')).to_have_count(4)
            else:
                expect(page.get_by_text('No assessments yet', exact=True)).to_be_visible()
            f.close()
        checks.append('Initial load failure/retry, last-good data on refresh failure and genuine empty state')
        print(json.dumps({'checks': checks, 'page_errors': []}, indent=2))
    finally:
        browser.close()
