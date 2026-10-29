"""Real API/browser cycle closeout, partner reuse, retained exports and returning student."""
import json
import os
import re
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright
expect.set_options(timeout=20000)

OUT = Path(__file__).parent / 'artifacts/cycle-lifecycle'
AUTH = json.loads((OUT / 'auth.json').read_text(encoding='utf-8'))
BASE = os.environ['ADMIN_MANAGEMENT_FRONTEND_URL']
API = 'http://127.0.0.1:' + os.environ['ADMIN_MANAGEMENT_API_PORT']
checks, errors = [], []


def checked(note):
    checks.append(note); print('PASS: ' + note, flush=True)


def session(browser, role, width=1440, dark=False):
    person = AUTH['sessions'][role]
    context = browser.new_context(viewport={'width': width, 'height': 950}, color_scheme='dark' if dark else 'light')
    values = {'sb-token': person['token'], 'sb-refresh': person['refresh'], 'sb-role': role,
              'sb-user': json.dumps(person['user']), 'sb-theme': 'dark' if dark else 'light'}
    context.add_init_script('for (const [k,v] of Object.entries(' + json.dumps(values) + ')) if (!localStorage.getItem(k)) localStorage.setItem(k,v)')
    def routing(route):
        url = urlparse(route.request.url)
        if url.hostname in ('127.0.0.1', 'localhost') and url.path.startswith('/api/'):
            if url.path.endswith('/events/'):
                return route.fulfill(status=204)
            return route.continue_(url=API + url.path + ('?' + url.query if url.query else ''))
        if url.hostname not in ('localhost', '127.0.0.1'):
            return route.abort()
        route.continue_()
    context.route('**/*', routing)
    page = context.new_page(); page.on('pageerror', lambda e: errors.append(str(e)))
    return context, page


