"""Real isolated API dashboard flow plus synthetic overflow/failure presentation."""
import json
from urllib.parse import parse_qs, urlparse
from playwright.sync_api import expect, sync_playwright
from organization_playwright import BASE, OUT, api, errors, session


def metric(page, label):
    return page.get_by_role('link', name=label, exact=True).locator('..').locator('..').locator('dd').first


with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    context, page = session(browser)
    page.goto(BASE + '/admin/dashboard', wait_until='networkidle')
    payload = api(context, '/api/management/analytics/?view=dashboard').json()
    options = api(context, '/api/management/organization-options/').json()
    expect(metric(page, 'Students')).to_have_text(str(payload['summary']['students']))
    expect(page.get_by_role('region', name='All students', exact=True)).to_be_visible()
    expect(page.get_by_label('Program', exact=True)).to_be_disabled()
    expect(page.get_by_role('region', name='Top matches by institute', exact=True)).to_be_visible()
    assert len(page.locator('[aria-label="Dashboard summary"] > div').all()) == 4
    print('PASS school-wide real cohort, four summaries and immediate student collection')

    # Navigate both levels using the actual saved institute/program definitions.
    populated = next(row for row in payload['students'] if row['program_id'])
    inst = next(row for row in options['institutes'] if row['id'] == populated['institute_id'])
    program = next(row for row in options['programs'] if row['id'] == populated['program_id'])
    page.get_by_role('button', name=f'View matches for {inst["name"]}', exact=True).click()
    expect(page.get_by_label('Institute', exact=True)).to_have_value(str(inst['id']))
    expect(page.get_by_role('region', name='Skill results by program', exact=True)).to_be_visible()
    expect(page.get_by_role('heading', name='Student performance', exact=True)).to_be_focused()
    page.get_by_role('button', name=f'View skill results for {program["name"]}', exact=True).press('Enter')
    expect(page.get_by_label('Program', exact=True)).to_have_value(str(program['id']))
    expect(page.get_by_role('region', name='Top matches', exact=True)).to_be_visible()
    chosen = api(context, f'/api/management/analytics/?view=dashboard&institute_id={inst["id"]}&program_id={program["id"]}').json()
    expect(metric(page, 'Students')).to_have_text(str(chosen['summary']['students']))
    collection = page.get_by_role('region', name='All students', exact=True)
    student = chosen['students'][0]
    collection.get_by_role('button', name=student['name'], exact=False).first.click()
    expect(page.get_by_role('dialog', name=student['name'], exact=True)).to_be_visible()
    expect(page.get_by_role('dialog', name=student['name'], exact=True)).to_contain_text('read-only')
    page.keyboard.press('Escape')
    expect(collection.get_by_role('button', name=student['name'], exact=False).first).to_be_focused()
    page.get_by_label('Institute', exact=True).select_option('')
    expect(page.get_by_label('Program', exact=True)).to_have_value('')
    print('PASS institute/program keyboard drilldown, real scoped counts, read-only detail and dependent reset')

    # Add only test-local empty organizations so overflow is exercised without
    # changing configured school data or inventing production records.
    for index in range(6):
        response = api(context, '/api/admin/institutes/', 'post', {'code': f'DEMO{index}', 'name': f'Layout Institute {index}', 'banner_color': index})
        assert response.status == 201, response.text()
    page.reload(wait_until='networkidle')
    track = page.get_by_role('list', name='Top matches by institute cards', exact=True)
    page.get_by_role('button', name='Next top matches by institute', exact=True).click()
    page.wait_for_function("document.querySelector('.dashboard-carousel-track').scrollLeft > 50")
    assert track.evaluate("n => getComputedStyle(n).scrollbarWidth === 'none'")
    track.focus()
    track.press('Home')
    page.wait_for_function("document.querySelector('.dashboard-carousel-track').scrollLeft < 2")
    track.press('End')
    page.wait_for_function("document.querySelector('.dashboard-carousel-track').scrollLeft > 50")
    last = track.get_by_role('button').last
    last.focus()
    assert last.evaluate('n => n.getBoundingClientRect().right <= n.closest("ul").getBoundingClientRect().right + 2')
    assert page.get_by_role('list', name='Skill results by institute cards').evaluate('n => n.scrollLeft') == 0
    print('PASS independent native carousels, arrow and keyboard scrolling, focus reveal and hidden scrollbars')

    # The same paginated student list switches presentation without losing filters.
    collection.get_by_role('searchbox', name='Search dashboard students').fill('not-a-real-learner')
    expect(collection.get_by_text('No students match your filters.', exact=True)).to_be_visible()
    collection.get_by_role('button', name='Clear student filters', exact=True).click()
    collection.get_by_role('button', name='Card view', exact=True).click()
    assert collection.locator('article').count() == min(6, len(payload['students']))
    collection.get_by_role('button', name='List view', exact=True).click()
    page.get_by_text('Attention and administration', exact=False).click()
    expect(page.get_by_role('region', name='Needs attention', exact=True)).to_be_visible()
    print('PASS student search/clear, shared card/list slice and retained attention tools')

    for width in (320, 390, 768, 1024, 1440, 1920):
        page.set_viewport_size({'width': width, 'height': 1000})
        page.goto(BASE + '/admin/dashboard', wait_until='networkidle')
        if width in (390, 1024):
            page.evaluate("document.documentElement.classList.add('dark')")
        expect(page.get_by_role('heading', name='Student performance', exact=True)).to_be_visible()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), width
        first_track = page.get_by_role('list', name='Top matches by institute cards')
        if width >= 1440:
            visible = first_track.evaluate('''n => {const b=n.getBoundingClientRect();return [...n.children].filter(c=>{const r=c.getBoundingClientRect();return r.left >= b.left-1 && r.right <= b.right+1}).length}''')
            assert visible == 4, (width, visible)
        page.screenshot(path=str(OUT / f'dashboard-drilldown-{width}.png'), full_page=True, animations='disabled')
    page.emulate_media(reduced_motion='reduce')
    track = page.get_by_role('list', name='Top matches by institute cards')
    page.get_by_role('button', name='Next top matches by institute', exact=True).click()
    assert track.evaluate('n => n.scrollLeft') > 0
    print('PASS six responsive widths, four complete desktop cards, light/dark and reduced motion')

    page.goto(BASE + '/admin/dashboard?institute=999999&program=999999', wait_until='networkidle')
    expect(page.get_by_role('alert').filter(has_text='scope is unavailable')).to_be_visible()
    expect(page.get_by_label('Dashboard summary', exact=True)).to_have_count(0)
    # A failed new scope cannot show the previous school's numbers as its own.
    page.route('**/api/management/analytics/**', lambda route: route.fulfill(status=503, json={'error': 'Synthetic dashboard outage'}))
    page.goto(BASE + f'/admin/dashboard?institute={inst["id"]}&batch_status=archived', wait_until='networkidle')
    expect(page.get_by_role('alert').filter(has_text='Could not refresh')).to_be_visible()
    expect(page.get_by_label('Dashboard summary', exact=True)).to_have_count(0)
    page.unroute('**/api/management/analytics/**')
    page.get_by_role('button', name='Retry dashboard', exact=True).click()
    expect(metric(page, 'Students')).to_be_visible()
    print('PASS invalid scope, failure without foreign cached totals and explicit retry')

    # Presentation-only evidence fixtures exercise a populated program without
    # regrading real/synthetic saved assessment attempts or refreshing rankings.
    projection = json.loads(json.dumps(chosen))
    projection['skills'] = [{'id': 900 + i, 'name': f'Layout skill {i + 1}'} for i in range(6)]
    original = chosen['students'][0]
    projection['students'] = []
    for i in range(9):
        learner = {**original, 'id': original['id'] if i == 0 else 9000 + i,
            'name': original['name'] if i == 0 else f'ZZZ Layout learner {i}',
            'required_complete': True, 'required_completed': 1, 'required_total': 1,
            'placement_status': 'approved' if i == 0 else 'unplaced', 'awaiting_review': i > 0, 'reasons': [],
            'recommendations_locked': False, 'competency_locked': False,
            'combined_category_scores': [{'category_id': 900 + n, 'category': f'Layout skill {n + 1}',
                'percentage': 0 if i == n == 0 else 90 if i == 0 else 70, 'raw_score': 0 if i == n == 0 else 90 if i == 0 else 70,
                'max_score': 100, 'source_assessment_ids': []} for n in range(6)],
            'top_recommendations': [{'position': 'Synthetic preview position', 'company': 'Synthetic preview partner',
                'ranking_policy': 'assessment-evidence-match-v2', 'match_percentage': 77.777777, 'match_score': 20}]}
        learner['detail_url'] = f'/api/instructor/batches/{learner["batch_id"]}/students/?student_id={learner["id"]}'
        projection['students'].append(learner)
    projection['summary'].update(students=9, required_complete=9, completion_rate=100,
        approved=1, approved_other_batch=0, unplaced=8, placement_rate=11.1, needs_followup=0, awaiting_review=8)
    projection['dashboard_attention'].update(pending_retakes=0, retake_scopes=[], batches_without_required=[], unavailable_results=0)
    def dashboard_projection(route):
        query = parse_qs(urlparse(route.request.url).query)
        if query.get('view') == ['dashboard']:
            route.fulfill(json=projection)
        else:
            route.fallback()
    page.route('**/api/management/analytics/**', dashboard_projection)
    page.evaluate('sessionStorage.clear()')
    page.goto(BASE + f'/admin/dashboard?institute={inst["id"]}&program={program["id"]}', wait_until='networkidle')
    expect(page.get_by_role('button', name=f'View top match for {original["name"]}', exact=True)).to_contain_text('77.8%')
    skill_track = page.get_by_role('list', name='Top performers by skill cards')
    expect(skill_track.get_by_role('button')).to_have_count(6)
    assert skill_track.evaluate("n => getComputedStyle(n).scrollbarWidth === 'none'")
    collection = page.get_by_role('region', name='All students', exact=True)
    collection.get_by_role('button', name='Next →', exact=True).click()
    expect(collection.get_by_text('Showing 7–9 of 9', exact=True)).to_be_visible()
    # Apply the same mounted-query event used by realtime invalidation. The
    # dashboard's existing controls/page stay mounted as fresh data arrives.
    projection['students'][0]['top_recommendations'][0]['match_percentage'] = 87.7777
    live_url = f'/api/management/analytics/?view=dashboard&institute_id={inst["id"]}&program_id={program["id"]}'
    page.evaluate("url => window.dispatchEvent(new CustomEvent('sse:data_changed', {detail:{urls:[url]}}))", live_url)
    expect(page.get_by_role('button', name=f'View top match for {original["name"]}', exact=True)).to_contain_text('87.8%')
    expect(collection.get_by_text('Showing 7–9 of 9', exact=True)).to_be_visible()
    page.get_by_role('button', name='View Layout skill 6 ranking', exact=True).click()
    expect(page.get_by_role('dialog', name='Layout skill 6 Leaderboard', exact=True)).to_be_visible()
    page.keyboard.press('Escape')
    expect(page.get_by_role('button', name='View Layout skill 6 ranking', exact=True)).to_be_focused()
    skill_track.evaluate('n => n.scrollTo({left: 0})')
    page.evaluate('window.scrollTo(0, 0)')
    page.screenshot(path=str(OUT / 'dashboard-program-populated-1920.png'), full_page=True, animations='disabled')
    collection.get_by_role('searchbox', name='Search dashboard students').fill('ZZZ Layout learner 1')
    expect(collection.get_by_text('1 students', exact=True)).to_be_visible()
    expect(collection.get_by_text('Showing 7–9 of 9', exact=True)).to_have_count(0)
    print('PASS populated program carousel, zero evidence, rounded Match, leaderboard, pagination and silent event refresh without page reset')
    assert not errors, errors
    context.close()
    browser.close()
