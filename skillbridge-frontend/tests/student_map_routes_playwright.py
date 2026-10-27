"""Real Leaflet + production build/CSP, synthetic API/tiles/OSRM; no private/live coordinates."""
import json
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

FRONTEND = Path(__file__).resolve().parents[1]
OUT = Path(__file__).parent/'artifacts/student-map-routes'
OUT.mkdir(parents=True, exist_ok=True)
JS, CSS = OUT/'leaflet.js', OUT/'leaflet.css'
assert JS.exists() and CSS.exists(), 'Cache the existing Leaflet 1.9.4 CDN assets in tests/artifacts/student-map-routes first.'
headers = json.loads((FRONTEND/'vercel.json').read_text())['headers'][0]['headers']
class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if '.' not in urlparse(self.path).path.rsplit('/',1)[-1]: self.path='/index.html'
        super().do_GET()
    def end_headers(self):
        for row in headers: self.send_header(row['key'], row['value'])
        super().end_headers()
    def log_message(self,*args): pass

profile = {'id':1,'role':'student','name':'Synthetic Map Student','is_approved':True,'profile_completed':True,'course':'BSIT','school_id':'SYNTHETIC','batch':{'id':1,'name':'Example'},'address':{'pinLat':7.3,'pinLng':125.68}}
rows = [{'id':1,'company_id':10,'position_id':101,'company':'Example Company A','position':'Example Intern','match_score':73.45,'tags':[],'lat':7.31,'lng':125.69},
        {'id':2,'company_id':20,'position_id':201,'company':'Example Company B','position':'Example Analyst','match_score':65.99,'tags':[],'lat':7.32,'lng':125.7}]
result = {'recommendations_locked':False,'all_required_completed':True,'combined_category_scores':[],'included_assessments':[],'recommendations':rows}
tile='<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e8efe8"/><path d="M0 128H256M128 0V256" stroke="#fff" stroke-width="7"/></svg>'
geometry = [[125.68,7.3],[125.686,7.3],[125.686,7.308],[125.69,7.31]]
def road_payload(url=''):
    points=[point[:] for point in geometry]
    if '125.7,7.32' in url: points[-1]=[125.7,7.32]
    return {'code':'Ok','routes':[{'distance':4200,'duration':660,'geometry':{'type':'LineString','coordinates':points}}]}

