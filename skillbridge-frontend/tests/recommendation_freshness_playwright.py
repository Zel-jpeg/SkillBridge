"""Real React/API stale-ranking lifecycle; owned local servers, synthetic data only."""
from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import sys
from threading import Thread
import time
from unittest.mock import patch
from urllib.parse import urlparse
from urllib.request import urlopen
from wsgiref.simple_server import make_server, WSGIRequestHandler

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'skillbridge-backend'))
os.environ.update(PYTHON_DOTENV_DISABLED='1', SECRET_KEY='synthetic-freshness-browser-only-key',
                  DEBUG='True', DJANGO_SETTINGS_MODULE='core.test_settings')
from django.conf import settings
settings.DATABASES['default']['NAME'] = f'file:freshness_browser_{os.getpid()}?mode=memory&cache=shared'
settings.DATABASES['default']['OPTIONS'] = {'uri': True}
settings.ALLOWED_HOSTS = ['localhost', '127.0.0.1', 'testserver']
settings.CORS_ALLOWED_ORIGINS = ['http://127.0.0.1:5190']
settings.SECURE_SSL_REDIRECT = False
import django
django.setup()
from django.core.management import call_command
from django.core.wsgi import get_wsgi_application
from django.utils import timezone
from rest_framework_simplejwt.tokens import AccessToken
from api.combined_competency import recalculate_combined
from api.models import (Assessment, Batch, BatchEnrollment, ChangeEvent, Company, Position,
                        PositionRequirement, Recommendation, SkillCategory, SkillScore, StudentResponse, User)
from playwright.sync_api import sync_playwright, expect

OUT = Path(__file__).parent / 'artifacts/recommendation-freshness'
OUT.mkdir(parents=True, exist_ok=True)
BASE, API = 'http://127.0.0.1:5190', 'http://127.0.0.1:8090'
for port in (5190, 8090):
    with socket.socket() as probe:
        assert probe.connect_ex(('127.0.0.1', port)) != 0, f'Port {port} already owned'

call_command('migrate', verbosity=0)
admin = User.objects.create_user('freshness-admin@example.invalid', name='Synthetic Admin', role='admin', is_approved=True)
owner = User.objects.create_user('freshness-owner@example.invalid', name='Synthetic Instructor', role='instructor', is_approved=True)
student = User.objects.create_user('freshness-student@example.invalid', name='Synthetic Student', role='student', is_approved=True)
batch = Batch.objects.create(name='Synthetic freshness browser batch', instructor=owner)
BatchEnrollment.objects.create(batch=batch, student=student)
programming = SkillCategory.objects.create(name='Programming', tags=['Python'])
SkillCategory.objects.create(name='Networking', tags=['routing'])
assessment = Assessment.objects.create(title='Synthetic completed assessment', batch=batch, created_by=owner)
StudentResponse.objects.create(student=student, assessment=assessment, status='submitted', submitted_at=timezone.now())
SkillScore.objects.create(student=student, assessment=assessment, skill_category=programming, raw_score=1, max_score=2, percentage=50)
company = Company.objects.create(name='Synthetic Freshness Employer')
position = Position.objects.create(company=company, title='Synthetic Freshness Intern', slots_available=2)
PositionRequirement.objects.create(position=position, skill_category=programming, required_percentage=50)
tokens = {user.role: str(AccessToken.for_user(user)) for user in (admin, student)}
checks, errors = [], []

class QuietHandler(WSGIRequestHandler):
    def log_message(self, *args):
        pass

