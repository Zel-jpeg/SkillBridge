"""Current enrollment flow against enrollment_server's disposable database only."""
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

FRONTEND_PORT, API_PORT = map(int, sys.argv[1:3])
BASE = f'http://127.0.0.1:{FRONTEND_PORT}'
API = f'http://127.0.0.1:{API_PORT}'
OUT = Path(__file__).parent / 'artifacts/enrollment'
auth = json.loads((OUT / 'auth.json').read_text())
checks, errors = [], []

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    for role, width in [('instructor', 1366), ('admin', 375)]:
        print(f'Checking current enrollment workflow: {role}', flush=True)
        context = browser.new_context(viewport={'width': width, 'height': 950})
        values = {'sb-token': auth[role], 'sb-role': role, 'sb-user': json.dumps(auth['users'][role]),
                  'sb-session-id': f'synthetic-review-{role}'}
        context.add_init_script('for (const [key,value] of Object.entries(' + json.dumps(values) + ')) localStorage.setItem(key,value)')
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        held_routes, enroll_writes = [], []
        lost = [False]
        def route_api(route):
            source = urlparse(route.request.url)
            if source.path.endswith('/events/'):
                return route.fulfill(status=204)
            if source.path.startswith('/api/'):
                if source.path.endswith('/enroll/'):
                    enroll_writes.append(route.request.post_data_json)
                    if role == 'instructor' and len(enroll_writes) == 1:
                        held_routes.append(route)
                        return
                try:
                    response = route.fetch(url=API + source.path + ('?' + source.query if source.query else ''), timeout=15000)
                    if role == 'admin' and source.path.endswith('/enroll/') and not lost[0]:
                        lost[0] = True
                        return route.abort('failed')
                    return route.fulfill(response=response)
                except Exception:
                    errors.append(f'Synthetic API transport failed: {route.request.method} {source.path}')
                    return route.abort()
            return route.continue_() if source.hostname in ('127.0.0.1', 'localhost') else route.abort()
        context.route('**/*', route_api)
        page.goto(BASE + ('/instructor/students' if role == 'instructor' else f'/admin/batches?batch_id={auth["batch_id"]}'))
        page.wait_for_load_state('networkidle')
        page.get_by_role('button', name='Enroll students', exact=True).click()
        dialog = page.get_by_role('dialog', name='Enroll students', exact=True)
        expect(dialog).to_be_visible()
        if role == 'instructor':
            dialog.locator('input[type=file]').set_input_files(str(OUT / 'iams-synthetic.xlsx'))
            review = page.locator('.enrollment-review-dialog')
            expect(review).to_be_visible(timeout=30000)
            expect(review.get_by_text('2 students will be enrolled', exact=False)).to_be_visible()
            expect(review.get_by_role('button', name='Confirm 2 enrollments')).to_be_disabled()
            review.get_by_label('Show rows').select_option('unsupported')
            expect(review.get_by_text('1 matching rows', exact=True)).to_be_visible()
            review.get_by_label('Show rows').select_option('all')
            review.get_by_label('Enrollment email timing').select_option('later')
            review.get_by_role('checkbox').check()
            review.get_by_role('button', name='Confirm 2 enrollments').click()
            expect(review.get_by_role('button', name='Enrolling…', exact=True)).to_be_disabled()
            expect(review.get_by_role('button', name='Close review', exact=True)).to_be_disabled()
            saved_route = held_routes.pop()
            response = saved_route.fetch(url=API + f'/api/instructor/batches/{auth["batch_id"]}/enroll/')
            saved_route.fulfill(response=response)
            expect(review.get_by_text('2 enrolled; 1 already enrolled; 4 not enrolled.', exact=False)).to_be_visible()
            expect(review.get_by_text('2 emails held for later.', exact=False)).to_be_visible()
            review.get_by_role('button', name='Done', exact=True).click()
            page.get_by_role('button', name='Enrollment emails', exact=True).click()
            emails = page.get_by_role('dialog', name='Enrollment emails', exact=True)
            expect(emails.get_by_role('progressbar', name='Emails submitted')).to_have_attribute('aria-valuemax', '2')
            expect(emails.get_by_role('progressbar', name='Emails submitted')).to_have_attribute('aria-valuenow', '0')
            emails.get_by_role('button', name='Send all not scheduled (2)', exact=True).click()
            confirmation = page.get_by_role('dialog', name='Send selected', exact=True)
            confirmation.get_by_role('button', name='Confirm email action', exact=True).click()
            expect(confirmation).to_have_count(0)
            expect(emails.get_by_text('Waiting to send', exact=True)).to_be_visible()
            assert emails.evaluate('element => element.scrollWidth <= element.clientWidth + 1')
            page.screenshot(path=str(OUT / 'workflow-instructor-progress.png'))
            checks.append('Instructor: real IAMS upload, unsupported/duplicate rows, verified loading state, two held jobs, explicit release, fixed progress and no provider sending')
        else:
            dialog.get_by_role('button', name='Manual entry', exact=True).click()
            dialog.get_by_placeholder('e.g. villanueva.azel@dnsc.edu.ph').fill('synthetic-recovery@dnsc.edu.ph')
            dialog.get_by_placeholder('e.g. Azel Villanueva').fill('Synthetic Recovery Student')
            dialog.get_by_placeholder('e.g. 2026-01982').fill('2099-00080')
            dialog.get_by_role('button', name='Preview student', exact=True).click()
            dialog.get_by_label('Enrollment email timing').select_option('later')
            dialog.get_by_role('checkbox').check()
            dialog.get_by_role('button', name='Confirm 1 enrollments').click()
            page.get_by_role('dialog', name='Confirm student enrollment?', exact=True).get_by_role('button', name='Enroll students', exact=True).click()
            expect(dialog.get_by_role('button', name='Check enrollment result')).to_be_visible()
            expect(dialog.get_by_label('Enrollment email timing')).to_be_disabled()
            dialog.get_by_role('button', name='Check enrollment result').click()
            assert enroll_writes[0] == enroll_writes[1]
            expect(dialog.get_by_text('1 enrolled; 0 already enrolled', exact=False)).to_be_visible()
            dialog.get_by_role('button', name='Done', exact=True).click()
            result = context.request.get(API + f'/api/instructor/batches/{auth["batch_id"]}/emails/', headers={'Authorization': 'Bearer ' + auth[role]})
            assert result.status == 200
            recovery = next(row for row in result.json()['rows'] if row['email'] == 'synthetic-recovery@dnsc.edu.ph')
            assert recovery['status'] == 'held' and len(recovery['history']) == 1
            page.get_by_role('button', name='Enrollment emails', exact=True).click()
            emails = page.get_by_role('dialog', name='Enrollment emails', exact=True)
            expect(emails.get_by_role('progressbar', name='Emails submitted')).to_have_attribute('aria-valuemax', '1')
            assert emails.evaluate('element => element.scrollWidth <= element.clientWidth + 1')
            page.screenshot(path=str(OUT / 'workflow-admin-recovery.png'))
            checks.append('Admin: reviewed manual enrollment, real committed-response loss, frozen UUID/payload recovery and one saved result')
        context.close()
    browser.close()
assert not errors, errors
print(json.dumps({'checks': checks, 'page_errors': errors}, indent=2))
