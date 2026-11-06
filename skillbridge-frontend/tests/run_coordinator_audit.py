"""Reproducible F19 neighboring workflows; each runner owns and stops its servers."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
from time import monotonic

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(tempfile.mkdtemp(prefix='coordinator-audit-', dir=ROOT / 'work'))
DEFAULTS = ['framework-authoring', 'aiken-import', 'questionnaire-export', 'general-text',
            'scoped-ranking', 'derived-scope', 'program-batches', 'legacy-organization']
selected = sys.argv[1:] or DEFAULTS
if any(item not in DEFAULTS for item in selected):
    raise SystemExit('Choose existing workflow names: ' + ', '.join(DEFAULTS))
print('Audit evidence:', OUT, flush=True)
receipt = []
for workflow in selected:
    print('Checking', workflow, flush=True)
    started = monotonic()
    with (OUT / (workflow + '.txt')).open('w', encoding='utf-8') as log:
        result = subprocess.run([sys.executable, '-u', str(ROOT / 'skillbridge-frontend/tests/run_organization_browser.py'),
                                 '--' + workflow], cwd=ROOT, stdout=log, stderr=subprocess.STDOUT,
                                creationflags=subprocess.CREATE_NO_WINDOW)
    output = (OUT / (workflow + '.txt')).read_text(encoding='utf-8')
    receipt.append({'workflow': workflow, 'returncode': result.returncode, 'seconds': round(monotonic() - started, 2),
                    'checks': [line[5:] for line in output.splitlines() if line.startswith('PASS ')]})
    (OUT / 'receipt.json').write_text(json.dumps(receipt, indent=2), encoding='utf-8')
    print(('PASS' if result.returncode == 0 else 'FAIL'), workflow, receipt[-1]['seconds'], 'seconds', flush=True)
    if result.returncode:
        print(output[-3500:], flush=True)
raise SystemExit(1 if any(row['returncode'] for row in receipt) else 0)
