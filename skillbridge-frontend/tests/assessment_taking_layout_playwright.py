"""Responsive taking-screen checks with synthetic, intercepted API responses.

Set SKILLBRIDGE_TEST_BASE to a local frontend. No backend is contacted.
"""
import json
import os
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get('SKILLBRIDGE_TEST_BASE', 'http://127.0.0.1:5178')
OUT = Path(__file__).parent / 'artifacts/assessment-taking-layout'
OUT.mkdir(parents=True, exist_ok=True)
USER = {'id': 991, 'name': 'Preview Student', 'role': 'student', 'is_approved': True,
        'phone': '09000000000', 'course': 'BSIT', 'profile_completed': True, 'school_id': 'PREVIEW-001'}
CHOICES = [
    'Use a strong, unique password and enable multi-factor authentication for the account.',
    'Share the account password with colleagues so they can help you sign in when needed.',
    'Use the same password for all accounts so it is easier to remember.',
    'Turn off security notifications to avoid interruptions while working.',
]
QUESTIONS = [
    {'id': 1, 'question_text': 'Which action best protects an online account from unauthorized access?',
     'question_type': 'mcq', 'category': 'Cybersecurity',
     'choices': [{'id': i, 'text': text} for i, text in enumerate(CHOICES, 1)]},
    {'id': 2, 'question_text': 'Identify the network device.', 'question_type': 'identification',
     'category': 'Networking', 'choices': []},
    {'id': 3, 'question_text': 'A unique password improves account security.', 'question_type': 'truefalse',
     'category': 'Cybersecurity', 'choices': [{'id': 31, 'text': 'True'}, {'id': 32, 'text': 'False'}]},
]
checks, errors = [], []


def start(browser, width, dark=False, seconds=2880):
    now = datetime.now(timezone.utc)
    identity = now.isoformat()
    cutoff = (now + timedelta(seconds=seconds)).isoformat()
    record = {'id': 1, 'title': 'Assessment 1', 'duration_minutes': 60,
              'availability_status': 'available', 'attempt_status': None, 'started_at': None,
              'submitted_at': None, 'retake_allowed': False, 'include_in_competency': True,
              'is_required': True, 'question_count': len(QUESTIONS)}
    submitted = []
    context = browser.new_context(viewport={'width': width, 'height': 900},
        is_mobile=width < 1024, has_touch=width < 1024,
        color_scheme='dark' if dark else 'light', reduced_motion='reduce',
        user_agent='Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' if width < 1024 else None)
    context.add_init_script('for(const [k,v] of Object.entries(' + json.dumps({
        'sb-token': 'synthetic', 'sb-role': 'student', 'sb-user': json.dumps(USER),
        'sb-theme': 'dark' if dark else 'light', 'theme': 'dark' if dark else 'light',
    }) + ')) localStorage.setItem(k,v)')
    if width >= 1024:
        context.add_init_script('''Element.prototype.requestFullscreen = async function() {
            Object.defineProperty(document, 'fullscreenElement', {configurable:true, value:this});
        }; document.exitFullscreen = async () => {
            Object.defineProperty(document, 'fullscreenElement', {configurable:true, value:null});
        };''')

    def route(r):
        parsed = urlparse(r.request.url)
        path = parsed.path
        if not path.startswith('/api/'):
            return r.continue_() if parsed.hostname in ('localhost', '127.0.0.1') else r.abort()
        if path.endswith('/events/'):
            return r.fulfill(status=204)
        if path in ('/api/auth/me/', '/api/students/me/', '/api/students/me/profile/'):
            return r.fulfill(json=USER)
        if path == '/api/assessments/':
            return r.fulfill(json={'assessments': [record], 'batch': {'id': 1, 'name': 'Preview batch'}})
        if path.endswith('/start/'):
            record.update(attempt_status='in_progress', started_at=identity)
            return r.fulfill(json={'response_id': 1, 'attempt_started_at': identity, 'started_at': identity,
                'remaining_seconds': seconds, 'time_limit_sec': 3600, 'deadline_at': cutoff,
                'questions': QUESTIONS, 'draft_answers': [], 'interruption': {}})
        if path.endswith('/timing/'):
            return r.fulfill(json={'status': 'in_progress', 'remaining_seconds': seconds, 'deadline_at': cutoff})
        if path.endswith('/interruption/'):
            return r.fulfill(json={'review_required': False, 'remaining_seconds': seconds, 'deadline_at': cutoff})
        if path.endswith('/submit/'):
            submitted.append(r.request.post_data_json)
            record.update(attempt_status='submitted', submitted_at=identity)
            return r.fulfill(json={'status': 'submitted', 'attempt_status': 'submitted', 'assessment_id': 1})
        if path.endswith('/stop/'):
            errors.append('Unexpected integrity stop')
            return r.fulfill(status=409, json={'error': 'Unexpected integrity stop'})
        if path == '/api/student/results/combined/':
            return r.fulfill(json={'recommendations_locked': True, 'recommendations': [], 'combined_category_scores': []})
        if path == '/api/student/results/':
            return r.fulfill(json={'assessment': record, 'skill_scores': [], 'recommendations_locked': True})
        if path == '/api/student/results/review/':
            return r.fulfill(json={'questions': QUESTIONS, 'answers': {}})
        return r.fulfill(json=[])

    context.route('**/*', route)
    page = context.new_page()
    page.set_default_timeout(15000)
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(BASE + '/student/assessments/1/take', wait_until='networkidle')
    page.get_by_role('checkbox').check()
    page.get_by_role('button', name='Agree & start' if width < 1024 else 'Agree, enter fullscreen & start', exact=True).click()
    expect(page.get_by_role('timer', name='Time remaining', exact=True)).to_be_visible()
    warning = page.get_by_role('button', name='Got it, keep going', exact=True)
    if warning.is_visible():
        warning.click()
    page.evaluate("window.scrollTo(0,0)")
    return context, page, submitted, identity


