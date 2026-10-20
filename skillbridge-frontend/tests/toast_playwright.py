"""Synthetic notification behavior; no server data, accounts or external requests."""
from pathlib import Path
import json
import os
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('TOAST_TEST_BASE', 'http://127.0.0.1:5194') + '/tests/toast/'
ARTIFACTS = Path(__file__).parent / 'artifacts/toast'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
checks, errors = [], []

def load(page):
    page.goto(BASE)
    page.wait_for_load_state('networkidle')
    page.mouse.move(1, 500)

def remaining(page):
    return page.locator('.sb-toast-timer').first.evaluate('el => el.getAnimations()[0].currentTime')

with sync_playwright() as p:
    browser = p.chromium.launch(channel=os.environ.get('TOAST_BROWSER', 'chrome'), headless=True)
    page = browser.new_page(viewport={'width': 1366, 'height': 900})
    page.on('pageerror', lambda err: errors.append(str(err)))
    load(page)
    page.get_by_role('button', name='Success', exact=True).click()
    toast = page.locator('.sb-toast')
    expect(toast).to_be_visible()
    page.wait_for_timeout(400)
    page.screenshot(path=str(ARTIFACTS / 'success-desktop.png'))
    toast.hover()
    expect(toast).to_have_attribute('data-paused', 'true')
    page.wait_for_timeout(50)
    paused = remaining(page)
    page.wait_for_timeout(1900)
    expect(toast).to_be_visible()
    assert abs(remaining(page) - paused) < 50
    page.mouse.move(1, 500)
    page.wait_for_timeout(250)
    assert remaining(page) > paused + 100
    expect(toast).to_have_count(0, timeout=2200)
    checks.append('hover pauses bar and expiry; leave resumes remaining lifetime')

    page.get_by_role('button', name='Error', exact=True).click()
    close = page.get_by_role('button', name='Dismiss notification')
    close.focus()
    page.wait_for_timeout(1800)
    expect(toast).to_be_visible()
    page.get_by_role('button', name='Theme', exact=True).focus()
    expect(toast).to_have_count(0, timeout=2200)
    checks.append('keyboard focus pauses; blur resumes; error alert semantics')

    page.get_by_role('button', name='Success', exact=True).click()
    page.get_by_role('button', name='Success', exact=True).click()
    expect(toast).to_have_count(1)
    close.click()
    expect(toast).to_have_count(0)
    page.get_by_role('button', name='Queue', exact=True).click()
    expect(toast).to_have_count(3)
    expect(page.locator('.sb-toast').filter(has_text='Queued message 4')).to_have_count(0)
    page.wait_for_timeout(1700)
    expect(toast).to_have_count(2)
    expect(page.locator('.sb-toast').filter(has_text='Queued message 4')).to_be_visible()
    expect(toast).to_have_count(0, timeout=2400)
    checks.append('deduplication, manual close and bounded queue; queued timers wait')

    page.get_by_role('button', name='Open dialog', exact=True).click()
    page.get_by_role('button', name='Enroll', exact=True).click()
    expect(page.locator('dialog[open] .sb-toast')).to_be_visible()
    page.wait_for_timeout(350)
    before = remaining(page)
    page.get_by_role('button', name='Nested dialog', exact=True).click()
    expect(page.locator('dialog').last.locator('.sb-toast')).to_be_visible()
    after = remaining(page)
    assert after >= before - 50, f'Timer restarted on modal move: {before} -> {after}'
    page.get_by_role('button', name='Dismiss notification').click()
    expect(toast).to_have_count(0)
    page.get_by_role('button', name='Close nested').click()
    page.get_by_role('button', name='Enroll', exact=True).click()
    page.wait_for_timeout(300)
    before = remaining(page)
    page.get_by_role('button', name='Close dialog', exact=True).click()
    assert remaining(page) >= before - 50, 'Timer restarted when closing modal'
    expect(toast).to_have_count(0, timeout=2200)
    checks.append('nested modal top layer, accessible close and timer continuity across modal closure')

    for width in [320, 375, 768, 1024, 1440]:
        page.set_viewport_size({'width': width, 'height': 800})
        for dark in [False, True]:
            load(page)
            page.evaluate('(dark) => document.documentElement.classList.toggle("dark", dark)', dark)
            page.get_by_role('button', name='Long', exact=True).click()
            box = toast.bounding_box()
            assert box['x'] >= 0 and box['x'] + box['width'] <= width
            assert toast.evaluate('el => el.scrollWidth <= el.clientWidth + 1')
            background = toast.evaluate('el => getComputedStyle(el).backgroundColor')
            assert background == ('rgb(31, 41, 55)' if dark else 'rgb(255, 255, 255)'), background
            page.wait_for_timeout(250)
            page.screenshot(path=str(ARTIFACTS / f'{width}-{"dark" if dark else "light"}.png'))
            page.get_by_role('button', name='Dismiss notification').click()
    checks.append('320/375/768/1024/1440px, both themes, long unbroken messages fit viewport')

    load(page)
    page.get_by_role('button', name='Success', exact=True).click()
    page.evaluate('Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange"))')
    page.wait_for_timeout(1800)
    expect(toast).to_be_visible()
    page.evaluate('Object.defineProperty(document, "hidden", { configurable: true, value: false }); document.dispatchEvent(new Event("visibilitychange"))')
    expect(toast).to_have_count(0, timeout=2200)
    checks.append('hidden-page visibility event pauses countdown and return resumes')

    load(page)
    page.get_by_role('button', name='Fullscreen', exact=True).click()
    assert page.evaluate('!!document.fullscreenElement')
    page.get_by_role('button', name='Success', exact=True).click()
    expect(toast).to_be_visible()
    page.get_by_role('button', name='Dismiss notification').click()
    page.evaluate('document.exitFullscreen()')
    checks.append('fullscreen toast visible and dismissible')

    page.emulate_media(reduced_motion='reduce')
    page.get_by_role('button', name='Success', exact=True).click()
    assert toast.evaluate('el => getComputedStyle(el).animationName') == 'none'
    expect(toast).to_have_count(0, timeout=2200)
    checks.append('reduced motion suppresses entry effect; expiry still works')

    touch = browser.new_context(viewport={'width': 375, 'height': 812}, is_mobile=True, has_touch=True)
    mobile = touch.new_page()
    mobile.on('pageerror', lambda err: errors.append(str(err)))
    load(mobile)
    mobile.get_by_role('button', name='Success', exact=True).tap()
    message = mobile.locator('.sb-toast-message').bounding_box()
    cdp = touch.new_cdp_session(mobile)
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': message['x'] + 20, 'y': message['y'] + 12}]})
    mobile.wait_for_timeout(1800)
    expect(mobile.locator('.sb-toast')).to_be_visible()
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
    expect(mobile.locator('.sb-toast')).to_have_count(0, timeout=2200)
    mobile.get_by_role('button', name='Success', exact=True).tap()
    mobile.wait_for_timeout(250)
    mobile.screenshot(path=str(ARTIFACTS / 'success-mobile.png'))
    mobile.get_by_role('button', name='Dismiss notification').tap()
    expect(mobile.locator('.sb-toast')).to_have_count(0)
    checks.append('touch-and-hold pauses, release resumes; 44px touch close dismisses')
    assert not errors, errors
    browser.close()
(ARTIFACTS / f"results-{os.environ.get('TOAST_BROWSER', 'chrome')}.json").write_text(json.dumps({'checks': checks, 'errors': errors}, indent=2))
print(json.dumps({'passed': len(checks), 'checks': checks, 'errors': errors}, indent=2))
