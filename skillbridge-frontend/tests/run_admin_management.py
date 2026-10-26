"""Start fresh, hidden test servers; IPv4 readiness and child-process cleanup on Windows."""
import os
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ANALYTICS = '--analytics' in sys.argv
ARTIFACTS = ROOT / 'skillbridge-frontend/tests/artifacts' / ('analytics' if ANALYTICS else 'admin-management')
ARTIFACTS.mkdir(parents=True, exist_ok=True)


def unused_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


def ready(process, port):
    deadline = time.monotonic() + 45
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(f'Test server exited: inspect server-{port}.log')
        try:
            with socket.create_connection(('127.0.0.1', port), timeout=0.25):
                return
        except OSError:
            time.sleep(0.2)
    raise RuntimeError(f'Test server did not listen on IPv4 port {port}')


api_port, frontend_port = unused_port(), unused_port()
env = {**os.environ, 'ADMIN_MANAGEMENT_API_PORT': str(api_port),
    'ADMIN_MANAGEMENT_FRONTEND_PORT': str(frontend_port),
    'ADMIN_MANAGEMENT_FRONTEND_URL': f'http://127.0.0.1:{frontend_port}', 'PYTHONIOENCODING': 'utf-8'}
commands = [
    ([str(ROOT / 'skillbridge-backend/venv/Scripts/python.exe'), '-u', str(ROOT / 'skillbridge-frontend/tests' / ('analytics_server.py' if ANALYTICS else 'admin_management_server.py'))], api_port),
    ([shutil.which('node'), str(ROOT / 'skillbridge-frontend/node_modules/vite/bin/vite.js'), str(ROOT / 'skillbridge-frontend'), '--host', '127.0.0.1', '--port', str(frontend_port), '--strictPort'], frontend_port),
]
processes, files = [], []
try:
    for command, port in commands:
        log = (ARTIFACTS / f'server-{port}.log').open('w', encoding='utf-8')
        files.append(log)
        process = subprocess.Popen(command, cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        processes.append((process, port))
    for process, port in processes:
        ready(process, port)
    script = 'analytics_activity_playwright.py' if '--activity-periods' in sys.argv else 'assessment_policy_playwright.py' if '--policy' in sys.argv else 'assessment_archives_playwright.py' if '--archives' in sys.argv else 'analytics_playwright.py' if ANALYTICS else 'admin_assessments_playwright.py' if '--oversight' in sys.argv else 'admin_management_playwright.py'
    args = [arg for arg in sys.argv[1:] if arg not in ('--oversight', '--analytics', '--archives', '--policy', '--activity-periods')]
    result = subprocess.run([sys.executable, '-u', str(ROOT / 'skillbridge-frontend/tests' / script), *args], cwd=ROOT, env=env)
    raise SystemExit(result.returncode)
finally:
    for process, _ in processes:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
    for log in files:
        log.close()
