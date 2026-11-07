"""Owned synthetic SQLite API for real-HTTP organization browser workflows."""
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(os.environ['SB_ORGANIZATION_RUN'])
sys.path.insert(0, str(ROOT / 'skillbridge-backend'))
os.environ['DJANGO_SETTINGS_MODULE'] = 'core.test_settings'
os.environ['PYTHON_DOTENV_DISABLED'] = '1'
from django.conf import settings
settings.DATABASES['default']['NAME'] = str(OUT / 'synthetic-browser.sqlite3')
if os.environ.get('SB_ORGANIZATION_SCENARIO') in ('general-text', 'scoped-ranking', 'multi-institute-acceptance', 'coordinator-catalog', 'staff-scope', 'management-dialogs'):
    settings.DATABASES['default'].setdefault('OPTIONS', {})['transaction_mode'] = 'IMMEDIATE'
settings.SECRET_KEY = 'synthetic-organization-browser-key'
settings.ALLOWED_HOSTS = ['127.0.0.1', 'localhost', 'testserver']
settings.SECURE_SSL_REDIRECT = False
settings.CORS_ALLOWED_ORIGINS = [f"http://127.0.0.1:{os.environ['SB_ORGANIZATION_FRONTEND_PORT']}"]
settings.DEBUG = False
settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'] = {'anon': '10000/minute', 'user': '10000/minute', 'login': '10000/minute'}
import django
django.setup()
from django.core.management import call_command
from rest_framework_simplejwt.tokens import AccessToken
from api.models import User, Institute, Program, Batch, BatchEnrollment
if os.environ.get('SB_ORGANIZATION_SCENARIO') in ('coordinator-catalog', 'staff-scope'):
    # The image codec and database transaction stay real; object transport is
    # isolated to this owned fixture directory, with no external storage writes.
    from api import company_images
    image_dir = OUT / 'synthetic-images'
    image_dir.mkdir()
    settings.SUPABASE_STORAGE_URL = f"http://127.0.0.1:{os.environ['SB_ORGANIZATION_API_PORT']}"
    def synthetic_storage(method, key=None, **kwargs):
        if method == 'POST':
            (image_dir / Path(key).name).write_bytes(kwargs['data'])
        elif method == 'DELETE':
            for item in kwargs['json']['prefixes']:
                (image_dir / Path(item).name).unlink(missing_ok=True)
    company_images._storage_request = synthetic_storage
call_command('migrate', verbosity=0)
identities = {}
for role in ['admin', 'instructor', 'student']:
    user = User.objects.create_user(f'organization-{role}@example.invalid', role=role, name=f'Synthetic {role}', is_approved=True)
    identities[role] = {'token': str(AccessToken.for_user(user)), 'user': {'id': user.id, 'role': role, 'name': user.name, 'is_approved': True, 'phone': 'synthetic'}}
owner = User.objects.get(role='instructor')
batch = Batch.objects.create(name='Existing IC mixed batch', instructor=owner)
BatchEnrollment.objects.create(batch=batch, student=User.objects.get(role='student'))
if os.environ.get('SB_ORGANIZATION_SCENARIO') in ('legacy-organization', 'multi-institute-acceptance', 'staff-scope'):
    from django.db import transaction
    from api.legacy_organization import apply_mapping, mapping_plan
    User.objects.filter(role='student').update(course='BSIT', department='Institute of Computing', school_id='2026-00001')
    second = User.objects.create_user('mixed-learner@example.invalid', name='Second synthetic learner', role='student',
        course='BSIS', department='Institute of Computing', school_id='2026-00002', is_approved=True)
    BatchEnrollment.objects.create(batch=batch, student=second)
    with transaction.atomic():
        apply_mapping(mapping_plan())
