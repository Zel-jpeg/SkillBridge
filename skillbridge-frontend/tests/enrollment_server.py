"""Isolated browser-test API. Never imports the normal database configuration as active storage."""
import json
import logging
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = ROOT / 'skillbridge-frontend/tests/artifacts/enrollment'
FRONTEND_PORT = int(os.environ.get('ENROLLMENT_FRONTEND_PORT', '5174'))
API_PORT = int(os.environ.get('ENROLLMENT_API_PORT', '8017'))
if len(sys.argv) >= 3:
    FRONTEND_PORT, API_PORT = map(int, sys.argv[1:3])
ARTIFACTS.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(ROOT / 'skillbridge-backend'))
os.environ['DJANGO_SETTINGS_MODULE'] = 'core.test_settings'
from django.conf import settings

# Unique local database for each invocation; never touches Supabase or db.sqlite3.
settings.DATABASES['default']['NAME'] = str(ARTIFACTS / f'browser-{os.getpid()}.sqlite3')
settings.SECRET_KEY = 'synthetic-browser-test-key-not-for-production'
settings.ALLOWED_HOSTS = ['127.0.0.1', 'localhost', 'testserver']
settings.CORS_ALLOWED_ORIGINS = [
    f'http://127.0.0.1:{FRONTEND_PORT}',
    f'http://localhost:{FRONTEND_PORT}',
]
settings.DEBUG = False
import django
django.setup()
# The server helper captures stdout/stderr. Avoid filling its Windows pipe
# with per-request access logs during the multi-viewport browser suite.
logging.getLogger('django.server').disabled = True
from django.core.management import call_command
from rest_framework_simplejwt.tokens import AccessToken
from api.models import User, Batch, BatchEnrollment
from api import views

call_command('migrate', verbosity=0)
teacher = User.objects.create_user('test.teacher@dnsc.edu.ph', name='Synthetic Instructor', role='instructor', is_approved=True)
admin = User.objects.create_user('test.admin@dnsc.edu.ph', name='Synthetic Admin', role='admin', is_approved=True)
batch = Batch.objects.create(name='TEST ONLY — IAMS Review', instructor=teacher)
existing = User.objects.create_user('existing.synthetic@dnsc.edu.ph', name='Synthetic Existing', role='student', school_id='2099-00006', course='BSIT')
already = User.objects.create_user(
    'already.synthetic@dnsc.edu.ph', name='Synthetic Already', role='student',
    school_id='2099-00007', course='BSIT', is_approved=True,
)
BatchEnrollment.objects.create(batch=batch, student=already)
greeting_student = User.objects.create_user(
    'synthetic-greeting.davidrey@dnsc.edu.ph', name='David Rey Synthetic-greeting', role='student',
    school_id='2099-00999', course='BSIT', is_approved=True,
)
BatchEnrollment.objects.create(batch=batch, student=greeting_student)
# Exercise durable persistence, but never run a worker or contact a provider.
settings.BREVO_API_KEY = ''
(ARTIFACTS / 'auth.json').write_text(json.dumps({
    'instructor': str(AccessToken.for_user(teacher)), 'admin': str(AccessToken.for_user(admin)),
    'student': str(AccessToken.for_user(greeting_student)), 'batch_id': batch.pk,
    'users': {person.role: {'id': person.pk, 'name': person.name, 'role': person.role,
                           'is_approved': person.is_approved} for person in [teacher, admin]},
}))
call_command('runserver', f'127.0.0.1:{API_PORT}', use_reloader=False, verbosity=0)
