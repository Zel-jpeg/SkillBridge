"""One open navigation group on desktop and mobile, using synthetic staff sessions."""
from playwright.sync_api import expect, sync_playwright
from organization_playwright import BASE, OUT, errors, session


def check_motion(toggle):
    samples = toggle.evaluate('''async button => {
      const panel = document.getElementById(button.getAttribute('aria-controls'));
      const sample = () => ({ height: panel.getBoundingClientRect().height,
        opacity: Number(getComputedStyle(panel).opacity), inert: panel.inert,
        hidden: panel.getAttribute('aria-hidden') });
      const start = sample();
      button.click();
      await new Promise(requestAnimationFrame);
      const opened = sample();
      let animations = panel.getAnimations();
      const entrance = animations.find(animation => animation.transitionProperty === 'grid-template-rows');
      if (!entrance) throw new Error('Expected an intrinsic-height entrance transition');
      const enterDuration = entrance.effect.getTiming().duration;
      for (const animation of animations) { animation.pause(); animation.currentTime = enterDuration / 2; }
      await new Promise(requestAnimationFrame);
      const middle = sample();
      for (const animation of animations) animation.finish();
      const full = sample();
      button.click();
      await new Promise(requestAnimationFrame);
      sample();
      animations = panel.getAnimations();
      const exit = animations.find(animation => animation.transitionProperty === 'grid-template-rows');
      if (!exit) throw new Error('Expected an exit transition');
      const exitDuration = exit.effect.getTiming().duration;
      for (const animation of animations) { animation.pause(); animation.currentTime = exitDuration / 2; }
      await new Promise(requestAnimationFrame);
      const closing = sample();
      button.focus();
      panel.querySelector('a').focus();
      const blockedFocus = document.activeElement === button;
      for (const animation of animations) animation.finish();
      return {start, opened, middle, full, closing, end: sample(), enterDuration, exitDuration, blockedFocus};
    }''')
    assert samples['start']['height'] == 0, samples
    assert 0 < samples['middle']['height'] < samples['full']['height'], samples
    assert 0 < samples['middle']['opacity'] < 1, samples
    assert 0 < samples['closing']['height'] < samples['full']['height'], samples
    assert samples['closing']['inert'] and samples['closing']['hidden'] == 'true', samples
    assert samples['end']['height'] == 0 and samples['blockedFocus'], samples
    assert samples['enterDuration'] == 200 and samples['exitDuration'] == 160, samples
    # Reversing before the previous transition completes must settle on the latest state.
    toggle.evaluate('async button => { for (let i = 0; i < 7; i++) { button.click(); await new Promise(requestAnimationFrame); button.offsetHeight; } }')
    expect(toggle).to_have_attribute('aria-expanded', 'true')
    panel = toggle.page.locator('[id="' + toggle.get_attribute('aria-controls') + '"]')
    expect(panel).to_have_css('opacity', '1')
    toggle.click()
    expect(panel).to_have_css('visibility', 'hidden')


