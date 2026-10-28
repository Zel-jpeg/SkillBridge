"""Real UI/SSE against profile_images_server.py; all external services mocked."""
import json
from pathlib import Path
import sys
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = Path(__file__).parent / 'artifacts/profile-images'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
if '--api-thread' in sys.argv:
    import atexit
    import runpy
    from socketserver import ThreadingMixIn
    from threading import Thread
    runpy.run_path(str(ROOT / 'skillbridge-frontend/tests/profile_images_server.py'), run_name='__fixture_import__')
    from django.core.handlers.wsgi import WSGIHandler
    from django.core.servers.basehttp import WSGIServer, WSGIRequestHandler
    class FixtureServer(ThreadingMixIn, WSGIServer):
        daemon_threads = True
    server = FixtureServer(('127.0.0.1', 8019), WSGIRequestHandler)
    server.set_app(WSGIHandler())
    Thread(target=server.serve_forever, daemon=True).start()
    atexit.register(server.server_close)
    atexit.register(server.shutdown)
    print('In-process synthetic API ready', flush=True)

AUTH = json.loads((ARTIFACTS / 'auth.json').read_text(encoding='utf-8'))
BASE, API = 'http://127.0.0.1:5179', 'http://127.0.0.1:8019'
checks, errors = [], []

def checked(message):
    checks.append(message)
    print('PASS: ' + message, flush=True)


def session(browser, role, width=1366):
    context = browser.new_context(viewport={'width': width, 'height': 900})
    values = {'sb-token': AUTH[role]['token'], 'sb-role': role, 'sb-user': json.dumps(AUTH[role]['user'])}
    context.add_init_script('''(() => {
      const values = ''' + json.dumps(values) + ''';
      for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
      window.__createdUrls = []; window.__revokedUrls = [];
      const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = file => { const url = create(file); window.__createdUrls.push(url); return url; };
      URL.revokeObjectURL = url => { window.__revokedUrls.push(url); return revoke(url); };
    })();''')

    def route_request(route):
        url = urlparse(route.request.url)
        if url.path.startswith('/api/') and url.hostname != 'psgc.gitlab.io':
            if url.scheme != 'http':
                errors.append('Test Vite API URL must be local HTTP; remote API request blocked')
                return route.abort()
            return route.continue_(url=API + url.path + ('?' + url.query if url.query else ''))
        if url.hostname in ('127.0.0.1', 'localhost'):
            return route.continue_()
        if url.hostname == 'synthetic.supabase.co':
            return route.fulfill(response=context.request.get(API + '/__fixture__/branding/' + url.path.split('/company-branding/')[1]))
        if url.hostname == 'synthetic.invalid' and url.path.startswith('/google/'):
            return route.fulfill(response=context.request.get(API + '/__fixture__' + url.path))
        if url.hostname == 'psgc.gitlab.io':
            if 'barangays' in url.path:
                data = [{'code': 'B1', 'name': 'Synthetic Barangay'}]
            elif 'cities-municipalities' in url.path:
                data = [{'code': 'C1', 'name': 'Synthetic City'}]
            else:
                data = [{'code': 'P1', 'name': 'Synthetic Province'}]
            return route.fulfill(json=data, headers={'Access-Control-Allow-Origin': '*'})
        if url.hostname == 'nominatim.openstreetmap.org':
            return route.fulfill(json=[], headers={'Access-Control-Allow-Origin': '*'})
        return route.abort()

    context.route('**/*', route_request)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    return context, page


def navigate(page, path):
    page.goto(BASE + path)
    page.wait_for_load_state('networkidle')


