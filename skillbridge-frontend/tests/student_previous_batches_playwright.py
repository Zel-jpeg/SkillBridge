"""Student dashboard/history regressions with synthetic intercepted APIs only."""
import json
import os
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from playwright.sync_api import expect, sync_playwright

BASE=os.environ.get('SKILLBRIDGE_TEST_BASE','http://127.0.0.1:5194')
OUT=Path(__file__).parent/'artifacts/student-previous-batches'
OUT.mkdir(parents=True,exist_ok=True)
expect.set_options(timeout=12000)
checks=[]


def batch(index, status='archived'):
    return {'batch':{'id':index,'name':f'Previous cohort {index}','status':status},'snapshot_at':None,
        'outcome':'','placements':[{'id':index,'status':'approved','position':{'title':'Support intern'},'company':{'name':'Synthetic Partner'}}],
        'assessments':[{'id':index*100,'title':'Assessment 1','attempt_status':'submitted',
            'category_scores':[{'category_id':1,'category':'Networking','raw_score':7,'max_score':10,'percentage':70}]},
            {'id':index*100+1,'title':'Assessment 2','attempt_status':'submitted',
            'category_scores':[{'category_id':2,'category':'Programming','raw_score':8,'max_score':10,'percentage':80}]},
            {'id':index*100+2,'title':'Assessment 3','attempt_status':None,'category_scores':[]}]}


class Fixture:
    def __init__(self,browser,previous=False,active=True,review=False,width=1440,dark=False):
        self.user={'id':1,'role':'student','name':'Alex Rivera','email':'student@example.invalid','is_approved':True,
            'school_id':'SYN-001','course':'BSIT','phone':'09000000000',
            'address':{'stayingAt':'boarding','travelWilling':'davao-norte','pinLat':7.307,'pinLng':125.667,
                'home':{'province':'Davao del Norte','city':'City of Panabo','barangay':'Dapco'},
                'boarding':{'province':'Davao del Norte','city':'City of Panabo','barangay':'New Visayas'}},
            'batch':{'id':90,'name':'Current cohort'} if active else None,'has_previous_batches':previous,
            'profile_review_required':review,'recommendations_locked':True,'has_submitted':False}
        self.history=[batch(index) for index in range(1,7)]
        self.fail=False
        self.hold=False
        self.pending=None
        self.history_calls=0
        self.confirms=0
        self.errors=[]
        self.context=browser.new_context(viewport={'width':width,'height':1000},reduced_motion='reduce')
        self.context.add_init_script('for (const [k,v] of Object.entries('+json.dumps({
            'sb-token':'synthetic','sb-role':'student','sb-user':json.dumps(self.user),'sb-theme':'dark' if dark else 'light'
        })+')) localStorage.setItem(k,v)')
        self.context.route('**/*',self.route)
        self.page=self.context.new_page()
        self.page.on('pageerror',lambda error:self.errors.append(str(error)))

    def route(self,route):
        url=urlparse(route.request.url)
        if url.hostname=='cdnjs.cloudflare.com' and '/leaflet/' in url.path:
            suffix='js' if url.path.endswith('.js') else 'css'
            asset=Path(__file__).parent/f'artifacts/company-collection/leaflet.min.{suffix}'
            if not asset.is_file():
                return route.abort()
            return route.fulfill(body=asset.read_text(encoding='utf-8'),content_type='application/javascript' if suffix=='js' else 'text/css')
        if url.hostname and url.hostname.endswith('.tile.openstreetmap.org'):
            tile='<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#eef2ed"/><path d="M0 48h256M0 154h256M74 0v256M192 0v256" stroke="#fff" stroke-width="12"/><path d="M0 48h256M0 154h256M74 0v256M192 0v256" stroke="#d7dfd8" fill="none"/><text x="10" y="238" font-size="10" fill="#758076">Synthetic test map</text></svg>'
            return route.fulfill(body=tile,content_type='image/svg+xml')
        if url.hostname=='nominatim.openstreetmap.org':
            return route.fulfill(json=[{'lat':'7.307','lon':'125.667'}],headers={'Access-Control-Allow-Origin':'*'})
        if url.hostname=='psgc.gitlab.io':
            if url.path.endswith('/provinces/'):
                data=[{'code':'P1','name':'Davao del Norte'}]
            elif url.path.endswith('/cities-municipalities/'):
                data=[{'code':'C1','name':'City of Panabo'}]
            else:
                data=[{'code':'B1','name':'Dapco'},{'code':'B2','name':'New Visayas'}]
            return route.fulfill(json=data,headers={'Access-Control-Allow-Origin':'*'})
        if url.hostname not in ('127.0.0.1','localhost'):
            return route.abort()
        if not url.path.startswith('/api/'):
            return route.continue_()
        if url.path.endswith('/events/'):
            return route.fulfill(status=204)
        if url.path in ('/api/auth/me/','/api/students/me/'):
            return route.fulfill(json=self.user)
        if url.path=='/api/students/me/history/':
            assert parse_qs(url.query).get('previous') == ['1']
            self.history_calls+=1
            if self.hold:
                self.pending=route
                return
            return route.fulfill(status=503 if self.fail else 200,json={'error':'Synthetic failure'} if self.fail else {'batches':self.history})
        if url.path=='/api/students/me/confirm-profile/':
            assert route.request.post_data_json=={'batch_id':90}
            self.confirms+=1
            self.user['profile_review_required']=False
            return route.fulfill(json={})
        if url.path=='/api/assessments/':
            return route.fulfill(json={'batch':self.user['batch'],'assessments':[],
                'total_required_count':6,'completed_required_count':0,'remaining_required_count':6})
        if url.path=='/api/student/results/combined/':
            return route.fulfill(json={'recommendations_locked':True,'combined_category_scores':[],
                'recommendations':[],'all_required_completed':False,'total_required_count':6,
                'completed_required_count':0,'remaining_required_count':6})
        return route.fulfill(json=[])

    def go(self,path='/student/dashboard'):
        self.page.goto(BASE+path,wait_until='domcontentloaded' if self.hold else 'networkidle')
        return self.page

    def close(self):
        assert not self.errors,self.errors
        self.context.close()


