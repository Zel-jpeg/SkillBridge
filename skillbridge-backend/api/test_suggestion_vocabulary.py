"""Broader authoring vocabulary; no invented duties, saved evidence or mastery."""
from copy import deepcopy
from types import SimpleNamespace as Obj

from django.db import connection
from django.test import SimpleTestCase
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from rest_framework.test import APITestCase

from .models import Company, Position, SkillCategory, User
from .recommendation_nlp import (build_position_description, build_student_profile,
                                 suggest_position_tags, suggest_skill_tags)
from .scoring import suggest_category
from .skill_taxonomy import (ALIASES, ROLE_ALIASES, ROLE_TAGS, SKILL_TAGS,
                             SUGGESTION_CATEGORY_ALIASES, canonical_category,
                             suggestion_category)


class SuggestionVocabularyTests(SimpleTestCase):
    def test_creative_and_office_categories_have_distinct_vocabulary(self):
        examples = [('Video Editing', 'timeline editing'), ('Photo Editing', 'retouching'),
                    ('Photography', 'shutter speed'), ('Videography', 'video capture'),
                    ('Graphic Design', 'typography'), ('Audio Editing', 'noise reduction'),
                    ('Motion Graphics', 'keyframes'), ('Multimedia', 'storyboarding'),
                    ('Accounting', 'journal entries'), ('Bookkeeping', 'debits and credits'),
                    ('Excel', 'pivot tables'), ('Data Encoding', 'duplicate checking'),
                    ('Document Management', 'document indexing'), ('Office Applications', 'word processing'),
                    ('Inventory Control', 'stock counts'), ('Technical Writing', 'user guides')]
        for name, term in examples:
            with self.subTest(name=name):
                self.assertIn(term, suggest_skill_tags(name))
        self.assertNotIn('timeline editing', suggest_skill_tags('Photography'))
        self.assertNotIn('React', suggest_skill_tags('Photo Editing'))

    def test_role_aliases_and_compound_titles(self):
        examples = [('Video Editing Intern', 'timeline editing'), ('Photo Retoucher Intern', 'retouching'),
                    ('Photography Assistant', 'aperture'), ('Videography Intern', 'audio capture'),
                    ('Layout Artist', 'typography'), ('Accounting Intern', 'invoice verification'),
                    ('Bookkeeper Intern', 'ledger entries'), ('Records Clerk', 'filing'),
                    ('Help Desk Technician', 'ticket handling'), ('Network Support Intern', 'subnetting'),
                    ('System Administration Intern', 'patch management'),
                    ('Data Analyst Intern', 'data cleaning'), ('Mobile App Developer Intern', 'device testing')]
        for name, term in examples:
            with self.subTest(name=name):
                self.assertIn(term, suggest_position_tags(name))
        both = suggest_position_tags('Video & Photo Editor Intern')
        self.assertIn('timeline editing', both)
        self.assertIn('retouching', both)
        lgu = suggest_position_tags('LGU Database Encoder & Administrator')
        self.assertIn('SQL optimization', lgu)
        self.assertIn('record encoding', lgu)

    def test_ambiguous_and_substring_titles_do_not_invent_specializations(self):
        for title in ['Editor Intern', 'Assistant Intern', 'Encoder Intern', 'Video Encoder',
                      'Exhibit Support Intern', 'Video Editorial Assistant', 'Astrophysics Intern', '']:
            with self.subTest(title=title):
                self.assertEqual(suggest_position_tags(title), [])
        requirements = [{'name': 'Video Editing', 'percentage': 80, 'tags': []},
                        {'name': 'Cloud', 'percentage': 0, 'tags': ['AWS']}]
        self.assertIn('timeline editing', suggest_position_tags('Unmapped Role', requirements))
        self.assertNotIn('AWS', suggest_position_tags('Unmapped Role', requirements))

    def test_suggestion_aliases_do_not_change_matching_text_normalization(self):
        self.assertNotIn('photo editing', ALIASES)
        self.assertEqual(canonical_category('Photo Editing'), 'photo editing')
        self.assertEqual(suggestion_category('Photo Editing'), 'image editing')
        category = Obj(name='Photo Editing', tags=['Saved custom vocabulary'])
        scores = [Obj(skill_category=category, percentage=80)]
        text = build_student_profile(scores)
        self.assertIn('photo editing', text)
        self.assertIn('Saved custom vocabulary', text)
        self.assertNotIn('retouching', text)
        self.assertNotIn('mastered', text)
        zero = build_student_profile([Obj(skill_category=category, percentage=0)])
        self.assertNotIn('Saved custom vocabulary', zero)
        position = Obj(title='Photo Editor', company=Obj(name='Synthetic Company'), tags=['Saved custom tag'],
                       requirements=Obj(all=lambda: [Obj(skill_category=category, required_percentage=70)]))
        self.assertIn('Saved custom tag', build_position_description(position))
        self.assertNotIn('retouching', build_position_description(position))

    def test_catalog_limits_unique_tags_and_alias_targets(self):
        for alias, target in SUGGESTION_CATEGORY_ALIASES.items():
            self.assertIn(target, SKILL_TAGS, alias)
        self.assertEqual(set(ROLE_ALIASES), set(ROLE_TAGS))
        before = deepcopy((SKILL_TAGS, ROLE_TAGS))
        for role, aliases in ROLE_ALIASES.items():
            for title in [role, *aliases]:
                tags = suggest_position_tags(title)
                self.assertTrue(tags, title)
                self.assertLessEqual(len(tags), 16)
                self.assertEqual(len(tags), len({tag.casefold() for tag in tags}))
        suggest_position_tags('Network Support / Help Desk Intern')
        self.assertEqual(before, (SKILL_TAGS, ROLE_TAGS))

    def test_question_suggestions_use_existing_categories_only(self):
        categories = [Obj(name=name, description='') for name in
                      ['Video Editing', 'Photo Editing', 'Photography', 'Accounting', 'Data Entry']]
        for question, expected in [
            ('How do timeline transitions and captions affect the sequence?', 'Video Editing'),
            ('When should layers and masks be used for retouching?', 'Photo Editing'),
            ('How do aperture and shutter speed affect exposure?', 'Photography'),
            ('How are journal entries posted to a general ledger?', 'Accounting'),
            ('Why does record encoding require duplicate checking?', 'Data Entry'),
        ]:
            with self.subTest(question=question):
                self.assertEqual(suggest_category(question, categories), expected)
        self.assertIsNone(suggest_category('Compare Video Editing and Photo Editing', categories))
        self.assertIsNone(suggest_category('Which orbit does a comet follow?', categories))
        self.assertIsNone(suggest_category('timeline captions retouching', []))


