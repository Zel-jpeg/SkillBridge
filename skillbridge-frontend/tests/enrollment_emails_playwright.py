"""Synthetic staff email controls. Every API and provider request is intercepted."""
import copy
import json
import os
import re
from pathlib import Path
from urllib.parse import urlparse
from urllib.parse import quote
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('SKILLBRIDGE_TEST_BASE', 'http://127.0.0.1:5184')
OUT = Path(__file__).parent / 'artifacts/enrollment-emails'
OUT.mkdir(parents=True, exist_ok=True)
STATUSES = ['held', 'quota', 'accepted', 'delivered', 'uncertain', 'failed', 'history_unavailable'] + ['queued'] * 8
LABELS = dict(held='Not scheduled', quota='Waiting for daily allowance', accepted='Accepted by Brevo',
              delivered='Delivered', uncertain='Delivery uncertain', failed='Needs attention',
              history_unavailable='History unavailable', queued='Queued')
PHOTO = 'data:image/svg+xml,' + quote('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="#bbf7d0"/><circle cx="24" cy="18" r="8" fill="#166534"/><path d="M8 48v-8a16 16 0 0 1 32 0v8" fill="#166534"/></svg>')


def fixture(role):
    rows = []
    for index, status in enumerate(STATUSES, 1):
        notice = dict(id=f'notice-{index}', status=status, label=LABELS[status], reason='', attempts=1,
                      created_at='2026-10-28T00:00:00Z', updated_at='2026-10-28T00:00:00Z',
                      accepted_at=None, delivered_at=None, next_attempt=None)
        rows.append(dict(student_id=index, enrollment_id=index, name=f'Synthetic Student {index:02}', school_id=f'2026-{index:05}',
                         photo_url=PHOTO if index == 4 else '/synthetic-avatar-missing.png' if index == 3 else '',
                         email=f'synthetic-{index}@dnsc.edu.ph', eligible=True, status=status, label=LABELS[status],
                         notice=notice if status != 'history_unavailable' else None,
                         history=[notice] if status != 'history_unavailable' else []))
    return dict(batch=dict(id=1, name='Synthetic Email Batch', status='active'), rows=rows, summary={}, review_token='synthetic-reviewed',
                groups=[dict(id='synthetic-group', batch_id=1, batch_name='Synthetic Email Batch', source='enrollment',
                    created_at='2026-10-28T01:00:00Z', total=15, submitted=2, delivered=0, waiting=13,
                    held=0, failed=0, uncertain=0, cancelled=0, state='quota')],
                service=dict(worker_recent=True, notice='Daily email allowance reached. Students are enrolled; pending emails will resume automatically when allowance is available.',
                             next_allowance_check='2026-10-28T01:05:00Z', allowance_checked_at='2026-10-28T01:00:00Z'))


