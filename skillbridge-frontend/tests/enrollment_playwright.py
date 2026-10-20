"""Real frontend/API workflow against enrollment_server.py only; all emails mocked."""
import json
import os
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).parent / '.runtime'))
from playwright.sync_api import sync_playwright, expect

ARTIFACTS = Path(__file__).parent / 'artifacts/enrollment'
FRONTEND_PORT = int(os.environ.get('ENROLLMENT_FRONTEND_PORT', '5174'))
API_PORT = int(os.environ.get('ENROLLMENT_API_PORT', '8017'))
if len(sys.argv) >= 3:
    FRONTEND_PORT, API_PORT = map(int, sys.argv[1:3])
auth = json.loads((ARTIFACTS / 'auth.json').read_text())
checks, errors = [], []

def geometry(page):
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Document overflow'
    records = page.locator('.enrollment-record-list')
    assert records.evaluate('el => el.scrollWidth <= el.clientWidth + 1'), 'Review records should not scroll horizontally'
    assert page.locator('.enrollment-record').evaluate_all(
        'els => els.every(el => el.scrollWidth <= el.clientWidth + 1)'), 'A review card overflowed horizontally'
    assert page.locator('dialog[open]').evaluate('el => el.scrollWidth <= el.clientWidth + 1'), 'Dialog overflow'

