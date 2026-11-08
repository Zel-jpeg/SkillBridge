"""Synthetic real-API checks for collection hierarchy, controls and parent navigation."""
import json
from playwright.sync_api import expect, sync_playwright
from organization_playwright import BASE, OUT, errors, session


def toolbar_geometry(page, root=None, same_row=True):
    root = root or page
    toolbar = root.locator('.sb-collection-toolbar').first
    expect(toolbar).to_be_visible()
    controls = toolbar.locator('input:not([type=checkbox]):not([type=radio]), select, .sb-collection-view, .sb-roster-filter-trigger')
    boxes = [item.bounding_box() for item in controls.all() if item.is_visible()]
    assert boxes, 'Expected collection controls'
    assert all(abs(box['height'] - 44) <= 1 for box in boxes), boxes
    if same_row:
        bottoms = [box['y'] + box['height'] for box in boxes]
        assert max(bottoms) - min(bottoms) <= 1, boxes
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), page.url


with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    enterprise, tourism, _ = json.loads((OUT / 'general-text.json').read_text(encoding='utf-8'))
    scope = f"?institute={tourism['institute_id']}&program={tourism['program_id']}"
    context, page = session(browser)
    page.goto(BASE + '/admin/institutes', wait_until='networkidle')
    expect(page.get_by_role('heading', name='Institutes & Programs', exact=True)).to_have_count(1)
    expect(page.get_by_role('button', name='Back to institutes', exact=True)).to_have_count(0)
    toolbar_geometry(page)
    page.get_by_role('searchbox', name='Search by name or code').fill('Business and Public Affairs')
    page.get_by_role('button', name='Manage programs in Institute of Business and Public Affairs', exact=True).click()
    expect(page.get_by_role('heading', name='Institutes & Programs', exact=True)).to_have_count(1)
    expect(page.get_by_role('heading', name='Institute of Business and Public Affairs', exact=True)).to_have_count(0)
    expect(page.get_by_text('Manage the programs belonging to IBPA.', exact=True)).to_have_count(0)
    toolbar_geometry(page)
    page.screenshot(path=str(OUT / 'program-toolbar-desktop.png'), animations='disabled')
    page.get_by_role('button', name='List view', exact=True).click()
    expect(page.get_by_role('heading', name=tourism['name'], exact=True)).to_be_visible()
    page.get_by_label('Status', exact=True).select_option('active')
    expect(page.get_by_role('heading', name=tourism['name'], exact=True)).to_be_visible()
    page.get_by_role('searchbox').fill('no matching program')
    expect(page.get_by_text('No programs match these filters.', exact=True)).to_be_visible()
    page.get_by_role('button', name='Clear filters', exact=True).first.click()
    expect(page.get_by_role('heading', name=tourism['name'], exact=True)).to_be_visible()
    print('PASS one page heading, no repeated institute description, aligned search/status/view, filter and view preservation')

    page.get_by_role('button', name=f"Manage instructors for {tourism['name']}", exact=True).click()
    dialog = page.get_by_role('dialog', name='Program instructors', exact=True)
    toolbar_geometry(page, dialog)
    dialog.get_by_role('button', name='Assign instructor', exact=True).click()
    picker = page.get_by_role('dialog', name='Assign instructor', exact=True)
    toolbar_geometry(page, picker)
    picker.get_by_role('button', name='Cancel', exact=True).click()
    dialog.get_by_role('button', name='Done', exact=True).click()
    page.get_by_role('navigation', name='Institute and program path').get_by_role('button', name='All institutes', exact=True).press('Enter')
    expect(page.get_by_role('searchbox', name='Search by name or code')).to_be_visible()
    print('PASS instructor assignment dialog toolbars and institute breadcrumb return action')

    for path in ('/admin/batches', '/admin/assessments', '/admin/assessments/archives', '/admin/companies', '/admin/placements'):
        page.goto(BASE + path + scope, wait_until='networkidle')
        toolbar_geometry(page)
        trail = page.get_by_role('navigation', name='Institute and program path')
        expect(trail.get_by_role('link', name='Back to programs', exact=True)).to_have_count(0)
        back = trail.get_by_role('link', name='Institute of Business and Public Affairs', exact=True)
        expect(back).to_have_attribute('href', path + f"?institute={tourism['institute_id']}")
        back.press('Enter')
        expect(trail.get_by_role('link', name='All institutes', exact=True)).to_be_visible()
    print('PASS aligned toolbars and breadcrumb parent destinations across five scoped workspaces')

    page.goto(BASE + '/admin/batches' + scope, wait_until='networkidle')
    page.get_by_role('button', name=tourism['batch_name'], exact=False).click()
    toolbar_geometry(page)
    page.goto(BASE + '/admin/users', wait_until='networkidle')
    toolbar_geometry(page)
    page.get_by_role('searchbox', name='Search users', exact=True).fill('no matching synthetic user')
    expect(page.get_by_text('No users match your filters.', exact=True)).to_be_visible()
    page.get_by_role('region', name='User filters', exact=True).get_by_role('button', name='Clear filters', exact=True).click()
    print('PASS batch roster toolbar and shared grouped-filter search/view layout and reset')

    page.goto(BASE + '/admin/competencies' + f"?institute={tourism['institute_id']}", wait_until='networkidle')
    expect(page.get_by_role('heading', name='Institute of Business and Public Affairs', exact=True)).to_have_count(0)
    page.get_by_role('link', name=tourism['name'], exact=True).click()
    expect(page.get_by_role('button', name='Skill set versions', exact=True)).to_have_count(0)
    expect(page.get_by_text('More options', exact=True)).to_have_count(0)
    page.get_by_role('navigation', name='Taxonomy path').get_by_role('link', name='Institute of Business and Public Affairs', exact=True).click()
    expect(page.get_by_role('region', name='Skill libraries', exact=True)).to_be_visible()
    print('PASS taxonomy removes repeated institute heading and opens the skill library without version controls')
    context.close()

    context, page = session(browser, 'instructor')
    page.goto(BASE + f"/instructor/companies/manage?program_id={enterprise['program_id']}", wait_until='networkidle')
    toolbar_geometry(page)
    page.goto(BASE + '/instructor/competencies?program=shared', wait_until='networkidle')
    page.get_by_role('navigation', name='Taxonomy path').get_by_role('link', name='All skill libraries', exact=True).click()
    expect(page.get_by_role('region', name='Skill libraries', exact=True)).to_be_visible()
    print('PASS instructor partner toolbar and role-specific return destination')
    page.goto(BASE + '/instructor/reports', wait_until='networkidle')
    records = page.get_by_role('region', name='Analytics records', exact=True)
    toolbar_geometry(page, records)
    print('PASS shared report records retain aligned search, sort and view controls in the instructor view')
    context.close()

    for dark in (False, True):
        context, page = session(browser, width=390, dark=dark, mobile=True)
        for width in (320, 390, 768, 1440):
            page.set_viewport_size({'width': width, 'height': 900})
            page.goto(BASE + '/admin/institutes', wait_until='networkidle')
            page.get_by_role('searchbox').fill('Business and Public Affairs')
            page.get_by_role('button', name='Manage programs in Institute of Business and Public Affairs', exact=True).click()
            toolbar_geometry(page, same_row=width >= 768)
            page.screenshot(path=str(OUT / f'program-toolbar-{width}-{dark}.png'), animations='disabled')
            for path in ('/admin/batches', '/admin/placements', '/admin/users'):
                page.goto(BASE + path + (scope if path != '/admin/users' else ''), wait_until='networkidle')
                toolbar_geometry(page, same_row=width >= 1440)
        context.close()
        print(f'PASS responsive toolbar heights, wrapping and no overflow at four widths, dark={dark}')
    browser.close()
    assert not errors, errors
    print('PASS zero page errors')
