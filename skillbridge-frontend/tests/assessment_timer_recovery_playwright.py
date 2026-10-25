"""Synthetic browser regression for cutoff auto-submit and a last-second extension."""
import json
import os
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('SKILLBRIDGE_TEST_BASE', 'http://127.0.0.1:5178')
OUT = Path(__file__).parent / 'artifacts/assessment-timer-recovery'
OUT.mkdir(parents=True, exist_ok=True)
checks, errors = [], []
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    try:
        for mode in ['auto_submit', 'missed_extension']:
            now = datetime.now(timezone.utc)
            identity = now.isoformat()
            cutoff = (now + timedelta(seconds=4)).isoformat()
            user = {'id': 991, 'name': 'Synthetic Timer Student', 'role': 'student', 'is_approved': True, 'phone': '09000000000', 'course': 'BSIT'}
            record = {'id': 1, 'title': 'Synthetic deadline assessment', 'duration_minutes': 60, 'due_at': cutoff,
                      'availability_status': 'available', 'attempt_status': None, 'started_at': None,
                      'submitted_at': None, 'retake_allowed': False, 'include_in_competency': True}
            question = {'id': 1, 'question_text': 'Keep this answer', 'question_type': 'mcq', 'category': 'Programming',
                        'choices': [{'id': 1, 'text': 'Synthetic timer answer'}]}
            writes, timing_requests = [], []
            context = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True,
                user_agent='Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36')
            context.add_init_script('for(const [k,v] of Object.entries(' + json.dumps({'sb-token': 'synthetic', 'sb-role': 'student', 'sb-user': json.dumps(user)}) + ')) localStorage.setItem(k,v)')
            def route(route):
                path = urlparse(route.request.url).path
                if not path.startswith('/api/'):
                    return route.continue_() if urlparse(route.request.url).hostname in ('localhost', '127.0.0.1') else route.abort()
                if path.endswith('/events/'): return route.fulfill(status=204)
                if path in ('/api/auth/me/', '/api/students/me/', '/api/students/me/profile/'):
                    return route.fulfill(json=user)
                if path == '/api/student/results/combined/':
                    return route.fulfill(json={'recommendations_locked': True, 'recommendations': [], 'combined_category_scores': []})
                if path == '/api/assessments/': return route.fulfill(json={'assessments': [record], 'batch': {'id': 1, 'name': 'Synthetic batch'}})
                if path.endswith('/start/'):
                    record.update(attempt_status='in_progress', started_at=identity)
                    return route.fulfill(json={'response_id': 1, 'started_at': identity, 'attempt_started_at': identity,
                        'time_limit_sec': 3600, 'remaining_seconds': 4, 'deadline_at': cutoff, 'questions': [question]})
                if path.endswith('/timing/'):
                    # Simulate the read missing a grant that has not yet committed.
                    timing_requests.append(route)
                    return
                if path.endswith('/submit/'):
                    payload = route.request.post_data_json
                    writes.append(payload)
                    if mode == 'missed_extension' and len(writes) == 1:
                        return route.fulfill(status=409, json={'error': 'This attempt still has time remaining.',
                            'code': 'attempt_time_remaining', 'status': 'in_progress', 'attempt_started_at': identity,
                            'remaining_seconds': 120, 'deadline_at': (now + timedelta(minutes=2)).isoformat()})
                    record.update(attempt_status='submitted', submitted_at=identity)
                    return route.fulfill(json={'status': 'submitted', 'attempt_status': 'submitted', 'assessment_id': 1})
                if path == '/api/student/results/': return route.fulfill(json={'assessment': record, 'skill_scores': [], 'recommendations_locked': True})
                if path == '/api/student/results/review/': return route.fulfill(json={'questions': [question], 'answers': {}})
                return route.fulfill(json=[])
            context.route('**/*', route)
            page = context.new_page()
            page.set_default_timeout(15000)
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(BASE + '/student/assessments/1/take')
            page.wait_for_load_state('networkidle')
            page.get_by_role('checkbox').check()
            page.get_by_role('button', name='Agree & start', exact=True).click()
            page.get_by_role('button', name='Got it, keep going', exact=True).click()
            page.get_by_role('button', name=re.compile('Synthetic timer answer')).click()
            # Answering must stop at zero even while the final timing read waits
            # for a response. This allowance is for transport, not more edits.
            expect(page.get_by_role('button', name=re.compile('Synthetic timer answer'))).to_be_disabled()
            assert len(timing_requests) == 1
            timing_requests[0].fulfill(json={'status': 'in_progress', 'attempt_started_at': identity,
                                           'remaining_seconds': 0, 'deadline_at': cutoff})
            if mode == 'missed_extension':
                expect(page.get_by_role('timer', name='Time remaining', exact=True)).to_contain_text(re.compile('0[12]:[0-5][0-9]'))
                assert len(writes) == 1 and writes[0]['auto_submit'] is True
                assert page.evaluate("localStorage.getItem('sb_answers_991_1')")
                expect(page.get_by_role('button', name=re.compile('Synthetic timer answer'))).to_be_enabled()
                expect(page.get_by_role('button', name='Review answers', exact=True)).to_be_visible()
                page.screenshot(path=str(OUT / 'extension-recovered.png'), full_page=True)
                page.get_by_role('button', name='Review answers', exact=True).click()
                page.get_by_role('button', name='Submit', exact=True).click()
                page.get_by_role('button', name='Yes, submit', exact=True).click()
            expect(page).to_have_url(re.compile('/student/assessments/1/results'))
            assert writes[0]['auto_submit'] is True
            assert writes[0]['answers'][0]['selected_choice_id'] == 1
            if mode == 'missed_extension': assert len(writes) == 2 and writes[1]['auto_submit'] is False
            checks.append(mode + ': cutoff submission preserves answers and attempt identity; extension recovery never finalizes early')
            context.unroute_all(behavior='ignoreErrors'); context.close()
    finally:
        browser.close()
assert not errors, errors
(OUT / 'checks.json').write_text(json.dumps({'checks': checks, 'page_errors': errors}, indent=2), encoding='utf-8')
print(json.dumps({'checks': checks, 'page_errors': errors}, indent=2))
