"""One-time, offline export: python scripts/prepare_nlp_dataset.py <rich notebook>.

Reads literal tables with AST; never executes notebook cells or installs packages.
Replays the notebook's seeded Bernoulli scoring and selects the first 10 students
from each archetype (60 of 300). No NLP model is involved in label assignment.
"""
import ast
import hashlib
import json
from pathlib import Path
import sys

import numpy as np


def export(path):
    raw = path.read_bytes()
    notebook = json.loads(raw)
    assignments = {}
    for cell in notebook['cells']:
        if cell['cell_type'] != 'code':
            continue
        try:
            tree = ast.parse(''.join(cell['source']))
        except SyntaxError:  # Colab installation cells
            continue
        for node in tree.body:
            if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name):
                assignments[node.targets[0].id] = node.value

    def literal(name, dataframe=False):
        node = assignments[name]
        return ast.literal_eval(node.args[0] if dataframe else node)

    categories = literal('skill_categories', True)
    tags = literal('category_skill_tags')
    for category in categories:
        category['tags'] = tags[category['name']]
    companies = {c['id']: c['name'] for c in literal('companies', True)}
    requirements = literal('requirement_rows')
    positions = literal('positions', True)
    position_tags = literal('position_specific_tags')
    for position in positions:
        position['company'] = companies[position.pop('company_id')]
        position['tags'] = position_tags[position['title']]
        position.pop('slots_available')
        position['requirements'] = {c['name']: next(v for p, cat, v in requirements
            if p == position['id'] and cat == c['id']) for c in categories}
    questions = literal('question_bank')
    rng = np.random.RandomState(42)
    cases, student_id = [], 0
    for node, count in zip(assignments['archetypes'].elts, literal('student_counts')):
        name, expected_title, ranges = [ast.literal_eval(arg) for arg in node.args]
        expected = next(p['id'] for p in positions if p['title'] == expected_title)
        for index in range(count):
            student_id += 1
            targets = {cat: rng.randint(low, high + 1) / 100 for cat, (low, high) in ranges.items()}
            scores = {cat: round(sum(rng.rand() < targets[cat] for _ in items) / len(items) * 100, 2)
                      for cat, items in questions.items()}
            if index < 10:
                cases.append({'id': f'prepared-{student_id:03}', 'archetype': name,
                              'expected_position_id': expected, 'scores': scores})
    data = {'version': 'rich-notebook-representative-v1', 'source_notebook': path.name,
        'source_sha256': hashlib.sha256(raw).hexdigest(), 'seed': 42,
        'description': 'Representative prepared synthetic dataset: 60 cases (10 per archetype), '
        '6 positions and 5 skill categories from the rich NLP notebook design. Uses production neutral '
        'competency text, not notebook-inferred position titles. Results are not exact paper reproduction '
        'or evidence of real-world accuracy.',
        'categories': categories, 'positions': positions, 'cases': cases}
    output = Path(__file__).resolve().parents[1] / 'api/data/nlp_evaluation.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')
    print(f'Exported {len(cases)} cases to {output}')


if __name__ == '__main__':
    export(Path(sys.argv[1]))
