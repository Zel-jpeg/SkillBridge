"""Production UI formatting for missing match scores; synthetic GET fixtures only."""
from urllib.parse import urlparse
from copy import deepcopy

from playwright.sync_api import expect, sync_playwright
from organization_playwright import BASE, OUT, checks, errors, session


USER = {'id': 1, 'name': 'Synthetic learner', 'role': 'student', 'is_approved': True,
        'phone': 'synthetic', 'profile_completed': True, 'school_id': 'SYN', 'course': 'Custom program'}
DETAILS = {'policy': 'assessment-average-match-v1', 'required_mean': None, 'coverage': 50,
           'all_targets_met': False, 'unknown': 1, 'requirements': [
               {'category': 'Assessed category', 'assessed_percentage': 80, 'target': 70},
               {'category': 'Unassessed category', 'assessed_percentage': None, 'target': 60}]}
RECOMMENDATION = {'id': 1, 'position_id': 1, 'company_id': 1, 'company': 'Synthetic partner',
    'position': 'Synthetic opening', 'tags': ['Assessed category', 'Unassessed category'], 'slots': 2,
    'assessment_rank': 1, 'recommendation_rank': 1, 'ranking_policy': DETAILS['policy'],
    'match_percentage': None, 'assessment_details': DETAILS, 'requirement_coverage': 50,
    'match_score': 77, 'nlp_score_component': 60, 'location_score_component': 50}
RESULT = {'recommendations_locked': False, 'competency_locked': False, 'all_required_completed': True,
    'is_finalized': True, 'has_submitted': True, 'completed_required_count': 1, 'total_required_count': 1,
    'remaining_required_count': 0, 'combined_category_scores': [
        {'category': 'Assessed category', 'raw_score': 8, 'max_score': 10, 'percentage': 80}],
    'recommendations': [RECOMMENDATION], 'combined_competency_profile': {}, 'placement': None}


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel='chrome', headless=True)
    try:
        for width in (390, 1440):
            context, page = session(browser, 'student', width=width, dark=width == 390)
            payload = deepcopy(RESULT)
            def fixture(route):
                path = urlparse(route.request.url).path
                if not path.startswith('/api/'):
                    return route.fallback()
                assert route.request.method == 'GET', 'Display checks must not write records'
                if path in ('/api/students/me/', '/api/auth/me/'):
                    return route.fulfill(json=USER)
                if path == '/api/student/results/combined/':
                    return route.fulfill(json=payload)
                return route.fulfill(json=[])
            context.route('**/api/**', fixture)
            page.goto(BASE + '/student/results', wait_until='networkidle')
            card = page.locator('article').filter(has=page.get_by_text('Synthetic partner', exact=True))
            expect(card.get_by_text('80% partial', exact=True)).to_be_visible()
            expect(card.get_by_role('button', name='Match: explanation', exact=True)).to_be_visible()
            expect(card.get_by_text('1 of 2 required categories assessed · some categories are not assessed yet.', exact=True)).to_be_visible()
            expect(card.get_by_text('0%', exact=True)).to_have_count(0)
            expect(page.get_by_text('Incomplete evidence', exact=True)).to_have_count(0)
            card.get_by_text('View match breakdown', exact=True).click()
            expect(card.get_by_text('Some required categories have no assessment results yet.', exact=True)).to_be_visible()
            expect(card.get_by_text('Unassessed category', exact=True).last).to_be_visible()
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
            page.screenshot(path=str(OUT / f'missing-match-{width}.png'), full_page=True, animations='disabled')
            payload['recommendations'][0]['assessment_details']['requirements'][0]['assessed_percentage'] = None
            payload['recommendations'][0]['assessment_details']['unknown'] = 2
            # This is a new static fixture, not a simulated realtime event.
            page.evaluate('sessionStorage.clear()')
            page.reload(wait_until='networkidle')
            expect(card.get_by_text('0/2 assessed', exact=True)).to_be_visible()
            expect(card.get_by_text('0%', exact=True)).to_have_count(0)
            context.close()
            checks.append(f'{width}px: partial Match shows assessed-only percentage/counts; no assessed categories show counts without an invented percentage')
    finally:
        browser.close()
assert not errors, errors
for check in checks:
    print('PASS ' + check)
