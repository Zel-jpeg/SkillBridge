"""Actual picker rendering, native keyboard/forms, grouped address data and dialogs.
Run with with_server.py on port 5201. Only synthetic address responses are used.
"""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

OUT = Path(__file__).parent / 'artifacts/dropdowns'
OUT.mkdir(parents=True, exist_ok=True)
checks, errors = [], []

def geometry(page, control):
    if not page.evaluate('document.documentElement.scrollWidth <= innerWidth'):
        page.screenshot(path=str(OUT/'overflow.png'))
        print(page.evaluate('''() => [...document.querySelectorAll('body *')].filter(el => {const r=el.getBoundingClientRect(); return r.width && (r.x<0 || r.right>innerWidth+1)}).slice(0,8).map(el => ({tag:el.tagName,text:el.textContent.slice(0,50),x:el.getBoundingClientRect().x,w:el.getBoundingClientRect().width,appearance:getComputedStyle(el).appearance}))'''),flush=True)
        raise AssertionError('Page overflow')
    control.click()
    expect(control).to_have_js_property('value', control.input_value())
    assert control.evaluate('el => el.matches(":open")'), 'Actual customized picker did not open'
    painted = control.locator('option').evaluate_all('items => items.map(el => ({text:el.textContent, x:el.getBoundingClientRect().x, w:el.getBoundingClientRect().width})).filter(x => x.w > 0)')
    assert painted and all(row['x'] >= -1 and row['x'] + row['w'] <= page.viewport_size['width'] + 1 for row in painted), painted
    assert control.evaluate('el => parseFloat(getComputedStyle(el, "::picker(select)").maxHeight) <= innerHeight'), 'Unbounded menu'

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    context = browser.new_context(viewport={'width': 1440, 'height': 1050}, reduced_motion='reduce')
    def address(route):
        path = route.request.url
        rows = [{'code':'DAV','name':'Davao del Norte'},{'code':'ABA','name':'Abra'}] if path.endswith('/provinces/') else [{'code':'PAN','name':'Panabo City'}] if '/provinces/' in path else [{'code':'BRG','name':'Sample Barangay'}]
        route.fulfill(json=rows)
    context.route('https://psgc.gitlab.io/api/**', address)
    page = context.new_page()
    def page_error(error):
        errors.append(str(error))
        print('Synthetic fixture error: '+str(error),flush=True)
    page.on('pageerror', page_error)
    page.goto('http://127.0.0.1:5201/tests/dropdowns/index.html')
    page.wait_for_load_state('networkidle')
    assert page.evaluate('CSS.supports("appearance", "base-select")'), 'This suite needs a customizable-select browser'
    batch = page.get_by_label('Batch', exact=True)
    assert batch.evaluate('el => getComputedStyle(el).appearance') == 'base-select'
    for width, height in [(1440,1050),(768,1024),(375,812),(320,568),(812,375)]:
        page.set_viewport_size({'width':width, 'height':height})
        for dark in [False,True]:
            page.evaluate('(dark) => document.documentElement.classList.toggle("dark", dark)',dark)
            batch.scroll_into_view_if_needed()
            geometry(page,batch)
            color=batch.evaluate('el => getComputedStyle(el,"::picker(select)").backgroundColor')
            assert color == ('rgb(17, 24, 39)' if dark else 'rgb(255, 255, 255)'), color
            page.screenshot(path=str(OUT/f'picker-{width}-{"dark" if dark else "light"}.png'))
            page.keyboard.press('Escape'); expect(batch).to_be_focused()
            long=page.get_by_label('Long company name',exact=True)
            geometry(page,long); page.keyboard.press('Escape')
            checks.append(f'{width}x{height} {dark=}: custom picker, long labels, bounded scrolling and Escape/focus')
    page.set_viewport_size({'width':1440,'height':1050})
    page.evaluate('document.documentElement.classList.remove("dark")')
    batch.focus(); page.keyboard.press('Space'); expect(page.locator('select:open')).to_have_count(1)
    page.get_by_role('option',name='Sample Batch 02',exact=True).click()
    expect(batch).to_have_value('2')
    page.get_by_label('Student status',exact=True).select_option('pending')
    batch.select_option('3'); expect(page.get_by_role('status',name='Filter state',exact=True)).to_have_text('Batch 3 · Status all')
    locked=page.get_by_label('Locked publication',exact=True); expect(locked).to_be_disabled()
    expect(page.get_by_label('Zero value',exact=True)).to_have_value('0')
    assert page.get_by_label('Invalid selection',exact=True).evaluate('el=>getComputedStyle(el).borderTopColor') == 'rgb(225, 29, 72)'
    checks.append('Native type/value/change contracts: keyboard selection, reset, disabled/invalid fields and earned zero')
    province=page.get_by_label('Home — Province',exact=True)
    expect(province).to_be_enabled()
    expect(page.get_by_label('City / Municipality',exact=True)).to_be_disabled()
    province.click(); expect(province.locator('optgroup')).to_have_count(2)
    page.screenshot(path=str(OUT/'grouped-provinces.png')); page.keyboard.press('Escape')
    province.select_option('DAV'); city=page.get_by_label('City / Municipality',exact=True)
    expect(city).to_be_enabled(); city.select_option('PAN')
    barangay=page.get_by_label('Barangay',exact=True); expect(barangay).to_be_enabled(); barangay.select_option('Sample Barangay')
    expect(page.get_by_label('Selected address',exact=True)).to_have_text('Davao del Norte · Panabo City · Sample Barangay')
    province.select_option('ABA'); expect(city).to_have_value(''); expect(barangay).to_have_value(''); expect(barangay).to_be_disabled()
    checks.append('Real shared address dropdowns: associated labels, preserved groups, asynchronous cascading values/reset')
    page.get_by_role('button',name='Open form dialog',exact=True).click()
    course=page.get_by_label('Course',exact=True); geometry(page,course)
    page.screenshot(path=str(OUT/'inside-native-dialog.png'))
    page.keyboard.press('Escape'); expect(page.locator('dialog')).to_be_visible(); expect(course).to_be_focused()
    page.get_by_role('button',name='Save sample form',exact=True).click()
    assert course.evaluate('el => !el.validity.valid'), 'Required validation disappeared'
    course.select_option('BSIT'); page.get_by_role('button',name='Save sample form',exact=True).click()
    expect(page.get_by_label('Saved course',exact=True)).to_have_text('BSIT')
    checks.append('Native top-layer dialog: picker remains above dialog, first Escape closes only picker, required/form submission preserved')
    page.evaluate('window.scrollTo(0,0)')
    page.screenshot(path=str(OUT/'fields-desktop.png'))
    page.emulate_media(forced_colors='active')
    assert batch.evaluate('el=>getComputedStyle(el).appearance') == 'auto'
    page.emulate_media(forced_colors='none')
    checks.append('Forced-colors mode restores the operating-system control appearance')
    context.close()
    touch=browser.new_context(viewport={'width':375,'height':812},is_mobile=True,has_touch=True,reduced_motion='reduce')
    touch.route('https://psgc.gitlab.io/api/**',address)
    page=touch.new_page(); page.on('pageerror',page_error)
    page.goto('http://127.0.0.1:5201/tests/dropdowns/index.html'); page.wait_for_load_state('networkidle')
    batch=page.get_by_label('Batch',exact=True)
    assert page.evaluate('matchMedia("(pointer: coarse)").matches')
    assert batch.bounding_box()['height'] >= 44
    geometry(page,batch)
    assert batch.locator('option').first.bounding_box()['height'] >= 44
    page.screenshot(path=str(OUT/'touch-picker-375.png'))
    page.keyboard.press('Escape')
    page.screenshot(path=str(OUT/'fields-touch-375.png'))
    checks.append('Touch emulation: 44px field and option targets, bounded picker and no page overflow')
    touch.close(); browser.close()
assert not errors,errors
(OUT/'checks.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'page_errors':errors},indent=2),encoding='utf-8')
print(json.dumps({'passed':len(checks),'checks':checks,'page_errors':errors},indent=2))
