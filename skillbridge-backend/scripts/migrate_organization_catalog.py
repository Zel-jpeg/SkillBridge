"""Inspect or apply one reviewed additive catalog/assignment migration.

Default is read-only. --apply requires the inspected target fingerprint. Private
public-schema backups stay under ignored work/; receipts contain only hashes and
schema/count facts. No grading, enrollment or recommendation helper is invoked.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
if not __debug__:
    raise RuntimeError('Run the migration operator without Python optimization so validation remains enabled.')
sys.path.insert(0, str(ROOT / 'skillbridge-backend'))
os.chdir(ROOT / 'skillbridge-backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()
from django.db import connection, connections, transaction
from django.db.migrations.executor import MigrationExecutor
from api.legacy_organization import apply_mapping, mapping_plan, mapping_summary
import psycopg2

SUPPORTED = {
    '0032_institute_program_catalog': {'api_institute', 'api_program'},
    '0033_instructor_program_assignment': {'api_instructorassignment'},
    '0034_program_batch_context': set(),
    '0035_neutral_user_department': set(),
    '0036_program_competency_frameworks': {'api_competencyframework'},
    '0037_assessment_framework': set(),
    '0038_position_program_eligibility': {'api_position_eligible_programs'},
}
BIN = ROOT / 'work/defense_audit/postgres-runtime/pgsql/bin'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--apply', action='store_true')
parser.add_argument('--expected-target')
parser.add_argument('--reconcile-ic', action='store_true', help='Review or apply existing IC context links.')
parser.add_argument('--expected-plan', help='Fingerprint from the read-only IC mapping review.')
parser.add_argument('--migration', choices=SUPPORTED, default='0032_institute_program_catalog')
args = parser.parse_args()
TARGET = ('api', args.migration)
ADDED_TABLES = SUPPORTED[args.migration]
ADDED_COLUMNS = {
    '0034_program_batch_context': {'api_batch': ['institute_id', 'program_id'], 'api_user': ['program_id']},
    '0036_program_competency_frameworks': {'api_batch': ['framework_id'], 'api_skillcategory': ['framework_id', 'source_category_id']},
    '0037_assessment_framework': {'api_assessment': ['framework_id']},
    '0038_position_program_eligibility': {'api_position': ['eligibility_configured_at']},
}.get(args.migration, {})


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, default=str).encode()).hexdigest()


def plan():
    executor = MigrationExecutor(connection)
    return [(m.app_label, m.name, backwards) for m, backwards in executor.migration_plan(executor.loader.graph.leaf_nodes())]


def snapshot(conn, excluded_columns=None):
    with conn.cursor() as cursor:
        cursor.execute("SET TIME ZONE 'UTC'")
        cursor.execute("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
        tables = [row[0] for row in cursor.fetchall()]
        result = {}
        for table in tables:
            if table == 'django_migrations':
                continue
            name = '"' + table.replace('"', '""') + '"'
            excluded = (excluded_columns or {}).get(table, [])
            cursor.execute(f'SELECT (to_jsonb(t) - %s::text[])::text FROM public.{name} t ORDER BY 1', [excluded])
            checksum, count = hashlib.sha256(), 0
            while rows := cursor.fetchmany(500):
                for row in rows:
                    checksum.update(row[0].encode('utf-8') + b'\n')
                    count += 1
            result[table] = {'count': count, 'sha256': checksum.hexdigest()}
        return result


def columns(conn):
    with conn.cursor() as cursor:
        cursor.execute("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public'")
        return {(table, name) for table, name in cursor.fetchall()}


MAPPED_COLUMNS = {'api_user': ['program_id'], 'api_batch': ['institute_id']}
CATALOG_TABLES = {'api_institute', 'api_program'}


def reconcile(conn, reviewed, preserved, using):
    from api.models import Batch, Institute, Program, User

    def links(model, field):
        return dict(model.objects.using(using).order_by('pk').values_list('pk', field))

    def catalog():
        return {model: {row['id']: row for row in model.objects.using(using).values()} for model in (Institute, Program)}

    old_catalog = catalog()
    students, batches = links(User, 'program_id'), links(Batch, 'institute_id')
    result = apply_mapping(reviewed, using)
    new_catalog = catalog()
    for model, original in old_catalog.items():
        assert all(new_catalog[model].get(key) == row for key, row in original.items()), 'Existing catalog configuration changed'
    after = snapshot(conn, MAPPED_COLUMNS)
    assert {key: value for key, value in after.items() if key not in CATALOG_TABLES} == preserved, 'Unrelated saved data changed'
    recheck = mapping_plan(using)
    assert not recheck['students'] and not recheck['batches'], 'Reconciliation is incomplete'
    students.update({key: recheck['existing_programs'][code] for key, code in reviewed['students'].items()})
    batches.update(dict.fromkeys(reviewed['batches'], recheck['institute_id']))
    assert links(User, 'program_id') == students and links(Batch, 'institute_id') == batches, 'Context link verification failed'
    assert len(new_catalog[Institute]) - len(old_catalog[Institute]) == int(result['institute_to_create'])
    assert len(new_catalog[Program]) - len(old_catalog[Program]) == len(result['programs_to_create'])
    return result


def run(command, env, timeout=90):
    # A detached Windows postgres child can inherit PIPE handles and keep
    # communicate() waiting after pg_ctl exits. These tools need only exit status.
    result = subprocess.run([str(part) for part in command], env=env,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                            timeout=timeout, creationflags=subprocess.CREATE_NO_WINDOW)
    if result.returncode:
        # Database connection diagnostics can include private connection details.
        raise RuntimeError(f'{Path(command[0]).name} failed with exit {result.returncode}; migration stopped')


cfg = connection.settings_dict
assert cfg['ENGINE'] == 'django.db.backends.postgresql', 'Expected PostgreSQL target'
target_hash = digest([cfg['HOST'], cfg['PORT'], cfg['NAME'], cfg['USER']])
pending = plan()
inspection = {'mode': 'apply' if args.apply else 'read-only', 'target_fingerprint': target_hash, 'pending': pending}
if args.reconcile_ic:
    assert not pending, 'Apply pending reviewed schema migrations before reconciliation'
    with transaction.atomic():
        with connection.cursor() as cursor:
            cursor.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY")
        reviewed = mapping_plan()
    mapping_hash = digest(reviewed)
    inspection.update(mapping_fingerprint=mapping_hash, mapping=mapping_summary(reviewed))
print(json.dumps(inspection), flush=True)
if not args.apply:
    connection.close()
    raise SystemExit(0)
assert args.expected_target == target_hash, 'Target changed or was not inspected'
if args.reconcile_ic:
    assert args.expected_plan == mapping_hash, 'IC mapping changed or was not reviewed'
    assert reviewed['students'] or reviewed['batches'], 'There are no confirmed links to apply'
else:
    assert pending == [(TARGET[0], TARGET[1], False)], 'Only the single selected reviewed forward migration may run'
OUT = Path(tempfile.mkdtemp(prefix='organization-configured-migration-', dir=ROOT / 'work'))
DATA = OUT / 'restore-cluster'
backup = OUT / 'private-public-schema.dump'
source_env = {**os.environ, 'PGHOST': str(cfg['HOST']), 'PGPORT': str(cfg['PORT'] or 5432),
              'PGDATABASE': str(cfg['NAME']), 'PGUSER': str(cfg['USER']), 'PGPASSWORD': str(cfg['PASSWORD']),
              'PGSSLMODE': cfg.get('OPTIONS', {}).get('sslmode', 'require')}
if cfg.get('OPTIONS', {}).get('sslrootcert'):
    source_env['PGSSLROOTCERT'] = cfg['OPTIONS']['sslrootcert']
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
local_env = {**os.environ, 'PGHOST': '127.0.0.1', 'PGPORT': str(port), 'PGUSER': 'organization_restore',
             'PGPASSWORD': '', 'PGDATABASE': 'verify_organization_backup', 'PGSSLMODE': 'disable'}
started = False
try:
    # Keep a consistent source snapshot for pg_dump and preservation hashes.
    with transaction.atomic():
        with connection.cursor() as cursor:
            cursor.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
            cursor.execute("SET LOCAL lock_timeout='5s'")
            cursor.execute("SET LOCAL statement_timeout='45s'")
            cursor.execute("SET LOCAL idle_in_transaction_session_timeout='180s'")
            cursor.execute('SELECT pg_export_snapshot()')
            exported_snapshot = cursor.fetchone()[0]
        before = snapshot(connection)
        before_columns = columns(connection)
        if args.reconcile_ic:
            assert digest(mapping_plan()) == mapping_hash, 'IC mapping changed before backup'
            preserved = {key: value for key, value in snapshot(connection, MAPPED_COLUMNS).items() if key not in CATALOG_TABLES}
        added_columns = {(table, name) for table, names in ADDED_COLUMNS.items() for name in names}
        assert 'api_user' in before and 'api_batch' in before
        if not args.reconcile_ic:
            assert not added_columns & before_columns, 'Expected new columns already exist'
            assert not ADDED_TABLES & set(before)
        run([BIN / 'pg_dump.exe', '--format=custom', '--schema=public', '--no-owner', '--no-acl',
             f'--snapshot={exported_snapshot}', f'--file={backup}'], source_env)
        assert backup.is_file() and backup.stat().st_size > 0
        run([BIN / 'initdb.exe', '-D', DATA, '-U', 'organization_restore', '-A', 'trust', '--no-locale', '-E', 'UTF8'], local_env)
        started = True
        run([BIN / 'pg_ctl.exe', '-D', DATA, '-l', OUT / 'restore-server.log', '-o', f'-h 127.0.0.1 -p {port}', '-w', 'start'], local_env)
        run([BIN / 'createdb.exe', 'verify_organization_backup'], local_env)
        run([BIN / 'pg_restore.exe', '--clean', '--if-exists', '--no-owner', '--no-acl', '--exit-on-error',
             '--dbname=verify_organization_backup', backup], local_env)
        with psycopg2.connect(host='127.0.0.1', port=port, user='organization_restore', dbname='verify_organization_backup', sslmode='disable') as restored:
            assert snapshot(restored) == before, 'Restored public-schema data differs; migration stopped'
            assert columns(restored) == before_columns, 'Restored column inventory differs'
        # Apply the actual Django migration on the restored database first.
        connections.databases['organization_restore'] = {**cfg, 'HOST': '127.0.0.1', 'PORT': str(port),
            'USER': 'organization_restore', 'PASSWORD': '', 'NAME': 'verify_organization_backup',
            'OPTIONS': {'sslmode': 'disable'}, 'CONN_MAX_AGE': 0}
        rehearsal = connections['organization_restore']
        try:
            if args.reconcile_ic:
                with transaction.atomic(using='organization_restore'):
                    assert digest(mapping_plan('organization_restore')) == mapping_hash, 'Restored IC mapping differs'
                    reconcile(rehearsal, reviewed, preserved, 'organization_restore')
                    assert columns(rehearsal) == before_columns
            else:
                MigrationExecutor(rehearsal).migrate([TARGET])
                rehearsed = snapshot(rehearsal, ADDED_COLUMNS)
                assert all(rehearsed[name] == facts for name, facts in before.items()), 'Rehearsal changed preserved data'
                assert set(rehearsed) - set(before) == ADDED_TABLES
                assert {column for column in columns(rehearsal) if column[0] not in ADDED_TABLES} == before_columns | added_columns
        finally:
            rehearsal.close()
    # Apply in a fresh transaction so a newer write invalidates the backup review.
    with transaction.atomic():
        with connection.cursor() as cursor:
            if args.reconcile_ic:
                cursor.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
            cursor.execute("SET LOCAL lock_timeout='5s'")
            cursor.execute("SET LOCAL statement_timeout='45s'")
            if args.reconcile_ic:
                cursor.execute('LOCK TABLE api_institute, api_program, api_user, api_batch, api_batchenrollment IN SHARE ROW EXCLUSIVE MODE')
        assert plan() == pending, 'Pending migrations changed'
        if args.reconcile_ic:
            assert columns(connection) == before_columns, 'Configured schema changed after backup'
            assert digest(mapping_plan()) == mapping_hash, 'IC mapping changed after backup'
            # Preserve any unrelated activity since the backup. This transaction
            # compares all untouched columns and tables at a single snapshot.
            live_preserved = {key: value for key, value in snapshot(connection, MAPPED_COLUMNS).items()
                              if key not in CATALOG_TABLES}
            mapping = reconcile(connection, reviewed, live_preserved, 'default')
            assert columns(connection) == before_columns
        else:
            MigrationExecutor(connection).migrate([TARGET])
            after = snapshot(connection, ADDED_COLUMNS)
            assert {column for column in columns(connection) if column[0] not in ADDED_TABLES} == before_columns | added_columns, 'Unexpected column changes; rollback'
            if ADDED_COLUMNS:
                with connection.cursor() as cursor:
                    for table, names in ADDED_COLUMNS.items():
                        for name in names:
                            cursor.execute(f'SELECT count(*) FROM public."{table}" WHERE "{name}" IS NOT NULL')
                            assert cursor.fetchone()[0] == 0, 'New context was populated unexpectedly; rollback'
            assert set(after) - set(before) == ADDED_TABLES
            assert all(after[name] == facts for name, facts in before.items()), 'Preserved data changed; rollback'
            assert all(after[table]['count'] == 0 for table in ADDED_TABLES)
    if args.reconcile_ic:
        receipt = {'mapping': mapping, 'mapping_fingerprint': mapping_hash, 'target_fingerprint': target_hash,
                   'backup_scope': 'public schema only', 'backup_restored_and_hash_verified': True,
                   'preserved_tables': len(live_preserved), 'preserved_facts': live_preserved,
                   'tables_with_unrelated_changes_since_backup': sorted(
                       key for key in live_preserved if live_preserved[key] != preserved.get(key)),
                   'pending_after': plan(), 'regraded_or_recalculated': False}
        (OUT / 'receipt.json').write_text(json.dumps(receipt, indent=2), encoding='utf-8')
        print(json.dumps({'reconciled': mapping, 'preserved_tables': len(live_preserved),
                          'backup_restore_verified': True, 'receipt_directory': str(OUT)}))
        raise SystemExit(0)
    receipt = {'migration': list(TARGET), 'target_fingerprint': target_hash, 'backup_scope': 'public schema only',
               'backup_restored_and_hash_verified': True, 'preserved_tables': len(before),
               'preserved_facts': before, 'new_empty_tables': sorted(ADDED_TABLES),
               'new_nullable_columns': ADDED_COLUMNS, 'new_context_all_null': bool(ADDED_COLUMNS),
               'pending_after': plan(), 'regraded_or_recalculated': False}
    (OUT / 'receipt.json').write_text(json.dumps(receipt, indent=2), encoding='utf-8')
    print(json.dumps({'applied': list(TARGET), 'existing_tables_unchanged': len(before), 'backup_restore_verified': True,
                      'new_empty_tables': len(ADDED_TABLES), 'receipt_directory': str(OUT)}))
finally:
    connection.close()
    if started and (DATA / 'postmaster.pid').exists():
        run([BIN / 'pg_ctl.exe', '-D', DATA, '-m', 'fast', '-w', 'stop'], local_env)
