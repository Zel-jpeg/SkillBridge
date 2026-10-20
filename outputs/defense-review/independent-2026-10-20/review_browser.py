"""Run existing synthetic browser checks sequentially; all remote calls blocked."""
from pathlib import Path
import os
import runpy
import subprocess
import sys
import time
from urllib.request import urlopen

root = Path(__file__).resolve().parents[3]
node = Path(r'C:/Users/acer/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe')
log = root / 'tmp/pdfs/review_2026_10_20/vite.log'
os.environ['VITE_API_URL'] = 'http://127.0.0.1:8018'
with log.open('w', encoding='utf-8') as output:
    server = subprocess.Popen([str(node), 'node_modules/vite/bin/vite.js', '--host',
        '127.0.0.1', '--port', '5178', '--strictPort'], cwd=root / 'skillbridge-frontend',
        stdout=output, stderr=subprocess.STDOUT,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    try:
        for _ in range(100):
            if server.poll() is not None:
                raise RuntimeError('Vite failed; inspect vite.log')
            try:
                with urlopen('http://127.0.0.1:5178/', timeout=1) as response:
                    if response.status == 200:
                        break
            except OSError:
                time.sleep(.2)
        else:
            raise RuntimeError('Vite did not become ready')
        filenames = sys.argv[1:] or ['recommendation_contract_playwright.py', 'nlp_previews_playwright.py']
        for filename in filenames:
            print('RUN', filename, flush=True)
            runpy.run_path(str(root / 'skillbridge-frontend' / 'tests' / filename), run_name='__main__')
    finally:
        server.terminate()
        try:
            server.wait(timeout=10)
        except subprocess.TimeoutExpired:
            server.kill()
            server.wait(timeout=5)
