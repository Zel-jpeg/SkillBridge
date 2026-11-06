"""Coordinator catalog journeys against the real isolated API and production UI."""
import re
import uuid
from io import BytesIO
from PIL import Image
from urllib.parse import urlparse
from playwright.sync_api import expect, sync_playwright
from organization_playwright import API, AUTH, BASE, OUT, checks, errors, session
from program_batches_playwright import call, setup_services


def setup(browser):
    context, _ = session(browser)
    institute = call(context, '/api/admin/institutes/', 'post', {'code': 'CATALOG', 'name': 'Synthetic Catalog Institute'}, status=201)
    base = f'/api/admin/institutes/{institute["id"]}/programs/'
    programs = []
    for index in range(10):
        program = call(context, base, 'post', {'code': f'CAT{index}', 'name': f'Configurable Program {index:02}'}, status=201)
        call(context, base + f'{program["id"]}/instructors/', 'post', {'instructor_id': AUTH['instructor']['user']['id']}, status=201)
        programs.append(program)
    program = programs[0]
    grant = call(context, base + f'{program["id"]}/instructors/', 'post', {'instructor_id': AUTH['other_instructor']['user']['id']}, status=201)
    scoped = f'/api/management/programs/{program["id"]}/'
    framework = call(context, scoped + 'frameworks/', 'post', {'name': 'Reviewed catalog framework', 'request_id': str(uuid.uuid4())}, role='instructor', status=201)
    category = call(context, scoped + f'frameworks/{framework["id"]}/categories/', 'post', {'name': 'Service knowledge', 'description': 'Understands the steps for supporting clients.', 'tags': ['Client records']}, role='instructor', status=201)
    assert not any(row.get('program_id') == program['id'] for row in call(context, '/api/instructor/batches/', role='instructor'))
    context.close()
    return program, programs[1], framework, category, base, grant


def open_workspace(page, program):
    page.goto(BASE + f'/instructor/companies/manage?program_id={program["id"]}', wait_until='networkidle')
    expect(page.get_by_role('heading', name='Partner & position management', exact=True)).to_be_visible()
    expect(page.get_by_role('button', name='Add partner', exact=True)).to_be_visible()


def create_partner(page, name):
    page.get_by_role('button', name='Add partner', exact=True).click()
    dialog = page.get_by_role('dialog', name='Add Partner', exact=True)
    dialog.get_by_label('Organization name', exact=True).fill(name)
    return dialog


def opening(page, framework, title):
    dialog = page.get_by_role('dialog', name='Add Position', exact=True)
    dialog.get_by_label('Position title').fill(title)
    dialog.get_by_label('Available slots').fill('3')
    dialog.get_by_role('combobox', name='Competency framework', exact=True).select_option(str(framework['id']))
    dialog.get_by_label('Minimum level for Service knowledge', exact=True).select_option('50')
    dialog.get_by_role('button', name='Suggest / refresh tags', exact=True).click()
    expect(dialog.get_by_label('Position tags', exact=True)).to_have_value('Client records')
    return dialog


