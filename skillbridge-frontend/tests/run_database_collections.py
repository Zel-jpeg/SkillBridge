"""Owned hidden Windows helpers, production preview and disposable real API."""
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
sys.stdout.reconfigure(encoding='utf-8')
TESTS = ROOT / 'skillbridge-frontend/tests'
OUT = TESTS / 'artifacts/database-collections'
OUT.mkdir(parents=True, exist_ok=True)

def unused_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]

api_port, frontend_port = unused_port(), unused_port()
env = {**os.environ, 'PYTHON_DOTENV_DISABLED': '1', 'PYTHONIOENCODING': 'utf-8',
       'DB_COLLECTION_API_PORT': str(api_port), 'UI_TEST_BASE': f'http://127.0.0.1:{frontend_port}'}
flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
processes, logs = [], []
try:
    for command, port in [
        ([sys.executable, '-u', str(TESTS / 'database_collections_server.py')], api_port),
        ([shutil.which('node'), str(ROOT / 'skillbridge-frontend/node_modules/vite/bin/vite.js'),
          'preview', '--host', '127.0.0.1', '--port', str(frontend_port), '--strictPort'], frontend_port),
    ]:
        log = (OUT / f'server-{port}.log').open('w', encoding='utf-8')
        logs.append(log)
        process = subprocess.Popen(command, cwd=ROOT / 'skillbridge-frontend', env=env,
            stdout=log, stderr=subprocess.STDOUT, creationflags=flags)
        processes.append(process)
        deadline = time.monotonic() + 90
        while True:
            if process.poll() is not None:
                raise RuntimeError(f'Helper exited; inspect {OUT / f"server-{port}.log"}')
            try:
                with socket.create_connection(('127.0.0.1', port), timeout=0.25):
                    break
            except OSError:
                if time.monotonic() > deadline:
                    raise RuntimeError(f'Helper startup timed out on port {port}')
                time.sleep(0.2)
    with (OUT / 'browser.log').open('w', encoding='utf-8') as browser_log:
        result = subprocess.run([sys.executable, '-u', str(TESTS / 'database_collections_playwright.py')],
            cwd=ROOT, env=env, stdout=browser_log, stderr=subprocess.STDOUT, creationflags=flags)
    print((OUT / 'browser.log').read_text(encoding='utf-8'), flush=True)
    raise SystemExit(result.returncode)
finally:
    for process in processes:
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=10)
    for log in logs:
        log.close()
