"""Focused activity period checks against the disposable analytics API.
Run: tests/run_admin_management.py --analytics --activity-periods
"""
import json
import os
import re
import time
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

OUT = Path(__file__).parent/'artifacts/analytics'
AUTH = json.loads((OUT/'auth.json').read_text(encoding='utf-8'))
BASE = os.environ['ADMIN_MANAGEMENT_FRONTEND_URL']
API = 'http://127.0.0.1:'+os.environ['ADMIN_MANAGEMENT_API_PORT']
checks, errors, timings = [], [], []
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True)
    for role in ['instructor','admin']:
        identity=AUTH[role]
        context=browser.new_context(viewport={'width':1440,'height':1000},timezone_id='America/New_York',reduced_motion='reduce')
        context.add_init_script('const identity='+json.dumps(identity)+';localStorage.setItem("sb-token",identity.token);localStorage.setItem("sb-role",identity.user.role);localStorage.setItem("sb-user",JSON.stringify(identity.user));window.EventSource=class{close(){}};')
        report_requests, held = [], []
        mode = {'hold': False, 'background': False}
        def route(r):
            u=urlparse(r.request.url)
            if u.path == '/api/management/analytics/':
                report_requests.append(u.query)
                if mode['background'] or (mode['hold'] and 'course=' in u.query):
                    held.append(r)
                    return
            if u.path.startswith('/api/'): return r.continue_(url=API+u.path+('?' + u.query if u.query else ''))
            if u.hostname not in ['127.0.0.1','localhost']:
                if u.path=='/gsi/client': return r.fulfill(body='window.google={accounts:{oauth2:{initTokenClient(){return {requestAccessToken(){}}}}}};',content_type='application/javascript')
                return r.abort()
            return r.continue_()
        context.route('**/*',route)
        page=context.new_page(); page.set_default_timeout(15000); page.set_default_navigation_timeout(30000)
        page.on('pageerror',lambda error:errors.append(str(error)))
        def api(period=None):
            response=context.request.get(API+'/api/management/analytics/'+('?'+'activity_period='+period if period else ''),headers={'Authorization':'Bearer '+identity['token']})
            assert response.status==200,response.status
            return response.json()
        def form(): return page.get_by_role('form',name='Submission activity dates',exact=True)
        def choose(period):
            control=form().get_by_label('Activity period',exact=True)
            control.focus()
            before_y=page.evaluate('scrollY')
            before_requests=len(report_requests)
            element=control.element_handle()
            graph=page.get_by_role('group',name='Submission activity graph',exact=True).element_handle()
            started=time.perf_counter()
            form().get_by_label('Activity period',exact=True).select_option(period)
            expect(form().get_by_label('Activity period',exact=True)).to_have_value(period)
            expect(form()).to_contain_text({'daily':'Daily (today)','weekly':'Weekly (this week)','monthly':'Monthly (this month)','yearly':'Yearly (this year)','all_time':'All time'}[period])
            page.wait_for_function('(period)=>new URLSearchParams(location.search).get("activity_period")===period',arg=period)
            timings.append(round((time.perf_counter()-started)*1000,1))
            expected=api(period)
            # Wait for the applied server scope, rather than the immediately selected draft option.
            note=form().locator('p').last
            expect(note).to_contain_text('Counts are grouped by '+{'day':'day','month':'month','year':'year'}[expected['scope']['activity_interval']])
            expect(note.locator('strong')).to_have_text({'daily':'Daily (today)','weekly':'Weekly (this week)','monthly':'Monthly (this month)','yearly':'Yearly (this year)','all_time':'All time'}[period])
            assert element.evaluate('n=>n.isConnected && n===document.activeElement')
            assert graph.evaluate('n=>n.isConnected')
            assert abs(page.evaluate('scrollY')-before_y)<3, (role,period,before_y,page.evaluate('scrollY'))
            assert len(report_requests)==before_requests,(before_requests,report_requests)
            return expected
        page.goto(BASE+f'/{role}/reports'); page.wait_for_load_state('networkidle')
        expect(form().get_by_label('Activity period',exact=True)).to_have_value('monthly')
        data=api(); today=date.fromisoformat(data['scope']['date_to'])
        assert data['scope']['date_from']==today.replace(day=1).isoformat()
        before=data['summary']
        for period in ['daily','weekly','yearly','all_time','monthly']:
            data=choose(period)
            assert data['summary']==before
            if period=='daily': assert data['scope']['date_from']==today.isoformat()
            if period=='weekly': assert data['scope']['date_from']==(today-timedelta(days=today.weekday())).isoformat()
            if period=='yearly': assert data['scope']['date_from']==today.replace(month=1,day=1).isoformat()
        checks.append(f'{role}: monthly default, exact five presets, zero additional browser report requests, retained graph/form/focus/scroll and unchanged authorized totals')
        choose('yearly')
        page.get_by_role('button',name='View monthly activity table',exact=True).click()
        records=page.get_by_role('region',name='Analytics records',exact=True)
        expect(records.get_by_role('columnheader',name='Sort by Philippine month',exact=True)).to_be_visible()
        with page.expect_download() as download:
            records.get_by_role('button',name='Download displayed CSV',exact=True).click()
        csv=Path(download.value.path()).read_text(encoding='utf-8-sig')
        assert 'Yearly (this year)' in csv and 'grouped by month' in csv and 'Philippine month' in csv
        checks.append(f'{role}: yearly chart opens monthly table and CSV carries actual range, period, bucket units and counts')
        form().get_by_label('Activity period',exact=True).select_option('custom')
        form().get_by_role('button',name=re.compile('^Activity from:')).click()
        picker=page.get_by_role('dialog',name='Activity from date',exact=True)
        picker.get_by_role('button',name='Clear',exact=True).click()
        form().get_by_role('button',name='Apply dates',exact=True).click()
        expect(form().get_by_role('alert')).to_have_text('Choose both a start date and an end date.')
        choose('monthly')
        expect(form().get_by_role('alert')).to_have_count(0)
        # Applying unchanged dates is local too and must not remount or jump.
        form().get_by_role('button',name='Apply dates',exact=True).focus()
        old_form=form().element_handle(); before_y=page.evaluate('scrollY'); before_requests=len(report_requests)
        form().get_by_role('button',name='Apply dates',exact=True).click()
        expect(form().get_by_label('Activity period',exact=True)).to_have_value('monthly')
        assert old_form.evaluate('n=>n.isConnected') and len(report_requests)==before_requests
        assert abs(page.evaluate('scrollY')-before_y)<3
        checks.append(f'{role}: custom calendar validation and Apply dates stay local, preserving form/scroll without a new request')
        # A true scope change needs server data, but keeps the current chart usable.
        form().scroll_into_view_if_needed(); before_y=page.evaluate('scrollY')
        before_form_top=form().evaluate('n=>n.getBoundingClientRect().top+scrollY')
        old_graph=page.get_by_role('group',name='Submission activity graph',exact=True).element_handle()
        mode['hold']=True
        page.get_by_label('Course',exact=True).evaluate('s=>{s.value="BSIT";s.dispatchEvent(new Event("change",{bubbles:true}))}')
        expect(form().get_by_role('status')).to_contain_text('Updating submission activity')
        expect(page.get_by_role('group',name='Submission activity graph',exact=True)).to_have_attribute('aria-busy','true')
        assert held and old_graph.evaluate('n=>n.isConnected')
        assert abs(page.evaluate('scrollY')-before_y)<3, {'before':before_y,'after':page.evaluate('scrollY'),'formBefore':before_form_top,'formAfter':form().evaluate('n=>n.getBoundingClientRect().top+scrollY'),'active':page.evaluate('document.activeElement.outerHTML.slice(0,220)')}
        held.pop().fulfill(status=503,json={'error':'Synthetic scoped-report outage'})
        expect(form().get_by_role('status')).to_contain_text('Activity could not refresh')
        assert old_graph.evaluate('n=>n.isConnected')
        form().get_by_role('button',name='Retry activity',exact=True).click()
        expect(form().get_by_role('status')).to_contain_text('Updating submission activity')
        pending=held.pop(); mode['hold']=False
        u=urlparse(pending.request.url)
        response=context.request.get(API+u.path+'?'+u.query,headers={'Authorization':'Bearer '+identity['token']})
        pending.fulfill(response=response)
        expect(form().get_by_role('status')).to_contain_text('Dates and periods filter loaded submissions instantly.')
        expect(page.get_by_role('group',name='Submission activity graph',exact=True)).to_have_attribute('aria-busy','false')
        page.get_by_label('Course',exact=True).evaluate('s=>{s.value="";s.dispatchEvent(new Event("change",{bubbles:true}))}')
        expect(page.get_by_role('region',name='Report results',exact=True)).to_have_attribute('aria-busy','false')
        checks.append(f'{role}: delayed scope requests keep graph/scroll, show inline busy/error, and recover through one explicit retry')
        for width,height in [(1440,1000),(768,1024),(375,812),(320,568),(812,375)]:
            page.set_viewport_size({'width':width,'height':height})
            for dark in [False,True]:
                page.evaluate('(dark)=>document.documentElement.classList.toggle("dark",dark)',dark)
                form().scroll_into_view_if_needed()
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                choose('weekly'); choose('monthly')
                if width in [1440,375]: page.screenshot(path=str(OUT/f'{role}-activity-period-{width}-{"dark" if dark else "light"}.png'))
        checks.append(f'{role}: period/date controls wrap without overflow across ten light/dark desktop/tablet/mobile/short layouts')
        page.reload(); page.wait_for_load_state('networkidle')
        expect(form().get_by_label('Activity period',exact=True)).to_have_value('monthly')
        form().scroll_into_view_if_needed()
        background_graph=page.get_by_role('group',name='Submission activity graph',exact=True).element_handle()
        background_y=page.evaluate('scrollY')
        mode['background']=True
        page.evaluate('window.dispatchEvent(new CustomEvent("sse:data_changed",{detail:{urls:["/api/management/analytics/"]}}))')
        deadline=time.monotonic()+5
        while not held and time.monotonic()<deadline: page.wait_for_timeout(20)
        assert len(held)==1
        expect(form().get_by_role('status')).not_to_contain_text('Updating')
        expect(page.get_by_role('group',name='Submission activity graph',exact=True)).to_have_attribute('aria-busy','false')
        expect(page.get_by_text('Applying report filters…',exact=False)).to_have_count(0)
        expect(page.get_by_role('button',name='Download displayed CSV',exact=True)).to_be_enabled()
        pending=held.pop(); u=urlparse(pending.request.url)
        response=context.request.get(API+u.path+'?'+u.query,headers={'Authorization':'Bearer '+identity['token']})
        changed=response.json()
        # Synthetic newly retained submission: event refresh publishes it without
        # waiting for the fallback timer. No actual data mutation is performed.
        today=changed['scope']['date_to']
        changed['activity_days'].append({'date':today,'submissions':1})
        total=sum(row['submissions'] for row in changed['activity_days'] if row['date']>=today[:7]+'-01')
        mode['background']=False
        pending.fulfill(json=changed)
        expect(page.get_by_role('group',name='Submission activity graph',exact=True).locator('p strong')).to_have_text(str(total))
        assert background_graph.evaluate('n=>n.isConnected') and abs(page.evaluate('scrollY')-background_y)<3
        checks.append(f'{role}: event-triggered refresh is silent, preserves scroll/graph/downloads and publishes new counts before the poll timer')
        mode['hold']=True
        page.get_by_label('Course',exact=True).evaluate('s=>{s.value="BSIS";s.dispatchEvent(new Event("change",{bubbles:true}))}')
        expect(form().get_by_role('status')).to_contain_text('Updating submission activity')
        assert len(held)==1
        held.pop().fulfill(status=403,json={'error':'Synthetic access loss'})
        expect(page.get_by_role('group',name='Submission activity graph',exact=True)).to_have_count(0)
        expect(page.get_by_role('region',name='Analytics records',exact=True)).to_have_count(0)
        checks.append(f'{role}: definitive access loss clears loaded activity and student records')
        # No data-changing methods are used anywhere in this workflow.
        context.close()
    browser.close()
assert not errors,errors
result = {'passed':len(checks),'checks':checks,'page_errors':errors,'local_filter_ms':{'min':min(timings),'max':max(timings),'samples':len(timings)}}
(OUT/'activity-period-checks.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result,indent=2))