def run(browser):
    program, foreign, framework, category, program_base, grant = setup(browser)
    scoped = f'/api/management/programs/{program["id"]}/'
    context, page = session(browser, 'instructor')
    setup_services(context)
    context.route('**/storage/v1/object/public/**', lambda route: route.fulfill(
        body=(OUT / 'synthetic-images' / urlparse(route.request.url).path.split('/')[-1]).read_bytes(), content_type='image/webp'))
    page.goto(BASE + '/instructor/companies', wait_until='networkidle')
    page.get_by_role('link', name='Manage partners & positions').click()
    expect(page.get_by_text('Select an assigned program to manage its partners and positions.', exact=True)).to_be_visible()
    page.get_by_role('button', name='Next →', exact=True).click()
    expect(page.get_by_text('Showing 9–10 of 10', exact=True)).to_be_visible()
    page.get_by_role('searchbox', name='Search assigned programs').fill(program['name'])
    page.get_by_role('radio', name=re.compile(program['name'])).click()
    expect(page.get_by_role('radio', name=re.compile(program['name']))).to_be_checked()
    expect(page.get_by_text('No partners match this view.', exact=False)).to_be_visible()
    checks.append('assigned program search and pagination; empty catalog before any program batch')

    dialog = create_partner(page, 'Cancelled catalog partner')
    page.keyboard.press('Escape')
    discard = page.get_by_role('dialog', name='Discard partner changes?', exact=True)
    discard.get_by_role('button', name='Cancel', exact=True).click()
    expect(dialog.get_by_label('Organization name', exact=True)).to_have_value('Cancelled catalog partner')
    dialog.get_by_role('button', name='Cancel', exact=True).click()
    discard.get_by_role('button', name='Discard changes', exact=True).click()
    expect(dialog).to_have_count(0)
    expect(page.get_by_role('button', name='Add partner', exact=True)).to_be_focused()
    assert call(context, scoped + 'partners/?search=Cancelled', role='instructor')['count'] == 0
    checks.append('partner discard confirmation, Escape, retained input and restored keyboard focus')

    dialog = create_partner(page, 'Coordinator Service Partner')
    dialog.get_by_label('Latitude', exact=True).fill('7.3')
    dialog.get_by_role('button', name='Create partner', exact=True).click()
    expect(dialog.get_by_role('alert')).to_contain_text('both valid latitude and longitude')
    dialog.get_by_label('Longitude', exact=True).fill('125.7')
    dialog.get_by_label('Street / Building / Unit', exact=True).fill('Synthetic service road')
    dialog.get_by_role('button', name='Create partner', exact=True).click()
    expect(dialog).to_have_count(0)
    selected = page.get_by_role('region', name='Selected partner', exact=True)
    expect(selected.get_by_role('heading', name='Coordinator Service Partner', exact=True)).to_be_visible()
    partner = call(context, scoped + 'partners/?search=Coordinator', role='instructor')['results'][0]
    assert partner['lat'] == 7.3 and partner['lng'] == 125.7 and partner['address']['street'] == 'Synthetic service road'
    selected.get_by_role('button', name='Edit partner', exact=True).click()
    dialog = page.get_by_role('dialog', name='Edit Partner', exact=True)
    dialog.locator('input[type=file]').set_input_files({'name': 'corrupt.png', 'mimeType': 'image/png', 'buffer': b'not an image'})
    dialog.get_by_role('button', name='Save Changes', exact=True).click()
    expect(dialog.get_by_role('alert')).to_contain_text('corrupt')
    assert not list((OUT / 'synthetic-images').iterdir())
    image = BytesIO()
    Image.new('RGB', (40, 30), '#117744').save(image, format='PNG')
    dialog.locator('input[type=file]').set_input_files({'name': 'synthetic.png', 'mimeType': 'image/png', 'buffer': image.getvalue()})
    dialog.get_by_role('button', name='Save Changes', exact=True).click()
    expect(dialog).to_have_count(0)
    partner = call(context, scoped + f'partners/{partner["id"]}/', role='instructor')
    assert partner['image_url'] and len(list((OUT / 'synthetic-images').iterdir())) == 1
    selected.get_by_role('button', name='Edit partner', exact=True).click()
    dialog.get_by_role('button', name='Remove image', exact=True).click()
    dialog.get_by_role('button', name='Save Changes', exact=True).click()
    expect(dialog).to_have_count(0)
    assert not call(context, scoped + f'partners/{partner["id"]}/', role='instructor')['image_url']
    assert not list((OUT / 'synthetic-images').iterdir())
    checks.append('real multipart image validation, WebP conversion, saved reference and removal using isolated object transport')
    selected.get_by_role('button', name='Add position', exact=True).click()
    dialog = opening(page, framework, 'Service Records Intern')
    dialog.get_by_role('button', name='Cancel', exact=True).click()
    page.get_by_role('dialog', name='Discard position changes?', exact=True).get_by_role('button', name='Cancel', exact=True).click()
    dialog.get_by_role('button', name='Add Position', exact=True).click()
    expect(dialog).to_have_count(0)
    expect(selected.get_by_text('Service knowledge ≥ 50%', exact=False)).to_be_visible()
    partner = call(context, scoped + f'partners/{partner["id"]}/', role='instructor')
    position = partner['positions'][0]
    assert position['category_requirements'][0]['category_id'] == category['id'] and position['tags'] == ['Client records']
    checks.append('real partner create with validated manual pin; fixed program opening with numerical framework requirements and saved tags')

    selected.get_by_role('button', name='Edit partner', exact=True).click()
    dialog = page.get_by_role('dialog', name='Edit Partner', exact=True)
    dialog.get_by_label('Organization name', exact=True).fill('Unsaved stale name')
    call(context, scoped + f'partners/{partner["id"]}/', 'patch', {'revision': partner['revision'], 'address': {'street': 'Updated concurrently'}}, role='instructor')
    dialog.get_by_role('button', name='Save Changes', exact=True).click()
    expect(dialog.get_by_role('alert')).to_contain_text('changed')
    expect(dialog.get_by_label('Organization name', exact=True)).to_have_value('Unsaved stale name')
    expect(dialog.get_by_role('button', name='Save Changes', exact=True)).to_be_disabled()
    dialog.get_by_role('button', name='Check saved records', exact=True).click()
    dialog.get_by_role('button', name='Load saved version and replace unsaved input', exact=True).click()
    expect(dialog.get_by_label('Organization name', exact=True)).to_have_value('Coordinator Service Partner')
    dialog.get_by_label('Organization name', exact=True).fill('Coordinator Service Partner Updated')
    dialog.get_by_role('button', name='Save Changes', exact=True).click()
    expect(dialog).to_have_count(0)
    checks.append('concurrent stale revision rejected; draft retained; explicit latest-version review and successful edit')

    # Simulate response loss after a real successful POST, then inspect persisted records.
    attempts = []
    def lose_response(route):
        if route.request.method != 'POST':
            return route.fallback()
        attempts.append(route.request.url)
        response = route.fetch(url=API + urlparse(route.request.url).path)
        assert response.status == 201
        route.fulfill(status=503, json={'error': 'Synthetic lost response'})
    page.route('**' + scoped + 'partners/', lose_response)
    dialog = create_partner(page, 'Saved despite lost response')
    dialog.get_by_role('button', name='Create partner', exact=True).click()
    expect(dialog.get_by_role('button', name='Check saved records', exact=True)).to_be_visible()
    expect(dialog.get_by_label('Organization name', exact=True)).to_have_value('Saved despite lost response')
    expect(dialog.get_by_role('button', name='Create partner', exact=True)).to_be_disabled()
    dialog.get_by_role('button', name='Check saved records', exact=True).click()
    expect(dialog.get_by_text(re.compile('Current records:.*Saved despite lost response'))).to_be_visible()
    assert len(attempts) == 1
    dialog.get_by_role('button', name='Close and review catalog', exact=True).click()
    page.unroute('**' + scoped + 'partners/', lose_response)
    assert call(context, scoped + 'partners/?search=Saved despite', role='instructor')['count'] == 1
    checks.append('real successful POST with lost response: no automatic replay, preserved draft and read-only recovery finds one saved record')

    # Server pagination and filter reset are exercised with actual persisted rows.
    for index in range(9):
        call(context, scoped + 'partners/', 'post', {'name': f'Paging Partner {index:02}'}, role='instructor', status=201)
    page.reload(wait_until='networkidle')
    page.get_by_role('region', name='Program partner catalog', exact=True).get_by_role('button', name='Next →', exact=True).click()
    expect(page.get_by_text('Showing 9–11 of 11', exact=True)).to_be_visible()
    page.get_by_role('searchbox', name='Search partners', exact=True).fill('Coordinator Service')
    expect(page.get_by_text('1 matching partners', exact=True)).to_be_visible()
    page.get_by_role('button', name=re.compile('Coordinator Service Partner Updated')).click()
    selected = page.get_by_role('region', name='Selected partner', exact=True)
    selected.get_by_role('button', name='Archive Service Records Intern', exact=True).click()
    page.get_by_role('dialog', name='Archive position?', exact=True).get_by_role('button', name='Archive', exact=True).click()
    expect(selected.get_by_role('button', name='Restore Service Records Intern', exact=True)).to_be_visible()
    selected.get_by_role('button', name='Restore Service Records Intern', exact=True).click()
    page.get_by_role('dialog', name='Restore position?', exact=True).get_by_role('button', name='Restore', exact=True).click()
    selected.get_by_role('button', name='Archive partner', exact=True).click()
    page.get_by_role('dialog', name='Archive partner?', exact=True).get_by_role('button', name='Archive', exact=True).click()
    expect(page.get_by_text('0 matching partners', exact=True)).to_be_visible()
    page.get_by_role('combobox', name='Partner status', exact=True).select_option('archived')
    expect(page.get_by_text('1 matching partners', exact=True)).to_be_visible()
    selected.get_by_role('button', name='Restore partner', exact=True).click()
    page.get_by_role('dialog', name='Restore partner?', exact=True).get_by_role('button', name='Restore', exact=True).click()
    expect(page.get_by_role('dialog', name='Restore partner?', exact=True)).to_have_count(0)
    checks.append('real paginated catalog, search resets page, position/partner archive and restore with active/archived filters')

    admin_opening = f'/api/admin/positions/{position["id"]}/'
    detail = scoped + f'partners/{partner["id"]}/'
    catalog_change = """url => window.dispatchEvent(new CustomEvent('sse:data_changed',
        {detail: {topics: ['catalog'], urls: [url], handled: false}}))"""
    call(context, admin_opening, 'patch', {'eligible_program_ids': [], 'category_requirements': []})
    page.evaluate(catalog_change, detail)
    expect(selected.get_by_text('Closed to new placements', exact=False)).to_be_visible()
    expect(selected.get_by_text('Eligible programs: None', exact=True)).to_be_visible()
    expect(selected.get_by_text('manual placement only', exact=False)).to_have_count(0)
    expect(selected.get_by_role('button', name='Edit Service Records Intern', exact=True)).to_have_count(0)
    call(context, admin_opening, 'patch', {'eligible_program_ids': [program['id']],
         'category_requirements': [{'category_id': category['id'], 'percentage': 50}]})
    page.evaluate(catalog_change, detail)
    expect(selected.get_by_role('button', name='Edit Service Records Intern', exact=True)).to_be_visible()
    checks.append('administrator closes program eligibility; creator sees closed, read-only position until administrator reopens it')
    context.close()

    context, page = session(browser, 'other_instructor', width=390, dark=True)
    setup_services(context)
    open_workspace(page, program)
    page.get_by_role('searchbox', name='Search partners', exact=True).fill('Coordinator Service')
    page.get_by_role('button', name=re.compile('Coordinator Service Partner Updated')).click()
    selected = page.get_by_role('region', name='Selected partner', exact=True)
    expect(selected.get_by_role('button', name='Edit partner', exact=True)).to_have_count(0)
    expect(selected.get_by_role('button', name='Edit Service Records Intern', exact=True)).to_have_count(0)
    selected.get_by_role('button', name='Add position', exact=True).click()
    dialog = opening(page, framework, 'Peer Coordinator Opening')
    assert dialog.evaluate('el => el.contains(document.activeElement)')
    page.screenshot(path=str(OUT / 'coordinator-position-phone-dark.png'), animations='disabled')
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
    dialog.get_by_role('button', name='Add Position', exact=True).click()
    expect(dialog).to_have_count(0)
    expect(selected.get_by_role('button', name='Edit Peer Coordinator Opening', exact=True)).to_be_visible()
    assert not call(context, scoped + f'partners/{partner["id"]}/', role='other_instructor')['can_edit']
    checks.append('same-program peer can reuse organization and create own opening; cannot edit creator records; phone dark layout and focus')

    # Revocation while an editor is open must remove restricted controls and cached records.
    selected.get_by_role('button', name='Edit Peer Coordinator Opening', exact=True).click()
    expect(page.get_by_role('dialog', name='Edit Position', exact=True)).to_be_visible()
    call(context, program_base + f'{program["id"]}/instructors/{grant["id"]}/', 'patch', {'is_active': False})
    page.evaluate("url => window.dispatchEvent(new CustomEvent('sse:data_changed', {detail: {topics: ['scope'], urls: [url], handled: false}}))", scoped)
    expect(page.get_by_role('dialog', name='Edit Position', exact=True)).to_have_count(0)
    expect(page.get_by_role('button', name='Add partner', exact=True)).to_have_count(0)
    call(context, scoped + 'partners/', role='other_instructor', status=404)
    checks.append('revoked program access closes open editor, removes cached catalog and denies direct API access')
    context.close()

    context, page = session(browser, 'instructor', width=390)
    setup_services(context)
    open_workspace(page, foreign)
    page.get_by_role('button', name='Reuse existing partner', exact=True).click()
    dialog = page.get_by_role('dialog', name='Reuse existing partner', exact=True)
    dialog.get_by_role('searchbox', name='Search organizations', exact=True).fill('Coordinator Service')
    expect(dialog.get_by_text('Service Records Intern', exact=True)).to_have_count(0)
    dialog.get_by_role('button', name=re.compile('Add opening at Coordinator Service')).click()
    dialog = page.get_by_role('dialog', name='Add Position', exact=True)
    dialog.get_by_label('Position title').fill('Separate Program Opening')
    dialog.get_by_role('button', name='Add Position', exact=True).click()
    expect(dialog).to_have_count(0)
    selected = page.get_by_role('region', name='Selected partner', exact=True)
    expect(selected.get_by_text('Separate Program Opening', exact=True)).to_be_visible()
    expect(selected.get_by_text('Service Records Intern', exact=True)).to_have_count(0)
    expect(selected.get_by_role('button', name='Edit partner', exact=True)).to_have_count(0)
    page.screenshot(path=str(OUT / 'coordinator-reuse-phone-light.png'), full_page=True, animations='disabled')
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
    checks.append('explicit cross-program organization reuse exposes no foreign openings; distinct scoped opening and administrator-only shared metadata')
    context.close()


if __name__ == '__main__':
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel='chrome', headless=True)
        try:
            run(browser)
        except Exception:
            for index, context in enumerate(browser.contexts):
                for number, page in enumerate(context.pages):
                    page.screenshot(path=str(OUT / f'failure-{index}-{number}.png'), full_page=True)
                    (OUT / f'failure-{index}-{number}.html').write_text(page.content(), encoding='utf-8')
            raise
        finally:
            browser.close()
    assert not errors, errors
    for check in checks:
        print('PASS ' + check)
