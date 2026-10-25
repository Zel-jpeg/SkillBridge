"""Three placement collections, both staff roles, synthetic API responses only."""
import json
import re
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlparse
sys.path.insert(0, str(Path(__file__).parent / '.runtime'))
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:5195'
OUT = Path(__file__).parent / 'artifacts' / 'placement-collections'
OUT.mkdir(parents=True, exist_ok=True)
checks = []


class Fixture:
    def __init__(self, browser, role):
        self.role, self.errors, self.writes = role, [], []
        self.company_limit, self.history_limit = 13, 25
        self.batch = {'id': 1, 'name': 'QA Active Batch'}
        self.students = [{'id': i, 'name': f'QA Student {i:02d}', 'school_id': f'QA-{i:03d}', 'student_id': f'QA-{i:03d}', 'course': 'BSIT', 'batch': self.batch} for i in range(1, 28)]
        self.suggestion = {'recommendation_id': 101, 'match_score': 0, 'category_score_component': 0,
            'nlp_score_component': 0, 'location_score_component': 0, 'distance_km': None, 'placement_status': 'unplaced', 'student': self.students[0], 'batch': self.batch}
        self.companies = [{'id': i, 'name': f'QA Company {i:02d}', 'address': {'city': 'Davao City' if i % 2 else 'Tagum City'},
            'positions': [{'id': i, 'title': f'QA Intern {i:02d}', 'slots_available': 8 if i == 1 else 2, 'approved_count': 3 if i == 1 else 0,
                'remaining_slots': 5 if i == 1 else 2, 'suggested_students': [self.suggestion] if i == 1 else []}]} for i in range(1, 14)]
        self.companies[2]['name'] = 'QA Company With An Extended Synthetic Institution And Department Name'
        reasons = ['awaiting_update', 'results_locked', 'awaiting_capacity', 'no_current_matches', 'coordinator_review', 'suggestions_declined', 'awaiting_draft']
        self.draft = {'revision': 1, 'generated': True, 'stale': False, 'sync_key': 'synthetic-fixed', 'updated_at': '2026-10-25T01:00:00Z',
            'proposed_counts': {'1': 3}, 'students': [{'student': row, 'batch': self.batch, 'status': reasons[(row['id'] - 1) % 7],
                'proposal': None, 'alternatives': [{'id': 101, 'position_id': 1, 'position': 'QA Intern 01', 'company_id': 1, 'company': 'QA Company 01', 'match_score': 0}] if row['id'] == 1 else []} for row in self.students[:25]]}
        self.history = [{'id': i, 'student': self.students[(i - 1) % 27], 'batch': self.batch,
            'company': {'id': 1, 'name': 'QA Company 01'}, 'position': {'id': 1, 'title': 'QA Intern 01'},
            'status': ['approved', 'removed', 'rejected', 'suggested'][(i - 1) % 4], 'match_score_at_assignment': 0 if i == 1 else None if i == 2 else 81.23,
            'category_score_component_at_assignment': 0, 'nlp_score_component_at_assignment': 61.5,
            'location_score_component_at_assignment': None, 'distance_km_at_assignment': None,
            'remarks': '<script>synthetic remarks stay text</script>' if i == 1 else 'Synthetic decision note',
            'created_at': '2026-10-20T00:00:00Z', 'updated_at': '2026-10-25T00:00:00Z',
            'approved_at': '2026-10-23T00:00:00Z', 'removed_at': '2026-10-24T00:00:00Z', 'rejected_at': '2026-10-24T01:00:00Z',
            **{key: {'id': 99, 'name': 'QA Coordinator'} for key in ['assigned_by', 'approved_by', 'removed_by', 'rejected_by']}} for i in range(1, 26)]
        self.context = browser.new_context(viewport={'width': 1366, 'height': 1000}, reduced_motion='reduce')
        self.user = {'id': 99, 'role': role, 'name': 'QA Staff', 'is_approved': True}
        self.context.add_init_script("localStorage.setItem('sb-token','synthetic-only');localStorage.setItem('sb-role'," + json.dumps(role) + ");localStorage.setItem('sb-user'," + json.dumps(json.dumps(self.user)) + ");window.EventSource=class {close(){}};")
        self.context.route('**/*', self.route)
        self.page = self.context.new_page()
        self.page.set_default_timeout(10000)
        self.page.set_default_navigation_timeout(30000)
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))

    def route(self, route):
        parsed = urlparse(route.request.url)
        if parsed.hostname not in ['localhost', '127.0.0.1']:
            return route.abort()
        path, query = parsed.path, parse_qs(parsed.query)
        if not path.startswith('/api/'):
            return route.continue_()
        if route.request.method != 'GET':
            if path == '/api/placements/draft/' and route.request.post_data_json == {'action': 'sync'}:
                return route.fulfill(json={**self.draft, 'changed': False})
            self.writes.append((path, route.request.post_data_json))
            return route.fulfill(status=405, json={'error': 'No real placement writes in layout checks'})
        if path == '/api/auth/me/':
            return route.fulfill(json=self.user)
        if path == '/api/management/analytics/':
            return route.fulfill(json={'role': self.role, 'generated_at': '2026-10-25T00:00:00Z', 'scope': {},
                'summary': {key: 0 for key in ['students', 'required_complete', 'approved', 'unplaced', 'awaiting_review', 'needs_followup', 'slots_remaining']},
                **{key: [] for key in ['students', 'placement_students', 'assessments', 'batches', 'skills', 'capacity', 'match_bands', 'companies', 'areas', 'geography', 'activity']},
                'options': {key: [] for key in ['batches', 'instructors', 'courses', 'assessments', 'companies', 'positions', 'areas']}})
        if path == '/api/placements/draft/':
            return route.fulfill(json=self.draft)
        if path == '/api/placements/suggestions/':
            return route.fulfill(json={'companies': self.companies[:self.company_limit], 'eligible_students': self.students, 'approved_placements': self.history[:1]})
        if path == '/api/placements/':
            rows = self.history[:self.history_limit]
            term = query.get('q', [''])[0].lower()
            if term:
                rows = [row for row in rows if term in (row['student']['name'] + row['student']['school_id'] + row['company']['name'] + row['position']['title']).lower()]
            if query.get('status'):
                rows = [row for row in rows if row['status'] == query['status'][0]]
            if query.get('batch_id'):
                rows = [row for row in rows if str(row['batch']['id']) == query['batch_id'][0]]
            offset, limit = int(query.get('offset', [0])[0]), int(query.get('limit', [10])[0])
            return route.fulfill(json={'count': len(rows), 'placements': rows[offset:offset + limit]})
        return route.fulfill(json=[])

    def open(self):
        self.page.goto(BASE + f'/{self.role}/placements')
        self.page.wait_for_load_state('networkidle')
        expect(self.page.get_by_role('button', name='Open company QA Company 01', exact=True)).to_be_visible()
        return self.page

    def refresh(self, url):
        self.page.evaluate('async url => { const {invalidateCache}=await import("/src/hooks/useApi.js"); invalidateCache(url) }', url)

    def close(self):
        assert not self.errors, self.errors
        assert not self.writes, self.writes
        self.context.close()


