"""Rehearse the configured migration operator on an owned synthetic source DB."""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
from threading import Event, Thread

import psycopg2

ROOT = Path(__file__).resolve().parents[2]
BIN = ROOT / 'work/defense_audit/postgres-runtime/pgsql/bin'
OUT = Path(tempfile.mkdtemp(prefix='program-migration-operator-', dir=ROOT / 'work'))
DATA = OUT / 'source-cluster'
PYTHON = ROOT / 'skillbridge-backend/venv/Scripts/python.exe'
RECONCILE = '--reconcile-ic' in sys.argv
MIGRATION = sys.argv[1] if len(sys.argv) > 1 and not RECONCILE else '0037_assessment_framework'
PREVIOUS = {'0034_program_batch_context': '0033_instructor_program_assignment',
            '0035_neutral_user_department': '0034_program_batch_context',
            '0036_program_competency_frameworks': '0035_neutral_user_department',
            '0037_assessment_framework': '0036_program_competency_frameworks',
            '0038_position_program_eligibility': '0037_assessment_framework',
            '0039_coordinator_catalog_authority': '0038_position_program_eligibility',
            '0042_position_descriptions': '0041_organization_banner_colors',
            '0043_institute_shared_skills': '0042_position_descriptions'}[MIGRATION]
if RECONCILE:
    PREVIOUS = '0031_recommendation_assessment_order'
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
env = {**os.environ, 'PYTHON_DOTENV_DISABLED': '1', 'DEBUG': 'True',
       'SECRET_KEY': 'synthetic-program-migration-key', 'DB_NAME': 'test_program_migration',
       'DB_HOST': '127.0.0.1', 'DB_PORT': str(port), 'DB_USER': 'program_migration',
       'DB_PASSWORD': '', 'DB_SSLMODE': 'disable', 'PYTHONIOENCODING': 'utf-8'}
started = False
activity_stop = Event()
activity_worker = None
activity_errors = []


def concurrent_activity():
    activity = None
    try:
        activity = psycopg2.connect(host='127.0.0.1', port=port, user='program_migration',
                                    dbname='test_program_migration', sslmode='disable')
        activity.autocommit = True
        number = 0
        while not activity_stop.is_set():
            number += 1
            with activity.cursor() as cursor:
                cursor.execute('UPDATE api_company SET address=%s::jsonb WHERE name=%s',
                               [json.dumps({'synthetic_counter': number}), 'Retained synthetic partner'])
            activity_stop.wait(0.2)
    except Exception as exc:
        activity_errors.append(type(exc).__name__)
    finally:
        if activity:
            activity.close()


def run(command, filename):
    destination = OUT / filename
    with destination.open('w', encoding='utf-8') as log:
        result = subprocess.run([str(value) for value in command], cwd=ROOT / 'skillbridge-backend', env=env,
            stdout=log, stderr=subprocess.STDOUT, creationflags=subprocess.CREATE_NO_WINDOW)
    if result.returncode:
        raise RuntimeError(f'Isolated rehearsal failed: {filename}')
    return destination.read_text(encoding='utf-8')


