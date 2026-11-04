"""Run organization and existing API tests on an owned loopback-only cluster."""
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
BIN = ROOT / 'work/defense_audit/postgres-runtime/pgsql/bin'
RUN = Path(tempfile.mkdtemp(prefix='organization-postgres-', dir=ROOT / 'work'))
DATA = RUN / 'data'
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
env = {**os.environ, 'PYTHON_DOTENV_DISABLED': '1', 'DEBUG': 'True',
       'SECRET_KEY': 'synthetic-organization-postgres-key',
       'SB_TEST_DB_NAME': 'test_organization', 'SB_TEST_DB_USER': 'skillbridge_test',
       'SB_TEST_DB_PASSWORD': '', 'SB_TEST_DB_HOST': '127.0.0.1', 'SB_TEST_DB_PORT': str(port),
       'PYTHONIOENCODING': 'utf-8'}
flags = subprocess.CREATE_NO_WINDOW
started = False
print('Evidence:', RUN, flush=True)
try:
    with (RUN / 'initdb.log').open('w', encoding='utf-8') as log:
        subprocess.run([str(BIN / 'initdb.exe'), '-D', str(DATA), '-U', 'skillbridge_test', '-A', 'trust', '--no-locale', '-E', 'UTF8'],
                       env=env, stdout=log, stderr=subprocess.STDOUT, check=True, creationflags=flags)
    subprocess.run([str(BIN / 'pg_ctl.exe'), '-D', str(DATA), '-l', str(RUN / 'server.log'), '-o', f'-h 127.0.0.1 -p {port}', '-w', 'start'],
                   env=env, check=True, creationflags=flags)
    started = True
    with (RUN / 'tests.txt').open('w', encoding='utf-8') as log:
        result = subprocess.run([str(ROOT / 'skillbridge-backend/venv/Scripts/python.exe'), 'manage.py', 'test',
            *(sys.argv[1:] or ['api']), '--settings=core.sse_postgres_test_settings', '--noinput', '--verbosity=1'],
            cwd=ROOT / 'skillbridge-backend', env=env, stdout=log, stderr=subprocess.STDOUT, creationflags=flags)
    print((RUN / 'tests.txt').read_text(encoding='utf-8')[-7000:])
    raise SystemExit(result.returncode)
finally:
    if started:
        subprocess.run([str(BIN / 'pg_ctl.exe'), '-D', str(DATA), '-m', 'fast', '-w', 'stop'], env=env, creationflags=flags)
