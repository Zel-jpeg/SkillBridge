"""Admin instructor profile: card presentation, responsive editing and native modal behavior.
All responses are synthetic. Run using with_server.py on port 5178.
"""
import json
import re
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

OUT=Path(__file__).parent/'artifacts/instructor-detail'
OUT.mkdir(parents=True,exist_ok=True)
checks,errors=[],[]
admin={'id':1,'name':'Synthetic Admin','role':'admin','is_approved':True}
teacher={'id':2,'name':'Sample Instructor','email':'instructor@example.invalid','instructor_id':'SYN-IN-002','department':'Institute of Computing','courses':'BSIT / BSIS','is_approved':True,'is_active':True}
analytics={'generated_at':'2026-10-26T00:00:00Z','role':'admin','scope':{},'summary':{key:0 for key in ['students','required_complete','approved','unplaced','awaiting_review','needs_followup','slots_remaining','pending_instructors']},'options':{key:[] for key in ['batches','instructors','courses','assessments','companies','positions','areas']},**{key:[] for key in ['students','placement_students','assessments','batches','skills','capacity','match_bands','companies','areas','geography','activity']}}

with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True)
    context=browser.new_context(viewport={'width':1366,'height':950},reduced_motion='reduce')
    context.add_init_script('const identity='+json.dumps(admin)+";localStorage.setItem('sb-token','synthetic-only');localStorage.setItem('sb-role','admin');localStorage.setItem('sb-user',JSON.stringify(identity));window.EventSource=class{close(){}};")
    context.add_init_script('sessionStorage.clear()')
    writes=[]
    def route(r):
        u=urlparse(r.request.url)
        if u.hostname not in ['127.0.0.1','localhost']: return r.abort()
        if not u.path.startswith('/api/'): return r.continue_()
        if u.path.endswith('/events/'): return r.fulfill(status=204)
        if u.path=='/api/auth/me/': return r.fulfill(json=admin)
        if u.path=='/api/management/analytics/': return r.fulfill(json=analytics)
        if u.path=='/api/admin/users/' and r.request.method=='GET':
            return r.fulfill(json={'students':[],'instructors':[teacher] if teacher['is_active'] else [],'pending_instructors':[],'archived_students':[],'archived_instructors':[] if teacher['is_active'] else [teacher]})
        if r.request.method!='GET':
            writes.append(u.path)
            return r.fulfill(status=400,json={'error':'Synthetic failure; retain the edited fields.'})
        return r.fulfill(json=[])
    context.route('**/*',route)
    page=context.new_page(); page.set_default_timeout(15000)
    page.on('pageerror',lambda error:errors.append(str(error)))
    def open_profile(archived=False):
        page.goto('http://127.0.0.1:5178/admin/users')
        page.wait_for_load_state('networkidle')
        page.get_by_role('button',name=re.compile('^Archived' if archived else '^Instructors')).click()
        trigger=page.get_by_text(teacher['name'],exact=True)
        trigger.click()
        dialog=page.get_by_role('dialog',name=teacher['name'],exact=True)
        expect(dialog).to_be_visible()
        return dialog
    def geometry(dialog):
        box=dialog.bounding_box(); size=page.viewport_size
        assert box['x']>=-1 and box['y']>=-1 and box['x']+box['width']<=size['width']+1 and box['y']+box['height']<=size['height']+1,box
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert dialog.evaluate('el=>el.scrollWidth<=el.clientWidth+1')
        close=dialog.get_by_role('button',name='Close details',exact=True)
        rect=close.bounding_box(); assert rect['width']>=44 and rect['height']>=44
        assert rect['y']>=box['y']-1 and rect['y']+rect['height']<=box['y']+box['height']+1
        assert page.evaluate('document.body.style.overflow')=='hidden'
    for width,height in [(1366,950),(768,1024),(375,812),(320,568),(812,375)]:
        page.set_viewport_size({'width':width,'height':height})
        for dark in [False,True]:
            page.evaluate('(dark)=>document.documentElement.classList.toggle("dark",dark)',dark)
            dialog=open_profile()
            # The app preserves the root theme across these navigations only via storage;
            # apply this synthetic test theme after the route has loaded as well.
            page.evaluate('(dark)=>document.documentElement.classList.toggle("dark",dark)',dark)
            geometry(dialog)
            expect(dialog.get_by_text('Instructor profile',exact=True)).to_be_visible()
            expect(dialog.get_by_text('Active account',exact=True)).to_be_visible()
            expect(dialog.get_by_role('region',name='Instructor department',exact=True)).to_contain_text('Institute of Computing')
            expect(dialog.get_by_role('region',name='Instructor courses',exact=True)).to_contain_text('BSIT / BSIS')
            if width in [1366,375]: page.screenshot(path=str(OUT/f'profile-{width}-{"dark" if dark else "light"}.png'))
            edit=dialog.get_by_role('button',name='Edit instructor',exact=True)
            edit.click(); geometry(dialog)
            expect(dialog.get_by_label('name',exact=True)).to_be_focused()
            dialog.get_by_label('name',exact=True).fill('Unsaved synthetic name')
            dialog.get_by_role('button',name='Cancel',exact=True).click()
            expect(edit).to_be_focused()
            edit.click(); expect(dialog.get_by_label('name',exact=True)).to_have_value(teacher['name'])
            if width==375: page.screenshot(path=str(OUT/f'edit-{width}-{"dark" if dark else "light"}.png'))
            dialog.get_by_role('button',name='Cancel',exact=True).click()
            page.keyboard.press('Escape'); expect(dialog).to_have_count(0)
            assert page.evaluate('document.body.style.overflow')!='hidden'
            assert not writes
            checks.append(f'{width}x{height} {dark=}: profile cards, edit/cancel, keyboard focus, native dialog and bounds')
    page.set_viewport_size({'width':1366,'height':950})
    teacher.update(name='Sample Instructor With A Very Long Account Name For Responsive Profile Verification',email='long.synthetic.instructor.account@example.invalid',department='Institute of Computing and Information Systems With An Extended Department Name',courses='BSIT / BSIS / Synthetic Continuing Professional Education')
    dialog=open_profile(); geometry(dialog)
    page.set_viewport_size({'width':320,'height':568}); geometry(dialog)
    page.keyboard.press('Escape')
    checks.append('Long identities, department and course labels wrap without page/dialog overflow')
    dialog=open_profile()
    dialog.get_by_role('button',name='Edit instructor',exact=True).click()
    name=dialog.get_by_label('name',exact=True); name.fill('Failed synthetic edit'); name.press('Enter')
    expect(dialog.locator('.instructor-detail-footer > [role="alert"]')).to_have_text('Synthetic failure; retain the edited fields.')
    expect(name).to_have_value('Failed synthetic edit')
    assert len(writes)==1
    dialog.get_by_role('button',name='Cancel',exact=True).click()
    expect(dialog.locator('.instructor-detail-footer > [role="alert"]')).to_have_count(0)
    page.keyboard.press('Escape')
    checks.append('Enter submits the existing save action; rejected save retains draft and Cancel clears the error')
    teacher.update(name='Sample Instructor',email='',instructor_id='',department='',courses='',is_active=False)
    dialog=open_profile(archived=True); geometry(dialog)
    expect(dialog.get_by_text('Archived',exact=True)).to_be_visible()
    expect(dialog.get_by_text('Email not provided',exact=True)).to_be_visible()
    expect(dialog.get_by_text('No instructor ID',exact=True)).to_be_visible()
    expect(dialog.get_by_role('button',name='Restore account',exact=True)).to_be_visible()
    expect(dialog.get_by_role('button',name='Remove instructor',exact=True)).to_have_count(0)
    expect(dialog.get_by_text('Not provided',exact=True)).to_have_count(2)
    page.keyboard.press('Escape')
    checks.append('Archived state retains restore action and honest missing-field placeholders')
    context.close(); browser.close()
assert not errors,errors
(OUT/'checks.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'page_errors':errors},indent=2),encoding='utf-8')
print(json.dumps({'passed':len(checks),'checks':checks,'page_errors':errors},indent=2))
