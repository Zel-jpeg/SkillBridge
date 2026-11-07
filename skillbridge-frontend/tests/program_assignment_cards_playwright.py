"""Program assignment cards: intercepted synthetic APIs, no external writes."""
import copy
import json
import os
import re
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get('SKILLBRIDGE_TEST_BASE', 'http://127.0.0.1:5231')
OUT = Path(__file__).resolve().parents[2] / 'work/program-assignment-cards'
OUT.mkdir(parents=True, exist_ok=True)
USER = {'id': 1, 'role': 'admin', 'name': 'Synthetic Admin', 'is_approved': True}
PROGRAMS = [
    {'id': 1, 'code': 'BSIS', 'name': 'Bachelor of Science in Information Systems',
     'institute_id': 1, 'institute_code': 'IC', 'institute_name': 'Institute of Computing', 'is_active': True},
    {'id': 2, 'code': 'BSIT', 'name': 'Bachelor of Science in Information Technology',
     'institute_id': 1, 'institute_code': 'IC', 'institute_name': 'Institute of Computing', 'is_active': True},
    {'id': 3, 'code': 'BSTM', 'name': 'Bachelor of Science in Tourism Management',
     'institute_id': 2, 'institute_code': 'IBPA', 'institute_name': 'Synthetic Institute IBPA', 'is_active': True},
]
ANALYTICS = {
    'role': 'admin', 'generated_at': '2026-11-06T00:00:00Z', 'scope': {},
    'summary': {key: 0 for key in ['students', 'required_complete', 'approved', 'unplaced',
        'awaiting_review', 'needs_followup', 'slots_remaining']},
    'options': {key: [] for key in ['batches', 'instructors', 'courses', 'assessments',
        'companies', 'positions', 'areas']},
    **{key: [] for key in ['students', 'placement_students', 'assessments', 'batches',
        'skills', 'capacity', 'match_bands', 'companies', 'areas', 'geography', 'activity']},
}


