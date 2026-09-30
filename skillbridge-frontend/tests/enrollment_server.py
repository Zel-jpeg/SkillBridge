"""Isolated browser-test API. Never imports the normal database configuration as active storage."""
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = ROOT / 'skillbridge-frontend/tests/artifacts/enrollment'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(ROOT / 'skillbridge-backend'))
os.environ['DJANGO_SETTINGS_MODULE'] = 'core.test_settings'
from django.conf import settings

# Unique local database for each invocation; never touches Supabase or db.sqlite3.
settings.DATABASES['default']['NAME'] = str(ARTIFACTS / f'browser-{os.getpid()}.sqlite3')
settings.SECRET_KEY = 'synthetic-browser-test-key-not-for-production'
settings.ALLOWED_HOSTS = ['127.0.0.1', 'localhost', 'testserver']
settings.CORS_ALLOWED_ORIGINS = ['http://127.0.0.1:5174', 'http://localhost:5174']
settings.DEBUG = False
import django
django.setup()
from django.core.management import call_command
from rest_framework_simplejwt.tokens import AccessToken
from api.models import User, Batch, BatchEnrollment
from api import views

call_command('migrate', verbosity=0)
teacher = User.objects.create_user('test.teacher@dnsc.edu.ph', name='Synthetic Instructor', role='instructor', is_approved=True)
admin = User.objects.create_user('test.admin@dnsc.edu.ph', name='Synthetic Admin', role='admin', is_approved=True)
batch = Batch.objects.create(name='TEST ONLY — IAMS Review', instructor=teacher)
existing = User.objects.create_user('existing.synthetic@dnsc.edu.ph', name='Synthetic Existing', role='student', school_id='2099-00006', course='BSIT')
already = User.objects.create_user('already.synthetic@dnsc.edu.ph', name='Synthetic Already', role='student', school_id='2099-00007', course='BSIT')
BatchEnrollment.objects.create(batch=batch, student=already)
# All notification delivery is mocked, including the real browser workflow.
views.send_instructor_email = lambda *args, **kwargs: True
(ARTIFACTS / 'auth.json').write_text(json.dumps({
    'instructor': str(AccessToken.for_user(teacher)), 'admin': str(AccessToken.for_user(admin)), 'batch_id': batch.pk,
}))
call_command('runserver', '127.0.0.1:8017', use_reloader=False, verbosity=0)
