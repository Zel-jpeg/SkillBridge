"""Real Leaflet and synthetic HTTP catalog; no external tile/storage mutations."""
import json
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import expect, sync_playwright
from organization_playwright import BASE, OUT, errors, session

CACHE = Path(__file__).parent / 'artifacts/company-collection'
CACHE.mkdir(parents=True, exist_ok=True)
ASSETS = {}
for suffix in ('js', 'css'):
    asset = CACHE / f'leaflet.min.{suffix}'
    if not asset.exists():
        asset.write_bytes(urlopen(f'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.{suffix}', timeout=30).read())
    ASSETS[suffix] = asset.read_bytes()
ASSETS['js'] += b';(()=>{const create=L.map;window.__maps=[];L.map=function(...args){const m=create.apply(this,args);window.__maps.push(m);return m}})();'
TILE = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#edf2ed"/><path d="M0 80H256M0 190H256M65 0V256M180 0V256" stroke="#d4ddd1" stroke-width="8"/></svg>'


def leaflet(context, fail=False):
    context.route('**/leaflet.min.js', lambda route: route.abort() if fail else route.fulfill(body=ASSETS['js'], content_type='application/javascript'))
    context.route('**/leaflet.min.css', lambda route: route.fulfill(body=ASSETS['css'], content_type='text/css'))
    context.route('https://*.tile.openstreetmap.org/**', lambda route: route.fulfill(body=TILE, content_type='image/svg+xml'))


def markers(page):
    return page.locator('.leaflet-marker-icon')


with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    context, page = session(browser)
    leaflet(context)
    enterprise, tourism, third = json.loads((OUT / 'general-text.json').read_text(encoding='utf-8'))
    page.goto(BASE + '/admin/companies', wait_until='networkidle')
    overview = page.get_by_role('region', name='Partner map overview', exact=True)
    expect(overview.get_by_text('7 matching partners · 5 mapped · 2 need a location pin', exact=True)).to_be_visible()
    expect(markers(page)).to_have_count(4)
    expect(page.get_by_role('heading', name='Synthetic IC legacy partner', exact=True)).to_have_count(0)
    expect(page.get_by_label('Program', exact=True)).to_be_disabled()
    expect(overview.get_by_role('list', name='Institute map legend')).to_contain_text('IC')
    expect(overview.get_by_role('list', name='Institute map legend')).to_contain_text('IBPA')
    expect(overview.get_by_text('Shared across institutes', exact=True)).to_be_visible()
    print('PASS initial school map, color/text legend, missing coordinates and gated management records')

    page.get_by_label('Institute', exact=True).select_option(str(tourism['institute_id']))
    expect(overview.get_by_text('5 matching partners · 3 mapped · 2 need a location pin', exact=True)).to_be_visible()
    expect(markers(page)).to_have_count(2)
    assert markers(page).filter(has_text='IC').count() == 0
    page.get_by_label('Program', exact=True).select_option(str(tourism['program_id']))
    expect(overview.get_by_text('3 matching partners · 2 mapped · 1 need a location pin', exact=True)).to_be_visible()
    expect(markers(page)).to_have_count(1)
    expect(markers(page).first).to_contain_text('2 partners')
    assert page.evaluate('window.__maps.length') == 1
    markers(page).first.press('Enter')
    popup = page.locator('.leaflet-popup-content')
    expect(popup).to_contain_text('Tourism map partner')
    expect(popup).to_contain_text('Synthetic cross-program partner')
    expect(popup).to_contain_text('shared slots remaining')
    expect(popup).to_contain_text('current approvals from every eligible program')
    page.locator('.leaflet-popup-close-button').click()
    print('PASS strict institute/program pin removal, overlapping partners, keyboard popup and shared capacity')

    page.get_by_label('Institute', exact=True).select_option(label='Institute of Computing')
    expect(page.get_by_label('Program', exact=True)).to_have_value('')
    expect(markers(page)).to_have_count(1)
    assert page.evaluate('window.__maps.length') == 1
    page.get_by_label('Program', exact=True).select_option('all')
    expect(page.get_by_role('heading', name='Synthetic IC legacy partner', exact=True)).to_be_visible()
    page.get_by_label('Program', exact=True).select_option(label='Bachelor of Science in Information Technology')
    expect(markers(page)).to_have_count(1)
    expect(page.get_by_role('heading', name='Synthetic IC legacy partner', exact=True)).to_be_visible()
    page.get_by_label('Institute', exact=True).select_option(label='Synthetic Institute 00')
    page.get_by_label('Program', exact=True).select_option(label='Synthetic Program 00')
    expect(markers(page)).to_have_count(0)
    expect(overview.get_by_text('No partners match this institute, program and status.', exact=True)).to_be_visible()
    page.get_by_label('Institute', exact=True).select_option('')
    expect(markers(page)).to_have_count(4)
    expect(page.get_by_label('Program', exact=True)).to_be_disabled()
    print('PASS original IC shared retention inside IT, unrelated program zero-match state, All institutes reset and stable map instance')

    page.get_by_label('Institute', exact=True).select_option(str(tourism['institute_id']))
    page.get_by_label('Program', exact=True).select_option(str(tourism['program_id']))
    overview.get_by_label('Map partner status', exact=True).select_option('archived')
    expect(markers(page)).to_have_count(1)
    expect(markers(page).first).to_have_attribute('title', 'Archived map partner · IBPA')
    overview.get_by_label('Map partner status', exact=True).select_option('active')
    expect(markers(page)).to_have_count(1)
    overview.get_by_role('button', name='Fit matching partners', exact=True).click()
    center = page.evaluate('window.__maps[0].getCenter().lat')
    assert abs(center - 7.2) < .01
    overview.get_by_role('button', name='Partner Locations', exact=False).click()
    expect(page.get_by_role('region', name='Partner locations map', exact=True)).to_be_hidden()
    overview.get_by_role('button', name='Partner Locations', exact=False).click()
    expect(page.get_by_role('region', name='Partner locations map', exact=True)).to_be_visible()
    assert page.evaluate('window.__maps.length') == 1
    print('PASS archived map status, explicit fit, collapse/reopen and preserved map instance')

    for width in (320, 390, 768, 1440):
        page.set_viewport_size({'width': width, 'height': 900})
        if width == 390:
            page.evaluate("document.documentElement.classList.add('dark')")
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        expect(overview.get_by_role('button', name='Fit matching partners')).to_be_visible()
        page.screenshot(path=str(OUT / f'partner-map-{width}.png'), animations='disabled')
    context.close()
    print('PASS four responsive widths, dark mode, readable legend and reachable map controls')

    context, page = session(browser, width=390, dark=True, mobile=True)
    leaflet(context, fail=True)
    page.goto(BASE + '/admin/companies', wait_until='networkidle')
    expect(page.get_by_role('button', name='Retry map', exact=True)).to_be_visible()
    context.unroute('**/leaflet.min.js')
    context.route('**/leaflet.min.js', lambda route: route.fulfill(body=ASSETS['js'], content_type='application/javascript'))
    page.get_by_role('button', name='Retry map', exact=True).click()
    expect(markers(page)).to_have_count(4)
    context.close()
    browser.close()
    assert not errors, errors
    print('PASS failed map library retry retains saved catalog and recovers without page errors')
