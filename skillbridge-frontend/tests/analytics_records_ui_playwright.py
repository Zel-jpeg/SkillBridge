"""Actual admin/instructor analytics UI with synthetic read-only API responses."""
from copy import deepcopy
import json
import os
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('UI_TEST_BASE', 'http://127.0.0.1:5211')
OUT = Path(__file__).parent / 'artifacts' / 'analytics-records-ui'
OUT.mkdir(parents=True, exist_ok=True)
ROWS = [dict(id=i, name=f'Sample Student {i:02d}', school_id=f'QA-{i:03d}', course='BSIT',
    batch_id=1, batch='Synthetic Cohort', batch_status='active', instructor='Sample Instructor',
    required_completed=3 if i <= 8 else 1, required_total=3, required_complete=i <= 8,
    recommendations_locked=i in [4, 6], competency_locked=i == 4, scores={'1': 0 if i == 7 else 85, '2': None},
    placement_status='approved' if i == 1 else 'approved_other_batch' if i == 2 else 'unplaced',
    company='Approved Partner' if i == 1 else '', position='Approved Opening' if i == 1 else '',
    top_match=None if i == 12 else 0 if i == 7 else 85, top_match_percentage=None if i == 12 else 0 if i == 7 else 85,
    top_ranking_policy='assessment-evidence-match-v2', top_recommendation_details={'policy': 'assessment-evidence-match-v2', 'unknown': 0},
    top_company='Highest Partner', top_position='Highest Opening', awaiting_review=False,
    reasons=['Required work remaining'] if i > 8 else [], attempt_states={'1': 'submitted' if i <= 8 else 'in_progress'}) for i in range(1, 13)]
ROWS[7].update(top_ranking_policy='assessment-led-option3', top_recommendation_rank=2, top_recommendation_details={})
ROWS[0]['top_company_image_url'] = BASE + '/fixture-wide-logo.svg'
ROWS[2]['top_company_image_url'] = BASE + '/fixture-broken-logo.png'
SKILLS = [dict(id=1, name='Programming', sample=10, missing=2, strong=9, fair=0, needs_work=1, average=76.5),
          dict(id=2, name='Database', sample=0, missing=12, strong=0, fair=0, needs_work=0, average=None)]


def snapshot(role):
    students = deepcopy(ROWS)
    suggested = dict(deepcopy(students[0]), placement_status='suggested', company='Allocated Partner', position='Allocated Opening',
        partner_city_id='city-a', partner_province_id='province-a', partner_pin_status='mapped',
        suggested_recommendation={'ranking_policy': 'legacy-hybrid', 'match_score': 30}, company_image_url=BASE + '/fixture-allocated-logo.svg')
    return dict(role=role, generated_at='2026-11-10T02:00:00Z', students=students, suggested_students=[suggested], placement_students=students,
        summary=dict(students=12, required_complete=8, completion_rate=66.7, approved=1, unplaced=10, approved_other_batch=1,
            placement_rate=8.3, awaiting_review=0, needs_followup=4, slots_remaining=3),
        scope=dict(batch_ids=[1], batch_status='active', program_id=1, institute_id=1, cohort_unit='Distinct students', capacity_scope='Shared positions', course=''),
        options=dict(batches=[dict(id=1, name='Synthetic Cohort', status='active', instructor_id=7, institute_id=1, program_id=1)],
            instructors=[dict(id=7, name='Sample Instructor')], courses=['BSIT'], assessments=[], companies=[], positions=[], areas=[],
            institutes=[dict(id=1, name='Synthetic Institute', code='SI', is_active=True)],
            programs=[dict(id=1, name='Synthetic Program', code='BSIT', institute_id=1, is_active=True)]),
        skills=SKILLS, assessments=[], batches=[], companies=[], areas=[], geography=[],
        capacity=[dict(company='Approved Partner', name='Approved Opening', area='Synthetic City', total=4, occupied=1, remaining=3)],
        match_bands=[], activity=[], activity_days=[dict(date='2026-11-10', submissions=2)],
        dashboard_attention=dict(retake_scopes=[], batches_without_required=[]))


