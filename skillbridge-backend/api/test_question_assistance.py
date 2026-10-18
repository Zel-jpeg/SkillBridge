"""Suggestion contracts: advisory only, safe manual correction, no mastery claims."""
from types import SimpleNamespace as Obj
from unittest.mock import patch
from django.test import SimpleTestCase
from django.urls import reverse
from rest_framework.test import APITestCase
from .models import Assessment, Batch, Question, SkillCategory, User
from .recommendation_nlp import build_student_profile, generate_competency_insights
from .scoring import suggest_category


class AssistanceTextTests(SimpleTestCase):
    def test_clear_unfamiliar_and_missing_taxonomy(self):
        cats = [Obj(name='Database', description=''), Obj(name='Networking', description='')]
        self.assertEqual(suggest_category('Which SQL query joins tables by primary key?', cats), 'Database')
        self.assertIsNone(suggest_category('How does a violin produce vibrato?', cats))
        self.assertIsNone(suggest_category('SQL query', []))

    def test_multiple_explicit_names_and_equal_similarity_abstain(self):
        cats = [Obj(name='Database', description=''), Obj(name='Networking', description='')]
        for ordered in [cats, cats[::-1]]:
            self.assertIsNone(suggest_category('Compare Database and Networking', ordered))
        duplicated = [Obj(name='Alpha', description='synthetic shared token'), Obj(name='Beta', description='synthetic shared token')]
        self.assertIsNone(suggest_category('synthetic shared token', duplicated))
        # A substring inside an unrelated word is not an exact category mention.
        self.assertIsNone(suggest_category('Use a wireless network', [Obj(name='Net', description='')]))

    def test_zero_scores_do_not_describe_a_demonstrated_orientation(self):
        rows = [Obj(skill_category=Obj(name='Programming', tags=['Python']), percentage=0)]
        insight = generate_competency_insights(rows)
        self.assertEqual(insight['orientation_label'], '')
        self.assertIn('No assessed category scored above zero', insight['orientation_summary'])
        self.assertNotIn('student demonstrates', build_student_profile(rows))
        self.assertNotIn('Python', build_student_profile(rows))

    def test_all_tied_leaders_are_retained_and_vocabulary_is_qualified(self):
        rows = [Obj(skill_category=Obj(name=name, tags=['Synthetic vocabulary']), percentage=80.0)
                for name in ['Programming', 'Networking', 'Database']]
        insight = generate_competency_insights(rows)
        for name in ['Programming', 'Networking', 'Database']:
            self.assertIn(name + ' (80.0%)', insight['orientation_summary'])
        self.assertIn('not separately assessed', insight['competency_profile_text'])
        self.assertNotIn('mastered', insight['competency_profile_text'])


class AssistanceAPITests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email='assist-owner@example.com', role='instructor')
        self.other = User.objects.create_user(email='assist-other@example.com', role='instructor')
        self.student = User.objects.create_user(email='assist-student@example.com', role='student')
        self.admin = User.objects.create_user(email='assist-admin@example.com', role='admin')
        self.category = SkillCategory.objects.create(name='Database', created_by=self.other)
        self.batch = Batch.objects.create(name='Assistance fixture', instructor=self.owner)
        self.assessment = Assessment.objects.create(title='Draft', batch=self.batch, created_by=self.owner, publication_status='draft')
        self.question = Question.objects.create(assessment=self.assessment, question_text='Synthetic question', skill_category=self.category)
        self.url = reverse('suggest_category')

    def test_suggestions_are_staff_only(self):
        for user, expected in [(None, 401), (self.student, 403), (self.owner, 200), (self.admin, 200)]:
            self.client.force_authenticate(user)
            self.assertEqual(self.client.post(self.url, {'question_text': 'SQL primary key query'}, format='json').status_code, expected)

    def test_malformed_text_is_field_error_not_server_error(self):
        self.client.force_authenticate(self.owner)
        for value in [None, 12, [], {}]:
            with self.subTest(value=value):
                response = self.client.post(self.url, {'question_text': value}, format='json')
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.data['field'], 'question_text')
        self.assertEqual(self.client.post(self.url, {'question_text': ''}, format='json').data['suggested_category'], None)

    def test_malformed_tag_requests_have_validation_errors(self):
        self.client.force_authenticate(self.admin)
        for payload in [{'type': 'skill', 'name': []}, {'type': 'skill', 'description': {}},
                        {'type': 'position', 'title': None}, {'type': 'position', 'requirements': []},
                        {'type': 'position', 'requirements': {'Unknown': 70}},
                        {'type': 'position', 'requirements': {'Database': 'NaN'}}]:
            with self.subTest(payload=payload):
                self.assertEqual(self.client.post(reverse('suggest_tags'), payload, format='json').status_code, 400)

    def test_failure_abstains_and_manual_shared_category_correction_still_saves(self):
        self.client.force_authenticate(self.owner)
        with patch('sklearn.feature_extraction.text.TfidfVectorizer.fit_transform', side_effect=RuntimeError('synthetic unavailable')):
            response = self.client.post(self.url, {'question_text': 'SQL primary key query'}, format='json')
        self.assertIsNone(response.data['suggested_category'])
        category_count = SkillCategory.objects.count()
        corrected = self.client.patch(reverse('instructor_question_detail', args=[self.question.id]),
                                      {'category': 'Database', 'question_text': 'Manually corrected question'}, format='json')
        self.assertEqual(corrected.status_code, 200)
        self.question.refresh_from_db()
        self.category.refresh_from_db()
        self.assertEqual(self.question.skill_category_id, self.category.id)
        self.assertEqual(self.category.created_by, self.other)  # Shared taxonomy, attribution preserved.
        self.assertEqual(SkillCategory.objects.count(), category_count)

    def test_invalid_or_ambiguous_category_does_not_mutate_question(self):
        self.client.force_authenticate(self.owner)
        SkillCategory.objects.create(name='DATABASE', created_by=self.owner)
        for category in [[], {}, 17, None, 'x' * 101, 'Database']:
            with self.subTest(category=category):
                result = self.client.patch(reverse('instructor_question_detail', args=[self.question.id]),
                                           {'category': category, 'question_text': 'Must not save'}, format='json')
                self.assertEqual(result.status_code, 400)
                self.question.refresh_from_db()
                self.assertEqual(self.question.question_text, 'Synthetic question')
    def test_foreign_question_cannot_be_reclassified_or_create_taxonomy(self):
        category_count = SkillCategory.objects.count()
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.patch(reverse('instructor_question_detail', args=[self.question.id]),
                                          {'category': 'New category'}, format='json').status_code, 404)
        self.assertEqual(SkillCategory.objects.count(), category_count)
