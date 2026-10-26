"""Admin batch designs, shared collections, centered confirmations and mutation recovery.
Synthetic API only; no backend or real-record writes. Start Vite on port 5178.
"""
import json
import re
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:5178'
OUT = Path(__file__).parent / 'artifacts/admin-batches'
OUT.mkdir(parents=True, exist_ok=True)
USER = {'id': 1, 'name': 'Synthetic Admin', 'role': 'admin', 'is_approved': True}
BATCHES = '/api/instructor/batches/'
OWNERS = [{'id': 2, 'name': 'Alex Rivera'}, {'id': 3, 'name': 'Sam Cruz'}]
PHOTO = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40"%3E%3Crect width="40" height="40" fill="%2393c5fd"/%3E%3Ccircle cx="20" cy="14" r="7" fill="%231e3a8a"/%3E%3Cpath d="M5 40a15 15 0 0 1 30 0" fill="%231e3a8a"/%3E%3C/svg%3E'
analytics = {'generated_at': '2026-10-26T00:00:00Z', 'role': 'admin', 'scope': {},
    'summary': {key: 0 for key in ['students','required_complete','approved','unplaced','awaiting_review','needs_followup','slots_remaining','pending_instructors']},
    'options': {key: [] for key in ['batches','instructors','courses','assessments','companies','positions','areas']},
    **{key: [] for key in ['students','placement_students','assessments','batches','skills','capacity','match_bands','companies','areas','geography','activity']}}
batches = [{'id': i, 'name': 'BSIT 4A' if i == 1 else f'Sample batch {i:02d}', 'instructor_id': 2 if i % 2 else 3,
    'instructor_name': 'Alex Rivera' if i % 2 else 'Sam Cruz', 'status': 'archived' if i % 5 == 0 else 'active',
    'student_count': 21 if i == 1 else 0, 'created_by_id': 1 if i % 2 else None,
    'instructor_photo_url': PHOTO if i == 1 else BASE+'/synthetic-unavailable.png' if i == 3 else ''} for i in range(1, 15)]
students = [{'id': i, 'name': f'Sample Student {i:02d}', 'school_id': f'SYN-{i:03d}', 'course': 'BSIT',
    'completed_required_count': 2 if i % 3 == 1 else 1 if i % 3 == 2 else 0, 'total_required_count': 2,
    'remaining_required_count': 0 if i % 3 == 1 else 1 if i % 3 == 2 else 2,
    'all_required_completed': i % 3 == 1, 'recommendations_locked': i % 3 != 1,
    'combined_category_scores': [{'category': 'Web Development', 'percentage': 90, 'raw_score': 9, 'max_score': 10}] if i % 3 == 1 else [],
    'assessment_results': [{'id': 10, 'title': 'Synthetic assessment', 'is_required': True, 'include_in_competency': True,
        'attempt_status': 'submitted' if i % 3 == 1 else 'in_progress' if i % 3 == 2 else 'not_started',
        'retake_allowed': False, 'category_scores': [], 'prior_attempts': []}]} for i in range(1, 22)]
checks, errors, writes = [], [], []
fail_action = {'unenroll': True, 'archive': True}
review_row = {'school_id': 'SYN-100', 'name': 'New Sample Student', 'email': 'new.sample@dnsc.edu.ph',
    'course': 'BSIT', 'source_row': 1, 'status': 'ready', 'email_source': 'Provided', 'issues': []}
