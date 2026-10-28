"""Real API instructor creation, validation, failures, sign-in and scoped access."""
import json
from pathlib import Path
import re
from urllib.parse import urlparse
from playwright.sync_api import expect, sync_playwright

OUT = Path(__file__).parent / 'artifacts/instructor-onboarding'
AUTH = json.loads((OUT / 'auth.json').read_text(encoding='utf-8'))
BASE, API = 'http://127.0.0.1:5187', 'http://127.0.0.1:8027'
checks, findings, errors = [], [], []


def checked(message):
    checks.append(message)
    print('PASS:', message, flush=True)


def session(browser, identity, width, height=950):
    context = browser.new_context(viewport={'width': width, 'height': height})
    values = {'sb-token': identity['token'], 'sb-role': identity['user']['role'], 'sb-user': json.dumps(identity['user'])}
    context.add_init_script('for (const [k,v] of Object.entries(' + json.dumps(values) + ')) if(!localStorage.getItem(k))localStorage.setItem(k,v)')
    state = dict(writes=[], hold=False, pending=[], lost=False)
    def intercept(route):
        url = urlparse(route.request.url)
        if url.hostname not in ('localhost', '127.0.0.1'):
            return route.abort()
        if not url.path.startswith('/api/'):
            return route.continue_()
        if url.path.endswith('/events/'):
            return route.fulfill(status=204)
        if url.path == '/api/admin/instructors/' and route.request.method == 'POST':
            state['writes'].append(route.request.post_data_json)
            if state['hold']:
                state['pending'].append(route)
                return
            if state['lost']:
                state['lost'] = False
                response = route.fetch(url=API + url.path)
                assert response.status == 201
                return route.abort('failed')
        return route.continue_(url=API + url.path + ('?' + url.query if url.query else ''))
    context.route('**/*', intercept)
    page = context.new_page()
    page.set_default_timeout(15000)
    page.set_default_navigation_timeout(45000)
    page.on('pageerror', lambda error: errors.append(error.stack or str(error)))
    return context, page, state


def open_form(page):
    page.get_by_role('button', name='Add Instructor', exact=True).click()
    form = page.get_by_role('dialog', name='Add Instructor', exact=True)
    expect(form).to_be_visible()
    return form


def fill(form, email, name, identifier):
    form.get_by_label('DNSC Email', exact=True).fill(email)
    form.get_by_label('Full Name', exact=True).fill(name)
    form.get_by_label('Instructor ID', exact=True).fill(identifier)


def users(context):
    response = context.request.get(API + '/api/admin/users/', headers={'Authorization': 'Bearer ' + AUTH['admin']['token']})
    assert response.status == 200
    return response.json()


def login_instructor(browser, name, width):
    api = browser.new_context()
    result = api.request.post(API + '/api/auth/google/', data={'token': f'synthetic-{name}'})
    assert result.status == 200, result.text()
    data = result.json()
    context, page, _ = session(browser, dict(token=data['access'], user=data['user']), width)
    page.goto(BASE + '/instructor/dashboard', wait_until='networkidle')
    expect(page.get_by_role('heading', name='Student performance', exact=True)).to_be_visible()
    headers = {'Authorization': 'Bearer ' + data['access']}
    batches = context.request.get(API + '/api/instructor/batches/', headers=headers)
    assert batches.status == 200 and batches.json() == []
    assert context.request.get(API + '/api/admin/users/', headers=headers).status == 403
    created = context.request.post(API + '/api/instructor/batches/', headers=headers, data={'name': 'New synthetic faculty batch'})
    assert created.status == 201, created.text()
    assert created.json()['instructor_id'] == data['user']['id']
    page.screenshot(path=str(OUT / f'{name}-dashboard.png'), full_page=True)
    context.close(); api.close()


