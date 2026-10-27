"""Real React/Django recovery flow on disposable SQLite; no remote API or emails."""
import json
import os
import re
import sys
import threading
import uuid
from pathlib import Path
from urllib.parse import urlparse
from unittest.mock import patch
from wsgiref.simple_server import WSGIRequestHandler, make_server

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).parent / 'artifacts/student-record-recovery'
OUT.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(ROOT / 'skillbridge-backend'))
os.environ.update(PYTHON_DOTENV_DISABLED='1', DJANGO_SETTINGS_MODULE='core.test_settings', DEBUG='True',
                  SECRET_KEY='synthetic-student-record-browser-only', DJANGO_ALLOW_ASYNC_UNSAFE='true')
from django.conf import settings
settings.DATABASES['default']['NAME'] = str(OUT / f'fixture-{uuid.uuid4().hex}.sqlite3')
settings.ALLOWED_HOSTS = ['127.0.0.1', 'localhost', 'testserver']
settings.CORS_ALLOW_ALL_ORIGINS = True
import django
django.setup()
from django.core.management import call_command
call_command('migrate', verbosity=0, interactive=False)
from api.tests import OJTPlacementAPITests
from api.models import User, BatchEnrollment, ManagementAction, StudentResponse, SkillScore, OJTPlacement, AssessmentAttemptHistory
fixture = OJTPlacementAPITests(methodName='test_suggestions_are_ranked_and_instructor_is_batch_scoped')
fixture.setUp()
User.objects.filter(role='student').update(is_approved=True)
student = fixture.student_one
student.name, student.school_id, student.email, student.course = 'Alex Recovery', '2026-00001', 'alex.recovery@dnsc.edu.ph', 'BSIT'
student.save()
attempt = StudentResponse.objects.get(student=student)
AssessmentAttemptHistory.objects.create(response=attempt, attempt_number=1, status='submitted', started_at=attempt.started_at,
    category_scores=[{'category': 'Placement skills', 'raw_score': 1, 'max_score': 2, 'percentage': 50}])
placement = OJTPlacement.objects.create(student=student, batch=fixture.batch, company=fixture.company,
    position=fixture.position, status='approved', match_score_at_assignment=75, remarks='Preserved synthetic placement')
archived = User.objects.create_user(email='archived.recovery@dnsc.edu.ph', name='Archived Recovery', school_id='2026-00009', course='BSIT', role='student', is_approved=True, is_active=False)
BatchEnrollment.objects.create(student=archived, batch=fixture.batch)
for i in range(12):
    person = User.objects.create_user(email=f'previous{i}@dnsc.edu.ph', name=f'Previous Student {i:02d}',
        school_id=f'2026-{i+100:05d}', course='BSIS' if i % 2 else 'BSIT', role='student', is_approved=True, is_active=i != 0)
    ManagementAction.objects.create(actor=fixture.admin, action='enrollment.remove', target_type='student', target_id=person.id, batch_id_snapshot=fixture.batch.id)
from rest_framework_simplejwt.tokens import RefreshToken
from django.core.wsgi import get_wsgi_application
class Quiet(WSGIRequestHandler):
    def log_message(self, *args): pass
server = make_server('127.0.0.1', 8031, get_wsgi_application(), handler_class=Quiet)
threading.Thread(target=server.serve_forever, daemon=True).start()
from playwright.sync_api import sync_playwright, expect
checks, errors = [], []

