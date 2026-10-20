"""Disposable real API for analytics browser checks. Never uses normal DB settings."""
import json
import os
import sys
from datetime import timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = ROOT / 'skillbridge-frontend/tests/artifacts/analytics'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(ROOT / 'skillbridge-backend'))
os.environ['PYTHON_DOTENV_DISABLED'] = '1'
os.environ['SECRET_KEY'] = 'synthetic-analytics-browser-key-not-for-production'
os.environ['DEBUG'] = 'True'
os.environ['DJANGO_SETTINGS_MODULE'] = 'core.test_settings'
from django.conf import settings
settings.DATABASES['default']['NAME'] = str(ARTIFACTS / f'analytics-{os.getpid()}.sqlite3')
settings.ALLOWED_HOSTS = ['127.0.0.1', 'localhost', 'testserver']
settings.CORS_ALLOWED_ORIGINS = [f"http://127.0.0.1:{os.environ['ADMIN_MANAGEMENT_FRONTEND_PORT']}"]
import django
django.setup()
from django.core.management import call_command
from django.utils import timezone
from rest_framework_simplejwt.tokens import AccessToken
from api.models import (User, Batch, BatchEnrollment, Assessment, SkillCategory, StudentResponse,
    SkillScore, CombinedCategoryScore, CombinedCompetencyProfile, Company, Position, PositionRequirement,
    Recommendation, OJTPlacement, AssessmentAttemptHistory)
from api.recommendation_freshness import input_fingerprint

call_command('migrate', verbosity=0)
admin = User.objects.create_user('analytics.admin@example.invalid', name='Synthetic Admin', role='admin', is_approved=True)
owner = User.objects.create_user('analytics.owner@example.invalid', name='Synthetic Owner', role='instructor', is_approved=True)
other = User.objects.create_user('analytics.other@example.invalid', name='Other Owner', role='instructor', is_approved=True)
User.objects.create_user('analytics.pending@example.invalid', name='Pending Instructor', role='instructor', is_approved=False)
batch = Batch.objects.create(name='Synthetic current cohort', instructor=owner)
archive = Batch.objects.create(name='Synthetic archived cohort', instructor=owner, status='archived')
foreign = Batch.objects.create(name='Foreign current cohort', instructor=other)
company = Company.objects.create(name='Synthetic Agency', address={'city': 'Davao City'})
position = Position.objects.create(company=company, title='Developer Intern', slots_available=20)
second = Position.objects.create(company=company, title='Network Intern', slots_available=5)
categories = [SkillCategory.objects.create(name=name) for name in ['Database', 'Networking', 'Programming', 'Web']]
for category in categories:
    PositionRequirement.objects.create(position=position, skill_category=category, required_percentage=60)
required = Assessment.objects.create(title='Required foundations', batch=batch, created_by=owner,
    publication_status='published', due_at=timezone.now() - timedelta(days=1))
optional = Assessment.objects.create(title='Optional practice', batch=batch, created_by=owner,
    publication_status='published', is_required=False)
Assessment.objects.create(title='Historical assessment', batch=archive, created_by=owner, publication_status='closed')
Assessment.objects.create(title='Foreign assessment', batch=foreign, created_by=other)
students = []
for index in range(1, 16):
    student = User.objects.create_user(f'analytics.student{index}@example.invalid', name=f'Synthetic Student {index:02d}',
        role='student', is_approved=True, school_id=f'SYN-{index:03d}', course='BSIT' if index % 2 else 'BSIS', address={'city': 'Tagum City'})
    students.append(student)
    current_batch = batch if index <= 13 else foreign
    BatchEnrollment.objects.create(batch=current_batch, student=student)
    if index > 13:
        OJTPlacement.objects.create(student=student, batch=foreign, company=company, position=position, status='approved', approved_at=timezone.now())
        continue
    if index <= 9:
        submitted = timezone.now() - timedelta(days=index)
        response = StudentResponse.objects.create(student=student, assessment=required,
            status='submitted', started_at=submitted - timedelta(minutes=20), submitted_at=submitted)
        for offset, category in enumerate(categories):
            percentage = 0 if index == 9 else max(0, 100 - 5 * index - offset * 10)
            SkillScore.objects.create(student=student, assessment=required, skill_category=category, raw_score=percentage, max_score=100, percentage=percentage)
            CombinedCategoryScore.objects.create(student=student, batch=batch, skill_category=category, raw_score=percentage, max_score=100, percentage=percentage, source_assessment_ids=[required.id])
        CombinedCompetencyProfile.objects.create(student=student, batch=batch, is_finalized=True,
            included_assessment_ids=[required.id], ranking_input_fingerprint='stale' if index == 8 else input_fingerprint(student), finalized_at=submitted)
        if index != 7:
            Recommendation.objects.create(student=student, batch=batch, position=position, match_score=90 - index * 3)
            Recommendation.objects.create(student=student, batch=batch, position=second, match_score=60 - index)
        if index == 1:
            AssessmentAttemptHistory.objects.create(response=response, attempt_number=1, status='submitted', submitted_at=submitted - timedelta(days=2), answers=[], category_scores=[])
        if index <= 3:
            OJTPlacement.objects.create(student=student, batch=batch, company=company, position=position, status='approved', approved_at=submitted)
    if index == 10:
        StudentResponse.objects.create(student=student, assessment=required, status='stopped', is_flagged=True)
    if index == 11:
        StudentResponse.objects.create(student=student, assessment=required, status='in_progress', started_at=timezone.now())
BatchEnrollment.objects.create(batch=archive, student=students[0])

def identity(user):
    return {'token': str(AccessToken.for_user(user)), 'user': {'id': user.id, 'role': user.role,
        'name': user.name, 'is_approved': user.is_approved}}

(ARTIFACTS / 'auth.json').write_text(json.dumps({'admin': identity(admin), 'instructor': identity(owner),
    'batch_id': batch.id, 'archive_id': archive.id, 'foreign_id': foreign.id, 'owner_id': owner.id,
    'student_id': students[0].id, 'category_id': categories[0].id}), encoding='utf-8')
print('Disposable analytics API ready.', flush=True)
call_command('runserver', f"127.0.0.1:{os.environ['ADMIN_MANAGEMENT_API_PORT']}", use_reloader=False, verbosity=0)