for number in range(35 if os.environ.get('SB_ORGANIZATION_SCENARIO') == 'management-dialogs' else 9):
    candidate = User.objects.create_user(f'candidate-{number}@example.invalid', role='instructor', name=f'Synthetic Coordinator {number:02}', is_approved=True,
        school_id=f'SYN-C{number:02}' if os.environ.get('SB_ORGANIZATION_SCENARIO') == 'management-dialogs' else '')
    if number == 0:
        identities['other_instructor'] = {'token': str(AccessToken.for_user(candidate)), 'user': {'id': candidate.id, 'role': 'instructor', 'name': candidate.name, 'is_approved': True}}
for index in range(12):
    institute = Institute.objects.create(code=f'SYN{index}', name=f'Synthetic Institute {index:02}', is_active=index != 11)
    if index == 0:
        for number in range(10):
            Program.objects.create(institute=institute, code=f'P{number}', name=f'Synthetic Program {number:02}')
if os.environ.get('SB_ORGANIZATION_SCENARIO') == 'program-batches':
    user = User.objects.create_user('program-learner@dnsc.edu.ph', role='student', name='Synthetic Program Learner')
    identities['program_student'] = {'token': str(AccessToken.for_user(user)),
        'user': {'id': user.id, 'role': user.role, 'name': user.name, 'is_approved': False}}
if os.environ.get('SB_ORGANIZATION_SCENARIO') in ('general-text', 'scoped-ranking', 'multi-institute-acceptance', 'staff-scope'):
    settings.DEBUG = True
    from general_competency_fixture import seed
    scenario = os.environ['SB_ORGANIZATION_SCENARIO']
    acceptance_owner = User.objects.get(email='candidate-0@example.invalid') if scenario in ('multi-institute-acceptance', 'staff-scope') else None
    seed(OUT, identities, owner, scoped_openings=scenario != 'general-text', acceptance_owner=acceptance_owner)
    if scenario == 'staff-scope':
        from api.models import Assessment, Company, InstructorAssignment, OJTPlacement, Position, SkillCategory
        for program in Program.objects.filter(institute__code='IC'):
            InstructorAssignment.objects.create(instructor=owner, program=program)
        legacy = Company.objects.create(name='Synthetic IC legacy partner')
        Position.objects.create(company=legacy, title='Synthetic IC legacy opening', slots_available=4)
        SkillCategory.objects.create(name='Synthetic IC shared skill', description='Review a synthetic skill definition.')
        Assessment.objects.create(title='Synthetic IC mixed assessment', batch=batch, created_by=owner)
        scenarios = json.loads((OUT / 'general-text.json').read_text(encoding='utf-8'))
        shared = Position.objects.get(pk=scenarios[0]['position_id'])
        shared.slots_available = 2
        shared.save(update_fields=['slots_available'])
        shared.eligible_programs.add(scenarios[1]['program_id'])
        for item in scenarios[:2]:
            OJTPlacement.objects.create(student_id=item['student_id'], batch_id=item['batch_id'],
                position=shared, company_id=shared.company_id, status='approved')
if os.environ.get('SB_SCHOOL_DASHBOARD'):
    from django.utils import timezone
    from api.models import StudentResponse
    Assessment.objects.filter(batch=batch).update(publication_status='draft', is_active=False)
    empty_institute = Institute.objects.create(code='EMPTY', name='Synthetic Empty Institute')
    Program.objects.create(institute_id=scenarios[0]['institute_id'], code='EMPTY', name='Empty program')
    item = scenarios[0]
    StudentResponse.objects.create(student_id=item['student_id'], assessment_id=item['assessment_id'], status='stopped', started_at=timezone.now(),
        retake_request_status='pending', retake_requested_at=timezone.now(), retake_explanation='Synthetic interruption for dashboard review.')