def open_page(browser, role, path, width=1440):
    user = fixture.admin if role == 'admin' else fixture.instructor
    context = browser.new_context(viewport={'width': width, 'height': 1000}, reduced_motion='reduce')
    values = {'sb-token': str(RefreshToken.for_user(user).access_token), 'sb-role': role,
              'sb-user': json.dumps({'id': user.id, 'role': role, 'name': user.name, 'is_approved': True})}
    context.add_init_script('for(const [k,v] of Object.entries('+json.dumps(values)+'))localStorage.setItem(k,v);window.EventSource=class{close(){}};')
    faults = {'preview': False, 'confirm': False, 'history': False, 'previous': False}
    def route(r):
        url = urlparse(r.request.url)
        if url.path.startswith('/api/'):
            if url.path.endswith('/events/'): return r.fulfill(status=204)
            if ((faults['history'] and url.path.endswith('/history/')) or
                (faults['previous'] and url.path.endswith('/unenrolled/')) or
                (faults['preview'] and url.path.endswith('/enroll/preview/')) or
                (faults['confirm'] and url.path.endswith('/enroll/'))):
                return r.fulfill(status=503, json={'error': 'Synthetic temporary recovery outage'})
            return r.continue_(url='http://127.0.0.1:8031'+url.path+('?' + url.query if url.query else ''))
        return r.continue_() if url.hostname in ('127.0.0.1', 'localhost') else r.abort()
    context.route('**/*', route)
    page = context.new_page()
    page.recovery_faults = faults
    page.set_default_timeout(15000)
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://127.0.0.1:5178'+path)
    page.wait_for_load_state('networkidle')
    return context, page

