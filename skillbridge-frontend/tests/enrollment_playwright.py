"""Real frontend/API workflow against enrollment_server.py only; all emails mocked."""
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).parent / '.runtime'))
from playwright.sync_api import sync_playwright, expect

ARTIFACTS = Path(__file__).parent / 'artifacts/enrollment'
auth = json.loads((ARTIFACTS / 'auth.json').read_text())
checks, errors = [], []

def geometry(page):
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Document overflow'
    scroll = page.locator('.enrollment-table-scroll')
    assert scroll.evaluate('el => el.scrollWidth > el.clientWidth'), 'Table should scroll internally'
    assert page.locator('dialog[open]').evaluate('el => el.scrollWidth <= el.clientWidth + 1'), 'Dialog overflow'

def open_dialog(page, role):
    page.goto(f'http://127.0.0.1:5174/{role}/' + ('users' if role == 'admin' else 'students'))
    page.wait_for_load_state('networkidle')
    page.screenshot(path=str(ARTIFACTS / 'latest-page.png'))
    (ARTIFACTS / 'latest-page.txt').write_text(page.locator('body').inner_text(), encoding='utf-8')
    page.get_by_role('button', name='Import / Enroll Students' if role == 'admin' else 'Enroll students', exact=True).click()
    dialog = page.locator('.enrollment-dialog:not(.enrollment-review-dialog)')
    expect(dialog).to_be_visible()
    if role == 'admin':
        dialog.get_by_label('Target batch').select_option(str(auth['batch_id']))
    expect(dialog.get_by_text('Assigned instructor: Synthetic Instructor')).to_be_visible()
    return dialog

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    for role in ['instructor', 'admin']:
        context = browser.new_context()
        context.add_init_script(f"localStorage.setItem('sb-token', {json.dumps(auth[role])}); localStorage.setItem('sb-role', '{role}');")
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        # Route every API request to the isolated API; do not depend on local .env.
        def route_api(route):
            source = urlparse(route.request.url)
            if source.path.startswith('/api/'):
                route.continue_(url='http://127.0.0.1:8017' + source.path + ('?' + source.query if source.query else ''))
            elif source.hostname not in ('127.0.0.1', 'localhost'):
                route.abort()
            else:
                route.continue_()
        page.route('**/*', route_api)
        for width in [375, 768, 1024, 1366]:
            page.set_viewport_size({'width': width, 'height': 900})
            dialog = open_dialog(page, role)
            expect(dialog.get_by_role('button', name='Download enrollment template')).to_be_visible()
            if width in (375, 1366):
                page.screenshot(path=str(ARTIFACTS / f'{role}-{width}-initial.png'))
            if width == 375:
                with page.expect_download() as iams_download:
                    dialog.get_by_role('button', name='Download enrollment template').click()
                assert iams_download.value.suggested_filename == 'iams_student_enrollment_template.xlsx'
            dialog.locator('input[type=file]').set_input_files(str(ARTIFACTS / 'iams-synthetic.xlsx'))
            expect(dialog).not_to_be_visible()
            dialog = page.locator('.enrollment-review-dialog')
            expect(dialog).to_be_visible()
            if width == 375:
                assert dialog.evaluate('el => el.getBoundingClientRect().width >= innerWidth - 1'), 'Mobile review should fill screen'
            expect(dialog.get_by_label('First name row 9')).to_have_value('David Rey')
            expect(dialog.get_by_label('Last name row 9')).to_have_value('Bali-os')
            expect(dialog.get_by_label('Display name row 9')).to_have_value('David Rey Bali-os')
            expect(dialog.get_by_text('7 matching rows')).to_be_visible()
            expect(dialog.get_by_text('2 students will be enrolled and 2 notifications will be queued. 5 rows will be skipped.')).to_be_visible()
            geometry(page)
            dialog.get_by_label('Show rows').select_option('unsupported')
            expect(dialog.get_by_text('1 matching rows')).to_be_visible()
            expect(dialog.get_by_role('cell', name='Unsupported program', exact=True)).to_be_visible()
            dialog.get_by_label('Show rows').select_option('duplicate')
            expect(dialog.get_by_text('2 matching rows')).to_be_visible()
            dialog.get_by_label('Show rows').select_option('all')
            dialog.get_by_label('Email row 9', exact=True).fill('synthetic.controlled@dnsc.edu.ph')
            dialog.get_by_label('Last name row 9', exact=True).fill('DELA CERNA')
            expect(dialog.get_by_role('button', name='Confirm 0 enrollments')).to_be_disabled()
            expect(dialog.get_by_role('cell', name='Edited', exact=True)).to_be_visible()
            dialog.get_by_role('button', name='Review again', exact=True).click()
            expect(dialog.get_by_text('2 students will be enrolled and 2 notifications will be queued. 5 rows will be skipped.')).to_be_visible()
            expect(dialog.get_by_label('Last name row 9')).to_have_value('Dela Cerna')
            expect(dialog.get_by_label('Display name row 9')).to_have_value('David Rey Dela Cerna')
            if width == 1366:
                dialog.get_by_label('Display name row 9').fill('David Rey McDonald')
                dialog.get_by_role('button', name='Review again', exact=True).click()
                expect(dialog.get_by_label('Display name row 9')).to_have_value('David Rey McDonald')
            geometry(page)
            if width == 375 or width == 1366:
                page.screenshot(path=str(ARTIFACTS / f'{role}-{width}.png'))
            dialog.get_by_role('button', name='Back', exact=True).click()
            compact = page.locator('dialog[open]')
            expect(compact.get_by_role('button', name='Continue review')).to_be_visible()
            expect(compact.get_by_label('Scrollable student review table')).to_have_count(0)
            compact.get_by_role('button', name='Continue review').click()
            expect(dialog).to_be_visible()
            dialog.get_by_role('button', name='Close review').click()
            checks.append(f'{role} {width}px: upload, counts, unsupported/duplicate filters, email edit, revalidation, internal scrolling, no document overflow')
        # Manual enrollment uses the same review contract; only synthetic accounts.
        dialog = open_dialog(page, role)
        dialog.get_by_role('button', name='Manual entry').click()
        form = dialog.locator('form')
        suffix = '8' if role == 'instructor' else '9'
        form.get_by_label('Student ID', exact=True).fill('2099-0000' + suffix)
        form.get_by_label('DNSC Email', exact=True).fill(f'synthetic.manual{suffix}@dnsc.edu.ph')
        form.get_by_label('Full Name', exact=True).fill('DAVID REY BALI-OS')
        form.get_by_role('button', name='Preview student').click()
        expect(dialog.get_by_text('1 students will be enrolled and 1 notifications will be queued. 0 rows will be skipped.')).to_be_visible()
        expect(dialog.get_by_label('Display name row 1')).to_have_value('David Rey Bali-os')
        dialog.get_by_role('checkbox').check()
        dialog.get_by_role('button', name='Confirm 1 enrollments').click()
        expect(dialog.get_by_text(re.compile('1 enrolled; 0 already enrolled; 0 not enrolled. 1 notifications queued.'))).to_be_visible()
        dialog.get_by_role('button', name='Done', exact=True).click()
        checks.append(f'{role}: manual preview, explicit review confirmation, enrollment and queued result')
        if role == 'admin':
            dialog = open_dialog(page, role)
            dialog.locator('input[type=file]').set_input_files(str(ARTIFACTS / 'iams-synthetic.xlsx'))
            dialog = page.locator('.enrollment-review-dialog')
            expect(dialog.get_by_role('button', name='Confirm 2 enrollments')).to_be_disabled()
            dialog.get_by_role('checkbox').check()
            dialog.get_by_role('button', name='Confirm 2 enrollments').click()
            expect(dialog.get_by_text(re.compile('2 enrolled; 1 already enrolled; 4 not enrolled. 2 notifications queued.'))).to_be_visible()
            dialog.get_by_role('button', name='Done', exact=True).click()
            dialog = open_dialog(page, role)
            dialog.locator('input[type=file]').set_input_files(str(ARTIFACTS / 'iams-synthetic.xlsx'))
            dialog = page.locator('.enrollment-review-dialog')
            expect(dialog.get_by_text('0 students will be enrolled and 0 notifications will be queued. 7 rows will be skipped.')).to_be_visible()
            dialog.get_by_label('Show rows').select_option('already_enrolled')
            expect(dialog.get_by_text('3 matching rows')).to_be_visible()
            expect(dialog.get_by_role('button', name='Confirm 0 enrollments')).to_be_disabled()
            for _ in range(12):
                page.keyboard.press('Tab')
                assert dialog.evaluate('el => el.contains(document.activeElement)'), 'Focus escaped dialog'
            page.keyboard.press('Escape')
            expect(page.get_by_role('dialog')).to_have_count(0)
            checks.append('admin: IAMS confirmation, partial-result counts, safe repeat preview, no repeat notifications, keyboard focus and Escape')
        context.close()
    browser.close()
assert not errors, errors
(ARTIFACTS / 'results.json').write_text(json.dumps({'checks': checks, 'page_errors': errors}, indent=2))
print(json.dumps({'passed': len(checks), 'page_errors': errors}))
