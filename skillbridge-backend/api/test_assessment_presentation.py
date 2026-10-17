"""Cross-language presentation contract, without database or NLP writes."""
import json
from decimal import Decimal
from pathlib import Path
from django.test import SimpleTestCase
from .assessment_presentation import assessment_summary, category_percentage


class AssessmentPresentationTests(SimpleTestCase):
    def test_shared_frontend_export_fixtures(self):
        fixtures = Path(__file__).resolve().parents[2] / 'knowledge/fixtures/assessment_summaries.json'
        for fixture in json.loads(fixtures.read_text(encoding='utf-8'), parse_float=Decimal):
            with self.subTest(fixture['name']):
                result = assessment_summary(fixture['scores'], **fixture.get('options', {}))
                self.assertEqual(result, fixture['expected'])
                self.assertNotRegex(result['summary'] + result['highestLabel'], r'\u2014|\u00a0|&#xA0;|&nbsp;')

    def test_precision_and_missing_scores(self):
        self.assertEqual(category_percentage(83.33), '83.33%')
        self.assertEqual(category_percentage('83.34'), '83.34%')
        for value in (None, '', ' ', False, float('nan'), float('inf'), 'bad'):
            self.assertEqual(category_percentage(value), 'Not available')