with sync_playwright() as playwright:
    browser=playwright.chromium.launch(channel='chrome',headless=True)
    try:
        fixture=Fixture(browser)
        page=fixture.go()
        expect(page.get_by_text('Your skills assessments',exact=True)).to_be_visible()
        expect(page.get_by_role('region',name='Previous batch records')).to_have_count(0)
        assert fixture.history_calls==0
        for path in ('/student/assessments','/student/profile'):
            fixture.go(path)
            expect(page.get_by_role('region',name='Previous batch records')).to_have_count(0)
        fixture.close()
        checks.append('First-batch dashboard, assessments and profile hide history and make no history request')

        for width,dark in ((1440,False),(375,True)):
            fixture=Fixture(browser,previous=True,width=width,dark=dark)
            # Defensive filtering also handles a stale full-history response.
            fixture.history.append(batch(90,status='active'))
            page=fixture.go()
            expect(page.get_by_text('Your skills assessments',exact=True)).to_be_visible()
            expect(page.get_by_role('heading',name='Previous batches',exact=True)).to_have_count(0)
            expect(page.get_by_role('link',name='View previous records',exact=True)).to_have_attribute('href','/student/profile#previous-batches')
            assert fixture.history_calls==0
            fixture.go('/student/assessments')
            expect(page.get_by_role('heading',name='Previous batches',exact=True)).to_have_count(0)
            expect(page.get_by_role('button',name='View records',exact=True)).to_have_count(0)
            assert fixture.history_calls==0
            fixture.go('/student/profile')
            history=page.get_by_role('region',name='Previous batch records')
            expect(history.get_by_role('heading',name='Previous batches',exact=True)).to_be_visible()
            assert fixture.history_calls==0
            page.get_by_role('button',name='View records',exact=True).click()
            expect(history.locator('details')).to_have_count(5)
            expect(history.get_by_text('Previous cohort 90',exact=True)).to_have_count(0)
            history.locator('summary').first.press('Enter')
            expect(history.locator('details').first.get_by_text('7/10 (70%)',exact=True)).to_be_visible()
            expect(history.locator('details').first.get_by_text('8/10 (80%)',exact=True)).to_be_visible()
            expect(history.locator('details').first.get_by_text('Not started',exact=True)).to_be_visible()
            expect(history.locator('details').first.get_by_text('Approved',exact=True)).to_be_visible()
            expect(history.locator('details').first.get_by_text('Support intern',exact=True)).to_be_visible()
            expect(history.locator('details').first.get_by_text('Synthetic Partner',exact=True)).to_be_visible()
            expect(history.locator('details').first.get_by_text('These records are read-only.',exact=True)).to_be_visible()
            expect(history).not_to_contain_text('closeout')
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
            save_button = page.get_by_role('button',name='Save changes',exact=True)
            expect(page.locator('.profile-save-bar')).to_have_css('position','static')
            assert save_button.evaluate('(node, history) => !!(node.compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING)', history.element_handle())
            assert abs(page.locator('.profile-identity').bounding_box()['width'] - history.bounding_box()['width']) < 1
            if width >= 768:
                row=history.locator('.sb-previous-result-row').first
                badge=row.locator('.sb-previous-attempt-status').bounding_box()
                score=row.locator('.sb-previous-score-value').bounding_box()
                assert abs(badge['y']+badge['height']/2-score['y']-score['height']/2) < 2
                history.screenshot(path=str(OUT/f'previous-{width}.png'))
                page.evaluate('window.scrollTo(0,0)')
                page.wait_for_function('window.scrollY === 0')
                page.screenshot(path=str(OUT/'profile-with-previous-batches-desktop.png'),full_page=True)
            else:
                page.screenshot(path=str(OUT/f'previous-{width}.png'),full_page=True)
            history.get_by_role('button',name='Next →',exact=True).click()
            expect(history.locator('details')).to_have_count(1)
            expect(history.get_by_text('Previous cohort 6',exact=True)).to_be_visible()
            page.get_by_role('button',name='Hide records',exact=True).click()
            expect(history.locator('details')).to_have_count(0)
            fixture.close()
        checks.append('Full history is limited to Profile: active dashboard only links, Assessments has no panel or request; previous records retain scores/decisions, paginate and fit desktop/phone themes')

        fixture=Fixture(browser,previous=True)
        fixture.fail=True
        page=fixture.go('/student/profile')
        page.get_by_role('button',name='View records',exact=True).click()
        expect(page.get_by_role('alert').filter(has_text="We couldn't load your previous batches")).to_be_visible()
        fixture.fail=False
        page.get_by_role('button',name='Retry previous batches',exact=True).click()
        expect(page.locator('details')).to_have_count(5)
        fixture.close()
        checks.append('History failure remains explicit and Retry recovers the records')

        fixture=Fixture(browser,previous=True,active=False,width=375,dark=True)
        fixture.hold=True
        page=fixture.go()
        expect(page.get_by_role('heading',name='No active OJT batch',exact=True)).to_be_visible()
        expect(page.get_by_role('status').filter(has_text='Loading your previous batches')).to_be_visible()
        assert fixture.pending
        fixture.pending.fulfill(json={'batches':fixture.history})
        fixture.hold=False
        page.wait_for_load_state('networkidle')
        expect(page.locator('details')).to_have_count(5)
        fixture.close()
        checks.append('Archived/no-active-batch dashboard retains automatic history access with a loading state')

        for previous in (False,True):
            fixture=Fixture(browser,review=True,previous=previous)
            page=fixture.go('/student/profile')
            expect(page.get_by_role('region',name='Current batch notice',exact=True)).to_have_count(1)
            expect(page.get_by_role('heading',name='Welcome to Current cohort',exact=True)).to_be_visible()
            expect(page.get_by_role('heading',name='Previous batches',exact=True)).to_have_count(1 if previous else 0)
            page.get_by_role('button',name='Confirm saved details for this batch',exact=True).click()
            expect(page.get_by_role('status').filter(has_text='Your details are confirmed')).to_be_visible()
            assert fixture.confirms==1
            fixture.close()
        checks.append('Profile-review prompt and confirmation remain available independently of previous records')

        fixture=Fixture(browser,previous=True)
        fixture.history=[]
        page=fixture.go('/student/profile')
        page.get_by_role('button',name='View records',exact=True).click()
        expect(page.get_by_text('No previous batch records to show.',exact=False)).to_be_visible()
        fixture.close()
        checks.append('Stale history availability shows a plain empty state without current assessment duplicates')

        fixture=Fixture(browser,previous=True)
        page=fixture.go()
        page.get_by_role('link',name='View previous records',exact=True).click()
        expect(page).to_have_url(BASE+'/student/profile#previous-batches')
        history=page.get_by_role('region',name='Previous batch records')
        expect(history.get_by_role('button',name='Hide records',exact=True)).to_be_visible()
        expect(history.locator('details')).to_have_count(5)
        fixture.close()
        checks.append('Dashboard link opens and scrolls to Profile history without editing the saved profile')
        (OUT/'results.json').write_text(json.dumps({'checks':checks,'page_errors':[]},indent=2),encoding='utf-8')
        print(json.dumps({'checks':checks,'page_errors':[]},indent=2),flush=True)
    finally:
        browser.close()