if os.environ.get('SB_SHARED_VISIBILITY'):
    from django.utils import timezone
    from api.models import AssessmentAttemptHistory, StudentResponse
    from api.retake_requests import request_snapshot
    for shared_batch in (batch, Batch.objects.create(name='Shared IBPA cohort', institute_id=scenarios[0]['institute_id'], instructor=acceptance_owner)):
        assessment = Assessment.objects.filter(batch=shared_batch).first() or Assessment.objects.create(title='Shared IBPA assessment', batch=shared_batch, created_by=acceptance_owner)
        if shared_batch == batch:
            learners = list(User.objects.filter(enrollments__batch=batch))
            Assessment.objects.create(title='Shared IC archived assessment', batch=batch, created_by=owner, publication_status='draft', is_active=False, archived_at=timezone.now(), archived_by=User.objects.get(role='admin'))
        else:
            learners = []
            for number, item in enumerate(scenarios[:2]):
                learner = User.objects.create_user(email=f'shared-ibpa-{number}@example.invalid', name=f'Shared IBPA learner {number}', role='student', program_id=item['program_id'], is_approved=True)
                BatchEnrollment.objects.create(batch=shared_batch, student=learner)
                learners.append(learner)
        for learner in learners:
            attempt, _ = StudentResponse.objects.get_or_create(student=learner, assessment=assessment, defaults={'status': 'stopped', 'started_at': timezone.now(), 'retake_request_status': 'pending', 'retake_requested_at': timezone.now()})
            AssessmentAttemptHistory.objects.create(response=attempt, attempt_number=1, started_at=attempt.started_at, status='stopped', retake_request=request_snapshot(attempt))
    original_position = Position.objects.get(title='Synthetic IC legacy opening')
    OJTPlacement.objects.create(student=User.objects.filter(enrollments__batch=batch).first(), batch=batch, company=original_position.company, position=original_position, status='approved')
if os.environ.get('SB_PARTNER_MAP'):
    from django.utils import timezone
    Company.objects.filter(pk=shared.company_id).update(location_lat=7.2, location_lng=125.5)
    legacy.location_lat, legacy.location_lng = 7, 125
    legacy.save(update_fields=['location_lat', 'location_lng'])
    for item, title, lat, lng in [(scenarios[1], 'Tourism map partner', 7.2, 125.5), (scenarios[0], 'Enterprise map partner', 7.5, 125.6)]:
        partner = Company.objects.create(name=title, management_program_id=item['program_id'], location_lat=lat, location_lng=lng)
        role = Position.objects.create(company=partner, title=title + ' opening', slots_available=4, eligibility_configured_at=timezone.now())
        role.eligible_programs.add(item['program_id'])
    Company.objects.create(name='Missing pin partner', management_program_id=scenarios[1]['program_id'])
    Company.objects.create(name='Invalid pin partner', management_program_id=scenarios[0]['program_id'], location_lat=100, location_lng=125)
    Company.objects.create(name='Unassigned map partner', location_lat=0, location_lng=0)
    Company.objects.create(name='Archived map partner', management_program_id=scenarios[1]['program_id'], location_lat=7.6, location_lng=125, archived_at=timezone.now())
if os.environ.get('SB_ADMIN_SCOPE_NAVIGATION'):
    from django.utils import timezone
    from api.models import AssessmentAttemptHistory, StudentResponse
    from api.retake_requests import request_snapshot
    for item in scenarios:
        for index in range(10):
            student = User.objects.create_user(email=f"nav-{item['program_id']}-{index}@example.invalid", role='student', name=f'Synthetic retake {index}', is_approved=True)
            BatchEnrollment.objects.create(student=student, batch_id=item['batch_id'])
            response = StudentResponse.objects.create(student=student, assessment_id=item['assessment_id'], status='stopped', started_at=timezone.now(),
                retake_request_status='pending', retake_requested_at=timezone.now(), retake_explanation='Synthetic device interruption for review.')
            AssessmentAttemptHistory.objects.create(response=response, attempt_number=1, started_at=response.started_at, status='stopped', retake_request=request_snapshot(response))
(OUT / 'auth.json').write_text(json.dumps(identities), encoding='utf-8')
print('Synthetic organization API ready', flush=True)
call_command('runserver', f"127.0.0.1:{os.environ['SB_ORGANIZATION_API_PORT']}", use_reloader=False, verbosity=0)
