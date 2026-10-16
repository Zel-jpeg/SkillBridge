"""Synthetic local API for freshness checks; no dotenv, SMTP or production DB.

Run with the backend virtualenv Python. Auth metadata is synthetic and written
only to the existing ignored tests/artifacts directory.
"""
import json
import logging
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = ROOT / 'skillbridge-frontend/tests/artifacts/freshness'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
os.environ['PYTHON_DOTENV_DISABLED'] = '1'
os.environ['DJANGO_SETTINGS_MODULE'] = 'core.test_settings'
os.environ['SECRET_KEY'] = 'synthetic-freshness-test-key-not-for-deployment'
sys.path.insert(0, str(ROOT / 'skillbridge-backend'))
from django.conf import settings

settings.DATABASES['default']['NAME'] = str(ARTIFACTS / f'local-{os.getpid()}.sqlite3')
settings.DEBUG = True
settings.SECURE_SSL_REDIRECT = False
settings.ALLOWED_HOSTS = ['127.0.0.1', 'localhost', 'testserver']
settings.CORS_ALLOWED_ORIGINS = ['http://127.0.0.1:5178']
settings.REST_FRAMEWORK['DEFAULT_THROTTLE_CLASSES'] = []
import django
django.setup()
from django.core.management import call_command
from rest_framework_simplejwt.tokens import AccessToken
from api import views
from api.models import Assessment, AnswerChoice, Batch, BatchEnrollment, Company, Position, PositionRequirement, Question, SkillCategory, User
from api.serializers import UserSerializer

call_command('migrate', verbosity=0)
views.send_instructor_email = lambda *args, **kwargs: False
users = {}
for role in ('admin', 'instructor', 'student'):
    users[role] = User.objects.create_user(f'{role}.freshness@dnsc.edu.ph', role=role,
        name=f'Synthetic {role}', is_approved=True, school_id={'student': '2099-99999'}.get(role, ''), course='BSIT')
batch = Batch.objects.create(name='Synthetic live cohort', instructor=users['instructor'])
users['student'].address = {'pinLat': 7.31, 'pinLng': 125.62}
users['student'].save(update_fields=['address'])
BatchEnrollment.objects.create(student=users['student'], batch=batch)
category = SkillCategory.objects.create(name='Synthetic Programming', tags=['Python'], created_by=users['instructor'])
company = Company.objects.create(name='Synthetic Employer', added_by=users['admin'], location_lat=7.3, location_lng=125.6)
position = Position.objects.create(company=company, title='Synthetic Intern', slots_available=5)
PositionRequirement.objects.create(position=position, skill_category=category, required_percentage=70)
assessment = Assessment.objects.create(title='Synthetic assessment', created_by=users['instructor'], batch=batch)
question = Question.objects.create(assessment=assessment, question_text='Choose the synthetic correct answer.', skill_category=category)
choice = AnswerChoice.objects.create(question=question, choice_text='Synthetic correct', is_correct=True)
AnswerChoice.objects.create(question=question, choice_text='Synthetic incorrect')
draft = Assessment.objects.create(title='Synthetic future assessment', created_by=users['instructor'], batch=batch, publication_status='draft', is_required=False)
q2 = Question.objects.create(assessment=draft, question_text='Synthetic draft question', skill_category=category)
AnswerChoice.objects.create(question=q2, choice_text='Draft yes', is_correct=True)
AnswerChoice.objects.create(question=q2, choice_text='Draft no')
auth = {role: {'token': str(AccessToken.for_user(user)), 'user': UserSerializer(user).data} for role, user in users.items()}
auth['ids'] = {'batch': batch.id, 'company': company.id, 'position': position.id,
    'assessment': assessment.id, 'draft': draft.id, 'question': question.id, 'choice': choice.id}
(ARTIFACTS / 'auth.json').write_text(json.dumps(auth), encoding='utf-8')
print('Synthetic freshness server ready (SQLite; not PostgreSQL worker verification)', flush=True)
logging.getLogger('django.server').setLevel(logging.CRITICAL)
call_command('runserver', '127.0.0.1:8018', use_reloader=False, verbosity=0)
