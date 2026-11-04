"""Inspect or apply only 0032 after an owned backup/restore preservation check.

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
sys.path.insert(0, str(ROOT / 'skillbridge-backend'))
os.chdir(ROOT / 'skillbridge-backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()
from django.db import connection, transaction
from django.db.migrations.executor import MigrationExecutor
import psycopg2

TARGET = ('api', '0032_institute_program_catalog')
BIN = ROOT / 'work/defense_audit/postgres-runtime/pgsql/bin'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--apply', action='store_true')
parser.add_argument('--expected-target')
args = parser.parse_args()


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, default=str).encode()).hexdigest()


def plan():
    executor = MigrationExecutor(connection)
    return [(m.app_label, m.name, backwards) for m, backwards in executor.migration_plan(executor.loader.graph.leaf_nodes())]


def snapshot(conn):
    with conn.cursor() as cursor:
        cursor.execute("SET TIME ZONE 'UTC'")
        cursor.execute("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
        tables = [row[0] for row in cursor.fetchall()]
        result = {}
        for table in tables:
            if table == 'django_migrations':
                continue
            name = '"' + table.replace('"', '""') + '"'
            cursor.execute(f'SELECT to_jsonb(t)::text FROM public.{name} t ORDER BY to_jsonb(t)::text')
            checksum, count = hashlib.sha256(), 0
            while rows := cursor.fetchmany(500):
                for row in rows:
                    checksum.update(row[0].encode('utf-8') + b'\n')
                    count += 1
            result[table] = {'count': count, 'sha256': checksum.hexdigest()}
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
print(json.dumps({'mode': 'apply' if args.apply else 'read-only', 'target_fingerprint': target_hash, 'pending': pending}), flush=True)
if not args.apply:
    connection.close()
    raise SystemExit(0)
assert args.expected_target == target_hash, 'Target changed or was not inspected'
assert pending == [(TARGET[0], TARGET[1], False)], 'Only the reviewed forward 0032 migration may run'
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
        assert 'api_user' in before and 'api_batch' in before
        assert not {'api_institute', 'api_program'} & set(before)
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
        # Live mutation begins only after the public-schema backup restores exactly.
        assert plan() == pending, 'Pending migrations changed'
        MigrationExecutor(connection).migrate([TARGET])
        after = snapshot(connection)
        assert set(after) - set(before) == {'api_institute', 'api_program'}
        assert all(after[name] == facts for name, facts in before.items()), 'Preserved data changed; rollback'
        assert after['api_institute']['count'] == after['api_program']['count'] == 0
    receipt = {'migration': list(TARGET), 'target_fingerprint': target_hash, 'backup_scope': 'public schema only',
               'backup_restored_and_hash_verified': True, 'preserved_tables': len(before),
               'preserved_facts': before, 'new_empty_tables': ['api_institute', 'api_program'],
               'pending_after': plan(), 'regraded_or_recalculated': False}
    (OUT / 'receipt.json').write_text(json.dumps(receipt, indent=2), encoding='utf-8')
    print(json.dumps({'applied': list(TARGET), 'existing_tables_unchanged': len(before), 'backup_restore_verified': True,
                      'new_empty_tables': 2, 'receipt_directory': str(OUT)}))
finally:
    connection.close()
    if started and (DATA / 'postmaster.pid').exists():
        run([BIN / 'pg_ctl.exe', '-D', DATA, '-m', 'fast', '-w', 'stop'], local_env)
