"""Synthetic read/unread lifecycle checks; no backend mutation or real accounts."""
import os
import re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('NOTIFICATION_TEST_URL', 'http://127.0.0.1:5199')
ROOT = Path(__file__).parent
ARTIFACTS = ROOT/'artifacts/notification-reads'
ARTIFACTS.mkdir(parents=True, exist_ok=True)

def fixture_class(filename):
    # Reuse existing intercepted role payloads without executing their test suites.
    path = ROOT/filename
    namespace = {'__file__': str(path), '__name__': 'notification_fixture'}
    exec(compile(path.read_text(encoding='utf-8').split('\nwith sync_playwright() as p:')[0], str(path), 'exec'), namespace)
    namespace['BASE'] = BASE
    return namespace['Fixture']

StudentFixture = fixture_class('student_notifications_playwright.py')
StaffFixture = fixture_class('dashboard_highlights_playwright.py')

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    for role in ['student', 'instructor', 'admin']:
        fixture = StudentFixture(browser) if role == 'student' else StaffFixture(browser, role)
        if role == 'student':
            page, panel, bell = fixture.open()
            destination = '/student/results'
            title = 'OJT placement approved'
        else:
            page = fixture.open()
            bell = page.get_by_role('button', name=re.compile('^Open notifications'))
            bell.click()
            panel = page.get_by_role('region', name='Notifications', exact=True)
            destination = f'/{role}/reports?tab=placements&group=awaiting'
            title = 'Placement review'
        total = panel.get_by_role('link').count()
        expect(page.locator('.sb-notification-badge')).to_have_text(str(total))
        expect(page.locator('.sb-notification-badge')).to_have_class(re.compile('--danger'))
        problem_icon = panel.locator('.sb-notification-icon--danger').first
        assert problem_icon.locator('svg').evaluate('(el)=>getComputedStyle(el).stroke') == problem_icon.evaluate('(el)=>getComputedStyle(el).color')
        notice = panel.get_by_role('link').filter(has_text=title)
        expect(notice).to_have_class(re.compile('--success' if role == 'student' else '--warning'))
        notice.click()
        expect(page).to_have_url(BASE+destination)
        expect(page.get_by_role('button', name='Reload page', exact=True)).to_have_count(0)
        expect(page.locator('.sb-notification-badge')).to_have_text(str(total-1))
        bell.click()
        expect(panel.get_by_role('link').filter(has_text=title)).to_contain_text('Read')
        page.reload(wait_until='networkidle')
        expect(page.locator('.sb-notification-badge')).to_have_text(str(total-1))
        bell.click()
        panel.get_by_role('button', name='Mark all as read').click()
        expect(page.locator('.sb-notification-badge')).to_have_count(0)
        expect(panel.get_by_role('link')).to_have_count(total)
        expect(panel.get_by_role('button', name='Mark all as read')).to_be_disabled()
        page.reload(wait_until='networkidle')
        expect(page.locator('.sb-notification-badge')).to_have_count(0)
        bell.click()
        # Unchanged authorized data must not bring back a badge.
        url = '/api/students/me/' if role == 'student' else '/api/management/analytics/'
        page.evaluate('async url => { const {invalidateCache}=await import("/src/hooks/useApi.js"); invalidateCache(url) }', url)
        expect(page.locator('.sb-notification-badge')).to_have_count(0)
        if role == 'student':
            fixture.profile['placement'] = {**fixture.profile['placement'], 'id': 6, 'company': {'name': 'New Example Company'}}
            fixture.refresh('/api/students/me/')
            expect(panel.get_by_role('link').filter(has_text='New Example Company')).to_be_visible()
            expect(page.locator('.sb-notification-badge')).to_have_text('1')
            expect(page.locator('.sb-notification-badge')).to_have_class(re.compile('--success'))
            # A second tab reads the new update; the first tab reconciles storage.
            second = fixture.context.new_page()
            second.goto(BASE+'/student/profile', wait_until='networkidle')
            second.get_by_role('button', name=re.compile('^Open notifications')).click()
            second.get_by_role('button', name='Mark all as read').click()
            expect(page.locator('.sb-notification-badge')).to_have_count(0)
            second.close()
            # Display-clock deadline escalation creates fresh unread warnings.
            page.clock.fast_forward(86_400_001)
            expect(page.locator('.sb-notification-badge')).not_to_have_count(0)
        for width, height in [(320,568),(768,1024),(1440,900),(812,375)]:
            for dark in [False, True]:
                page.set_viewport_size({'width':width,'height':height})
                page.evaluate('(dark) => document.documentElement.classList.toggle("dark",dark)', dark)
                if not panel.count(): bell.click()
                expect(panel).to_be_visible()
                bounds = panel.bounding_box()
                assert bounds['x']>=0 and bounds['x']+bounds['width']<=width+1
                assert bounds['y']+bounds['height']<=height+1
                assert panel.evaluate('(el)=>el.scrollWidth<=el.clientWidth')
                assert panel.locator('.sb-notification-list').evaluate('(el)=>el.clientHeight>0')
                if width == 320:
                    page.screenshot(path=str(ARTIFACTS/f'{role}-{width}-{dark}.png'))
        page.keyboard.press('Escape')
        expect(panel).to_have_count(0)
        expect(bell).to_be_focused()
        fixture.close()
        print(f'PASS {role}: click/read/reload/mark-all persistence, unchanged refresh, severity and eight responsive/theme layouts', flush=True)
    browser.close()
