"""Disposable SQLite browser fixture. Storage/Google are in-memory mocks only."""
from io import BytesIO
import json
import logging
import os
from pathlib import Path
import sys
from types import ModuleType
from unittest.mock import Mock

ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = ROOT / 'skillbridge-frontend/tests/artifacts/profile-images'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
os.environ['PYTHON_DOTENV_DISABLED'] = '1'
os.environ['DJANGO_SETTINGS_MODULE'] = 'core.test_settings'
os.environ['SECRET_KEY'] = 'synthetic-profile-images-not-for-deployment'
os.environ['DEBUG'] = 'True'
sys.path.insert(0, str(ROOT / 'skillbridge-backend'))
from django.conf import settings
settings.DATABASES['default']['NAME'] = str(ARTIFACTS / f'local-{os.getpid()}.sqlite3')
settings.DEBUG = True
settings.SECURE_SSL_REDIRECT = False
settings.ALLOWED_HOSTS = ['127.0.0.1', 'localhost', 'testserver']
settings.CORS_ALLOWED_ORIGINS = ['http://127.0.0.1:5179']
settings.REST_FRAMEWORK['DEFAULT_THROTTLE_CLASSES'] = []
settings.SUPABASE_STORAGE_URL = 'https://synthetic.supabase.co'
settings.SUPABASE_STORAGE_SERVICE_KEY = 'synthetic-only'
import django
django.setup()
from django.core.management import call_command
from django.http import HttpResponse, JsonResponse
from django.urls import path
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from PIL import Image
from rest_framework_simplejwt.tokens import AccessToken
from api import company_images, views
from api.models import (Assessment, Batch, BatchEnrollment, CombinedCategoryScore,
    CombinedCompetencyProfile, Company, Position, PositionRequirement, Question,
    SkillCategory, SkillScore, StudentResponse, User)
from api.serializers import UserSerializer
import core.urls
import requests

call_command('migrate', verbosity=0)
users = {}
for role in ('admin', 'instructor', 'student'):
    users[role] = User.objects.create_user(f'{role}.images@dnsc.edu.ph', name=f'Synthetic {role}', role=role,
        is_approved=True, school_id='2099-00001' if role == 'student' else '', course='BSIT',
        photo_url='https://synthetic.invalid/google/old.png' if role == 'student' else '')
student, teacher = users['student'], users['instructor']
student.phone = '09123456789'
student.address = {'home': {'province': 'Synthetic Province', 'city': 'Synthetic City', 'barangay': 'Synthetic Barangay'}, 'stayingAt': 'home', 'travelWilling': 'panabo'}
student.save()
batch = Batch.objects.create(name='Synthetic image cohort', instructor=teacher)
BatchEnrollment.objects.create(student=student, batch=batch)
category = SkillCategory.objects.create(name='Synthetic Programming', created_by=teacher)
assessment = Assessment.objects.create(title='Synthetic completed assessment', created_by=teacher, batch=batch)
Question.objects.create(assessment=assessment, question_text='Synthetic question', skill_category=category,
    question_type='identification')
StudentResponse.objects.create(student=student, assessment=assessment, status='submitted', started_at=timezone.now(), submitted_at=timezone.now())
SkillScore.objects.create(student=student, assessment=assessment, skill_category=category, raw_score=1, max_score=1, percentage=100)
company = Company.objects.create(name='Synthetic Employer', address={'province': 'Synthetic Province', 'city': 'Synthetic City'}, added_by=users['admin'])
position = Position.objects.create(company=company, title='Synthetic Intern', slots_available=5)
PositionRequirement.objects.create(position=position, skill_category=category, required_percentage=70)
from api.combined_competency import recalculate_combined
recalculate_combined(student, batch)

objects, fail = {}, [False]
def storage(method, url, **kwargs):
    if fail[0]:
        raise requests.Timeout('synthetic storage outage')
    if method == 'POST':
        key = url.split('/company-branding/')[1]
        assert company_images.owned_key(key)
        with Image.open(BytesIO(kwargs['data'])) as image:
            assert image.format == 'WEBP'
        objects[key] = kwargs['data']
    elif method == 'DELETE':
        for key in kwargs['json']['prefixes']:
            objects.pop(key, None)
    return Mock(status_code=200)
company_images.requests.request = storage

def google(url, **kwargs):
    token = kwargs.get('headers', {}).get('Authorization', '')
    body = {'email': student.email, 'name': student.name, 'email_verified': True}
    if token != 'Bearer photo-none':
        body['picture'] = 'https://synthetic.invalid/google/new.png'
    return Mock(status_code=200, json=lambda: body)
views.http_requests.get = google
views.send_instructor_email = lambda *args, **kwargs: False

@csrf_exempt
def controls(request):
    fail[0] = json.loads(request.body).get('fail', False)
    return JsonResponse({'ok': True})

def branding(request, key):
    return HttpResponse(objects.get(key, b''), content_type='image/webp', status=200 if key in objects else 404)

photo = BytesIO()
Image.new('RGB', (80, 80), 'navy').save(photo, format='PNG')
def provider_photo(request, version):
    return HttpResponse(photo.getvalue() if version == 'new' else b'', content_type='image/png', status=200 if version == 'new' else 404)

fixture_urls = ModuleType('profile_image_fixture_urls')
fixture_urls.urlpatterns = core.urls.urlpatterns + [
    path('__fixture__/controls/', controls),
    path('__fixture__/branding/<path:key>', branding),
    path('__fixture__/google/<str:version>.png', provider_photo),
]
sys.modules[fixture_urls.__name__] = fixture_urls
settings.ROOT_URLCONF = fixture_urls.__name__
auth = {role: {'token': str(AccessToken.for_user(user)), 'user': UserSerializer(user).data} for role, user in users.items()}
auth['ids'] = {'company': company.id, 'position': position.id, 'student': student.id, 'batch': batch.id}
(ARTIFACTS / 'auth.json').write_text(json.dumps(auth), encoding='utf-8')
for fmt in ('PNG', 'JPEG', 'WEBP'):
    Image.new('RGB', (1200, 600), 'teal').save(ARTIFACTS / f'company.{fmt.lower()}', format=fmt)
print('Synthetic image fixture ready: SQLite + mocked Storage/Google only.', flush=True)
logging.getLogger('django.server').setLevel(logging.CRITICAL)
if __name__ != '__fixture_import__':
    call_command('runserver', '127.0.0.1:8019', use_reloader=False, verbosity=1)
