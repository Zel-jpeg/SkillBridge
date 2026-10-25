"""Real local React/Django draft workflow against disposable SQLite, no remote API.

Start Vite on port 5178; run with backend venv Python and installed headless Chrome.
The script creates a uniquely named SQLite fixture under ignored tests/artifacts.
Every nonlocal API origin is redirected here; external non-API requests are blocked.
"""
import json
import os
import sys
import threading
import uuid
from pathlib import Path
from urllib.parse import urlparse
from wsgiref.simple_server import WSGIRequestHandler, make_server

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).parent / 'artifacts/placement-draft'
OUT.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(ROOT / 'skillbridge-backend'))
os.environ.update(PYTHON_DOTENV_DISABLED='1', DJANGO_SETTINGS_MODULE='core.test_settings',
                  DEBUG='True', SECRET_KEY='synthetic-local-draft-ui-key-not-for-deployment',
                  # Playwright's sync driver owns an event loop. These assertions
                  # run serially against this script's disposable fixture only.
                  DJANGO_ALLOW_ASYNC_UNSAFE='true')
from django.conf import settings
settings.DATABASES['default']['NAME'] = str(OUT / f'fixture-{uuid.uuid4().hex}.sqlite3')
settings.ALLOWED_HOSTS = ['127.0.0.1', 'localhost', 'testserver']
settings.CORS_ALLOW_ALL_ORIGINS = True
import django
django.setup()
from django.core.management import call_command
call_command('migrate', verbosity=0, interactive=False)
from api.tests import OJTPlacementAPITests
fixture = OJTPlacementAPITests(methodName='test_suggestions_are_ranked_and_instructor_is_batch_scoped')
fixture.setUp()
from api.models import User, Recommendation, Position, OJTPlacement, CombinedCompetencyProfile
from api.placement_drafts import active_suggestions
from api.recommendation_freshness import input_fingerprint
User.objects.filter(role='student').update(is_approved=True)
Recommendation.objects.create(student=fixture.student_three, batch=fixture.other_batch, position=fixture.position, match_score=99)
Recommendation.objects.create(student=fixture.student_two, batch=fixture.batch, position=fixture.other_position, match_score=35)
manual_position = Position.objects.create(company=fixture.company, title='Manual support', slots_available=1)
manual_student = User.objects.create_user(email='synthetic-manual@example.com', name='Synthetic Manual Student', role='student', is_approved=True)
manual_record = OJTPlacement.objects.create(student=manual_student, batch=None, company=fixture.company, position=manual_position, status='approved', approved_by=fixture.admin)
for profile in CombinedCompetencyProfile.objects.select_related('student'):
    profile.ranking_input_fingerprint = input_fingerprint(profile.student)
    profile.save(update_fields=['ranking_input_fingerprint'])
from rest_framework_simplejwt.tokens import RefreshToken
from datetime import timedelta
tokens = {}
for role, user in [('admin', fixture.admin), ('instructor', fixture.instructor), ('other', fixture.other_instructor)]:
    token = RefreshToken.for_user(user).access_token
    token.set_exp(lifetime=timedelta(hours=1))  # Synthetic local browser matrix only.
    tokens[role] = str(token)
from django.core.wsgi import get_wsgi_application
class Quiet(WSGIRequestHandler):
    def log_message(self, *args): pass
server = make_server('127.0.0.1', 8024, get_wsgi_application(), handler_class=Quiet)
thread = threading.Thread(target=server.serve_forever, daemon=True)
thread.start()
from playwright.sync_api import sync_playwright, expect
checks, errors, layouts = [], [], []

def navigate(browser, role, width=1440, fail_sync_once=False):
    actual_role = 'instructor' if role == 'other' else role
    user = fixture.admin if role == 'admin' else fixture.instructor if role == 'instructor' else fixture.other_instructor
    context = browser.new_context(viewport={'width': width, 'height': 1000}, reduced_motion='reduce')
    values = {'sb-token': tokens[role], 'sb-role': actual_role, 'sb-user': json.dumps({'id': user.id, 'role': actual_role, 'name': user.name, 'is_approved': True})}
    context.add_init_script('for (const [k,v] of Object.entries(' + json.dumps(values) + ')) localStorage.setItem(k,v)')
    failed_sync = []
    def route_request(route):
        if fail_sync_once and not failed_sync and route.request.method == 'POST' and urlparse(route.request.url).path == '/api/placements/draft/' and route.request.post_data_json.get('action') == 'sync':
            failed_sync.append(True)
            return route.fulfill(status=503, content_type='application/json', body='{"error":"Synthetic temporary outage"}')
        url = urlparse(route.request.url)
        if url.path.endswith('/events/'):
            return route.fulfill(status=204)
        if url.path.startswith('/api/'):
            return route.continue_(url='http://127.0.0.1:8024' + url.path + ('?' + url.query if url.query else ''))
        return route.continue_() if url.hostname in ('127.0.0.1', 'localhost') else route.abort()
    context.route('**/*', route_request)
    page = context.new_page()
    page.set_default_timeout(15_000)
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(f'http://127.0.0.1:5178/{actual_role}/placements')
    page.wait_for_load_state('networkidle')
    return context, page

