"""Synthetic leaderboard checks; no live student data, API calls or design JSON."""
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent / '.runtime'))
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:5197'
ARTIFACTS = Path(__file__).parent / 'artifacts' / 'skill-leaderboard'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
checks, errors = [], []


def open_fixture(page, scenario='many', width=1366, height=1050, dark=False):
    page.set_viewport_size({'width': width, 'height': height})
    page.goto(f'{BASE}/tests/skill-leaderboard/index.html?scenario={scenario}')
    page.wait_for_load_state('networkidle')
    page.evaluate('(dark) => document.documentElement.classList.toggle("dark", dark)', dark)
    page.get_by_role('button', name='Open leaderboard', exact=True).click()
    expect(page.locator('dialog[open]')).to_have_count(1)


def geometry(page):
    modal = page.locator('dialog[open]')
    rect = modal.bounding_box()
    size = page.viewport_size
    assert rect['x'] >= -1 and rect['y'] >= -1 and rect['x'] + rect['width'] <= size['width'] + 1 and rect['y'] + rect['height'] <= size['height'] + 1, rect
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    if not modal.evaluate('el => el.scrollHeight <= el.clientHeight + 1'):
        page.screenshot(path=str(ARTIFACTS / 'shell-overflow.png'))
        print(modal.evaluate("el => ({shell:[el.clientHeight,el.scrollHeight],children:[...el.children].map(c=>({cls:c.className,height:c.clientHeight,scroll:c.scrollHeight,rect:c.getBoundingClientRect().toJSON()}))})"), flush=True)
    assert modal.evaluate('el => el.scrollHeight <= el.clientHeight + 1'), 'Shell scrolls instead of body'
    assert page.locator('.lb-body').evaluate('el => el.scrollWidth <= el.clientWidth + 1'), 'Horizontal body overflow'
    close = page.get_by_role('button', name='Close skill leaderboard')
    bounds = close.bounding_box()
    assert bounds['width'] >= 44 and bounds['height'] >= 44
    assert bounds['y'] >= rect['y'] and bounds['y'] + bounds['height'] <= rect['y'] + rect['height']
    assert page.evaluate('document.body.style.overflow') == 'hidden'