with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    try:
        for label, width, height in [('desktop', 1366, 950), ('phone', 390, 640)]:
            print('Checking instructor onboarding:', label, flush=True)
            context, page, state = session(browser, AUTH['admin'], width, height)
            page.goto(BASE + '/admin/users', wait_until='networkidle')
            page.get_by_role('button', name=re.compile('^Instructors')).click()
            if label == 'phone':
                page.evaluate('document.documentElement.classList.add("dark")')
            form = open_form(page)
            expect(form.get_by_label('DNSC Email', exact=True)).to_be_focused()
            form.get_by_role('button', name='Add Instructor', exact=True).focus()
            page.keyboard.press('Tab')
            expect(form.get_by_role('button', name='Close add instructor', exact=True)).to_be_focused()
            page.keyboard.press('Shift+Tab')
            expect(form.get_by_role('button', name='Add Instructor', exact=True)).to_be_focused()
            page.keyboard.press('Escape')
            expect(form).to_have_count(0)
            expect(page.get_by_role('button', name='Add Instructor', exact=True)).to_be_focused()
            form = open_form(page)
            form.get_by_role('button', name='Add Instructor', exact=True).click()
            expect(form.get_by_text('Full name is required.', exact=True)).to_be_visible()
            expect(form.get_by_text('Email is required.', exact=True)).to_be_visible()
            assert not state['writes']
            assert form.bounding_box()['y'] >= 0
            assert form.bounding_box()['height'] <= height - 30
            assert form.evaluate('el => el.scrollWidth <= el.clientWidth + 1')
            expect(form.get_by_label('DNSC Email', exact=True)).to_have_attribute('aria-invalid', 'true')
            page.screenshot(path=str(OUT / f'{label}-validation.png'), full_page=True)

            fill(form, 'outside@example.invalid', f'Synthetic Faculty {label}', f'FAC-{label.upper()}')
            form.get_by_role('button', name='Add Instructor', exact=True).click()
            expect(form.get_by_text('Must be a @dnsc.edu.ph email.', exact=True)).to_be_visible()
            assert not state['writes']
            fill(form, f' FACULTY.{label.upper()}@DNSC.EDU.PH ', f'Synthetic Faculty {label}', 'EXISTING-001')
            form.get_by_role('button', name='Add Instructor', exact=True).click()
            expect(form.get_by_text('ID already in use.', exact=True)).to_be_visible()
            expect(form.get_by_text('Must be a @dnsc.edu.ph email.', exact=True)).to_have_count(0)
            assert not state['writes']
            fill(form, 'existing.faculty@dnsc.edu.ph', f'Synthetic Faculty {label}', f'FAC-{label.upper()}')
            form.get_by_role('button', name='Add Instructor', exact=True).click()
            expect(form.locator('form').get_by_role('alert')).to_contain_text('Email already exists')
            expect(form.get_by_placeholder('e.g. 2018-00042')).to_have_value(f'FAC-{label.upper()}')

            fill(form, f' FACULTY.{label.upper()}@DNSC.EDU.PH ', f'Synthetic Faculty {label}', f'FAC-{label.upper()}')
            form.get_by_role('button', name='BSIS only', exact=True).click()
            state['hold'] = True
            form.get_by_role('button', name='Add Instructor', exact=True).click()
            expect(form.get_by_role('button', name='Adding...', exact=True)).to_be_disabled()
            expect(form.get_by_role('button', name='Cancel', exact=True)).to_be_disabled()
            expect(form.get_by_role('button', name='Close add instructor', exact=True)).to_be_disabled()
            expect(form.get_by_label('DNSC Email', exact=True)).to_be_disabled()
            page.keyboard.press('Escape')
            expect(form).to_be_visible()
            assert state['writes'][-1]['email'] == f'faculty.{label}@dnsc.edu.ph'
            held = state['pending'].pop()
            response = held.fetch(url=API + '/api/admin/instructors/')
            assert response.status == 201
            assert response.json()['email_queued'] and not response.json()['email_sent']
            held.fulfill(response=response)
            state['hold'] = False
            expect(page.get_by_role('heading', name='Add Instructor', exact=True)).to_have_count(0)
            expect(page.get_by_text('Welcome email queued; delivery is not confirmed.', exact=False)).to_be_visible()
            matching = [row for row in users(context)['instructors'] if row['email'] == f'faculty.{label}@dnsc.edu.ph']
            assert len(matching) == 1 and matching[0]['courses'] == 'BSIS'
            page.reload(wait_until='networkidle')
            page.get_by_role('button', name=re.compile('^Instructors')).click()
            expect(page.get_by_text(f'Synthetic Faculty {label.title()}', exact=True)).to_be_visible()
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            page.screenshot(path=str(OUT / f'{label}-saved.png'), full_page=True)
            checked(f'{label}: dialog labels/initial focus/Tab loop/Escape/focus return, required/duplicate validation, uppercase/spaced email normalization, pending save guards, real saved account, truthful queued-email notice, responsive/dark layout and roster persistence')
            login_instructor(browser, f'faculty.{label}', width)
            checked(f'{label}: new instructor signs in through real Google endpoint, opens dashboard, starts with no foreign batches, creates owned batch and cannot use admin API')

            if label == 'desktop':
                form = open_form(page)
                fill(form, 'faculty.lost@dnsc.edu.ph', 'Synthetic Lost Response', 'FAC-LOST')
                state['lost'] = True
                form.get_by_role('button', name='Add Instructor', exact=True).click()
                expect(form.locator('form').get_by_role('alert')).to_be_visible()
                assert len([row for row in users(context)['instructors'] if row['email'] == 'faculty.lost@dnsc.edu.ph']) == 1
                form.get_by_role('button', name='Add Instructor', exact=True).click()
                expect(form.locator('form').get_by_role('alert')).to_contain_text('Email already exists')
                form.get_by_role('button', name='Cancel', exact=True).click()
                page.reload(wait_until='networkidle')
                checked('Lost committed creation response: explicit error, safe duplicate rejection on retry and one persisted instructor')
                form = open_form(page)
                fill(form, 'faculty.queuefail@dnsc.edu.ph', 'Synthetic Queue Failure', 'FAC-QUEUEFAIL')
                form.get_by_role('button', name='Add Instructor', exact=True).click()
                expect(page.get_by_role('heading', name='Add Instructor', exact=True)).to_have_count(0)
                expect(page.get_by_text('Email could not be queued; the instructor can use DNSC Google sign-in.', exact=False)).to_be_visible()
                login_instructor(browser, 'faculty.queuefail', width)
                checked('Email persistence failure: instructor stays saved and can sign in; UI reports queue failure rather than email delivery')
            context.close()
    finally:
        browser.close()
        (OUT / 'checks.json').write_text(json.dumps(dict(checks=checks, findings=findings, page_errors=errors), indent=2), encoding='utf-8')
assert not errors, errors
print(json.dumps(dict(checks=checks, findings=findings, page_errors=errors), indent=2))