with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    for role in ('admin', 'instructor'):
        context, page = session(browser, role)
        page.goto(BASE + f'/{role}/assessments', wait_until='networkidle')
        nav = page.locator('#sb-desktop-navigation')
        learning = nav.get_by_role('button', name='Learning & assessment', exact=True)
        ojt = nav.get_by_role('button', name='OJT', exact=True)
        check_motion(ojt)
        learning.click()
        expect(learning).to_have_attribute('aria-expanded', 'true')
        ojt.press('Enter')
        expect(learning).to_have_attribute('aria-expanded', 'false')
        expect(ojt).to_have_attribute('aria-expanded', 'true')
        expect(nav.locator('button[aria-expanded="true"]')).to_have_count(1)
        if role == 'admin':
            people = nav.get_by_role('button', name='People & programs', exact=True)
            people.press('Space')
            expect(ojt).to_have_attribute('aria-expanded', 'false')
            expect(people).to_have_attribute('aria-expanded', 'true')
        learning.click()
        expect(nav.locator('button[aria-expanded="true"]')).to_have_count(1)
        learning.click()
        expect(nav.locator('button[aria-expanded="true"]')).to_have_count(0)
        ojt.click()
        nav.get_by_role('link', name='OJT Partners', exact=True).click()
        expect(ojt).to_have_attribute('aria-expanded', 'true')
        expect(nav.locator('a[aria-current="page"]')).to_have_attribute('href', f'/{role}/companies')
        page.get_by_role('button', name='Collapse sidebar', exact=True).click()
        expect(nav.get_by_role('button', name='OJT', exact=True)).to_have_count(0)
        expect(nav.get_by_role('link', name='OJT Partners', exact=True)).to_be_visible()
        page.get_by_role('button', name='Expand sidebar', exact=True).click()
        expect(nav.locator('button[aria-expanded="true"]')).to_have_count(1)
        page.screenshot(path=str(OUT / f'{role}-accordion-desktop.png'))
        print(f'PASS {role}: keyboard accordion, collapse-all, active route, and icon rail')

        page.set_viewport_size({'width': 390, 'height': 844})
        page.get_by_role('button', name='Open navigation menu', exact=True).click()
        mobile = page.locator('#sb-mobile-navigation')
        expect(mobile.get_by_role('button', name='OJT', exact=True)).to_have_attribute('aria-expanded', 'true')
        learning_mobile = mobile.get_by_role('button', name='Learning & assessment', exact=True)
        check_motion(learning_mobile)
        mobile.get_by_role('link', name='Reports & Analytics', exact=True).focus()
        page.keyboard.press('Tab')
        expect(page.get_by_role('button', name='Close navigation menu', exact=True)).to_be_focused()
        mobile.get_by_role('button', name='Learning & assessment', exact=True).press('Space')
        expect(mobile.get_by_role('button', name='OJT', exact=True)).to_have_attribute('aria-expanded', 'false')
        expect(mobile.locator('button[aria-expanded="true"]')).to_have_count(1)
        page.screenshot(path=str(OUT / f'{role}-accordion-phone.png'))
        page.keyboard.press('Escape')
        expect(page.get_by_role('button', name='Open navigation menu', exact=True)).to_be_focused()
        context.close()
        print(f'PASS {role}: phone accordion and drawer Escape/focus restoration')
    context, page = session(browser, 'admin', width=390, dark=True, mobile=True)
    page.emulate_media(reduced_motion='reduce')
    page.goto(BASE + '/admin/assessments', wait_until='networkidle')
    page.get_by_role('button', name='Open navigation menu', exact=True).click()
    toggle = page.locator('#sb-mobile-navigation').get_by_role('button', name='OJT', exact=True)
    states = toggle.evaluate('''async button => {
      const panel = document.getElementById(button.getAttribute('aria-controls'));
      button.click();
      await new Promise(requestAnimationFrame);
      const height = panel.getBoundingClientRect().height;
      const animations = panel.getAnimations().length;
      button.click();
      await new Promise(requestAnimationFrame);
      return {height, animations, closed: panel.getBoundingClientRect().height,
        chevronAnimations: button.querySelector('.sb-nav-group-chevron').getAnimations().length};
    }''')
    assert states['height'] > 0 and states['closed'] == 0, states
    assert states['animations'] == 0 and states['chevronAnimations'] == 0, states
    page.screenshot(path=str(OUT / 'sidebar-reduced-motion-dark-phone.png'))
    context.close()
    print('PASS measured 200/160ms transitions, intermediate heights, rapid reversal, inert focus and instant reduced motion')
    context, page = session(browser, 'student')
    page.goto(BASE + '/student/dashboard', wait_until='networkidle')
    expect(page.locator('#sb-desktop-navigation .sb-nav-group-toggle')).to_have_count(0)
    context.close()
    browser.close()
    assert not errors, errors
    print('PASS student flat navigation retained; zero browser page errors')
