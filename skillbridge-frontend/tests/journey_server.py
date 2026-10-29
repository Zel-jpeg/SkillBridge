"""Local-only real API for the enrollment-to-results browser audit."""
import json
import logging
import os
from pathlib import Path
import sys
from unittest.mock import Mock

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'skillbridge-frontend/tests/artifacts/enrollment-assessment-journey'
OUT.mkdir(parents=True, exist_ok=True)
sys.stdout = (OUT / f'server-{os.getpid()}.log').open('w', encoding='utf-8', buffering=1)
sys.stderr = sys.stdout
os.environ.update(PYTHON_DOTENV_DISABLED='1', DJANGO_SETTINGS_MODULE='core.test_settings',
                  SECRET_KEY='synthetic-journey-browser-secret-never-production', DEBUG='True')
sys.path.insert(0, str(ROOT / 'skillbridge-backend'))
from django.conf import settings
settings.DATABASES['default']['NAME'] = str(OUT / f'fixture-{os.getpid()}.sqlite3')
settings.SECURE_SSL_REDIRECT = False
settings.ALLOWED_HOSTS = ['127.0.0.1', 'localhost', 'testserver']
settings.CORS_ALLOWED_ORIGINS = ['http://127.0.0.1:5186']
import django
django.setup()
logging.getLogger('django.server').disabled = True
from django.core.management import call_command
from rest_framework_simplejwt.tokens import AccessToken
from api.test_enrollment_assessment_journey import journey_fixture
from api.serializers import UserSerializer
from api import views

call_command('migrate', verbosity=0)
owner, admin, batch, exams, questions = journey_fixture()


def synthetic_google_userinfo(token):
    # This replacement is confined to this isolated test process.
    emails = {'synthetic-journey-instructor': 'browser-instructor@dnsc.edu.ph',
              'synthetic-journey-admin': 'browser-admin@dnsc.edu.ph'}
    if token not in emails:
        return Mock(status_code=401)
    return Mock(status_code=200, json=lambda: dict(email=emails[token], email_verified=True, hd='dnsc.edu.ph',
                                                  name='Synthetic Provider Name', picture=''))


views._google_userinfo = synthetic_google_userinfo
assert not settings.BREVO_API_KEY
(OUT / 'auth.json').write_text(json.dumps(dict(
    staff={person.role: dict(token=str(AccessToken.for_user(person)), user=UserSerializer(person).data)
           for person in [owner, admin]}, batch=batch.pk,
    exams=[dict(id=exam.pk, title=exam.title) for exam in exams],
    questions=[dict(id=q.pk, exam=q.assessment_id, title=q.question_text, kind=q.question_type,
                    correct=q.choices.get(is_correct=True).pk,
                    wrong=q.choices.get(is_correct=False).pk if q.question_type != 'identification' else None,
                    intentionally_wrong=q.pk == questions[1].pk) for q in questions],
)), encoding='utf-8')
print('Synthetic journey API ready: isolated SQLite, blank Brevo key, no worker', flush=True)
call_command('runserver', '127.0.0.1:8026', use_reloader=False, verbosity=0)
