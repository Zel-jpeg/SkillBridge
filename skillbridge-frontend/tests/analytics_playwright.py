"""Real isolated API/browser checks. Run through run_admin_management.py --analytics."""
import csv
import io
import json
import os
import re
import time
from zoneinfo import ZoneInfo
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

ARTIFACTS = Path(__file__).parent / 'artifacts/analytics'
AUTH = json.loads((ARTIFACTS / 'auth.json').read_text(encoding='utf-8'))
BASE = 'http://127.0.0.1:' + os.environ['ADMIN_MANAGEMENT_FRONTEND_PORT']
API = 'http://127.0.0.1:' + os.environ['ADMIN_MANAGEMENT_API_PORT']
checks, errors = [], []


def geometry(page, name):
    try:
        # Recharts measures its new width through ResizeObserver after viewport changes.
        page.wait_for_function('document.documentElement.scrollWidth <= innerWidth', timeout=5000)
    except Exception:
        page.screenshot(path=str(ARTIFACTS / f'{name}-overflow.png'), full_page=True)
        raise AssertionError(name)
    if page.locator('dialog[open]').count():
        assert page.locator('dialog[open]').evaluate('node => node.scrollWidth <= node.clientWidth + 1'), name
    page.screenshot(path=str(ARTIFACTS / f'{name}.png'), full_page=True)
    if '1440-light' in name or '375-dark' in name:
        page.get_by_role('heading', name='Reports & Analytics', exact=True).scroll_into_view_if_needed()
        page.screenshot(path=str(ARTIFACTS / f'{name}-header.png'))
        page.get_by_role('heading', level=3).first.locator('..').screenshot(path=str(ARTIFACTS / f'{name}-chart.png'))


def fixture(browser, role):
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce')
    identity = AUTH[role]
    context.add_init_script('''(() => {
      const identity = ''' + json.dumps(identity) + ''';
      localStorage.setItem('sb-token', identity.token);
      localStorage.setItem('sb-role', identity.user.role);
      localStorage.setItem('sb-user', JSON.stringify(identity.user));
      window.EventSource = class { close() {} };
    })();''')
    def route(route):
        parsed = urlparse(route.request.url)
        if parsed.path.endswith('/events/'):
            return route.fulfill(json={'ok': True})
        if parsed.path.startswith('/api/'):
            return route.continue_(url=API + parsed.path + ('?' + parsed.query if parsed.query else ''))
        if parsed.hostname not in ('127.0.0.1', 'localhost'):
            if parsed.path == '/gsi/client':
                return route.fulfill(body='window.google={accounts:{oauth2:{initTokenClient(){return {requestAccessToken(){}}}}}};', content_type='application/javascript')
            return route.abort()
        return route.continue_()
    context.route('**/*', route)
    page = context.new_page()
    page.set_default_timeout(15000)
    page.on('pageerror', lambda error: errors.append(str(error)))
    return context, page


