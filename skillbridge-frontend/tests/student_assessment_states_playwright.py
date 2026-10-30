"""Student card state presentation/order with synthetic API responses only."""
import json
import os
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get('SKILLBRIDGE_TEST_BASE', 'http://127.0.0.1:5192')
OUT = Path(__file__).parent / 'artifacts/student-assessment-states'
OUT.mkdir(parents=True, exist_ok=True)
USER = dict(id=1, role='student', name='Synthetic Student', is_approved=True,
    profile_completed=True, course='BSIT', school_id='SYN-001',
    batch={'id': 1, 'name': 'Batch 2026-2027'}, has_previous_batches=False)
SUBMITTED = '2026-10-30T01:00:00Z'


def item(number, **changes):
    return dict(id=number * 10, title=f'Assessment {number}', is_required=True,
        include_in_competency=True, duration_minutes=60, question_count=10,
        availability_status='available', action='start', attempt_status=None,
        available_at='2026-10-30T01:00:00Z', due_at='2026-11-06T01:00:00Z',
        submitted_at=None, retake_allowed=False, is_flagged=False,
        can_request_retake=False, retake_request={}, **changes)


def record(number, **changes):
    base = item(number)
    base.update(changes)
    return base


records = [
    record(1, action='view_result', attempt_status='submitted', submitted_at=SUBMITTED),
    record(2, action='continue', attempt_status='in_progress'),
    record(3),
    record(4, action='retake_allowed', attempt_status='stopped', submitted_at=SUBMITTED,
        retake_allowed=True, retake_request={'status': 'approved'}),
    record(5, action='awaiting_retake', attempt_status='stopped', submitted_at=SUBMITTED,
        is_flagged=True, can_request_retake=True),
    record(6, action='awaiting_retake', attempt_status='stopped', submitted_at=SUBMITTED,
        is_flagged=True, retake_request={'status': 'pending'}),
    record(7, availability_status='upcoming', action='unavailable', available_at='2026-11-01T01:00:00Z'),
    record(8, availability_status='overdue', action='unavailable'),
    # Defensive closed/unsubmitted fallback; current API normally omits this row.
    record(9, availability_status='closed', action='unavailable'),
    record(10, availability_status='closed', action='view_result', attempt_status='submitted', submitted_at=SUBMITTED),
    record(11, action='awaiting_retake', attempt_status='stopped', submitted_at=SUBMITTED,
        is_flagged=True, retake_request={'status': 'declined'}),
    record(12, is_required=False, include_in_competency=False),
]
expected_order = [2, 3, 4, 12, 5, 6, 11, 7, 8, 9, 1, 10]
expected_states = {1: 'completed', 2: 'progress', 3: 'ready', 4: 'retake', 5: 'stopped',
    6: 'stopped', 7: 'upcoming', 8: 'overdue', 9: 'closed', 10: 'completed', 11: 'stopped', 12: 'ready'}
checks, errors, writes, reads = [], [], [], []


