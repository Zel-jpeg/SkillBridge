"""Inventory application sources without reading dependencies or environment files."""
import ast
import hashlib
import json
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[3]
files = []
for folder in ['skillbridge-backend/api', 'skillbridge-backend/core', 'skillbridge-backend/scripts',
               'skillbridge-frontend/src', 'skillbridge-frontend/tests']:
    for p in (root / folder).rglob('*'):
        if p.suffix in ('.py', '.js', '.jsx', '.mjs', '.css', '.html') and p.is_file() and not any(
                x in ('__pycache__', 'artifacts', 'node_modules') or x.startswith('.runtime')
                for x in p.parts):
            files.append(p)
for name in ['skillbridge-backend/manage.py', 'skillbridge-backend/Procfile',
             'skillbridge-backend/requirements.txt', 'skillbridge-backend/requirements-nlp-spacy.txt',
             'skillbridge-frontend/package.json', 'skillbridge-frontend/vite.config.js',
             'skillbridge-frontend/vercel.json', 'skillbridge-frontend/eslint.config.js', '.gitignore']:
    if (root / name).exists():
        files.append(root / name)
rows = []
for p in sorted(set(files)):
    raw = p.read_bytes()
    text = raw.decode('utf-16' if raw.startswith((b'\xff\xfe', b'\xfe\xff')) else 'utf-8-sig')
    relative = p.relative_to(root).as_posix()
    kind = ('migration' if '/migrations/' in relative else 'test or browser fixture'
            if '/tests/' in relative or p.name.startswith('test') or '.test.' in p.name
            else 'application or configuration')
    definitions = []
    if p.suffix == '.py':
        tree = ast.parse(text)
        definitions = [{'line': n.lineno, 'name': n.name, 'type': type(n).__name__}
                       for n in tree.body if isinstance(n, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef))]
    rows.append({'path': relative, 'kind': kind, 'lines': len(text.splitlines()),
                 'sha256': hashlib.sha256(p.read_bytes()).hexdigest(), 'definitions': definitions})
summary = {k: {'files': sum(r['kind'] == k for r in rows),
               'lines': sum(r['lines'] for r in rows if r['kind'] == k)}
           for k in sorted({r['kind'] for r in rows})}
output = {'date': '2026-10-20', 'git_base': 'effb2a8 plus preserved working-tree changes',
          'scope': 'Inventory and Python AST/pattern scan. Manual workflow depth is in REVIEW.md. '
                   'Not line-by-line certification. Excludes dependencies, generated artifacts and environment files.',
          'summary': summary, 'files': rows}
Path(__file__).with_name(sys.argv[1] if len(sys.argv) > 1 else 'source-inventory.json').write_text(json.dumps(output, indent=2) + '\n', encoding='utf-8')
print(json.dumps(summary, indent=2))
print('TOTAL', len(rows), sum(r['lines'] for r in rows))
