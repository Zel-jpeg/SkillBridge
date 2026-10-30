"""Synthetic student result cards, navigation and accessible answer-review disclosures.
Run with Vite on 5178 and the backend venv's Python/installed headless Chrome.
"""
import copy
import json
import os
import time
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

BASE=os.environ.get('SKILLBRIDGE_TEST_BASE', 'http://127.0.0.1:5178')
OUT=Path(__file__).parent/'artifacts/student-assessment-result-navigation'
OUT.mkdir(parents=True,exist_ok=True)
USER={'id':1,'name':'Synthetic Student','role':'student','is_approved':True,'profile_completed':True,'course':'BSIT','school_id':'SYNTHETIC','batch':{'id':1,'name':'Synthetic Batch'}}
ASSESSMENT={'id':1,'title':'Synthetic Completed Assessment','is_required':True,'include_in_competency':True,'duration_minutes':30,'question_count':10,'categories':['Web Development'],'attempt_status':'submitted','submitted_at':'2026-10-20T03:08:00Z','action':'view_result','availability_status':'available'}
SCORES=[{'category':name,'raw_score':raw,'max_score':maximum,'percentage':percentage} for name,raw,maximum,percentage in [('Web Development',3,3,100),('Database Management',2,3,66.67),('Networking',1,2,50),('Programming',1,2,50)]]
RESULT={'assessment':ASSESSMENT,'skill_scores':SCORES,'recommendations_locked':False,'all_required_completed':True,'completed_required_count':1,'total_required_count':1,'remaining_required_count':0}
PROFILE={'supporting_categories':[{'category':'Networking','percentage':50,'tags':['Routing','Connectivity']},{'category':'Database Management','percentage':66.7,'tags':['SQL','Related tables']}],'development_suggestions':[{'category':'Networking','message':'Synthetic legacy advice must not appear.'}]}
RESULT['competency_profile']=PROFILE
QUESTIONS=[{'id':i,'question_text':'Enter the requested term.' if i==2 else f'Synthetic review question {i}: choose an option for this recorded assessment.','question_type':'identification' if i==2 else 'true_false' if i==3 else 'multiple_choice','category':'Student-defined category','choices':[] if i==2 else [{'id':i*100+1,'text':f'Selected option {i}'},{'id':i*100+2,'text':f'Other option {i}'}]} for i in range(1,11)]
ANSWERS={str(i):{'selected_choice_id':None if i==2 else i*100+1,'text_answer':'Synthetic typed response' if i==2 else '', 'submitted_answer_correct':i not in [2,9,10]} for i in range(1,11)}
REVIEW_URL='/api/student/results/review/?assessment_id=1'
checks=[]
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True)
    try:
        for width,dark in [(320,False),(375,True),(768,False),(1440,False)]:
            context=browser.new_context(viewport={'width':width,'height':1000},reduced_motion='reduce')
            context.add_init_script('localStorage.setItem("sb-token","synthetic");localStorage.setItem("sb-role","student");localStorage.setItem("sb-user",'+json.dumps(json.dumps(USER))+');')
            result=copy.deepcopy(RESULT);review={'questions':copy.deepcopy(QUESTIONS),'answers':copy.deepcopy(ANSWERS)}
            errors=[];requests=[];pending=[];mode={'review':'hold'}
            def intercept(route):
                parsed=urlparse(route.request.url)
                if parsed.path.startswith('/api/'):
                    assert route.request.method=='GET','Read-only result page must not write data'
                    requests.append(parsed.path)
                    if parsed.path in ['/api/students/me/','/api/auth/me/']:return route.fulfill(json=USER)
                    if parsed.path=='/api/assessments/':return route.fulfill(json={'assessments':[result['assessment']],'completed_required_count':1,'total_required_count':1,'remaining_required_count':0,'all_required_completed':True})
                    if parsed.path=='/api/student/results/':return route.fulfill(json=result)
                    if parsed.path=='/api/student/results/review/':
                        if mode['review']=='hold':pending.append(route);return
                        if mode['review']=='fail':return route.fulfill(status=503,json={'error':'Synthetic review unavailable'})
                        return route.fulfill(json=review)
                    if parsed.path=='/api/student/results/combined/':return route.fulfill(json={'recommendations_locked':False,'combined_category_scores':SCORES,'combined_competency_profile':PROFILE,'recommendations':[],'included_assessments':[],'all_required_completed':True})
                    if '/events/' in parsed.path:return route.fulfill(status=204)
                    return route.fulfill(json=[])
                if parsed.hostname not in ['localhost','127.0.0.1']:return route.abort()
                return route.continue_()
            context.route('**/*',intercept)
            page=context.new_page();page.set_default_timeout(12000);page.set_default_navigation_timeout(30000)
            page.on('pageerror',lambda error:errors.append(str(error)))
            page.goto(BASE+'/student/assessments',wait_until='networkidle')
            page.evaluate('(dark)=>document.documentElement.classList.toggle("dark",dark)',dark)
            page.get_by_role('button',name='View Score',exact=True).click()
            summary=page.get_by_role('region',name='Assessment result summary',exact=True)
            expect(summary.get_by_role('heading',name=ASSESSMENT['title'],exact=True)).to_be_visible()
            expect(summary.get_by_text('70%',exact=True)).to_be_visible()
            expect(summary.locator('.sa-answer-total.correct dd')).to_have_text('—')
            deadline=time.monotonic()+4
            while not pending and time.monotonic()<deadline:page.wait_for_timeout(25)
            assert pending,'Expected an independent pending answer-review read'
            mode['review']='ok'
            for route in pending:
                if width==768:route.fulfill(status=503,json={'error':'Synthetic review unavailable'})
                else:route.fulfill(json=review)
            pending.clear()
            if width==768:
                expect(page.get_by_role('alert').filter(has_text='Could not load this section')).to_be_visible()
                expect(summary.get_by_text('70%',exact=True)).to_be_visible()
                expect(summary.locator('.sa-answer-total.correct dd')).to_have_text('—')
                page.get_by_role('button',name='Retry',exact=True).click()
            expect(summary.locator('.sa-answer-total.correct dd')).to_have_text('7')
            expect(summary.locator('.sa-answer-total.incorrect dd')).to_have_text('3')
            expect(summary.locator('.sa-answer-total').first.locator('dd')).to_have_text('7/10')
            insights=page.get_by_role('region',name='Individual assessment interpretation',exact=True)
            expect(insights.locator('.sa-strength-names')).to_have_text('Web Development')
            expect(insights.locator('.sa-strength-score strong')).to_have_text('100%')
            expect(insights.locator('.sa-focus-list h4')).to_have_text(['Networking','Programming','Database Management'])
            focus=insights.locator('.sa-focus-list > li')
            expect(focus.nth(0)).to_contain_text('small network and checking connectivity')
            expect(focus.nth(0).get_by_role('list',name='Suggested review topics',exact=True).get_by_role('listitem')).to_have_text(['Routing','Connectivity'])
            expect(focus.nth(1)).to_contain_text('small program, test different inputs')
            expect(focus.nth(1).get_by_role('list',name='Suggested review topics',exact=True)).to_have_count(0)
            expect(focus.nth(2)).to_contain_text('related tables and write queries')
            expect(focus.nth(2).get_by_role('list',name='Suggested review topics',exact=True).get_by_role('listitem')).to_have_text(['SQL','Related tables'])
            expect(insights).not_to_contain_text('Synthetic legacy advice')
            expect(insights.locator('.sa-focus-item-heading svg')).to_have_count(0)
            steps=focus.first.locator('.sa-focus-steps')
            expect(steps.locator('ol')).not_to_be_visible()
            steps.locator('summary').focus();page.keyboard.press('Enter')
            expect(steps.locator('ol')).to_be_visible()
            expect(steps).to_contain_text('Review your incorrect and unanswered questions in this category.')
            expect(steps).to_contain_text('Start with a worked example')
            expect(steps).to_contain_text('Discuss your result')
            steps.locator('summary').click();expect(steps.locator('ol')).not_to_be_visible()
            insights.locator('.sa-guidance-details > summary').click()
            expect(insights.get_by_role('heading',name='Assessment summary',exact=True)).to_be_visible()
            insights.locator('.sa-guidance-details > summary').click()
            actions=summary.locator('.sa-summary-actions')
            bounds=actions.bounding_box();buttons=actions.get_by_role('button').all()
            left,right=[button.bounding_box() for button in buttons]
            assert abs(left['width']-right['width'])<1 and abs(left['height']-right['height'])<1
            assert abs(left['x']-bounds['x'])<1 and abs(right['x']+right['width']-bounds['x']-bounds['width'])<1,'Actions must fill the content width'
            summary.screenshot(path=str(OUT/f'summary-{width}-{dark}.png'))
            insights.screenshot(path=str(OUT/f'insights-{width}-{dark}.png'))
            submitted=page.get_by_role('region',name='Submitted answers',exact=True)
            questions=submitted.locator('.sa-question-toggle')
            panels=submitted.locator('.sa-answer-panel:visible')
            expect(questions).to_have_count(10);expect(panels).to_have_count(0)
            reads=requests.count('/api/student/results/review/')
            questions.first.focus();page.keyboard.press('Enter')
            expect(questions.first).to_have_attribute('aria-expanded','true');expect(panels).to_have_count(1)
            expect(panels.first.locator('.is-selected')).to_contain_text('Your answer (correct)')
            submitted.get_by_role('button',name='Expand all',exact=True).click()
            expect(panels).to_have_count(10)
            expect(submitted.locator('.sa-typed-answer')).to_have_text('Your answer: Synthetic typed response')
            expect(submitted.locator('.sa-reviewed-choices > .is-selected.is-incorrect')).to_have_count(2)
            questions.first.click();expect(panels).to_have_count(9)
            submitted.get_by_role('button',name='Expand all',exact=True).click();expect(panels).to_have_count(10)
            submitted.get_by_role('button',name='Collapse all',exact=True).click();expect(panels).to_have_count(0)
            assert requests.count('/api/student/results/review/')==reads,'Disclosure controls must not fetch answers again'
            submitted.screenshot(path=str(OUT/f'answers-{width}-{dark}.png'))
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),'Page overflow'
            for card in [summary,insights,submitted]:assert card.evaluate('el=>el.scrollWidth<=el.clientWidth'),'Card overflow'
            if width==375:
                review['answers'].pop('10')
                page.evaluate('(url)=>window.dispatchEvent(new CustomEvent("sse:data_changed",{detail:{urls:[url]}}))',REVIEW_URL)
                expect(summary.get_by_text('1 unanswered question',exact=True)).to_be_visible()
                questions.last.click();expect(submitted.locator('.sa-choice-note').last).to_have_text('No answer submitted.')
                result['assessment']['attempt_status']='stopped';result['recommendations_locked']=True
                result['all_required_completed']=False;result['completed_required_count']=0;result['remaining_required_count']=1
                page.evaluate('window.dispatchEvent(new CustomEvent("sse:data_changed",{detail:{urls:["/api/student/results/?assessment_id=1"]}}))')
                expect(summary.get_by_text('Stopped',exact=True)).to_be_visible()
                expect(summary.get_by_role('button',name='View Final Results',exact=True)).to_have_count(0)
                expect(insights).to_have_count(0)
                expect(summary.locator('.sa-stopped-note')).to_be_visible()
            else:
                summary.get_by_role('button',name='All Assessments',exact=True).click()
                expect(page).to_have_url(BASE+'/student/assessments')
                card = page.locator('.sac-card')
                expect(card).to_have_count(1)
                expect(card).to_have_css('margin-top', '0px')
                expect(card).to_have_attribute('data-assessment-state', 'completed')
                expect(card.locator('.sac-status')).to_contain_text('Completed')
                page.get_by_role('button',name='View Score',exact=True).click()
                expect(page.get_by_role('heading',name=ASSESSMENT['title'],exact=True)).to_be_visible()
                expect(page.locator('.sa-answer-panel:visible')).to_have_count(0)
                summary.get_by_role('button',name='View Final Results',exact=True).click()
                expect(page).to_have_url(BASE+'/student/results')
                expect(page.get_by_role('heading',name='Final Skill Profile',exact=True)).to_be_visible()
                combined=page.get_by_role('region',name='Combined assessment interpretation')
                combined.locator('summary').click()
                expect(combined).to_contain_text('assessments contributing to this category')
                expect(combined).to_contain_text('Suggested review topics: Routing, Connectivity.')
                expect(combined).not_to_contain_text('Synthetic legacy advice')
            assert not errors,errors
            checks.append(f'{width}px {dark=}: View Score, score precision, separate review loading, balanced full-width actions, text-only focus, per-question/bulk keyboard disclosure, read-only requests and no overflow')
            print('PASS '+checks[-1],flush=True)
            context.close()
    finally:browser.close()
print(json.dumps({'checks':checks},indent=2))
