"""Program eligibility through the staff UI with a real isolated API."""
import re
import uuid

from playwright.sync_api import expect, sync_playwright

from organization_playwright import AUTH, BASE, OUT, checks, errors, session
from program_batches_playwright import call


def run(browser):
    context, page = session(browser, width=390, dark=True)
    programs = []
    for code, name in [('PORT', 'Port Operations'), ('FOOD', 'Food Production')]:
        institute = call(context, '/api/admin/institutes/', 'post', {'code': code, 'name': f'{name} Institute'}, status=201)
        programs.append(call(context, f'/api/admin/institutes/{institute["id"]}/programs/', 'post',
                             {'code': code, 'name': name}, status=201))
    port, food = programs
    parent = f'/api/admin/institutes/{port["institute_id"]}/programs/{port["id"]}/'
    call(context, parent + 'instructors/', 'post', {'instructor_id': AUTH['instructor']['user']['id']}, status=201)
    batch = call(context, '/api/instructor/batches/', 'post', {'name': 'Synthetic port cohort', 'program_id': port['id']},
                 role='instructor', status=201)
    enrollment = f'/api/instructor/batches/{batch["id"]}/enroll/'
    students = [{'name': 'Synthetic Port Learner', 'email': 'f09-port-learner@dnsc.edu.ph',
                 'school_id': '2099-00009', 'course': port['code']}]
    review = call(context, enrollment + 'preview/', 'post', {'students': students}, role='instructor')
    enrolled = call(context, enrollment, 'post', {'students': review['rows'], 'review_token': review['review_token'],
        'email_mode': 'later'}, role='instructor')
    assert len(enrolled['enrolled']) == 1, enrolled['summary']
    framework_url = f'/api/management/programs/{port["id"]}/frameworks/'
    rubric = call(context, framework_url, 'post', {'name': 'Port rubric', 'request_id': str(uuid.uuid4())},
                  role='instructor', status=201)
    category = call(context, framework_url + f'{rubric["id"]}/categories/', 'post', {
        'name': 'Cargo handling', 'description': 'Reviews cargo records and records transfer status.',
        'tags': ['Cargo transfer'],
    }, role='instructor', status=201)
    partner = call(context, '/api/admin/companies/', 'post', {'name': 'Synthetic Training Partner'}, status=201)
    positions = f'/api/admin/companies/{partner["id"]}/positions/'
    call(context, positions, 'post', {'title': 'Food program only', 'slots': 1, 'eligible_program_ids': [food['id']]}, status=201)

    page.goto(BASE + '/admin/companies', wait_until='networkidle')
    page.get_by_role('button', name='Add position to Synthetic Training Partner', exact=True).click()
    dialog = page.get_by_role('dialog', name='Add Position', exact=True)
    dialog.get_by_label('Position title').fill('Shared Training Slot')
    dialog.get_by_label('Available slots').fill('1')
    expect(dialog.get_by_text('All eligible programs share these slots.', exact=False)).to_be_visible()
    for program in programs:
        dialog.get_by_role('searchbox', name='Find an eligible program').fill(program['name'])
        dialog.get_by_role('checkbox', name=f'{program["code"]} · {program["name"]}', exact=True).check()
    expect(dialog.get_by_text('2 selected.', exact=False)).to_be_visible()
    dialog.get_by_role('combobox', name='Requirement program').select_option(str(port['id']))
    dialog.get_by_role('combobox', name='Competency framework', exact=True).select_option(str(rubric['id']))
    level = dialog.get_by_role('combobox', name='Minimum level for Cargo handling', exact=True)
    level.select_option('75')
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
    page.screenshot(path=str(OUT / 'shared-opening-phone-dark.png'), animations='disabled')
    dialog.get_by_role('button', name='Add Position', exact=True).click()
    expect(dialog).to_have_count(0)
    partners = call(context, '/api/admin/companies/')
    opening = next(row for row in partners[0]['positions'] if row['title'] == 'Shared Training Slot')
    assert opening['slots'] == 1 and {row['id'] for row in opening['eligible_programs']} == {port['id'], food['id']}
    assert opening['category_requirements'] == [{'category_id': category['id'], 'name': 'Cargo handling',
        'percentage': 75, 'framework_id': rubric['id'], 'program_id': port['id']}]
    checks.append('phone dark editor finds and saves two programs across institutes with one slot and one exact rubric')

    instructor, staff_page = session(browser, 'instructor')
    staff_page.goto(BASE + '/instructor/companies', wait_until='networkidle')
    partner_card = staff_page.get_by_role('button', name=re.compile('Synthetic Training Partner'))
    partner_card.click()
    expect(staff_page.get_by_text('Shared Training Slot', exact=True)).to_be_visible()
    expect(staff_page.get_by_text('Food program only', exact=True)).to_have_count(0)
    expect(staff_page.get_by_role('button', name=re.compile('Edit (partner|company|position)', re.I))).to_have_count(0)
    checks.append('instructor browses the shared opening while other programs and catalog edit controls stay out of view')

    placements, placement_page = session(browser)
    placement_page.goto(BASE + '/admin/placements', wait_until='networkidle')
    placement_page.get_by_role('button', name='Manual assignment', exact=True).click()
    placement_page.get_by_role('button', name=re.compile('Synthetic Port Learner')).click()
    expect(placement_page.get_by_role('button', name=re.compile('Food program only'))).to_have_count(0)
    placement_page.get_by_role('button', name=re.compile('Shared Training Slot')).click()
    placement_page.get_by_role('button', name='Assign student', exact=True).click()
    expect(placement_page.get_by_role('heading', name='Manual placement assignment')).to_have_count(0)
    allocation = call(placements, '/api/placements/suggestions/?include_placed=true')
    assert any(item['position']['id'] == opening['id'] for item in allocation['approved_placements'])
    checks.append('manual assignment offers the shared opening, hides an ineligible opening and saves the one approval')
    placements.close()

    page.get_by_role('button', name='Edit position Shared Training Slot', exact=True).click()
    dialog = page.get_by_role('dialog', name='Edit Position', exact=True)
    expect(dialog.get_by_role('combobox', name='Competency framework', exact=True)).to_have_value(str(rubric['id']))
    expect(dialog.get_by_role('combobox', name='Minimum level for Cargo handling')).to_have_value('75')
    for program in programs:
        dialog.get_by_role('button', name=f'Remove {program["code"]} {program["name"]}', exact=True).click()
    dialog.get_by_role('button', name='Save Changes', exact=True).click()
    expect(dialog).to_have_count(0)
    expect(page.get_by_text('Closed to new placements', exact=True)).to_be_visible()
    assert call(context, '/api/instructor/companies/', role='instructor') == []
    instructor.close()
    instructor, staff_page = session(browser, 'instructor')
    staff_page.goto(BASE + '/instructor/companies', wait_until='networkidle')
    expect(staff_page.get_by_text('No partners found', exact=True)).to_be_visible()
    checks.append('reopening retains exact levels; clearing eligibility closes the opening in admin and instructor views')
    context.close()
    instructor.close()


if __name__ == '__main__':
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel='chrome', headless=True)
        run(browser)
        browser.close()
    assert not errors, errors
    for check in checks:
        print(f'PASS {check}')
