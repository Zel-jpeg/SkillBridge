"""Real local API: grouped publication, two existing students, labels and results."""
import json
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:5187'
API = 'http://127.0.0.1:8187'
OUT = Path(__file__).parent / 'artifacts/student-assessment-order'
AUTH = json.loads((OUT / 'auth.json').read_text(encoding='utf-8'))
checks, errors = [], []
expect.set_options(timeout=15000)


def checked(note):
    checks.append(note)
    print('PASS: ' + note, flush=True)


def session(browser, key, width=1440, dark=False):
    person = AUTH['sessions'][key]
    context = browser.new_context(viewport={'width': width, 'height': 1000},
                                  color_scheme='dark' if dark else 'light',
                                  is_mobile=width < 768, has_touch=width < 768)
    if width < 768:
        context.add_init_script("Object.defineProperty(navigator, 'userAgentData', {value: {mobile: true}, configurable: true})")
    values = {'sb-token': person['token'], 'sb-refresh': person['refresh'],
              'sb-role': person['user']['role'], 'sb-user': json.dumps(person['user']),
              'sb-theme': 'dark' if dark else 'light'}
    context.add_init_script('for (const [k,v] of Object.entries(' + json.dumps(values) + ')) if (!localStorage.getItem(k)) localStorage.setItem(k,v)')
    def route(request):
        url = urlparse(request.request.url)
        if url.path.startswith('/api/') and url.hostname in ('127.0.0.1', 'localhost'):
            if url.path.endswith('/events/'):
                return request.fulfill(status=204)
            return request.continue_(url=API + url.path + ('?' + url.query if url.query else ''))
        if url.hostname not in ('127.0.0.1', 'localhost'):
            return request.abort()
        request.continue_()
    context.route('**/*', route)
    page = context.new_page()
    page.set_default_navigation_timeout(60000)
    page.on('pageerror', lambda error: errors.append(str(error)))
    return context, page