with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    context = browser.new_context(reduced_motion='reduce')
    page = context.new_page()
    page.set_default_timeout(10000)
    page.on('pageerror', lambda error: errors.append(str(error)))
    for width, height in [(320, 568), (375, 812), (430, 932), (640, 800), (768, 1024), (820, 1180), (1024, 768), (1366, 1050), (1920, 1080), (812, 375)]:
        for dark in [False, True]:
            open_fixture(page, width=width, height=height, dark=dark)
            geometry(page)
            expect(page.locator('.lb-podium-card')).to_have_count(3)
            first = page.locator('.lb-podium-card--1').bounding_box()
            second = page.locator('.lb-podium-card--2').bounding_box()
            third = page.locator('.lb-podium-card--3').bounding_box()
            assert first['width'] > second['width'] and first['height'] > second['height']
            assert first['width'] > third['width'] and first['height'] > third['height']
            colors = page.locator('.lb-podium-card').evaluate_all('els => els.map(el => getComputedStyle(el).backgroundColor)')
            assert len(set(colors)) == 3, 'Gold, silver and bronze surfaces must be distinct'
            for card in page.locator('.lb-podium-card').all():
                assert card.evaluate("el => getComputedStyle(el).display === 'flex' && getComputedStyle(el).flexDirection === 'column'"), 'Keep vertical student card layout'
            expect(page.get_by_role('table', name='Remaining student rankings').get_by_role('row')).to_have_count(6)
            expect(page.locator('.lb-pending-student')).to_have_count(4)
            assert page.locator('.lb-row:not(.lb-row--header) .lb-rank').all_text_contents() == ['#4', '#5', '#6', '#7', '#8']
            if width in [375, 768, 1366] and height > 500:
                page.screenshot(path=str(ARTIFACTS / f'populated-{width}-{"dark" if dark else "light"}.png'))
            body = page.locator('.lb-body')
            header_y = page.locator('.sb-detail-header').bounding_box()['y']
            footer_y = page.locator('.sb-detail-footer').bounding_box()['y']
            body.evaluate('el => el.scrollTop = el.scrollHeight')
            assert page.locator('.sb-detail-header').bounding_box()['y'] == header_y
            assert page.locator('.sb-detail-footer').bounding_box()['y'] == footer_y
            geometry(page)
            page.get_by_role('button', name='Close skill leaderboard').click()
            expect(page.locator('#open-leaderboard')).to_be_focused()
            assert page.evaluate('document.body.style.overflow') == ''
            checks.append(f'{width}x{height} {"dark" if dark else "light"}: podium, bounded rows, pending, geometry, body scroll, fixed controls')

    open_fixture(page)
    remaining = page.get_by_role('region', name='Remaining rankings', exact=True)
    pages = page.get_by_role('navigation', name='Remaining rankings pages')
    pages.get_by_role('button', name='Next', exact=False).click()
    expect(page.locator('.lb-rank').first).to_have_text('#9')
    pages.get_by_role('button', name='4', exact=True).click()
    assert page.locator('.lb-rank').all_text_contents() == ['#19', '#20']
    expect(pages.get_by_role('button', name='Next', exact=False)).to_be_disabled()
    search = page.get_by_role('searchbox', name='Search remaining students…')
    search.fill('Maya')
    expect(remaining.locator('.lb-rank')).to_have_text('#5')
    expect(page.locator('.lb-podium-card')).to_have_count(3)
    search.fill('  2023-00108  ')
    expect(remaining.locator('.lb-rank')).to_have_text('#8')
    search.fill('no-such-student')
    expect(remaining.get_by_text('No students match this search.')).to_be_visible()
    remaining.get_by_role('button', name='Clear search').click()
    expect(remaining.locator('.lb-rank').first).to_have_text('#4')
    pages.get_by_role('button', name='4', exact=True).click()
    page.locator('#shrink').evaluate('el => el.click()')
    expect(remaining.locator('.lb-rank')).to_have_text('#4')
    page.locator('#restore').evaluate('el => el.click()')
    expect(remaining.locator('.lb-rank').first).to_have_text('#4')
    checks.append('Rank pagination, boundaries, name/ID search, clear/reset, original ranks, live shrink clamp and regrowth')

    for scenario in ['empty', 'one', 'two', 'pending', 'zero', 'ties', 'locked', 'missing', 'long']:
        open_fixture(page, scenario=scenario, width=320, height=568)
        geometry(page)
        if scenario in ['empty', 'pending', 'locked', 'missing']:
            expect(page.get_by_role('heading', name='No results yet')).to_be_visible()
            expect(page.locator('.lb-podium-card')).to_have_count(0)
        if scenario == 'one':
            expect(page.locator('.lb-podium-card')).to_have_count(1)
        if scenario == 'two':
            expect(page.locator('.lb-podium-card')).to_have_count(2)
        if scenario == 'pending':
            expect(page.locator('.lb-pending-student')).to_have_count(5)
            pending = page.get_by_role('region', name='Not yet assessed', exact=True)
            page.get_by_role('navigation', name='Unassessed student pages').get_by_role('button', name='Next', exact=False).click()
            pending.get_by_role('searchbox').fill('Owen')
            expect(page.locator('.lb-pending-student')).to_have_count(1)
            assert '%' not in pending.inner_text()
        if scenario == 'zero':
            assert page.locator('.lb-podium-score').all_text_contents() == ['0%', '0%', '0%']
        if scenario == 'ties':
            assert page.locator('.lb-podium-card--1 strong').first.inner_text() == 'Amelia Cruz'
        if scenario == 'long':
            page.screenshot(path=str(ARTIFACTS / 'long-names-mobile.png'))
        checks.append(f'320px scenario {scenario}: honest results and accessible layout')

    # All three selection paths retain the leaderboard underneath read-only details.
    for selector, student in [('.lb-podium-card--1', 'Amelia Cruz'), ('.lb-open-student', 'Luke Garcia'), ('.lb-pending-student', 'Ava Mendoza')]:
        open_fixture(page)
        control = page.locator(selector).first
        control.scroll_into_view_if_needed()
        control.focus()
        page.keyboard.press('Enter')
        expect(page.get_by_role('dialog', name=student, exact=True)).to_be_visible()
        expect(page.locator('dialog[open]')).to_have_count(2)
        page.keyboard.press('Escape')
        expect(page.locator('dialog[open]')).to_have_count(1)
        expect(control).to_be_focused()
        page.keyboard.press('Escape')
        expect(page.locator('dialog[open]')).to_have_count(0)
        expect(page.locator('#open-leaderboard')).to_be_focused()
        checks.append(f'Keyboard selection to read-only student details: {student}')

    open_fixture(page)
    control = page.locator('.lb-podium-card--1')
    page.mouse.move(1, 1)
    control.evaluate('el => el.blur()')
    before = control.evaluate('el => getComputedStyle(el).backgroundColor')
    control.hover()
    assert control.evaluate('el => getComputedStyle(el).backgroundColor') != before
    for _ in range(30):
        page.keyboard.press('Tab')
        assert page.locator('dialog[open]').evaluate('el => el.contains(document.activeElement)')
    page.keyboard.press('Escape')
    expect(page.locator('dialog[open]')).to_have_count(0)
    checks.append('Hover, focus trap, Escape and focus restoration')
    assert not errors, errors
    (ARTIFACTS / 'results.json').write_text(json.dumps({'checks': checks, 'page_errors': errors}, indent=2), encoding='utf-8')
    print(json.dumps({'passed_groups': len(checks), 'page_errors': errors, 'artifacts': str(ARTIFACTS.resolve())}, indent=2), flush=True)
    browser.close()
