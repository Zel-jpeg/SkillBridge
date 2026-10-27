"""Database-free contract: on-screen advice covers the existing Python taxonomy.

Run from the frontend: ../skillbridge-backend/venv/Scripts/python.exe
    -m unittest discover -s tests -p test_development_advice_coverage.py
"""
import ast
import json
from pathlib import Path
import unittest

FRONTEND = Path(__file__).resolve().parents[1]
TAXONOMY = ast.parse((FRONTEND.parent / 'skillbridge-backend/api/skill_taxonomy.py').read_text(encoding='utf-8'))
CATALOG = json.loads((FRONTEND / 'src/utils/developmentActivities.json').read_text(encoding='utf-8'))


def taxonomy_constant(name):
    return next(ast.literal_eval(node.value) for node in TAXONOMY.body
                if isinstance(node, ast.Assign)
                and any(isinstance(target, ast.Name) and target.id == name for target in node.targets))


class DevelopmentAdviceCoverageTests(unittest.TestCase):
    def test_every_builtin_category_has_an_activity(self):
        self.assertEqual(set(CATALOG['activities']), set(taxonomy_constant('SKILL_TAGS')))
        for category, activity in CATALOG['activities'].items():
            with self.subTest(category=category):
                self.assertIsInstance(activity, str)
                self.assertTrue(activity.strip())

    def test_all_original_and_suggestion_aliases_are_preserved(self):
        aliases = {**taxonomy_constant('ALIASES'), **taxonomy_constant('SUGGESTION_CATEGORY_ALIASES')}
        self.assertEqual(CATALOG['aliases'], aliases)
        self.assertTrue(set(aliases.values()).issubset(CATALOG['activities']))


if __name__ == '__main__':
    unittest.main()
