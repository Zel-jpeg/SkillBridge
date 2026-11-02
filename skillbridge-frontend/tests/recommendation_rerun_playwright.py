"""Rerun feedback with intercepted synthetic API only; never touches a database."""
import json
import os
import time
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get('SKILLBRIDGE_TEST_BASE', 'http://127.0.0.1:5379')
ARTIFACTS = Path(__file__).resolve().parents[2] / 'work/recommendation_rerun_20261103'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
USER = {'id': 1, 'name': 'Synthetic Admin', 'role': 'admin', 'is_approved': True}


def analytics():
    return {'role': 'admin', 'generated_at': '2026-11-03T00:00:00Z',
            'scope': {'batch_status': 'active', 'batch_ids': [], 'course': '',
                'date_from': '2026-10-27', 'date_to': '2026-11-03',
                'activity_period': 'week', 'activity_interval': 'day'},
            'summary': {key: 0 for key in ['students', 'required_complete', 'completion_rate',
                'approved', 'unplaced', 'approved_other_batch', 'awaiting_review', 'needs_followup', 'slots_remaining']},
            'options': {key: [] for key in ['batches', 'instructors', 'courses', 'assessments', 'companies', 'positions', 'areas']},
            **{key: [] for key in ['students', 'placement_students', 'assessments', 'batches', 'skills',
                'capacity', 'match_bands', 'companies', 'areas', 'geography', 'activity', 'activity_days']}}


