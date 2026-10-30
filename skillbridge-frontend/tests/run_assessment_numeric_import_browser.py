"""Windows preview runner; no backend is started and all API calls are mocked."""
from pathlib import Path
import os
import shutil
import socket
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'skillbridge-frontend/tests/artifacts/assessment-numeric-import'
OUT.mkdir(parents=True, exist_ok=True)
flags = subprocess.CREATE_NO_WINDOW
env = {**os.environ, 'PYTHONIOENCODING': 'utf-8'}
with socket.socket() as sock:
    if sock.connect_ex(('127.0.0.1', 5199)) == 0:
        raise RuntimeError('Port 5199 already belongs to another process.')
with (OUT / 'preview.log').open('w', encoding='utf-8') as log:
    server = subprocess.Popen([shutil.which('node'), 'skillbridge-frontend/node_modules/vite/bin/vite.js',
        'preview', 'skillbridge-frontend', '--host', '127.0.0.1', '--port', '5199', '--strictPort'],
        cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, creationflags=flags)
    try:
        deadline = time.monotonic() + 45
        while time.monotonic() < deadline:
            if server.poll() is not None:
                raise RuntimeError('Preview exited; inspect preview.log')
            with socket.socket() as sock:
                if sock.connect_ex(('127.0.0.1', 5199)) == 0:
                    break
            time.sleep(.2)
        else:
            raise RuntimeError('Preview did not start in 45 seconds')
        with (OUT / 'browser.log').open('w', encoding='utf-8') as output:
            result = subprocess.run([str(ROOT / 'skillbridge-backend/venv/Scripts/python.exe'), '-u',
                'skillbridge-frontend/tests/assessment_numeric_import_playwright.py'],
                cwd=ROOT, env=env, stdout=output, stderr=subprocess.STDOUT, creationflags=flags)
        print((OUT / 'browser.log').read_text(encoding='utf-8'))
        sys.exit(result.returncode)
    finally:
        subprocess.run(['taskkill.exe', '/PID', str(server.pid), '/T', '/F'],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=flags)