class Fixture:
    def __init__(self, browser):
        self.context = browser.new_context(viewport={'width': 1366, 'height': 1000})
        values = {'sb-token': 'synthetic-local-token', 'sb-role': 'admin', 'sb-user': json.dumps(USER)}
        self.context.add_init_script('for(const [k,v] of Object.entries(' + json.dumps(values) + '))localStorage.setItem(k,v)')
        self.context.route('**/*', self.route)
        self.page = self.context.new_page()
        self.errors, self.writes, self.queries, self.pending = [], [], [], []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.programs = copy.deepcopy(PROGRAMS)
        self.users = {'students': [], 'instructors': [], 'pending_instructors': []}
        self.institutes = [
            {'id': 1, 'code': 'IC', 'name': 'Institute of Computing', 'description': '', 'is_active': True, 'program_count': 2},
            {'id': 2, 'code': 'IBPA', 'name': 'Synthetic Institute IBPA', 'description': '', 'is_active': True, 'program_count': 1},
        ]
        self.fail_programs = self.fail_institutes = self.hold_save = False

    def route(self, route):
        request, parsed = route.request, urlparse(route.request.url)
        path = parsed.path
        if not path.startswith('/api/'):
            return route.continue_() if parsed.hostname in ['localhost', '127.0.0.1'] else route.abort()
        if path.endswith('/events/'):
            return route.fulfill(status=204)
        if path == '/api/auth/me/':
            return route.fulfill(json=USER)
        if path == '/api/management/analytics/':
            return route.fulfill(json=ANALYTICS)
        if path == '/api/admin/management-actions/':
            return route.fulfill(json={'count': 0, 'results': []})
        if path == '/api/admin/users/':
            return route.fulfill(json=self.users)
        if path == '/api/admin/institutes/':
            query = parse_qs(parsed.query)
            if self.fail_institutes:
                return route.fulfill(status=503, json={'error': 'Synthetic institute outage'})
            term = query.get('search', [''])[0].strip().lower()
            rows = [row for row in self.institutes if term in f'{row["code"]} {row["name"]}'.lower()]
            current = min(int(query.get('page', ['1'])[0]), max(1, (len(rows) + 7) // 8))
            return route.fulfill(json={'count': len(rows), 'page': current, 'page_size': 8,
                                      'results': rows[(current - 1) * 8:current * 8]})
        institute_programs = re.fullmatch(r'/api/admin/institutes/(\d+)/programs/', path)
        if path == '/api/management/programs/' or institute_programs:
            query = parse_qs(parsed.query)
            self.queries.append(query)
            self.query_url = path + '?' + parsed.query
            if self.fail_programs:
                return route.fulfill(status=503, json={'error': 'Synthetic catalog outage'})
            term = query.get('search', [''])[0].strip().lower()
            rows = [row for row in self.programs if term in ' '.join(str(row[key]) for key in
                    ['name', 'code', 'institute_code', 'institute_name']).lower()]
            if institute_programs:
                rows = [row for row in rows if row['institute_id'] == int(institute_programs[1])]
                rows = [{**row, 'description': '', 'aliases': []} for row in rows]
            current = min(int(query.get('page', ['1'])[0]), max(1, (len(rows) + 7) // 8))
            return route.fulfill(json={'count': len(rows), 'page': current, 'page_size': 8,
                                      'results': rows[(current - 1) * 8:current * 8]})
        program = re.fullmatch(r'/api/management/programs/(\d+)/', path)
        if program:
            record = next((row for row in self.programs if row['id'] == int(program[1])), None)
            return route.fulfill(json=record) if record else route.fulfill(status=404, json={'error': 'Unavailable program'})
        if path == '/api/admin/instructors/' and request.method == 'POST':
            self.writes.append(request.post_data_json)
            if self.hold_save:
                self.pending.append(route)
                return
            return route.fulfill(status=201, json={**request.post_data_json, 'id': 101, 'is_approved': True})
        return route.fulfill(json={})

    def open(self):
        self.page.goto(BASE + '/admin/users', wait_until='networkidle')
        self.page.get_by_role('button', name='Add Instructor', exact=True).click()
        dialog = self.page.get_by_role('dialog', name='Add Instructor', exact=True)
        dialog.get_by_label('DNSC Email', exact=True).fill('santos.ana@dnsc.edu.ph')
        dialog.get_by_label('Full Name', exact=True).fill('Ana Santos')
        dialog.get_by_label('Instructor ID', exact=True).fill('2026-00042')
        return dialog

    def close(self):
        assert not self.errors, self.errors
        self.context.close()


def expand(dialog):
    dialog.locator('summary').filter(has_text='Program assignment').click()


def institute(dialog, code):
    dialog.get_by_role('button', name=re.compile('^View programs in ' + code + ' —')).click()


def layout(dialog):
    assert dialog.evaluate('node => node.scrollWidth <= node.clientWidth + 1')
    assert dialog.locator('form').evaluate('node => node.scrollWidth <= node.clientWidth + 1')
    assert dialog.locator('.sb-program-select').evaluate_all('nodes => nodes.every(node => node.scrollWidth <= node.clientWidth + 1)')
    assert dialog.locator('footer').evaluate('node => {const r=node.getBoundingClientRect();return r.top>=0 && r.bottom<=innerHeight}')


checks = []
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel='chrome', headless=True)
    try:
        f = Fixture(browser)
        f.users['students'] = [{'id': 50, 'name': 'Synthetic Student', 'email': 'student@example.invalid',
            'student_id': 'SYN-STUDENT', 'school_id': 'SYN-STUDENT', 'course': 'BSIT', 'role': 'student',
            'is_active': True, 'is_approved': True, 'assessment_results': [], 'combined_category_scores': []}]
        f.users['instructors'] = [{'id': 60, 'name': 'Synthetic Instructor', 'email': 'instructor@example.invalid',
            'school_id': 'SYN-INSTRUCTOR', 'role': 'instructor', 'is_active': True, 'is_approved': True,
            'assigned_programs': [], 'department': '', 'courses': ''}]
        dialog = f.open()
        footer_before = dialog.locator('footer').bounding_box()
        expect(dialog.locator('details')).not_to_have_attribute('open', '')
        expand(dialog)
        expect(dialog.get_by_role('group', name='Institutes', exact=True).get_by_role('button')).to_have_count(2)
        f.page.screenshot(path=str(OUT / 'institutes-desktop.png'))
        expect(dialog.get_by_role('radio')).to_have_count(0)
        institute(dialog, 'IC')
        expect(dialog.get_by_role('radio')).to_have_count(2)
        expect(dialog.get_by_role('radio', name=re.compile('BSTM'))).to_have_count(0)
        dialog.get_by_role('button', name='← All institutes', exact=True).click()
        expect(dialog.get_by_role('searchbox', name='Search institutes')).to_be_focused()
        institute(dialog, 'IBPA')
        expect(dialog.get_by_role('radio')).to_have_count(1)
        expect(dialog.locator('.sb-program-count')).to_have_text('1 programNone selected')
        assert dialog.locator('footer').bounding_box() == footer_before
        selected = dialog.get_by_role('radio', name=re.compile('BSTM'))
        selected.focus()
        selected.press('Space')
        expect(selected).to_be_checked()
        expect(dialog.locator('.sb-program-option[data-selected="true"]')).to_contain_text('Tourism Management')
        expect(dialog.locator('.sb-program-option[data-selected="true"]')).to_contain_text('Selected')
        expect(dialog.locator('input[type=radio]:checked')).to_have_count(1)
        card = dialog.locator('.sb-program-option[data-selected="true"]')
        for dark in [False, True]:
            f.page.evaluate('(dark)=>document.documentElement.classList.toggle("dark",dark)', dark)
            card.click()
            expect(card).to_have_css('outline-style', 'none')
            expect(selected).to_be_checked()
            f.page.keyboard.press('Tab')
            selected.focus()
            expect(card).to_have_css('outline-style', 'solid')
            expect(card).to_have_css('outline-width', '2px')
        f.page.evaluate('document.documentElement.classList.remove("dark")')
        card.click()
        expect(card).to_have_css('outline-style', 'none')
        f.page.screenshot(path=str(OUT / 'desktop.png'))
        expand(dialog)
        expect(dialog.locator('summary')).to_contain_text('1 selected')
        assert dialog.locator('footer').bounding_box() == footer_before
        expand(dialog)
        dialog.get_by_role('button', name='← All institutes', exact=True).click()
        expect(dialog.locator('.sb-program-selection')).to_contain_text('Bachelor of Science in Tourism Management')
        institute_search = dialog.get_by_role('searchbox', name='Search institutes')
        institute_search.fill('Computing')
        expect(dialog.get_by_role('group', name='Institutes', exact=True).get_by_role('button')).to_have_count(1)
        institute_search.fill('missing-institute')
        expect(dialog.get_by_text('No institutes match your search.', exact=True)).to_be_visible()
        dialog.get_by_role('button', name='Clear search', exact=True).click()
        institute(dialog, 'IC')
        search = dialog.get_by_role('searchbox', name='Search assigned programs')
        expect(dialog.locator('.sb-program-selection')).to_contain_text('Bachelor of Science in Tourism Management')
        search.press('Enter')
        assert not f.writes
        search.fill('missing-program')
        expect(dialog.get_by_text('No programs match your search.', exact=True)).to_be_visible()
        expect(dialog.locator('.sb-program-selection')).to_contain_text('BSTM')
        dialog.get_by_role('button', name='Clear search', exact=True).click()
        expect(search).to_be_focused()
        expect(dialog.get_by_role('radio')).to_have_count(2)
        dialog.get_by_role('button', name='Clear selection', exact=True).click()
        expect(search).to_be_focused()
        expect(dialog.locator('input[type=radio]:checked')).to_have_count(0)
        expect(dialog.locator('summary')).not_to_contain_text('1 selected')
        checks.append('Institute-first navigation limits programs to the chosen institute; native selection, back/search/collapse retention, clear focus and stable footer geometry')

        dialog.get_by_role('button', name='← All institutes', exact=True).click()
        institute(dialog, 'IBPA')
        selected.check()
        f.hold_save = True
        submit = dialog.get_by_role('button', name='Add Instructor', exact=True)
        submit.evaluate('node => {node.click();node.click()}')
        expect(dialog.get_by_role('button', name='Adding...', exact=True)).to_be_disabled()
        assert len(f.writes) == 1
        expect(selected).to_be_disabled()
        expect(search).to_be_disabled()
        f.pending.pop().fulfill(status=400, json={'error': 'Synthetic program conflict; review the selection.'})
        expect(dialog.locator('form > [role=alert]')).to_contain_text('Synthetic program conflict')
        expect(selected).to_be_checked()
        expect(dialog.get_by_label('Full Name', exact=True)).to_have_value('Ana Santos')
        f.hold_save = False
        submit.click()
        expect(dialog).to_have_count(0)
        assert len(f.writes) == 2
        assert f.writes[-1] == {'name': 'Ana Santos', 'email': 'santos.ana@dnsc.edu.ph',
                                'instructor_id': '2026-00042', 'program_id': 3}
        checks.append('Exact existing creation payload, single pending request, disabled controls, failed-save draft retention and explicit retry')
        student_card = f.page.locator('.sb-user-management .sp-card').first
        student_card.hover()
        expect(student_card).to_have_css('border-top-color', 'rgb(22, 163, 74)')
        assert '0px 0px 0px 2px' not in student_card.evaluate('node=>getComputedStyle(node).boxShadow')
        student_button = student_card.get_by_role('button', name='View student Synthetic Student', exact=True)
        student_button.click()
        expect(f.page.locator('dialog[open]')).to_have_count(1)
        f.page.keyboard.press('Escape')
        expect(f.page.locator('dialog[open]')).to_have_count(0)
        f.page.keyboard.press('Tab')
        student_button.focus()
        assert student_button.evaluate('node=>getComputedStyle(node,"::after").outlineStyle') == 'solid'
        f.page.get_by_role('button', name=re.compile(r'^Instructors\b')).click()
        instructor_card = f.page.locator('.sb-user-card').first
        instructor_card.click()
        expect(f.page.locator('.sb-detail-dialog--instructor[open]')).to_be_visible()
        assert f.page.locator('.instructor-detail-card').evaluate_all('nodes=>nodes.every(node=>getComputedStyle(node).outlineStyle==="none")')
        f.page.get_by_role('dialog').get_by_role('button', name=re.compile('^Close')).click()
        expect(instructor_card).to_have_css('outline-style', 'none')
        f.page.keyboard.press('Tab')
        instructor_card.focus()
        expect(instructor_card).to_have_css('outline-style', 'solid')
        checks.append('Mouse-selected program cards have one edge in both themes; keyboard outlines remain; student/instructor cards and profile dialogs avoid mouse border rings')
        f.close()

        f = Fixture(browser)
        f.programs += [{**PROGRAMS[0], 'id': i, 'code': f'SYN{i}', 'name': f'Synthetic Program {i:02}'} for i in range(4, 20)]
        dialog = f.open()
        expand(dialog)
        institute(dialog, 'IC')
        dialog.get_by_role('button', name='Next →', exact=True).click()
        expect(dialog.locator('.sb-program-results')).to_contain_text('Showing 9–16 of 18')
        dialog.get_by_role('radio', name=re.compile('SYN10 ')).check()
        dialog.get_by_role('button', name='← Prev', exact=True).click()
        expect(dialog.locator('.sb-program-selection')).to_contain_text('Synthetic Program 10')
        search = dialog.get_by_role('searchbox')
        search.fill('SYN19')
        expect(dialog.get_by_role('radio')).to_have_count(1)
        assert f.queries[-1]['page'] == ['1']
        search.fill('')
        expect(dialog.get_by_role('radio')).to_have_count(8)
        dialog.get_by_role('button', name='Next →', exact=True).click()
        expect(dialog.locator('.sb-program-results')).to_contain_text('Showing 9–16 of 18')
        f.programs = copy.deepcopy(PROGRAMS)
        # Page two may have come from cache, so the last network URL need not
        # be the currently mounted query.
        f.page.evaluate('(url)=>window.dispatchEvent(new CustomEvent("sse:data_changed",{detail:{urls:[url]}}))',
                        '/api/admin/institutes/1/programs/?status=active&page=2&page_size=8&search=')
        expect(dialog.locator('.sb-program-count')).to_contain_text('2 programs')
        expect(dialog.get_by_role('radio')).to_have_count(2)
        expect(dialog.get_by_role('button', name='Next →', exact=True)).to_have_count(0)
        checks.append('Server pagination keeps selection, search resets page, and shrinking catalog clamps results without empty padding')
        f.close()

        f = Fixture(browser)
        f.institutes += [{'id': i, 'code': f'SYN{i}', 'name': f'Synthetic Institute {i:02}',
                         'description': '', 'is_active': True, 'program_count': 0} for i in range(3, 13)]
        dialog = f.open()
        expand(dialog)
        dialog.get_by_role('button', name='Next →', exact=True).click()
        expect(dialog.locator('.sb-program-results')).to_contain_text('Showing 9–12 of 12')
        dialog.get_by_role('searchbox', name='Search institutes').fill('Computing')
        expect(dialog.get_by_role('group', name='Institutes', exact=True).get_by_role('button')).to_have_count(1)
        expect(dialog.get_by_role('button', name='Next →', exact=True)).to_have_count(0)
        institute(dialog, 'IC')
        expect(dialog.get_by_role('radio')).to_have_count(2)
        f.close()
        checks.append('Institute directory paginates independently; institute search resets page and opening a card loads its programs')

        f = Fixture(browser)
        f.fail_institutes = True
        dialog = f.open()
        expand(dialog)
        expect(dialog.locator('.sb-data-error')).to_contain_text('Could not load this section')
        f.fail_institutes = False
        dialog.get_by_role('button', name='Retry', exact=True).click()
        expect(dialog.get_by_role('group', name='Institutes', exact=True).get_by_role('button')).to_have_count(2)
        f.fail_programs = True
        institute(dialog, 'IBPA')
        expect(dialog.locator('.sb-data-error')).to_contain_text('Could not load this section')
        f.fail_programs = False
        dialog.get_by_role('button', name='Retry', exact=True).click()
        expect(dialog.get_by_role('radio')).to_have_count(1)
        f.close()
        f = Fixture(browser)
        f.programs = []
        dialog = f.open()
        expand(dialog)
        institute(dialog, 'IBPA')
        expect(dialog.get_by_text('No available programs.', exact=True)).to_be_visible()
        dialog.get_by_role('button', name='Add Instructor', exact=True).click()
        expect(dialog).to_have_count(0)
        assert 'program_id' not in f.writes[-1]
        f.close()
        checks.append('Failed catalog load retries; empty catalog still permits creation without a program')

        f = Fixture(browser)
        f.programs[2]['name'] = 'Bachelor of Science in Synthetic Program Management with International Community Development and Accessible Lifelong Learning'
        dialog = f.open()
        expand(dialog)
        institute(dialog, 'IBPA')
        dialog.get_by_role('radio', name=re.compile('BSTM')).check()
        for dark in [False, True]:
            f.page.evaluate('(dark)=>document.documentElement.classList.toggle("dark",dark)', dark)
            for width, height in [(1366, 1000), (768, 1024), (390, 844), (320, 640), (844, 390)]:
                f.page.set_viewport_size({'width': width, 'height': height})
                dialog.locator('.sb-instructor-program').scroll_into_view_if_needed()
                layout(dialog)
                if width in [1366, 390]:
                    f.page.screenshot(path=str(OUT / f'layout-{width}-{"dark" if dark else "light"}.png'))
        dialog.get_by_role('button', name='Cancel', exact=True).click()
        expect(dialog).to_have_count(0)
        assert not f.writes
        expect(f.page.get_by_role('button', name='Add Instructor', exact=True)).to_be_focused()
        f.close()
        checks.append('Long names wrap at desktop/tablet/320px/390px/short landscape in light/dark; footer stays visible; cancel restores focus and sends no mutation')
    except Exception:
        for context in browser.contexts:
            for index, page in enumerate(context.pages):
                page.screenshot(path=str(OUT / f'failure-{index}.png'))
                (OUT / f'failure-{index}.txt').write_text(page.locator('body').inner_text(), encoding='utf-8')
        raise
    finally:
        (OUT / 'results.json').write_text(json.dumps({'checks': checks}, indent=2), encoding='utf-8')
        print(json.dumps({'checks': checks}, indent=2))
        browser.close()