def geometry(page):
    return page.evaluate('''() => {
        const rect = el => {const r=el.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}};
        const timer=document.querySelector('.sat-timer');
        const heading=document.querySelector('.sat-heading');
        const monitor=document.querySelector('.sat-monitor');
        const ctx=document.createElement('canvas').getContext('2d');
        ctx.fillStyle=getComputedStyle(monitor).color;
        ctx.fillRect(0,0,1,1);
        return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
            header:rect(document.querySelector('.sat-header')),heading:rect(heading),monitor:rect(monitor),
            timing:rect(timer.parentElement),timer:rect(timer),answered:rect(document.querySelector('.sat-answered')),
            cutoff:rect(document.querySelector('.sat-cutoff')),
            compact:getComputedStyle(document.querySelector('.sat-compact-monitor')).display,
            monitorRgb:[...ctx.getImageData(0,0,1,1).data],monitorBackground:getComputedStyle(monitor).backgroundColor,
            choices:[...document.querySelectorAll('.sat-choice')].map(el=>({
                card:rect(el),letter:rect(el.querySelector('.sat-choice-letter')),text:rect(el.querySelector('.sat-choice-text')),
                display:getComputedStyle(el).display,letterMargin:getComputedStyle(el.querySelector('.sat-choice-letter')).marginRight,
            }))};
    }''')


