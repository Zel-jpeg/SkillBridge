"""New Assessment schedule UI for both staff roles. Synthetic intercepted API only."""
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse
sys.path.insert(0, str(Path(__file__).parent / '.runtime'))
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:5196'
OUT = Path(__file__).parent / 'artifacts' / 'assessment-create-schedule'
OUT.mkdir(parents=True, exist_ok=True)
checks = []


def set_schedule(page, label, value):
    target = datetime.fromisoformat(value)
    page.get_by_role('button', name=re.compile('^' + label + ':')).click()
    picker = page.get_by_role('dialog', name=label + ' date and time', exact=True)
    for _ in range(36):
        current = datetime.strptime(picker.locator('header h2').inner_text(), '%B %Y')
        if (current.year, current.month) == (target.year, target.month):
            break
        picker.get_by_role('button', name='Next month' if current < target else 'Previous month', exact=True).click()
    picker.get_by_role('button', name=re.compile(target.strftime('%B ') + str(target.day) + ', ' + str(target.year) + '$')).click()
    picker.locator('[data-type="hour"]').press_sequentially(str(target.hour % 12 or 12))
    picker.locator('[data-type="minute"]').press_sequentially(f'{target.minute:02d}')
    picker.locator('[data-type="dayPeriod"]').press('a' if target.hour < 12 else 'p')
    picker.get_by_role('button', name='Apply', exact=True).click()


with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    for role in ['instructor', 'admin']:
        errors, writes = [], []
        user = {'id': 1, 'role': role, 'name': 'Synthetic Staff', 'is_approved': True}
        context = browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce', timezone_id='America/New_York')
        context.add_init_script("localStorage.setItem('sb-token','synthetic-only');localStorage.setItem('sb-role'," + json.dumps(role) + ");localStorage.setItem('sb-user'," + json.dumps(json.dumps(user)) + ");window.EventSource=class {close(){}};")
        def route_request(route):
            path = urlparse(route.request.url).path
            if urlparse(route.request.url).hostname not in ['localhost', '127.0.0.1']:
                return route.abort()
            if not path.startswith('/api/'):
                return route.continue_()
            if route.request.method != 'GET':
                writes.append((path, route.request.post_data_json))
                if path == '/api/instructor/assessments/' and route.request.method == 'POST':
                    return route.fulfill(status=201, json={'id': 7})
                return route.fulfill(status=405, json={'error': 'Unexpected synthetic mutation'})
            if path == '/api/auth/me/':
                return route.fulfill(json=user)
            if path == '/api/categories/':
                return route.fulfill(json=[{'id': 1, 'name': 'Programming'}])
            if path == '/api/instructor/batches/':
                return route.fulfill(json=[{'id': 3, 'name': 'Synthetic Batch', 'status': 'active', 'instructor_id': 1, 'instructor_name': 'Synthetic Staff'}])
            return route.fulfill(json=[])
        context.route('**/*', route_request)
        page = context.new_page()
        page.set_default_timeout(10000)
        page.set_default_navigation_timeout(30000)
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(BASE + f'/{role}/assessment/create')
        page.wait_for_load_state('networkidle')
        schedule = page.get_by_role('region', name='Assessment schedule', exact=True)
        expect(schedule.get_by_text('Asia/Manila · UTC+08', exact=True)).to_be_visible()
        expect(schedule.locator('input[type="datetime-local"]')).to_have_count(0)
        set_schedule(page, 'Available at', '2026-11-01T08:17')
        set_schedule(page, 'Due at', '2026-11-01T07:00')
        expect(schedule.get_by_role('alert')).to_contain_text('Due date must be after')
        set_schedule(page, 'Due at', '2026-11-02T17:42')
        expect(schedule.get_by_role('alert')).to_have_count(0)
        available = schedule.get_by_role('button', name=re.compile('^Available at:'))
        due = schedule.get_by_role('button', name=re.compile('^Due at:'))
        expect(available).to_have_accessible_name(re.compile(r'8:17\s*am', re.I))
        expect(due).to_have_accessible_name(re.compile(r'5:42\s*pm', re.I))
        available.click()
        picker = page.get_by_role('dialog', name='Available at date and time', exact=True)
        picker.locator('[data-type="hour"]').press('9')
        picker.get_by_role('button', name='Cancel', exact=True).click()
        expect(available).to_have_accessible_name(re.compile(r'8:17\s*am', re.I))
        due.click()
        page.get_by_role('dialog', name='Due at date and time', exact=True).get_by_role('button', name='Clear', exact=True).click()
        expect(due).to_have_accessible_name('Due at: Select date and time')
        set_schedule(page, 'Due at', '2026-11-02T17:42')
        checks.append(f'{role}: shared picker Apply/Cancel/Clear, exact AM/PM minutes, Manila label and live ordering feedback')

        for width, height in [(320, 568), (390, 844), (768, 1024), (1440, 1000), (1024, 600)]:
            page.set_viewport_size({'width': width, 'height': height})
            for dark in [False, True]:
                page.evaluate('dark => document.documentElement.classList.toggle("dark", dark)', dark)
                schedule.evaluate('el => el.scrollIntoView({block: "center"})')
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                available.focus()
                page.keyboard.press('Enter')
                picker = page.get_by_role('dialog', name='Available at date and time', exact=True)
                expect(picker).to_be_visible()
                bounds = picker.bounding_box()
                assert bounds['x'] >= 0 and bounds['y'] >= 0 and bounds['x'] + bounds['width'] <= width + 1
                assert bounds['y'] + bounds['height'] <= height + 1
                if width in [390, 1440]:
                    page.screenshot(path=str(OUT / f'{role}-{width}-{"dark" if dark else "light"}.png'))
                page.keyboard.press('Escape')
                expect(picker).to_have_count(0)
                expect(available).to_be_focused()
                checks.append(f'{role} {width}x{height} {dark=}: bounded calendar/popover, keyboard opening and Escape focus')
        page.set_viewport_size({'width': 1440, 'height': 1000})
        page.get_by_placeholder(re.compile('e.g. BSIT OJT Skills Assessment')).fill('Synthetic Scheduled Draft')
        page.get_by_placeholder('e.g. 60', exact=True).fill('60')
        page.get_by_role('button', name='Save draft', exact=True).click()
        expect(page.get_by_role('heading', name='New assessment', exact=True)).to_have_count(0)
        assert len(writes) == 1, writes
        assert writes[0][1]['available_at'] == '2026-11-01T08:17:00+08:00'
        assert writes[0][1]['due_at'] == '2026-11-02T17:42:00+08:00'
        assert writes[0][1]['publication_status'] == 'draft'
        assert not errors, errors
        context.close()
        checks.append(f'{role}: mocked draft save preserves exact Manila payload even in a New York browser timezone')
    browser.close()
(OUT / 'results.json').write_text(json.dumps({'checks': checks}, indent=2), encoding='utf-8')
print(json.dumps({'passed_groups': len(checks), 'artifacts': str(OUT.resolve())}, indent=2), flush=True)