class Fixture:
    def __init__(self, browser, mode):
        self.mode, self.posts, self.reads, self.pending = mode, [], [], None
        self.errors = []
        self.console_errors = []
        self.context = browser.new_context(viewport={'width': 1440, 'height': 1000})
        self.context.add_init_script('for (const [k,v] of Object.entries(' + json.dumps({
            'sb-token': 'synthetic-intercepted-session', 'sb-role': 'admin',
            'sb-user': json.dumps(USER), 'sb-session-id': 'synthetic-rerun-check',
        }) + ')) localStorage.setItem(k,v)')
        self.context.route('**/*', self.route)
        self.page = self.context.new_page()
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.on('console', lambda message: self.console_errors.append(message.text) if message.type == 'error' else None)

    def route(self, route):
        request = route.request
        parsed = urlparse(request.url)
        if not parsed.path.startswith('/api/'):
            return route.continue_() if parsed.hostname in ['localhost', '127.0.0.1'] else route.abort()
        if request.method == 'OPTIONS':
            return route.fulfill(status=204, headers={'Access-Control-Allow-Origin': BASE,
                'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*'})
        if request.method == 'POST':
            self.posts.append(parsed.path)
            assert parsed.path == '/api/admin/rerun-recommendations/', 'Unexpected mutation in intercepted fixture'
            if self.mode == 'delayed':
                self.pending = route
                return
            if self.mode == 'network':
                return route.abort('connectionreset')
            if self.mode == 'timeout':
                return route.abort('timedout')
            if self.mode == 'forbidden':
                return route.fulfill(status=403, json={'error': 'You do not have permission to do that.'})
            if self.mode == 'server':
                return route.fulfill(status=500, json={'error': 'Synthetic private diagnostic'})
            return route.fulfill(json={'ok': True, 'students_processed': 2,
                'errors': 1 if self.mode == 'partial' else 0})
        self.reads.append(parsed.path)
        if parsed.path.endswith('/events/'):
            return route.fulfill(status=204)
        if parsed.path == '/api/auth/me/':
            return route.fulfill(json=USER)
        if parsed.path == '/api/management/analytics/':
            return route.fulfill(json=analytics())
        if parsed.path == '/api/admin/nlp-configuration/':
            return route.fulfill(json={'active_model': 'spacy_md', 'active_model_label': 'spaCy Medium',
                'models': [{'id': 'spacy_md', 'label': 'spaCy Medium', 'available': True}]})
        if parsed.path == '/api/admin/users/':
            return route.fulfill(json={'students': [], 'instructors': [], 'pending_instructors': []})
        return route.fulfill(json=[])

    def open(self, settings=False):
        self.page.goto(BASE + ('/admin/reports' if settings else '/admin/dashboard'))
        self.page.wait_for_load_state('networkidle')
        if settings:
            (ARTIFACTS / 'settings-discovery.txt').write_text(json.dumps({'errors': self.errors, 'console_errors': self.console_errors,
                'body': self.page.locator('body').inner_text()}, indent=2), encoding='utf-8')
            self.page.get_by_role('button', name='Advanced: recommendation model and evaluation').click()
        button = self.page.get_by_role('button', name='Re-run Recommendations', exact=True)
        expect(button).to_be_visible()
        return button

    def close(self):
        assert not self.errors, self.errors
        assert self.posts == ['/api/admin/rerun-recommendations/'], self.posts
        self.context.close()


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel='chrome', headless=True)
    checks = []
    try:
        settings_only = os.environ.get('RERUN_SETTINGS_ONLY') == '1'
        if not settings_only:
            fixture = Fixture(browser, 'delayed')
            button = fixture.open()
            button.click()
            expect(fixture.page.get_by_role('button', name='Running…', exact=True)).to_be_disabled()
            start = time.monotonic()
            fixture.page.wait_for_timeout(31500)  # Deliberately exceed the old 30-second browser limit.
            assert fixture.posts == ['/api/admin/rerun-recommendations/']
            expect(fixture.page.get_by_text('Could not refresh recommendations. Please try again.', exact=True)).to_have_count(0)
            fixture.pending.fulfill(json={'ok': True, 'students_processed': 2, 'errors': 0})
            expect(fixture.page.get_by_text('Recommendations refreshed for 2 students.', exact=True).first).to_be_visible()
            expect(fixture.page.get_by_role('button', name='Re-run Recommendations', exact=True)).to_be_enabled()
            checks.append({'case': 'dashboard_success_after_old_timeout', 'delay_seconds': round(time.monotonic() - start, 1)})
            fixture.close()

        for settings, mode in [(False, 'network'), (False, 'timeout'), (False, 'server'), (False, 'forbidden'),
                               (False, 'partial'), (True, 'network'), (True, 'success')]:
            if settings_only and not settings:
                continue
            fixture = Fixture(browser, mode)
            button = fixture.open(settings)
            initial_reads = fixture.reads.count('/api/management/analytics/')
            button.click()
            if mode in ('network', 'timeout', 'server'):
                text = ('The rerun is taking longer than two minutes. The server may still be working. Check the refreshed results before trying again.' if mode == 'timeout' else
                    'Could not confirm that the rerun completed. Some results may still update. Check the refreshed results before trying again.')
                expect(fixture.page.get_by_text(text, exact=True).first).to_be_visible()
                expect(fixture.page.get_by_role('status').filter(has_text='Warning:').first).to_be_visible()
                assert 'Synthetic private diagnostic' not in fixture.page.locator('body').inner_text()
                fixture.page.wait_for_timeout(4200)
                expect(fixture.page.get_by_text(text, exact=True).first).to_be_visible()
                assert fixture.reads.count('/api/management/analytics/') > initial_reads
            elif mode == 'forbidden':
                expect(fixture.page.get_by_text('You do not have permission to do that.', exact=True).first).to_be_visible()
                expect(fixture.page.get_by_role('alert').filter(has_text='Error:').first).to_be_visible()
            elif mode == 'partial':
                expect(fixture.page.get_by_text('Recommendations refreshed for 2 students; 1 processing error was reported. Review the results before rerunning.', exact=True).first).to_be_visible()
                expect(fixture.page.get_by_role('status').filter(has_text='Warning:').first).to_be_visible()
            else:
                expect(fixture.page.get_by_text('Recommendations refreshed for 2 students.', exact=True).first).to_be_visible()
            fixture.page.screenshot(path=str(ARTIFACTS / f'{"settings" if settings else "dashboard"}-{mode}.png'))
            checks.append({'case': f'{"settings" if settings else "dashboard"}_{mode}', 'passed': True})
            fixture.close()
    finally:
        browser.close()
    (ARTIFACTS / 'browser-receipt.json').write_text(json.dumps({'checks': checks,
        'synthetic_intercepted_api_only': True, 'database_access': False}, indent=2), encoding='utf-8')
    print(json.dumps({'browser_checks_passed': len(checks), 'no_real_reruns': True}), flush=True)