class SuggestionVocabularyAPITests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user('vocab-admin@example.com', role='admin')
        self.instructor = User.objects.create_user('vocab-instructor@example.com', role='instructor')
        self.student = User.objects.create_user('vocab-student@example.com', role='student')
        self.category = SkillCategory.objects.create(name='Video Editing', created_by=self.admin, tags=['Saved original tag'])
        company = Company.objects.create(name='Synthetic Vocabulary Company')
        self.position = Position.objects.create(company=company, title='Video Editor Intern', tags=['Saved original position tag'])
        self.client.force_authenticate(self.admin)

    def test_requests_are_read_only_and_do_not_replace_saved_tags(self):
        with CaptureQueriesContext(connection) as queries:
            skill = self.client.post(reverse('suggest_tags'), {'type': 'skill', 'name': 'Photo Editing'}, format='json')
            position = self.client.post(reverse('suggest_tags'), {'type': 'position', 'title': self.position.title,
                'requirements': {self.category.name: 80}}, format='json')
            category = self.client.post(reverse('suggest_category'), {'question_text': 'How do timeline transitions work?'}, format='json')
        self.assertEqual(skill.status_code, 200)
        self.assertIn('retouching', skill.data['suggested_tags'])
        self.assertEqual(position.status_code, 200)
        self.assertIn('timeline editing', position.data['suggested_tags'])
        self.assertEqual(category.data['suggested_category'], 'Video Editing')
        for query in queries:
            self.assertFalse(query['sql'].lstrip().upper().startswith(('INSERT', 'UPDATE', 'DELETE')))
        self.category.refresh_from_db()
        self.position.refresh_from_db()
        self.assertEqual(self.category.tags, ['Saved original tag'])
        self.assertEqual(self.position.tags, ['Saved original position tag'])

    def test_permissions_unchanged_and_staff_can_use_new_terms(self):
        for user, expected in [(None, 401), (self.student, 403), (self.instructor, 200), (self.admin, 200)]:
            self.client.force_authenticate(user)
            for name, payload in [('suggest_tags', {'type': 'skill', 'name': 'Video Editing'}),
                                  ('suggest_category', {'question_text': 'timeline transitions'})]:
                with self.subTest(user=getattr(user, 'role', None), route=name):
                    self.assertEqual(self.client.post(reverse(name), payload, format='json').status_code, expected)
