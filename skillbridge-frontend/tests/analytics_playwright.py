"""Real isolated API/browser checks. Run through run_admin_management.py --analytics."""
import csv
import io
import json
import os
import re
import sys
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
        page.get_by_role('heading', level=3).first.locator('xpath=ancestor::section[1]').screenshot(path=str(ARTIFACTS / f'{name}-chart.png'))


def fixture(browser, role):
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce', timezone_id='America/New_York')
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


def activity_date_trigger(page, label):
    return page.get_by_role('button', name=re.compile('^' + re.escape(label) + ':'))


def set_activity_date(page, label, value):
    target = datetime.fromisoformat(value)
    activity_date_trigger(page, label).click()
    picker = page.get_by_role('dialog', name=label + ' date', exact=True)
    expect(picker.locator('[data-type="hour"]')).to_have_count(0)
    for _ in range(36):
        current = datetime.strptime(picker.locator('header h2').inner_text(), '%B %Y')
        if (current.year, current.month) == (target.year, target.month):
            break
        picker.get_by_role('button', name='Next month' if current < target else 'Previous month', exact=True).click()
    picker.get_by_role('button', name=re.compile(target.strftime('%B ') + str(target.day) + ', ' + str(target.year))).click()
    picker.get_by_role('button', name='Apply', exact=True).click()


def expect_activity_date(page, label, value):
    target = datetime.fromisoformat(value)
    expect(activity_date_trigger(page, label)).to_have_accessible_name(re.compile('(?=.*' + target.strftime('%b') + ')(?=.*' + str(target.day) + ')(?=.*' + str(target.year) + ')'))


def check_activity_calendar(page, role):
    form = page.get_by_role('form', name='Submission activity dates', exact=True)
    expect(form.locator('input[type="date"]')).to_have_count(0)
    trigger = activity_date_trigger(page, 'Activity from')
    original = trigger.get_attribute('aria-label')
    trigger.click()
    picker = page.get_by_role('dialog', name='Activity from date', exact=True)
    expect(picker.get_by_text('Asia/Manila', exact=True)).to_be_visible()
    expect(picker.locator('[data-type="hour"]')).to_have_count(0)
    picker.get_by_role('button', name='Next month', exact=True).click()
    picker.get_by_role('button', name='Cancel', exact=True).click()
    expect(trigger).to_have_attribute('aria-label', original)
    expect(trigger).to_be_focused()
    trigger.click()
    page.get_by_role('dialog', name='Activity from date', exact=True).get_by_role('button', name='Clear', exact=True).click()
    expect(trigger).to_have_accessible_name('Activity from: Select date')
    form.get_by_role('button', name='Apply dates', exact=True).click()
    expect(form.get_by_role('alert')).to_have_text('Choose both a start date and an end date.')
    expect(form.get_by_role('group', name='Activity from', exact=True)).to_have_attribute('aria-invalid', 'true')
    now = datetime.now(ZoneInfo('Asia/Manila'))
    set_activity_date(page, 'Activity from', (now - timedelta(days=10)).strftime('%Y-%m-%d'))
    expect(form.get_by_role('alert')).to_have_count(0)
    set_activity_date(page, 'Activity through', (now + timedelta(days=1)).strftime('%Y-%m-%d'))
    form.get_by_role('button', name='Apply dates', exact=True).click()
    expect(form.get_by_role('alert')).to_have_text('The end date cannot be in the future.')
    set_activity_date(page, 'Activity through', now.strftime('%Y-%m-%d'))
    set_activity_date(page, 'Activity from', (now - timedelta(days=367)).strftime('%Y-%m-%d'))
    form.get_by_role('button', name='Apply dates', exact=True).click()
    expect(form.get_by_role('alert')).to_have_text('Choose a range of 366 days or less.')
    set_activity_date(page, 'Activity from', (now - timedelta(days=10)).strftime('%Y-%m-%d'))
    for width, height in [(320, 568), (375, 812), (768, 1024), (1440, 1000), (812, 375)]:
        page.set_viewport_size({'width': width, 'height': height})
        for dark in [False, True]:
            page.evaluate('(dark) => document.documentElement.classList.toggle("dark", dark)', dark)
            activity_date_trigger(page, 'Activity from').focus()
            page.keyboard.press('Enter')
            picker = page.get_by_role('dialog', name='Activity from date', exact=True)
            expect(picker).to_be_visible()
            box = picker.bounding_box()
            assert box['x'] >= 0 and box['y'] >= 0 and box['x'] + box['width'] <= width + 1
            # A short viewport may scroll the existing modal surface.
            try:
                page.wait_for_function('''() => {const n=document.querySelector('.sb-calendar-surface'); if(!n)return false; const b=n.getBoundingClientRect(); return b.y>=0 && b.bottom<=innerHeight+1}''', timeout=3000)
            except Exception:
                page.screenshot(path=str(ARTIFACTS / f'{role}-calendar-bounds-{width}.png'))
                print({'width': width, 'height': height, 'calendar_bounds': picker.evaluate('n => {const p=n.closest(".sb-calendar-surface"); const b=p.getBoundingClientRect(); return {x:b.x,y:b.y,w:b.width,h:b.height,position:getComputedStyle(p).position,placement:p.dataset.placement}}')}, flush=True)
                raise
            if width in [375, 1440] and not dark:
                page.screenshot(path=str(ARTIFACTS / f'{role}-activity-calendar-{width}.png'))
            page.keyboard.press('Escape')
            expect(picker).to_have_count(0)
            expect(activity_date_trigger(page, 'Activity from')).to_be_focused()
            checks.append(f'{role}: date-only calendar {width}x{height} dark={dark}, bounded overlay, keyboard/Escape and focus return')
    page.set_viewport_size({'width': 1440, 'height': 1000})
    page.evaluate('document.documentElement.classList.remove("dark")')
    checks.append(f'{role}: assessment-style date-only calendar Apply/Cancel/Clear, missing-range validation and Manila labels in a New York browser')