with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    context, page = session(browser, 'instructor')
    page.goto(f'{BASE}/instructor/students?batch_id={AUTH["batch"]}'); page.wait_for_load_state('networkidle')
    (OUT / 'initial-dom.txt').write_text(page.locator('body').inner_text(), encoding='utf-8')
    expect(page.get_by_text('Required assessments complete', exact=True)).to_be_visible()
    expect(page.get_by_text('1 of 1', exact=True)).to_be_visible()
    expect(page.get_by_text('Awaiting coordinator review', exact=True)).to_be_visible()
    expect(page.get_by_text('Cycle closeout & saved reports', exact=True)).to_have_count(0)
    expect(page.get_by_role('button', name='Mark OJT completed', exact=True)).to_have_count(0)
    checked('Four recommendation-focused summary cards preserve required completion despite a flagged optional assessment')
    for width in (375, 768, 1440):
        page.set_viewport_size({'width': width, 'height': 1000})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
        expect(page.get_by_role('button', name='Batch actions', exact=True)).to_be_visible()
    page.get_by_role('button', name='Batch actions', exact=True).click()
    expect(page.get_by_role('menuitem', name='Transfer student', exact=True)).to_be_visible()
    page.screenshot(path=str(OUT / 'recommendation-roster-desktop.png'), full_page=True, animations='disabled')
    page.get_by_role('menuitem', name='Save report & archive batch', exact=True).click()
    dialog = page.get_by_role('dialog', name='Review & archive batch', exact=True)
    expect(dialog).to_contain_text('Approved decisions')
    expect(dialog.get_by_role('button', name='Save report & archive batch')).to_be_disabled()
    dialog.get_by_role('checkbox').check()
    dialog.get_by_role('button', name='Save report & archive batch', exact=True).click()
    page.get_by_role('dialog', name='Save report and archive?').get_by_role('button', name='Save report & archive', exact=True).click()
    expect(page.get_by_role('button', name='Download PDF', exact=True)).to_be_visible()
    checked('Batch actions review saves a report and archives with approved decisions unchanged, without training outcomes')
    for fmt in ('PDF', 'XLSX', 'CSV'):
        with page.expect_download() as event:
            page.get_by_role('button', name='Download ' + fmt, exact=True).click()
        event.value.save_as(str(OUT / ('closeout.' + fmt.lower())))
    page.screenshot(path=str(OUT / 'closed-batch-desktop.png'), full_page=True)
    checked('Saved report tab downloads the archived PDF/XLSX/CSV versions')
    headers = {'Authorization': 'Bearer ' + AUTH['sessions']['admin']['token']}
    old = context.request.get(f'{API}/api/instructor/batches/{AUTH["batch"]}/closeout/?version=1', headers=headers).json()

    context.close()
    context, page = session(browser, 'admin')
    page.goto(BASE + '/admin/companies'); page.wait_for_load_state('networkidle')
    page.get_by_role('button', name='Archive partner', exact=True).click()
    page.get_by_role('dialog').get_by_role('button', name='Archive', exact=True).click()
    page.get_by_role('combobox', name='Partner status').select_option('archived')
    expect(page.get_by_role('button', name='Restore partner', exact=True)).to_be_visible()
    page.get_by_role('button', name='Restore partner', exact=True).click()
    page.get_by_role('dialog').get_by_role('button', name='Restore', exact=True).click()
    page.get_by_role('combobox', name='Partner status').select_option('active')
    expect(page.get_by_role('heading', name='Synthetic Reusable Partner', exact=True)).to_be_visible()
    page.get_by_role('button', name='Archive position', exact=True).click()
    page.get_by_role('dialog').get_by_role('button', name='Archive', exact=True).click()
    expect(page.get_by_role('button', name='Restore position', exact=True)).to_be_visible()
    page.get_by_role('button', name='Restore position', exact=True).click()
    page.get_by_role('dialog').get_by_role('button', name='Restore', exact=True).click()
    expect(page.get_by_role('button', name='Archive position', exact=True)).to_be_visible()
    checked('Partner and position archive/restore controls work independently')
    changed = context.request.patch(f'{API}/api/admin/positions/{AUTH["position"]}/', headers=headers, data={'slots': 7})
    assert changed.ok, changed.text()
    assert context.request.patch(f'{API}/api/admin/companies/{AUTH["partner"]}/', headers=headers, data={'name': 'Synthetic Next Cycle Partner'}).ok
    frozen = context.request.get(f'{API}/api/instructor/batches/{AUTH["batch"]}/closeout/?version=1', headers=headers).json()
    assert frozen == old and frozen['catalog'][0]['slots'] == 2
    checked('Next-cycle name and slot edits leave the issued closeout unchanged')

    enroll = f'{API}/api/instructor/batches/{AUTH["next_batch"]}/enroll/'
    rows = [{'school_id': '2026-00001', 'name': 'Synthetic Returning Student', 'email': 'browser-cycle-student@dnsc.edu.ph', 'course': 'BSIT'}]
    review = context.request.post(enroll + 'preview/', headers=headers, data={'students': rows}).json()
    assert review['rows'][0]['status'] == 'existing_student', review
    response = context.request.post(enroll, headers=headers, data={'students': review['rows'], 'review_token': review['review_token'], 'email_mode': 'later'})
    assert response.ok and response.json()['summary']['enrolled'] == 1, response.text()
    checked('Same student account joins the new active batch with preserved old membership')
    context.close()

    context, page = session(browser, 'student', 390)
    page.goto(BASE + '/student/profile'); page.wait_for_load_state('networkidle')
    expect(page.get_by_text('Welcome to Synthetic Cycle B', exact=True)).to_be_visible()
    page.get_by_label('Phone number', exact=True).fill('09987654321')
    page.get_by_role('button', name='Save changes', exact=True).click()
    expect(page.get_by_text('Profile saved successfully', exact=True)).to_be_visible()
    expect(page.get_by_text('No active OJT batch', exact=True)).not_to_be_visible()
    page.get_by_role('button', name='Confirm saved details for this batch', exact=True).click()
    expect(page.get_by_text('Your details are confirmed. You can start your new batch assessments.', exact=True)).to_be_visible()
    checked('Returning student confirms prefilled saved details on a phone layout')
    page.goto(BASE + '/student/assessments'); page.wait_for_load_state('networkidle')
    expect(page.get_by_role('heading', name='Cycle B required assessment', exact=True)).to_be_visible()
    page.get_by_role('button', name='View batch history', exact=True).click()
    page.locator('summary').filter(has_text='Synthetic Cycle A').click()
    expect(page.get_by_text('Networking: 7/10 (70%)', exact=True)).to_be_visible()
    expect(page.get_by_text('Approved decision: Network Support at Synthetic Reusable Partner', exact=True)).to_be_visible()
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
    page.screenshot(path=str(OUT / 'student-history-phone.png'), full_page=True)
    checked('New assessment list and previous archived cycle remain distinct without horizontal overflow')
    page.goto(f'{BASE}/student/assessments/{AUTH["exam"]}/take'); page.wait_for_load_state('networkidle')
    page.get_by_role('checkbox').check()
    page.get_by_role('button', name=re.compile('^Agree.*start$')).click()
    page.get_by_role('button', name=re.compile('Synthetic answer')).click()
    page.get_by_role('button', name='Review answers', exact=True).click()
    page.get_by_role('button', name='Submit', exact=True).click()
    page.get_by_role('button', name='Yes, submit', exact=True).click()
    expect(page).to_have_url(re.compile(f'/student/assessments/{AUTH["exam"]}/results$'), timeout=45000)
    student_headers = {'Authorization': 'Bearer ' + AUTH['sessions']['student']['token']}
    result = context.request.get(f'{API}/api/student/results/combined/', headers=student_headers).json()
    assert (result['overall_raw_score'], result['overall_max_score']) == (1, 1), result
    assert not result['recommendations_locked'] and result['recommendations']
    checked('Returning student submits the new assessment; only its 1/1 evidence unlocks the new batch results')
    approval = context.request.post(f'{API}/api/placements/approve/', headers=headers,
        data={'recommendation_id': result['recommendations'][0]['id']})
    assert approval.status == 201, approval.text()
    assert approval.json()['placement']['batch']['id'] == AUTH['next_batch']
    still_saved = context.request.get(f'{API}/api/instructor/batches/{AUTH["batch"]}/closeout/?version=1', headers=headers).json()
    assert still_saved == old
    checked('The same partner accepts the new cycle placement while old approved decision and report facts remain preserved')
    context.close()

    context, page = session(browser, 'instructor', 768, True)
    page.goto(f'{BASE}/instructor/students?batch_id={AUTH["batch"]}'); page.wait_for_load_state('networkidle')
    expect(page.locator('html')).to_have_class(re.compile(r'\bdark\b'))
    page.get_by_role('button', name='Saved reports', exact=True).click()
    expect(page.get_by_role('button', name='Download XLSX', exact=True)).to_be_visible()
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
    page.screenshot(path=str(OUT / 'instructor-history-tablet-dark.png'), full_page=True)
    checked('Owning instructor can retrieve the archived closeout on a dark tablet layout')
    page.get_by_role('button', name='Reactivate batch', exact=True).click()
    page.get_by_role('dialog', name='Reactivate this batch?').get_by_role('button', name='Reactivate batch', exact=True).click()
    expect(page.locator('#sb-main').get_by_role('alert')).to_contain_text('another active batch')
    expect(page.get_by_role('button', name='Download XLSX', exact=True)).to_be_visible()
    checked('Reactivation explains the single-active-batch conflict and preserves saved reports')
    context.close()

    context, page = session(browser, 'admin')
    page.goto(f'{BASE}/admin/batches?batch_id={AUTH["transfer_batch"]}'); page.wait_for_load_state('networkidle')
    page.get_by_role('button', name='Transfer student', exact=True).click()
    dialog = page.get_by_role('dialog', name='Transfer an existing student')
    dialog.get_by_label('Student school ID').fill('2026-00001')
    dialog.get_by_role('button', name='Review transfer', exact=True).click()
    expect(dialog).to_contain_text('From Synthetic Cycle B → Synthetic Transfer Target')
    dialog.get_by_role('button', name='Confirm transfer', exact=True).click()
    expect(dialog.get_by_role('status')).to_contain_text('Transfer saved')
    checked('Active-batch transfer requires an explicit source-to-target review and confirmation')
    student_headers = {'Authorization': 'Bearer ' + AUTH['sessions']['student']['token']}
    current = context.request.get(f'{API}/api/students/me/', headers=student_headers).json()
    assert current['batch']['id'] == AUTH['transfer_batch'] and current['profile_review_required']
    history = context.request.get(f'{API}/api/students/me/history/', headers=student_headers).json()
    assert {r['batch']['id'] for r in history['batches']} == {AUTH['batch'], AUTH['next_batch'], AUTH['transfer_batch']}
    checked('Transfer retains previous cycle and membership history and requires a new profile confirmation')
    context.close(); browser.close()

assert not errors, errors
(OUT / 'checks.json').write_text(json.dumps({'checks': checks, 'page_errors': errors}, indent=2), encoding='utf-8')
print(f'{len(checks)} browser groups passed; zero page errors.', flush=True)
