"""Saved rankings must match their inputs before visibility or approval."""
from unittest.mock import patch

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from .combined_competency import recalculate_combined
from .recommendation_freshness import input_fingerprint, recommendations_stale
from .models import (Assessment, Batch, BatchEnrollment, Company, OJTPlacement,
                     Position, PositionRequirement, Recommendation, SkillCategory,
                     SkillScore, StudentResponse, User, RecommendationConfiguration)


class RecommendationFreshnessTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user('fresh-admin@example.invalid', role='admin')
        self.owner = User.objects.create_user('fresh-owner@example.invalid', role='instructor', is_approved=True)
        self.student = User.objects.create_user('fresh-student@example.invalid', role='student', is_approved=True)
        self.batch = Batch.objects.create(name='Synthetic freshness batch', instructor=self.owner)
        BatchEnrollment.objects.create(batch=self.batch, student=self.student)
        self.first = SkillCategory.objects.create(name='Programming', tags=['Python'])
        self.second = SkillCategory.objects.create(name='Networking', tags=['routing'])
        assessment = Assessment.objects.create(title='Synthetic required', batch=self.batch, created_by=self.owner)
        StudentResponse.objects.create(student=self.student, assessment=assessment, status='submitted', submitted_at=timezone.now())
        SkillScore.objects.create(student=self.student, assessment=assessment, skill_category=self.first,
                                  raw_score=1, max_score=2, percentage=50)
        self.company = Company.objects.create(name='Synthetic freshness employer')
        self.position = Position.objects.create(company=self.company, title='Synthetic intern', slots_available=2)
        PositionRequirement.objects.create(position=self.position, skill_category=self.first, required_percentage=50)
        self.preprocessor = patch('api.recommendation_nlp.preprocess_texts',
                                  side_effect=lambda texts, model: (['shared synthetic tokens'] * len(texts), model, None))
        self.preprocessor.start()
        self.addCleanup(self.preprocessor.stop)
        self.profile, _, _ = recalculate_combined(self.student, self.batch)
        self.rec = Recommendation.objects.get(student=self.student, position=self.position)

    def test_requirement_edit_locks_saved_result_and_rejects_approval_until_explicit_rerun(self):
        self.client.force_authenticate(self.admin)
        changed = self.client.patch(reverse('admin_position_detail', args=[self.position.id]),
                                    {'requirements': {'Networking': 50}}, format='json')
        self.assertEqual(changed.status_code, 200)
        self.client.force_authenticate(self.student)
        result = self.client.get(reverse('student_combined_results'))
        self.assertTrue(result.data['recommendations_locked'])
        self.assertTrue(result.data['recommendations_stale'])
        self.assertEqual(result.data['recommendations'], [])
        for staff in (self.admin, self.owner):
            self.client.force_authenticate(staff)
            denied = self.client.post(reverse('placement_approve'), {'recommendation_id': self.rec.id}, format='json')
            self.assertEqual(denied.status_code, 409)
        self.assertFalse(OJTPlacement.objects.exists())
        self.client.force_authenticate(self.admin)
        refreshed = self.client.post(reverse('admin_rerun_recommendations'), {}, format='json')
        self.assertEqual(refreshed.status_code, 200)
        self.client.force_authenticate(self.student)
        result = self.client.get(reverse('student_combined_results'))
        self.assertFalse(result.data['recommendations_locked'])
        self.assertFalse(result.data['recommendations_stale'])
        self.assertEqual(result.data['recommendations'][0]['match_score'], 32.5)

    def test_all_matching_catalog_inputs_and_the_candidate_corpus_invalidate_saved_rankings(self):
        def add_candidate():
            other = Position.objects.create(company=self.company, title='Another candidate')
            PositionRequirement.objects.create(position=other, skill_category=self.second, required_percentage=50)

        for label, mutate in [
            ('position title', lambda: Position.objects.filter(pk=self.position.pk).update(title='Changed intern')),
            ('position tags', lambda: Position.objects.filter(pk=self.position.pk).update(tags=['Changed vocabulary'])),
            ('company name', lambda: Company.objects.filter(pk=self.company.pk).update(name='Changed employer')),
            ('company coordinates', lambda: Company.objects.filter(pk=self.company.pk).update(location_lat=7, location_lng=125)),
            ('category tags', lambda: SkillCategory.objects.filter(pk=self.first.pk).update(tags=['Changed category term'])),
            ('category name', lambda: SkillCategory.objects.filter(pk=self.second.pk).update(name='Network operations')),
            ('model', lambda: RecommendationConfiguration.objects.filter(pk=1).update(active_model='spacy_sm')),
            ('new candidate', add_candidate),
            ('deleted candidate', lambda: Position.objects.exclude(pk=self.position.pk).delete()),
            ('empty requirements', lambda: self.position.requirements.all().delete()),
        ]:
            with self.subTest(label=label):
                profile, _, _ = recalculate_combined(self.student, self.batch)
                mutate()
                self.assertTrue(recommendations_stale(profile, self.student))
                self.client.force_authenticate(self.student)
                result = self.client.get(reverse('student_combined_results'))
                self.assertTrue(result.data['recommendations_locked'])
                profile.refresh_from_db()
                self.assertTrue(recommendations_stale(profile, self.student), 'GET must not silently regenerate stale scores')

    def test_capacity_branding_and_authoring_descriptions_do_not_change_matching_provenance(self):
        Position.objects.filter(pk=self.position.pk).update(slots_available=0)
        Company.objects.filter(pk=self.company.pk).update(image_key='synthetic-branding.webp')
        SkillCategory.objects.filter(pk=self.first.pk).update(description='Authoring hint only')
        self.assertFalse(recommendations_stale(self.profile, self.student))
        self.client.force_authenticate(self.admin)
        denied = self.client.post(reverse('placement_approve'), {'recommendation_id': self.rec.id}, format='json')
        self.assertEqual(denied.status_code, 409)
        self.assertIn('slots', denied.data['error'])

    def test_legacy_profile_requires_explicit_refresh_without_modifying_score_history(self):
        self.profile.ranking_input_fingerprint = ''
        self.profile.save(update_fields=['ranking_input_fingerprint'])
        before = list(SkillScore.objects.values('id', 'raw_score', 'max_score', 'percentage'))
        self.client.force_authenticate(self.student)
        self.assertTrue(self.client.get(reverse('student_combined_results')).data['recommendations_stale'])
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.ranking_input_fingerprint, '')
        self.assertEqual(before, list(SkillScore.objects.values('id', 'raw_score', 'max_score', 'percentage')))

    def test_catalog_change_during_generation_cannot_publish_a_current_ranking(self):
        def change_during_preprocessing(texts, model):
            self.position.requirements.update(required_percentage=80)
            return ['shared synthetic tokens'] * len(texts), model, None

        with patch('api.recommendation_nlp.preprocess_texts', side_effect=change_during_preprocessing):
            profile, _, rows = recalculate_combined(self.student, self.batch)
        self.assertEqual(rows, [])
        self.assertTrue(recommendations_stale(profile, self.student))
        self.assertFalse(Recommendation.objects.filter(student=self.student, is_current=True).exists())

    def test_approved_snapshots_survive_catalog_changes_and_refresh(self):
        self.client.force_authenticate(self.admin)
        approved = self.client.post(reverse('placement_approve'), {'recommendation_id': self.rec.id}, format='json')
        self.assertEqual(approved.status_code, 201)
        placement = OJTPlacement.objects.get()
        snapshot = placement.match_score_at_assignment
        self.position.requirements.update(skill_category=self.second)
        recalculate_combined(self.student, self.batch)
        placement.refresh_from_db()
        self.assertEqual(placement.match_score_at_assignment, snapshot)
        self.rec.refresh_from_db()
        self.assertNotEqual(self.rec.match_score, snapshot)

    def test_profile_pin_update_retains_existing_automatic_refresh_behavior(self):
        self.client.force_authenticate(self.student)
        response = self.client.patch(reverse('student_profile'), {'pinLat': 7, 'pinLng': 125}, format='json')
        self.assertEqual(response.status_code, 200)
        self.student.refresh_from_db()
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.ranking_input_fingerprint, input_fingerprint(self.student))

    def test_bulk_state_hashes_catalog_once_and_reports_hide_stale_rankings(self):
        from .views import bulk_management_states, current_recommendations
        from .recommendation_freshness import catalog_fingerprint
        with patch('api.views.catalog_fingerprint', wraps=catalog_fingerprint) as fingerprint:
            state = bulk_management_states([self.student], self.batch)
        self.assertEqual(fingerprint.call_count, 1)
        self.assertTrue(state[self.student.pk][1])
        self.position.requirements.update(required_percentage=80)
        self.assertFalse(current_recommendations().exists())