def check_placement_insights(page, context, role, records):
    progress = page.get_by_role('region', name='Student placement progress', exact=True)
    comparison = page.get_by_role('region', name='Approved placement comparison', exact=True)
    slots = page.get_by_role('region', name='Shared position slots', exact=True)
    snapshot = context.request.get(API + '/api/management/analytics/', headers={'Authorization': 'Bearer ' + AUTH[role]['token']}).json()
    expect(progress.locator('.pi-progress-summary strong')).to_have_text(f"{snapshot['summary']['approved']} of {snapshot['summary']['students']}")
    for key, label in [('approved', 'Approved in selected batches'), ('approved_other_batch', 'Approved in another batch'), ('unplaced', 'Unplaced')]:
        count = snapshot['summary'][key]
        progress.get_by_role('button', name=f'{label}: {count}', exact=True).click()
        expect(records.get_by_role('status')).to_contain_text(f'{count} records')
        expect(records.get_by_role('region', name='Active record filter')).to_contain_text(label)
        records.get_by_role('button', name='Clear record selection', exact=True).click()
    # Selecting a company area filters positions and comparisons, not selected students.
    page.get_by_label('Company area (not student residence)', exact=True).select_option('Davao City')
    expect(slots.locator('tbody tr')).to_have_count(2)
    expect(slots.locator('tbody td[data-label="Company area"]')).to_have_text(['Davao City', 'Davao City'])
    expect(slots.get_by_role('button', name='Clear company area filter: Davao City', exact=True)).to_be_visible()
    expect(slots.locator('.pi-totals dd')).to_have_text(['25', '5', '20'])
    expect(progress.locator('.pi-progress-summary strong')).to_have_text(f"{snapshot['summary']['approved']} of {snapshot['summary']['students']}")
    company = snapshot['companies'][0]
    comparison.get_by_role('button', name=f"{company['name']}: {company['count']} approved placements", exact=True).click()
    expect(records.get_by_role('status')).to_contain_text(f"{company['count']} records")
    expect(records.get_by_role('region', name='Active record filter')).to_contain_text(company['name'])
    comparison.get_by_role('button', name='Company area', exact=True).click()
    comparison.get_by_role('button', name=f"Davao City: {snapshot['summary']['approved']} approved placements", exact=True).click()
    expect(records.get_by_role('status')).to_contain_text(f"{snapshot['summary']['approved']} records")
    comparison.get_by_role('button', name='Company', exact=True).click()
    # No approvals in Panabo: honest empty comparison, three shared slots.
    page.get_by_label('Company area (not student residence)', exact=True).select_option('Panabo City')
    expect(slots.locator('tbody tr')).to_have_count(1)
    expect(slots.locator('.pi-totals dd')).to_have_text(['3', '0', '3'])
    expect(comparison.get_by_role('heading', name='No approved placements in this view', exact=True)).to_be_visible()
    unplaced = snapshot['summary']['unplaced']
    progress.get_by_role('button', name=f'Unplaced: {unplaced}', exact=True).click()
    expect(records.get_by_role('status')).to_contain_text(f'{unplaced} records')
    expect(records.get_by_role('region', name='Active record filter')).to_contain_text('company, position and area filters do not narrow this status view')
    expected = [s['name'] for s in snapshot['students'] if s['placement_status'] == 'unplaced']
    assert records.get_by_role('button', name=re.compile('^View details for ')).all_text_contents() == expected[:8]
    slots.get_by_role('button', name='View capacity records', exact=True).click()
    expect(records.get_by_role('cell', name='Panabo Support Intern', exact=True)).to_be_visible()
    with page.expect_download() as download:
        records.get_by_role('button', name='Download displayed CSV', exact=True).click()
    export = ARTIFACTS / f'{role}-davao-slots.csv'
    download.value.save_as(export)
    text = export.read_text(encoding='utf-8-sig')
    # User-owned batch names may still contain old wording; generated labels must not.
    assert 'Configured slots' in text and 'Panabo City' in text and 'seats' not in text.lower() and 'Active cohorts' not in text
    page.get_by_role('button', name='Clear company area filter: Panabo City', exact=True).click()
    expect(slots.locator('tbody tr')).to_have_count(4)
    expect(page.get_by_label('Company area (not student residence)', exact=True)).to_have_value('')
    checks.append(f'{role}: exact company-area filtering, all-batch slot totals, honest empty comparison, status counts independent of company filters and slots-only CSV')
    for width, height in [(320, 568), (375, 812), (768, 1024), (1024, 768), (1440, 1000), (812, 375)]:
        page.set_viewport_size({'width': width, 'height': height})
        for dark in [False, True]:
            page.evaluate('(dark) => document.documentElement.classList.toggle("dark", dark)', dark)
            page.wait_for_function('document.documentElement.scrollWidth <= innerWidth')
            assert page.locator('.pi-insights,.pi-panel,.pi-capacity-table').evaluate_all('nodes => nodes.every(n => n.scrollWidth <= n.clientWidth+1)')
            assert progress.locator('button').evaluate_all('nodes => nodes.every(n => n.getBoundingClientRect().height>=44)')
            if width in [375,1440] and not dark:
                page.locator('.pi-insights').screenshot(path=str(ARTIFACTS / f'{role}-placement-insights-{width}.png'), style='.sb-top-header,.sb-skip-link,.sb-toast {visibility:hidden!important}')
            checks.append(f'{role}: placement insights {width}x{height} dark={dark}, responsive slot table/status filters and no page overflow')
    page.set_viewport_size({'width':1440,'height':1000})
    page.evaluate('document.documentElement.classList.remove("dark")')
    expanded=json.loads(json.dumps(snapshot))
    for i in range(len(expanded['capacity']),19):
        expanded['capacity'].append({'id':9300+i,'company_id':9400+i,'company':f'QA Extended Company {i} With A Long Synthetic Name','name':'QA Extended Position Name','area':'Davao City','total':2,'occupied':3 if i==18 else 0,'remaining':0 if i==18 else 2})
    expanded['companies']=[{'id':9500+i,'name':f'QA Company {i}','count':1} for i in range(19)]
    payload=expanded
    def placement_data(route): route.fulfill(json=payload)
    def refresh(): page.evaluate('async()=>{const {invalidateCache}=await import("/src/hooks/useApi.js");invalidateCache("/api/management/analytics/")}')
    page.route('**/api/management/analytics/**',placement_data)
    refresh()
    expect(slots.locator('tbody tr')).to_have_count(8)
    slots.get_by_role('navigation',name='Shared slots pages').get_by_role('button',name='3',exact=True).click()
    expect(slots.locator('tbody tr')).to_have_count(3)
    expect(slots.get_by_text('Above configured slots',exact=True)).to_be_visible()
    comparison.get_by_role('navigation',name='Company approval pages').get_by_role('button',name='3',exact=True).click()
    expect(comparison.locator('.pi-comparison button')).to_have_count(3)
    page.set_viewport_size({'width':320,'height':568})
    page.wait_for_function('document.documentElement.scrollWidth<=innerWidth')
    payload={**expanded,'capacity':expanded['capacity'][:2],'companies':expanded['companies'][:2]}
    refresh()
    expect(slots.locator('tbody tr')).to_have_count(2)
    payload=expanded
    refresh()
    expect(slots.get_by_role('navigation',name='Shared slots pages').get_by_role('button',name='1',exact=True)).to_have_attribute('aria-current','page')
    expect(comparison.get_by_role('navigation',name='Company approval pages').get_by_role('button',name='1',exact=True)).to_have_attribute('aria-current','page')
    payload={**expanded,'capacity':[],'companies':[],'summary':{**expanded['summary'],'students':0,'approved':0,'approved_other_batch':0,'unplaced':0,'placement_rate':None},'students':[],'placement_students':[]}
    refresh()
    expect(progress.locator('.pi-rate')).to_have_text('—')
    expect(slots.get_by_role('heading',name='No positions match these company filters',exact=True)).to_be_visible()
    expect(slots.locator('.pi-totals dd')).to_have_text(['0','0','0'])
    progress.get_by_role('button',name='Unplaced: 0',exact=True).click()
    expect(records.get_by_text('No records match this selection.',exact=True)).to_be_visible()
    page.unroute('**/api/management/analytics/**',placement_data)
    refresh()
    expect(slots.locator('tbody tr')).to_have_count(4)
    page.set_viewport_size({'width':1440,'height':1000})
    page.get_by_role('button',name='Clear record selection',exact=True).click()
    checks.append(f'{role}: independent eight-row slot/company pages, long labels, explicit over-capacity/zero/empty states and live page clamp/regrowth')