server, vite = None, None
pool = ThreadPoolExecutor(max_workers=1)
log = open(OUT / 'vite.txt', 'w')
try:
    with patch('api.recommendation_nlp.preprocess_texts',
               side_effect=lambda texts, model: (['shared synthetic tokens'] * len(texts), model, None)):
        recalculate_combined(student, batch)
        recommendation = Recommendation.objects.get(student=student, position=position)
        server = make_server('127.0.0.1', 8090, get_wsgi_application(), handler_class=QuietHandler)
        Thread(target=server.serve_forever, daemon=True).start()
        vite = subprocess.Popen(['C:/Program Files/nodejs/node.exe', str(ROOT / 'skillbridge-frontend/node_modules/vite/bin/vite.js'),
                                 '--host', '127.0.0.1', '--port', '5190', '--strictPort'],
                                cwd=ROOT / 'skillbridge-frontend', env={**os.environ, 'VITE_API_URL': API},
                                stdout=log, stderr=subprocess.STDOUT, creationflags=subprocess.CREATE_NO_WINDOW)
        for _ in range(100):
            assert vite.poll() is None, 'Vite stopped'
            try:
                urlopen(BASE, timeout=1).close()
                break
            except OSError:
                time.sleep(.2)
        else:
            raise RuntimeError('Vite startup failed')
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(channel='chrome', headless=True)
            context = browser.new_context(viewport={'width': 1280, 'height': 900})
            context.add_init_script('for (const [k,v] of Object.entries(' + json.dumps({
                'sb-token': tokens['student'], 'sb-role': 'student',
                'sb-user': json.dumps({'id': student.pk, 'name': student.name, 'role': 'student', 'is_approved': True}),
            }) + ')) localStorage.setItem(k,v)')
            def restrict(route):
                parsed = urlparse(route.request.url)
                if parsed.hostname not in ('127.0.0.1', 'localhost'):
                    return route.abort()
                if parsed.path.endswith('/events/'):
                    return route.fulfill(status=204)
                return route.continue_()
            context.route('**/*', restrict)
            page = context.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(BASE + '/student/results')
            page.wait_for_load_state('networkidle')
            expect(page.get_by_text(re.compile(r'^92\.50?%$')).first).to_be_visible()
            headers = {'Authorization': 'Bearer ' + tokens['admin']}
            edited = context.request.patch(API + f'/api/admin/positions/{position.pk}/', headers=headers,
                                           data={'requirements': {'Networking': 50}})
            assert edited.status == 200, edited.text()
            # Deliver the actual committed event through the normal cache
            # handler. SSE transport is separately tested; this single-threaded
            # fixture cannot hold a stream while serving other API requests.
            def deliver_latest_event():
                change = pool.submit(lambda: ChangeEvent.objects.filter(recipient=student).latest('id').payload).result(timeout=10)
                assert 'results' in change['topics']
                page.evaluate("""async change => {
                    const {applyDataChange} = await import('/src/hooks/useApi.js');
                    applyDataChange(change);
                }""", change)
            deliver_latest_event()
            expect(page.get_by_role('heading', name='Recommendations need refreshing')).to_be_visible()
            expect(page.get_by_text(re.compile(r'^92\.50?%$'))).to_have_count(0)
            rejected = context.request.post(API + '/api/placements/approve/', headers=headers,
                                             data={'recommendation_id': recommendation.pk})
            assert rejected.status == 409, rejected.text()
            checks.append('Real position edit locks student results and stale placement approval returns409')
            page.set_viewport_size({'width': 375, 'height': 850})
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            page.screenshot(path=str(OUT / 'stale-mobile.png'), full_page=True)
            refreshed = context.request.post(API + '/api/admin/rerun-recommendations/', headers=headers, data={})
            assert refreshed.status == 200 and refreshed.json()['errors'] == 0, refreshed.text()
            deliver_latest_event()
            expect(page.get_by_text(re.compile(r'^32\.50?%$')).first).to_be_visible()
            expect(page.get_by_role('heading', name='Recommendations need refreshing')).to_have_count(0)
            page.screenshot(path=str(OUT / 'refreshed-mobile.png'), full_page=True)
            checks.append('Explicit admin rerun restores current results at32.5; mobile refresh guidance has no overflow')
            malformed = context.request.post(API + '/api/categories/', headers=headers, data={'name': None})
            assert malformed.status == 400, malformed.text()
            checks.append('Real shared-category API returns400 for null name')
            assert not errors, errors
            context.close()
            browser.close()
finally:
    if server:
        server.shutdown()
        server.server_close()
    if vite:
        vite.terminate()
        try:
            vite.wait(timeout=10)
        except subprocess.TimeoutExpired:
            vite.kill()
            vite.wait()
    pool.shutdown(wait=True)
    log.close()
    result = {'checks': checks, 'page_errors': errors, 'storage': 'synthetic in-memory SQLite only',
              'NLP': 'deterministic mock; not an accuracy evaluation',
              'events': 'actual committed payloads delivered to the normal cache handler; stream transport intercepted',
              'servers': 'task-owned servers stopped'}
    (OUT / 'results.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result, indent=2))
