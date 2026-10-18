"""Execute all notebook code cells locally; setup installs only inside Colab.

Uses optional plotting packages installed into tmp/colab_qa_runtime. The backend
venv supplies the numerical/NLP dependencies. No production settings are loaded.
"""
import contextlib
import json
import os
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
# Prefer the already-installed backend numerical stack over temporary QA packages.
import numpy
sys.path.append(str(ROOT / 'tmp/colab_qa_runtime'))
os.environ['MPLBACKEND'] = 'Agg'
os.environ['MPLCONFIGDIR'] = str(HERE / 'qa_run/matplotlib_cache')
os.chdir(HERE / 'qa_run')


def display(value):
    print(value.to_string() if hasattr(value, 'to_string') else str(value))


namespace = {'display': display, '__name__': '__main__'}
notebook = json.loads((HERE / 'SkillBridge_NLP_Contribution_Evaluation.ipynb').read_text(encoding='utf-8'))
with (HERE / 'qa_run/execution.log').open('w', encoding='utf-8') as log:
    with contextlib.redirect_stdout(log), contextlib.redirect_stderr(log):
        for i, cell in enumerate(notebook['cells']):
            if cell['cell_type'] == 'code':
                print(f'EXECUTING CELL {i}', flush=True)
                exec(compile(''.join(cell['source']), f'notebook_cell_{i}', 'exec'), namespace)
                log.flush()
assert namespace['final']['status'] == 'not_run'
assert (namespace['WORK'] / 'results/dev/development_comparison.png').exists()
print('All notebook code cells executed; synthetic final test correctly not_run; chart/export created.')
