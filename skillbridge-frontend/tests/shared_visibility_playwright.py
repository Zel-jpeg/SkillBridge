"""Shared records are visible through each program without splitting their batch."""
import json
import zipfile
from playwright.sync_api import expect, sync_playwright
from organization_playwright import BASE, OUT, api, errors, session


with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    context, page = session(browser)
    options = api(context, '/api/management/organization-options/').json()
    ic = next(row for row in options['institutes'] if row['code'] == 'IC')
    programs = [row for row in options['programs'] if row['institute_id'] == ic['id']]
    batches = api(context, '/api/instructor/batches/').json()
    mixed = next(row for row in batches if row['name'] == 'Existing IC mixed batch')
    roster = api(context, f'/api/instructor/batches/{mixed["id"]}/students/').json()['students']
    assert len(roster) == 2
    for program in programs:
        query = f'institute={ic["id"]}&program={program["id"]}'
        page.goto(BASE + '/admin/assessments?' + query, wait_until='networkidle')
        expect(page.get_by_role('button', name='View details for Synthetic IC mixed assessment', exact=True)).to_be_visible()
        expect(page.get_by_text('Shared across institute programs', exact=False).first).to_be_visible()
        page.goto(BASE + '/admin/assessments/archives?' + query, wait_until='networkidle')
        expect(page.get_by_text('Shared IC archived assessment', exact=True)).to_be_visible()
        page.goto(BASE + '/admin/batches?' + query + f'&batch_id={mixed["id"]}', wait_until='networkidle')
        expect(page.get_by_role('region', name='Selected batch', exact=True)).to_be_visible()
        expect(page.get_by_text('Shared institute batch · This is the full mixed-program roster.', exact=False)).to_be_visible()
        students = page.get_by_role('region', name='Batch students', exact=True)
        for learner in roster:
            expect(students.get_by_role('button', name=learner['name'], exact=True)).to_be_visible()
        page.get_by_role('button', name='Batch actions', exact=True).click()
        page.get_by_role('menuitem', name='Manage batch', exact=True).click()
        editor = page.get_by_role('dialog', name='Manage batch', exact=True)
        expect(editor).to_contain_text('Shared institute batch · No single program.')
        expect(editor.get_by_role('button', name='Review batch changes', exact=True)).to_be_disabled()
        editor.get_by_role('button', name='Cancel', exact=True).click()
        page.goto(BASE + '/admin/retake-requests?' + query, wait_until='networkidle')
        expect(page.get_by_text('2 requests', exact=True)).to_be_visible()
        page.get_by_role('button', name='Previous attempts', exact=True).click()
        expect(page.get_by_text('2 requests', exact=True)).to_be_visible()
        print(f'PASS {program["code"]}: shared assessment/archive, full two-program roster, current/history retakes')

        page.goto(BASE + '/admin/companies?' + query, wait_until='networkidle')
        expect(page.get_by_text('Synthetic IC legacy partner', exact=True).first).to_be_visible()
        admin_card = page.get_by_role('article', name='Synthetic IC legacy partner', exact=True)
        for label in ['Edit partner Synthetic IC legacy partner', 'Archive partner', 'Delete partner Synthetic IC legacy partner']:
            icon = admin_card.get_by_role('button', name=label, exact=True)
            expect(icon).to_be_enabled()
            assert icon.inner_text().strip() == '' and icon.locator('svg').count() == 1
        page.goto(BASE + '/admin/placements?' + query, wait_until='networkidle')
        expect(page.get_by_text('Synthetic IC legacy partner', exact=True).first).to_be_visible()
        history = api(context, f'/api/placements/?institute_id={ic["id"]}&program_id={program["id"]}').json()
        assert history['count'] == 1
        if program == programs[0]:
            page.get_by_role('button', name='Download reports', exact=True).click()
            with page.expect_download() as event:
                page.get_by_role('button', name='Download PDF', exact=True).click()
            pdf = OUT / 'shared-placement.pdf'
            event.value.save_as(pdf)
            assert b'institute-shared' in pdf.read_bytes() and b'rosters' in pdf.read_bytes()
            with page.expect_download() as event:
                page.get_by_role('button', name='Download XLSX', exact=True).click()
            workbook = OUT / 'shared-placement.xlsx'
            event.value.save_as(workbook)
            with zipfile.ZipFile(workbook) as archive:
                text = '\n'.join(archive.read(name).decode('utf-8') for name in archive.namelist() if name.endswith('.xml'))
                assert 'Roster scope' in text and 'institute-shared batch records' in text
            print('PASS actual placement PDF/XLSX disclose full shared batch scope without changing eligibility')
        page.goto(BASE + '/admin/dashboard?' + query, wait_until='networkidle')
        expect(page.get_by_text('Includes 1 shared-institute batches', exact=False)).to_be_visible()
        expect(page.get_by_role('button', name='Recommendation maintenance', exact=True)).to_have_count(0)
        page.goto(BASE + '/admin/placements?' + query, wait_until='networkidle')
        page.get_by_role('button', name='Recommendation maintenance', exact=True).click()
        picker = page.get_by_role('dialog', name='Recommendation maintenance', exact=True)
        choices = picker.get_by_role('combobox', name='Program', exact=True)
        expect(choices.locator(f'option[value="{program["id"]}"]')).to_have_attribute('disabled', '')
        choices.select_option('all')
        picker.get_by_role('button', name='Review refresh', exact=True).click()
        confirmation = page.get_by_role('dialog', name='Refresh recommendations?', exact=True)
        expect(confirmation).to_contain_text('All programs and shared batches')
        confirmation.get_by_role('button', name='Cancel', exact=True).click()
        picker.get_by_role('button', name='Cancel', exact=True).click()
        page.goto(BASE + f'/admin/reports?institute_id={ic["id"]}&program_id={program["id"]}', wait_until='networkidle')
        expect(page.get_by_label('Batch', exact=True).locator(f'option[value="{mixed["id"]}"]')).to_have_count(1)
        expect(page.get_by_role('region', name='Report scope', exact=True)).to_contain_text('full rosters; program views can overlap')
        with page.expect_download() as event:
            page.get_by_role('button', name='Download displayed CSV', exact=True).click()
        target = OUT / f'{program["code"]}-full-shared-roster.csv'
        event.value.save_as(target)
        text = target.read_text(encoding='utf-8-sig')
        assert all(learner['name'] in text for learner in roster)
        print(f'PASS {program["code"]}: shared catalog/placement history, dashboard and exported full roster; maintenance stays separate')

    enterprise, tourism, foreign = json.loads((OUT / 'general-text.json').read_text(encoding='utf-8'))
    for selected, sibling in ((enterprise, tourism), (tourism, enterprise)):
        query = f'institute={selected["institute_id"]}&program={selected["program_id"]}'
        page.goto(BASE + '/admin/assessments?' + query, wait_until='networkidle')
        expect(page.get_by_role('button', name='View details for Shared IBPA assessment', exact=True)).to_be_visible()
        expect(page.get_by_role('button', name='View details for ' + sibling['assessment_title'], exact=True)).to_have_count(0)
        expect(page.get_by_role('button', name='View details for Synthetic IC mixed assessment', exact=True)).to_have_count(0)
    page.goto(BASE + f'/admin/assessments?institute={foreign["institute_id"]}&program={foreign["program_id"]}', wait_until='networkidle')
    expect(page.get_by_role('button', name='View details for Shared IBPA assessment', exact=True)).to_have_count(0)
    print('PASS arbitrary non-IC shared assessment appears in both programs, excluding sibling-only and foreign institute records')

    for width in (320, 390, 768, 1440):
        page.set_viewport_size({'width': width, 'height': 900})
        page.goto(BASE + f'/admin/batches?institute={ic["id"]}&program={programs[0]["id"]}&batch_id={mixed["id"]}', wait_until='networkidle')
        page.evaluate('(dark) => document.documentElement.classList.toggle("dark",dark)', width == 390)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.screenshot(path=str(OUT / f'shared-full-roster-{width}.png'), full_page=True, animations='disabled')
    assert next(row for row in api(context, '/api/instructor/batches/').json() if row['id'] == mixed['id'])['program_id'] is None
    context.close()
    context, page = session(browser, 'instructor')
    for index, program in enumerate(programs):
        page.set_viewport_size({'width': 1440 if index == 0 else 390, 'height': 900})
        page.goto(BASE + f'/instructor/companies/manage?program_id={program["id"]}', wait_until='networkidle')
        selected = page.get_by_role('article').filter(has=page.get_by_role('heading', name='Synthetic IC legacy partner', exact=True))
        expect(selected.get_by_role('heading', name='Synthetic IC legacy opening', exact=True)).to_be_visible()
        expect(selected.get_by_text('IC shared batch eligibility', exact=True)).to_be_visible()
        selected.get_by_role('button', name='Show details for Synthetic IC legacy opening', exact=True).click()
        expect(selected.get_by_text(f'≥{55 if index == 0 else 60}%', exact=True)).to_be_visible()
        expect(selected.get_by_text('Legacy eligibility', exact=True)).to_have_count(0)
        expect(selected.get_by_role('button', name='Edit partner Synthetic IC legacy partner', exact=True)).to_be_visible()
        selected.get_by_role('button', name='Edit position Synthetic IC legacy opening', exact=True).click()
        editor = page.get_by_role('dialog', name='Edit Position', exact=True)
        editor.get_by_label('Position description').fill('Reviewed shared records duties.')
        editor.get_by_label('Custom percentage for Synthetic IC shared skill', exact=True).fill(str(60 + index * 5))
        editor.get_by_role('button', name='Save Changes', exact=True).click()
        expect(editor).to_have_count(0)
        expect(selected.get_by_text(f'≥{60 + index * 5}%', exact=True)).to_be_visible()
        expect(selected.get_by_role('button', name='Archive partner', exact=True)).to_be_enabled()
        expect(selected.get_by_role('button', name='Edit partner Synthetic IC legacy partner', exact=True)).to_be_enabled()
        protected_delete = selected.get_by_role('button', name='Delete partner Synthetic IC legacy partner', exact=True)
        expect(protected_delete).to_be_disabled()
        assert 'saved recommendations or placement records' in protected_delete.get_attribute('title')
        for action_name in ['Edit partner Synthetic IC legacy partner', 'Archive partner', 'Delete partner Synthetic IC legacy partner']:
            control = selected.get_by_role('button', name=action_name, exact=True)
            assert control.inner_text().strip() == ''
            assert control.locator('svg').count() == 1
        page.get_by_role('button', name='List view', exact=True).first.click()
        expect(selected.get_by_role('heading', name='Synthetic IC legacy partner', exact=True)).to_be_visible()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
        selected.screenshot(path=str(OUT / f'shared-card-actions-{program["code"]}.png'))
        print(f'PASS {program["code"]}: instructor edits shared position description/minimum, other program sees saved change, archive authority retained')
    context.close()
    browser.close()
    assert not errors, errors
    print('PASS four responsive full-roster widths, no reassignment and zero browser page errors')
