"""Selected-company position workspace: role matrix, candidate semantics and responsive interactions."""
import json
import re
import sys
from copy import deepcopy
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from placement_collections_playwright import Fixture, geometry
from playwright.sync_api import sync_playwright, expect

OUT = Path(__file__).parent / 'artifacts' / 'position-workspace'
OUT.mkdir(parents=True, exist_ok=True)
checks = []


def prepare(browser, role):
    f = Fixture(browser, role)
    # Many synthetic matches in backend order; missing/zero remain distinct.
    values = [88.4, 85, 80, 76.25, None, 63.1, 41.94, 0] + [0] * 19
    f.companies[0]['positions'] = []
    for index, title in enumerate(['Backend Developer Intern', 'Frontend Developer Intern With An Extended Synthetic Role Title', 'No matching candidates', 'No remaining slots']):
        suggestions = [{**deepcopy(f.suggestion), 'recommendation_id': (index + 1) * 100 + student['id'],
            'student': student, 'match_score': values[student['id'] - 1], 'distance_km': 0 if student['id'] == 1 else 4.22,
            'placement_status': 'approved' if student['id'] == 27 else 'unplaced'} for student in f.students] if index < 2 else []
        f.companies[0]['positions'].append({'id': 101 + index, 'title': title, 'slots_available': 6 if index == 0 else 4 if index == 1 else 0,
            'approved_count': 1 if index == 0 else 0, 'remaining_slots': 5 if index == 0 else 4 if index == 1 else 0,
            'suggested_students': suggestions})
    f.draft['proposed_counts'] = {'101': 2, '102': 1}
    for row in f.draft['students']:
        student_id = row['student']['id']
        row['batch'] = f.batch if student_id <= 13 else {'id': 2, 'name': 'QA Second Batch'}
        for company in f.companies:
            for position in company['positions']:
                for suggestion in position['suggested_students']:
                    if suggestion['student']['id'] == student_id:
                        suggestion['batch'] = row['batch']
        if student_id in [1, 3]:
            row['proposal'] = {'id': 100 + student_id, 'position_id': 101, 'company_id': 1, 'company': 'QA Company 01', 'position': 'Backend Developer Intern', 'match_score': values[student_id - 1]}
        elif student_id == 2:
            row['proposal'] = {'id': 202, 'position_id': 102, 'company_id': 1, 'company': 'QA Company 01', 'position': 'Frontend Developer Intern With An Extended Synthetic Role Title', 'match_score': 85}
        else:
            row['proposal'] = None
        row['alternatives'] = []
    f.history[0].update(student=f.students[-1], match_score_at_assignment=None, position={'id': 101, 'title': 'Backend Developer Intern'})
    return f


def open_position(f):
    page = f.open()
    card = page.get_by_role('button', name='Open partner QA Company 01', exact=True)
    card.scroll_into_view_if_needed()
    card.click()
    expect(page.get_by_role('heading', name='QA Company 01', exact=True).first).to_be_focused()
    return page


