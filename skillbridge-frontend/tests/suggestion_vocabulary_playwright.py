"""Real React/Django authoring on a synthetic in-memory DB. No external requests.

Run with Vite5178 using VITE_API_URL=http://127.0.0.1:8018. Owns API8018 only.
"""
from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import sys
from threading import Thread
from wsgiref.simple_server import make_server, WSGIRequestHandler

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'skillbridge-backend'))
os.environ.update(PYTHON_DOTENV_DISABLED='1', SECRET_KEY='synthetic-vocabulary-browser-only',
                  DEBUG='True', DJANGO_SETTINGS_MODULE='core.test_settings')
from django.conf import settings
settings.DATABASES['default']['NAME'] = 'file:vocabulary_browser?mode=memory&cache=shared'
settings.DATABASES['default']['OPTIONS'] = {'uri': True}
settings.ALLOWED_HOSTS = ['localhost', '127.0.0.1', 'testserver']
settings.CORS_ALLOWED_ORIGINS = ['http://127.0.0.1:5178']
settings.SECURE_SSL_REDIRECT = False
import django
django.setup()
from django.core.management import call_command
from django.core.wsgi import get_wsgi_application
from rest_framework_simplejwt.tokens import AccessToken
from api.models import AnswerChoice, Assessment, Batch, BatchEnrollment, Company, Position, PositionRequirement, Question, SkillCategory, User
from playwright.sync_api import sync_playwright, expect

ARTIFACTS = Path(__file__).parent / 'artifacts/suggestion-vocabulary'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
BASE, API = 'http://127.0.0.1:5178', 'http://127.0.0.1:8018'
checks, errors = [], []
call_command('migrate', verbosity=0)
admin = User.objects.create_user('vocabulary-admin@example.com', name='Synthetic Admin', role='admin', is_approved=True)
instructor = User.objects.create_user('vocabulary-instructor@example.com', name='Synthetic Instructor', role='instructor', is_approved=True)
student = User.objects.create_user('vocabulary-student@example.com', name='Synthetic Student', role='student', is_approved=True)
video = SkillCategory.objects.create(name='Video Editing', created_by=admin, tags=['Existing video term'])
SkillCategory.objects.create(name='Graphic Design', created_by=admin, tags=['Existing design term'])
company = Company.objects.create(name='Synthetic Media Company', added_by=admin)
position = Position.objects.create(company=company, title='Original Media Intern', tags=['Original saved tag'])
PositionRequirement.objects.create(position=position, skill_category=video, required_percentage=70)
batch = Batch.objects.create(name='Synthetic Vocabulary Batch', instructor=instructor)
BatchEnrollment.objects.create(batch=batch, student=student)
assessment = Assessment.objects.create(title='Synthetic Vocabulary Assessment', batch=batch, created_by=instructor)
question = Question.objects.create(assessment=assessment, question_text='Original unclassified question', question_type='identification')
AnswerChoice.objects.create(question=question, choice_text='Synthetic answer', is_correct=True)
tokens = {user.role: str(AccessToken.for_user(user)) for user in [admin, instructor, student]}
pool = ThreadPoolExecutor(max_workers=1)
def db(fn):
    return pool.submit(fn).result(timeout=10)

class QuietHandler(WSGIRequestHandler):
    def log_message(self, *args):
        pass

server = make_server('127.0.0.1', 8018, get_wsgi_application(), handler_class=QuietHandler)
thread = Thread(target=server.serve_forever, daemon=True)
thread.start()

