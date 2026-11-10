"""Both real staff routes render the extracted instructor table/cards consistently.

Only the dashboard read projections are synthetic here. Details use the existing
authorized routes; no school database or saved grades are changed.
"""
import json
from urllib.parse import parse_qs, urlparse
from playwright.sync_api import expect, sync_playwright
from organization_playwright import BASE, OUT, api, errors, session


with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    seed_context, seed_page = session(browser)
    seed = api(seed_context, '/api/management/analytics/?view=dashboard').json()
    original = seed['students'][0]
    projected = json.loads(json.dumps(seed))
    projected['students'] = []
    projected['skills'] = [{'id': 981, 'name': 'Communication'}, {'id': 982, 'name': 'Documentation'}]
    for i in range(9):
        student_id = original['id'] if i == 0 else 9000 + i
        categories = [] if i == 8 else [
            {'category_id': 981, 'category': 'Communication', 'percentage': 0 if i == 0 else 80, 'raw_score': 0 if i == 0 else 8, 'max_score': 10},
            *([] if i == 1 else [{'category_id': 982, 'category': 'Documentation', 'percentage': 100, 'raw_score': 10, 'max_score': 10}])]
        recs = [] if i == 8 else [{'company': 'Synthetic Partner', 'position': 'Synthetic Intern', 'match_score': 20,
            'ranking_policy': 'assessment-evidence-match-v2', 'match_percentage': 77.77777}]
        row = {**original, 'id': student_id, 'name': original['name'] if i == 0 else f'ZZZ Shared UI learner {i}',
            'course': 'SYN', 'school_id': f'SYN-{i}', 'required_complete': i < 8, 'required_completed': int(i < 8),
            'required_total': 1, 'competency_locked': i == 8, 'recommendations_locked': i == 8,
            'combined_category_scores': categories, 'top_recommendations': recs, 'reasons': [],
            'placement_status': 'approved_other_batch' if i == 2 else 'approved' if i == 1 else 'unplaced'}
        row['detail_url'] = f'/api/instructor/batches/{row["batch_id"]}/students/?student_id={student_id}'
        projected['students'].append(row)
    projected['summary'].update(students=9, required_complete=8, completion_rate=88.9, approved=1, approved_other_batch=1, unplaced=7, placement_rate=11.1)
    teacher_rows = [{**row, 'has_submitted': row['required_complete'], 'completed_required_count': row['required_completed'],
        'total_required_count': row['required_total'], 'batch': {'id': row['batch_id'], 'name': row['batch'], 'status': 'active'},
        'placement': {'status': row['placement_status']}, 'assessment_results': []} for row in projected['students']]
    seed_context.close()
    signatures = {}
    for role in ('instructor', 'admin'):
        context, page = session(browser, role=role)
        def projections(route):
            url = urlparse(route.request.url)
            if url.path == '/api/management/analytics/' and parse_qs(url.query).get('view') == ['dashboard']:
                route.fulfill(json=projected)
            elif url.path == '/api/instructor/students/recommendations/':
                route.fulfill(json=teacher_rows)
            else:
                route.fallback()
        page.route('**/api/**', projections)
        page.goto(BASE + f'/{role}/dashboard', wait_until='networkidle')
        collection = page.get_by_role('region', name='All students', exact=True)
        expect(collection).to_be_visible()
        headers = collection.locator('thead th').all_text_contents()
        assert [text.replace('↑', '').replace('↕', '').strip() for text in headers] == ['Student', 'Status', 'Placement', 'Skills', 'Top suggestion', 'Overall'], headers
        first = collection.locator(f'tr[data-student-id="{original["id"]}"]')
        expect(first).to_contain_text('50%')
        expect(first).to_contain_text('77.8%')
        expect(first).to_contain_text('Communication 0%')
        expect(collection.locator('tr[data-student-id="9002"]')).to_contain_text('Approved in another batch')
        signatures[role] = {'table': collection.locator('table').get_attribute('class'), 'header': collection.locator('thead tr').get_attribute('class'), 'row': first.get_attribute('class')}
        first.focus()
        first.press('Enter')
        expect(page.get_by_role('dialog', name=original['name'], exact=True)).to_be_visible()
        page.keyboard.press('Escape')
        expect(first).to_be_focused()
        print(f'PASS {role}: shared six-column table, true zero, independent Match, approval elsewhere and keyboard details/focus')

        collection.get_by_role('button', name='Next →', exact=True).click()
        expect(collection.get_by_text('Showing 7–9 of 9', exact=True)).to_be_visible()
        collection.get_by_role('button', name='Card view', exact=True).click()
        cards = collection.locator('[role="button"][data-student-id]')
        expect(cards).to_have_count(3)
        collection.get_by_role('button', name='List view', exact=True).click()
        expect(collection.get_by_text('Showing 7–9 of 9', exact=True)).to_be_visible()
        collection.get_by_role('searchbox', name='Search dashboard students').fill('SYN-0')
        expect(collection.get_by_text('1 students', exact=True)).to_be_visible()
        expect(collection.get_by_text('Showing 7–9 of 9', exact=True)).to_have_count(0)
        collection.get_by_role('button', name='Card view', exact=True).click()
        card = collection.locator(f'[role="button"][data-student-id="{original["id"]}"]')
        signatures[role]['card'] = card.get_attribute('class')
        expect(card).to_contain_text('Best in')
        expect(card).to_contain_text('Documentation')
        expect(card).to_contain_text('Synthetic Partner')
        expect(card).to_contain_text('50%')
        expect(card).to_contain_text('77.8%')
        card.hover()
        assert card.evaluate('n => getComputedStyle(n).boxShadow !== "none"')
        card.focus()
        card.press('Space')
        expect(page.get_by_role('dialog', name=original['name'], exact=True)).to_be_visible()
        page.keyboard.press('Escape')
        expect(card).to_be_focused()
        collection.get_by_role('searchbox', name='Search dashboard students').fill('nothing matches this')
        expect(collection.get_by_text('No students match your filters.', exact=True)).to_be_visible()
        collection.get_by_role('button', name='Clear filters', exact=True).click()
        expect(cards).to_have_count(6)
        print(f'PASS {role}: same cards/best-skill/company strip, full-card hover/keyboard, filter reset and equivalent paginated slices')

        collection.get_by_role('button', name='List view', exact=True).click()
        collection.get_by_role('button', name='Overall', exact=False).click()
        expect(collection.locator('thead th').last).to_have_attribute('aria-sort', 'ascending')
        # The earned zero remains part of the mean; missing categories do not
        # become 0%, undefined% or a guessed company score.
        expect(collection.locator('tbody tr').first).to_contain_text('50%')
        assert 'undefined%' not in collection.inner_text() and 'null%' not in collection.inner_text()
        for width, dark in ((375, False), (768, True), (1440, False)):
            page.set_viewport_size({'width': width, 'height': 1000})
            page.evaluate('(dark) => document.documentElement.classList.toggle("dark", dark)', dark)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), (role, width)
            if width == 375:
                expect(collection.locator('[role="button"][data-student-id]').first).to_be_visible()
            page.screenshot(path=str(OUT / f'shared-dashboard-{role}-{width}.png'), full_page=True, animations='disabled')
        print(f'PASS {role}: accessible sort, honest missing scores, phone cards, tablet-contained table and dark/desktop layout')
        context.close()
    assert signatures['admin'] == signatures['instructor'], signatures
    assert not errors, errors
    print('PASS both real dashboard routes use identical shared table, row, header and card styling')
    browser.close()
