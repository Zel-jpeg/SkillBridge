"""Isolated real API/browser SSE checks. Start freshness_server.py and Vite first.

Uses synthetic auth from the ignored local fixture. Never contacts a nonlocal
host. Results distinguish SQLite browser convergence from PostgreSQL delivery.
"""
import json
import re
import time
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ARTIFACTS = Path(__file__).parent / 'artifacts/freshness'
AUTH = json.loads((ARTIFACTS / 'auth.json').read_text(encoding='utf-8'))
BASE = 'http://127.0.0.1:5178'
API = 'http://127.0.0.1:8018'
checks, latencies, errors = [], [], []


def session(browser, role, mobile=False):
    context = browser.new_context(viewport={'width': 1366, 'height': 900}, is_mobile=mobile,
        user_agent='Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' if mobile else None)
    context.route(re.compile(r'^https?://(?!127\.0\.0\.1|localhost)'), lambda route: route.abort())
    values = {'sb-token': AUTH[role]['token'], 'sb-role': role, 'sb-user': json.dumps(AUTH[role]['user'])}
    context.add_init_script('''(() => {
      const values = ''' + json.dumps(values) + ''';
      for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
      window.__changes = [];
      window.__activeStreams = 0; window.__maxStreams = 0;
      const OriginalSource = window.EventSource;
      window.EventSource = class extends OriginalSource {
        constructor(...args) { super(...args); this.counted = true; window.__activeStreams++; window.__maxStreams = Math.max(window.__maxStreams, window.__activeStreams); }
        close() { if (this.counted) { window.__activeStreams--; this.counted = false; } super.close(); }
      };
      window.addEventListener('sse:data_changed', event => window.__changes.push({ at: Date.now(), detail: event.detail }));
    })()''')
    if role == 'student':
        # Instrument marker lifecycle without downloading Leaflet/remote tiles.
        # This exercises production map effects, not actual Leaflet rendering.
        context.add_init_script('''(() => {
          window.__maps = [];
          window.L = {
            map() { const map = { markers: [], views: 0, zoomControl: {setPosition(){}},
              setView() { this.views++; return this; }, fitBounds() { this.views++; return this; },
              invalidateSize() {}, remove() { this.removed = true; } };
              window.__maps.push(map); return map; },
            tileLayer() { return {addTo(){}}; }, divIcon(value) { return value; },
            featureGroup() { return {getBounds(){ return {pad(){return {};}}; }}; },
            marker(coords, options) { return {coords, options,
              addTo(map) { this.map = map; map.markers.push(this); return this; },
              bindPopup(html) { this.html = html; return this; },
              openPopup() { this.open = true; return this; }, isPopupOpen() { return !!this.open; },
              getLatLng() { return coords; }, remove() { this.map.markers = this.map.markers.filter(m => m !== this); } }; }
          };
        })()''')
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    return context, page


def go(page, path):
    page.goto(BASE + path, wait_until='domcontentloaded')
    # SSE intentionally keeps a request open; wait for the initial stream/data.
    page.wait_for_function('window.__changes.some(event => event.detail.resync)', timeout=15000)


def mutate(context, role, method, path, data=None):
    response = context.request.fetch(API + path, method=method, data=data,
        headers={'Authorization': 'Bearer ' + AUTH[role]['token']})
    assert response.ok, f'{method} {path}: {response.status} {response.text()[:200]}'
    return response.json() if response.status != 204 else None


def record(name, start=None):
    checks.append(name)
    if start is not None:
        latencies.append({'check': name, 'response_to_dom_ms': round((time.perf_counter() - start) * 1000)})