def browser_context(browser, user):
    context = browser.new_context(viewport={'width': 1280, 'height': 900})
    values = {'sb-token': tokens[user.role], 'sb-role': user.role,
              'sb-user': json.dumps({'id': user.pk, 'name': user.name, 'role': user.role, 'is_approved': True})}
    context.add_init_script('for (const [k,v] of Object.entries(' + json.dumps(values) + ')) localStorage.setItem(k,v)')
    def restrict(route):
        from urllib.parse import urlparse
        url = urlparse(route.request.url)
        if url.hostname not in ['localhost', '127.0.0.1']:
            return route.abort()
        if url.path.endswith('/events/'):
            return route.fulfill(status=204)
        return route.continue_()
    context.route('**/*', restrict)
    return context

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome', headless=True)
        context = browser_context(browser, admin)
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(BASE + '/admin/skills')
        page.wait_for_load_state('networkidle')
        page.get_by_role('button', name='Add Skill', exact=True).click()
        page.get_by_placeholder('e.g. ReactJS', exact=True).fill('Photo Editing')
        page.get_by_role('button', name='Suggest/Refresh Tags', exact=True).click()
        tags = page.get_by_placeholder('Python, Java, OOP, debugging', exact=True)
        expect(tags).to_have_value(__import__('re').compile('.*retouching.*'))
        assert not db(lambda: SkillCategory.objects.filter(name='Photo Editing').exists())
        tags.fill(tags.input_value() + ', Synthetic custom photo term')
        skill_modal = page.locator('div.fixed.inset-0').filter(has=page.get_by_role('heading', name='Add Skill Category', exact=True)).last
        skill_modal.get_by_role('button', name='Add Skill', exact=True).click()
        expect(page.get_by_role('cell', name='Photo Editing', exact=True)).to_be_visible()
        assert 'Synthetic custom photo term' in db(lambda: SkillCategory.objects.get(name='Photo Editing').tags)
        checks.append('Real category tags are suggested without writes, remain editable and save only on explicit submit')

        page.goto(BASE + '/admin/companies')
        page.wait_for_load_state('networkidle')
        page.get_by_role('button', name='Add position to Synthetic Media Company').click()
        modal = page.locator('div.fixed.inset-0').filter(has=page.get_by_role('heading', name='Add Position', exact=True)).last
        title = modal.get_by_placeholder('e.g. Frontend Developer Intern')
        title.fill('Video & Photo Editor Intern')
        modal.get_by_role('button', name='Suggest/Refresh Tags', exact=True).click()
        position_tags = modal.get_by_placeholder('Django, REST API, authentication, PostgreSQL')
        expect(position_tags).to_have_value(__import__('re').compile('.*timeline editing.*retouching.*'))
        assert db(lambda: Position.objects.count()) == 1
        title.fill('Unmapped Astronomy Intern')
        modal.get_by_role('button', name='Suggest/Refresh Tags', exact=True).click()
        expect(position_tags).to_have_value('')
        title.fill('Video & Photo Editor Intern')
        modal.get_by_role('button', name='Suggest/Refresh Tags', exact=True).click()
        expect(position_tags).to_have_value(__import__('re').compile('.*retouching.*'))
        position_tags.fill(position_tags.input_value() + ', Synthetic custom media term')
        page.screenshot(path=str(ARTIFACTS / 'position-tags-desktop.png'), full_page=True)
        modal.get_by_role('button', name='Add Position', exact=True).click()
        expect(page.get_by_role('heading', name='Add Position', exact=True)).not_to_be_visible()
        saved_id = db(lambda: Position.objects.get(title='Video & Photo Editor Intern').pk)
        reply = context.request.get(API + f'/api/nlp/positions/{saved_id}/text/', headers={'Authorization': 'Bearer ' + tokens['admin']})
        assert reply.status == 200
        text = reply.json()['texts'][0]['text']
        assert 'timeline editing' in text and 'retouching' in text and 'Synthetic custom media term' in text
        assert db(lambda: Position.objects.get(pk=position.pk).tags) == ['Original saved tag']
        page.set_viewport_size({'width': 390, 'height': 844})
        page.screenshot(path=str(ARTIFACTS / 'companies-mobile.png'), full_page=True)
        checks.append('Mixed media role suggests both tag sets; unknown role abstains; explicit saved tags feed the existing description template')
        context.close()

        context = browser_context(browser, instructor)
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(BASE + '/instructor/assessments')
        page.wait_for_load_state('networkidle')
        page.get_by_role('heading', name='Synthetic Vocabulary Assessment', exact=True).click()
        page.get_by_text('Original unclassified question', exact=True).click()
        page.get_by_placeholder('Type the question here...', exact=True).fill('When should layers and masks be used for retouching?')
        suggestion = page.get_by_text('Suggested:', exact=True).locator('..').get_by_role('button', name='Photo Editing', exact=True)
        expect(suggestion).to_be_visible()
        assert db(lambda: Question.objects.get(pk=question.pk).skill_category_id) is None
        suggestion.click()
        page.get_by_role('button', name='Save All Changes', exact=True).click()
        page.get_by_role('button', name='Confirm Save', exact=True).click()
        expect(page.get_by_text('Assessment saved successfully.', exact=True)).to_be_visible()
        assert db(lambda: Question.objects.get(pk=question.pk).skill_category.name) == 'Photo Editing'
        denied = context.request.post(API + '/api/tags/suggest/', data={'type': 'skill', 'name': 'Video Editing'}, headers={'Authorization': 'Bearer ' + tokens['student']})
        assert denied.status == 403
        page.screenshot(path=str(ARTIFACTS / 'question-category.png'), full_page=True)
        checks.append('Instructor receives media category suggestion from real API, explicitly accepts/saves it; student tag endpoint is denied')
        context.close()
        browser.close()
        assert not errors, errors
finally:
    server.shutdown()
    server.server_close()
    pool.shutdown(wait=True)
    result = {'checks': checks, 'page_errors': errors, 'storage': 'synthetic in-memory SQLite only', 'external_requests': 'blocked'}
    (ARTIFACTS / 'results.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result, indent=2))