summary = {key: 0 for key in ['total','ready','existing_students','already_enrolled','unsupported','duplicate','invalid','conflict','enrolled','notifications_queued']}
summary.update(total=1, ready=1)

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce')
    context.add_init_script('localStorage.setItem("sb-token","synthetic");localStorage.setItem("sb-role","admin");localStorage.setItem("sb-user",'+json.dumps(json.dumps(USER))+');window.EventSource=class{close(){}};')
    def route(r):
        u, method = urlparse(r.request.url), r.request.method
        if u.hostname not in ['localhost','127.0.0.1']: return r.abort()
        if u.path == '/synthetic-unavailable.png': return r.fulfill(status=404,body='')
        if not u.path.startswith('/api/'): return r.continue_()
        if u.path.endswith('/events/'): return r.fulfill(status=204)
        if u.path == '/api/auth/me/': return r.fulfill(json=USER)
        if u.path == '/api/management/analytics/': return r.fulfill(json=analytics)
        if u.path == '/api/admin/users/': return r.fulfill(json={'students': [], 'instructors': [], 'pending_instructors': []})
        if u.path == '/api/admin/batch-instructors/': return r.fulfill(json=OWNERS)
        if u.path == '/api/admin/management-actions/': return r.fulfill(json={'count': 0, 'results': []})
        if method != 'GET': writes.append((method, u.path + ('?'+u.query if u.query else ''), r.request.post_data_json if method != 'DELETE' else None))
        if u.path == BATCHES:
            if method == 'GET': return r.fulfill(json=batches)
            data = r.request.post_data_json
            owner = next(x for x in OWNERS if x['id'] == data['instructor_id'])
            row = {'id': 30, 'name': data['name'], 'instructor_id': owner['id'], 'instructor_name': owner['name'], 'status': 'active', 'student_count': 0, 'created_by_id': 1}
            batches.insert(0,row)
            return r.fulfill(status=201,json=row)
        if re.match(r'/api/admin/batches/\d+/$',u.path):
            row = next(x for x in batches if x['id'] == int(u.path.split('/')[-2]))
            row.update(r.request.post_data_json)
            row['instructor_name'] = next(x['name'] for x in OWNERS if x['id'] == row['instructor_id'])
            return r.fulfill(json=row)
        if u.path.endswith('/students/') and '/batches/' in u.path: return r.fulfill(json={'students': students if '/1/' in u.path else []})
        if u.path.endswith('/archive/') or u.path.endswith('/unarchive/'):
            action = u.path.split('/')[-2]
            if action == 'archive' and fail_action['archive']:
                fail_action['archive'] = False
                return r.fulfill(status=503,json={'error':'Synthetic archive rejected'})
            row = next(x for x in batches if x['id'] == int(u.path.split('/')[-3]))
            row['status'] = 'archived' if action == 'archive' else 'active'
            return r.fulfill(json=row)
        if u.path == '/api/instructor/students/1/' and method == 'DELETE':
            if fail_action['unenroll']:
                fail_action['unenroll'] = False
                return r.fulfill(status=409,json={'error':'Synthetic unenrollment rejected'})
            students[:] = [x for x in students if x['id'] != 1]
            batches[0]['student_count'] = len(students)
            return r.fulfill(json={'id':1})
        if u.path.endswith('/enroll/preview/'):
            return r.fulfill(json={'rows':[review_row], 'summary':summary, 'review_token':'synthetic-review'})
        if u.path.endswith('/enroll/'):
            return r.fulfill(json={'rows':[review_row], 'summary':{**summary,'ready':0,'enrolled':1}})
        if u.path.endswith('/retake/'):
            return r.fulfill(json={'assessment_id':10,'retake_allowed':True})
        return r.fulfill(json=[])
    context.route('**/*',route)
    page = context.new_page(); page.set_default_timeout(12000); page.set_default_navigation_timeout(30000)
    page.on('pageerror', lambda error: errors.append(str(error)))
    def confirmation(name):
        dialog=page.get_by_role('dialog',name=name,exact=True)
        expect(dialog).to_be_visible()
        box=dialog.bounding_box(); size=page.viewport_size
        assert abs(box['x']+box['width']/2-size['width']/2)<2,box
        assert abs(box['y']+box['height']/2-size['height']/2)<2,box
        return dialog
    def shot(name):
        while page.get_by_role('button',name='Dismiss notification',exact=True).count(): page.get_by_role('button',name='Dismiss notification',exact=True).first.click()
        page.screenshot(path=str(OUT/f'{name}.png'))
    def geometry():
        if page.evaluate('document.documentElement.scrollWidth > innerWidth'):
            page.screenshot(path=str(OUT/'overflow.png'))
            print(page.evaluate('JSON.stringify({width:innerWidth,doc:document.documentElement.scrollWidth,body:document.body.scrollWidth,bodyStyle:document.body.getAttribute("style"),outside:[...document.querySelectorAll("body *")].filter(n=>n.getBoundingClientRect().right>innerWidth+1 && !n.closest(".batch-table-wrap")).slice(0,15).map(n=>({tag:n.tagName,cls:n.className,w:n.getBoundingClientRect().width,right:n.getBoundingClientRect().right}))})'))
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),page.viewport_size
    def overview():
        back=page.get_by_role('button',name='Back to batches',exact=True)
        if back.count(): back.click()
    def open_main():
        overview()
        page.get_by_label('Search batches',exact=True).fill('BSIT 4A')
        page.get_by_role('region',name='Batch collection',exact=True).get_by_role('button',name=re.compile('BSIT 4A')).first.click()
        expect(page.get_by_role('heading',name='BSIT 4A',exact=True)).to_be_visible()
    page.goto(BASE+'/admin/batches'); page.wait_for_load_state('networkidle')
    collection=page.get_by_role('region',name='Batch collection',exact=True)
    expect(collection.locator('.batch-card')).to_have_count(10)
    photo = collection.locator('.batch-card').first.get_by_role('img',name='Alex Rivera',exact=True)
    expect(photo).to_have_attribute('src',PHOTO)
    expect(photo).to_be_visible()
    assert photo.evaluate('img=>img.complete && img.naturalWidth>0')
    expect(collection.locator('.batch-card').nth(1).get_by_role('img',name='Sam Cruz avatar')).to_be_visible()
    expect(collection.locator('.batch-card').nth(2).get_by_role('img',name='Alex Rivera avatar')).to_be_visible()
    page.get_by_role('button',name='Next →').click()
    expect(collection.locator('.batch-card')).to_have_count(4)
    page.get_by_role('button',name='List view',exact=True).click()
    expect(collection.locator('tbody tr')).to_have_count(4)
    page.get_by_label('Search batches',exact=True).fill('BSIT')
    expect(collection.locator('tbody tr')).to_have_count(1)
    expect(collection.locator('tbody').get_by_role('img',name='Alex Rivera',exact=True)).to_have_attribute('src',PHOTO)
    row=collection.locator('tbody tr').first
    row.locator('td').nth(1).click() # Whole row, not its name.
    expect(page.get_by_role('heading',name='BSIT 4A',exact=True)).to_be_focused()
    overview()
    expect(page.get_by_label('Search batches',exact=True)).to_have_value('BSIT')
    expect(page.get_by_role('button',name='BSIT 4A',exact=True)).to_be_focused()
    page.get_by_role('button',name='BSIT 4A',exact=True).press('Space')
    expect(page.get_by_role('heading',name='BSIT 4A',exact=True)).to_be_visible()
    checks.append('Shared batch toggle, ten-record pagination, full-row activation, keyboard selection, preserved overview search/view and return focus')
    roster=page.get_by_role('region',name='Batch students',exact=True)
    expect(roster.locator('tbody tr')).to_have_count(10)
    roster.get_by_role('button',name='Next →').click()
    roster.get_by_role('button',name='Card view',exact=True).click()
    expect(roster.locator('.batch-roster-card')).to_have_count(10)
    expect(roster.get_by_text('Showing 11–20 of 21',exact=True)).to_be_visible()
    page.get_by_label('Search batch students',exact=True).fill('SYN-001')
    expect(roster.locator('.batch-roster-card')).to_have_count(1)
    roster.get_by_role('button',name='List view',exact=True).click()
    roster.locator('tbody tr td').nth(1).click()
    student_dialog=page.get_by_role('dialog',name='Sample Student 01',exact=True)
    expect(student_dialog).to_be_visible()
    student_dialog.get_by_role('tab',name=re.compile('^Assessments')).click()
    student_dialog.get_by_role('button',name=re.compile('^Approve retake for')).click()
    retake=confirmation('Approve retake for Synthetic assessment?')
    before=len(writes); retake.get_by_role('button',name='Cancel',exact=True).click(); assert len(writes)==before
    page.keyboard.press('Escape'); expect(student_dialog).not_to_be_visible()
    expect(roster.get_by_role('button',name='Sample Student 01',exact=True)).to_be_focused()
    checks.append('Student shared toggle preserves page/search; row opens details; retake decision stays centered and cancel performs no write')
    before=len(writes)
    roster.get_by_role('button',name='Unenroll Sample Student 01 from batch',exact=True).click()
    dialog=confirmation('Unenroll from this batch?')
    expect(dialog).to_contain_text('Sample Student 01 from BSIT 4A')
    assert page.locator('dialog[open]').count()==1
    dialog.get_by_role('button',name='Cancel',exact=True).click(); assert len(writes)==before
    roster.get_by_role('button',name='Unenroll Sample Student 01 from batch',exact=True).click()
    dialog=confirmation('Unenroll from this batch?'); shot('centered-unenroll')
    dialog.get_by_role('button',name='Unenroll student',exact=True).click()
    expect(dialog.locator('[role="alert"]:not(.sb-toast-message)')).to_be_visible()
    assert len(students)==21
    dialog.get_by_role('button',name='Unenroll student',exact=True).click(); expect(dialog).not_to_be_visible()
    assert writes[-1][1]=='/api/instructor/students/1/?batch_id=1' and len(students)==20
    page.get_by_label('Search batch students',exact=True).fill('')
    checks.append('Independent unenroll action, centered named confirmation, no write on cancel, failed mutation recovery and exact batch-scoped retry')
    page.get_by_role('button',name='Archive batch',exact=True).click()
    dialog=confirmation('Archive this batch?'); before=len(writes)
    dialog.get_by_role('button',name='Cancel',exact=True).click(); assert len(writes)==before
    page.get_by_role('button',name='Archive batch',exact=True).click()
    dialog=confirmation('Archive this batch?'); dialog.get_by_role('button',name='Archive batch',exact=True).click()
    expect(dialog.locator('[role="alert"]:not(.sb-toast-message)')).to_be_visible()
    dialog.get_by_role('button',name='Archive batch',exact=True).click(); expect(dialog).not_to_be_visible()
    expect(page.get_by_text('This batch is archived.',exact=False)).to_be_visible()
    expect(page.get_by_role('button',name='Enroll students',exact=True)).to_have_count(0)
    page.get_by_role('button',name='Reactivate batch',exact=True).click()
    dialog=confirmation('Reactivate this batch?'); dialog.get_by_role('button',name='Reactivate batch',exact=True).click()
    expect(page.get_by_role('button',name='Enroll students',exact=True)).to_be_visible()
    checks.append('Centered archive/reactivate with impact text, cancellation, failed archive retry and actual status refresh')
    page.get_by_role('button',name='Manage batch',exact=True).click()
    editor=page.get_by_role('dialog',name='Manage batch',exact=True)
    editor.get_by_label('Responsible instructor',exact=True).select_option('3')
    editor.get_by_role('button',name='Review batch changes',exact=True).click()
    dialog=confirmation('Save batch ownership and name?'); expect(dialog).to_contain_text('Sam Cruz will replace Alex Rivera')
    before=len(writes); dialog.get_by_role('button',name='Cancel',exact=True).click(); assert len(writes)==before
    editor.get_by_role('button',name='Review batch changes',exact=True).click()
    dialog=confirmation('Save batch ownership and name?'); dialog.get_by_role('button',name='Save batch',exact=True).click()
    expect(editor).not_to_be_visible()
    expect(page.get_by_text('Responsible instructor · Sam Cruz',exact=True)).to_be_visible()
    checks.append('Manage batch review identifies both instructors, cancel preserves draft, confirmed change refreshes responsible instructor')
    page.get_by_role('button',name='Enroll students',exact=True).click()
    enrollment=page.get_by_role('dialog',name='Enroll students',exact=True)
    enrollment.get_by_role('button',name='Manual entry',exact=True).click()
    enrollment.get_by_label('DNSC Email',exact=True).fill(review_row['email'])
    enrollment.get_by_label('Full Name',exact=True).fill(review_row['name'])
    enrollment.get_by_label('Student ID',exact=True).fill(review_row['school_id'])
    enrollment.get_by_role('button',name='Preview student',exact=True).click()
    enrollment.get_by_role('checkbox').check()
    before=len(writes)
    enrollment.get_by_role('button',name='Confirm 1 enrollments',exact=True).click()
    dialog=confirmation('Confirm student enrollment?'); expect(dialog).to_contain_text('BSIT 4A with Sam Cruz')
    assert len(writes)==before
    dialog.get_by_role('button',name='Cancel',exact=True).click()
    expect(enrollment.get_by_role('checkbox')).to_be_checked()
    enrollment.get_by_role('button',name='Confirm 1 enrollments',exact=True).click()
    dialog=confirmation('Confirm student enrollment?'); dialog.get_by_role('button',name='Enroll students',exact=True).click()
    enrollment.get_by_role('button',name='Done',exact=True).click()
    assert writes[-1][1]=='/api/instructor/batches/1/enroll/' and writes[-1][2]['review_token']=='synthetic-review'
    checks.append('Enrollment retains preview/verification token, adds centered named final confirmation, cancel preserves review, exactly one confirmed write')
    page.get_by_role('button',name='View action history',exact=True).click()
    expect(page.get_by_role('region',name='Batch action history',exact=True)).to_contain_text('No recorded actions yet')
    page.get_by_role('button',name='Hide action history',exact=True).click()
    page.get_by_label('Search batch students',exact=True).fill('')
    for width,height in [(1440,1000),(1024,768),(768,1024),(375,812),(320,568),(812,375)]:
        page.set_viewport_size({'width':width,'height':height})
        for dark in [False,True]:
            page.evaluate('(dark)=>document.documentElement.classList.toggle("dark",dark)',dark)
            geometry(); shot(f'roster-{width}-{"dark" if dark else "light"}')
            page.get_by_role('button',name='Archive batch',exact=True).click()
            dialog=confirmation('Archive this batch?'); geometry()
            if width==320: shot('confirmation-320-'+('dark' if dark else 'light'))
            dialog.get_by_role('button',name='Cancel',exact=True).click()
            overview(); page.get_by_label('Search batches',exact=True).fill('')
            if width>=640:
                page.get_by_role('button',name='Card view',exact=True).click(); geometry(); shot(f'batches-{width}-{"dark" if dark else "light"}')
                page.get_by_role('button',name='List view',exact=True).click(); geometry()
            else: shot(f'batches-{width}-{"dark" if dark else "light"}')
            open_main()
    checks.append('Action history, twelve light/dark desktop/tablet/mobile/short layouts, card fallback, bounded tables, centered confirmations and no page overflow')
    overview(); page.get_by_label('Search batches',exact=True).fill('')
    page.set_viewport_size({'width':1440,'height':1000})
    page.get_by_role('button',name='Create batch',exact=True).click()
    editor=page.get_by_role('dialog',name='Create batch',exact=True)
    editor.get_by_label('Batch name',exact=True).fill('New synthetic batch')
    editor.get_by_label('Responsible instructor',exact=True).select_option('2')
    editor.get_by_role('button',name='Review batch changes',exact=True).click()
    dialog=confirmation('Create this batch?'); expect(dialog).to_contain_text('New synthetic batch with Alex Rivera')
    before=len(writes); dialog.get_by_role('button',name='Cancel',exact=True).click(); assert len(writes)==before
    editor.get_by_role('button',name='Review batch changes',exact=True).click()
    dialog=confirmation('Create this batch?'); dialog.get_by_role('button',name='Save batch',exact=True).click()
    expect(page.get_by_role('heading',name='New synthetic batch',exact=True)).to_be_visible()
    expect(page.get_by_text('No students enrolled in this batch.',exact=True)).to_be_visible()
    checks.append('Create batch uses centered review before mutation and selects only the confirmed server batch')
    assert not errors,errors
    context.close(); browser.close()
(OUT/'results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'page_errors':errors},indent=2),encoding='utf-8')
print(json.dumps({'passed':len(checks),'checks':checks,'page_errors':errors},indent=2))