with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    admin_context, admin = session(browser, 'admin')
    instructor_context, instructor = session(browser, 'instructor')
    student_context, student = session(browser, 'student', mobile=True)
    go(admin, '/admin/dashboard')
    go(instructor, '/instructor/dashboard')
    go(student, f"/student/assessments/{AUTH['ids']['assessment']}/take")
    for name, page in [('admin', admin), ('instructor', instructor), ('student', student)]:
        (ARTIFACTS / f'{name}-initial.txt').write_text(page.locator('body').inner_text(), encoding='utf-8')
    try:
        ids = AUTH['ids']
        student.get_by_role('checkbox').check()
        student.get_by_role('button', name='Agree & start', exact=True).click()
        answer = student.get_by_role('button', name=re.compile('Synthetic correct'))
        expect(answer).to_be_visible()
        answer.click()
        before = student.evaluate("({answers: localStorage.getItem('sb_answers_" + str(ids['assessment']) + "'), marker: localStorage.getItem('sb_integrity_active_" + str(ids['assessment']) + "'), timer: Number(localStorage.getItem('sb_timer_" + str(ids['assessment']) + "')), changes: window.__changes.length})")
        mutate(instructor_context, 'instructor', 'PATCH', f"/api/instructor/assessments/{ids['assessment']}/", {'title': 'Synthetic assessment revised'})
        student.wait_for_function('count => window.__changes.length > count', arg=before['changes'])
        expect(answer).to_have_class(re.compile('border-green-500'))
        after = student.evaluate("({answers: localStorage.getItem('sb_answers_" + str(ids['assessment']) + "'), marker: localStorage.getItem('sb_integrity_active_" + str(ids['assessment']) + "'), timer: Number(localStorage.getItem('sb_timer_" + str(ids['assessment']) + "'))})")
        assert after['answers'] == before['answers'] and after['marker'] == before['marker']
        assert 0 <= before['timer'] - after['timer'] <= 10
        expect(student.get_by_text('Integrity monitoring active')).to_be_visible()
        record('Active assessment answers, layout, timer and integrity state survive invalidation')

        student.get_by_role('button', name='Review answers', exact=True).click()
        student.get_by_role('button', name='Submit', exact=True).click()
        with student.expect_response(lambda response: '/submit/' in response.url, timeout=30000) as submitted:
            student.get_by_role('button', name='Yes, submit', exact=True).click()
        assert submitted.value.ok
        start = time.perf_counter()
        expect(admin.get_by_text('100%', exact=True)).to_be_visible(timeout=10000)
        expect(instructor.get_by_role('row').filter(has_text='Synthetic student').get_by_text('Done', exact=True)).to_be_visible(timeout=10000)
        record('Student UI submission updates open admin and instructor dashboards', start)

        go(student, '/student/assessments')
        mutate(instructor_context, 'instructor', 'PATCH', f"/api/instructor/students/{AUTH['student']['user']['id']}/retake/", {'assessment_id': ids['assessment'], 'retake_allowed': True})
        start = time.perf_counter()
        expect(student.get_by_role('button', name='Retake Assessment', exact=True)).to_be_visible(timeout=10000)
        record('Retake approval reaches an already open student assessment list', start)
        mutate(instructor_context, 'instructor', 'PATCH', f"/api/instructor/assessments/{ids['draft']}/", {'publication_status': 'published'})
        start = time.perf_counter()
        expect(student.get_by_text('Synthetic future assessment', exact=True)).to_be_visible(timeout=10000)
        record('Publication reaches an already open student assessment list', start)

        # A live read-only selection updates from the current source and clears on removal.
        instructor.get_by_role('row').filter(has_text='Synthetic student').get_by_text('Synthetic student', exact=True).click()
        expect(instructor.locator('dialog[open]')).to_be_visible()
        mutate(student_context, 'student', 'PATCH', '/api/students/me/profile/', {'name': 'Synthetic learner revised', 'studentId': '2099-99999', 'course': 'BSIT', 'pinLat': 7.31, 'pinLng': 125.62})
        start = time.perf_counter()
        expect(instructor.locator('dialog[open]').get_by_text('Synthetic learner revised', exact=True)).to_be_visible(timeout=10000)
        record('Open student detail updates with profile changes', start)
        instructor.get_by_role('button', name='Close student details', exact=True).click()

        # A metadata draft is separate from the live assessment header.
        go(admin, '/admin/assessments')
        admin.get_by_role('button', name='Synthetic assessment revised', exact=True).click()
        title = admin.get_by_label('Title', exact=True)
        title.fill('Unsaved local title')
        mutate(instructor_context, 'instructor', 'PATCH', f"/api/instructor/assessments/{ids['assessment']}/", {'title': 'Synthetic remote title'})
        expect(admin.get_by_role('dialog').get_by_role('heading', name=re.compile('Synthetic remote title'))).to_be_visible(timeout=10000)
        expect(title).to_have_value('Unsaved local title')
        record('Unsaved assessment metadata draft survives remote edit')
        admin.get_by_role('button', name='Close', exact=True).click()

        # Generated reports keep their original payload and become explicitly stale.
        go(admin, '/admin/reports')
        admin.get_by_role('button', name='Generate report', exact=True).click()
        expect(admin.get_by_text(re.compile('Generated .*records'))).to_be_visible(timeout=10000)
        generated = admin.get_by_text(re.compile('Generated .*records')).inner_text()
        mutate(instructor_context, 'instructor', 'PATCH', f"/api/instructor/assessments/{ids['assessment']}/", {'title': 'Synthetic report change'})
        expect(admin.get_by_role('button', name='Regenerate report', exact=True)).to_be_visible(timeout=10000)
        assert admin.get_by_text(re.compile('Generated .*records')).inner_text() == generated
        record('Generated assessment report retains its timestamp and exposes regeneration')

        # Company/capacity and placement updates reach staff and the student's saved result view.
        go(admin, '/admin/placements')
        go(instructor, '/instructor/companies')
        go(student, '/student/results')
        student.wait_for_function('window.__maps.some(map => !map.removed && map.markers.length === 2)')
        initial_views = student.evaluate('window.__maps.filter(map => !map.removed)[0].views')
        student.evaluate('window.__maps.filter(map => !map.removed)[0].markers.find(m => m.html.includes("Synthetic Employer")).openPopup()')
        mutate(admin_context, 'admin', 'PATCH', f"/api/admin/companies/{ids['company']}/", {'name': 'Synthetic renamed employer'})
        start = time.perf_counter()
        expect(admin.get_by_text('Synthetic renamed employer', exact=True).first).to_be_visible(timeout=10000)
        expect(instructor.get_by_text('Synthetic renamed employer', exact=True).first).to_be_visible(timeout=10000)
        expect(student.get_by_text('Synthetic renamed employer', exact=True).first).to_be_visible(timeout=10000)
        record('Company edits reach open placement, company and student result views', start)
        student.wait_for_function('window.__maps.some(map => !map.removed && map.markers.some(m => m.html.includes("Synthetic renamed employer") && m.open))')
        assert student.evaluate('window.__maps.filter(map => !map.removed)[0].views') == initial_views
        record('Result map markers and open popup reconcile while keeping viewport (instrumented Leaflet)')
        mutate(admin_context, 'admin', 'PATCH', f"/api/admin/positions/{ids['position']}/", {'slots': 8})
        start = time.perf_counter()
        expect(admin.get_by_text(re.compile('8.*slots', re.I)).first).to_be_visible(timeout=10000)
        record('Position capacity reaches open placement suggestions', start)
        mutate(admin_context, 'admin', 'POST', '/api/placements/manual-assign/', {'student_id': AUTH['student']['user']['id'], 'position_id': ids['position'], 'remarks': 'Synthetic local verification'})
        start = time.perf_counter()
        expect(student.get_by_text('Approved', exact=True).first).to_be_visible(timeout=10000)
        record('Manual placement reaches an open student result view', start)

        # Real offline EventSource interruption, a mutation during disconnect, then resync.
        instructor_context.set_offline(True)
        mutate(admin_context, 'admin', 'PATCH', f"/api/admin/companies/{ids['company']}/", {'name': 'Synthetic after reconnect'})
        instructor_context.set_offline(False)
        start = time.perf_counter()
        expect(instructor.get_by_text('Synthetic after reconnect', exact=True).first).to_be_visible(timeout=15000)
        record('Disconnected view converges after reconnection and resynchronization', start)
        go(student, '/student/dashboard')
        student.wait_for_function('window.__maps.some(map => !map.removed && map.markers.length === 2)')
        dashboard_views = student.evaluate('window.__maps.filter(map => !map.removed)[0].views')
        mutate(admin_context, 'admin', 'PATCH', f"/api/admin/companies/{ids['company']}/", {'lat': 7.4, 'lng': 125.7})
        student.wait_for_function('window.__maps.some(map => !map.removed && map.markers.some(m => m.coords[0] === 7.4))')
        mutate(student_context, 'student', 'PATCH', '/api/students/me/profile/', {'name': 'Synthetic learner revised', 'studentId': '2099-99999', 'course': 'BSIT', 'pinLat': 7.33, 'pinLng': 125.66})
        student.wait_for_function('window.__maps.some(map => !map.removed && map.markers.some(m => m.coords[0] === 7.33))')
        assert student.evaluate('window.__maps.filter(map => !map.removed)[0].views') == dashboard_views
        record('Dashboard map pins reconcile without resetting viewport (instrumented Leaflet)')

        # Import and batch archive affect only the relevant authorized sessions.
        go(instructor, '/instructor/dashboard')
        rows = [{'student_id': '2099-88888', 'name': 'Synthetic import student', 'email': 'import.synthetic@dnsc.edu.ph', 'course': 'BSIT'}]
        preview = mutate(instructor_context, 'instructor', 'POST', f"/api/instructor/batches/{ids['batch']}/enroll/preview/", {'students': rows})
        mutate(instructor_context, 'instructor', 'POST', f"/api/instructor/batches/{ids['batch']}/enroll/", {'students': preview['rows'], 'review_token': preview['review_token']})
        start = time.perf_counter()
        expect(instructor.get_by_role('table').get_by_text('Synthetic Import Student', exact=True)).to_be_visible(timeout=10000)
        record('Bulk enrollment reaches an open instructor dashboard', start)
        instructor.get_by_role('row').filter(has_text='Synthetic learner revised').get_by_text('Synthetic learner revised', exact=True).click()
        expect(instructor.locator('dialog[open]')).to_be_visible()
        mutate(instructor_context, 'instructor', 'DELETE', f"/api/instructor/students/{AUTH['student']['user']['id']}/")
        start = time.perf_counter()
        expect(instructor.locator('dialog[open]')).to_have_count(0, timeout=10000)
        expect(student.get_by_text('Session Expired', exact=True)).to_be_visible(timeout=10000)
        record('Enrollment removal clears an open detail and terminates unauthorized student stream', start)
        mutate(instructor_context, 'instructor', 'POST', f"/api/instructor/batches/{ids['batch']}/archive/")
        start = time.perf_counter()
        expect(instructor.get_by_text(re.compile('No students', re.I)).first).to_be_visible(timeout=10000)
        record('Batch archive reconciles the active instructor dashboard', start)
        for page in [admin, instructor, student]:
            assert page.evaluate('window.__maxStreams') <= 1
        record('Protected pages maintain at most one active stream per page identity')
        admin.get_by_role('button', name='Open profile menu', exact=True).click()
        admin.get_by_role('button', name='Log out', exact=True).click()
        admin.get_by_role('dialog').get_by_role('button', name='Log out', exact=True).click()
        expect(admin).to_have_url(BASE + '/admin/login')
        assert admin.evaluate('window.__activeStreams') == 0
        assert admin.evaluate("localStorage.getItem('sb-token')") is None
        record('Logout closes the stream and clears authentication')
        assert not errors, errors
    finally:
        for name, page in [('admin', admin), ('instructor', instructor), ('student', student)]:
            (ARTIFACTS / f'{name}-final.txt').write_text(page.locator('body').inner_text(), encoding='utf-8')
            page.screenshot(path=str(ARTIFACTS / f'{name}-final.png'), full_page=True)
        result = {'database': 'isolated local SQLite; PostgreSQL cross-worker not verified',
            'checks': checks, 'latencies': latencies, 'browser_errors': errors}
        (ARTIFACTS / 'results.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
        print(json.dumps(result, indent=2))
        browser.close()

