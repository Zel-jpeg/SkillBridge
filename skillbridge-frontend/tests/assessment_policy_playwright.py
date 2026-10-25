"""Real disposable API: staff editing/copy/extension and student countdowns."""
import json
import os
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse
from uuid import uuid4
from playwright.sync_api import sync_playwright, expect, Error

TESTS = Path(__file__).parent
AUTH = json.loads((TESTS / 'artifacts/admin-management/auth.json').read_text(encoding='utf-8'))
OUT = TESTS / 'artifacts/assessment-policy'
OUT.mkdir(parents=True, exist_ok=True)
BASE = 'http://127.0.0.1:' + os.environ['ADMIN_MANAGEMENT_FRONTEND_PORT']
API = 'http://127.0.0.1:' + os.environ['ADMIN_MANAGEMENT_API_PORT']
LIST = '/api/instructor/assessments/'
checks, errors = [], []


def request(context, path, identity='admin', method='get', data=None, expected=200):
    response = getattr(context.request, method)(API + path, headers={'Authorization': 'Bearer ' + AUTH[identity]['token']}, data=data)
    assert response.status == expected, (path, response.status, response.text()[:300])
    return response.json()


def session(browser, identity, mobile=False):
    options = {'viewport': {'width': 390 if mobile else 1440, 'height': 900}, 'reduced_motion': 'reduce'}
    if mobile:
        options.update(is_mobile=True, user_agent='Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36')
    context = browser.new_context(**options)
    user = AUTH[identity]['user']
    context.add_init_script('for(const [k,v] of Object.entries(' + json.dumps({
        'sb-token': AUTH[identity]['token'], 'sb-role': user['role'], 'sb-user': json.dumps(user),
    }) + ')) localStorage.setItem(k,v)')
    def route(route):
        url = urlparse(route.request.url)
        if url.path.endswith('/events/'): return route.fulfill(status=204)
        if url.path.startswith('/api/'):
            try:
                response = route.fetch(url=API + url.path + ('?' + url.query if url.query else ''))
                return route.fulfill(response=response)
            except Error as error:
                # Timing reads are explicitly aborted when submission changes
                # the page state; the browser may already have handled that route.
                if url.path.endswith('/timing/') and ('already handled' in str(error) or 'disposed' in str(error)):
                    return
                raise
        return route.continue_() if url.hostname in ('localhost', '127.0.0.1') else route.abort()
    context.route('**/*', route)
    page = context.new_page()
    page.set_default_timeout(15000)
    page.set_default_navigation_timeout(30000)
    page.on('pageerror', lambda error: errors.append(str(error)))
    return context, page


def close(context):
    context.unroute_all(behavior='ignoreErrors')
    context.close()


def open_staff(page, role, title):
    page.goto(BASE + f'/{role}/assessments')
    page.wait_for_load_state('networkidle')
    page.get_by_role('searchbox', name='Search assessments', exact=True).fill(title)
    page.get_by_role('button', name=('Open assessment ' if role == 'instructor' else 'View details for ') + title, exact=True).click()
    return page.get_by_role('dialog', name='Edit assessment' if role == 'instructor' else title, exact=True)