def assert_button_feedback(page, control):
    page.mouse.move(0, 0)
    appearance = "node => {const s=getComputedStyle(node);return [s.backgroundColor,s.borderColor,s.boxShadow].join('|')}"
    normal = control.evaluate(appearance)
    control.hover()
    assert control.evaluate(appearance) != normal, 'Enabled control has no visible hover feedback'
    page.keyboard.press('Tab')
    control.focus()
    assert control.evaluate("node => getComputedStyle(node).outlineStyle") == 'solid', 'Missing keyboard focus outline'
    assert control.evaluate("node => getComputedStyle(node).cursor") == 'pointer'

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    try:
        context, page = navigate(browser, 'admin', fail_sync_once=True)
        expect(page.get_by_role('button', name='Open company', exact=False)).to_have_count(2)
        expect(page.get_by_role('alert')).to_contain_text('Could not update suggestions')
        assert active_suggestions().count() == 0
        page.get_by_role('button', name='Refresh suggestions', exact=True).click()
        expect(page.get_by_text('Suggestions updated automatically · Awaiting coordinator approval', exact=True)).to_be_visible()
        expect(page.get_by_role('button', name='Preview updated suggestions', exact=True)).to_have_count(0)
        assert active_suggestions().count() == 3
        assert OJTPlacement.objects.filter(status='approved').count() == 1
        checks.append('Automatic update, recoverable failure/retry, no generation panel and no automatic approvals')
        stable_ids = list(active_suggestions().order_by('id').values_list('id', flat=True))
        Position.objects.filter(pk=fixture.other_position.id).update(slots_available=3)
        with page.expect_response(lambda response: urlparse(response.url).path == '/api/placements/draft/' and response.request.method == 'POST'):
            page.evaluate("async () => { const {applyDataChange} = await import('/src/hooks/useApi.js'); applyDataChange({topics:['capacity']}) }")
        expect(page.get_by_text('Suggestions updated automatically · Awaiting coordinator approval', exact=True)).to_be_visible()
        assert list(active_suggestions().order_by('id').values_list('id', flat=True)) == stable_ids
        checks.append('Live capacity invalidation automatically updates suggestions while preserving stable records')
        assert_button_feedback(page, page.get_by_role('button', name='Open company Company Two', exact=True))
        assert_button_feedback(page, page.get_by_role('button', name='Decision history', exact=True))
        page.screenshot(path=str(OUT / 'admin-overview.png'), full_page=True)
        page.get_by_role('button', name='Open company Company Two', exact=True).click()
        expect(page.get_by_role('button', name='Review candidate', exact=True)).to_have_count(2)
        row = page.locator('.pl-candidate-row').filter(has_text=fixture.student_two.name)
        row.get_by_role('button', name='Review candidate').click()
        review = page.get_by_role('dialog', name='Review suggested placement')
        expect(review.get_by_text('Low match.', exact=False)).to_be_visible()
        expect(review.get_by_text('Top three position matches', exact=True)).to_be_visible()
        assert_button_feedback(page, review.get_by_role('button', name='Suggest this instead').first)
        assert_button_feedback(page, review.get_by_role('button', name='Approve placement', exact=True))
        expect(review.get_by_role('button', name='Current suggestion', exact=True)).to_have_count(0)
        review.screenshot(path=str(OUT / 'admin-button-review.png'))
        review.get_by_role('button', name='Suggest this instead').first.click()
        expect(review.get_by_role('alert')).to_contain_text('already proposed')
        page.keyboard.press('Escape')
        expect(review).to_have_count(0)
        checks.append('Low-score review, ranked alternatives, capacity conflict and Escape dismissal')
        page.locator('.pl-candidate-row').filter(has_text=fixture.student_one.name).get_by_role('button', name='Review candidate').click()
        page.get_by_role('button', name='Approve placement', exact=True).click()
        confirm = page.get_by_role('dialog', name='Placement decision', exact=True)
        confirm.get_by_placeholder('Add context for placement history…').fill('Synthetic reviewed placement')
        confirm.get_by_role('button', name='Approve student', exact=True).click()
        expect(confirm).to_have_count(0)
        expect(page.get_by_role('button', name='Suggested (1)', exact=True)).to_be_visible()
        assert OJTPlacement.objects.filter(student=fixture.student_one, status='approved').count() == 1
        assert not active_suggestions().filter(student=fixture.student_one).exists()
        page.get_by_role('button', name='Approved (1)', exact=True).click()
        expect(page.locator('.pl-candidate-row').filter(has_text=fixture.student_one.name)).to_have_count(1)
        checks.append('Coordinator approval converts a draft slot exactly once and approved roster is separate')
        assert_button_feedback(page, page.get_by_role('button', name='Back to companies', exact=False))
        page.get_by_role('button', name='Back to companies', exact=False).click()
        page.get_by_label('Search', exact=True).fill(manual_student.name)
        expect(page.get_by_role('button', name='Open company', exact=False)).to_have_count(1)
        page.get_by_role('button', name='Open company Company One', exact=True).click()
        expect(page.get_by_role('button', name='Remove placement', exact=True)).to_be_visible()
        page.get_by_label('Search', exact=True).fill('')
        page.get_by_role('button', name='Manual support', exact=False).click()
        page.get_by_role('button', name='Approved (1)', exact=True).click()
        page.get_by_role('button', name='Remove placement', exact=True).click()
        confirm = page.get_by_role('dialog', name='Placement decision', exact=True)
        confirm.get_by_label('Reason (required)', exact=True).fill('Synthetic placement ended')
        confirm.get_by_role('button', name='Remove placement', exact=True).click()
        expect(confirm).to_have_count(0)
        manual_record.refresh_from_db()
        assert manual_record.status == 'removed'
        checks.append('Manual approval without recommendation has a working placement-ID removal action')
        page.get_by_role('button', name='Decision history', exact=True).click()
        expect(page.locator('.pl-history-row')).to_have_count(2)
        page.get_by_label('Search', exact=True).fill(fixture.student_one.name)
        expect(page.locator('.pl-history-row')).to_have_count(1)
        checks.append('Student search opens the matching approved position; history search runs on the server')
        context.close()
        for role in ('instructor', 'other'):
            for width in (1440, 768, 375, 320):
                context, page = navigate(browser, role, width)
                expect(page.get_by_role('button', name='Preview updated suggestions', exact=True)).to_have_count(0)
                if width == 320: page.evaluate("document.documentElement.classList.add('dark')")
                page.get_by_role('button', name='Open company Company One', exact=True).click()
                if role == 'other':
                    page.get_by_role('button', name='Review candidate', exact=True).click()
                    expect(page.get_by_role('dialog').get_by_text(fixture.student_three.name, exact=True)).to_be_visible()
                    expect(page.get_by_role('dialog').get_by_text(fixture.student_one.name, exact=True)).to_have_count(0)
                    page.screenshot(path=str(OUT / f'{role}-review-{width}.png'))
                    page.keyboard.press('Escape')
                page.screenshot(path=str(OUT / f'{role}-workspace-{width}.png'), full_page=True)
                if width >= 1024:
                    assert page.locator('.pl-page').bounding_box()['x'] >= page.locator('.sb-desktop-sidebar').bounding_box()['width']
                layouts.append(page.evaluate("""() => ({width: innerWidth, x: scrollX, y: scrollY,
                  page: document.querySelector('.pl-page').getBoundingClientRect().toJSON(),
                  margin: getComputedStyle(document.querySelector('.sb-workspace')).marginLeft,
                  sidebar: document.querySelector('.sb-desktop-sidebar').getBoundingClientRect().toJSON()})"""))
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (role, width)
                context.close()
        checks.append('Visible button/card/tab hover feedback and keyboard focus, separate current-suggestion status, scoped responsive layouts and dark mode')
        assert not errors, errors
    finally:
        browser.close()
        server.shutdown()
        summary = {'checks': checks, 'page_errors': errors, 'layouts': layouts, 'database': 'Disposable local SQLite only'}
        (OUT / 'results.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
        print(json.dumps(summary, indent=2))
