"""Real local API: enrollment, Google-boundary sign-in, setup, answering and results."""
import json
import os
import base64
from pathlib import Path
import re
from urllib.parse import urlparse
from playwright.sync_api import expect, sync_playwright

OUT = Path(__file__).parent / 'artifacts/enrollment-assessment-journey'
AUTH = json.loads((OUT / 'auth.json').read_text(encoding='utf-8'))
BASE = os.environ.get('ENROLLMENT_JOURNEY_FRONTEND_URL', 'http://127.0.0.1:5186')
API = os.environ.get('ENROLLMENT_JOURNEY_API_URL', 'http://127.0.0.1:8026')
checks, findings, errors = [], [], []


def checked(message):
    checks.append(message)
    print('PASS: ' + message, flush=True)


def context_for(browser, session, width, *, mobile=False, mutations=None, services=None):
    options = dict(viewport={'width': width, 'height': 950}, is_mobile=mobile)
    if mobile:
        options['user_agent'] = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36'
    context = browser.new_context(**options)
    values = {'sb-token': session['token'], 'sb-role': session['user']['role'], 'sb-user': json.dumps(session['user'])}
    if session.get('refresh'):
        values['sb-refresh'] = session['refresh']
    # Set once so setup's saved profile survives reloads.
    context.add_init_script('for (const [k,v] of Object.entries(' + json.dumps(values) + ')) if (!localStorage.getItem(k)) localStorage.setItem(k,v)')
    def route_request(route):
        url = urlparse(route.request.url)
        if url.hostname in ('127.0.0.1', 'localhost') and url.path.startswith('/api/'):
            if url.path.endswith('/events/'):
                return route.fulfill(status=204)
            if mutations is not None and url.path.endswith('/submit/'):
                exam = int(url.path.split('/')[-3])
                mutations.setdefault(exam, []).append(route.request.post_data_json)
                if len(mutations[exam]) == 1 and exam == AUTH['exams'][1]['id']:
                    return route.abort('failed')  # An unsaved request keeps answers.
                response = route.fetch(url=API + url.path + ('?' + url.query if url.query else ''))
                if len(mutations[exam]) == 1 and exam == AUTH['exams'][0]['id']:
                    assert response.status == 200
                    return route.abort('failed')  # A saved request recovers from the canonical read.
                return route.fulfill(response=response)
            return route.continue_(url=API + url.path + ('?' + url.query if url.query else ''))
        if url.hostname in ('127.0.0.1', 'localhost'):
            return route.continue_()
        if url.hostname == 'cdnjs.cloudflare.com' and services and services.get('map'):
            suffix = 'css' if url.path.endswith('.css') else 'js'
            asset = OUT.parent / 'company-collection' / f'leaflet.min.{suffix}'
            return route.fulfill(body=asset.read_bytes(), content_type='text/css' if suffix == 'css' else 'text/javascript')
        if url.hostname and url.hostname.endswith('tile.openstreetmap.org'):
            return route.fulfill(body=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='), content_type='image/png')
        if url.hostname == 'psgc.gitlab.io':
            rows = [{'code': 'B1', 'name': 'Synthetic Barangay'}] if 'barangays' in url.path else [{'code': 'C1', 'name': 'Panabo City'}] if 'cities-municipalities' in url.path else [{'code': 'P1', 'name': 'Davao del Norte'}]
            return route.fulfill(json=rows, headers={'Access-Control-Allow-Origin': '*'})
        if url.hostname == 'nominatim.openstreetmap.org':
            return route.fulfill(json=[], headers={'Access-Control-Allow-Origin': '*'})
        return route.abort()
    context.route('**/*', route_request)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(error.stack or str(error)))
    return context, page


def get_json(context, path, token):
    response = context.request.get(API + path, headers={'Authorization': 'Bearer ' + token})
    assert response.status == 200, (path, response.status, response.text())
    return response.json()


