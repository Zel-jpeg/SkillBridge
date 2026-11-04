"""Hidden localhost servers and real-API production-bundle browser checks."""
from pathlib import Path
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parents[2]
OUT = Path(tempfile.mkdtemp(prefix='organization-browser-', dir=ROOT / 'work'))
def port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]
api_port, frontend_port = port(), port()
env = {**os.environ, 'PYTHON_DOTENV_DISABLED': '1', 'PYTHONIOENCODING': 'utf-8', 'SB_ORGANIZATION_RUN': str(OUT),
       'SB_ORGANIZATION_API_PORT': str(api_port), 'SB_ORGANIZATION_FRONTEND_PORT': str(frontend_port)}
commands = [([sys.executable, '-u', str(ROOT / 'skillbridge-frontend/tests/organization_server.py')], api_port),
    ([shutil.which('node'), str(ROOT / 'skillbridge-frontend/node_modules/vite/bin/vite.js'), 'preview', str(ROOT / 'skillbridge-frontend'),
      '--host', '127.0.0.1', '--port', str(frontend_port), '--strictPort'], frontend_port)]
processes, logs = [], []
print('Evidence:', OUT, flush=True)
try:
    for command, server_port in commands:
        log = (OUT / f'server-{server_port}.log').open('w', encoding='utf-8')
        logs.append(log)
        process = subprocess.Popen(command, cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT, creationflags=subprocess.CREATE_NO_WINDOW)
        processes.append(process)
        end = time.monotonic() + 55
        while time.monotonic() < end:
            if process.poll() is not None:
                raise RuntimeError(f'Owned test server exited; inspect server-{server_port}.log')
            with socket.socket() as sock:
                if sock.connect_ex(('127.0.0.1', server_port)) == 0:
                    break
            time.sleep(.2)
        else:
            raise RuntimeError('Owned server did not become ready')
    with (OUT / 'browser.txt').open('w', encoding='utf-8') as log:
        script = 'instructor_assignments_playwright.py' if '--assignments' in sys.argv else 'organization_playwright.py'
        result = subprocess.run([sys.executable, '-u', str(ROOT / 'skillbridge-frontend/tests' / script)],
                                cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT, creationflags=subprocess.CREATE_NO_WINDOW)
    print((OUT / 'browser.txt').read_text(encoding='utf-8')[-7000:])
    raise SystemExit(result.returncode)
finally:
    for process in processes:
        if process.poll() is None:
            subprocess.run(['taskkill.exe', '/PID', str(process.pid), '/T', '/F'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=subprocess.CREATE_NO_WINDOW)
            process.wait(timeout=10)
    for log in logs:
        log.close()