with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    try:
        for role in ('instructor', 'admin'):
            for dark in (False, True):
                context, page = session(browser, role, dark=dark)
                page.goto(BASE + f'/{role}/assessments', wait_until='networkidle')
                for kind, name in [('button', 'Publish drafts together'), ('link', 'Assessment archives'), ('link', 'Create assessment')]:
                    action = page.get_by_role(kind, name=name, exact=True)
                    page.mouse.move(0, 0)
                    page.wait_for_timeout(200)
                    original = action.evaluate('node => getComputedStyle(node).backgroundColor')
                    action.hover()
                    expect(action).not_to_have_css('background-color', original)
                    expect(action).to_have_css('cursor', 'pointer')
                    page.keyboard.press('Tab')
                    action.focus()
                    expect(action).to_be_focused()
                    expect(action).to_have_css('outline-style', 'solid')
                    expect(action).to_have_css('outline-width', '2px')
                page.screenshot(path=str(OUT / f'{role}-header-{"dark" if dark else "light"}.png'), full_page=True)
                context.close()
            context, page = session(browser, role, width=375, dark=True)
            page.goto(BASE + f'/{role}/assessment/create', wait_until='networkidle')
            suggestions = page.get_by_role('group', name='Suggested time limits', exact=True)
            duration = page.get_by_role('spinbutton', name='Time limit (minutes)', exact=True)
            for label, minutes in [('30 min', '30'), ('60 min (1 hour)', '60'), ('120 min (2 hours)', '120')]:
                suggestion = suggestions.get_by_role('button', name=label, exact=True)
                suggestion.click()
                expect(duration).to_have_value(minutes)
                expect(suggestion).to_have_attribute('aria-pressed', 'true')
            duration.fill('45')
            expect(suggestions.locator('[aria-pressed="true"]')).to_have_count(0)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
            suggestions.screenshot(path=str(OUT / f'{role}-duration-presets-phone-dark.png'))
            context.close()
            checked(f'{role}: all three header actions have hover/focus feedback in both themes; phone presets select 30/60/120 minutes and allow custom 45 minutes')

        # Existing student can visit an empty/draft-only batch without freezing order.
        student_context, student = session(browser, 'student', width=390)
        student.goto(BASE + '/student/assessments', wait_until='networkidle')
        expect(student.get_by_text('No published assessments are assigned to your batch yet.', exact=False)).to_be_visible()
        expect(student.locator('article')).to_have_count(0)
        checked('Already-enrolled student sees no draft assessment cards')
        student_context.close()

        admin_context, admin = session(browser, 'admin', width=375, dark=True)
        admin.goto(BASE + '/admin/assessments', wait_until='networkidle')
        admin.get_by_role('button', name='Publish drafts together', exact=True).click()
        dialog = admin.get_by_role('dialog', name='Publish drafts together', exact=True)
        expect(dialog.get_by_role('checkbox')).to_have_count(6)
        assert admin.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
        admin.screenshot(path=str(OUT / 'admin-publication-phone-dark.png'), full_page=True)
        dialog.get_by_role('button', name='Cancel', exact=True).click()
        checked('Admin can review the full six-draft set on a phone and cancel without publishing')
        admin_context.close()

        owner_context, owner = session(browser, 'instructor')
        owner.goto(BASE + '/instructor/assessments', wait_until='networkidle')
        owner.get_by_role('button', name='Publish drafts together', exact=True).click()
        dialog = owner.get_by_role('dialog', name='Publish drafts together', exact=True)
        expect(dialog.get_by_role('checkbox')).to_have_count(6)
        dialog.get_by_role('checkbox').first.uncheck()
        dialog.get_by_role('button', name='Review publication', exact=True).click()
        review = owner.get_by_role('dialog', name='Review assessment publication', exact=True)
        expect(review.get_by_role('button', name='Publish 5 assessments', exact=True)).to_be_visible()
        review.get_by_role('button', name='Back', exact=True).click()
        dialog.get_by_role('button', name='Select all drafts', exact=True).click()
        dialog.get_by_role('button', name='Review publication', exact=True).click()
        expect(review).to_contain_text('configured opening time')
        owner.screenshot(path=str(OUT / 'instructor-release-review.png'), full_page=True)
        review.get_by_role('button', name='Publish 6 assessments', exact=True).click()
        expect(owner.get_by_role('dialog')).to_have_count(0)
        expect(owner.get_by_role('button', name='Publish drafts together', exact=True)).to_be_disabled()
        checked('Instructor reviews all six drafts across collection pagination and publishes them together')

        for key, width, dark in [('student', 390, False), ('second_student', 1440, True)]:
            context, page = session(browser, key, width=width, dark=dark)
            page.goto(BASE + '/student/assessments', wait_until='networkidle')
            if key == 'student':
                student_context, student = context, page
            expect(page.locator('article h2')).to_have_text([f'Assessment {i}' for i in range(1, 7)])
            expect(page.get_by_label('Skill categories', exact=True)).to_have_count(0)
            for topic in ('Programming', 'Networking', 'Technical Support', 'staff title'):
                expect(page.locator('main')).not_to_contain_text(topic)
            auth = {'Authorization': 'Bearer ' + AUTH['sessions'][key]['token']}
            first = context.request.get(API + '/api/assessments/', headers=auth).json()['assessments']
            page.reload(wait_until='networkidle')
            second = context.request.get(API + '/api/assessments/', headers=auth).json()['assessments']
            assert [(row['id'], row['title']) for row in first] == [(row['id'], row['title']) for row in second]
            assert {row['id'] for row in first} == set(AUTH['assessments'])
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
            page.screenshot(path=str(OUT / f'{key}-cards.png'), full_page=True)
            checked(f'{key}: six anonymous cards retain ID-to-number mapping across refresh')
            if key == 'second_student':
                context.close()

        student.locator('article').first.get_by_role('button', name='Start Assessment', exact=True).click()
        expect(student.get_by_text('Assessment 1 · 15 minutes', exact=True)).to_be_visible()
        student.get_by_role('checkbox').check()
        student.get_by_role('button', name='Agree & start', exact=True).click()
        question = student.get_by_role('heading', name='What is printed by this Python code?', exact=False)
        expect(question).to_be_visible()
        expect(student.get_by_role('button', name='5', exact=False)).to_be_visible()
        assert question.locator('span').evaluate('node => getComputedStyle(node).whiteSpace') == 'pre-wrap'
        student.get_by_role('button', name='5', exact=False).click()
        student.get_by_role('button', name='Review answers', exact=True).click()
        student.get_by_role('button', name='Submit', exact=True).click()
        student.get_by_role('button', name='Yes, submit', exact=True).click()
        summary = student.get_by_role('region', name='Assessment result summary', exact=True)
        expect(summary.get_by_role('heading', name='Assessment 1', exact=True)).to_be_visible()
        expect(summary.get_by_text('100%', exact=True)).to_be_visible()
        expect(student.get_by_role('heading', name='Category scores', exact=True)).to_be_visible()
        expect(student.get_by_role('button', name='View Final Results', exact=True)).to_have_count(0)
        student.screenshot(path=str(OUT / 'student-result-phone.png'), full_page=True)
        checked('Student completes a code question and sees the same assessment number, score and category results; final results stay gated')
        assert not errors, errors
        (OUT / 'results.json').write_text(json.dumps({'checks': checks, 'page_errors': errors}, indent=2), encoding='utf-8')
        student_context.close()
        owner_context.close()
    finally:
        browser.close()
