"""Synthetic responsive checks for bounded student skill cards and inner scrolling.

Run with Vite on port 5178 and the backend venv's Python/installed Chrome.
All APIs and maps are mocked; external requests are blocked.
"""
import json
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright, expect

ARTIFACTS = Path(__file__).parent / 'artifacts/student-skill-profile'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
USER = {'id': 1, 'name': 'Synthetic Student', 'role': 'student', 'is_approved': True,
        'course': 'BSIT', 'school_id': 'SYNTH-1', 'address': {'pinLat': 7, 'pinLng': 125}}
MAP = """window.L={map:()=>({setView(){return this},zoomControl:{setPosition(){}},invalidateSize(){},remove(){},fitBounds(){}}),
tileLayer:()=>({addTo(){return this},on(){}}),divIcon:x=>x,
marker:pin=>({addTo(){return this},bindPopup(){return this},remove(){},isPopupOpen(){return false},getLatLng(){return pin}}),
featureGroup:()=>({getBounds:()=>({pad(){return this}})})};"""


def categories(total, tied=False):
    names = ['Database Management', 'Networking', 'Programming', 'Web Development']
    rows = []
    for index in range(total):
        percentage = 100 if tied else [60, 50, 80, 100][index % 4] if index < 4 else 60
        category = names[index] if index < 4 else f'Synthetic category {index + 1} with a longer descriptive name'
        if index == 29:
            category = 'SyntheticUnbrokenCategoryNameForResponsiveWrappingVerification'
        rows.append({'category': category,
                     'percentage': percentage, 'raw_score': percentage, 'max_score': 100, 'tag': 'Competent'})
    return rows


def combined(scores):
    return {'recommendations_locked': False, 'all_required_completed': True, 'overall_percentage': 73,
            'combined_category_scores': scores, 'included_assessments': [], 'recommendations': [
                {'id': index, 'position_id': index, 'company_id': index,
                 'company': f'Synthetic Company {index}', 'position': 'Intern', 'match_score': 80 - index,
                 'slots': 2, 'tags': [], 'lat': 7 + index / 100, 'lng': 125} for index in range(1, 4)]}


checks, errors = [], []
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel='chrome', headless=True)
    try:
        for width in (1440, 1024, 768, 375, 320):
            context = browser.new_context(viewport={'width': width, 'height': 960})
            values = {'sb-token': 'synthetic', 'sb-role': 'student', 'sb-user': json.dumps(USER)}
            context.add_init_script('for (const [k,v] of Object.entries(' + json.dumps(values) + ')) localStorage.setItem(k,v);' + MAP)
            state = {'scores': categories(4)}

            def route_request(route):
                url = urlparse(route.request.url)
                if url.path.endswith('/events/'):
                    return route.fulfill(status=204)
                if url.path == '/api/student/results/combined/':
                    return route.fulfill(json=combined(state['scores']))
                if url.path == '/api/student/results/':
                    return route.fulfill(json={'assessment': {'id': 1, 'title': 'Synthetic Assessment', 'attempt_status': 'submitted', 'include_in_competency': True},
                                              'skill_scores': state['scores'], 'recommendations_locked': False})
                if url.path == '/api/student/results/review/':
                    return route.fulfill(json={'questions': [], 'answers': {}})
                if url.path == '/api/students/me/':
                    return route.fulfill(json=USER)
                if url.path == '/api/assessments/':
                    return route.fulfill(json={'assessments': []})
                if url.path.startswith('/api/'):
                    return route.fulfill(json=[])
                return route.continue_() if url.hostname in ('127.0.0.1', 'localhost') else route.abort()

            context.route('**/*', route_request)
            page = context.new_page()
            page.set_default_timeout(10_000)
            page.on('pageerror', lambda error: errors.append(str(error)))
            for name, path, api_url in (
                ('dashboard', '/student/dashboard', '/api/student/results/combined/'),
                ('results', '/student/results', '/api/student/results/combined/'),
                ('assessment', '/student/assessments/1/results', '/api/student/results/?assessment_id=1'),
            ):
                state['scores'] = categories(4)
                page.goto('http://127.0.0.1:5178' + path)
                page.wait_for_load_state('networkidle')
                if width == 320:
                    page.evaluate("document.documentElement.classList.add('dark')")
                region = page.get_by_role('region', name='Skill categories', exact=True)
                # The previous route's shared cache can contain the larger fixture.
                page.evaluate('(url) => window.dispatchEvent(new CustomEvent("sse:data_changed", {detail: {urls: [url]}}))', api_url)
                expect(region.locator('li')).to_have_count(4)
                card = page.locator('.sb-student-skill-card')
                baseline = card.bounding_box()['height']
                for tied in (False, True):
                    state['scores'] = categories(30, tied)
                    page.evaluate('(url) => window.dispatchEvent(new CustomEvent("sse:data_changed", {detail: {urls: [url]}}))', api_url)
                    expect(region.locator('li')).to_have_count(30)
                    assert abs(card.bounding_box()['height'] - baseline) < 1, (name, width, baseline, card.bounding_box()['height'])
                    layout = region.locator('li').evaluate_all('(rows) => rows.map(el => ({x: el.getBoundingClientRect().x, y: el.getBoundingClientRect().y}))')
                    assert len({round(row['x']) for row in layout}) == 1, 'Categories formed multiple columns'
                    assert all(layout[i]['y'] < layout[i + 1]['y'] for i in range(len(layout) - 1))
                    assert region.evaluate('el => el.scrollHeight > el.clientHeight'), 'Expected inner scroll'
                    region.scroll_into_view_if_needed()
                    region.focus()
                    page.keyboard.press('End')
                    page.wait_for_function('document.activeElement.scrollTop > 0')
                    expect(region.locator('li').last).to_be_in_viewport(ratio=1)
                    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Page horizontal overflow'
                    assert region.evaluate('el => el.scrollWidth <= el.clientWidth'), 'Category horizontal overflow'
                page.screenshot(path=str(ARTIFACTS / f'{name}-{width}.png'))
                checks.append(f'{name} at {width}px: one column, stable card height for 4/30 categories and ties, keyboard scrolling to final category, no overflow')
            context.close()
        assert not errors, errors
    finally:
        browser.close()
        result = {'checks': checks, 'page_errors': errors}
        (ARTIFACTS / 'results.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
        print(json.dumps(result, indent=2))