server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(FRONTEND/'dist')))
threading.Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}'
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='chrome',headless=True)
        for width,dark in [(320,False),(375,False),(768,False),(1440,False),(375,True)]:
            context=browser.new_context(viewport={'width':width,'height':1000},reduced_motion='reduce')
            context.add_init_script('localStorage.setItem("sb-token","synthetic");localStorage.setItem("sb-role","student");localStorage.setItem("sb-user",'+json.dumps(json.dumps(profile))+');window.__csp=[];document.addEventListener("securitypolicyviolation",e=>window.__csp.push(e.blockedURI));')
            errors,calls,pending=[],[],[]
            mode={'value':'ok'}
            def intercept(route):
                parsed=urlparse(route.request.url)
                if parsed.hostname=='cdnjs.cloudflare.com':
                    if parsed.path.endswith('.js'):
                        return route.fulfill(content_type='application/javascript',body=JS.read_text(encoding='utf-8')+';const originalMap=L.map;L.map=(...args)=>{window.__testMap=originalMap(...args);return window.__testMap};')
                    return route.fulfill(content_type='text/css',body=CSS.read_text(encoding='utf-8'))
                if parsed.hostname.endswith('tile.openstreetmap.org'): return route.fulfill(content_type='image/svg+xml',body=tile)
                if parsed.hostname=='router.project-osrm.org':
                    assert 'authorization' not in route.request.headers and 'referer' not in route.request.headers
                    calls.append(route.request.url)
                    if mode['value']=='hold': pending.append(route);return
                    return route.fulfill(json={'code':'NoRoute','routes':[]} if mode['value']=='fail' else road_payload(route.request.url),headers={'Access-Control-Allow-Origin':'*'})
                if parsed.path.startswith('/api/'):
                    cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,content-type','Access-Control-Allow-Methods':'GET,OPTIONS'}
                    if route.request.method=='OPTIONS': return route.fulfill(status=204,headers=cors)
                    assert route.request.method=='GET'
                    if parsed.path in ['/api/students/me/','/api/auth/me/']: return route.fulfill(json=profile,headers=cors)
                    if parsed.path=='/api/student/results/combined/': return route.fulfill(json=result,headers=cors)
                    if parsed.path=='/api/assessments/': return route.fulfill(json={'assessments':[]},headers=cors)
                    if '/events/' in parsed.path: return route.fulfill(status=204,headers=cors)
                    return route.fulfill(json=[],headers=cors)
                if parsed.hostname not in ['127.0.0.1','localhost']: return route.abort()
                return route.continue_()
            context.route('**/*',intercept)
            page=context.new_page();page.set_default_timeout(15000)
            page.on('pageerror',lambda error:errors.append(str(error)))
            page.goto(base+'/student/dashboard',wait_until='networkidle')
            page.evaluate('(dark)=>document.documentElement.classList.toggle("dark",dark)',dark)
            locate=page.get_by_role('button',name='Show my location',exact=True)
            locate.scroll_into_view_if_needed();expect(locate).to_be_enabled()
            assert not calls,'No route lookup before a pin is selected'
            locate.click()
            page.wait_for_function('Math.abs(__testMap.getCenter().lat-7.3)<0.001')
            expect(page.locator('.student-pin-highlight')).to_have_count(1)
            assert not calls,'Locating the saved pin must not call routing/GPS'
            a=page.locator('[title="Show driving route to Example Company A"]')
            b=page.locator('[title="Show driving route to Example Company B"]')
            a.focus();page.keyboard.press('Enter')
            route_box=page.get_by_label('Road route',exact=True)
            expect(route_box).to_contain_text('4.2 km by road')
            expect(route_box).to_contain_text('11 min driving')
            assert len(calls)==1
            assert page.evaluate('Object.values(__testMap._layers).filter(layer=>layer instanceof L.Polyline).length')==2
            assert page.evaluate('Object.values(__testMap._layers).find(layer=>layer instanceof L.Polyline).getLatLngs().length')==4
            mode['value']='hold'
            page.evaluate('__testMap.panTo([7.32,125.7],{animate:false})')
            b.click()
            expect(route_box).to_contain_text('Finding a driving route')
            page.wait_for_function('Object.values(__testMap._layers).filter(layer=>layer instanceof L.Polyline).length===0')
            deadline=__import__('time').monotonic()+5
            while not pending and __import__('time').monotonic()<deadline: page.wait_for_timeout(50)
            assert pending
            page.evaluate('__testMap.panTo([7.31,125.69],{animate:false})')
            a.click()
            expect(route_box).to_contain_text('Route to Example Company A')
            expect(route_box).to_contain_text('4.2 km by road')
            assert len(calls)==2,'Cached A route must be reused'
            try: pending.pop().fulfill(json=road_payload(),headers={'Access-Control-Allow-Origin':'*'})
            except Exception: pass # The old request was deliberately aborted.
            expect(route_box).to_contain_text('Route to Example Company A')
            mode['value']='fail'
            page.evaluate('__testMap.panTo([7.32,125.7],{animate:false})')
            b.click()
            expect(route_box).to_contain_text('Road route unavailable')
            assert page.evaluate('Object.values(__testMap._layers).filter(layer=>layer instanceof L.Marker).length')==3
            mode['value']='ok';route_box.get_by_role('button',name='Retry route').click()
            expect(route_box).to_contain_text('4.2 km by road')
            page.screenshot(path=str(OUT/f'route-{width}-{dark}.png'))
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            assert route_box.evaluate('(el)=>el.scrollWidth<=el.clientWidth')
            route_box.get_by_role('button',name='Clear route').click()
            expect(route_box).to_contain_text('Select a company pin')
            assert page.evaluate('Object.values(__testMap._layers).filter(layer=>layer instanceof L.Polyline).length')==0
            page.evaluate('__testMap.panTo([7.31,125.69],{animate:false})')
            a.click();expect(route_box).to_contain_text('4.2 km by road')
            if width==375 and dark:
                profile['address']={}
                page.evaluate("window.dispatchEvent(new CustomEvent('sse:data_changed',{detail:{urls:['/api/students/me/']}}))")
                expect(locate).to_be_disabled()
                expect(route_box).to_contain_text('Set your profile pin')
                assert page.evaluate('Object.values(__testMap._layers).filter(layer=>layer instanceof L.Polyline).length')==0
                mode['value']='hold'
                profile['address']={'pinLat':7.305,'pinLng':125.68}
                page.evaluate("window.dispatchEvent(new CustomEvent('sse:data_changed',{detail:{urls:['/api/students/me/']}}))")
                expect(route_box).to_contain_text('Finding a driving route')
                deadline=__import__('time').monotonic()+5
                while not pending and __import__('time').monotonic()<deadline: page.wait_for_timeout(50)
                assert pending and '125.68,7.305' in calls[-1]
            page.goto(base+'/student/results',wait_until='networkidle')
            if pending:
                try: pending.pop().fulfill(json=road_payload(),headers={'Access-Control-Allow-Origin':'*'})
                except Exception: pass
            expect(locate).to_have_count(0)
            assert not page.evaluate('window.__csp'),page.evaluate('window.__csp')
            assert not errors,errors
            print(f'PASS {width}px {dark=}: real Leaflet, locate/highlight, road turns, cache, rapid selection, abort, error/retry/clear, production CSP and no identity headers',flush=True)
            context.close()
        browser.close()
finally:
    server.shutdown();server.server_close()
