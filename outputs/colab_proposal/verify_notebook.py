"""Execute every notebook code cell offline, using workspace-only QA display deps."""
import contextlib
import json
import os
from pathlib import Path
import sys
import numpy

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
sys.path.append(str(ROOT/'tmp/colab_qa_runtime'))
os.environ['MPLBACKEND']='Agg'
qa=HERE/'qa_run'
qa.mkdir(exist_ok=True)
os.environ['MPLCONFIGDIR']=str(qa/'matplotlib_cache')
os.chdir(qa)
def display(value):
    print(value.to_string() if hasattr(value,'to_string') else str(value))
namespace={'display':display,'__name__':'__main__'}
notebook=json.loads((HERE/'SkillBridge_Proposed_Features_Comparison.ipynb').read_text(encoding='utf-8'))
with (qa/'execution.log').open('w',encoding='utf-8') as log:
    with contextlib.redirect_stdout(log),contextlib.redirect_stderr(log):
        for i,c in enumerate(notebook['cells']):
            if c['cell_type']=='code':
                print('EXECUTING CELL',i,flush=True)
                exec(compile(''.join(c['source']),f'proposal_cell_{i}','exec'),namespace)
                log.flush()
assert namespace['final']['status']=='not_run'
assert len(namespace['report']['results'])==10
assert (namespace['WORK']/'results/development/proposal_comparison.png').exists()
print('All 9 code cells executed; ten configurations compared; simulation final test correctly not_run.')
