"""Disposable real API for admin-management browser tests, with synthetic users."""
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FRONTEND_PORT = int(os.environ.get('ADMIN_MANAGEMENT_FRONTEND_PORT', '5183'))
API_PORT = int(os.environ.get('ADMIN_MANAGEMENT_API_PORT', '8023'))
ARTIFACTS = ROOT / 'skillbridge-frontend/tests/artifacts/admin-management'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(ROOT / 'skillbridge-backend'))
os.environ['DJANGO_SETTINGS_MODULE'] = 'core.test_settings'
from django.conf import settings
settings.DATABASES['default']['NAME'] = str(ARTIFACTS / f'browser-{os.getpid()}.sqlite3')
settings.SECRET_KEY = 'synthetic-admin-management-test-key-not-for-production'
settings.ALLOWED_HOSTS = ['127.0.0.1', 'localhost', 'testserver']
settings.CORS_ALLOWED_ORIGINS = [f'http://127.0.0.1:{FRONTEND_PORT}', f'http://localhost:{FRONTEND_PORT}']
settings.DEBUG = False
import django
django.setup()
from django.core.management import call_command
from django.utils import timezone
from rest_framework_simplejwt.tokens import AccessToken
from api import views
from api.models import User, Batch, BatchEnrollment, Assessment, Question, AnswerChoice, SkillCategory, StudentResponse, SkillScore

call_command('migrate', verbosity=0)
admin = User.objects.create_user('management.admin@dnsc.edu.ph', name='Synthetic Admin', role='admin', is_approved=True)
owner = User.objects.create_user('management.owner@dnsc.edu.ph', name='Synthetic Owner', role='instructor', is_approved=True)
other = User.objects.create_user('management.other@dnsc.edu.ph', name='Synthetic Other', role='instructor', is_approved=True)
student = User.objects.create_user('management.student@dnsc.edu.ph', name='Synthetic Student', role='student', is_approved=True,
    school_id='2099-90001', course='BSIT', phone='09123456789', address={'lat': 7.4, 'lng': 125.8})
batch = Batch.objects.create(name='Main synthetic cohort', instructor=owner)
second = Batch.objects.create(name='Historical membership', instructor=other, status='archived')
BatchEnrollment.objects.create(batch=batch, student=student)
BatchEnrollment.objects.create(batch=second, student=student)
for index in range(23):
    Batch.objects.create(name=f'Collection cohort {index:02d}', instructor=owner if index % 2 else other)
category = SkillCategory.objects.create(name='Synthetic Programming')
draft = Assessment.objects.create(title='Editable synthetic draft', batch=batch, created_by=owner, publication_status='draft')
locked = Assessment.objects.create(title='Attempted synthetic assessment', batch=batch, created_by=owner)
unassigned = Assessment.objects.create(title='Unassigned synthetic draft', created_by=owner, publication_status='draft')
for assessment in [draft, locked, unassigned]:
    question = Question.objects.create(assessment=assessment, question_text='Which option is correct?', skill_category=category)
    AnswerChoice.objects.create(question=question, choice_text='Synthetic correct', is_correct=True)
    AnswerChoice.objects.create(question=question, choice_text='Synthetic wrong', is_correct=False)
StudentResponse.objects.create(student=student, assessment=locked, status='submitted', submitted_at=timezone.now())
SkillScore.objects.create(student=student, assessment=locked, skill_category=category, raw_score=1, max_score=1, percentage=100)
from api.combined_competency import recalculate_combined
recalculate_combined(student, batch)
views.send_instructor_email = lambda *args, **kwargs: True

def identity(user):
    return {'token': str(AccessToken.for_user(user)), 'user': {'id': user.id, 'name': user.name, 'role': user.role,
        'is_approved': user.is_approved, 'phone': user.phone, 'course': user.course}}

(ARTIFACTS / 'auth.json').write_text(json.dumps({'admin': identity(admin), 'owner': identity(owner),
    'other': identity(other), 'student': identity(student), 'batch_id': batch.pk, 'other_id': other.pk,
    'owner_id': owner.pk, 'student_id': student.pk, 'second_batch_id': second.pk,
    'draft_id': draft.pk, 'locked_id': locked.pk, 'unassigned_id': unassigned.pk}), encoding='utf-8')
print('Synthetic admin-management API ready.', flush=True)
call_command('runserver', f'127.0.0.1:{API_PORT}', use_reloader=False, verbosity=0)