with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    checks = []
    for role, width in [('instructor', 1366), ('instructor', 768), ('admin', 375), ('admin', 1366)]:
        print(f'Checking {role} at {width}px', flush=True)
        context = browser.new_context(viewport={'width': width, 'height': 812 if width < 400 else 950})
        user = dict(id=50, name='Synthetic Staff', role=role, is_approved=True)
        context.add_init_script('for (const [k,v] of Object.entries(' + json.dumps({'sb-token': 'synthetic', 'sb-role': role, 'sb-user': json.dumps(user)}) + ')) localStorage.setItem(k,v)')
        payload = fixture(role)
        if role == 'admin':
            payload['service']['diagnostics'] = dict(worker_recent=True,
                next_allowance_check='2026-10-28T01:05:00Z', allowance_checked_at='2026-10-28T01:00:00Z')
        commands, writes, errors, enrollment_modes = {}, [], [], []
        enrollment_commands, enrollment_writes = {}, []
        def route_request(route):
            url = urlparse(route.request.url)
            if url.hostname not in ['localhost', '127.0.0.1']:
                return route.abort()
            path = url.path
            if path == '/synthetic-avatar-missing.png':
                return route.fulfill(status=404, body='Synthetic missing photo')
            if not path.startswith('/api/'):
                return route.continue_()
            if path.endswith('/events/'):
                return route.fulfill(status=204)
            if path == '/api/auth/me/':
                return route.fulfill(json=user)
            if path == '/api/instructor/batches/':
                return route.fulfill(json=[dict(id=1, name='Synthetic Email Batch', status='active', instructor_id=50,
                    instructor_name='Synthetic Staff', student_count=15, created_at='2026-10-28T00:00:00Z')])
            if path == '/api/instructor/batches/1/students/':
                return route.fulfill(json={'batch': {'id': 1, 'name': 'Synthetic Email Batch', 'status': 'active'}, 'students': []})
            if path == '/api/admin/batch-instructors/':
                return route.fulfill(json=[{'id': 50, 'name': 'Synthetic Staff'}])
            if path == '/api/instructor/batches/1/email-progress/':
                return route.fulfill(json={'groups': copy.deepcopy(payload['groups']), 'storage_ready': True})
            if path == '/api/management/analytics/':
                value = {key: [] for key in ['students', 'placement_students', 'assessments', 'batches', 'skills', 'capacity', 'match_bands', 'companies', 'areas', 'geography', 'activity']}
                value.update(generated_at='2026-10-28T01:00:00Z', role=role, scope={},
                    summary={key: 0 for key in ['students', 'required_complete', 'approved', 'unplaced', 'awaiting_review', 'needs_followup', 'slots_remaining']},
                    options={key: [] for key in ['batches', 'instructors', 'courses', 'assessments', 'companies', 'positions', 'areas']},
                    email_notifications=[dict(batch_id=1, batch_name='Synthetic Email Batch', kind='quota', count=1, revision=['opaque'])],
                    email_progress=copy.deepcopy(payload['groups']))
                return route.fulfill(json=value)
            if path in ['/api/instructor/batches/1/enroll/preview/', '/api/instructor/batches/1/enroll/']:
                body = route.request.post_data_json
                rows = [{**row, 'status': 'ready', 'issues': [], 'email_source': 'Provided'} for row in body['students']]
                summary = {key: 0 for key in ['total', 'ready', 'enrolled', 'already_enrolled', 'unsupported', 'duplicate', 'invalid', 'conflict', 'skipped', 'failed', 'notifications_queued', 'notifications_held']}
                summary.update(total=1, ready=1)
                if path.endswith('/preview/'):
                    return route.fulfill(json=dict(rows=rows, summary=summary, review_token='synthetic-enrollment'))
                enrollment_writes.append(body)
                if body['request_id'] in enrollment_commands:
                    return route.fulfill(json=enrollment_commands[body['request_id']])
                enrollment_modes.append(body.get('email_mode'))
                summary.update(enrolled=1, notifications_held=1)
                rows[0].update(status='enrolled', notification_status='held')
                enrollment_commands[body['request_id']] = dict(rows=rows, summary=summary, enrolled=rows, request_id=body['request_id'])
                return route.abort('failed')
            if path == '/api/instructor/batches/1/emails/':
                if route.request.method == 'GET':
                    if payload.get('_error'):
                        return route.fulfill(status=503, json={'error': 'Synthetic service unavailable'})
                    return route.fulfill(json=copy.deepcopy(payload))
                body = route.request.post_data_json
                writes.append(body)
                if body['request_id'] not in commands:
                    commands[body['request_id']] = dict(changed=len(body['student_ids']), skipped=0, request_id=body['request_id'])
                    # Simulate a committed send whose response was lost.
                    if len(writes) == 1:
                        return route.abort('failed')
                return route.fulfill(json=commands[body['request_id']])
            if path == '/api/admin/stats/':
                return route.fulfill(json={})
            if path == '/api/admin/users/':
                return route.fulfill(json=dict(students=[], instructors=[], pending_instructors=[]))
            return route.fulfill(json=[])
        context.route('**/*', route_request)
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        path = '/instructor/students' if role == 'instructor' else '/admin/batches?batch_id=1'
        page.goto(BASE + path)
        page.wait_for_load_state('networkidle')
        page.get_by_role('button', name='Batch actions', exact=True).click()
        expect(page.get_by_role('menuitem', name='Archive batch', exact=True)).to_be_visible()
        page.keyboard.press('Escape')
        expect(page.get_by_role('button', name='Batch actions', exact=True)).to_be_focused()
        page.screenshot(path=str(OUT / f'{role}-{width}-page.png'), full_page=True)
        expect(page.get_by_role('progressbar', name='Emails submitted', exact=True)).to_have_attribute('aria-valuenow', '2')
        page.get_by_role('button', name='View progress', exact=True).click()
        page.get_by_role('dialog', name='Enrollment emails', exact=True).get_by_role('button', name='Close', exact=True).click()
        expect(page.get_by_role('button', name='View progress', exact=True)).to_be_focused()
        page.get_by_role('button', name='Enrollment emails', exact=True).click()
        dialog = page.get_by_role('dialog', name='Enrollment emails', exact=True)
        expect(dialog).to_be_visible()
        expect(dialog.get_by_text('Daily sending limit reached', exact=True)).to_be_visible()
        page.screenshot(path=str(OUT / f'{role}-{width}-initial.png'), full_page=True)
        dialog.get_by_label('Email status', exact=True).select_option('all')
        expect(dialog.get_by_role('table', name='Student email records').locator('tbody > tr.email-record-row')).to_have_count(10)
        photo = dialog.get_by_role('img', name='Synthetic Student 04', exact=True)
        expect(photo).to_be_visible()
        expect(photo).to_have_attribute('src', PHOTO)
        assert photo.evaluate('el => el.complete && el.naturalWidth > 0')
        expect(dialog.get_by_role('img', name='Synthetic Student 01 avatar', exact=True)).to_have_text('SS')
        expect(dialog.get_by_role('img', name='Synthetic Student 03 avatar', exact=True)).to_have_text('SS')
        dialog.get_by_role('button', name='Select all filtered', exact=True).click()
        expect(dialog.get_by_text('15 students · 15 selected', exact=True)).to_be_visible()
        dialog.get_by_role('button', name='More actions', exact=True).click()
        expect(dialog.get_by_role('menu', name='More actions')).to_be_visible()
        expect(dialog.get_by_role('menuitem')).to_have_count(4)
        page.keyboard.press('Escape')
        expect(dialog).to_be_visible()
        expect(dialog.get_by_role('button', name='More actions', exact=True)).to_be_focused()
        dialog.get_by_role('button', name='More actions', exact=True).click()
        dialog.get_by_role('menuitem', name='Hold unsent emails', exact=True).click()
        held_review = page.get_by_role('dialog', name='Hold unsent emails', exact=True)
        expect(held_review).to_be_visible()
        held_review.get_by_role('button', name='Cancel', exact=True).click()
        dialog.get_by_role('button', name='2', exact=True).click()
        expect(dialog.get_by_role('checkbox', name=re.compile('^Select Synthetic Student'))).to_have_count(5)
        dialog.get_by_label('Email status', exact=True).select_option('held')
        expect(dialog.get_by_role('progressbar', name='Emails submitted', exact=True)).to_have_attribute('aria-valuemax', '15')
        expect(dialog.get_by_text('1 student · 0 selected', exact=True)).to_be_visible()
        dialog.get_by_role('checkbox', name='Select Synthetic Student 01').check()
        dialog.get_by_role('button', name='Send selected', exact=True).click()
        confirmation = page.get_by_role('dialog', name='Send selected', exact=True)
        confirmation.get_by_role('button', name='Confirm email action', exact=True).click()
        expect(confirmation.get_by_text('The save could not be confirmed.', exact=False).first).to_be_visible()
        confirmation.get_by_role('button', name='Confirm email action', exact=True).click()
        expect(confirmation).to_have_count(0)
        assert writes[0]['request_id'] == writes[1]['request_id']
        assert writes[0]['student_ids'] == [1]
        assert len(commands) == 1
        dialog.get_by_label('Email status', exact=True).select_option('delivered')
        opener = dialog.get_by_role('button', name='View history for Synthetic Student 04', exact=True)
        expect(opener).to_have_attribute('aria-haspopup', 'dialog')
        opener.click()
        history = page.get_by_role('dialog', name='Email history', exact=True)
        expect(history).to_be_visible()
        expect(history.get_by_role('img', name='Synthetic Student 04', exact=True)).to_have_attribute('src', PHOTO)
        expect(history.get_by_text('Current status', exact=True)).to_be_visible()
        page.keyboard.press('Escape')
        expect(history).to_have_count(0)
        expect(dialog).to_be_visible()
        expect(opener).to_be_focused()
        opener.press('Enter')
        expect(history).to_be_visible()
        # Active toasts move into the top dialog and their dismiss controls also belong in its tab loop.
        last_control = history.locator('button:enabled:visible').last
        last_control.focus()
        page.keyboard.press('Tab')
        expect(history.get_by_role('button', name='Close email history', exact=True)).to_be_focused()
        page.keyboard.press('Shift+Tab')
        expect(last_control).to_be_focused()
        assert history.evaluate('el => el.scrollWidth <= el.clientWidth + 1')
        assert history.bounding_box()['height'] <= page.viewport_size['height'] - 30
        page.screenshot(path=str(OUT / f'{role}-{width}-history.png'), full_page=True)
        resend = history.get_by_role('button', name='Send again to Synthetic Student 04', exact=True)
        resend.click()
        confirmation = page.get_by_role('dialog', name='Send again', exact=True)
        confirmation.get_by_role('button', name='Cancel', exact=True).click()
        expect(history).to_be_visible()
        expect(resend).to_be_focused()
        resend.click()
        confirmation = page.get_by_role('dialog', name='Send again', exact=True)
        expect(confirmation.get_by_role('button', name='Confirm email action')).to_be_disabled()
        confirmation.get_by_label('Reason for sending again').fill('Synthetic student requested another notice')
        confirmation.get_by_role('button', name='Confirm email action').click()
        expect(confirmation).to_have_count(0)
        expect(history).to_have_count(0)
        expect(opener).to_be_focused()
        assert writes[-1]['action'] == 'resend' and writes[-1]['reason']
        dialog.get_by_label('Email status', exact=True).select_option('history_unavailable')
        dialog.get_by_role('button', name='View history for Synthetic Student 07', exact=True).click()
        expect(history.get_by_text('No saved email history.', exact=False)).to_be_visible()
        expect(history.get_by_role('button', name='Send email to Synthetic Student 07', exact=True)).to_be_visible()
        page.evaluate('document.documentElement.classList.add("dark")')
        page.screenshot(path=str(OUT / f'{role}-{width}-history-empty-dark.png'), full_page=True)
        history.get_by_role('button', name='Close history', exact=True).click()
        expect(dialog.get_by_role('button', name='View history for Synthetic Student 07', exact=True)).to_be_focused()
        page.evaluate('document.documentElement.classList.remove("dark")')
        dialog.get_by_label('Email status', exact=True).select_option('all')
        dialog.get_by_label('Search students', exact=True).fill('NOT_FOUND')
        expect(dialog.get_by_text('No matching students', exact=True)).to_be_visible()
        expect(dialog.get_by_role('button', name='Send selected', exact=True)).to_have_count(0)
        page.screenshot(path=str(OUT / f'{role}-{width}-empty.png'), full_page=True)
        assert dialog.bounding_box()['height'] <= page.viewport_size['height'] - 30
        assert dialog.evaluate('el => Math.abs(el.getBoundingClientRect().bottom - el.querySelector(".sb-detail-footer").getBoundingClientRect().bottom) < 3')
        dialog.get_by_role('button', name='Clear filters').click()
        page.evaluate('document.documentElement.classList.add("dark")')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert dialog.evaluate('el => el.scrollWidth <= el.clientWidth + 1')
        page.screenshot(path=str(OUT / f'{role}-{width}.png'), full_page=True)
        dialog.get_by_role('button', name='Close', exact=True).click()
        expect(page.get_by_role('button', name='Enrollment emails', exact=True)).to_be_focused()
        page.get_by_role('button', name=re.compile('^Open notifications')).click()
        page.get_by_role('link').filter(has_text='Enrollment emails pending').click()
        expect(page.get_by_role('dialog', name='Enrollment emails', exact=True)).to_be_visible()
        page.get_by_role('dialog', name='Enrollment emails', exact=True).get_by_role('button', name='Close', exact=True).click()
        payload['groups'][0].update(state='submitted', submitted=15, waiting=0)
        page.evaluate("async () => { const { invalidateCache } = await import('/src/hooks/useApi.js'); invalidateCache('/api/management/analytics/'); invalidateCache('/api/instructor/batches/1/email-progress/'); }")
        expect(page.get_by_text('Synthetic Email Batch: All 15 enrollment emails submitted.', exact=False).first).to_be_visible()
        page.get_by_role('button', name=re.compile('^Open notifications')).click()
        completed = page.get_by_role('link').filter(has_text='All enrollment emails submitted')
        expect(completed).to_be_visible()
        completed.click()
        expect(page.get_by_role('dialog', name='Enrollment emails', exact=True)).to_be_visible()
        page.get_by_role('dialog', name='Enrollment emails', exact=True).get_by_role('button', name='Close', exact=True).click()
        page.get_by_role('button', name='Enroll students', exact=True).click()
        enrollment = page.get_by_role('dialog', name='Enroll students', exact=True)
        enrollment.get_by_role('button', name='Manual entry', exact=True).click()
        enrollment.get_by_placeholder('e.g. villanueva.azel@dnsc.edu.ph').fill('synthetic-new@dnsc.edu.ph')
        enrollment.get_by_placeholder('e.g. Azel Villanueva').fill('Synthetic New Student')
        enrollment.get_by_placeholder('e.g. 2026-01982').fill('2026-00100')
        enrollment.get_by_role('button', name='Preview student', exact=True).click()
        enrollment.get_by_label('Enrollment email timing', exact=True).select_option('later')
        enrollment.get_by_role('checkbox').last.check()
        enrollment.get_by_role('button', name='Confirm 1 enrollments', exact=True).click()
        if role == 'admin':
            page.get_by_role('dialog', name='Confirm student enrollment?', exact=True).get_by_role('button', name='Enroll students', exact=True).click()
        expect(enrollment.get_by_role('button', name='Check enrollment result', exact=True)).to_be_visible()
        expect(enrollment.get_by_label('Enrollment email timing', exact=True)).to_be_disabled()
        enrollment.get_by_role('button', name='Check enrollment result', exact=True).click()
        assert enrollment_writes[0] == enrollment_writes[1]
        assert len(enrollment_commands) == 1
        expect(enrollment.get_by_text('1 emails held for later.', exact=False)).to_be_visible()
        assert enrollment_modes == ['later']
        enrollment.get_by_role('button', name='Close enrollment', exact=True).click()
        page.get_by_role('button', name='Enrollment emails', exact=True).click()
        dialog = page.get_by_role('dialog', name='Enrollment emails', exact=True)
        original_rows = copy.deepcopy(payload['rows'])
        payload['groups'] = []
        payload['service'].update(worker_recent=False, notice='')
        if role == 'admin':
            payload['service']['diagnostics']['worker_recent'] = False
        for status in ('history_unavailable', 'held', 'accepted', 'delivered'):
            payload['rows'] = [copy.deepcopy(next(row for row in original_rows if row['status'] == status))]
            dialog.get_by_role('button', name='Refresh status', exact=True).click()
            expect(dialog.get_by_text(LABELS[status], exact=True).last).to_be_visible()
            expect(dialog.get_by_text('Emails are waiting', exact=True)).to_have_count(0)
            expect(dialog.get_by_text('Service details', exact=True)).to_have_count(0)
        payload['rows'] = [copy.deepcopy(original_rows[-1])]
        dialog.get_by_role('button', name='Refresh status', exact=True).click()
        expect(dialog.get_by_text('Automatic sending needs administrator attention.', exact=True)).to_be_visible()
        dialog.get_by_label('Search students', exact=True).fill('NOT_FOUND')
        expect(dialog.get_by_text('No matching students', exact=True)).to_be_visible()
        expect(dialog.get_by_text('Emails are waiting', exact=True)).to_be_visible()
        if role == 'admin':
            expect(dialog.get_by_text('Service details', exact=True)).to_be_visible()
            expect(dialog.get_by_text('The background sender has not checked in recently.', exact=False)).not_to_be_visible()
            dialog.get_by_text('Service details', exact=True).click()
            expect(dialog.get_by_text('The background sender has not checked in recently.', exact=False)).to_be_visible()
        else:
            expect(dialog.get_by_text('Service details', exact=True)).to_have_count(0)
            expect(dialog.get_by_text('Last provider check:', exact=False)).to_have_count(0)
        page.screenshot(path=str(OUT / f'{role}-{width}-blocked-warning.png'), full_page=True)
        payload['rows'] = original_rows
        dialog.get_by_label('Search students', exact=True).fill('')
        dialog.get_by_role('button', name='Refresh status', exact=True).click()
        expect(dialog.locator('tbody > tr.email-record-row')).to_have_count(10)
        dialog.get_by_role('button', name='Close', exact=True).click()
        if role == 'instructor' and width == 1366:
            page.get_by_role('button', name='Enrollment emails', exact=True).click()
            dialog = page.get_by_role('dialog', name='Enrollment emails', exact=True)
            dialog.get_by_role('button', name='2', exact=True).click()
            payload['rows'] = payload['rows'][:2]
            dialog.get_by_role('button', name='Refresh status', exact=True).click()
            expect(dialog.locator('tbody > tr.email-record-row')).to_have_count(2)
            expect(dialog.get_by_role('button', name='2', exact=True)).to_have_count(0)
            payload['batch']['status'] = 'archived'
            dialog.get_by_role('button', name='Refresh status', exact=True).click()
            expect(dialog.get_by_text('Archived · Read-only', exact=False)).to_be_visible()
            expect(dialog.get_by_role('group', name='Enrollment email actions')).to_have_count(0)
            expect(dialog.get_by_role('checkbox', name='Select Synthetic Student 01')).to_be_disabled()
            payload['batch']['status'] = 'active'
            payload['rows'] = []
            payload['groups'] = []
            payload['service'].update(worker_recent=False, notice='')
            dialog.get_by_role('button', name='Refresh status', exact=True).click()
            expect(dialog.get_by_text('No enrolled students yet', exact=True)).to_be_visible()
            expect(dialog.get_by_text('Emails are waiting', exact=True)).to_have_count(0)
            expect(dialog.get_by_text('Service details', exact=True)).to_have_count(0)
            dialog.get_by_role('button', name='Close', exact=True).click()
            payload['_error'] = True
            page.evaluate('sessionStorage.clear()')
            page.reload()
            page.wait_for_load_state('networkidle')
            # The notification URL reopens its email dialog after reload.
            dialog = page.get_by_role('dialog', name='Enrollment emails', exact=True)
            expect(dialog.get_by_text('Could not load this section.', exact=False)).to_be_visible()
            expect(dialog.get_by_text('No enrolled students yet', exact=True)).to_have_count(0)
            payload.pop('_error')
            dialog.get_by_role('button', name='Retry', exact=True).click()
            expect(dialog.get_by_text('No enrolled students yet', exact=True)).to_be_visible()
        assert not errors, errors
        checks.append(f'{role} {width}px: profile photos and missing/broken fallbacks, history modal/keyboard/focus/nested resend/empty/dark/geometry, fixed-group progress, completion toast/bell link, full filtered selection/paging, keyboard menu/Escape, hold review, filter reset, safe uncertain-write retry, intentional resend reason, frozen enrollment response recovery, Send later enrollment, compact no-match')
        context.close()
    browser.close()
    print(json.dumps({'checks': checks}, indent=2))
