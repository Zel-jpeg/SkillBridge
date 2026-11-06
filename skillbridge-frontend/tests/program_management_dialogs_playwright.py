"""Banner form and bounded large instructor collections against synthetic HTTP."""
from io import BytesIO
from PIL import Image
from playwright.sync_api import sync_playwright, expect
import organization_playwright as support

OUT, BASE = support.OUT, support.BASE


def layout(page, dialog):
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert dialog.evaluate('(node) => node.scrollWidth <= node.clientWidth')
    expect(dialog.locator('header h2')).to_be_in_viewport()
    for button in dialog.locator('footer button').all():
        if button.is_visible():
            expect(button).to_be_in_viewport()


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel='chrome', headless=True)
    context, page = support.session(browser)
    support.open_page(page)
    page.get_by_role('searchbox', name='Search by name or code').fill('Synthetic Institute 00')
    page.get_by_role('button', name='Manage programs in Synthetic Institute 00', exact=True).click()
    page.get_by_role('button', name='Add program', exact=True).click()
    form = page.get_by_role('dialog', name='Add program', exact=True)
    expect(form.get_by_label('Other names or codes', exact=True)).to_be_hidden()
    form.get_by_label('Name', exact=True).fill('Community Program')
    form.get_by_label('Code', exact=True).fill('COMM')
    banner = form.get_by_role('region', name='Card banner', exact=True)
    expect(banner.locator('img')).to_have_count(13)
    expect(form.get_by_role('radio')).to_have_count(12)
    expect(form.get_by_role('button', name='Upload banner', exact=True)).to_have_count(0)
    form.locator('summary').filter(has_text='Other names or codes').click()
    form.get_by_label('Other names or codes', exact=True).fill('Community pathway')
    form.get_by_role('button', name='Upload image', exact=True).click()
    expect(form.get_by_role('button', name='Upload banner', exact=True)).to_be_visible()
    file = BytesIO(); Image.new('RGB', (90, 30), '#238758').save(file, format='PNG')
    form.locator('input[type=file]').set_input_files({'name': 'synthetic-banner.png', 'mimeType': 'image/png', 'buffer': file.getvalue()})
    expect(form.get_by_role('img', name='Community Program banner', exact=True)).to_have_css('object-fit', 'cover')
    form.get_by_role('button', name='Preset colors', exact=True).click()
    form.get_by_role('radio', name='Teal geometric banner', exact=True).check()
    expect(banner.locator('img').first).to_have_css('filter', 'hue-rotate(30deg)')
    expect(form.get_by_label('Name', exact=True)).to_have_value('Community Program')
    layout(page, form)
    page.screenshot(path=str(OUT / 'program-dialog-desktop.png'), animations='disabled')
    form.get_by_role('button', name='Save program', exact=True).click()
    expect(form).to_have_count(0)
    institute = support.api(context, '/api/admin/institutes/?search=Synthetic+Institute+00').json()['results'][0]
    root = f'/api/admin/institutes/{institute["id"]}/programs/'
    program = support.api(context, root + '?search=COMM').json()['results'][0]
    assert program['banner_color'] == 1 and program['aliases'] == ['Community pathway']
    print('PASS two-column program form keeps details, aliases and preset/upload choice with one live preview')

    page.set_viewport_size({'width': 390, 'height': 844})
    page.get_by_role('button', name='Add program', exact=True).click()
    form = page.get_by_role('dialog', name='Add program', exact=True)
    expect(form.get_by_role('radio')).to_have_count(0)
    form.get_by_role('button', name='Change banner', exact=True).click()
    expect(form.get_by_role('radio')).to_have_count(12)
    layout(page, form)
    page.screenshot(path=str(OUT / 'program-dialog-phone.png'), animations='disabled')
    form.get_by_role('button', name='Cancel', exact=True).click()
    page.set_viewport_size({'width': 1440, 'height': 900})
    page.get_by_role('searchbox', name='Search by name or code').fill('Community Program')
    page.get_by_role('button', name='Manage instructors for Community Program', exact=True).click()
    panel = page.get_by_role('dialog', name='Program instructors', exact=True)
    assert panel.bounding_box()['height'] < 700
    panel.get_by_role('button', name='Assign instructor', exact=True).click()
    picker = page.get_by_role('dialog', name='Assign instructor', exact=True)
    expect(picker.get_by_text('36 eligible instructors', exact=True)).to_be_visible()
    expect(picker.get_by_role('listitem')).to_have_count(8)
    picker.get_by_role('button', name='Next →', exact=True).click()
    expect(picker.get_by_text('Showing 9–16 of 36', exact=False)).to_be_visible()
    for width in (320, 390, 768, 1440):
        page.set_viewport_size({'width': width, 'height': 844 if width < 500 else 900})
        layout(page, picker)
        if width < 500:
            expect(picker.get_by_role('button', name='1', exact=True)).to_have_count(0)
        page.screenshot(path=str(OUT / f'assign-dialog-{width}.png'), animations='disabled')
    picker.get_by_role('searchbox').fill('SYN-C20')
    expect(picker.get_by_role('listitem')).to_have_count(1)
    expect(picker.get_by_text('SYN-C20', exact=True)).to_be_visible()
    picker.get_by_role('button', name='Assign Synthetic Coordinator 20', exact=True).click()
    expect(picker).to_have_count(0)
    expect(panel.get_by_role('heading', name='Synthetic Coordinator 20', exact=True)).to_be_visible()
    expect(panel.get_by_text('Instructor assigned to this program.', exact=True)).to_be_visible()
    assert panel.bounding_box()['height'] < 700
    print('PASS phone form disclosure and 36-candidate picker use bounded pages, identity search and visible responsive footer')

    base = root + f'{program["id"]}/instructors/'
    candidates = support.api(context, base.replace('instructors/', 'instructor-options/') + '?page_size=50').json()['results']
    for candidate in candidates[:25]:
        assert support.api(context, base, 'post', {'instructor_id': candidate['id']}).status in (200, 201)
    panel.get_by_role('searchbox', name='Search assigned instructors').fill('Synthetic Coordinator')
    expect(panel.get_by_text('25 assignments', exact=True)).to_be_visible()
    expect(panel.get_by_role('listitem')).to_have_count(8)
    panel.get_by_role('button', name='Next →', exact=True).click()
    expect(panel.get_by_text('Showing 9–16 of 25', exact=False)).to_be_visible()
    toggle = panel.get_by_role('group', name='Assigned instructor view', exact=True)
    toggle.get_by_role('button', name='List view', exact=True).click()
    expect(panel.get_by_role('listitem')).to_have_count(8)
    toggle.get_by_role('button', name='Card view', exact=True).click()
    for width in (320, 390, 768, 1440):
        page.set_viewport_size({'width': width, 'height': 844 if width < 500 else 900})
        layout(page, panel)
        page.screenshot(path=str(OUT / f'manage-instructors-{width}.png'), animations='disabled')
    panel.get_by_role('searchbox', name='Search assigned instructors').fill('SYN-C20')
    expect(panel.get_by_role('listitem')).to_have_count(1)
    panel.get_by_role('button', name='Revoke assignment for Synthetic Coordinator 20', exact=True).click()
    confirm = page.get_by_role('dialog', name='Revoke program assignment', exact=True)
    confirm.get_by_role('button', name='Cancel', exact=True).click()
    expect(panel.get_by_text('Active assignment', exact=True)).to_be_visible()
    panel.get_by_role('button', name='Revoke assignment for Synthetic Coordinator 20', exact=True).click()
    confirm.get_by_role('button', name='Revoke', exact=True).click()
    expect(panel.get_by_text('Revoked assignment', exact=True)).to_be_visible()
    panel.get_by_role('button', name='Restore assignment for Synthetic Coordinator 20', exact=True).click()
    page.get_by_role('dialog', name='Restore program assignment', exact=True).get_by_role('button', name='Restore', exact=True).click()
    expect(panel.get_by_text('Active assignment', exact=True)).to_be_visible()
    print('PASS 25-assignment manager switches views, resets pages on search and confirms program-only revoke/restore')

    panel.get_by_role('button', name='Assign instructor', exact=True).click()
    picker.get_by_role('searchbox').fill('SYN-C20')
    expect(picker.get_by_text('Already assigned', exact=True)).to_be_visible()
    expect(picker.get_by_role('button', name='Assign Synthetic Coordinator 20', exact=True)).to_be_disabled()
    picker.get_by_role('button', name='Cancel', exact=True).click()
    panel.get_by_role('button', name='Done', exact=True).click()
    assert not support.errors, support.errors
    context.close(); browser.close()
    print('PASS already-assigned cards are disabled and closing nested dialogs preserves parent navigation')