with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    try:
        layouts = []
        for width in (320, 375, 390, 600, 768, 820, 1023, 1024, 1180, 1280, 1440):
            for dark in (False, True):
                context, page, submitted, _ = start(browser, width, dark)
                try:
                    g = geometry(page)
                    assert g['width'] == width and g['scrollWidth'] <= width, g
                    assert g['heading']['x'] + g['heading']['w'] + 4 <= g['monitor']['x'], g
                    assert g['timer']['x'] + g['timer']['w'] + 4 <= g['answered']['x'], g
                    assert g['answered']['x'] + g['answered']['w'] <= width - 15, g
                    if width < 1024:
                        assert g['compact'] != 'none' and g['header']['h'] <= 56, g
                        assert abs(g['timer']['x'] + g['timer']['w']/2 - width/2) < 1, g
                        red, green, blue = g['monitorRgb'][:3]
                        assert red > max(green, blue) and g['monitorBackground'] != 'rgba(0, 0, 0, 0)', g
                        assert g['cutoff']['y'] + g['cutoff']['h'] <= 156, g
                        for option in g['choices']:
                            assert option['display'] == 'flex', option
                            assert abs((option['letter']['y'] + option['letter']['h']/2) - (option['card']['y'] + option['card']['h']/2)) < 1, option
                            assert abs((option['text']['y'] + option['text']['h']/2) - (option['letter']['y'] + option['letter']['h']/2)) < 1, option
                            assert option['text']['x'] >= option['letter']['x'] + option['letter']['w'] + 11, option
                        toggle = page.get_by_role('button', name=re.compile('Question navigator,'))
                        assert toggle.bounding_box()['height'] >= 44
                        page.evaluate('window.scrollTo(0, document.documentElement.scrollHeight)')
                        helper = page.get_by_text('Your answers are saved automatically', exact=True).bounding_box()
                        assert helper['y'] + helper['height'] + 12 < toggle.bounding_box()['y']
                    else:
                        assert g['compact'] == 'none' and g['header']['h'] == 56, g
                        assert all(option['display'] == 'block' and option['letterMargin'] == '12px' for option in g['choices']), g
                    expect(page.get_by_role('button', name='Next →', exact=True)).to_be_disabled()
                    page.evaluate('window.scrollTo(0,0)')
                    page.screenshot(path=str(OUT / f'question-{width}-{"dark" if dark else "light"}.png'), full_page=True, animations='disabled')
                    page.locator('.sat-choice').first.click()
                    expect(page.locator('.sat-answered')).to_have_text('1/3 answered')
                    expect(page.get_by_role('button', name='Next →', exact=True)).to_be_enabled()
                    page.locator('.sat-choice').first.focus()
                    if width < 1024:
                        page.keyboard.press('Tab')
                        expect(page.locator('.sat-choice').nth(1)).to_be_focused()
                        assert page.locator('.sat-choice').nth(1).evaluate('el => getComputedStyle(el).outlineStyle') != 'none'
                    assert not submitted
                    layouts.append({'width': width, 'theme': 'dark' if dark else 'light'})
                finally:
                    context.unroute_all(behavior='ignoreErrors')
                    context.close()
        checks.append({'layouts': layouts, 'checked': 'header containment, centered letters/text columns, safe navigator clearance, dark/light, desktop presentation and answer selection'})

        for seconds in (540, 240):
            context, page, submitted, _ = start(browser, 320, seconds=seconds)
            try:
                expect(page.locator('.sat-timer--warning')).to_be_visible()
                assert page.locator('.sat-timer').evaluate('el=>getComputedStyle(el).backgroundColor') != 'rgba(0, 0, 0, 0)'
                assert page.evaluate('innerWidth === 320 && document.documentElement.scrollWidth <= 320')
                page.screenshot(path=str(OUT / f'timer-{seconds}.png'), full_page=True, animations='disabled')
                assert not submitted
            finally:
                context.unroute_all(behavior='ignoreErrors')
                context.close()
        checks.append('Amber/red timer warnings remain visible without narrow-screen overflow')

        for width in (390, 820, 1440):
            context, page, submitted, identity = start(browser, width)
            try:
                page.locator('.sat-choice').first.click()
                page.get_by_role('button', name='Next →', exact=True).click()
                identification = page.get_by_placeholder('Your answer…')
                expect(identification).to_be_visible()
                expect(page.get_by_role('button', name='Next →', exact=True)).to_be_disabled()
                identification.fill('   ')
                expect(page.get_by_role('button', name='Next →', exact=True)).to_be_disabled()
                identification.fill('Router')
                expect(page.get_by_role('button', name='Next →', exact=True)).to_be_enabled()
                identification.fill('')
                expect(page.get_by_role('button', name='Next →', exact=True)).to_be_disabled()
                if width < 1024:
                    page.get_by_role('button', name=re.compile('Question navigator,')).click()
                page.get_by_role('button', name='3', exact=True).click()
                page.locator('.sat-choice').first.click()
                page.get_by_role('button', name='Review answers', exact=True).click()
                expect(page.get_by_text('1 unanswered — tap Edit to go back.', exact=True)).to_be_visible()
                expect(page.get_by_text('Not answered', exact=True)).to_be_visible()
                page.get_by_role('button', name='Submit', exact=True).click()
                expect(page.get_by_text('2 of 3', exact=True)).to_be_visible()
                page.get_by_role('button', name='Yes, submit', exact=True).click()
                expect(page).to_have_url(re.compile('/student/assessments/1/results$'))
                assert len(submitted) == 1 and submitted[0]['attempt_started_at'] == identity
                answers = {answer['question_id']: answer for answer in submitted[0]['answers']}
                assert not answers.get(2, {}).get('text_answer', '').strip(), answers
                assert answers[1]['selected_choice_id'] == 1 and answers[3]['selected_choice_id'] == 31
            finally:
                context.unroute_all(behavior='ignoreErrors')
                context.close()
        checks.append('Phone/tablet/desktop retain blank identification navigation guards, skipped-question review and confirmed partial submission with exact attempt identity')
    finally:
        browser.close()

assert not errors, errors
(OUT / 'results.json').write_text(json.dumps({'checks': checks, 'page_errors': errors}, indent=2), encoding='utf-8')
print(json.dumps({'checks': checks, 'page_errors': errors}, indent=2))