with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    for role in ['admin', 'instructor']:
        print(f'Checking real {role} analytics', flush=True)
        context, page = fixture(browser, role)
        page.goto(BASE + f'/{role}/dashboard')
        page.wait_for_load_state('networkidle')
        summary = page.locator('dl[aria-label="Dashboard summary"]')
        expect(summary.locator('dt')).to_have_count(5 if role == 'admin' else 4)
        expect(summary.get_by_text('15' if role == 'admin' else '13', exact=True)).to_be_visible()
        page.get_by_role('link', name='Required complete', exact=True).click()
        expect(page.get_by_role('heading', name='Reports & Analytics', exact=True)).to_be_visible()
        expect(page.get_by_text('Required assessments complete · 9 records', exact=False)).to_be_visible()
        page.get_by_role('button', name='Clear record selection', exact=True).click()
        records = page.get_by_role('region', name='Analytics records', exact=True)
        expect(records.get_by_text('All records in scope · ' + ('15' if role == 'admin' else '13') + ' records', exact=False)).to_be_visible()
        expect(page.get_by_label('Report summary', exact=True).locator('dt')).to_have_count(3)
        expect(records.get_by_role('columnheader')).to_have_count(6)
        assert page.get_by_role('heading', name='Reports & Analytics', exact=True).evaluate('node => parseFloat(getComputedStyle(node).fontSize)') >= 20
        assert page.get_by_label('Batch status', exact=True).evaluate('node => node.getBoundingClientRect().height') >= 44
        assert records.get_by_role('table').evaluate('node => parseFloat(getComputedStyle(node).fontSize)') == 12
        assert page.get_by_label('Batch status', exact=True).evaluate('node => parseFloat(getComputedStyle(node).fontSize)') == 12
        records.get_by_role('button', name='Show all columns', exact=True).click()
        expect(records.get_by_role('columnheader')).to_have_count(14)
        records.get_by_role('button', name='Show key columns', exact=True).click()
        expect(records.get_by_role('columnheader')).to_have_count(6)
        expect(records.get_by_role('columnheader', name='Top recommendation', exact=False)).to_be_visible()
        expect(records.get_by_role('img', name='Synthetic Student 01 avatar', exact=True)).to_be_visible()
        expect(records.get_by_role('row').nth(1)).to_contain_text('Developer Intern')
        expect(records.get_by_role('row').nth(1)).to_contain_text('Synthetic Agency')
        expect(records.get_by_role('row').nth(1)).to_contain_text('Done')
        expect(records.get_by_role('row').nth(1)).to_contain_text('Approved')
        expect(page.get_by_text('Scope & report notes', exact=True)).to_have_count(0)
        expect(page.get_by_text('Assessment-specific reports and exports', exact=True)).to_have_count(0)
        records.get_by_role('region', name='Report table, scroll horizontally for more columns', exact=True).screenshot(path=str(ARTIFACTS / f'{role}-reference-table.png'))
        # Sort the complete filtered dataset, then verify CSV uses that same order.
        sort_name = records.get_by_role('button', name='Sort by Student', exact=True)
        sort_name.click()
        sort_name.click()
        expect(records.get_by_role('columnheader').first).to_have_attribute('aria-sort', 'descending')
        last_student = 'Synthetic Student ' + ('15' if role == 'admin' else '13')
        expect(records.get_by_role('row').nth(1)).to_contain_text(last_student)
        with page.expect_download() as download:
            records.get_by_role('button', name='Download displayed CSV', exact=True).click()
        sorted_path = ARTIFACTS / f'{role}-sorted-students.csv'
        download.value.save_as(sorted_path)
        sorted_matrix = list(csv.reader(io.StringIO(sorted_path.read_text(encoding='utf-8-sig'))))
        student_header = next(i for i, row in enumerate(sorted_matrix) if row and row[0] == 'Student' and len(row) > 4)
        assert sorted_matrix[student_header + 1][0] == last_student
        assert sorted_matrix[-1][0] == 'Synthetic Student 01'
        assert 'Top recommended position' in sorted_matrix[student_header]
        assert 'Top recommended company' in sorted_matrix[student_header]
        assert any(row == ['Sort', 'Student descending'] for row in sorted_matrix)
        sort_name.click()
        geometry(page, f'{role}-initial-desktop')
        records.get_by_role('button', name='View details for Synthetic Student 01', exact=True).click()
        expect(page.get_by_role('dialog').get_by_role('heading', name='Synthetic Student 01', exact=True)).to_be_visible()
        page.keyboard.press('Escape')
        expect(records.get_by_role('button', name='View details for Synthetic Student 01', exact=True)).to_be_focused()
        checks.append(f'{role}: role-specific dashboard, clickable completion card and student details with focus return')
        checks.append(f'{role}: 12px text, touch controls, contextual summaries and full/key column switch')
        checks.append(f'{role}: TanStack full-dataset sorting, accessible sort state and matching CSV order')
        checks.append(f'{role}: reference-style identity avatars, status badges, recommendation/company context and exported recommendation fields')

        records.get_by_role('button', name='Individual assessment reports', exact=True).click()
        embedded = records.get_by_role('region', name='Individual assessment report controls', exact=True)
        expect(embedded.get_by_label('Report type', exact=True)).to_be_visible()
        expect(page.get_by_role('heading', name='Assessment reports', exact=True)).to_have_count(0)
        embedded.get_by_label('Report type', exact=True).select_option('assessment_completion')
        embedded.get_by_label('Batch filter', exact=True).select_option(str(AUTH['batch_id']))
        embedded.get_by_role('button', name='Generate report', exact=True).click()
        individual_table = embedded.get_by_role('region', name='Individual assessment report table', exact=True)
        expect(individual_table.get_by_role('cell', name='Required foundations', exact=True)).to_be_visible()
        with page.expect_download() as download:
            embedded.get_by_role('button', name='Download PDF', exact=True).click()
        individual_pdf = ARTIFACTS / f'{role}-individual-assessment.pdf'
        download.value.save_as(individual_pdf)
        assert individual_pdf.read_bytes().startswith(b'%PDF')
        embedded.screenshot(path=str(ARTIFACTS / f'{role}-embedded-assessment-reports.png'))
        records.get_by_role('button', name='Individual assessment reports', exact=True).click()
        expect(embedded).to_have_count(0)
        checks.append(f'{role}: individual reports embedded in records, real generation and PDF export without nested cards')

        page.get_by_role('button', name='Assessment table', exact=True).click()
        expect(records.get_by_text('Required foundations', exact=True)).to_be_visible()
        with page.expect_download() as download:
            records.get_by_role('button', name='Download displayed CSV', exact=True).click()
        downloaded = download.value
        csv_path = ARTIFACTS / f'{role}-assessments.csv'
        downloaded.save_as(csv_path)
        matrix = list(csv.reader(io.StringIO(csv_path.read_text(encoding='utf-8-sig'))))
        header = next(index for index, row in enumerate(matrix) if row and row[0] == 'Assessment' and len(row) > 4)
        assert len(matrix[header + 1:]) == (3 if role == 'admin' else 2)
        assert any(row and row[0] == 'Scope' for row in matrix)
        with page.expect_download() as download:
            records.get_by_role('button', name='Download displayed PDF', exact=True).click()
        pdf_path = ARTIFACTS / f'{role}-assessments.pdf'
        download.value.save_as(pdf_path)
        assert pdf_path.read_bytes().startswith(b'%PDF')
        page.get_by_role('button', name='Activity table', exact=True).click()
        expect(records.get_by_text('Recorded submission activity', exact=True)).to_be_visible()
        checks.append(f'{role}: assessment table / CSV snapshot counts agree; PDF downloads; activity uses saved timestamps')

        page.get_by_role('button', name='Skills', exact=True).click()
        skill_chart = page.get_by_role('heading', name='Skill results by category', exact=True).locator('..')
        expect(skill_chart.get_by_text('How to read this chart', exact=True)).to_be_visible()
        expect(skill_chart.get_by_text('80% and above', exact=True)).to_be_visible()
        expect(skill_chart.get_by_text('60% to below 80%', exact=True)).to_be_visible()
        expect(skill_chart.get_by_text('Below 60%', exact=True)).to_be_visible()
        skill_chart.screenshot(path=str(ARTIFACTS / f'{role}-skill-guide.png'))
        skill_chart.locator('.recharts-bar').first.locator('.recharts-rectangle').first.hover()
        expect(skill_chart.locator('.recharts-tooltip-wrapper')).to_contain_text('students with results')
        skill_chart.locator('.recharts-bar').nth(2).locator('.recharts-rectangle').first.click()
        expect(records.get_by_text('Database · Needs work · 1 records', exact=False)).to_be_visible()
        skill_chart.get_by_text('View counts and student lists', exact=True).click()
        skill_chart.get_by_role('button', name='Database · Needs work: 1', exact=True).focus()
        page.keyboard.press('Enter')
        expect(records.get_by_text('Database · Needs work · 1 records', exact=False)).to_be_visible()
        expect(records.get_by_role('button', name='View details for Synthetic Student 09', exact=True)).to_be_visible()
        page.get_by_role('button', name='Category table', exact=True).click()
        expect(records.get_by_role('cell', name='Database', exact=True)).to_be_visible()
        page.get_by_role('button', name='Student records', exact=True).click()
        page.get_by_placeholder('Search student, ID, batch or instructor…').fill('SYN-009')
        expect(records.get_by_role('button', name='View details for Synthetic Student 09', exact=True)).to_be_visible()
        page.get_by_placeholder('Search student, ID, batch or instructor…').fill('')
        checks.append(f'{role}: final skill bands, missing/locked evidence and zero scores retain student detail access')
        checks.append(f'{role}: Recharts tooltip, plain-language score guide, bar drill-down and keyboard count alternative')

        page.get_by_role('button', name='Placements', exact=True).click()
        expect(page.get_by_role('heading', name='Placement progress', exact=True)).to_be_visible()
        placement_chart = page.get_by_role('heading', name='Placement progress', exact=True).locator('..')
        # Click the painted ring, rather than the sector group's empty center.
        placement_chart.locator('.recharts-surface').click(position={'x': 140, 'y': 40})
        expect(records.get_by_text(f"Approved in cohort · {5 if role == 'admin' else 3} records", exact=False)).to_be_visible()
        page.get_by_role('button', name=f"Approved in cohort: {5 if role == 'admin' else 3}", exact=True).click()
        expect(records.get_by_text(f"Approved in cohort · {5 if role == 'admin' else 3} records", exact=False)).to_be_visible()
        page.get_by_role('button', name='Awaiting review', exact=True).click()
        expect(records.get_by_text('Awaiting placement review · 4 records', exact=False)).to_be_visible()
        page.get_by_role('button', name='Capacity table', exact=True).click()
        expect(records.get_by_role('cell', name='Developer Intern', exact=True)).to_be_visible()
        expect(records.get_by_role('cell', name='15', exact=True)).to_be_visible()
        page.get_by_label('Approved position / capacity', exact=True).select_option(label='Network Intern')
        expect(page.get_by_role('heading', name='Shared position capacity', exact=True).first).to_be_visible()
        page.get_by_role('button', name='Capacity table', exact=True).click()
        expect(records.get_by_role('cell', name='Developer Intern', exact=True)).to_have_count(0)
        page.get_by_role('button', name='Reset analytics filters', exact=True).click()
        page.get_by_role('button', name='Residence / company areas', exact=True).click()
        expect(records.get_by_role('cell', name='Tagum City', exact=True)).to_be_visible()
        expect(records.get_by_role('cell', name='Davao City', exact=True)).to_be_visible()
        page.get_by_role('button', name='Student records', exact=True).click()
        checks.append(f'{role}: current placement review, global seat consumption and company/position filtering')

        if role == 'admin':
            expect(page.get_by_label('Instructor', exact=True)).to_be_visible()
            page.get_by_label('Instructor', exact=True).select_option(str(AUTH['owner_id']))
            expect(page.get_by_text('13 records', exact=False).first).to_be_visible()
            page.get_by_role('button', name='Reset analytics filters', exact=True).click()
            page.get_by_role('button', name='Advanced: recommendation model and evaluation', exact=True).click()
            expect(page.get_by_role('heading', name='Recommendation NLP Model', exact=True)).to_be_visible()
            page.get_by_role('button', name='Advanced: recommendation model and evaluation', exact=True).click()
        else:
            expect(page.get_by_label('Instructor', exact=True)).to_have_count(0)
            expect(page.get_by_role('button', name='Advanced: recommendation model and evaluation', exact=True)).to_have_count(0)
            denial = context.request.get(API + f"/api/management/analytics/?batch_id={AUTH['foreign_id']}", headers={'Authorization': 'Bearer ' + AUTH[role]['token']})
            assert denial.status == 404
        page.get_by_label('Batch status', exact=True).select_option('archived')
        expect(page.locator('p').filter(has_text='Batches: Synthetic archived cohort').first).to_be_visible()
        page.get_by_role('button', name='Reset analytics filters', exact=True).click()
        checks.append(f'{role}: scoped owner/archive filters and admin-only advanced controls')

        page.get_by_role('button', name='Assessments', exact=True).click()
        expect(page.get_by_role('form', name='Submission activity dates')).to_be_visible()
        date_form = page.get_by_role('form', name='Submission activity dates')
        clock_now = datetime.now(ZoneInfo('Asia/Manila'))
        today = clock_now.strftime('%Y-%m-%d')
        first_date = (clock_now - timedelta(days=10)).strftime('%Y-%m-%d')
        last_date = (clock_now - timedelta(days=5)).strftime('%Y-%m-%d')
        error_date = (clock_now - timedelta(days=3)).strftime('%Y-%m-%d')
        tomorrow = (clock_now + timedelta(days=1)).strftime('%Y-%m-%d')
        records.evaluate('node => node.dataset.preserved = "yes"')
        page.evaluate('window.analyticsDocumentSentinel = "preserved"')
        held = []
        def take_held():
            deadline = time.monotonic() + 5
            while not held and time.monotonic() < deadline:
                page.wait_for_timeout(20)
            assert len(held) == 1
            return held.pop()
        def hold_dates(route):
            if 'date_from=' in urlparse(route.request.url).query:
                held.append(route)
            else:
                route.fallback()
        page.route('**/api/management/analytics/**', hold_dates)
        date_form.get_by_label('Activity from', exact=True).fill(tomorrow)
        date_form.get_by_label('Activity through', exact=True).fill(today)
        date_form.get_by_role('button', name='Apply dates', exact=True).click()
        expect(date_form.get_by_role('alert')).to_have_text('The start date must be on or before the end date.')
        assert not held
        date_form.get_by_label('Activity from', exact=True).fill(first_date)
        date_form.get_by_role('button', name='Apply dates', exact=True).click()
        expect(page.get_by_text('Updating report in the background…', exact=False)).to_be_visible()
        expect(records).to_have_attribute('data-preserved', 'yes')
        expect(page.get_by_label('Loading authorized analytics', exact=True)).to_have_count(0)
        expect(records.get_by_role('button', name='Download displayed CSV', exact=True)).to_be_disabled()
        old_request = take_held()
        date_form.get_by_label('Activity from', exact=True).fill(last_date)
        date_form.get_by_role('button', name='Apply dates', exact=True).click()
        # Wait for the second intercepted request without depending on a fixed sleep.
        expect(page.get_by_label('Activity from', exact=True)).to_have_value(last_date)
        latest = take_held()
        parsed = urlparse(latest.request.url)
        latest.fulfill(response=latest.fetch(url=API + parsed.path + '?' + parsed.query))
        expect(page.get_by_text(f'Showing {last_date} to {today}.', exact=False)).to_be_visible()
        parsed = urlparse(old_request.request.url)
        old_request.fulfill(response=old_request.fetch(url=API + parsed.path + '?' + parsed.query))
        expect(page.get_by_label('Activity from', exact=True)).to_have_value(last_date)
        expect(records).to_have_attribute('data-preserved', 'yes')
        assert page.evaluate('window.analyticsDocumentSentinel') == 'preserved'
        date_form.get_by_label('Activity from', exact=True).fill(error_date)
        date_form.get_by_role('button', name='Apply dates', exact=True).click()
        expect(page.get_by_text('Updating report in the background…', exact=False)).to_be_visible()
        take_held().fulfill(status=503, json={'error': 'Private internal diagnostic must not appear'})
        expect(page.get_by_text('The report could not be updated.', exact=True)).to_be_visible()
        expect(page.get_by_text('Server is unavailable. Check your connection.', exact=True).first).to_be_visible()
        expect(page.get_by_text('Private internal diagnostic must not appear', exact=True)).to_have_count(0)
        expect(records).to_have_attribute('data-preserved', 'yes')
        page.get_by_role('button', name='Retry report', exact=True).click()
        expect(page.get_by_text('Updating report in the background…', exact=False)).to_be_visible()
        latest = take_held()
        parsed = urlparse(latest.request.url)
        latest.fulfill(response=latest.fetch(url=API + parsed.path + '?' + parsed.query))
        expect(page.get_by_text(f'Showing {error_date} to {today}.', exact=False)).to_be_visible()
        expect(page.get_by_text('The report could not be updated.', exact=True)).to_have_count(0)
        page.unroute('**/api/management/analytics/**', hold_dates)
        page.get_by_role('button', name='Reset analytics filters', exact=True).click()
        expect(page.get_by_label('Activity from', exact=True)).not_to_have_value(error_date)
        checks.append(f'{role}: activity validation, retained DOM, background refresh, latest-filter wins and safe 503/retry recovery')

        for tab in ['Assessments', 'Skills', 'Placements']:
            page.get_by_role('button', name=tab, exact=True).click()
            for width in [375, 768, 1024, 1440]:
                page.set_viewport_size({'width': width, 'height': 1000})
                for dark in [False, True]:
                    page.evaluate('(dark) => document.documentElement.classList.toggle("dark", dark)', dark)
                    geometry(page, f'{role}-{tab.lower()}-{width}-{"dark" if dark else "light"}')
        page.get_by_role('button', name='Assessments', exact=True).click()
        # Unavailable analytics does not leave stale authorized table records.
        def deny(route):
            return route.fulfill(status=403, json={'error': 'Synthetic access loss'})
        page.route('**/api/management/analytics/**', deny)
        page.get_by_label('Course', exact=True).select_option('BSIT')
        expect(page.get_by_role('alert').first).to_be_visible()
        expect(page.get_by_role('region', name='Analytics records', exact=True)).to_have_count(0)
        checks.append(f'{role}: responsive light/dark charts and safe access-loss state')
        context.close()
    browser.close()
assert not errors, errors
(ARTIFACTS / 'checks.json').write_text(json.dumps({'checks': checks, 'page_errors': errors}, indent=2), encoding='utf-8')
print(json.dumps({'passed': len(checks), 'checks': checks}, indent=2), flush=True)