def run(browser, playwright, role, identity):
    context, page = session(browser, identity)
    title = f'{role} timing policy'
    due = datetime.now(timezone.utc) + timedelta(minutes=30)
    aid = request(context, LIST, identity=identity, method='post', expected=201, data={
        'title': title, 'batch_id': AUTH['batch_id'], 'duration_minutes': 60,
        'publication_status': 'published', 'due_at': due.isoformat(),
        'questions': [{'question_text': 'Pick the synthetic answer', 'question_type': 'mcq',
            'category': 'Synthetic Programming', 'choices': [{'text': 'Correct synthetic option', 'is_correct': True}, {'text': 'Other synthetic option', 'is_correct': False}]}],
    })['id']
    student_browser = playwright.chromium.launch(channel='chrome', headless=True)
    student_context, student_page = session(student_browser, 'student', mobile=True)
    try:
        student_page.goto(BASE + f'/student/assessments/{aid}/take')
        student_page.wait_for_load_state('networkidle')
        expect(student_page.get_by_text('Starting near the deadline gives less than the full time limit.', exact=False)).to_be_visible()
        student_page.get_by_role('checkbox').check()
        student_page.get_by_role('button', name='Agree & start', exact=True).click()
        timer = student_page.get_by_role('timer', name='Time remaining', exact=True)
        expect(timer).to_contain_text(re.compile(r'(29:[0-5]\d|30:00)'))
        student_page.get_by_role('button', name=re.compile('Correct synthetic option')).click()
        rows = request(context, f'/api/instructor/batches/{AUTH["batch_id"]}/students/')['students']
        result = next(r for r in next(s for s in rows if s['id'] == AUTH['student_id'])['assessment_results'] if r['id'] == aid)
        original_cutoff = result['attempt_timing']['deadline_at']
        dialog = open_staff(page, role, title)
        if role == 'admin': dialog.get_by_role('tab', name='Settings', exact=True).click()
        duration_label = 'Duration' if role == 'instructor' else 'Duration · minutes'
        expect(dialog.get_by_label(duration_label, exact=True)).to_be_disabled()
        publication = dialog.get_by_role('combobox', name='Publication state', exact=True)
        expect(publication).to_be_disabled()
        if role == 'instructor':
            expect(dialog.get_by_role('button', name=re.compile('^Available at:'))).to_be_disabled()
            dialog.get_by_role('button', name=re.compile('^Due at:')).click()
            page.get_by_role('dialog', name='Due at date and time', exact=True).get_by_role('button', name='Clear', exact=True).click()
            dialog.get_by_role('button', name='Save All Changes', exact=True).click()
            expect(page.get_by_role('dialog', name='Save all changes?', exact=True)).to_contain_text('Existing attempt cutoffs stay unchanged')
            page.get_by_role('button', name='Confirm Save', exact=True).click()
        else:
            dialog.get_by_label('Due at · Asia/Manila', exact=True).fill('')
            expect(dialog.get_by_role('region', name='Effect of assessment changes', exact=True)).to_contain_text('Existing attempt cutoffs stay unchanged')
            dialog.get_by_role('button', name='Review & save', exact=True).click()
            page.get_by_role('dialog', name='Save assessment changes?', exact=True).get_by_role('button', name='Save', exact=True).click()
        expect(page.get_by_role('status').filter(has_text='saved successfully.')).to_be_visible()
        current = request(context, f'/api/assessments/{aid}/timing/?attempt_started_at=' + result['attempt_started_at'].replace('+', '%2B'), identity='student')
        assert current['deadline_at'] == original_cutoff
        if role == 'instructor':
            dialog.get_by_role('button', name='Cancel', exact=True).click()
            page.goto(BASE + '/instructor/students')
            page.wait_for_load_state('networkidle')
            page.locator('select').filter(has=page.locator('option', has_text='Main synthetic cohort')).first.select_option(str(AUTH['batch_id']))
            page.get_by_role('button', name=re.compile('Synthetic Student')).first.click()
            student_details = page.get_by_role('dialog', name='Synthetic Student', exact=True)
            student_details.get_by_role('tab', name=re.compile('^Assessments')).click()
        else:
            dialog.get_by_role('tab', name='Students & attempts', exact=True).click()
            dialog.get_by_role('button', name=re.compile('Synthetic Student')).click()
            dialog.get_by_role('tab', name=re.compile('^Assessments')).click()
            student_details = dialog
        article = student_details.locator('article').filter(has=page.get_by_role('heading', name=title, exact=True)).first
        article.get_by_role('button', name='Grant extra time', exact=True).click()
        extension = page.get_by_role('dialog', name='Grant extra time to this attempt', exact=True)
        extension.get_by_label('Extra minutes', exact=True).fill('10')
        extension.get_by_label('Reason', exact=True).fill('Synthetic browser connectivity accommodation')
        extension.get_by_role('button', name='Confirm extra time', exact=True).click()
        expect(extension).not_to_be_visible()
        expect(timer).to_contain_text(re.compile(r'39:[0-5]\d'), timeout=25000)
        expect(student_page.get_by_role('button', name=re.compile('Correct synthetic option'))).to_be_visible()
        student_page.screenshot(path=str(OUT / f'{role}-student-extended.png'), full_page=True)
        checks.append(f'{role}: deadline-capped 30-minute countdown, active duration/opening/publication locks, reviewed deadline removal preserves existing cutoff, explicit extension synchronizes without losing answers')
        # Submit normally so subsequent role checks do not leave abandoned active work.
        student_page.get_by_role('button', name='Review answers', exact=True).click()
        student_page.get_by_role('button', name='Submit', exact=True).click()
        student_page.get_by_role('button', name='Yes, submit', exact=True).click()
        expect(student_page).to_have_url(re.compile(f'/student/assessments/{aid}/results'))
        close(student_context); student_browser.close()
        # Safe reuse through the role's native assessment details.
        dialog = open_staff(page, role, title)
        dialog.get_by_role('button', name='Duplicate as draft', exact=True).click()
        duplicate = page.get_by_role('dialog', name='Duplicate assessment as draft', exact=True)
        copy_title = title + ' reusable copy'
        duplicate.get_by_label('Copy title', exact=True).fill(copy_title)
        duplicate.get_by_label('Target batch', exact=True).select_option(str(AUTH['batch_id']))
        duplicate.get_by_role('button', name='Create draft copy', exact=True).click()
        expect(duplicate).not_to_be_visible()
        copy = next(a for a in request(context, LIST) if a['title'] == copy_title)
        assert copy['publication_status'] == 'draft' and not copy['is_required'] and not copy['include_in_competency']
        assert copy['attempt_count'] == 0 and copy['due_at'] is None and copy['question_count'] == 1
        dialog = open_staff(page, role, copy_title)
        if role == 'admin': dialog.get_by_role('tab', name='Settings', exact=True).click()
        expect(dialog.get_by_label(duration_label, exact=True)).to_be_enabled()
        for width, dark in [(1440, False), (390, True)]:
            page.set_viewport_size({'width': width, 'height': 950})
            page.evaluate('value => document.documentElement.classList.toggle("dark", value)', dark)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            page.screenshot(path=str(OUT / f'{role}-copy-{width}.png'), full_page=True)
        checks.append(f'{role}: Duplicate as draft preserves source results and produces editable optional/excluded content without copied attempts or deadlines')
    finally:
        if student_browser.is_connected():
            close(student_context); student_browser.close()
        close(context)


with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    try:
        run(browser, p, 'instructor', 'owner')
        run(browser, p, 'admin', 'admin')
    finally:
        browser.close()
assert not errors, errors
(OUT / 'checks.json').write_text(json.dumps({'checks': checks, 'page_errors': errors}, indent=2), encoding='utf-8')
print(json.dumps({'checks': checks, 'page_errors': errors}, indent=2))