class SharedCategoryValidationTests(APITestCase):
    def test_malformed_names_return_field_validation_errors_without_creating_rows(self):
        for role in ('admin', 'instructor'):
            staff = User.objects.create_user(f'category-{role}@example.invalid', role=role, is_approved=True)
            self.client.force_authenticate(staff)
            for value in (None, [], 42, {}, True, '', 'x' * 101):
                with self.subTest(role=role, value=value):
                    self.client.raise_request_exception = False
                    response = self.client.post(reverse('categories'), {'name': value}, format='json')
                    self.assertEqual(response.status_code, 400)
                    self.assertIn('field', response.data)
        self.assertEqual(SkillCategory.objects.count(), 0)

    def test_both_category_entry_points_share_envelope_description_and_tag_validation(self):
        admin = User.objects.create_user('category-contract@example.invalid', role='admin')
        self.client.force_authenticate(admin)
        for route in ('categories', 'admin_skills'):
            for value in ([], {'name': 'Valid', 'description': []}, {'name': 'Valid', 'tags': [42]},
                          {'name': 'Valid', 'tags': {'bad': True}}):
                with self.subTest(route=route, value=value):
                    result = self.client.post(reverse(route), value, format='json')
                    self.assertEqual(result.status_code, 400)
        self.assertEqual(SkillCategory.objects.count(), 0)
        result = self.client.post(reverse('categories'), {'name': '  Photo Editing  ', 'tags': ['retouching']}, format='json')
        self.assertEqual(result.status_code, 201)
        duplicate = self.client.post(reverse('categories'), {'name': 'photo editing'}, format='json')
        self.assertEqual(duplicate.status_code, 200)
        self.assertFalse(duplicate.data['created'])
        self.assertEqual(SkillCategory.objects.get().tags, ['retouching'])
