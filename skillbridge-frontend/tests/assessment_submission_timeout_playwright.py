"""Synthetic API responses: slow saves, lost acknowledgements and integrity stops.

Run against Vite on 5178. No database or external service is accessed.
"""
import json
import re
import time
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect, Error

ARTIFACTS = Path(__file__).parent / 'artifacts/assessment-submission-timeout'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
IDENTITY = '2026-10-20T03:00:00.000001+00:00'
USER = {'id': 991, 'name': 'Synthetic Student', 'role': 'student',
        'is_approved': True, 'phone': '09000000000', 'course': 'BSIT'}
QUESTION = {'id': 1, 'question_text': 'Choose the synthetic answer.', 'question_type': 'mcq',
            'category': 'Programming', 'choices': [{'id': 1, 'text': 'Synthetic answer'}]}
checks, errors = [], []

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    try:
        for mode in ['slow', 'timeout_saved', 'stop_conflict', 'unsaved', 'stale_marker', 'other_attempt']:
            context = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True,
                user_agent='Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36')
            values = {'sb-token': 'synthetic', 'sb-role': 'student', 'sb-user': json.dumps(USER)}
            record = {'id': 1, 'title': 'Synthetic timeout assessment', 'duration_minutes': 10,
                      'availability_status': 'available', 'attempt_status': None, 'started_at': None,
                      'submitted_at': None, 'retake_allowed': False, 'include_in_competency': True}
            writes, dialogs = [], []
            if mode == 'stale_marker':
                record.update(attempt_status='submitted', started_at=IDENTITY, submitted_at=IDENTITY)
                values['sb_integrity_active_991_1'] = json.dumps({'response_id': 1, 'attempt_started_at': IDENTITY})
            context.add_init_script('for (const [k,v] of Object.entries(' + json.dumps(values) + ')) localStorage.setItem(k,v)')
            # Observe Axios's real request timeout. Speed up only the deliberate
            # timeout case after recording the configured production value.
            context.add_init_script(r'''
                window.submissionTimeouts = [];
                const open = XMLHttpRequest.prototype.open, send = XMLHttpRequest.prototype.send;
                XMLHttpRequest.prototype.open = function(method, url, ...rest) {
                    this.submission = /\/submit\/$/.test(url);
                    return open.call(this, method, url, ...rest);
                };
                XMLHttpRequest.prototype.send = function(body) {
                    if (this.submission) {
                        window.submissionTimeouts.push(this.timeout);
                        if (''' + json.dumps(mode == 'timeout_saved') + ''') this.timeout = 100;
                    }
                    return send.call(this, body);
                };
            ''')

            def route_request(route):
                parsed, method = urlparse(route.request.url), route.request.method
                if parsed.hostname not in ['localhost', '127.0.0.1']:
                    return route.abort()
                path = parsed.path
                if not path.startswith('/api/'):
                    return route.continue_()
                if path.endswith('/events/'):
                    return route.fulfill(status=204)
                if method == 'OPTIONS':
                    return route.fulfill(status=200)
                if path == '/api/assessments/':
                    return route.fulfill(json={'assessments': [record]})
                if path == '/api/students/me/':
                    return route.fulfill(json=USER)
                if path == '/api/assessments/1/start/':
                    writes.append('start')
                    record.update(attempt_status='in_progress', started_at=IDENTITY.replace('+00:00', 'Z'))
                    return route.fulfill(json={'response_id': 1, 'attempt_started_at': IDENTITY,
                        'started_at': IDENTITY, 'remaining_seconds': 600, 'time_limit_sec': 600,
                        'questions': [QUESTION]})
                if path == '/api/assessments/1/submit/':
                    writes.append('submit')
                    assert route.request.post_data_json['attempt_started_at'] == IDENTITY
                    if mode == 'unsaved':
                        return route.abort()
                    record.update(attempt_status='submitted', submitted_at=IDENTITY)
                    if mode == 'other_attempt':
                        record['started_at'] = '2026-10-20T03:00:00.000002+00:00'
                        return route.abort()
                    if mode in ['slow', 'timeout_saved']:
                        time.sleep(31 if mode == 'slow' else .4)
                    try:
                        return route.fulfill(json={'attempt_status': 'submitted', 'review_required': False})
                    except Error:
                        assert mode == 'timeout_saved'
                        return
                if path == '/api/assessments/1/stop/':
                    writes.append('stop')
                    # Simulate a submitted attempt whose acknowledgement was lost
                    # before the user's subsequent focus-loss signal arrived.
                    record.update(attempt_status='submitted', submitted_at=IDENTITY)
                    return route.fulfill(status=409, json={'error': 'Assessment attempt is already finalized.'})
                if path == '/api/student/results/':
                    return route.fulfill(json={'assessment': record, 'skill_scores': [],
                        'recommendations_locked': True, 'completed_required_count': 1,
                        'total_required_count': 1, 'remaining_required_count': 0})
                if path == '/api/student/results/review/':
                    return route.fulfill(json={'questions': [QUESTION], 'answers': {}})
                return route.fulfill(json=[])

            context.route('**/*', route_request)
            page = context.new_page()
            page.set_default_timeout(45000)
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('dialog', lambda dialog: (dialogs.append(dialog.message), dialog.accept()))
            page.goto('http://127.0.0.1:5178/student/assessments/1/take')
            page.wait_for_load_state('networkidle')
            if mode == 'stale_marker':
                expect(page.get_by_text('Already submitted', exact=True)).to_be_visible()
                assert not writes
                assert page.evaluate("localStorage.getItem('sb_integrity_active_991_1')") is None
                checks.append('Already submitted attempts clear stale markers without posting a stop')
            else:
                page.get_by_role('checkbox').check()
                page.get_by_role('button', name='Agree & start', exact=True).click()
                page.get_by_role('button', name=re.compile('Synthetic answer')).click()
                if mode == 'stop_conflict':
                    page.evaluate("Object.defineProperty(document, 'hidden', {get: () => true}); document.dispatchEvent(new Event('visibilitychange'))")
                else:
                    page.get_by_role('button', name='Review answers', exact=True).click()
                    page.get_by_role('button', name='Submit', exact=True).click()
                    page.get_by_role('button', name='Yes, submit', exact=True).click()
                if mode in ['unsaved', 'other_attempt']:
                    expect(page.get_by_role('button', name='Submit', exact=True)).to_be_visible()
                    expect(page.get_by_text(re.compile('Your answers are kept on this device'))).to_be_visible()
                    assert page.evaluate("localStorage.getItem('sb_answers_991_1')")
                    assert page.evaluate("localStorage.getItem('sb_integrity_active_991_1')")
                    assert writes == ['start', 'submit']
                    checks.append(mode + ': retains answers and does not claim another attempt was saved')
                else:
                    expect(page).to_have_url(re.compile('/results$'))
                    expect(page.get_by_role('heading', name='Synthetic timeout assessment')).to_be_visible()
                    assert not dialogs
                    assert page.evaluate("localStorage.getItem('sb_integrity_active_991_1')") is None
                    page.evaluate("window.dispatchEvent(new Event('blur')); document.dispatchEvent(new Event('visibilitychange'))")
                    page.wait_for_timeout(100)
                    assert writes == ['start', 'stop' if mode == 'stop_conflict' else 'submit']
                    checks.append(mode + ': opens saved results without repeated submission or false integrity stop')
                if mode != 'stop_conflict':
                    assert page.evaluate('window.submissionTimeouts') == [120000]
            print('PASS: ' + checks[-1], flush=True)
            context.close()
        assert not errors, errors
    finally:
        (ARTIFACTS / 'results.json').write_text(json.dumps({'checks': checks, 'page_errors': errors,
            'scope': 'Chrome headless, synthetic API; no real database or OS Alt+Tab'}, indent=2), encoding='utf-8')
        browser.close()
