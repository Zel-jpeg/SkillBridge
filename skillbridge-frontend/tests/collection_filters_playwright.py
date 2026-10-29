"""Shared grouped filters on three real routes, synthetic read-only API data."""
import json
import re
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:5178'
OUT = Path(__file__).parent / 'artifacts/collection-filters'
OUT.mkdir(parents=True, exist_ok=True)
ASSESSMENTS = [dict(id=i, title=f'Sample Assessment {i:02d}', instructor_name='Coordinator A' if i % 2 else 'Coordinator B',
    batch_id=1 if i % 2 else 2, batch_name='Blue cohort' if i % 2 else 'Green cohort', publication_status='published' if i % 2 else 'draft',
    is_required=bool(i % 2), include_in_competency=i % 3 != 0, categories=['Database' if i % 2 else 'Networking'],
    duration_minutes=30, question_count=10, display_order=i, created_at='2026-10-01T00:00:00Z',
    available_at=None, due_at=None, availability_status='available' if i % 2 else 'draft',
    assigned_count=10, submission_count=5, completion_count=5, completion_rate=50 if i % 2 else 100, flagged_count=0) for i in range(1,14)]
STUDENTS = [dict(id=i, name=f'Sample Student {i:02d}', student_id=f'QA-{i:03d}', email=f'student{i}@example.invalid',
    is_active=i != 14, course='BSIT' if i % 2 else 'BSIS', instructor='Coordinator A' if i % 2 else 'Coordinator B',
    status='completed' if i % 2 else 'pending', recommendations_locked=True) for i in range(1,15)]
USERS = dict(students=STUDENTS, instructors=[dict(id=101, name='Coordinator A', email='a@example.invalid', is_active=True),
    dict(id=102, name='Coordinator B', email='b@example.invalid', is_active=True)], pending_instructors=[dict(id=103, name='Pending Coordinator', email='pending@example.invalid')])
checks, errors, writes = [], [], []


def visit(browser, role, path, width=1440, height=1000, dark=False, failure=False):
    context = browser.new_context(viewport={'width': width, 'height': height}, reduced_motion='reduce')
    values = {'sb-token': 'synthetic-only', 'sb-role': role, 'sb-user': json.dumps(dict(id=900, role=role, name='Sample Staff', is_approved=True)), 'sb-theme': 'dark' if dark else 'light'}
    context.add_init_script('for(const[k,v]of Object.entries('+json.dumps(values)+'))localStorage.setItem(k,v);window.EventSource=class{close(){}};')
    def route(r):
        url = urlparse(r.request.url)
        if not url.path.startswith('/api/'):
            return r.continue_() if url.hostname in ['localhost','127.0.0.1'] else r.abort()
        if r.request.method != 'GET':
            writes.append(url.path); return r.fulfill(status=405,json={'error':'Read-only fixture'})
        if failure and url.path in ['/api/admin/users/', '/api/instructor/assessments/']:
            return r.fulfill(status=503,json={'error':'Synthetic unavailable'})
        if url.path.endswith('/me/'): data = json.loads(values['sb-user'])
        elif url.path == '/api/admin/users/': data = USERS
        elif url.path == '/api/instructor/assessments/': data = ASSESSMENTS
        elif url.path == '/api/instructor/batches/': data = [dict(id=1,name='Blue cohort',status='active'),dict(id=2,name='Green cohort',status='archived')]
        elif url.path == '/api/categories/': data = [dict(id=1,name='Database'),dict(id=2,name='Networking')]
        elif url.path == '/api/management/assessment-reports/': data = dict(rows=[],generated_at='2026-10-29T00:00:00Z')
        elif url.path == '/api/management/analytics/':
            data = dict(summary={key:0 for key in ['students','required_complete','approved','unplaced','awaiting_review','needs_followup','slots_remaining']}, scope={},
                options={key:[] for key in ['batches','instructors','courses','assessments','companies','positions','areas']}, generated_at='2026-10-29T00:00:00Z',role=role,
                **{key:[] for key in ['students','placement_students','assessments','batches','skills','capacity','match_bands','companies','areas','geography','activity']})
        elif url.path == '/api/placements/': data = {'placements':[]}
        elif url.path == '/api/placements/suggestions/': data = {'companies':[],'eligible_students':[]}
        elif url.path == '/api/placements/draft/': data = dict(revision=0,generated=False,stale=False,proposed_counts={},students=[])
        elif url.path == '/api/placements/reports/': data = {'records':[],'summary':{}}
        else: data = []
        return r.fulfill(json=data)
    context.route('**/*',route)
    page = context.new_page()
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.on('console',lambda message:errors.append(message.text) if message.type=='error' and 'same key' in message.text else None)
    page.goto(BASE+path);page.wait_for_load_state('networkidle')
    toolbar = page.get_by_role('region',name='User filters' if path.endswith('/users') else 'Assessment filters',exact=True)
    return context,page,toolbar


def open_panel(page,toolbar):
    toolbar.get_by_role('button',name=re.compile('^Filters')).click()
    panel=page.get_by_role('dialog',name=re.compile('filters options$',re.I))
    expect(panel).to_be_visible()
    return panel


def choose(panel,group,text):
    panel.get_by_role('group',name=group,exact=True).get_by_text(text,exact=True).click()


def apply(panel,count,noun):
    panel.get_by_role('button',name=f'Show {count} {noun[:-1] if count==1 else noun}',exact=True).click()
    expect(panel).to_have_count(0)