def check_skills_insights(page, context, role, records):
    skills = page.get_by_role('region', name='Skill results by category', exact=True)
    matches = page.get_by_role('region', name='Current company matches', exact=True)
    expect(skills.get_by_text('Numbers below count students, not average scores.', exact=False)).to_be_visible()
    snapshot = context.request.get(API + '/api/management/analytics/', headers={'Authorization': 'Bearer ' + AUTH[role]['token']}).json()
    banner = records.get_by_role('region', name='Active record filter', exact=True)
    expect(skills.locator('tbody tr')).to_have_count(len(snapshot['skills']))
    for skill in snapshot['skills']:
        row = skills.get_by_role('row', name=re.compile('^' + re.escape(skill['name']))).filter(has=page.locator('th[scope="row"]'))
        expect(row.locator('.si-missing')).to_have_text(str(skill['missing']))
        assert row.locator('.si-missing').evaluate('n => !n.closest("button")')
        for key, label in [('strong', 'Strong'), ('fair', 'Fair'), ('needs_work', 'Needs work')]:
            button = skills.get_by_role('button', name=f"{skill['name']} · {label}: {skill[key]}", exact=True)
            # Start in cards so every arrow must actively return to the list.
            records.get_by_role('button', name='Card view', exact=True).click()
            button.focus()
            page.keyboard.press('Enter')
            expect(button).to_have_attribute('aria-pressed', 'true')
            expect(records.get_by_role('button', name='List view', exact=True)).to_have_attribute('aria-pressed', 'true')
            expect(records.get_by_role('heading', name='Student competency records', exact=True)).to_be_focused()
            expect(banner).to_contain_text(f"{skill['name']} · {label}")
            expected = [s for s in snapshot['students'] if s['scores'].get(str(skill['id'])) is not None and (s['scores'][str(skill['id'])] >= 80 if key == 'strong' else 60 <= s['scores'][str(skill['id'])] < 80 if key == 'fair' else s['scores'][str(skill['id'])] < 60)]
            assert len(expected) == skill[key]
            expect(records.get_by_role('status')).to_contain_text(f'{len(expected)} records')
            if expected:
                assert records.get_by_role('button', name=re.compile('^View details for ')).all_text_contents() == [s['name'] for s in expected[:8]]
            else:
                expect(records.get_by_text('No records match this selection.', exact=True)).to_be_visible()
            records.get_by_role('button', name='Clear record selection', exact=True).click()
            expect(banner).to_have_count(0)
    checks.append(f'{role}: all category-band arrows match real filtered identities/counts, force list view, focus records and preserve zero/locked distinctions')
    counts = {r['name']: r['count'] for r in snapshot['match_bands']}
    for key, label, banner_label in [('Strong', 'Strong fit', 'Strong fit'), ('Fair', 'Fair fit', 'Fair fit'), ('Low', 'Low fit', 'Low fit'), ('No current match', 'No current recommendation', 'No current recommendation'), ('Locked', 'Final results locked', 'Final results locked')]:
        count = counts[key]
        button = matches.get_by_role('button', name=f"{label}: {count} {'student' if count == 1 else 'students'}", exact=True)
        button.click()
        expect(button).to_have_attribute('aria-pressed', 'true')
        expect(banner).to_contain_text(banner_label)
        expected = [s for s in snapshot['students'] if s['match_band'] == key]
        assert len(expected) == count
        expect(records.get_by_role('status')).to_contain_text(f'{count} records')
        if expected:
            assert records.get_by_role('button', name=re.compile('^View details for ')).all_text_contents() == [s['name'] for s in expected[:8]]
        else:
            expect(records.get_by_text('No records match this selection.', exact=True)).to_be_visible()
        records.get_by_role('button', name='Clear record selection', exact=True).click()
    checks.append(f'{role}: all five company-match arrows keep best-match membership separate from unavailable/locked final results')
    for width, height in [(320, 568), (375, 812), (768, 1024), (1024, 768), (1440, 1000), (812, 375)]:
        page.set_viewport_size({'width': width, 'height': height})
        for dark in [False, True]:
            page.evaluate('(dark) => document.documentElement.classList.toggle("dark", dark)', dark)
            page.wait_for_function('document.documentElement.scrollWidth <= innerWidth')
            assert page.locator('.si-panels, .si-panel, .si-matrix').evaluate_all('nodes => nodes.every(n => n.scrollWidth <= n.clientWidth + 1)')
            assert skills.locator('.si-count').evaluate_all('nodes => nodes.every(n => n.getBoundingClientRect().height >= 44)')
            if width in [375, 1440] and not dark:
                page.locator('.si-panels').screenshot(path=str(ARTIFACTS / f'{role}-skills-insights-{width}.png'), style='.sb-top-header,.sb-skip-link { visibility:hidden !important; }')
            checks.append(f'{role}: skills matrix and match panel {width}x{height} dark={dark}, readable counts, touch targets and no horizontal overflow')
    page.set_viewport_size({'width': 1440, 'height': 1000})
    page.evaluate('document.documentElement.classList.remove("dark")')
    expanded = json.loads(json.dumps(snapshot))
    for i in range(len(expanded['skills']), 19):
        expanded['skills'].append({'id': 9200 + i, 'name': f'QA Additional Skill {i + 1} With An Extended Synthetic Category Name', 'sample': 0, 'missing': snapshot['summary']['students'], 'strong': 0, 'fair': 0, 'needs_work': 0, 'average': None})
    payload = expanded
    def skills_data(route):
        route.fulfill(json=payload)
    def refresh():
        page.evaluate('async () => { const {invalidateCache}=await import("/src/hooks/useApi.js"); invalidateCache("/api/management/analytics/") }')
    page.route('**/api/management/analytics/**', skills_data)
    refresh()
    expect(skills.locator('tbody tr')).to_have_count(8)
    pager = skills.get_by_role('navigation', name='Skill category pages', exact=True)
    pager.get_by_role('button', name='3', exact=True).click()
    expect(skills.locator('tbody tr')).to_have_count(3)
    page.set_viewport_size({'width': 320, 'height': 568})
    page.wait_for_function('document.documentElement.scrollWidth <= innerWidth')
    assert skills.evaluate('n => n.scrollWidth <= n.clientWidth + 1')
    payload = {**expanded, 'skills': expanded['skills'][:2]}
    refresh()
    expect(skills.locator('tbody tr')).to_have_count(2)
    payload = expanded
    refresh()
    expect(skills.locator('tbody tr')).to_have_count(8)
    expect(pager.get_by_role('button', name='1', exact=True)).to_have_attribute('aria-current', 'page')
    payload = {**expanded, 'skills': [], 'match_bands': [{'name': r['name'], 'count': snapshot['summary']['students'] if r['name'] == 'Locked' else 0} for r in snapshot['match_bands']], 'students': [{**s, 'scores': {}, 'match_band': 'Locked', 'recommendations_locked': True, 'top_match': None} for s in snapshot['students']]}
    refresh()
    expect(skills.get_by_text('No final category results in this scope.', exact=False)).to_be_visible()
    expect(matches.get_by_role('button', name=f"Final results locked: {snapshot['summary']['students']} students", exact=True)).to_be_visible()
    payload = {**payload, 'students': [], 'placement_students': [], 'summary': {**payload['summary'], 'students': 0}, 'match_bands': [{'name': r['name'], 'count': 0} for r in snapshot['match_bands']]}
    refresh()
    expect(skills.get_by_text('No students in this scope.', exact=False)).to_be_visible()
    page.unroute('**/api/management/analytics/**', skills_data)
    refresh()
    expect(skills.locator('tbody tr')).to_have_count(len(snapshot['skills']))
    page.set_viewport_size({'width': 1440, 'height': 1000})
    skills.get_by_role('button', name='View category table', exact=True).click()
    expect(records.get_by_role('columnheader', name='Category', exact=False)).to_be_visible()
    page.get_by_role('button', name='Student records', exact=True).click()
    checks.append(f'{role}: category pagination/long labels, live clamp/regrowth, all-locked/empty scopes and category-table action')


