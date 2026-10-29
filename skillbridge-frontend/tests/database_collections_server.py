"""Disposable local API for collection browser checks; all records synthetic."""
import json
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'skillbridge-frontend/tests/artifacts/database-collections'
OUT.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(ROOT / 'skillbridge-backend'))
os.environ['PYTHON_DOTENV_DISABLED'] = '1'
os.environ['DJANGO_SETTINGS_MODULE'] = 'core.test_settings'
from django.conf import settings
settings.DATABASES['default']['NAME'] = str(OUT / f'browser-{os.getpid()}.sqlite3')
settings.SECRET_KEY = 'synthetic-database-browser-key-not-for-production'
settings.ALLOWED_HOSTS = ['127.0.0.1', 'localhost', 'testserver']
settings.CORS_ALLOWED_ORIGINS = [os.environ.get('UI_TEST_BASE', 'http://127.0.0.1:5187')]
settings.SECURE_SSL_REDIRECT = False
settings.DEBUG = False
settings.REST_FRAMEWORK = {**settings.REST_FRAMEWORK, 'DEFAULT_THROTTLE_RATES':
    {**settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'], 'user': '10000/minute'}}
import django
django.setup()
from django.core.management import call_command
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken
from api.test_database_collections import DatabaseCollectionTests

call_command('migrate', verbosity=0)
fixture = DatabaseCollectionTests()
fixture.client = APIClient()
fixture.setUp()

def identity(user):
    return {'token': str(AccessToken.for_user(user)), 'user': {'id': user.id,
        'name': user.name, 'role': user.role, 'is_approved': user.is_approved, 'phone': 'synthetic'}}

(OUT / 'auth.json').write_text(json.dumps({'admin': identity(fixture.admin),
    'owner': identity(fixture.owner), 'other': identity(fixture.other),
    'batch_id': fixture.batch.id, 'student_id': fixture.students[0].id}), encoding='utf-8')
print('Disposable synthetic collection API ready.', flush=True)
call_command('runserver', '127.0.0.1:' + os.environ.get('DB_COLLECTION_API_PORT', '8027'), use_reloader=False, verbosity=0)
