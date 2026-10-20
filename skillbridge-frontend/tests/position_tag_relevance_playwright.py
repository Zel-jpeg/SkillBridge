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
settings.DATABASES['default']['NAME'] = 'file:position_tag_browser?mode=memory&cache=shared'
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

ARTIFACTS = Path(__file__).parent / 'artifacts/position-tag-relevance'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
BASE, API = 'http://127.0.0.1:5178', 'http://127.0.0.1:8018'
checks, errors = [], []
call_command('migrate', verbosity=0)
admin = User.objects.create_user('vocabulary-admin@example.com', name='Synthetic Admin', role='admin', is_approved=True)
instructor = User.objects.create_user('vocabulary-instructor@example.com', name='Synthetic Instructor', role='instructor', is_approved=True)
student = User.objects.create_user('vocabulary-student@example.com', name='Synthetic Student', role='student', is_approved=True)
video = SkillCategory.objects.create(name='Networking', created_by=admin, tags=[])
tools = SkillCategory.objects.create(name='Tools', created_by=admin, tags=['VS Code', 'Postman', 'Figma', 'Jira'])
SkillCategory.objects.create(name='Graphic Design', created_by=admin, tags=['Existing design term'])
company = Company.objects.create(name='Synthetic Network Company', added_by=admin)
position = Position.objects.create(company=company, title='IT Network Specialist Intern', tags=['Original saved tag'])
PositionRequirement.objects.create(position=position, skill_category=video, required_percentage=75)
PositionRequirement.objects.create(position=position, skill_category=tools, required_percentage=75)
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
        page.goto(BASE + '/admin/companies')
        page.wait_for_load_state('networkidle')
        page.get_by_role('button', name='Add position to Synthetic Network Company').click()
        modal = page.locator('div.fixed.inset-0').filter(has=page.get_by_role('heading', name='Add Position', exact=True)).last
        title = modal.get_by_placeholder('e.g. Frontend Developer Intern')
        title.fill('IT Network Specialist Intern')
        for category in ['Networking', 'Tools']:
            group = modal.locator('div').filter(has=page.locator('span', has_text=__import__('re').compile('^'+category+'$')))
            # Smallest requirement row contains its category and level buttons.
            row = modal.locator('div').filter(has=page.get_by_text(category, exact=True)).filter(has=page.get_by_role('button', name='Proficient 75%', exact=True)).last
            row.get_by_role('button', name='Proficient 75%', exact=True).click()
        with page.expect_response(lambda r: '/api/tags/suggest/' in r.url and r.request.method == 'POST') as requested:
            modal.get_by_role('button', name='Suggest/Refresh Tags', exact=True).click()
        response=requested.value
        assert response.status == 200
        payload=response.request.post_data_json
        assert payload['requirements']=={'Networking':75,'Tools':75},payload
        tags=modal.get_by_placeholder('Django, REST API, authentication, PostgreSQL')
        expect(tags).to_have_value(__import__('re').compile('.*network monitoring.*'))
        for term in ['Postman','Figma','VS Code','Jira','React']:
            assert term not in tags.input_value()
        assert db(lambda: Position.objects.get(pk=position.pk).tags)==['Original saved tag']
        checks.append('Exact admin screenshot payload Networking75 + Tools75 returns networking tags without Postman/Figma; suggestion does not save')
        title.fill('Unmapped Intern')
        modal.get_by_role('button', name='Suggest/Refresh Tags', exact=True).click()
        expect(tags).to_have_value('TCP/IP, routing, switching, subnetting')
        checks.append('Unmapped position fallback skips generic Tools products')
        title.fill('IT Network Specialist Intern')
        modal.get_by_role('button', name='Suggest/Refresh Tags', exact=True).click()
        expect(tags).to_have_value(__import__('re').compile('.*network monitoring.*'))
        tags.fill(tags.input_value()+', Synthetic approved custom tool')
        page.screenshot(path=str(ARTIFACTS/'network-suggestions-desktop.png'),full_page=True)
        modal.get_by_role('button', name='Add Position', exact=True).click()
        expect(page.get_by_role('heading',name='Add Position',exact=True)).not_to_be_visible()
        saved_id=db(lambda:Position.objects.exclude(pk=position.pk).get().pk)
        assert 'Synthetic approved custom tool' in db(lambda:Position.objects.get(pk=saved_id).tags)
        reply=context.request.get(API+f'/api/nlp/positions/{saved_id}/text/',headers={'Authorization':'Bearer '+tokens['admin']})
        assert reply.status==200
        description=reply.json()['texts'][0]['text']
        role_text=description.split('Role-specific vocabulary: ')[1].split('. Requirement evidence:')[0]
        assert 'Synthetic approved custom tool' in role_text and 'Figma' not in role_text
        checks.append('Explicit custom tag save still works and original description uses selected role vocabulary')
        context.close()
        context=browser_context(browser,instructor)
        page=context.new_page()
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto(BASE+'/instructor/companies')
        page.wait_for_load_state('networkidle')
        page.get_by_text('Synthetic Network Company',exact=True).first.click()
        page.get_by_role('button',name='Edit',exact=True).click()
        page.locator('details.company-edit-positions summary').click()
        tags=page.locator(f'#position-{position.pk}-tags')
        page.locator('.company-position-card').filter(has=tags).get_by_role('button',name='Suggest Tags',exact=True).click()
        expect(tags).to_have_value(__import__('re').compile('.*network monitoring.*'))
        assert 'Postman' not in tags.input_value() and 'Figma' not in tags.input_value()
        assert db(lambda:Position.objects.get(pk=position.pk).tags)==['Original saved tag']
        page.set_viewport_size({'width':390,'height':844})
        page.screenshot(path=str(ARTIFACTS/'network-instructor-mobile.png'),full_page=True)
        checks.append('Existing instructor editor uses same corrected backend suggestions and preserves saved tags before submit')
        context.close()
        browser.close()
        assert not errors,errors
finally:
    server.shutdown();server.server_close();pool.shutdown(wait=True)
    result={'checks':checks,'page_errors':errors,'storage':'synthetic in-memory SQLite only','external_requests':'blocked'}
    (ARTIFACTS/'results.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps(result,indent=2))
