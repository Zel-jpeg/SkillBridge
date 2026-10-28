"""Synthetic instructor audit API; own SQLite database, no external messages."""
import json
import os
from pathlib import Path
import sys
from unittest.mock import Mock

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'skillbridge-frontend/tests/artifacts/instructor-onboarding'
OUT.mkdir(parents=True, exist_ok=True)
sys.stdout = (OUT / f'server-{os.getpid()}.log').open('w', encoding='utf-8', buffering=1)
sys.stderr = sys.stdout
os.environ.update(PYTHON_DOTENV_DISABLED='1', DJANGO_SETTINGS_MODULE='core.test_settings',
                  SECRET_KEY='synthetic-instructor-onboarding-secret-never-production', DEBUG='True')
sys.path.insert(0, str(ROOT / 'skillbridge-backend'))
from django.conf import settings
settings.DATABASES['default']['NAME'] = str(OUT / f'fixture-{os.getpid()}.sqlite3')
settings.SECURE_SSL_REDIRECT = False
settings.ALLOWED_HOSTS = ['127.0.0.1', 'localhost', 'testserver']
settings.CORS_ALLOWED_ORIGINS = ['http://127.0.0.1:5187']
import django
django.setup()
from django.core.management import call_command
from rest_framework_simplejwt.tokens import AccessToken
from api.models import User, Batch
from api.serializers import UserSerializer
from api import views, email_outbox

call_command('migrate', verbosity=0)
admin = User.objects.create_user('onboarding.admin@dnsc.edu.ph', name='Synthetic Onboarding Admin', role='admin', is_approved=True)
existing = User.objects.create_user('existing.faculty@dnsc.edu.ph', name='Synthetic Existing Faculty', role='instructor', is_approved=True, school_id='EXISTING-001')
User.objects.create_user('pending.faculty@dnsc.edu.ph', name='Synthetic Pending Faculty', role='instructor', is_approved=False, school_id='PENDING-001')
User.objects.create_user('student.onboarding@dnsc.edu.ph', name='Synthetic Student', role='student', school_id='2099-00901')
Batch.objects.create(name='Existing faculty private batch', instructor=existing)


def google_userinfo(token):
    allowed = {f'synthetic-{name}': f'{name}@dnsc.edu.ph' for name in ['faculty.desktop', 'faculty.phone', 'faculty.lost', 'faculty.queuefail']}
    return Mock(status_code=200, json=lambda: dict(email=allowed[token], email_verified=True,
        name='Synthetic Google Instructor', picture='')) if token in allowed else Mock(status_code=401)


views._google_userinfo = google_userinfo
original_enqueue = email_outbox.enqueue


def enqueue(user, *args, **kwargs):
    if user.email == 'faculty.queuefail@dnsc.edu.ph':
        raise RuntimeError('Synthetic notification storage failure')
    return original_enqueue(user, *args, **kwargs)


email_outbox.enqueue = enqueue
assert not settings.BREVO_API_KEY
(OUT / 'auth.json').write_text(json.dumps(dict(admin=dict(token=str(AccessToken.for_user(admin)),
    user=UserSerializer(admin).data), existing_id=existing.pk)), encoding='utf-8')
print('Isolated instructor audit fixture ready; blank Brevo key, no worker.', flush=True)
call_command('runserver', '127.0.0.1:8027', use_reloader=False, verbosity=0)
