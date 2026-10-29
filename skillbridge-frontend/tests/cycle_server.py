"""Disposable synthetic API for cycle-closeout browser acceptance; no provider calls."""
import json
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'skillbridge-frontend/tests/artifacts/cycle-lifecycle'
OUT.mkdir(parents=True, exist_ok=True)
os.environ.update(PYTHON_DOTENV_DISABLED='1', DJANGO_SETTINGS_MODULE='core.test_settings',
                  SECRET_KEY='synthetic-cycle-browser-never-production-32', DEBUG='True')
sys.path.insert(0, str(ROOT / 'skillbridge-backend'))
from django.conf import settings
settings.DATABASES['default']['NAME'] = str(OUT / f'fixture-{os.getpid()}.sqlite3')
settings.SECURE_SSL_REDIRECT = False
settings.ALLOWED_HOSTS = ['127.0.0.1', 'localhost', 'testserver']
port = int(os.environ['ADMIN_MANAGEMENT_API_PORT'])
frontend = int(os.environ['ADMIN_MANAGEMENT_FRONTEND_PORT'])
settings.CORS_ALLOWED_ORIGINS = [f'http://127.0.0.1:{frontend}']
import django
django.setup()
from django.core.management import call_command
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken
from api.models import (User, Batch, BatchEnrollment, Assessment, Question, AnswerChoice,
    Company, Position, PositionRequirement, OJTPlacement, SkillCategory, SkillScore,
    StudentResponse, CombinedCategoryScore, CombinedCompetencyProfile)
from api.serializers import UserSerializer
from api.recommendation_freshness import input_fingerprint

call_command('migrate', verbosity=0)
admin = User.objects.create_user(email='browser-cycle-admin@dnsc.edu.ph', name='Synthetic Admin', role='admin')
owner = User.objects.create_user(email='browser-cycle-instructor@dnsc.edu.ph', name='Synthetic Instructor', role='instructor', is_approved=True)
student = User.objects.create_user(email='browser-cycle-student@dnsc.edu.ph', name='Synthetic Returning Student',
    school_id='2026-00001', course='BSIT', role='student', is_approved=True, phone='09123456789',
    address={'stayingAt': 'home', 'travelWilling': 'panabo', 'home': {'province': 'Davao del Norte',
             'city': 'Panabo City', 'barangay': 'New Visayas'}, 'pinLat': 7.3, 'pinLng': 125.6})
batch = Batch.objects.create(name='Synthetic Cycle A', instructor=owner)
next_batch = Batch.objects.create(name='Synthetic Cycle B', instructor=owner)
transfer_batch = Batch.objects.create(name='Synthetic Transfer Target', instructor=owner)
BatchEnrollment.objects.create(batch=batch, student=student)
company = Company.objects.create(name='Synthetic Reusable Partner', address={'city': 'Panabo City'})
position = Position.objects.create(company=company, title='Network Support', slots_available=2)
category = SkillCategory.objects.create(name='Networking')
PositionRequirement.objects.create(position=position, skill_category=category, required_percentage=60)
old_exam = Assessment.objects.create(title='Cycle A assessment', created_by=owner, batch=batch)
StudentResponse.objects.create(student=student, assessment=old_exam, status='submitted', submitted_at=timezone.now())
SkillScore.objects.create(student=student, assessment=old_exam, skill_category=category, raw_score=7, max_score=10, percentage=70)
optional = Assessment.objects.create(title='Optional interrupted assessment', created_by=owner, batch=batch, is_required=False)
StudentResponse.objects.create(student=student, assessment=optional, status='stopped', is_flagged=True,
    started_at=timezone.now(), submitted_at=timezone.now())
CombinedCategoryScore.objects.create(student=student, batch=batch, skill_category=category, raw_score=7,
    max_score=10, percentage=70, source_assessment_ids=[old_exam.pk])
CombinedCompetencyProfile.objects.create(student=student, batch=batch, is_finalized=True,
    included_assessment_ids=[old_exam.pk], ranking_input_fingerprint=input_fingerprint(student))
placement = OJTPlacement.objects.create(student=student, company=company, position=position, batch=batch,
    status='approved', match_score_at_assignment=72.5, approved_at=timezone.now(), approved_by=owner, assigned_by=owner)
exam = Assessment.objects.create(title='Cycle B required assessment', batch=next_batch, created_by=owner)
question = Question.objects.create(assessment=exam, skill_category=category, question_text='Synthetic network question')
AnswerChoice.objects.create(question=question, choice_text='Synthetic answer', is_correct=True)

sessions = {}
for person in (admin, owner, student):
    refresh = RefreshToken.for_user(person)
    sessions[person.role] = {'token': str(refresh.access_token), 'refresh': str(refresh), 'user': UserSerializer(person).data}
(OUT / 'auth.json').write_text(json.dumps({'sessions': sessions, 'batch': batch.pk, 'next_batch': next_batch.pk,
    'transfer_batch': transfer_batch.pk,
    'partner': company.pk, 'position': position.pk, 'student': student.pk, 'exam': exam.pk}), encoding='utf-8')
assert not settings.BREVO_API_KEY
call_command('runserver', f'127.0.0.1:{port}', use_reloader=False, verbosity=0)
