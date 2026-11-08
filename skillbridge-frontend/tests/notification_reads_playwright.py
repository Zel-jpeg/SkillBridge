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

def restart_session(page, expired=False):
    destination = page.url
    if expired:
        page.evaluate("window.dispatchEvent(new Event('auth:expired'))")
        page.get_by_role('button', name='Sign in again', exact=True).click()
    else:
        page.get_by_role('button', name='Open profile menu', exact=True).click()
        page.get_by_role('button', name='Log out', exact=True).click()
        page.get_by_role('dialog', name='Log out of SkillBridge?').get_by_role('button', name='Log out', exact=True).click()
    expect(page).to_have_url(re.compile('/(?:admin/)?login$'))
    assert page.evaluate("localStorage.getItem('sb-token')") is None
    expect(page.locator('.sb-toast')).to_have_count(0)
    # The role fixture restores the same synthetic sign-in on the next page load.
    page.goto(destination, wait_until='networkidle')


def refresh(page, url):
    with page.expect_response(lambda response: response.request.method == 'GET' and url in response.url):
        page.evaluate('async url => { const {invalidateCache}=await import("/src/hooks/useApi.js"); invalidateCache(url) }', url)
    page.wait_for_load_state('networkidle')


def email_replay(page, fixture, bell):
    url = '/api/management/analytics/?view=overview'
    group = {'id': 'saved-synthetic-email-group', 'batch_id': 1, 'batch_name': 'Original batch',
        'source': 'enrollment', 'created_at': '2026-10-20T07:00:00Z', 'total': 1, 'submitted': 0,
        'delivered': 0, 'waiting': 1, 'held': 0, 'failed': 0, 'uncertain': 0, 'cancelled': 0, 'state': 'sending'}
    fixture.email_progress = [group]
    refresh(page, url)
    delivered = {**group, 'state': 'delivered', 'waiting': 0, 'submitted': 1, 'delivered': 1}
    fixture.email_progress = [delivered]
    refresh(page, url)
    toast = page.locator('.sb-toast').filter(has_text='Enrollment emails delivered to all 1 students')
    expect(toast).to_be_visible()
    toast.get_by_role('button', name='Dismiss notification').click()
    # A lagging initial progress snapshot must not replay the completed toast.
    fixture.email_progress = [group]
    restart_session(page)
    fixture.email_progress = [delivered]
    refresh(page, url)
    expect(toast).to_have_count(0)
    expect(page.locator('.sb-notification-badge')).to_have_text('1')
    bell.click()
    page.get_by_role('button', name='Mark all as read').click()
    page.keyboard.press('Escape')
    fixture.email_progress = [{**delivered, 'batch_name': 'Renamed batch'}]
    restart_session(page, expired=True)
    expect(page.locator('.sb-notification-badge')).to_have_count(0)
    expect(toast).to_have_count(0)
    # A different completed group still gets a live popup. Session expiry clears it.
    other = {**group, 'id': 'another-synthetic-email-group'}
    fixture.email_progress = [other]
    refresh(page, url)
    fixture.email_progress = [{**delivered, 'id': other['id']}]
    refresh(page, url)
    expect(toast).to_be_visible()
    restart_session(page, expired=True)


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
        refresh(page, url)
        expect(page.locator('.sb-notification-badge')).to_have_count(0)
        page.keyboard.press('Escape')
        for expired in [False, True]:
            restart_session(page, expired=expired)
            expect(bell).to_have_attribute('aria-label', re.compile(r'0 unread'))
            expect(page.locator('.sb-notification-badge')).to_have_count(0)
        if role != 'student':
            email_replay(page, fixture, bell)
        bell.click()
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
        page.emulate_media(reduced_motion='no-preference')
        bell.press('Enter')
        expect(panel).to_have_css('animation-name', 'sb-popover-enter')
        page.keyboard.press('Escape')
        expect(bell).to_be_focused()
        page.emulate_media(reduced_motion='reduce')
        bell.press('Enter')
        expect(panel).to_have_css('animation-name', 'none')
        page.keyboard.press('Escape')
        expect(bell).to_be_focused()
        profile = page.get_by_role('button', name='Open profile menu', exact=True)
        profile_menu = page.locator('.sb-profile-menu')
        for preference, animation in [('no-preference', 'sb-popover-enter'), ('reduce', 'none')]:
            page.emulate_media(reduced_motion=preference)
            profile.press('Enter')
            expect(profile_menu).to_have_css('animation-name', animation)
            page.keyboard.press('Escape')
            expect(profile_menu).to_have_count(0)
            expect(profile).to_be_focused()
        fixture.close()
        print(f'PASS {role}: logout/expiry read persistence, refresh, severity, responsive layouts, reduced motion and focus', flush=True)
    browser.close()
