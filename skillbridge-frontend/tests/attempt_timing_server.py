"""Disposable synthetic timing fixtures; never loads normal dotenv/database."""
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = ROOT / 'skillbridge-frontend/tests/artifacts/attempt-timing'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
os.environ.update(PYTHON_DOTENV_DISABLED='1', DJANGO_SETTINGS_MODULE='core.test_settings',
                  SECRET_KEY='synthetic-attempt-browser-key-not-for-deployment', DEBUG='True')
sys.path.insert(0, str(ROOT / 'skillbridge-backend'))
from django.conf import settings
settings.DATABASES['default']['NAME'] = str(ARTIFACTS / f'fixture-{os.getpid()}.sqlite3')
settings.SECURE_SSL_REDIRECT = False
settings.ALLOWED_HOSTS = ['127.0.0.1', 'localhost', 'testserver']
settings.CORS_ALLOWED_ORIGINS = ['http://127.0.0.1:5178']
settings.REST_FRAMEWORK['DEFAULT_THROTTLE_CLASSES'] = []
import django
django.setup()
from django.core.management import call_command
from django.utils import timezone
from rest_framework_simplejwt.tokens import AccessToken
from api.models import User, Batch, BatchEnrollment, SkillCategory, Assessment, Question, AnswerChoice, StudentResponse
from api.serializers import UserSerializer
from api import views  # Warm URL imports before browser timings/assertions.

call_command('migrate', verbosity=0)
owner = User.objects.create_user(email='owner.timer@dnsc.edu.ph', name='Synthetic Owner', role='instructor', is_approved=True)
batch = Batch.objects.create(name='Synthetic timing batch', instructor=owner)
category = SkillCategory.objects.create(name='Programming', created_by=owner)
fixtures = {}
for name in ['normal', 'expired']:
    student = User.objects.create_user(email=f'{name}.timer@dnsc.edu.ph', name='Synthetic Student', role='student',
                                      is_approved=True, school_id=f'2099-{name}', course='BSIT')
    BatchEnrollment.objects.create(batch=batch, student=student)
    exam = Assessment.objects.create(title=f'Synthetic {name} exam', batch=batch, created_by=owner, duration_minutes=10)
    question = Question.objects.create(assessment=exam, skill_category=category, question_text='Choose the synthetic correct answer.')
    AnswerChoice.objects.create(question=question, choice_text='Synthetic correct', is_correct=True)
    AnswerChoice.objects.create(question=question, choice_text='Synthetic wrong', is_correct=False)
    if name == 'expired':
        StudentResponse.objects.create(student=student, assessment=exam, started_at=timezone.now() - timezone.timedelta(minutes=12))
    fixtures[name] = {'token': str(AccessToken.for_user(student)), 'user': UserSerializer(student).data, 'exam': exam.id}
(ARTIFACTS / 'auth.json').write_text(json.dumps(fixtures), encoding='utf-8')
print('Synthetic timing browser fixture ready; isolated SQLite, no external actions', flush=True)
if __name__ == '__main__':
    call_command('runserver', '127.0.0.1:8018', use_reloader=False, verbosity=0)