def loaded_image(locator):
    locator = locator.filter(visible=True).first
    expect(locator).to_be_visible(timeout=15000)
    locator.page.wait_for_function('(image) => image?.complete && image?.naturalWidth > 0', arg=locator.element_handle())


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel='chrome', headless=True)
    try:
        admin_context, admin = session(browser, 'admin')
        instructor_context, instructor = session(browser, 'instructor')
        student_context, student = session(browser, 'student')
        placement_context, placement = session(browser, 'admin')
        profile_context, profile = session(browser, 'student')
        navigate(admin, '/admin/companies')
        navigate(instructor, '/instructor/companies')
        navigate(student, '/student/results')
        navigate(placement, '/admin/placements')
        navigate(profile, '/student/profile')
        expect(admin.get_by_role('img', name='Synthetic Employer logo')).to_be_visible()
        instructor.get_by_role('button').filter(has_text='Synthetic Employer').first.click()
        placement.get_by_role('button', name='View details', exact=True).first.click()
        expect(placement.get_by_role('img', name='Synthetic student avatar').last).to_be_visible()
        profile.get_by_placeholder('e.g. Juan Dela Cruz').fill('Unsaved student draft')
        checked('Company and Google-photo fallbacks; open read-only detail selections')

        # Create with a real file, force an upload failure, then retry the same
        # form. Address requests and maps remain synthetic/offline.
        admin.get_by_role('button', name='+ Add Partner', exact=True).click()
        admin.get_by_placeholder('e.g. Azeus Systems Philippines').fill('Created with image')
        admin.locator('select').nth(0).select_option('P1')
        admin.locator('select').nth(1).select_option('C1')
        admin.get_by_label('Company image (optional)').set_input_files(str(ARTIFACTS / 'company.jpeg'))
        loaded_image(admin.locator('img[src^="blob:"]'))
        admin.get_by_label('Company image (optional)').set_input_files(str(ARTIFACTS / 'company.png'))
        admin.wait_for_function('window.__revokedUrls.length >= 1')
        admin.get_by_role('button', name='Next: Pin Location').click()
        admin.wait_for_function('window.__createdUrls.every(url => window.__revokedUrls.includes(url))')
        admin_context.request.post(API + '/__fixture__/controls/', data={'fail': True})
        admin.get_by_role('button', name='Add Without Pin', exact=True).click()
        expect(admin.get_by_role('alert').filter(has_text='storage is unavailable')).to_be_visible()
        expect(admin.get_by_text('Created with image', exact=True)).to_be_visible()
        admin_context.request.post(API + '/__fixture__/controls/', data={'fail': False})
        admin.get_by_role('button', name='Add Without Pin', exact=True).click()
        expect(admin.get_by_role('heading', name='Add Partner')).not_to_be_visible()
        loaded_image(admin.locator('img[alt="Created with image logo"]'))
        response = admin_context.request.get(API + '/api/admin/companies/', headers={'Authorization': 'Bearer ' + AUTH['admin']['token']})
        assert len([c for c in response.json() if c['name'] == 'Created with image']) == 1
        checked('Create with image, preview replacement/revocation, failed upload preserves form, retry creates once')

        def edit_company():
            card = admin.locator('div.rounded-2xl.overflow-hidden').filter(has=admin.get_by_text('Synthetic Employer', exact=True))
            card.get_by_title('Edit partner').click()

        def save_company():
            admin.get_by_role('button', name='Save Changes', exact=True).click()
            expect(admin.get_by_role('heading', name='Edit Partner', exact=True)).not_to_be_visible()

        edit_company()
        admin.get_by_label('Company image (optional)').set_input_files(str(ARTIFACTS / 'company.png'))
        save_company()
        for page in (admin, instructor, student, placement):
            loaded_image(page.locator('img[alt="Synthetic Employer logo"]').last)
        first_url = student.locator('img[alt="Synthetic Employer logo"]').first.get_attribute('src')
        checked('Company replacement reaches admin, open instructor detail, student recommendations and open placement detail via SSE')

        # Preserve an instructor edit draft while another user updates branding.
        instructor.get_by_role('button', name='Edit', exact=True).click()
        instructor.get_by_placeholder('e.g. Azeus Systems Philippines').fill('Unsaved company draft')
        edit_company()
        admin.get_by_label('Company image (optional)').set_input_files(str(ARTIFACTS / 'company.webp'))
        save_company()
        student.wait_for_function('(old) => [...document.images].some(img => img.alt === "Synthetic Employer logo" && img.src !== old && img.complete && img.naturalWidth > 0)', arg=first_url)
        expect(instructor.get_by_placeholder('e.g. Azeus Systems Philippines')).to_have_value('Unsaved company draft')
        instructor.get_by_role('button', name='Cancel', exact=True).click()
        checked('Versioned replacement URLs; instructor draft survives catalog SSE')

        # Real Google endpoint with verified synthetic userinfo mocked in fixture.
        action_page = placement_context.new_page()
        navigate(action_page, '/admin/placements')
        action_page.get_by_role('button', name='Approve', exact=True).click()
        action_page.locator('textarea').fill('Unsaved placement remarks')
        result = admin_context.request.post(API + '/api/auth/google/', data={'token': 'photo-new'})
        assert result.status == 200
        for page in (placement, profile):
            loaded_image(page.locator('img[src="https://synthetic.invalid/google/new.png"]').last)
        expect(profile.get_by_placeholder('e.g. Juan Dela Cruz')).to_have_value('Unsaved student draft')
        loaded_image(action_page.locator('img[src="https://synthetic.invalid/google/new.png"]'))
        expect(action_page.locator('textarea')).to_have_value('Unsaved placement remarks')
        action_page.get_by_role('button', name='Cancel', exact=True).click()
        action_page.close()
        checked('Failed Avatar URL recovers on provider URL change; open placement detail/profile refresh without losing draft')

        # Check existing identity screens in each role after propagation.
        for role, context, paths in (
            ('admin', admin_context, ['/admin/dashboard', '/admin/users']),
            ('instructor', instructor_context, ['/instructor/dashboard', '/instructor/students', '/instructor/placements']),
            ('student', student_context, ['/student/dashboard', '/student/assessments']),
        ):
            for path in paths:
                page = context.new_page()
                navigate(page, path)
                loaded_image(page.locator('img[src="https://synthetic.invalid/google/new.png"]'))
                page.screenshot(path=str(ARTIFACTS / (path.strip('/').replace('/', '-') + '.png')))
                page.close()
        checked('Admin dashboard/users, instructor dashboard/roster/placements, student dashboard/assessment header photos')
        oversight = admin_context.new_page()
        navigate(oversight, '/admin/assessments')
        oversight.get_by_role('button', name='Synthetic completed assessment', exact=True).click()
        loaded_image(oversight.locator('img[src="https://synthetic.invalid/google/new.png"]'))
        oversight.screenshot(path=str(ARTIFACTS / 'admin-assessment-identity.png'))
        oversight.close()
        checked('Admin assessment roster identity photo')

        # Approve through the existing endpoint and verify current branding and
        # photos on groups, student summaries, and history without score changes.
        suggestions = admin_context.request.get(API + '/api/placements/suggestions/', headers={'Authorization': 'Bearer ' + AUTH['admin']['token']}).json()
        recommendation = next(s for c in suggestions['companies'] if c['id'] == AUTH['ids']['company'] for p in c['positions'] for s in p['suggested_students'])
        approved = admin_context.request.post(API + '/api/placements/approve/', headers={'Authorization': 'Bearer ' + AUTH['admin']['token']}, data={'recommendation_id': recommendation['recommendation_id']})
        assert approved.status == 201
        saved_score = approved.json()['placement']['match_score_at_assignment']
        placement.get_by_role('button', name='Close modal', exact=True).click()
        expect(placement.get_by_text('Current approved students', exact=True)).to_be_visible(timeout=15000)
        placement.get_by_role('button', name='Placement history', exact=False).click()
        loaded_image(placement.locator('tbody img[alt="Synthetic student"]').first)
        loaded_image(student.locator('img[alt="Synthetic Employer logo"]').last)
        checked('Approved placement group/history student photos and student placement branding')

        edit_company()
        admin.get_by_role('button', name='Remove image', exact=True).click()
        save_company()
        expect(student.locator('img[alt="Synthetic Employer logo"]')).to_have_count(0, timeout=15000)
        expect(instructor.locator('img[alt="Synthetic Employer logo"]')).to_have_count(0, timeout=15000)
        history = admin_context.request.get(API + '/api/placements/', headers={'Authorization': 'Bearer ' + AUTH['admin']['token']}).json()['placements'][0]
        assert history['match_score_at_assignment'] == saved_score
        assert history['company']['image_url'] is None
        result = admin_context.request.post(API + '/api/auth/google/', data={'token': 'photo-none'})
        assert result.status == 200
        expect(profile.locator('img[src*="/google/"]')).to_have_count(0, timeout=15000)
        expect(profile.get_by_role('img', name='Synthetic student avatar').last).to_be_visible()
        checked('Remove refreshes company/placement views; scores unchanged; absent Google picture restores initials')

        # The same form remains usable at mobile width without changing layout.
        admin.set_viewport_size({'width': 375, 'height': 900})
        edit_company()
        expect(admin.get_by_role('button', name='Upload image', exact=True)).to_be_visible()
        assert admin.evaluate('document.documentElement.scrollWidth <= innerWidth')
        admin.screenshot(path=str(ARTIFACTS / 'mobile-company-edit.png'))
        admin.get_by_role('button', name='Cancel', exact=True).click()
        assert admin.evaluate('window.__createdUrls.every(url => window.__revokedUrls.includes(url))')
        assert not errors, errors
        (ARTIFACTS / 'results.json').write_text(json.dumps({'checks': checks, 'page_errors': errors}, indent=2), encoding='utf-8')
        print(json.dumps({'checks': checks, 'page_errors': errors}, indent=2), flush=True)
    except Exception:
        for name in ('admin', 'instructor', 'student', 'placement', 'profile'):
            page = locals().get(name)
            if page and not page.is_closed():
                try:
                    page.screenshot(path=str(ARTIFACTS / f'failure-{name}.png'))
                    (ARTIFACTS / f'failure-{name}.txt').write_text(page.locator('body').inner_text(), encoding='utf-8')
                except Exception:
                    pass
        raise
    finally:
        browser.close()