with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    try:
        for role, width, mode in [('instructor', 1366, 'now'), ('admin', 390, 'later')]:
            print('Checking complete journey:', role, flush=True)
            staff = AUTH['staff'][role]
            staff_context, staff_page = context_for(browser, staff, width)
            staff_page.set_default_timeout(15000)
            staff_page.set_default_navigation_timeout(45000)
            staff_page.goto(BASE + ('/instructor/students' if role == 'instructor' else f'/admin/batches?batch_id={AUTH["batch"]}'), wait_until='networkidle')
            staff_page.get_by_role('button', name='Enroll students', exact=True).click()
            enrollment = staff_page.get_by_role('dialog', name='Enroll students', exact=True)
            enrollment.get_by_role('button', name='Manual entry', exact=True).click()
            email, name = f'browser-{role}@dnsc.edu.ph', f'Synthetic Browser {role.title()}'
            enrollment.get_by_placeholder('e.g. villanueva.azel@dnsc.edu.ph').fill(email)
            enrollment.get_by_placeholder('e.g. Azel Villanueva').fill(name)
            enrollment.get_by_placeholder('e.g. 2026-01982').fill('2098-00401' if role == 'instructor' else '2098-00402')
            enrollment.get_by_role('button', name='Preview student', exact=True).click()
            try:
                expect(enrollment.get_by_label('Enrollment email timing')).to_be_visible()
            except Exception:
                staff_page.screenshot(path=str(OUT / f'{role}-enrollment-error.png'), full_page=True)
                print('Enrollment review diagnostics:', enrollment.inner_text(), flush=True)
                raise
            enrollment.get_by_label('Enrollment email timing').select_option(mode)
            enrollment.get_by_role('checkbox').check()
            enrollment.get_by_role('button', name='Confirm 1 enrollments', exact=True).click()
            if role == 'admin':
                staff_page.get_by_role('dialog', name='Confirm student enrollment?', exact=True).get_by_role('button', name='Enroll students', exact=True).click()
            expect(enrollment.get_by_text('1 enrolled; 0 already enrolled', exact=False)).to_be_visible()
            enrollment.get_by_role('button', name='Done', exact=True).click()
            checked(f'{role}: reviewed UI enrollment saved with email mode {mode}')

            # Only Google's external identity response is replaced in the isolated server.
            login = staff_context.request.post(API + '/api/auth/google/', data={'token': f'synthetic-journey-{role}'})
            assert login.status == 200, login.text()
            identity = login.json()
            assert identity['user']['name'] == name and not identity['user']['phone']
            session = dict(token=identity['access'], refresh=identity['refresh'], user=identity['user'])
            writes = {}
            services = {'map': False}
            context, page = context_for(browser, session, 1366 if role == 'instructor' else 390,
                                        mobile=role == 'admin', mutations=writes, services=services)
            page.set_default_timeout(15000)
            page.goto(BASE + '/student/setup', wait_until='networkidle')
            page.get_by_placeholder('e.g. 09123456789').fill('09000000401')
            page.get_by_role('button', name='Next', exact=True).click()
            page.get_by_role('button', name='My family home (I will commute)', exact=True).click()
            page.get_by_label('Province', exact=True).select_option('P1')
            page.get_by_label('City / Municipality', exact=True).select_option('C1')
            page.get_by_label('Barangay', exact=True).select_option('Synthetic Barangay')
            page.get_by_role('button', name='Within Panabo City only', exact=True).click()
            page.get_by_role('button', name='Next', exact=True).click()
            # Remote map scripts are deliberately blocked to check outage behavior.
            expect(page.get_by_role('button', name='Skip for now →', exact=True)).to_have_count(0)
            expect(page.get_by_role('button', name='Place a pin to continue', exact=True)).to_be_disabled()
            expect(page.get_by_text('A location pin is required to continue.', exact=False)).to_be_visible()
            expect(page.get_by_role('button', name='Retry map', exact=True)).to_be_visible()
            page.screenshot(path=str(OUT / f'{role}-map-outage.png'), full_page=True)
            # Restore cached real Leaflet assets, retry without losing fields, and pin explicitly.
            services['map'] = True
            page.get_by_role('button', name='Retry map', exact=True).click()
            expect(page.get_by_text('Tap anywhere to drop a pin', exact=True)).to_be_visible()
            expect(page.get_by_role('button', name='Place a pin to continue', exact=True)).to_be_disabled()
            page.locator('.leaflet-container').click(position={'x': 100, 'y': 100})
            expect(page.get_by_role('button', name='Continue →', exact=True)).to_be_enabled()
            page.get_by_role('button', name='Remove location pin', exact=True).click()
            expect(page.get_by_role('button', name='Place a pin to continue', exact=True)).to_be_disabled()
            expect(page.locator('.leaflet-marker-icon')).to_have_count(0)
            page.locator('.leaflet-container').click(position={'x': 100, 'y': 100})
            page.get_by_role('button', name='Continue →', exact=True).click()
            page.get_by_role('button', name='Back', exact=True).click()
            expect(page.get_by_role('button', name='Continue →', exact=True)).to_be_enabled()
            page.get_by_role('button', name='Continue →', exact=True).click()
            page.get_by_role('button', name='Finish & go to dashboard →', exact=True).click()
            expect(page).to_have_url(re.compile('/student/dashboard$'))
            profile = get_json(context, '/api/students/me/', session['token'])
            assert profile['phone'] == '09000000401'
            assert profile['address']['home']['barangay'] == 'Synthetic Barangay'
            assert isinstance(profile['address']['pinLat'], (int, float)) and isinstance(profile['address']['pinLng'], (int, float))
            checked(f'{role}: required-pin guidance during map outage, disabled/enabled continue, map retry, pin removal/replacement, back/review pin preservation and saved profile; student signs in while emails remain unsent')

            for exam in AUTH['exams']:
                page.goto(BASE + f'/student/assessments/{exam["id"]}/take', wait_until='networkidle')
                page.get_by_role('checkbox').check()
                page.get_by_role('button', name=re.compile('^Agree.*start$')).click()
                questions = [q for q in AUTH['questions'] if q['exam'] == exam['id']]
                for index in range(len(questions)):
                    title = page.locator('h2').filter(has_text=re.compile('synthetic', re.I)).last.inner_text()
                    question = next(q for q in questions if q['title'] == title)
                    if question['kind'] == 'identification':
                        page.get_by_placeholder('Your answer…').fill('  eXpEcTeD tErM  ')
                        page.get_by_placeholder('Your answer…').blur()
                    else:
                        choice = 'Synthetic incorrect' if question['intentionally_wrong'] else 'Synthetic correct'
                        page.get_by_role('button', name=re.compile(choice)).click()
                    page.get_by_role('button', name='Review answers' if index == len(questions) - 1 else 'Next →', exact=True).click()
                page.get_by_role('button', name='Submit', exact=True).click()
                page.get_by_role('button', name='Yes, submit', exact=True).click()
                if exam['id'] == AUTH['exams'][1]['id']:
                    expect(page.get_by_text(re.compile('Your answers are kept on this device'))).to_be_visible()
                    record = get_json(context, '/api/assessments/', session['token'])
                    assert next(row for row in record['assessments'] if row['id'] == exam['id'])['attempt_status'] == 'in_progress'
                    page.get_by_role('button', name='Submit', exact=True).click()
                    page.get_by_role('button', name='Yes, submit', exact=True).click()
                expect(page).to_have_url(re.compile(f'/student/assessments/{exam["id"]}/results$'))
                expect(page.get_by_role('heading', name=exam['title'], exact=True)).to_be_visible()
                assert page.evaluate(f'localStorage.getItem("sb_integrity_active_{identity["user"]["id"]}_{exam["id"]}")') is None
                results = get_json(context, f'/api/student/results/?assessment_id={exam["id"]}', session['token'])
                assert results['completed_required_count'] == (1 if exam == AUTH['exams'][0] else 2)
                assert results['recommendations_locked'] == (exam == AUTH['exams'][0])
                page.screenshot(path=str(OUT / f'{role}-assessment-{exam["id"]}-result.png'), full_page=True)
            assert len(writes[AUTH['exams'][0]['id']]) == 1
            assert len(writes[AUTH['exams'][1]['id']]) == 2
            combined = get_json(context, '/api/student/results/combined/', session['token'])
            assert (combined['overall_raw_score'], combined['overall_max_score'], combined['overall_percentage']) == (5, 6, 83.33)
            assert combined['all_required_completed'] and not combined['recommendations_locked']
            emails = get_json(staff_context, f'/api/instructor/batches/{AUTH["batch"]}/emails/', staff['token'])
            row = next(row for row in emails['rows'] if row['email'] == email)
            assert row['status'] == ('queued' if mode == 'now' else 'held')
            for viewer in AUTH['staff'].values():
                roster = get_json(staff_context, f'/api/instructor/batches/{AUTH["batch"]}/students/', viewer['token'])
                student = next(row for row in roster['students'] if row['id'] == identity['user']['id'])
                assert student['all_required_completed']
            checked(f'{role}: two real browser submissions, mixed question types, first-result lock/final unlock, saved-response recovery, unsaved retry, exact 5/6 score and staff visibility; email still {row["status"]}')
            context.close()
            staff_context.close()
    finally:
        browser.close()
        (OUT / 'checks.json').write_text(json.dumps(dict(checks=checks, findings=findings, page_errors=errors), indent=2), encoding='utf-8')
assert not errors, errors
print(json.dumps(dict(checks=checks, findings=findings, page_errors=errors), indent=2))