def check_progress_panels(page, context, role, records):
    completion = page.get_by_role('region', name='Required completion by batch', exact=True)
    attempts = page.get_by_role('region', name='Assessment attempt status', exact=True)
    snapshot = context.request.get(API + '/api/management/analytics/', headers={'Authorization': 'Bearer ' + AUTH[role]['token']}).json()
    rate = snapshot['summary']['completion_rate']
    expect(completion.locator('.ap-summary strong')).to_have_text('—' if rate is None else f'{rate:g}%')
    assigned = sum(row['assigned'] for row in snapshot['assessments'])
    submitted = sum(row['submitted'] for row in snapshot['assessments'])
    expect(attempts.locator('.ap-summary strong')).to_have_text(f'{submitted} of {assigned}' if assigned else '—')
    expect(attempts.locator('.ap-summary p')).to_contain_text('assignments')
    assert completion.locator('.ap-track').evaluate_all('nodes => nodes.every(n => Math.abs(n.firstElementChild.getBoundingClientRect().width / n.getBoundingClientRect().width * 100 - Number(n.getAttribute("aria-valuenow")) / Number(n.getAttribute("aria-valuemax")) * 100) < .02)')
    status_keys = ['submitted', 'in_progress', 'not_started', 'stopped']
    labels = ['Valid submitted', 'In progress', 'Not started', 'Stopped / flagged']
    for i, row in enumerate(snapshot['assessments']):
        block = attempts.locator('.ap-assessment').nth(i)
        expect(block.locator('.ap-statuses button')).to_have_count(4)
        widths = block.locator('.ap-attempt-track > span').evaluate_all('nodes => nodes.map(n => parseFloat(n.style.width))')
        for j, key in enumerate(status_keys):
            assert abs(widths[j] - (row[key] / row['assigned'] * 100 if row['assigned'] else 0)) < .0001
    first_batch = snapshot['batches'][0]
    completion.get_by_role('button', name=f"View students in {first_batch['name']}", exact=True).click()
    expect(records.get_by_text(f"{first_batch['name']} · {first_batch['total']} records", exact=True)).to_be_visible()
    active_filter = records.get_by_role('region', name='Active record filter', exact=True)
    expect(active_filter).to_contain_text(first_batch['name'])
    expect(active_filter).to_contain_text('Showing all students in this batch')
    expect(records.get_by_role('heading', name='Student progress and follow-up', exact=True)).to_be_focused()
    expect(completion.get_by_role('button', name=f"View students in {first_batch['name']}", exact=True)).to_have_attribute('aria-pressed', 'true')
    page.get_by_role('button', name='Clear record selection', exact=True).click()
    zero = next((row, i) for row in snapshot['assessments'] for i, key in enumerate(status_keys) if row[key] == 0)
    zero_button = attempts.get_by_role('button', name=f"{zero[0]['name']} · {labels[zero[1]]}: 0", exact=True)
    zero_button.focus()
    page.keyboard.press('Enter')
    expect(records.get_by_text('No records match this selection.', exact=True)).to_be_visible()
    expect(active_filter).to_contain_text(zero[0]['name'])
    expect(active_filter).to_contain_text(labels[zero[1]])
    expect(zero_button).to_have_attribute('aria-pressed', 'true')
    page.get_by_role('button', name='Clear record selection', exact=True).click()
    first_attempt = snapshot['assessments'][0]
    nonzero_index = next(i for i, key in enumerate(status_keys) if first_attempt[key])
    key = status_keys[nonzero_index]
    attempts.get_by_role('button', name=f"{first_attempt['name']} · {labels[nonzero_index]}: {first_attempt[key]}", exact=True).click()
    expect(records.get_by_role('status')).to_contain_text(f"{first_attempt[key]} records")
    expect(active_filter).to_contain_text(first_attempt['name'])
    expect(active_filter).to_contain_text(labels[nonzero_index])
    records.screenshot(path=str(ARTIFACTS / f'{role}-active-attempt-filter.png'), style='.sb-top-header,.sb-skip-link { visibility:hidden !important; }')
    page.get_by_role('button', name='Clear record selection', exact=True).click()
    analysis_filter = page.get_by_label('Assessment analysis (does not change student totals)', exact=True)
    analysis_filter.select_option(str(first_attempt['id']))
    expect(attempts.locator('.ap-assessment')).to_have_count(1)
    expect(completion.locator('.ap-summary strong')).to_have_text('—' if rate is None else f'{rate:g}%')
    analysis_filter.select_option('')
    expect(attempts.locator('.ap-assessment')).to_have_count(len(snapshot['assessments']))
    checks.append(f'{role}: progress panels preserve completion/assignment units, exact proportions, keyboard zero/nonzero filters, batch drill-down and assessment-scope boundaries')

    for width, height in [(320, 568), (375, 812), (768, 1024), (1024, 768), (1440, 1000), (812, 375)]:
        page.set_viewport_size({'width': width, 'height': height})
        for dark in [False, True]:
            page.evaluate('(dark) => document.documentElement.classList.toggle("dark", dark)', dark)
            page.wait_for_function('document.documentElement.scrollWidth <= innerWidth')
            assert page.locator('.ap-panels, .ap-panel, .ap-batch, .ap-assessment').evaluate_all('nodes => nodes.every(n => n.scrollWidth <= n.clientWidth + 1)')
            assert attempts.locator('.ap-statuses button').evaluate_all('nodes => nodes.every(n => n.getBoundingClientRect().height >= 44)')
            if width in [375, 1440] and not dark:
                # Fixed shell chrome is outside this section; hide it only during
                # the stitched element capture so it cannot cover the panel.
                page.locator('.ap-panels').screenshot(path=str(ARTIFACTS / f'{role}-progress-panels-{width}.png'), style='.sb-top-header,.sb-skip-link { visibility:hidden !important; }')
            checks.append(f'{role}: progress panels {width}x{height} dark={dark}, bounded rows, touch targets and no horizontal overflow')
    page.set_viewport_size({'width': 1440, 'height': 1000})
    page.evaluate('document.documentElement.classList.remove("dark")')

    # Add synthetic empty batches/assessments to exercise separate pagination.
    # Empty additions do not change any student/assignment totals.
    expanded = json.loads(json.dumps(snapshot))
    for i in range(len(expanded['batches']), 7):
        expanded['batches'].append({'id': 9000 + i, 'name': f'QA Long Empty Batch {i + 1} With An Extended Synthetic Label', 'instructor': 'QA Owner', 'total': 0, 'completed': 0, 'approved': 0, 'completion_rate': None})
    for i in range(len(expanded['assessments']), 9):
        expanded['assessments'].append({**first_attempt, 'id': 9100 + i, 'name': f'QA Empty Assessment {i + 1} With An Extended Synthetic Label', 'assigned': 0, 'submitted': 0, 'in_progress': 0, 'not_started': 0, 'stopped': 0, 'retake_approved': 0})
    payload = expanded
    def panel_data(route):
        route.fulfill(json=payload)
    def refresh():
        page.evaluate('async () => { const {invalidateCache}=await import("/src/hooks/useApi.js"); invalidateCache("/api/management/analytics/") }')
    page.route('**/api/management/analytics/**', panel_data)
    refresh()
    expect(completion.locator('.ap-batch')).to_have_count(4)
    expect(attempts.locator('.ap-assessment')).to_have_count(4)
    batch_pages = completion.get_by_role('navigation', name='Batch progress pages', exact=True)
    attempt_pages = attempts.get_by_role('navigation', name='Assessment status pages', exact=True)
    batch_pages.get_by_role('button', name='2', exact=True).click()
    expect(completion.locator('.ap-batch')).to_have_count(3)
    expect(completion.locator('.ap-track').first).to_have_attribute('aria-valuetext', 'No students in this batch')
    attempt_pages.get_by_role('button', name='3', exact=True).click()
    expect(attempts.locator('.ap-assessment')).to_have_count(1)
    expect(attempts.locator('.ap-statuses strong')).to_have_text(['0', '0', '0', '0'])
    page.set_viewport_size({'width': 320, 'height': 568})
    page.wait_for_function('document.documentElement.scrollWidth <= innerWidth')
    assert page.locator('.ap-panel, .ap-batch, .ap-assessment').evaluate_all('nodes => nodes.every(n => n.scrollWidth <= n.clientWidth + 1)')
    page.set_viewport_size({'width': 1440, 'height': 1000})
    # Preserve page clamping when a live refresh shrinks then restores both lists.
    payload = {**expanded, 'batches': expanded['batches'][:1], 'assessments': expanded['assessments'][:1]}
    refresh()
    expect(batch_pages).to_have_count(0)
    expect(attempt_pages).to_have_count(0)
    payload = expanded
    refresh()
    expect(completion.locator('.ap-batch')).to_have_count(4)
    expect(attempts.locator('.ap-assessment')).to_have_count(4)
    expect(batch_pages.get_by_role('button', name='1', exact=True)).to_have_attribute('aria-current', 'page')
    expect(attempt_pages.get_by_role('button', name='1', exact=True)).to_have_attribute('aria-current', 'page')
    payload = {**expanded, 'batches': [], 'assessments': [], 'summary': {**expanded['summary'], 'students': 0, 'completion_rate': None}}
    refresh()
    expect(completion.locator('.ap-summary strong')).to_have_text('—')
    expect(attempts.locator('.ap-summary strong')).to_have_text('—')
    expect(completion.get_by_text('No batches in this scope.', exact=False)).to_be_visible()
    expect(attempts.get_by_text('No assessments in this scope.', exact=False)).to_be_visible()
    page.unroute('**/api/management/analytics/**', panel_data)
    refresh()
    expect(completion.locator('.ap-batch')).to_have_count(len(snapshot['batches']))
    checks.append(f'{role}: separate four-row panel pagination, explicit zero/empty states, long labels and live clamp/regrowth')


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
        if '--placements-only' in sys.argv:
            page.get_by_role('button', name='Placements', exact=True).click()
            check_placement_insights(page, context, role, records)
            context.close()
            continue
        if '--calendar-only' in sys.argv:
            check_activity_calendar(page, role)
            context.close()
            continue
        expect(records.get_by_text('All records in scope · ' + ('15' if role == 'admin' else '13') + ' records', exact=False)).to_be_visible()
        check_progress_panels(page, context, role, records)
        if '--panels-only' in sys.argv:
            context.close()
            continue
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

        # Card/list views use the exact same ordered eight-student page.
        pager = records.get_by_role('navigation', name='Report pagination', exact=True)
        expect(records.get_by_role('row')).to_have_count(9)
        pager.get_by_role('button', name='2', exact=True).click()
        expect(records.get_by_role('row').nth(1)).to_contain_text('Synthetic Student 09')
        records.get_by_role('button', name='Card view', exact=True).click()
        expect(records.locator('.analytics-student-card')).to_have_count(7 if role == 'admin' else 5)
        expect(records.locator('.analytics-student-card').first).to_contain_text('Synthetic Student 09')
        expect(pager.get_by_role('button', name='2', exact=True)).to_have_attribute('aria-current', 'page')
        expect(records.locator('.analytics-student-card').first).to_contain_text('Top recommendation')
        stopped_card = records.locator('.analytics-student-card').filter(has_text='Synthetic Student 10')
        expect(stopped_card).to_contain_text('Stopped / flagged')
        expect(stopped_card).to_contain_text('Locked / unavailable')
        records.get_by_label('Search students', exact=False).fill('SYN-010')
        expect(records.locator('.analytics-student-card')).to_have_count(1)
        expect(pager).to_contain_text('Showing 1–1 of 1')
        records.get_by_role('button', name='View details for Synthetic Student 10', exact=True).click()
        expect(page.get_by_role('dialog').get_by_role('heading', name='Synthetic Student 10', exact=True)).to_be_visible()
        page.keyboard.press('Escape')
        expect(records.get_by_role('button', name='View details for Synthetic Student 10', exact=True)).to_be_focused()
        records.get_by_label('Search students', exact=False).fill('no-synthetic-record')
        expect(records.get_by_text('No records match this selection.', exact=True)).to_be_visible()
        records.get_by_role('button', name='Clear search', exact=True).click()
        records.get_by_label('Sort students', exact=True).select_option('0:desc')
        expect(records.locator('.analytics-student-card').first).to_contain_text(last_student)
        records.get_by_role('button', name='List view', exact=True).click()
        expect(records.get_by_role('row').nth(1)).to_contain_text(last_student)
        expect(records.get_by_role('columnheader').first).to_have_attribute('aria-sort', 'descending')
        records.get_by_role('button', name='Card view', exact=True).click()
        with page.expect_download() as download:
            records.get_by_role('button', name='Download displayed CSV', exact=True).click()
        card_csv = ARTIFACTS / f'{role}-cards-sorted.csv'
        download.value.save_as(card_csv)
        matrix = list(csv.reader(io.StringIO(card_csv.read_text(encoding='utf-8-sig'))))
        header = next(i for i, row in enumerate(matrix) if row and row[0] == 'Student' and len(row) > 4)
        assert matrix[header + 1][0] == last_student
        assert len(matrix[header + 1:]) == (15 if role == 'admin' else 13)
        records.get_by_label('Sort students', exact=True).select_option('')
        # A revalidated result shrink clamps the stored page, including after regrowth.
        pager.get_by_role('button', name='2', exact=True).click()
        snapshot = context.request.get(API + '/api/management/analytics/', headers={'Authorization': 'Bearer ' + AUTH[role]['token']}).json()
        shrunk = {**snapshot, 'students': snapshot['students'][:2]}
        def shrink_records(route):
            route.fulfill(json=shrunk)
        page.route('**/api/management/analytics/**', shrink_records)
        page.evaluate('async () => { const {invalidateCache} = await import("/src/hooks/useApi.js"); invalidateCache("/api/management/analytics/") }')
        expect(records.locator('.analytics-student-card')).to_have_count(2)
        assert records.locator('.analytics-student-grid').evaluate('n => getComputedStyle(n).gridTemplateColumns.split(" ").length') == 4
        expect(pager).to_contain_text('Showing 1–2 of 2')
        page.unroute('**/api/management/analytics/**', shrink_records)
        page.evaluate('async () => { const {invalidateCache} = await import("/src/hooks/useApi.js"); invalidateCache("/api/management/analytics/") }')
        expect(records.locator('.analytics-student-card')).to_have_count(8)
        expect(records.locator('.analytics-student-card').first).to_contain_text('Synthetic Student 01')
        for width, height in [(320, 568), (375, 812), (768, 1024), (1024, 768), (1440, 1000), (812, 375)]:
            page.set_viewport_size({'width': width, 'height': height})
            for dark in [False, True]:
                page.evaluate('(dark) => document.documentElement.classList.toggle("dark", dark)', dark)
                for view in ['Card view', 'List view']:
                    records.get_by_role('button', name=view, exact=True).click()
                    page.wait_for_function('document.documentElement.scrollWidth <= innerWidth')
                    assert records.evaluate('n => n.scrollWidth <= n.clientWidth + 1')
                    if view == 'Card view':
                        expect(records.locator('.analytics-student-card')).to_have_count(8)
                        assert records.locator('.analytics-student-card').evaluate_all('nodes => nodes.every(n => n.scrollWidth <= n.clientWidth + 1)')
                        if width == 1440:
                            assert records.locator('.analytics-student-grid').evaluate('n => getComputedStyle(n).gridTemplateColumns.split(" ").length') == 4
                            assert records.get_by_role('button', name='Card view', exact=True).evaluate('n => n.getBoundingClientRect().width') <= 32
                    else:
                        expect(records.get_by_role('row')).to_have_count(9)
                records.get_by_role('button', name='Card view', exact=True).click()
                if width in [375, 1440] and not dark:
                    records.screenshot(path=str(ARTIFACTS / f'{role}-student-cards-{width}.png'), style='.sb-top-header,.sb-skip-link { visibility:hidden !important; }')
                checks.append(f'{role}: student cards/list {width}x{height} dark={dark}, same eight records and no page overflow')
        page.set_viewport_size({'width': 1440, 'height': 1000})
        page.evaluate('document.documentElement.classList.remove("dark")')
        records.get_by_role('button', name='Needs follow-up', exact=True).click()
        expect(records.locator('.analytics-student-card')).to_have_count(6)
        assert records.locator('.analytics-student-card').evaluate_all('nodes => nodes.every(n => n.innerText.includes("Needs follow-up"))')
        records.get_by_role('button', name='Student records', exact=True).click()
        records.get_by_role('button', name='List view', exact=True).click()
        checks.append(f'{role}: cards/list page preservation, live clamp/regrowth, filter resets, details/focus, missing results, full sorted CSV and follow-up reasons')

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
        check_skills_insights(page, context, role, records)
        page.get_by_role('button', name='Category table', exact=True).click()
        expect(records.get_by_role('cell', name='Database', exact=True)).to_be_visible()
        page.get_by_role('button', name='Student records', exact=True).click()
        page.get_by_placeholder('Search student, ID, batch or instructor…').fill('SYN-009')
        expect(records.get_by_role('button', name='View details for Synthetic Student 09', exact=True)).to_be_visible()
        records.get_by_role('button', name='Card view', exact=True).click()
        expect(records.locator('.analytics-student-skills dd', has_text='0%')).to_have_count(4)
        records.get_by_role('button', name='List view', exact=True).click()
        page.get_by_placeholder('Search student, ID, batch or instructor…').fill('')
        checks.append(f'{role}: final skill bands, missing/locked evidence and zero scores retain student detail access')

        page.get_by_role('button', name='Placements', exact=True).click()
        check_placement_insights(page, context, role, records)
        page.get_by_role('button', name='Awaiting review', exact=True).click()
        expect(records.get_by_text('Awaiting placement review · 4 records', exact=False)).to_be_visible()
        page.get_by_role('button', name='Capacity table', exact=True).click()
        expect(records.get_by_role('cell', name='Developer Intern', exact=True)).to_be_visible()
        expect(records.get_by_role('cell', name='15', exact=True)).to_be_visible()
        page.get_by_label('Approved position / capacity', exact=True).select_option(label='Network Intern')
        expect(page.get_by_role('heading', name='Shared position slots', exact=True).first).to_be_visible()
        page.get_by_role('button', name='Capacity table', exact=True).click()
        expect(records.get_by_role('cell', name='Developer Intern', exact=True)).to_have_count(0)
        page.get_by_role('button', name='Reset analytics filters', exact=True).click()
        page.get_by_role('button', name='Residence / company areas', exact=True).click()
        expect(records.get_by_role('cell', name='Tagum City', exact=True)).to_be_visible()
        expect(records.get_by_role('cell', name='Davao City', exact=True)).to_be_visible()
        page.get_by_role('button', name='Student records', exact=True).click()
        checks.append(f'{role}: current placement review, global slot consumption and company/position filtering')

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
        check_activity_calendar(page, role)
        clock_now = datetime.now(ZoneInfo('Asia/Manila'))
        today = clock_now.strftime('%Y-%m-%d')
        first_date = (clock_now - timedelta(days=10)).strftime('%Y-%m-%d')
        last_date = (clock_now - timedelta(days=5)).strftime('%Y-%m-%d')
        error_date = (clock_now - timedelta(days=3)).strftime('%Y-%m-%d')
        tomorrow = (clock_now + timedelta(days=1)).strftime('%Y-%m-%d')
        records.evaluate('node => node.dataset.preserved = "yes"')
        page.evaluate('window.analyticsDocumentSentinel = "preserved"')
        local_requests = []
        def observe_activity_request(request):
            if urlparse(request.url).path == '/api/management/analytics/':
                local_requests.append(request.url)
        page.on('request', observe_activity_request)
        set_activity_date(page, 'Activity from', tomorrow)
        set_activity_date(page, 'Activity through', today)
        date_form.get_by_role('button', name='Apply dates', exact=True).click()
        expect(date_form.get_by_role('alert')).to_have_text('The start date must be on or before the end date.')
        for chosen in [first_date, last_date, error_date]:
            set_activity_date(page, 'Activity from', chosen)
            button = date_form.get_by_role('button', name='Apply dates', exact=True)
            button.focus()
            scroll_before = page.evaluate('scrollY')
            control = button.element_handle()
            button.click()
            expect_activity_date(page, 'Activity from', chosen)
            expect(date_form.get_by_label('Activity period', exact=True)).to_have_value('custom')
            expect(records).to_have_attribute('data-preserved', 'yes')
            assert control.evaluate('node => node.isConnected && node === document.activeElement')
            assert abs(page.evaluate('scrollY') - scroll_before) < 3
        assert not local_requests, local_requests
        assert page.evaluate('window.analyticsDocumentSentinel') == 'preserved'
        page.remove_listener('request', observe_activity_request)
        page.get_by_role('button', name='Reset analytics filters', exact=True).click()
        expect(date_form.get_by_label('Activity period', exact=True)).to_have_value('monthly')
        checks.append(f'{role}: local activity validation, retained DOM/focus/scroll, latest date selection and no extra analytics requests')

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
(ARTIFACTS / ('placement-checks.json' if '--placements-only' in sys.argv else 'calendar-checks.json' if '--calendar-only' in sys.argv else 'progress-panel-checks.json' if '--panels-only' in sys.argv else 'checks.json')).write_text(json.dumps({'checks': checks, 'page_errors': errors}, indent=2), encoding='utf-8')
print(json.dumps({'passed': len(checks), 'checks': checks}, indent=2), flush=True)
