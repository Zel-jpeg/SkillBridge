"""Owned synthetic SQLite API for real-HTTP organization browser workflows."""
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(os.environ['SB_ORGANIZATION_RUN'])
sys.path.insert(0, str(ROOT / 'skillbridge-backend'))
os.environ['DJANGO_SETTINGS_MODULE'] = 'core.test_settings'
os.environ['PYTHON_DOTENV_DISABLED'] = '1'
from django.conf import settings
settings.DATABASES['default']['NAME'] = str(OUT / 'synthetic-browser.sqlite3')
settings.SECRET_KEY = 'synthetic-organization-browser-key'
settings.ALLOWED_HOSTS = ['127.0.0.1', 'localhost', 'testserver']
settings.SECURE_SSL_REDIRECT = False
settings.CORS_ALLOWED_ORIGINS = [f"http://127.0.0.1:{os.environ['SB_ORGANIZATION_FRONTEND_PORT']}"]
settings.DEBUG = False
settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'] = {'anon': '10000/minute', 'user': '10000/minute', 'login': '10000/minute'}
import django
django.setup()
from django.core.management import call_command
from rest_framework_simplejwt.tokens import AccessToken
from api.models import User, Institute, Program, Batch, BatchEnrollment
call_command('migrate', verbosity=0)
identities = {}
for role in ['admin', 'instructor', 'student']:
    user = User.objects.create_user(f'organization-{role}@example.invalid', role=role, name=f'Synthetic {role}', is_approved=True)
    identities[role] = {'token': str(AccessToken.for_user(user)), 'user': {'id': user.id, 'role': role, 'name': user.name, 'is_approved': True, 'phone': 'synthetic'}}
owner = User.objects.get(role='instructor')
batch = Batch.objects.create(name='Existing IC mixed batch', instructor=owner)
BatchEnrollment.objects.create(batch=batch, student=User.objects.get(role='student'))
for number in range(9):
    candidate = User.objects.create_user(f'candidate-{number}@example.invalid', role='instructor', name=f'Synthetic Coordinator {number:02}', is_approved=True)
    if number == 0:
        identities['other_instructor'] = {'token': str(AccessToken.for_user(candidate)), 'user': {'id': candidate.id, 'role': 'instructor', 'name': candidate.name, 'is_approved': True}}
for index in range(12):
    institute = Institute.objects.create(code=f'SYN{index}', name=f'Synthetic Institute {index:02}', is_active=index != 11)
    if index == 0:
        for number in range(10):
            Program.objects.create(institute=institute, code=f'P{number}', name=f'Synthetic Program {number:02}')
(OUT / 'auth.json').write_text(json.dumps(identities), encoding='utf-8')
print('Synthetic organization API ready', flush=True)
call_command('runserver', f"127.0.0.1:{os.environ['SB_ORGANIZATION_API_PORT']}", use_reloader=False, verbosity=0)
