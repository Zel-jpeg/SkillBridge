"""Owned production-bundle + synthetic SQLite advanced-tools browser check.

Run after npm run build with the backend venv's Python. All API writes stay in
the disposable database under work/; no configured school database is used.
"""
import argparse
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tempfile
import time


def free_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--ui-only', action='store_true', help='Skip actual model execution; do not use for final acceptance.')
    mode.add_argument('--local-comparison', action='store_true', help='Run the usual Vite and Django development flow without a worker.')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    out = Path(tempfile.mkdtemp(prefix='advanced-tools-browser-', dir=root / 'work'))
    api_port, frontend_port = free_port(), free_port()
    env = {**os.environ, 'PYTHON_DOTENV_DISABLED': '1', 'PYTHONIOENCODING': 'utf-8',
           'SB_ORGANIZATION_RUN': str(out), 'SB_ORGANIZATION_SCENARIO': 'staff-scope',
           'SB_ORGANIZATION_API_PORT': str(api_port), 'SB_ORGANIZATION_FRONTEND_PORT': str(frontend_port),
           'SB_ADVANCED_UI_ONLY': '1' if args.ui_only else '0',
           'SB_NLP_LOCAL_DEV': '1' if args.local_comparison else '0',
           'VITE_API_URL': 'http://127.0.0.1:8000'}
    # Sandboxed Windows shells have a different LOCALAPPDATA from the user's
    # installed Stanza resource cache. Set only this owned test process's path.
    normal_cache = Path.home() / 'AppData/Local/StanfordNLP/stanza/Cache/1.14.0/resources'
    if not env.get('STANZA_RESOURCES_DIR') and (normal_cache / 'resources.json').is_file():
        env['STANZA_RESOURCES_DIR'] = str(normal_cache)
    frontend_args = [str(root / 'skillbridge-frontend')]
    if not args.local_comparison:
        shutil.copytree(root / 'skillbridge-frontend/dist', out / 'bundle')
        frontend_args = ['preview', *frontend_args, '--outDir', str(out / 'bundle')]
    commands = [
        ([sys.executable, '-u', str(root / 'skillbridge-frontend/tests/organization_server.py')], api_port),
        ([shutil.which('node'), str(root / 'skillbridge-frontend/node_modules/vite/bin/vite.js'), *frontend_args, '--host', '127.0.0.1',
          '--port', str(frontend_port), '--strictPort'], frontend_port),
    ]
    processes, logs = [], []
    print('Evidence:', out, flush=True)
    flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
    try:
        for command, port in commands:
            log = (out / f'server-{port}.log').open('w', encoding='utf-8')
            logs.append(log)
            process = subprocess.Popen(command, cwd=root, env=env, stdout=log, stderr=subprocess.STDOUT, creationflags=flags)
            processes.append(process)
            end = time.monotonic() + 90
            while time.monotonic() < end:
                if process.poll() is not None:
                    raise RuntimeError(f'Owned server exited; inspect server-{port}.log')
                with socket.socket() as sock:
                    outcome = sock.connect_ex(('127.0.0.1', port))
                    if outcome == 0:
                        break
                    if outcome in (13, 10013):
                        raise PermissionError('The sandbox denied localhost socket access; rerun this isolated harness with localhost permission.')
                time.sleep(.2)
            else:
                raise RuntimeError('Owned server did not become ready')
        if not args.ui_only and not args.local_comparison:
            worker_log = (out / 'comparison-worker.log').open('w', encoding='utf-8')
            logs.append(worker_log)
            worker_env = {**env, 'DJANGO_SETTINGS_MODULE': 'core.test_settings',
                          'SECRET_KEY': 'synthetic-comparison-worker-test-key',
                          'SB_TEST_SQLITE_PATH': str(out / 'synthetic-browser.sqlite3')}
            worker = subprocess.Popen(
                [sys.executable, '-u', str(root / 'skillbridge-backend/manage.py'), 'process_nlp_comparisons'],
                cwd=root, env=worker_env, stdout=worker_log, stderr=subprocess.STDOUT, creationflags=flags,
            )
            processes.append(worker)
            end = time.monotonic() + 45
            while 'NLP comparison worker ready.' not in (out / 'comparison-worker.log').read_text(encoding='utf-8'):
                if worker.poll() is not None or time.monotonic() >= end:
                    raise RuntimeError('Owned comparison worker did not start; inspect comparison-worker.log')
                time.sleep(.2)
        with (out / 'browser.txt').open('w', encoding='utf-8') as log:
            result = subprocess.run([sys.executable, '-u', str(root / 'skillbridge-frontend/tests/advanced_tools_playwright.py')],
                                    cwd=root, env=env, stdout=log, stderr=subprocess.STDOUT, creationflags=flags, timeout=1200)
        print((out / 'browser.txt').read_text(encoding='utf-8')[-10000:])
        return result.returncode
    finally:
        for process in processes:
            if process.poll() is None:
                if os.name == 'nt':
                    subprocess.run(['taskkill.exe', '/PID', str(process.pid), '/T', '/F'], stdout=subprocess.DEVNULL,
                                   stderr=subprocess.DEVNULL, creationflags=flags)
                else:
                    process.terminate()
                process.wait(timeout=15)
        for log in logs:
            log.close()


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    raise SystemExit(main())
