"""Position-specific advice must not turn generic Tools into required products."""
from copy import deepcopy
from django.db import connection
from django.test import SimpleTestCase
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from rest_framework.test import APITestCase

from .models import Company, Position, SkillCategory, User
from .recommendation_nlp import suggest_position_tags, suggest_skill_tags


class PositionTagRelevanceTests(SimpleTestCase):
    def test_screenshot_network_specialist_uses_network_role_only(self):
        requirements = {'Networking': 75, 'Tools': 75}
        for title in ['IT Network Specialist Intern', 'Network Engineer Intern',
                      'Network Technician', 'Network Support Intern']:
            with self.subTest(title=title):
                tags = suggest_position_tags(title, requirements)
                self.assertIn('routing', tags)
                self.assertIn('network monitoring', tags)
                self.assertIn('LAN troubleshooting', tags)
                self.assertFalse({'Postman', 'Figma', 'VS Code', 'Jira', 'HTML', 'React'} & set(tags))

    def test_unknown_role_skips_tools_even_with_saved_products_or_alias(self):
        for name in ['Tools', 'Development Tools', 'Software Tools', 'Developer Tools']:
            requirements = [{'name': name, 'percentage': 95, 'tags': ['Postman', 'Figma']},
                            {'name': 'Networking', 'percentage': 75, 'tags': []}]
            tags = suggest_position_tags('Unmapped Specialist Intern', requirements)
            self.assertEqual(tags, ['TCP/IP', 'routing', 'switching', 'subnetting'])
        self.assertEqual(suggest_position_tags('Unmapped Intern', {'Tools': 75}), [])
        self.assertEqual(suggest_position_tags('Unmapped Intern'), [])

    def test_tools_does_not_use_up_specific_requirement_limit(self):
        tags = suggest_position_tags('Unmapped Intern', {'Tools': 95, 'Networking': 75, 'Database': 60})
        self.assertIn('TCP/IP', tags)
        self.assertIn('SQL', tags)
        self.assertNotIn('Postman', tags)
        self.assertNotIn('Figma', tags)

    def test_role_phrase_boundaries_and_zero_evidence(self):
        self.assertEqual(suggest_position_tags('Exhibit Support Intern'), [])
        self.assertEqual(suggest_position_tags('Network Specialists Intern'), [])
        self.assertEqual(suggest_position_tags('Unknown Intern', {'Tools': 90, 'Networking': 0}), [])
        self.assertIn('React components', suggest_position_tags('Front-end Developer Intern'))
        self.assertIn('test cases', suggest_position_tags('Quality Assurance Tester Intern'))
        mixed = suggest_position_tags('Network Specialist / Frontend Developer Intern')
        self.assertIn('React components', mixed)
        self.assertIn('routing', mixed)

    def test_category_tools_vocabulary_and_source_inputs_are_preserved(self):
        self.assertIn('Postman', suggest_skill_tags('Tools'))
        requirements = [{'name': 'Tools', 'percentage': 75, 'tags': ['Figma']},
                        {'name': 'Networking', 'percentage': 75, 'tags': ['Saved network term']}]
        original = deepcopy(requirements)
        self.assertEqual(suggest_position_tags('Unmapped Intern', requirements), ['Saved network term'])
        self.assertEqual(requirements, original)


class PositionTagRelevanceAPITests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user('tag-admin@example.com', role='admin')
        self.instructor = User.objects.create_user('tag-instructor@example.com', role='instructor')
        self.student = User.objects.create_user('tag-student@example.com', role='student')
        SkillCategory.objects.create(name='Networking', created_by=self.admin)
        SkillCategory.objects.create(name='Tools', tags=['VS Code', 'Postman', 'Figma', 'Jira'], created_by=self.admin)
        company = Company.objects.create(name='Synthetic Network Company')
        self.position = Position.objects.create(company=company, title='IT Network Specialist Intern', tags=['Saved custom tool'])
        self.payload = {'type': 'position', 'title': self.position.title, 'requirements': {'Networking': 75, 'Tools': 75}}

    def test_real_endpoint_is_read_only_preserves_custom_tags_and_permissions(self):
        for actor, status in [(None, 401), (self.student, 403), (self.admin, 200), (self.instructor, 200)]:
            self.client.force_authenticate(actor)
            with CaptureQueriesContext(connection) as queries:
                response = self.client.post(reverse('suggest_tags'), self.payload, format='json')
            self.assertEqual(response.status_code, status)
            if status == 200:
                self.assertIn('network monitoring', response.data['suggested_tags'])
                self.assertNotIn('Postman', response.data['suggested_tags'])
                self.assertNotIn('Figma', response.data['suggested_tags'])
            self.assertFalse(any(q['sql'].lstrip().upper().startswith(('INSERT', 'UPDATE', 'DELETE')) for q in queries))
        self.position.refresh_from_db()
        self.assertEqual(self.position.tags, ['Saved custom tool'])

    def test_requirements_remain_validated_and_unknown_titles_are_conservative(self):
        self.client.force_authenticate(self.admin)
        unknown = {**self.payload, 'title': 'Unmapped Intern'}
        response = self.client.post(reverse('suggest_tags'), unknown, format='json')
        self.assertEqual(response.data['suggested_tags'], ['TCP/IP', 'routing', 'switching', 'subnetting'])
        bad = {**unknown, 'requirements': {'Unregistered Category': 75}}
        self.assertEqual(self.client.post(reverse('suggest_tags'), bad, format='json').status_code, 400)
