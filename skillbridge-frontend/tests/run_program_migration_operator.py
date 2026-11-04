"""Rehearse the configured migration operator on an owned synthetic source DB."""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
BIN = ROOT / 'work/defense_audit/postgres-runtime/pgsql/bin'
OUT = Path(tempfile.mkdtemp(prefix='program-migration-operator-', dir=ROOT / 'work'))
DATA = OUT / 'source-cluster'
PYTHON = ROOT / 'skillbridge-backend/venv/Scripts/python.exe'
MIGRATION = sys.argv[1] if len(sys.argv) > 1 else '0037_assessment_framework'
PREVIOUS = {'0034_program_batch_context': '0033_instructor_program_assignment',
            '0035_neutral_user_department': '0034_program_batch_context',
            '0036_program_competency_frameworks': '0035_neutral_user_department',
            '0037_assessment_framework': '0036_program_competency_frameworks'}[MIGRATION]
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
env = {**os.environ, 'PYTHON_DOTENV_DISABLED': '1', 'DEBUG': 'True',
       'SECRET_KEY': 'synthetic-program-migration-key', 'DB_NAME': 'test_program_migration',
       'DB_HOST': '127.0.0.1', 'DB_PORT': str(port), 'DB_USER': 'program_migration',
       'DB_PASSWORD': '', 'DB_SSLMODE': 'disable', 'PYTHONIOENCODING': 'utf-8'}
started = False


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
    student = User.objects.create(email=f'operator-{index}@example.invalid', role='student', course=course)
    apps.get_model('api','BatchEnrollment').objects.create(batch_id=batch.id, student_id=student.id)
apps.get_model('api','SkillCategory').objects.create(name='Retained IC category', description='Existing definition', tags=['Existing tag'])
"""
    run([PYTHON, 'manage.py', 'shell', '-c', seed.replace('PREVIOUS_MIGRATION', PREVIOUS)], 'seed.txt')
    command = [PYTHON, 'scripts/migrate_organization_catalog.py', '--migration', MIGRATION]
    inspected = json.loads(run(command, 'inspect.txt').strip())
    assert inspected['pending'] == [['api', MIGRATION, False]]
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
    }[MIGRATION]
    assert receipt['new_empty_tables'] == (['api_competencyframework'] if MIGRATION.startswith('0036') else [])
    summary = {'passed': True, 'migration': MIGRATION, 'synthetic_source_only': True, 'preserved_tables': receipt['preserved_tables'],
               'actual_backup_restore_and_django_rehearsal': True, 'receipt_directory': applied['receipt_directory']}
    (OUT / 'results.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
    print(json.dumps(summary), flush=True)
finally:
    if started and (DATA / 'postmaster.pid').exists():
        run([BIN / 'pg_ctl.exe', '-D', DATA, '-m', 'fast', '-w', 'stop'], 'stop.txt')