with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    context = browser.new_context(viewport={'width': 1440, 'height': 1100}, reduced_motion='reduce')
    context.add_init_script('for (const [k,v] of Object.entries(' + json.dumps({
        'sb-token': 'synthetic', 'sb-role': 'student', 'sb-user': json.dumps(USER), 'sb-theme': 'light',
    }) + ')) localStorage.setItem(k,v)')

    def route(request):
        url = urlparse(request.request.url)
        if url.path.startswith('/api/'):
            reads.append(url.path)
            if request.request.method not in ('GET', 'OPTIONS'):
                writes.append(url.path)
                return request.abort()
            if url.path.endswith('/events/'):
                return request.fulfill(status=204)
            if url.path in ('/api/auth/me/', '/api/students/me/'):
                return request.fulfill(json=USER)
            if url.path == '/api/assessments/':
                return request.fulfill(json=dict(batch=USER['batch'], assessments=records,
                    completed_required_count=2, total_required_count=11, remaining_required_count=9,
                    all_required_completed=False))
            return request.fulfill(json=[])
        return request.continue_() if url.hostname in ('127.0.0.1', 'localhost') else request.abort()

    context.route('**/*', route)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    try:
        page.goto(BASE + '/student/assessments', wait_until='networkidle')
        cards = page.locator('.sac-card')

        def card(number):
            return cards.filter(has=page.get_by_role('heading', name=f'Assessment {number}', exact=True))

        expect(cards.locator('h2')).to_have_text([f'Assessment {n}' for n in expected_order])
        for number, state in expected_states.items():
            expect(card(number)).to_have_attribute('data-assessment-state', state)
        expect(page.get_by_role('progressbar', name='Required assessment completion')).to_have_attribute('aria-valuenow', '2')
        expect(page.get_by_text('9 required assessments to go.', exact=True)).to_be_visible()
        expect(card(10).get_by_role('button', name='View Score', exact=True)).to_be_enabled()
        for number in (7, 8, 9):
            expect(card(number).get_by_role('button', name='Unavailable', exact=True)).to_be_disabled()
        expect(card(5).get_by_role('button', name='Request retake', exact=True)).to_be_enabled()
        for number, status in ((6, 'Pending'), (11, 'Declined')):
            expect(card(number).get_by_text(f'Retake request: {status}', exact=True)).to_be_visible()
            expect(card(number).get_by_role('button', name='View retake request', exact=True)).to_be_enabled()
            expect(card(number).get_by_role('button', name='Request retake', exact=True)).to_have_count(0)
        expect(card(4).get_by_role('button', name='Retake Assessment', exact=True)).to_be_enabled()
        expect(card(4)).to_contain_text('Your earlier attempt remains on record.')
        policy = card(4).locator('.sac-retake-details')
        expect(policy.locator('p')).not_to_be_visible()
        policy.locator('summary').focus()
        page.keyboard.press('Enter')
        expect(policy.locator('p')).to_be_visible()
        policy.locator('summary').click()
        expect(policy.locator('p')).not_to_be_visible()
        expect(card(12)).to_contain_text('Optional work does not block final results.')
        checks.append('All existing states/actions, pending/declined request controls, closed completed result access, optional notices and authoritative server progress')

        for width, height in ((320, 568), (390, 844), (768, 1024), (1024, 600), (1440, 1100), (1920, 1080)):
            page.set_viewport_size({'width': width, 'height': height})
            for dark in (False, True):
                page.evaluate('dark => document.documentElement.classList.toggle("dark", dark)', dark)
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
                surfaces, statuses = set(), set()
                for number in expected_states:
                    node = card(number)
                    assert node.evaluate('n => n.scrollWidth <= n.clientWidth + 1'), f'Card {number} overflow'
                    surfaces.add(node.evaluate('n => getComputedStyle(n).backgroundColor'))
                    statuses.add(node.locator('.sac-status').inner_text())
                    expect(node.locator('.sac-state-icon')).to_be_visible()
                    expect(node).to_have_css('overflow', 'hidden')
                    assert node.evaluate('''n => {
                        const accent = getComputedStyle(n, '::before');
                        return accent.display === 'none' || [accent.top, accent.left, accent.right].every(value => value === '0px');
                    }'''), f'Card {number} accent extends outside its rounded frame'
                assert len(surfaces) >= 7, surfaces
                assert len(statuses) >= 8, statuses
                expect(card(7)).to_have_css('border-top-style', 'dashed')
                expect(card(2)).to_have_css('border-top-style', 'solid')
                # Verify every enabled primary/secondary action has hover and keyboard focus feedback.
                for button in cards.locator('button:enabled').all():
                    page.mouse.move(0, 0)
                    original = button.evaluate('n => getComputedStyle(n).backgroundColor')
                    button.hover()
                    expect(button).not_to_have_css('background-color', original)
                    expect(button).to_have_css('cursor', 'pointer')
                    page.keyboard.press('Tab')
                    button.focus()
                    expect(button).to_have_css('outline-style', 'solid')
                page.mouse.move(0, 0)
                card(1).screenshot(path=str(OUT / f'completed-{width}-{"dark" if dark else "light"}.png'))
                page.evaluate('window.scrollTo(0, 0)')
                page.screenshot(path=str(OUT / f'states-{width}-{"dark" if dark else "light"}.png'), full_page=True)
        checks.append('Twelve responsive light/dark state layouts, distinct surfaces/icons/labels, upcoming dashed border, every enabled button hover/focus and no overflow')

        # A data refresh moves newly completed cards without changing their identities or saved title.
        records[2].update(attempt_status='submitted', submitted_at=SUBMITTED, action='view_result')
        page.evaluate('window.dispatchEvent(new CustomEvent("sse:data_changed", {detail:{urls:["/api/assessments/"]}}))')
        expect(card(3)).to_have_attribute('data-assessment-state', 'completed')
        expect(cards.locator('h2')).to_have_text([f'Assessment {n}' for n in [2, 4, 12, 5, 6, 11, 7, 8, 9, 1, 3, 10]])
        page.reload(wait_until='networkidle')
        expect(cards.locator('h2')).to_have_text([f'Assessment {n}' for n in [2, 4, 12, 5, 6, 11, 7, 8, 9, 1, 3, 10]])
        # Turn a stopped response into a legacy flagged submitted response; never call it completed.
        records[4].update(attempt_status='submitted', action='view_result')
        page.evaluate('window.dispatchEvent(new CustomEvent("sse:data_changed", {detail:{urls:["/api/assessments/"]}}))')
        expect(card(5)).to_have_attribute('data-assessment-state', 'flagged')
        expect(card(5).locator('.sac-status')).to_have_text('Needs review')
        checks.append('Live completion and reload preserve stable group order and assessment numbers; flagged submitted records remain Needs review')
        assert not writes, writes
        assert not errors, errors
        (OUT / 'results.json').write_text(json.dumps({'checks': checks, 'page_errors': errors, 'writes': writes}, indent=2), encoding='utf-8')
        for note in checks:
            print('PASS: ' + note, flush=True)
    finally:
        context.close()
        browser.close()