with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    for role in ['instructor', 'admin']:
        print(f'Checking position workspace: {role}', flush=True)
        f = prepare(browser, role)
        page = open_position(f)
        panel = page.get_by_role('region', name='Position candidates')
        lists = panel.get_by_role('group', name='Position student lists')
        for width, height in [(320, 568), (375, 812), (430, 932), (640, 800), (768, 1024), (1024, 768), (1280, 800), (1366, 1000), (1920, 1080), (812, 375)]:
            page.set_viewport_size({'width': width, 'height': height})
            for dark in [False, True]:
                page.evaluate('dark => document.documentElement.classList.toggle("dark", dark)', dark)
                for view in ['Suggested (2)', 'Other ranked candidates', 'Approved (1)']:
                    lists.get_by_role('button', name=view, exact=True).click()
                    geometry(page)
                    for node in page.locator('.pl-position-review, .pl-position-candidates, .pl-position-navigation, .pl-candidate-row').all():
                        assert node.evaluate('el => el.scrollWidth <= el.clientWidth + 1'), f'{role} {width} {node.get_attribute("class")}'
                    capacity = panel.get_by_label('Position capacity across all batches')
                    expect(capacity.get_by_text('1 approved', exact=True)).to_be_visible()
                    expect(capacity.get_by_text('2 suggested', exact=True)).to_be_visible()
                    expect(capacity.get_by_text('3 available for suggestions', exact=True)).to_be_visible()
                    for actual, expected in zip(capacity.locator('.pl-capacity-strip > span').evaluate_all('els => els.map(el => parseFloat(el.style.width))'), [100 / 6, 100 / 3]):
                        assert abs(actual - expected) < 0.001
                    if view == 'Other ranked candidates':
                        expect(panel.locator('.pl-candidate-row')).to_have_count(8)
                        expect(panel.locator('.pl-candidate-row').first.locator('.pl-candidate-rank')).to_have_text('#2')
                        expect(panel.locator('.pl-candidate-match--missing')).to_have_count(1)
                        expect(panel.locator('.pl-candidate-match').filter(has_text='0%').first).to_be_visible()
                        if width in [375, 1366] and not dark:
                            page.evaluate('window.scrollTo(0,0)')
                            page.locator('body').click(position={'x': 1, 'y': 1}, force=True)
                            page.screenshot(path=str(OUT / f'{role}-ranked-{width}.png'), full_page=True)
                    elif view == 'Approved (1)':
                        expect(panel.get_by_text('Manual / no score', exact=True)).to_be_visible()
                        expect(panel.get_by_role('button', name='Remove placement', exact=True)).to_be_visible()
                    else:
                        expect(panel.get_by_text('This position', exact=True)).to_have_count(2)
                checks.append(f'{role} {width}x{height} {dark=}: all candidate views, exact shared capacity, true ranks, missing/zero, no horizontal overflow')
        page.set_viewport_size({'width': 1366, 'height': 1000})
        lists.get_by_role('button', name='Other ranked candidates', exact=True).click()
        pager = panel.get_by_role('navigation', name='candidates pages')
        pager.get_by_role('button', name='3', exact=True).click()
        expect(panel.locator('.pl-candidate-row')).to_have_count(8)
        expect(pager).to_contain_text('Showing 17–24 of 24 candidates')
        page.get_by_label('Search', exact=True).fill('QA-013')
        expect(panel.locator('.pl-candidate-row')).to_have_count(1)
        expect(panel.locator('.pl-candidate-rank').last).to_have_text('#13')
        page.get_by_role('button', name='Clear filters', exact=True).click()
        expect(panel.locator('.pl-candidate-row')).to_have_count(8)
        panel.get_by_role('button', name='Hybrid match: explanation', exact=True).click()
        expect(page.get_by_role('tooltip')).to_contain_text('60% category fit')
        page.keyboard.press('Escape')
        first = panel.locator('.pl-candidate-row').first
        expect(first).to_contain_text('Frontend Developer Intern With An Extended Synthetic Role Title')
        review_button = first.get_by_role('button', name='Review candidate', exact=True)
        review_button.focus()
        page.keyboard.press('Enter')
        review = page.get_by_role('dialog', name='Review suggested placement')
        expect(review).to_be_visible()
        review.get_by_role('button', name='Approve placement', exact=True).click()
        expect(page.get_by_role('dialog', name='Placement decision', exact=True)).to_be_visible()
        page.get_by_role('dialog', name='Placement decision', exact=True).get_by_role('button', name='Cancel', exact=True).click()
        expect(review).to_be_visible()
        page.keyboard.press('Escape')
        expect(review_button).to_be_focused()
        lists.get_by_role('button', name='Suggested (2)', exact=True).click()
        expect(panel.locator('.pl-candidate-row').first).to_contain_text('0 km')
        lists.get_by_role('button', name='Approved (1)', exact=True).click()
        panel.get_by_role('button', name='Remove placement', exact=True).click()
        expect(page.get_by_role('dialog', name='Placement decision', exact=True).get_by_label('Reason (required)', exact=True)).to_be_visible()
        page.get_by_role('dialog', name='Placement decision', exact=True).get_by_role('button', name='Cancel', exact=True).click()
        panel.get_by_role('button', name='Assign manually', exact=True).click()
        expect(page.get_by_role('heading', name='Manual placement assignment', exact=True)).to_be_visible()
        page.get_by_role('button', name='Cancel', exact=True).click()
        checks.append(f'{role}: page/filter rank preservation, score help, elsewhere suggestion, keyboard review/confirmation return, removal reason and manual assignment')

        navigation = page.get_by_role('navigation', name='Partner positions')
        navigation.get_by_role('button', name='No matching candidates', exact=False).click()
        lists.get_by_role('button', name='Other ranked candidates', exact=True).click()
        expect(panel.get_by_role('heading', name='No students in this view', exact=True)).to_be_visible()
        navigation.get_by_role('button', name='Frontend Developer Intern With An Extended Synthetic Role Title', exact=False).click()
        expect(panel.get_by_role('heading', name='Frontend Developer Intern With An Extended Synthetic Role Title', exact=True)).to_be_visible()
        lists.get_by_role('button', name='Other ranked candidates', exact=True).click()
        page.get_by_label('Student scope', exact=True).select_option('2')
        expect(panel.locator('.pl-candidate-row').first.locator('.pl-candidate-rank')).to_have_text('#14')
        page.get_by_role('button', name='Clear filters', exact=True).click()
        # Live shrink clamps page state; subsequent growth should not jump back.
        # With four pages, page 3 is intentionally hidden behind an ellipsis
        # while page 1 is active. Use the same visible navigation as a user.
        pager.get_by_role('button', name='Next', exact=False).click()
        pager.get_by_role('button', name='Next', exact=False).click()
        original = deepcopy(f.companies[0]['positions'][1]['suggested_students'])
        f.companies[0]['positions'][1]['suggested_students'] = original[:3]
        f.refresh('/api/placements/suggestions/?include_history=true&include_placed=true')
        expect(panel.locator('.pl-candidate-row')).to_have_count(2)
        f.companies[0]['positions'][1]['suggested_students'] = original
        f.refresh('/api/placements/suggestions/?include_history=true&include_placed=true')
        expect(panel.locator('.pl-candidate-row')).to_have_count(8)
        expect(panel.locator('.pl-candidate-row').first.locator('.pl-candidate-rank')).to_have_text('#1')
        page.get_by_role('button', name='Back to partners', exact=False).click()
        expect(page.get_by_role('button', name='Open partner QA Company 01', exact=True)).to_be_focused()
        checks.append(f'{role}: position selection, empty state, batch scope with stable ranks, live page clamp/regrowth and Back focus restoration')
        f.close()
    browser.close()
(OUT / 'results.json').write_text(json.dumps({'checks': checks}, indent=2), encoding='utf-8')
print(json.dumps({'passed_groups': len(checks), 'artifacts': str(OUT.resolve())}, indent=2), flush=True)
