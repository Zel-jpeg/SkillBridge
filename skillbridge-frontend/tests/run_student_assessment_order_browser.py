"""Windows local fixture runner with file logs and task-owned helper cleanup."""
import os
from pathlib import Path
import socket
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'skillbridge-frontend/tests/artifacts/student-assessment-order'
OUT.mkdir(parents=True, exist_ok=True)
PYTHON = ROOT / 'skillbridge-backend/venv/Scripts/python.exe'
NODE = Path(subprocess.check_output(['where.exe', 'node'], text=True).splitlines()[0])
env = {**os.environ, 'VITE_API_URL': 'http://127.0.0.1:8187', 'PYTHONIOENCODING': 'utf-8'}
flags = subprocess.CREATE_NO_WINDOW
processes, logs = [], []
try:
    for name, command, port in [
        ('api', [str(PYTHON), '-u', 'skillbridge-frontend/tests/student_assessment_order_server.py'], 8187),
        ('vite', [str(NODE), 'skillbridge-frontend/node_modules/vite/bin/vite.js', 'preview', 'skillbridge-frontend', '--host', '127.0.0.1', '--port', '5187', '--strictPort'], 5187),
    ]:
        with socket.socket() as sock:
            if sock.connect_ex(('127.0.0.1', port)) == 0:
                raise RuntimeError(f'Port {port} is already occupied; do not reuse another task server.')
        log = (OUT / f'{name}.log').open('w', encoding='utf-8')
        logs.append(log)
        process = subprocess.Popen(command, cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT, creationflags=flags)
        processes.append(process)
        deadline = time.monotonic() + 60
        while time.monotonic() < deadline:
            if process.poll() is not None:
                raise RuntimeError(f'{name} exited; inspect {name}.log')
            with socket.socket() as sock:
                sock.settimeout(.5)
                if sock.connect_ex(('127.0.0.1', port)) == 0:
                    break
            time.sleep(.2)
        else:
            raise RuntimeError(f'{name} did not start within 60 seconds')
        print(f'{name} ready', flush=True)
    with (OUT / 'browser.log').open('w', encoding='utf-8') as log:
        result = subprocess.run([str(PYTHON), '-u', 'skillbridge-frontend/tests/student_assessment_order_playwright.py'],
                                cwd=ROOT, env=env, creationflags=flags, stdout=log, stderr=subprocess.STDOUT)
    print((OUT / 'browser.log').read_text(encoding='utf-8'), flush=True)
    sys.exit(result.returncode)
finally:
    for process in reversed(processes):
        subprocess.run(['taskkill.exe', '/PID', str(process.pid), '/T', '/F'],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=flags)
    for log in logs:
        log.close()