errors, writes, checks = [], [], []
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    try:
        for role in ['admin', 'instructor']:
            for width, dark in [(1440, False), (768, True), (390, False), (320, True)]:
                if os.environ.get('UI_TEST_WIDTH') and str(width) != os.environ['UI_TEST_WIDTH']: continue
                context = browser.new_context(viewport={'width': width, 'height': 1000}, reduced_motion='reduce')
                user = dict(id=7, name='Sample Instructor', role=role, is_approved=True)
                values = {'sb-token': 'synthetic-only', 'sb-role': role, 'sb-user': json.dumps(user), 'sb-theme': 'dark' if dark else 'light'}
                context.add_init_script('for(const [k,v] of Object.entries(' + json.dumps(values) + '))localStorage.setItem(k,v);window.EventSource=class{close(){}};')
                def route(request):
                    url = urlparse(request.request.url)
                    if url.path in ['/fixture-wide-logo.svg', '/fixture-allocated-logo.svg']:
                        return request.fulfill(content_type='image/svg+xml', body='<svg xmlns="http://www.w3.org/2000/svg" width="200" height="50"><rect width="200" height="50" fill="#15803d"/></svg>')
                    if url.path == '/fixture-broken-logo.png': return request.fulfill(status=404, body='Synthetic missing logo')
                    if not url.path.startswith('/api/'):
                        return request.continue_() if url.hostname in ['localhost', '127.0.0.1'] else request.abort()
                    if request.request.method != 'GET':
                        writes.append(url.path)
                        return request.fulfill(status=405, json={'error': 'Read-only fixture'})
                    if url.path == '/api/management/analytics/':
                        payload = snapshot(role)
                        view = parse_qs(url.query).get('view', [''])[0]
                        if view in ['overview', 'dashboard']: payload['view'] = view
                    elif url.path.endswith('/me/'): payload = user
                    elif url.path.endswith('/students/'):
                        payload = dict(batch=dict(id=1, name='Synthetic Cohort', status='active'), students=[dict(row, assessment_results=[], top_recommendations=[], all_required_completed=row['required_complete']) for row in ROWS])
                    elif url.path.endswith('/batches/'): payload = snapshot(role)['options']['batches']
                    elif url.path in ['/api/management/programs/', '/api/management/institutes/']:
                        payload = dict(count=0, page=1, page_size=24, results=[])
                    elif url.path == '/api/management/organization-options/': payload = dict(institutes=[], programs=[])
                    elif url.path.endswith('/email-progress/'): payload = dict(storage_ready=True, groups=[])
                    else: payload = []
                    return request.fulfill(json=payload)
                context.route('**/*', route)
                page = context.new_page()
                page.set_default_timeout(12000)
                page.set_default_navigation_timeout(30000)
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.goto(BASE + f'/{role}/reports?program_id=1')
                page.wait_for_load_state('networkidle')
                records = page.locator('#analytics-records')
                expect(records.get_by_role('heading', name='Student progress and follow-up')).to_be_visible()
                table = records.get_by_role('table')
                expect(table.locator('tbody tr')).to_have_count(9)
                expect(table.locator('tbody tr').first).to_contain_text('Approved Partner')
                expect(table.locator('tbody tr').first).to_contain_text('Highest Opening')
                # A plain cell opens the same authorized detail dialog as the native name button.
                table.locator('tbody tr').first.locator('td').nth(1).click()
                dialog = page.get_by_role('dialog')
                expect(dialog).to_be_visible()
                page.keyboard.press('Escape')
                expect(table.get_by_role('button', name='View details for Sample Student 01')).to_be_focused()
                table.get_by_role('button', name='View details for Sample Student 01').press('Enter')
                expect(dialog).to_be_visible(); page.keyboard.press('Escape')
                records.get_by_role('button', name='Sort by Student', exact=True).click()
                names = table.locator('[data-record-opener]').all_text_contents()
                records.get_by_role('button', name='Card view', exact=True).click()
                cards = records.locator('.analytics-student-card')
                expect(cards).to_have_count(9)
                assert cards.locator('.sp-card-open').all_text_contents() == names
                logo = cards.first.locator('.analytics-partner-logo img')
                expect(logo).to_have_attribute('src', BASE + '/fixture-wide-logo.svg')
                logo.scroll_into_view_if_needed()
                expect(logo).to_have_js_property('complete', True)
                assert logo.evaluate('e=>e.complete && e.naturalWidth>0 && getComputedStyle(e).objectFit==="contain"')
                for index in [0, 1, 2]:
                    frame = cards.nth(index).locator('.analytics-partner-logo')
                    box = frame.bounding_box()
                    assert box['width'] == box['height'] == 32
                    strip = cards.nth(index).locator('.analytics-student-match').bounding_box()
                    assert abs((box['y']+16)-(strip['y']+strip['height']/2)) < 1
                for index in [1, 2]:
                    fallback = cards.nth(index).locator('.analytics-partner-logo [role="img"]')
                    expect(fallback).to_be_visible()
                    assert fallback.evaluate('e=>["flex","inline-flex"].includes(getComputedStyle(e).display) && getComputedStyle(e).alignItems==="center" && getComputedStyle(e).justifyContent==="center"')
                expect(cards.get_by_text('Overall', exact=True)).to_have_count(0)
                expect(cards.first.get_by_text('Required progress', exact=True)).to_be_visible()
                count = int(records.locator('.analytics-student-grid').evaluate('e=>getComputedStyle(e).gridTemplateColumns.split(" ").length'))
                assert count <= 3
                if width == 1440: assert count == 3
                before = cards.first.bounding_box(); cards.first.hover()
                assert cards.first.bounding_box() == before
                records.screenshot(path=str(OUT / f'{role}-cards-{width}.png'))
                search = records.get_by_role('searchbox')
                search.fill('Sample Student 12'); expect(cards).to_have_count(1)
                search.fill('does not exist'); expect(records.get_by_text('No records match this selection.', exact=True)).to_be_visible()
                records.get_by_role('button', name='Clear search', exact=True).click(); expect(cards).to_have_count(9)
                records.get_by_role('button', name='Next →', exact=True).click(); expect(cards).to_have_count(3)
                records.get_by_label('Sort students', exact=True).select_option('0:desc'); expect(cards).to_have_count(9)
                expect(cards.first.locator('.sp-card-open')).to_have_text('Sample Student 12')
                records.get_by_role('button', name='List view', exact=True).click()
                expect(table.locator('[data-record-opener]').first).to_have_text('Sample Student 12')
                expect(table.locator('tbody tr').first).to_contain_text('No current recommendation')
                records.get_by_role('button', name='Show all columns', exact=True).click()
                assert table.locator('thead th').count() >= 14
                records.get_by_role('button', name='Show key columns', exact=True).click()
                expect(table.locator('thead th')).to_have_count(6)
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1')
                records.screenshot(path=str(OUT / f'{role}-table-{width}.png'))
                if width == 1440:
                    for format in ['CSV', 'PDF']:
                        with page.expect_download() as download_info:
                            records.get_by_role('button', name=f'Download displayed {format}', exact=True).click()
                        path = OUT / f'{role}.{format.lower()}'
                        download_info.value.save_as(path)
                        if format == 'CSV':
                            text = path.read_text(encoding='utf-8-sig')
                            assert all(f'Sample Student {i:02d}' in text for i in range(1,13))
                            assert text.index('Sample Student 12') < text.index('Sample Student 01')
                        else: assert path.read_bytes().startswith(b'%PDF')
                    page.goto(BASE + f'/{role}/reports?program_id=1&tab=skills')
                    page.wait_for_load_state('networkidle')
                    records.get_by_role('button', name='Card view', exact=True).click()
                    locked = records.locator('[data-student-id="4"]')
                    expect(locked.get_by_text('Missing / locked', exact=True)).to_have_count(2)
                    stale = records.locator('[data-student-id="6"]')
                    expect(stale.get_by_text('Final evidence: Current', exact=True)).to_be_visible()
                    expect(stale.get_by_text('85%', exact=True)).to_be_visible()
                    expect(stale.get_by_text('Top recommendation: Locked / unavailable', exact=True)).to_be_visible()
                    zero = records.locator('[data-student-id="7"]')
                    expect(zero.get_by_text('0%', exact=True)).to_have_count(2)
                    records.get_by_role('button', name='List view', exact=True).click()
                    records.get_by_role('button', name='Show all columns', exact=True).click()
                    locked_row = table.locator('tbody tr').filter(has=page.get_by_role('button', name='View details for Sample Student 04', exact=True))
                    expect(locked_row).to_have_count(1)
                    expect(locked_row.get_by_text('85%', exact=True)).to_have_count(0)
                    page.goto(BASE + f'/{role}/reports?program_id=1&group=map-suggested:city:city-a')
                    page.wait_for_load_state('networkidle')
                    expect(records).to_contain_text('Allocated Partner')
                    expect(records.get_by_text('30%', exact=True)).to_be_visible()
                    records.get_by_role('button', name='Card view', exact=True).click()
                    expect(records.get_by_text('Suggested allocation', exact=True)).to_be_visible()
                    expect(records.get_by_text('Allocated Opening', exact=True)).to_be_visible()
                    expect(records.get_by_text('30%', exact=True)).to_be_visible()
                    expect(records.get_by_text('85%', exact=True)).to_have_count(0)
                    expect(records.locator('.analytics-partner-logo img')).to_have_attribute('src', BASE + '/fixture-allocated-logo.svg')
                checks.append(f'{role} {width}px {"dark" if dark else "light"}: nine records, centered logos/fallbacks, row/dialog focus, card/table order, search, pagination, columns, no overflow')
                context.close()
        assert not errors, errors
        assert not writes, writes
        filename = f'results-{os.environ["UI_TEST_WIDTH"]}.json' if os.environ.get('UI_TEST_WIDTH') else 'results.json'
        (OUT / filename).write_text(json.dumps(dict(checks=checks, errors=errors, writes=writes), indent=2))
        print(json.dumps(dict(checks=checks, errors=errors, writes=writes)))
    finally:
        browser.close()