with patch('api.views.send_instructor_email', return_value=False), sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    try:
        context, page = open_page(browser, 'admin', '/admin/users')
        page.get_by_role('button', name='View student Alex Recovery', exact=True).click()
        page.get_by_role('button', name='Archive student account', exact=True).click()
        confirm = page.get_by_role('dialog', name='Archive student account?', exact=True)
        expect(confirm).to_contain_text('assessment answers and scores')
        confirm.get_by_role('button', name='Cancel', exact=True).click()
        student.refresh_from_db(); assert student.is_active
        page.get_by_role('button', name='View student Alex Recovery', exact=True).click()
        page.get_by_role('button', name='Archive student account', exact=True).click()
        page.get_by_role('dialog', name='Archive student account?', exact=True).get_by_role('button', name='Archive account', exact=True).click()
        expect(page.get_by_role('dialog', name='Archive student account?', exact=True)).to_have_count(0)
        page.get_by_role('button', name='Archived', exact=False).first.click()
        page.recovery_faults['history'] = True
        page.get_by_text('Alex Recovery', exact=True).click()
        detail = page.get_by_role('dialog', name='Alex Recovery', exact=True)
        expect(detail.get_by_role('button', name='Retry', exact=True).first).to_be_visible()
        page.recovery_faults['history'] = False
        detail.get_by_role('button', name='Retry', exact=True).first.click()
        expect(detail.get_by_label('History batch')).to_be_visible()
        detail.get_by_role('tab', name='Assessments', exact=False).click()
        expect(detail.get_by_role('heading', name='Placement Batch assessment', exact=True)).to_be_visible()
        detail.get_by_role('tab', name='Retake history', exact=False).click()
        expect(detail.get_by_text('50%', exact=False).first).to_be_visible()
        detail.get_by_role('tab', name='Overview', exact=True).click()
        expect(detail.get_by_text('Preserved synthetic placement', exact=True)).to_be_visible()
        for width in [320, 768, 1440]:
            page.set_viewport_size({'width': width, 'height': 1000})
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), width
        detail.get_by_role('button', name='Restore account', exact=True).click()
        expect(detail).to_have_count(0)
        student.refresh_from_db(); assert student.is_active
        assert OJTPlacement.objects.get(pk=placement.pk).status == 'approved'
        # Restore can invalidate a mounted archived-history read with a 404.
        # Re-archiving the same account must recover without manual tab reopening.
        page.evaluate('async id => { const {fetchWithDedup}=await import("/src/hooks/useApi.js"); try { await fetchWithDedup(`/api/admin/users/${id}/history/`) } catch {} }', student.id)
        page.goto('http://127.0.0.1:5178/admin/users')
        page.wait_for_load_state('networkidle')
        page.get_by_role('button', name='View student Alex Recovery', exact=True).click()
        page.get_by_role('button', name='Archive student account', exact=True).click()
        page.get_by_role('dialog', name='Archive student account?', exact=True).get_by_role('button', name='Archive account', exact=True).click()
        expect(page.get_by_role('dialog', name='Archive student account?', exact=True)).to_have_count(0)
        page.get_by_role('button', name='Archived', exact=False).first.click()
        page.get_by_text('Alex Recovery', exact=True).click()
        detail = page.get_by_role('dialog', name='Alex Recovery', exact=True)
        expect(detail.get_by_label('History batch')).to_be_visible()
        detail.get_by_role('button', name='Restore account', exact=True).click()
        expect(detail).to_have_count(0)
        checks.append('Admin archive confirmation/cancel, Archived destination, preserved assessment/retake/placement history, responsive read-only modal and restore')
        context.close()

        for role in ['admin', 'instructor']:
            path = f'/admin/batches?batch_id={fixture.batch.id}' if role == 'admin' else f'/instructor/students?batch_id={fixture.batch.id}'
            context, page = open_page(browser, role, path)
            page.get_by_label('Account status', exact=True).select_option('archived')
            expect(page.get_by_role('button', name=re.compile(r'^(View student )?Archived Recovery$'))).to_be_visible()
            expect(page.get_by_role('button', name=re.compile(r'^(View student )?Alex Recovery$'))).to_have_count(0)
            page.get_by_label('Account status', exact=True).select_option('active')
            page.get_by_role('button', name='Unenroll Alex Recovery from batch' if role == 'admin' else 'Unenroll Alex Recovery from this batch', exact=True).first.click()
            confirm = page.get_by_role('dialog', name='Unenroll from this batch?', exact=True)
            expect(confirm).to_contain_text('placement history')
            confirm.get_by_role('button', name='Unenroll student', exact=True).click()
            expect(confirm).to_have_count(0)
            if role == 'admin': page.recovery_faults['previous'] = True
            page.get_by_label('Enrollment', exact=True).select_option('unenrolled')
            panel = page.get_by_role('region', name='Previously unenrolled students', exact=True)
            if role == 'admin':
                expect(panel.get_by_role('button', name='Retry', exact=True)).to_be_visible()
                page.recovery_faults['previous'] = False
                panel.get_by_role('button', name='Retry', exact=True).click()
            expect(panel.locator('strong:visible').filter(has_text='Alex Recovery')).to_be_visible()
            expect(panel.get_by_role('button', name='Re-enroll in this batch', exact=True).first).to_be_visible()
            # Filters and pagination apply to the selected batch only.
            page.get_by_label('Account status', exact=True).select_option('all')
            expect(panel.get_by_role('button', name='2', exact=True)).to_be_visible()
            panel.get_by_role('button', name='2', exact=True).click()
            page.get_by_label('Account status', exact=True).select_option('archived')
            expect(panel.locator('strong:visible').filter(has_text='Previous Student 00')).to_be_visible()
            expect(panel.get_by_role('button', name='2', exact=True)).to_have_count(0)
            expect(panel.get_by_role('button', name='Re-enroll in this batch', exact=True)).to_have_count(0)
            if role == 'admin': expect(panel.get_by_role('link', name='Restore account in Users', exact=True).first).to_be_visible()
            else: expect(panel.get_by_text('Admin restoration required', exact=True).first).to_be_visible()
            page.get_by_label('Account status', exact=True).select_option('active')
            for width in [320, 768, 1440]:
                page.set_viewport_size({'width': width, 'height': 1000})
                page.evaluate('document.documentElement.classList.toggle("dark", innerWidth===768)')
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (role, width)
                page.screenshot(path=str(OUT / f'{role}-previous-{width}.png'), full_page=True)
            # Alex sorts before the synthetic Previous students in both views.
            panel.get_by_role('button', name='Re-enroll in this batch', exact=True).first.click()
            enrollment = page.get_by_role('dialog', name='Enroll students', exact=True)
            expect(enrollment.get_by_label('DNSC Email', exact=True)).to_have_value(student.email)
            if role == 'admin':
                page.recovery_faults['preview'] = True
                enrollment.get_by_role('button', name='Preview student', exact=True).click()
                expect(enrollment.locator('.enrollment-error')).to_be_visible()
                page.recovery_faults['preview'] = False
            enrollment.get_by_role('button', name='Preview student', exact=True).click()
            enrollment.get_by_role('checkbox', name='I verified the Student IDs and final DNSC email addresses.').check()
            enrollment.get_by_role('button', name='Confirm 1 enrollments', exact=True).click()
            confirm = page.get_by_role('dialog', name='Re-enroll student?', exact=True)
            expect(confirm).to_contain_text('Alex Recovery')
            if role == 'admin':
                confirm.get_by_role('button', name='Cancel', exact=True).click()
                assert not BatchEnrollment.objects.filter(student=student, batch=fixture.batch).exists()
                enrollment.get_by_role('button', name='Confirm 1 enrollments', exact=True).click()
                page.recovery_faults['confirm'] = True
                confirm.get_by_role('button', name='Re-enroll student', exact=True).click()
                expect(confirm).to_have_count(0)
                expect(enrollment.locator('.enrollment-error')).to_be_visible()
                assert not BatchEnrollment.objects.filter(student=student, batch=fixture.batch).exists()
                page.recovery_faults['confirm'] = False
                enrollment.get_by_role('button', name='Preview student', exact=True).click()
                enrollment.get_by_role('checkbox', name='I verified the Student IDs and final DNSC email addresses.').check()
                enrollment.get_by_role('button', name='Confirm 1 enrollments', exact=True).click()
                page.recovery_faults['previous'] = True
            confirm.get_by_role('button', name='Re-enroll student', exact=True).evaluate('(button)=>{button.click();button.click()}')
            expect(confirm).to_have_count(0)
            expect(enrollment.get_by_role('button', name='Done', exact=True)).to_be_visible()
            enrollment.get_by_role('button', name='Done', exact=True).click()
            expect(panel.get_by_text('Alex Recovery', exact=True)).to_have_count(0)
            if role == 'admin':
                expect(panel.get_by_text('Could not refresh. Showing the last loaded data.', exact=True)).to_be_visible()
                page.recovery_faults['previous'] = False
                panel.get_by_role('button', name='Retry', exact=True).click()
                expect(panel.get_by_role('button', name='Retry', exact=True)).to_have_count(0)
            page.get_by_label('Enrollment', exact=True).select_option('enrolled')
            expect(page.get_by_role('button', name=re.compile(r'^(View student )?Alex Recovery$'))).to_be_visible()
            assert BatchEnrollment.objects.filter(student=student, batch=fixture.batch).count() == 1
            assert StudentResponse.objects.filter(pk=attempt.pk, status='submitted').exists()
            assert SkillScore.objects.filter(student=student).count() == 1
            assert OJTPlacement.objects.get(pk=placement.pk).status == 'approved'
            assert not StudentResponse.objects.get(pk=attempt.pk).retake_allowed
            checks.append(f'{role}: account/enrollment filters, scoped removal destination, pagination reset, archived restrictions, phone/tablet/desktop light/dark, prefilled verified re-enrollment, duplicate protection and retained history' + ('; preview/save/read failure, cancel, explicit re-preview and read-only retry' if role == 'admin' else ''))
            context.close()
        assert not errors, errors
    finally:
        browser.close(); server.shutdown()
        result = {'checks': checks, 'page_errors': errors, 'database': 'Disposable local SQLite; email dispatch mocked'}
        (OUT / 'results.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
        print(json.dumps(result, indent=2), flush=True)