print('Evidence:', OUT, flush=True)
try:
    run([BIN / 'initdb.exe', '-D', DATA, '-U', 'program_migration', '-A', 'trust', '--no-locale', '-E', 'UTF8'], 'initdb.txt')
    started = True
    run([BIN / 'pg_ctl.exe', '-D', DATA, '-l', OUT / 'server.txt', '-o', f'-h 127.0.0.1 -p {port}', '-w', 'start'], 'start.txt')
    run([BIN / 'createdb.exe', '-h', '127.0.0.1', '-p', port, '-U', 'program_migration', 'test_program_migration'], 'createdb.txt')
    run([PYTHON, 'manage.py', 'migrate', '--noinput'], 'migrate-latest.txt')
    run([PYTHON, 'manage.py', 'migrate', 'api', PREVIOUS, '--noinput'], 'migrate-source.txt')
    seed = """from django.db import connection
from django.db.migrations.executor import MigrationExecutor
apps = MigrationExecutor(connection).loader.project_state([('api','PREVIOUS_MIGRATION')]).apps
User, Batch = apps.get_model('api','User'), apps.get_model('api','Batch')
owner = User.objects.create(email='operator-owner@example.invalid', role='instructor', name='Synthetic Owner')
batch = Batch.objects.create(name='Preserved mixed IC cohort', instructor_id=owner.id)
for index, course in enumerate(['BSIT','BSIS']):
    student = User.objects.create(email=f'operator-{index}@example.invalid', role='student', course=course, department='Institute of Computing')
    apps.get_model('api','BatchEnrollment').objects.create(batch_id=batch.id, student_id=student.id)
User.objects.create(email='operator-unknown@example.invalid', role='student', course='Unknown', department='Institute of Computing')
apps.get_model('api','SkillCategory').objects.create(name='Retained IC category', description='Existing definition', tags=['Existing tag'])
company = apps.get_model('api','Company').objects.create(name='Retained synthetic partner')
apps.get_model('api','Position').objects.create(company_id=company.id, title='Retained opening', slots_available=2)
"""
    if MIGRATION == '0042_position_descriptions':
        seed += """
from importlib import import_module
from django.utils import timezone
descriptions = import_module('api.migrations.0042_position_descriptions').IC_DESCRIPTIONS
Position = apps.get_model('api', 'Position')
for title in descriptions:
    Position.objects.create(company_id=company.id, title=title, slots_available=2)
Position.objects.create(company_id=company.id, title='Frontend Developer', eligibility_configured_at=timezone.now())
"""
    run([PYTHON, 'manage.py', 'shell', '-c', seed.replace('PREVIOUS_MIGRATION', PREVIOUS)], 'seed.txt')
    if RECONCILE:
        run([PYTHON, 'manage.py', 'migrate', '--noinput'], 'upgrade-from-pre-organization.txt')
        command = [PYTHON, 'scripts/migrate_organization_catalog.py', '--reconcile-ic']
        inspected = json.loads(run(command, 'inspect.txt').strip())
        assert inspected['pending'] == []
        assert inspected['mapping'] == {'students_by_program': {'BSIT': 1, 'BSIS': 1}, 'batches': 1,
            'institute_to_create': True, 'programs_to_create': ['BSIS', 'BSIT'],
            'review_counts': {'students_without_confirmed_labels': 1}}
        try:
            run([*command, '--apply', '--expected-target', inspected['target_fingerprint'],
                 '--expected-plan', 'wrong-fingerprint'], 'reject-unreviewed.txt')
        except RuntimeError:
            assert 'IC mapping changed or was not reviewed' in (OUT / 'reject-unreviewed.txt').read_text(encoding='utf-8')
        else:
            raise AssertionError('Unreviewed data mapping was accepted')
        result = run([*command, '--apply', '--expected-target', inspected['target_fingerprint'],
                      '--expected-plan', inspected['mapping_fingerprint']], 'apply.txt')
        applied = json.loads(result.strip().splitlines()[-1])
        receipt = json.loads((Path(applied['receipt_directory']) / 'receipt.json').read_text(encoding='utf-8'))
        assert receipt['backup_restored_and_hash_verified'] and receipt['pending_after'] == []
        assert receipt['mapping'] == inspected['mapping'] and not receipt['regraded_or_recalculated']
        repeat = json.loads(run(command, 'repeat.txt').strip())
        assert repeat['mapping']['students_by_program'] == {} and repeat['mapping']['batches'] == 0
        print(json.dumps({'passed': True, 'synthetic_source_only': True, 'preserved_tables': receipt['preserved_tables'],
                          'actual_backup_restore_and_mapping_rehearsal': True, 'idempotent': True,
                          'receipt_directory': applied['receipt_directory']}), flush=True)
        raise SystemExit(0)
    command = [PYTHON, 'scripts/migrate_organization_catalog.py', '--migration', MIGRATION]
    inspected = json.loads(run(command, 'inspect.txt').strip())
    assert inspected['pending'] == [['api', MIGRATION, False]]
    if '--concurrent-activity' in sys.argv:
        activity_worker = Thread(target=concurrent_activity, daemon=True)
        activity_worker.start()
    result = run([*command, '--apply', '--expected-target', inspected['target_fingerprint']], 'apply.txt')
    applied = json.loads(result.strip().splitlines()[-1])
    receipt = json.loads((Path(applied['receipt_directory']) / 'receipt.json').read_text(encoding='utf-8'))
    assert receipt['backup_restored_and_hash_verified']
    assert receipt['pending_after'] == [] and not receipt['regraded_or_recalculated']
    assert receipt['new_nullable_columns'] == {
        '0034_program_batch_context': {'api_batch': ['institute_id', 'program_id'], 'api_user': ['program_id']},
        '0035_neutral_user_department': {},
        '0036_program_competency_frameworks': {'api_batch': ['framework_id'], 'api_skillcategory': ['framework_id', 'source_category_id']},
        '0037_assessment_framework': {'api_assessment': ['framework_id']},
        '0038_position_program_eligibility': {'api_position': ['eligibility_configured_at']},
        '0039_coordinator_catalog_authority': {
            'api_company': ['management_program_id'],
            'api_position': ['created_by_id', 'management_program_id'],
        },
        '0042_position_descriptions': {'api_position': ['description']},
        '0043_institute_shared_skills': {},
    }[MIGRATION]
    expected_tables = {'0036': ['api_competencyframework'], '0038': ['api_position_eligible_programs'],
                       '0043': ['api_instituteskill']}
    assert receipt['new_empty_tables'] == expected_tables.get(MIGRATION[:4], [])
    if MIGRATION == '0042_position_descriptions':
        run([PYTHON, 'manage.py', 'shell', '-c', """
from importlib import import_module
from api.models import Position
expected = import_module('api.migrations.0042_position_descriptions').IC_DESCRIPTIONS
assert dict(Position.objects.exclude(description='').values_list('title', 'description')) == expected
assert Position.objects.exclude(description='').count() == 6
assert Position.objects.get(eligibility_configured_at__isnull=False).description == ''
assert Position.objects.get(title='Retained opening').description == ''
"""], 'verify-descriptions.txt')
    if activity_worker:
        activity_stop.set()
        activity_worker.join(timeout=10)
        assert not activity_worker.is_alive() and not activity_errors, activity_errors
        assert 'api_company' in receipt['tables_with_unrelated_changes_since_backup']
    summary = {'passed': True, 'migration': MIGRATION, 'synthetic_source_only': True, 'preserved_tables': receipt['preserved_tables'],
               'actual_backup_restore_and_django_rehearsal': True, 'receipt_directory': applied['receipt_directory']}
    if activity_worker:
        summary['concurrent_activity_preserved'] = True
    (OUT / 'results.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
    print(json.dumps(summary), flush=True)
finally:
    activity_stop.set()
    if activity_worker:
        activity_worker.join(timeout=10)
    if started and (DATA / 'postmaster.pid').exists():
        run([BIN / 'pg_ctl.exe', '-D', DATA, '-m', 'fast', '-w', 'stop'], 'stop.txt')