def open_dialog(page, role):
    page.goto(f'http://127.0.0.1:{FRONTEND_PORT}/{role}/' + ('users' if role == 'admin' else 'students'))
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
                route.continue_(url=f'http://127.0.0.1:{API_PORT}' + source.path + ('?' + source.query if source.query else ''))
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
            row_label = (dialog.locator('.enrollment-record-header strong').first if width < 640
                         else dialog.locator('.enrollment-list-summary > strong').first)
            expect(row_label).to_have_text('Row 9')
            assert 'IAMS Students\n9' not in dialog.inner_text(), 'Worksheet name and row number should not look like a student count'
            expect(dialog.get_by_text('7 matching rows')).to_be_visible()
            expect(dialog.get_by_text('2 students will be enrolled and 2 notifications will be queued. 5 rows will be skipped.')).to_be_visible()
            geometry(page)
            list_button = dialog.get_by_role('button', name='Show list', exact=True)
            cards_button = dialog.get_by_role('button', name='Show cards', exact=True)
            if width < 640:
                expect(list_button).to_be_hidden()
                expect(cards_button).to_be_hidden()
                expect(dialog.locator('.enrollment-list-summary').first).to_be_hidden()
                expect(dialog.locator('.enrollment-record-header').first).to_be_visible()
            else:
                expect(list_button).to_have_attribute('aria-pressed', 'true')
                expect(dialog.locator('.enrollment-list-summary').first).to_be_visible()
                cards_button.click()
                expect(cards_button).to_have_attribute('aria-pressed', 'true')
                card_columns = dialog.locator('.enrollment-record-list').evaluate(
                    "el => getComputedStyle(el).gridTemplateColumns.split(' ').length")
                assert card_columns == (2 if width >= 1024 else 1), 'Card view column count is not responsive'
                geometry(page)
                list_button.click()
                expect(list_button).to_have_attribute('aria-pressed', 'true')
                dialog.get_by_role('button', name='Edit', exact=True).first.click()
            field_columns = dialog.locator('.enrollment-record-grid').first.evaluate(
                "el => getComputedStyle(el).gridTemplateColumns.split(' ').length")
            assert field_columns == (12 if width >= 1024 else 2 if width >= 640 else 1), 'List field layout is not responsive'
            dialog.get_by_label('Show rows').select_option('unsupported')
            expect(dialog.get_by_text('1 matching rows')).to_be_visible()
            expect(dialog.locator('.enrollment-status:visible').filter(has_text='Unsupported program')).to_be_visible()
            dialog.get_by_label('Show rows').select_option('duplicate')
            expect(dialog.get_by_text('2 matching rows')).to_be_visible()
            dialog.get_by_label('Show rows').select_option('all')
            verification = dialog.get_by_role('checkbox')
            verification.check()
            dialog.get_by_label('Email row 9', exact=True).fill('synthetic.controlled@dnsc.edu.ph')
            dialog.get_by_label('Last name row 9', exact=True).fill('DELA CERNA')
            expect(verification).to_be_visible()
            expect(verification).to_be_checked()
            expect(dialog.get_by_role('button', name='Confirm 2 enrollments')).to_be_disabled()
            expect(dialog.get_by_text('Email source: Edited', exact=True)).to_be_visible()
            if width >= 640:
                dialog.get_by_role('button', name='Done', exact=True).first.click()
            else:
                dialog.get_by_role('button', name='Apply changes', exact=True).click()
            toast_notice = page.get_by_text(
                'Student details updated successfully.' if width >= 640 else 'Student changes updated successfully.', exact=True
            ).last
            expect(toast_notice).to_be_visible()
            toast_box = toast_notice.bounding_box()
            assert toast_notice.evaluate("el => getComputedStyle(el).position === 'fixed'"), 'Toast should be viewport-fixed'
            assert toast_box['y'] <= 24 and width - toast_box['x'] - toast_box['width'] <= 24, 'Toast should appear at the upper right'
            expect(verification).to_be_visible()
            expect(verification).to_be_checked()
            expect(dialog.get_by_text('2 students will be enrolled and 2 notifications will be queued. 5 rows will be skipped.')).to_be_visible()
            expect(dialog.get_by_label('Last name row 9')).to_have_value('Dela Cerna')
            expect(dialog.get_by_label('Display name row 9')).to_have_value('David Rey Dela Cerna')
            if width == 1366:
                dialog.get_by_role('button', name='Edit', exact=True).first.click()
                dialog.get_by_label('Display name row 9').fill('David Rey McDonald')
                dialog.get_by_role('button', name='Done', exact=True).first.click()
                expect(dialog.get_by_label('Display name row 9')).to_have_value('David Rey McDonald')
            geometry(page)
            if width == 375 or width == 1366:
                page.screenshot(path=str(ARTIFACTS / f'{role}-{width}.png'))
            back = dialog.get_by_role('button', name='Back', exact=True)
            assert back.evaluate("el => getComputedStyle(el).borderStyle === 'solid'"), 'Back must look like a button'
            before_hover = back.evaluate('el => getComputedStyle(el).backgroundColor')
            back.hover()
            page.wait_for_timeout(200)
            assert back.evaluate('el => getComputedStyle(el).backgroundColor') != before_hover, 'Back needs visible hover feedback'
            back.click()
            compact = page.locator('dialog[open]')
            expect(compact.get_by_role('button', name='Continue review')).to_be_visible()
            expect(compact.get_by_label('Student review records')).to_have_count(0)
            compact.get_by_role('button', name='Continue review').click()
            expect(dialog).to_be_visible()
            dialog.get_by_role('button', name='Close review').click()
            checks.append(f'{role} {width}px: upload, Row labels, compact list/card views, filters, edits, revalidation, button hover, no horizontal overflow')
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
        success_toast = dialog.get_by_text('Enrollment completed: 1 student enrolled.', exact=True)
        expect(success_toast).to_be_visible()
        success_box = success_toast.bounding_box()
        assert success_box['y'] <= 24 and page.viewport_size['width'] - success_box['x'] - success_box['width'] <= 24
        expect(dialog.get_by_text(re.compile('1 enrolled; 0 already enrolled; 0 not enrolled. 1 notifications queued.'))).to_be_visible()
        page.screenshot(path=str(ARTIFACTS / f'{role}-enrollment-success.png'))
        dialog.get_by_role('button', name='Done', exact=True).click()
        checks.append(f'{role}: manual preview, explicit review confirmation, enrollment and queued result')
        if role == 'admin':
            dialog = open_dialog(page, role)
            dialog.locator('input[type=file]').set_input_files(str(ARTIFACTS / 'iams-synthetic.xlsx'))
            dialog = page.locator('.enrollment-review-dialog')
            expect(dialog.get_by_role('button', name='Confirm 2 enrollments')).to_be_disabled()
            dialog.get_by_role('checkbox').check()
            dialog.get_by_role('button', name='Confirm 2 enrollments').click()
            expect(dialog.get_by_text('Enrollment completed: 2 students enrolled.', exact=True)).to_be_visible()
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