def choose(page, name):
    page.get_by_role('navigation', name='Placement views').get_by_role('button', name=name).click()


def geometry(page):
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Page overflows'
    for selector in ['.pl-company', '.pl-history', '.pl-allocation-list', '.pl-filters']:
        for node in page.locator(selector).all():
            assert node.evaluate('el => el.scrollWidth <= el.clientWidth + 1'), selector


def run_checks():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome', headless=True)
        for role in ['instructor', 'admin']:
            print(f'Checking placement collections: {role}', flush=True)
            f = Fixture(browser, role)
            page = f.open()
            for width, height in [(320, 568), (375, 812), (768, 1024), (1024, 768), (1366, 1000), (812, 375)]:
                page.set_viewport_size({'width': width, 'height': height})
                for dark in [False, True]:
                    page.evaluate('dark => document.documentElement.classList.toggle("dark", dark)', dark)
                    for name, key in [('Companies', 'companies'), (re.compile('^Awaiting allocation'), 'awaiting'), ('Decision history', 'history')]:
                        choose(page, name)
                        geometry(page)
                        if key == 'companies':
                            expect(page.locator('.pl-company')).to_have_count(10)
                            card = page.get_by_role('button', name='Open company QA Company 01', exact=True)
                            expect(card.get_by_text('3 approved', exact=True)).to_be_visible()
                            expect(card.get_by_text('3 suggested', exact=True)).to_be_visible()
                            expect(card.get_by_text('2 available', exact=True)).to_be_visible()
                            assert card.locator('.pl-capacity-strip > span').evaluate_all('els => els.map(el => el.style.width)') == ['37.5%', '37.5%']
                        elif key == 'awaiting':
                            expect(page.locator('.pl-awaiting')).to_have_count(10)
                            expect(page.get_by_text('Results incomplete or stale', exact=True).first).to_be_visible()
                        else:
                            expect(page.locator('.pl-history-row')).to_have_count(10)
                            expect(page.locator('.pl-history-row').first.locator('.pl-history-score')).to_have_text('0%')
                            expect(page.locator('.pl-history-row').nth(1).locator('.pl-history-score')).to_have_text('Manual / no score')
                        if width in [375, 1366] and not dark:
                            page.screenshot(path=str(OUT / f'{role}-{key}-{width}.png'), full_page=True)
                    checks.append(f'{role} {width}x{height} {dark=}: all three collections, capacity proportions, explicit zero/missing snapshots and geometry')
            page.set_viewport_size({'width': 1366, 'height': 1000})
            choose(page, 'Companies')
            page.get_by_role('navigation', name='companies pages').get_by_role('button', name='2', exact=True).click()
            expect(page.locator('.pl-company')).to_have_count(3)
            f.company_limit = 2
            f.refresh('/api/placements/suggestions/?include_history=true&include_placed=true')
            expect(page.locator('.pl-company')).to_have_count(2)
            f.company_limit = 13
            f.refresh('/api/placements/suggestions/?include_history=true&include_placed=true')
            expect(page.locator('.pl-company')).to_have_count(10)
            expect(page.get_by_role('button', name='Open company QA Company 01', exact=True)).to_be_visible()
            page.get_by_label('Search', exact=True).fill('QA Company 13')
            expect(page.locator('.pl-company')).to_have_count(1)
            page.get_by_role('button', name='Clear filters', exact=True).click()
            page.get_by_role('button', name='Open company QA Company 01', exact=True).click()
            page.get_by_role('button', name='Review candidate', exact=True).first.click()
            expect(page.get_by_role('dialog', name='Review suggested placement')).to_be_visible()
            page.keyboard.press('Escape')
            page.get_by_role('button', name='Back to companies', exact=False).click()
            checks.append(f'{role}: company pagination/clamp/regrowth, search reset and existing position/candidate review')

            choose(page, re.compile('^Awaiting allocation'))
            pages = page.get_by_role('navigation', name='students pages')
            pages.get_by_role('button', name='3', exact=True).click()
            expect(page.locator('.pl-awaiting')).to_have_count(5)
            page.get_by_label('Search', exact=True).fill('QA-001')
            expect(page.locator('.pl-awaiting')).to_have_count(1)
            button = page.get_by_role('button', name='View allocation details for QA Student 01', exact=True)
            button.focus()
            page.keyboard.press('Enter')
            details = page.get_by_role('dialog', name='Student allocation details', exact=True)
            expect(details).to_be_visible()
            details.get_by_role('button', name=re.compile('QA Intern 01')).click()
            expect(page.locator('dialog[open]')).to_have_count(2)
            page.keyboard.press('Escape')
            expect(details).to_be_visible()
            page.keyboard.press('Escape')
            expect(button).to_be_focused()
            page.get_by_role('button', name='Clear filters', exact=True).click()
            checks.append(f'{role}: allocation pages/search reset, keyboard details, preserved alternatives and nested review return')

            choose(page, 'Decision history')
            page.get_by_role('navigation', name='decisions pages').get_by_role('button', name='3', exact=True).click()
            expect(page.locator('.pl-history-row')).to_have_count(5)
            page.get_by_label('Search', exact=True).fill('QA-001')
            expect(page.locator('.pl-history-row')).to_have_count(1)
            control = page.get_by_role('button', name='Decision details for QA Student 01', exact=True)
            control.click()
            snapshot = page.get_by_role('dialog', name='Placement decision details', exact=True)
            expect(snapshot.get_by_text('<script>synthetic remarks stay text</script>', exact=True)).to_be_visible()
            expect(snapshot.get_by_text('0%', exact=True)).to_have_count(2)
            expect(snapshot.get_by_text('Not recorded', exact=True)).to_be_visible()
            expect(snapshot.get_by_role('button', name='Approve student', exact=True)).to_have_count(0)
            page.keyboard.press('Escape')
            expect(control).to_be_focused()
            page.get_by_role('button', name='Clear filters', exact=True).click()
            page.get_by_label('Decision', exact=True).select_option('removed')
            expect(page.locator('.pl-history-row')).to_have_count(6)
            page.get_by_label('Search', exact=True).fill('NO_RESULTS_SENTINEL')
            expect(page.get_by_role('heading', name='No decisions match these filters', exact=True)).to_be_visible()
            page.get_by_role('button', name='Clear filters', exact=True).click()
            checks.append(f'{role}: server history paging/filtering, escaped remarks, precise zero/missing components, read-only details and empty filtered state')
            f.close()
        browser.close()
    (OUT / 'results.json').write_text(json.dumps({'checks': checks}, indent=2), encoding='utf-8')
    print(json.dumps({'passed_groups': len(checks), 'artifacts': str(OUT.resolve())}, indent=2), flush=True)


if __name__ == "__main__":
    run_checks()