def exercise(browser,role,path,width,height,dark):
    context,page,toolbar=visit(browser,role,path,width,height,dark)
    users=path.endswith('/users'); noun='users' if users else 'assessments'
    expect(toolbar.get_by_role('status')).to_have_text(f'13 of 13 {noun}')
    assert toolbar.get_by_role('searchbox').bounding_box()['height']==38
    panel=open_panel(page,toolbar)
    expect(panel.get_by_role('group')).to_have_count(3 if users else 8 if role=='admin' else 6)
    assert panel.locator('.sb-roster-filter-chip').first.bounding_box()['height']==28
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    footer=panel.locator('footer').bounding_box()
    assert footer['y']+footer['height']<=height+1
    page.screenshot(path=str(OUT/f'{role}-{noun}-{width}-{dark}.png'),animations='disabled')
    choose(panel,'Course','BSIT') if users else choose(panel,'Publication status','Published')
    expect(panel.get_by_role('button',name=f'Show 7 {noun}',exact=True)).to_be_enabled()
    expect(page.locator('.sb-roster-secondary [role=status]')).to_have_text(f'13 of 13 {noun}')
    page.keyboard.press('Escape');expect(panel).to_have_count(0)
    expect(toolbar.get_by_role('button',name='Filters',exact=True)).to_be_focused()
    panel=open_panel(page,toolbar)
    choose(panel,'Course','BSIT') if users else choose(panel,'Publication status','Published')
    choose(panel,'Assessment status','Completed') if users else choose(panel,'Requirement','Required')
    if users: choose(panel,'Instructor','Coordinator A')
    else:
        choose(panel,'Competency inclusion','Result only' if role=='instructor' else 'Excluded')
        choose(panel,'Batch','Blue cohort')
        choose(panel,'Skill category','Database')
        choose(panel,'Availability','Available')
        if role=='admin':
            choose(panel,'Instructor','Coordinator A');choose(panel,'Completion','Below 100%')
    expected=7 if users else 2
    apply(panel,expected,noun)
    expect(toolbar.get_by_role('status')).to_have_text(f'{expected} of 13 {noun}')
    if width>=640:
        toolbar.get_by_role('button',name='List view',exact=True).click()
        expect(page.locator('tbody tr:visible')).to_have_count(min(10 if users else 4,expected))
        toolbar.get_by_role('button',name='Card view',exact=True).click()
    toolbar.get_by_role('button',name='Clear filters',exact=True).click()
    page.get_by_role('button',name='2',exact=True).click()
    panel=open_panel(page,toolbar)
    choose(panel,'Course','BSIT') if users else choose(panel,'Publication status','Published')
    apply(panel,7,noun)
    # Both collections reset to the first filtered page.
    if users: expect(page.locator('.sp-card:visible')).to_have_count(7)
    else:
        expect(page.get_by_role('button',name=re.compile('^(Open assessment|View details for) Sample Assessment')).filter(visible=True)).to_have_count(4)
    toolbar.get_by_role('searchbox').fill('  QA-001  ' if users else '  Sample Assessment 01  ')
    expect(toolbar.get_by_role('status')).to_have_text(f'1 of 13 {noun}')
    panel=open_panel(page,toolbar);panel.get_by_role('button',name='Clear filters',exact=True).click();apply(panel,13,noun)
    expect(toolbar.get_by_role('searchbox')).to_have_value('')
    checks.append(f'{role} {noun} {width}x{height} {dark=}: compact layout, all filter dimensions, draft/cancel/apply/reset, search, view and pagination')
    print(checks[-1],flush=True)
    context.close()


def tabs_and_errors(browser):
    context,page,toolbar=visit(browser,'admin','/admin/users')
    panel=open_panel(page,toolbar);choose(panel,'Course','BSIS');apply(panel,6,'users')
    page.get_by_role('button',name=re.compile(r'^Instructors(?:\s|$)')).click()
    expect(toolbar.get_by_role('button',name=re.compile('^Filters'))).to_have_count(0)
    expect(toolbar.get_by_role('status')).to_have_text('2 of 2 users')
    page.get_by_role('button',name=re.compile(r'^Archived(?:\s|$)')).click()
    expect(toolbar.get_by_role('status')).to_have_text('1 of 1 user')
    page.get_by_role('button',name=re.compile(r'^Students(?:\s|$)')).click()
    expect(toolbar.get_by_role('status')).to_have_text('6 of 13 users')
    panel=open_panel(page,toolbar)
    radio=panel.get_by_role('group',name='Course',exact=True).get_by_role('radio',name='BSIS',exact=True)
    radio.focus();page.keyboard.press('ArrowLeft')
    expect(panel.get_by_role('group',name='Course',exact=True).get_by_role('radio',name='BSIT',exact=True)).to_be_checked()
    panel.get_by_role('button',name='Close filters').click()
    expect(toolbar.get_by_role('status')).to_have_text('6 of 13 users')
    context.close()
    for role,path in [('admin','/admin/users'),('admin','/admin/assessments'),('instructor','/instructor/assessments')]:
        context,page,toolbar=visit(browser,role,path,failure=True)
        expect(toolbar.get_by_role('status')).to_have_text('Results unavailable')
        panel=open_panel(page,toolbar)
        expect(panel.get_by_role('button',name='Results unavailable',exact=True)).to_be_disabled()
        context.close()
    checks.append('Users tab isolation, native keyboard choices, close cancellation and all three initial error states')
    print(checks[-1],flush=True)


with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True)
    try:
        for role,path in [('instructor','/instructor/assessments'),('admin','/admin/assessments'),('admin','/admin/users')]:
            for width,height in [(320,568),(375,812),(768,1024),(1440,1000),(812,375)]:
                for dark in [False,True]: exercise(browser,role,path,width,height,dark)
        tabs_and_errors(browser)
        assert not errors,errors
        assert not writes,writes
    finally:
        browser.close()
        (OUT/'results.json').write_text(json.dumps(dict(checks=checks,errors=errors,writes=writes),indent=2))
