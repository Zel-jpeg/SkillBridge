"""Local synthetic browser API. Never reads .env or the configured database."""
import json
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'skillbridge-frontend/tests/artifacts/student-assessment-order'
OUT.mkdir(parents=True, exist_ok=True)
os.environ.update(PYTHON_DOTENV_DISABLED='1', DJANGO_SETTINGS_MODULE='core.test_settings',
                  SECRET_KEY='synthetic-assessment-order-browser-only', DEBUG='True')
sys.path.insert(0, str(ROOT / 'skillbridge-backend'))
from django.conf import settings
settings.DATABASES['default']['NAME'] = str(OUT / f'fixture-{os.getpid()}.sqlite3')
settings.SECURE_SSL_REDIRECT = False
settings.ALLOWED_HOSTS = ['127.0.0.1', 'localhost', 'testserver']
settings.CORS_ALLOWED_ORIGINS = ['http://127.0.0.1:5187']
import django
django.setup()
from django.core.management import call_command
from rest_framework_simplejwt.tokens import RefreshToken
from api.models import User, Batch, BatchEnrollment, Assessment, Question, AnswerChoice, SkillCategory
from api.serializers import UserSerializer

call_command('migrate', verbosity=0)
people = {}
for role in ('instructor', 'admin', 'student', 'second_student'):
    people[role] = User.objects.create_user(email=f'order-{role}@example.invalid',
        name=f'Synthetic {role.replace("_", " ")}', role='student' if role == 'second_student' else role,
        is_approved=True, course='BSIT', school_id=f'SYN-{role}', phone='09000000000',
        address={'stayingAt': 'home', 'travelWilling': 'panabo', 'home': {
            'province': 'Davao del Norte', 'city': 'Panabo City', 'barangay': 'New Visayas'},
            'pinLat': 7.3, 'pinLng': 125.6})
batch = Batch.objects.create(name='Synthetic Assessment Batch', instructor=people['instructor'])
for role in ('student', 'second_student'):
    BatchEnrollment.objects.create(student=people[role], batch=batch)
assessments = []
for category_name in ('Programming', 'Web Development', 'Database Management', 'Networking', 'Cybersecurity', 'Technical Support'):
    category = SkillCategory.objects.create(name=category_name)
    assessment = Assessment.objects.create(title=f'{category_name} staff title', batch=batch,
        created_by=people['instructor'], publication_status='draft', duration_minutes=15)
    question = Question.objects.create(assessment=assessment, skill_category=category,
        question_text='What is printed by this Python code?\nvalue = 2 + 3\nprint(value)', question_type='mcq')
    AnswerChoice.objects.create(question=question, choice_text='5', is_correct=True)
    AnswerChoice.objects.create(question=question, choice_text='23')
    assessments.append(assessment.pk)
sessions = {}
for key, person in people.items():
    refresh = RefreshToken.for_user(person)
    sessions[key] = {'token': str(refresh.access_token), 'refresh': str(refresh), 'user': UserSerializer(person).data}
(OUT / 'auth.json').write_text(json.dumps({'sessions': sessions, 'batch': batch.pk, 'assessments': assessments}), encoding='utf-8')
assert not settings.BREVO_API_KEY
call_command('runserver', '127.0.0.1:8187', use_reloader=False, verbosity=0)
