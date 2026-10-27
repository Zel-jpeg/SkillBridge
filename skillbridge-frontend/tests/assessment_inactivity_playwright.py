"""Synthetic clock-controlled inactivity checks; no live API or real student data."""
import json
import os
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('SKILLBRIDGE_TEST_BASE', 'http://127.0.0.1:5178')
OUT = Path(__file__).parent / 'artifacts/assessment-inactivity'
OUT.mkdir(parents=True, exist_ok=True)
checks, errors = [], []


def remaining(page):
    minutes, seconds = map(int, re.search(r'(\d+):(\d{2})', page.get_by_role('timer', name='Time remaining').inner_text()).groups())
    return minutes * 60 + seconds


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel='chrome', headless=True)
    try:
        for width, mobile in [(1280, False), (375, True)]:
            now = datetime.now(timezone.utc)
            user = {'id': 991, 'name': 'Synthetic Reading Student', 'role': 'student', 'is_approved': True,
                    'phone': '09000000000', 'course': 'BSIT', 'profile_completed': True, 'school_id': 'SYN-001'}
            record = {'id': 1, 'title': 'Synthetic Reading Assessment', 'duration_minutes': 120,
                      'availability_status': 'available', 'attempt_status': None, 'retake_allowed': False,
                      'include_in_competency': True, 'is_required': True, 'question_count': 1}
            question = {'id': 1, 'question_text': 'Take your time reading this synthetic question.', 'question_type': 'mcq',
                        'category': 'Programming', 'choices': [{'id': 1, 'text': 'Keep this answer'}, {'id': 2, 'text': 'Another answer'}]}
            state = {'started': None, 'identity': now.isoformat(), 'deadline': None, 'events': [], 'draft': []}
            writes = []
            context = browser.new_context(viewport={'width': width, 'height': 900}, is_mobile=mobile, has_touch=mobile,
                user_agent='Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' if mobile else None)
            context.add_init_script('for (const [k,v] of Object.entries(' + json.dumps({
                'sb-token': 'synthetic', 'sb-role': 'student', 'sb-user': json.dumps(user)}) + ')) localStorage.setItem(k,v)')
            if not mobile:
                context.add_init_script('''Element.prototype.requestFullscreen = async function() {
                    Object.defineProperty(document, 'fullscreenElement', {configurable:true, value:this});
                }; document.exitFullscreen = async () => {
                    Object.defineProperty(document, 'fullscreenElement', {configurable:true, value:null});
                };''')
            page = context.new_page()
            page.set_default_timeout(15000)
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.clock.install(time=now)

            def route_handler(route):
                path = urlparse(route.request.url).path
                if not path.startswith('/api/'):
                    return route.continue_() if urlparse(route.request.url).hostname in ('localhost', '127.0.0.1') else route.abort()
                if path.endswith('/events/'): return route.fulfill(status=204)
                if path in ('/api/auth/me/', '/api/students/me/', '/api/students/me/profile/'): return route.fulfill(json=user)
                if path == '/api/assessments/': return route.fulfill(json={'assessments': [record], 'batch': {'id': 1, 'name': 'Synthetic batch'}})
                if path == '/api/student/results/combined/': return route.fulfill(json={'recommendations_locked': True, 'recommendations': [], 'combined_category_scores': []})
                if path.endswith('/start/'):
                    state['started'] = page.evaluate('performance.now()')
                    state['identity'] = page.evaluate('new Date().toISOString()')
                    state['deadline'] = (datetime.fromtimestamp(page.evaluate('Date.now()') / 1000, timezone.utc) + timedelta(hours=2)).isoformat()
                    record.update(attempt_status='in_progress', started_at=state['identity'])
                    return route.fulfill(json={'response_id': 1, 'attempt_started_at': state['identity'], 'started_at': state['identity'],
                        'remaining_seconds': 7200, 'time_limit_sec': 7200, 'deadline_at': state['deadline'], 'questions': [question], 'draft_answers': [], 'interruption': {}})
                time_left = max(0, 7200 - int((page.evaluate('performance.now()') - state['started']) / 1000)) if state['started'] is not None else 7200
                if path.endswith('/timing/'): return route.fulfill(json={'status': 'in_progress', 'remaining_seconds': time_left, 'deadline_at': state['deadline']})
                if path.endswith('/interruption/'):
                    data = route.request.post_data_json
                    writes.append(data)
                    state['draft'] = data.get('answers', state['draft'])
                    if data['action'] == 'begin' and not any(event['id'] == data['event_id'] for event in state['events']):
                        state['events'].append({'id': data['event_id'], 'reasons': [data['reason']]})
                    return route.fulfill(json={'review_required': False, 'remaining_seconds': time_left, 'deadline_at': state['deadline']})
                if path.endswith('/submit/') or path.endswith('/stop/'):
                    errors.append('Unexpected finalization during inactivity checks: ' + path)
                    return route.fulfill(status=409, json={'error': 'Unexpected finalization'})
                return route.fulfill(json=[])

            context.route('**/*', route_handler)
            page.goto(BASE + '/student/assessments/1/take', wait_until='networkidle')
            page.clock.pause_at(now + timedelta(minutes=1))
            page.clock.fast_forward(300_001)
            expect(page.get_by_role('heading', name='Are you still there?')).to_have_count(0)
            page.get_by_role('checkbox').check()
            page.get_by_role('button', name='Agree & start' if mobile else 'Agree, enter fullscreen & start', exact=True).click()
            page.clock.run_for(32)
            choice = page.get_by_role('button', name=re.compile('Keep this answer'))
            choice.click(); choice.focus()
            answers_before = page.evaluate("localStorage.getItem('sb_answers_991_1')")
            timer_before = remaining(page)
            page.clock.fast_forward(299_000)
            expect(page.get_by_role('heading', name='Are you still there?')).to_have_count(0)
            page.clock.fast_forward(1_001)
            reminder = page.locator('[data-assessment-inactivity-reminder]')
            expect(reminder).to_be_visible()
            expect(choice).to_be_focused()
            assert remaining(page) < timer_before - 295, 'Reading reminder must not pause or reset time'
            page.clock.fast_forward(600_000)
            expect(reminder).to_have_count(1)
            assert page.evaluate("localStorage.getItem('sb_answers_991_1')") == answers_before
            assert not state['events'], 'Reading must not create interruption records'
            assert all(write['action'] == 'draft' for write in writes)
            assert state['draft'][0]['selected_choice_id'] == 1
            if not mobile: assert page.evaluate('document.fullscreenElement === document.documentElement')
            if mobile:
                floating_nav = page.locator('button.fixed')
                assert reminder.bounding_box()['y'] + reminder.bounding_box()['height'] < floating_nav.bounding_box()['y'], 'Reminder must clear the mobile navigator'
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            page.screenshot(path=str(OUT / f'reminder-{width}.png'), animations='disabled')
            page.get_by_role('button', name='Continue assessment', exact=True).click()
            expect(reminder).to_have_count(0)
            if mobile:
                page.locator('button.fixed').click()
                expect(page.get_by_text('Question Navigator', exact=True)).to_be_visible()
                page.clock.fast_forward(300_001)
                expect(reminder).to_have_count(0)
                page.get_by_role('button', name='1', exact=True).click()

            activity = {
                'mouse': lambda: page.mouse.move(3, 3),
                'keyboard': lambda: page.keyboard.press('Shift'),
                'touch': lambda: page.dispatch_event('body', 'touchstart'),
                'scroll': lambda: page.evaluate("window.dispatchEvent(new Event('scroll'))"),
                'input': lambda: page.dispatch_event('body', 'input'),
            }
            for name, act in activity.items():
                page.clock.fast_forward(299_000)
                act()
                page.clock.fast_forward(2_000)
                expect(reminder).to_have_count(0)
                page.clock.fast_forward(298_001)
                expect(reminder).to_be_visible()
                # Activity outside the panel also acknowledges an existing reminder.
                page.dispatch_event('body', 'pointerdown', {'pointerType': 'touch' if mobile else 'mouse'})
                expect(reminder).to_have_count(0)
            assert not state['events']
            assert page.evaluate("localStorage.getItem('sb_answers_991_1')") == answers_before

            # Interruption recovery takes priority and starts a fresh reading period.
            page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}); document.dispatchEvent(new Event('visibilitychange'))")
            expect(page.get_by_role('heading', name='Assessment interrupted')).to_be_visible()
            expect(reminder).to_have_count(0)
            page.clock.fast_forward(1_000)
            page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>false})")
            page.get_by_role('button', name='Resume assessment', exact=True).click()
            expect(choice).to_be_visible()
            page.clock.fast_forward(299_000)
            expect(reminder).to_have_count(0)
            page.clock.fast_forward(1_001)
            expect(reminder).to_be_visible()
            page.keyboard.press('Shift')
            expect(reminder).to_have_count(0)
            # Leaving the attempt unmounts listeners and its scheduled reminder.
            page.evaluate("history.pushState({}, '', '/student/assessments'); window.dispatchEvent(new PopStateEvent('popstate'))")
            page.clock.resume()
            expect(page.get_by_role('heading', name='Skills Assessments')).to_be_visible()
            page.clock.pause_at(datetime.fromtimestamp(page.evaluate('Date.now()') / 1000, timezone.utc) + timedelta(seconds=1))
            page.clock.fast_forward(600_001)
            expect(reminder).to_have_count(0)
            checks.append(f'{width}px: five-minute threshold, one reminder per idle period, Continue and mouse/keyboard/touch/scroll/input reset, focus/fullscreen/timer/answers preserved, recovery priority and unmount cleanup')
            context.unroute_all(behavior='ignoreErrors'); context.close()
    finally:
        browser.close()

assert not errors, errors
(OUT / 'results.json').write_text(json.dumps({'checks': checks, 'page_errors': errors}, indent=2), encoding='utf-8')
print(json.dumps({'checks': checks, 'page_errors': errors}, indent=2))
