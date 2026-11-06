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
       'SB_ORGANIZATION_API_PORT': str(api_port), 'SB_ORGANIZATION_FRONTEND_PORT': str(frontend_port),
       'SKILLBRIDGE_TEST_BASE': f'http://127.0.0.1:{frontend_port}',
       'TOAST_TEST_BASE': f'http://127.0.0.1:{frontend_port}'}
if '--program-batches' in sys.argv or '--dynamic-profiles' in sys.argv:
    env['SB_ORGANIZATION_SCENARIO'] = 'program-batches'
if '--general-text' in sys.argv:
    env['SB_ORGANIZATION_SCENARIO'] = 'general-text'
if '--scoped-ranking' in sys.argv:
    env['SB_ORGANIZATION_SCENARIO'] = 'scoped-ranking'
if '--legacy-organization' in sys.argv:
    env['SB_ORGANIZATION_SCENARIO'] = 'legacy-organization'
if '--multi-institute-acceptance' in sys.argv:
    env['SB_ORGANIZATION_SCENARIO'] = 'multi-institute-acceptance'
if '--coordinator-catalog' in sys.argv:
    env['SB_ORGANIZATION_SCENARIO'] = 'coordinator-catalog'
if '--staff-scope' in sys.argv:
    env['SB_ORGANIZATION_SCENARIO'] = 'staff-scope'
if '--admin-navigation' in sys.argv:
    env['SB_ORGANIZATION_SCENARIO'] = 'staff-scope'
    env['SB_ADMIN_SCOPE_NAVIGATION'] = '1'
if '--management-dialogs' in sys.argv:
    env['SB_ORGANIZATION_SCENARIO'] = 'management-dialogs'
frontend_mode = [] if '--external-recovery' in sys.argv else ['preview']
if frontend_mode:
    # A concurrent workspace build must not replace this run's hashed assets.
    shutil.copytree(ROOT / 'skillbridge-frontend/dist', OUT / 'bundle')
    frontend_mode.extend(['--outDir', str(OUT / 'bundle')])
commands = [([sys.executable, '-u', str(ROOT / 'skillbridge-frontend/tests/organization_server.py')], api_port),
    ([shutil.which('node'), str(ROOT / 'skillbridge-frontend/node_modules/vite/bin/vite.js'), *frontend_mode, str(ROOT / 'skillbridge-frontend'),
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
        if '--program-batches' in sys.argv:
            script = 'program_batches_playwright.py'
        if '--dynamic-profiles' in sys.argv:
            script = 'dynamic_profiles_playwright.py'
        if '--competencies' in sys.argv:
            script = 'competencies_playwright.py'
        if '--competency-assistance' in sys.argv:
            script = 'competency_assistance_playwright.py'
        if '--skill-editor' in sys.argv:
            script = 'skill_editor_playwright.py'
        if '--management-dialogs' in sys.argv:
            script = 'program_management_dialogs_playwright.py'
        if '--framework-authoring' in sys.argv:
            script = 'framework_authoring_playwright.py'
        if '--general-text' in sys.argv:
            script = 'general_competency_playwright.py'
        for option, candidate in [('--profile-layout', 'student_profile_layout_playwright.py'),
            ('--opportunity-scope', 'opportunity_scope_playwright.py'),
            ('--scoped-ranking', 'scoped_ranking_playwright.py'),
            ('--aiken-import', 'aiken_import_playwright.py'),
            ('--questionnaire-export', 'questionnaire_export_playwright.py'),
            ('--derived-scope', 'derived_scope_playwright.py'),
            ('--legacy-organization', 'legacy_organization_playwright.py'),
            ('--multi-institute-acceptance', 'multi_institute_acceptance_playwright.py'),
            ('--coordinator-catalog', 'coordinator_catalog_playwright.py'),
            ('--staff-scope', 'staff_scope_playwright.py'),
            ('--admin-navigation', 'admin_scope_navigation_playwright.py'),
            ('--position-dialog', 'position_dialog_playwright.py'),
            ('--numeric-import', 'assessment_numeric_import_playwright.py'),
            ('--authoring-draft', 'authoring_draft_playwright.py'),
            ('--companies', 'company_collection_playwright.py'),
            ('--profile-recovery', 'profile_draft_recovery_playwright.py'), ('--external-recovery', 'external_recovery_playwright.py'),
            ('--assessment-result-navigation', 'student_assessment_result_navigation_playwright.py')]:
            if option in sys.argv:
                script = candidate
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
