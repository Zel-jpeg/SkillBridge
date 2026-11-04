"""Saved-definition assistance is advisory, scope-bound and independent of IC seeds."""
from unittest.mock import patch

from rest_framework.test import APITestCase

from .models import (ChangeEvent, CompetencyFramework, Institute, InstructorAssignment,
                     ManagementAction, Program, SkillCategory, User)


class CompetencyAssistanceTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user('assist-owner@example.invalid', role='instructor', is_approved=True)
        self.peer = User.objects.create_user('assist-peer@example.invalid', role='instructor', is_approved=True)
        self.foreign = User.objects.create_user('assist-foreign@example.invalid', role='instructor', is_approved=True)
        self.student = User.objects.create_user('assist-student@example.invalid', role='student', is_approved=True)
        institute = Institute.objects.create(code='ANY', name='Arbitrary Institute')
        self.program = Program.objects.create(institute=institute, code='ANY', name='Any Program')
        self.other = Program.objects.create(institute=institute, code='OTHER', name='Independent Program')
        self.grant = InstructorAssignment.objects.create(instructor=self.owner, program=self.program)
        InstructorAssignment.objects.create(instructor=self.peer, program=self.program)
        InstructorAssignment.objects.create(instructor=self.foreign, program=self.other)
        self.framework = CompetencyFramework.objects.create(program=self.program, version=1, name='Any definitions', created_by=self.owner)
        self.other_framework = CompetencyFramework.objects.create(program=self.other, version=1, name='Same definitions', created_by=self.foreign)
        self.client.force_authenticate(self.owner)
        self.base = f'/api/management/programs/{self.program.id}/frameworks/{self.framework.id}/'

    def category(self, **changes):
        return SkillCategory.objects.create(framework=self.framework, created_by=self.owner,
            **{'name': 'Records knowledge', 'description': 'Recognizes booking records and explains arrival reservations.',
               'tags': ['Booking records', 'Arrival reservations'], **changes})

    def assist(self, query, kind='category', base=None):
        return self.client.post((base or self.base) + f'assist/{kind}/', query, format='json')

    def test_saved_description_matches_without_global_vocabulary_or_mutation(self):
        category = self.category(name='Knowledge area Alpha', tags=[])
        before = (list(SkillCategory.objects.values()), ManagementAction.objects.count(), ChangeEvent.objects.count())
        with patch('api.scoring.suggest_category', side_effect=AssertionError('Global category helper must not run')):
            response = self.assist({'question_text': 'Explain booking records for arrival reservations.'})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'matched')
        self.assertEqual(response.data['suggested_category']['id'], category.id)
        self.assertEqual(response.data['method'], 'saved-framework-tfidf-v1')
        self.assertEqual(response.data['framework_id'], self.framework.id)
        self.assertEqual(len(response.data['framework_digest']), 64)
        self.assertEqual(before, (list(SkillCategory.objects.values()), ManagementAction.objects.count(), ChangeEvent.objects.count()))

    def test_unknown_and_single_incidental_word_abstain(self):
        self.category()
        for query in ['Quantum wavefunction spectroscopy', 'Explain the records of quantum spectroscopy']:
            result = self.assist({'question_text': query}).data
            self.assertEqual(result['status'], 'no_match')
            self.assertIsNone(result['suggested_category'])

    def test_ambiguous_definitions_offer_choices_without_picking_or_inventing_tags(self):
        self.category(name='Alpha')
        self.category(name='Beta')
        query = 'Explain booking records for arrival reservations.'
        result = self.assist({'question_text': query}).data
        self.assertEqual(result['status'], 'ambiguous')
        self.assertIsNone(result['suggested_category'])
        self.assertEqual(len(result['candidates']), 2)
        tags = self.assist({'description': query}, 'tags').data
        self.assertEqual((tags['status'], tags['suggested_tags'], tags['source_category']), ('ambiguous', [], None))

    def test_exact_saved_name_tags_take_precedence_and_missing_tags_stay_manual(self):
        category = self.category()
        self.category(name='Completely different', description='Explain food preparation.', tags=['Cooking'])
        result = self.assist({'name': 'records KNOWLEDGE', 'description': 'Explain food preparation.'}, 'tags').data
        self.assertEqual((result['status'], result['source'], result['source_category']['id'], result['suggested_tags']),
                         ('suggestions', 'saved_exact_name', category.id, category.tags))
        category.tags = []; category.save(update_fields=['tags'])
        result = self.assist({'name': category.name}, 'tags').data
        self.assertEqual((result['status'], result['suggested_tags']), ('no_suggestions', []))

    def test_description_based_reuse_only_returns_saved_tags(self):
        category = self.category()
        result = self.assist({'name': 'New category', 'description': category.description}, 'tags').data
        self.assertEqual((result['status'], result['source_category']['id'], result['suggested_tags']),
                         ('suggestions', category.id, category.tags))

    def test_independent_program_and_legacy_categories_cannot_change_results(self):
        self.category()
        first = self.assist({'question_text': 'Explain booking records for arrival reservations.'}).data
        SkillCategory.objects.create(name='Booking', description='Explain booking records for arrival reservations.', tags=['Foreign'])
        SkillCategory.objects.create(framework=self.other_framework, name='Booking',
            description='Explain booking records for arrival reservations.', tags=['Foreign'])
        self.assertEqual(self.assist({'question_text': 'Explain booking records for arrival reservations.'}).data, first)

    def test_empty_catalog_empty_text_and_stopword_catalog_abstain(self):
        self.assertEqual(self.assist({'question_text': 'Anything'}).data['status'], 'empty_catalog')
        self.category(name='The and of', description='the and of', tags=[])
        self.assertEqual(self.assist({'question_text': '  '}).data['status'], 'empty_text')
        self.assertEqual(self.assist({'question_text': 'Anything'}).data['status'], 'no_match')

    def test_missing_optional_library_is_truthful_and_exact_tags_still_work(self):
        self.category()
        original_import = __import__
        def unavailable(name, *args, **kwargs):
            if name.startswith('sklearn'):
                raise ImportError('Synthetic unavailable dependency')
            return original_import(name, *args, **kwargs)
        with patch('builtins.__import__', side_effect=unavailable):
            self.assertEqual(self.assist({'question_text': 'Booking records'}).data['status'], 'unavailable')
            self.assertEqual(self.assist({'name': 'Records knowledge'}, 'tags').data['status'], 'suggestions')

    def test_same_program_peer_can_read_but_foreign_student_revoked_and_mismatched_context_cannot(self):
        self.category()
        for actor, expected in [(self.peer, 200), (self.foreign, 404), (self.student, 403)]:
            self.client.force_authenticate(actor)
            for kind, query in [('category', {'question_text': 'Booking records'}), ('tags', {'name': 'Records knowledge'})]:
                self.assertEqual(self.assist(query, kind).status_code, expected)
        self.client.force_authenticate(self.owner)
        wrong = self.base.replace(f'/frameworks/{self.framework.id}/', f'/frameworks/{self.other_framework.id}/')
        self.assertEqual(self.assist({'question_text': 'Booking records'}, base=wrong).status_code, 404)
        self.grant.is_active = False; self.grant.save(update_fields=['is_active'])
        self.assertEqual(self.assist({'question_text': 'Booking records'}).status_code, 404)

    def test_request_types_bounds_and_unsupported_fields(self):
        for query in [{}, {'question_text': []}, {'question_text': True}, {'question_text': 'x' * 4001},
                      {'question_text': 'Booking records', 'program_id': self.other.id}]:
            self.assertEqual(self.assist(query).status_code, 400, query)
        for query in [{'name': []}, {'name': 'x' * 101}, {'description': 'x' * 2001}, {'tags': ['Override']}]:
            self.assertEqual(self.assist(query, 'tags').status_code, 400)
