"""Isolated ranking edge cases; similarity never grants placement capacity."""
import math
from types import SimpleNamespace as Obj
from unittest.mock import patch
from django.test import SimpleTestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase
from .combined_competency import recalculate_combined
from .models import (Assessment, Batch, BatchEnrollment, Company, Position, PositionRequirement,
                     Question, Recommendation, SkillCategory, SkillScore, StudentResponse, User)
from .recommendation_nlp import extract_coordinates, location_similarity
from .scoring import _rank_recommendations
from .views import serialize_recommendation


class LocationContractTests(SimpleTestCase):
    def test_invalid_coordinates_are_missing_not_invented_distance(self):
        for lat, lng in [(float('nan'), 125), (float('inf'), 125), (91, 125), (7, -181),
                         (True, 125), ('', 125), ([], 125), (7, None)]:
            with self.subTest(lat=lat, lng=lng):
                self.assertIsNone(extract_coordinates({'pinLat': lat, 'pinLng': lng}))
                self.assertEqual(location_similarity({'pinLat': lat, 'pinLng': lng}, 7, 125), (0.5, None))
                self.assertEqual(location_similarity({'pinLat': 7, 'pinLng': 125}, lat, lng), (0.5, None))

    def test_supported_shapes_and_geographic_boundaries(self):
        for address in [{'lat': '7', 'lng': '125'}, {'latitude': 7, 'longitude': 125},
                        {'pinLat': 7, 'pinLng': 125}, {'pin': {'lat': 7, 'lng': 125}}]:
            self.assertEqual(extract_coordinates(address), (7.0, 125.0))
            self.assertEqual(location_similarity(address, 7, 125), (1, 0))
        score, distance = location_similarity({'lat': 0, 'lng': 0}, 0, 180)
        self.assertEqual(score, 0)
        self.assertAlmostEqual(distance, math.pi * 6371, places=6)


class RecommendationContractTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email='rank-owner@example.com', name='Owner', role='instructor')
        self.admin = User.objects.create_user(email='rank-admin@example.com', name='Admin', role='admin')
        self.student = User.objects.create_user(email='rank-student@example.com', name='Student', role='student')
        self.batch = Batch.objects.create(name='Ranking fixture', instructor=self.owner)
        BatchEnrollment.objects.create(batch=self.batch, student=self.student)
        self.category = SkillCategory.objects.create(name='Programming', created_by=self.owner)
        self.other_category = SkillCategory.objects.create(name='Networking', created_by=self.owner)
        self.assessment = Assessment.objects.create(title='Completed fixture', batch=self.batch, created_by=self.owner)
        Question.objects.create(assessment=self.assessment, skill_category=self.category, question_text='Fixture')
        StudentResponse.objects.create(student=self.student, assessment=self.assessment, status='submitted', submitted_at=timezone.now())
        SkillScore.objects.create(student=self.student, assessment=self.assessment, skill_category=self.category,
                                  raw_score=1, max_score=2, percentage=50)
        self.company = Company.objects.create(name='Synthetic Employer')
        self.position = Position.objects.create(company=self.company, title='Primary intern', slots_available=0)
        PositionRequirement.objects.create(position=self.position, skill_category=self.category, required_percentage=50)
        patcher = patch('api.recommendation_nlp.preprocess_texts', side_effect=lambda texts, model: (['shared skill evidence'] * len(texts), model, None))
        patcher.start()
        self.addCleanup(patcher.stop)

    def rank(self):
        return recalculate_combined(self.student, self.batch)

    def test_legacy_string_address_and_invalid_coordinates_are_safe_in_ranking_and_api(self):
        self.company.address = 'Legacy synthetic address'
        self.company.location_lat, self.company.location_lng = 95, 125
        self.company.save()
        _, _, rows = self.rank()
        self.assertEqual(rows[0]['address'], self.company.address)
        self.assertEqual(rows[0]['location_score_component'], 50)
        self.assertIsNone(rows[0]['distance_km'])
        rec = Recommendation.objects.get(student=self.student)
        payload = serialize_recommendation(rec)
        self.assertEqual(payload['address'], self.company.address)
        self.assertIsNone(payload['lat'])
        self.assertIsNone(payload['lng'])
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.get(reverse('student_combined_results')).status_code, 200)

    def test_category_order_and_weight_formula_ignore_input_order(self):
        # [Programming,Networking] vectors are [0.6,0.8] versus [1,0].
        # Category=.6; shared text=1; missing location=.5 => 68.5%.
        scores = [Obj(skill_category_id=self.other_category.id, percentage=80),
                  Obj(skill_category_id=self.category.id, percentage=60)]
        categories = [self.other_category, self.category]
        self.position.requirements.update(required_percentage=100)
        rows = _rank_recommendations(self.student, scores, categories, {'competency_profile_text': 'Synthetic profile'}, self.batch)
        self.assertEqual(rows[0]['category_score_component'], 60)
        self.assertEqual(rows[0]['nlp_score_component'], 100)
        self.assertEqual(rows[0]['location_score_component'], 50)
        self.assertEqual(rows[0]['match_score'], 68.5)

    def test_tied_api_order_uses_position_identity_not_recommendation_creation_order(self):
        second = Position.objects.create(company=self.company, title='Second intern', slots_available=1)
        PositionRequirement.objects.create(position=second, skill_category=self.category, required_percentage=50)
        # Simulate historical rows created in reverse candidate order.
        for position in [second, self.position]:
            Recommendation.objects.create(student=self.student, batch=self.batch, position=position, match_score=92.5)
        self.rank()
        self.client.force_authenticate(self.student)
        for _ in range(2):
            result = self.client.get(reverse('student_combined_results'))
            self.assertEqual([row['position_id'] for row in result.data['recommendations']], [self.position.id, second.id])

    def test_similarity_is_still_ranked_at_zero_capacity_but_approval_is_denied(self):
        _, _, rows = self.rank()
        self.assertEqual(rows[0]['match_score'], 92.5)
        rec = Recommendation.objects.get(student=self.student)
        self.client.force_authenticate(self.admin)
        result = self.client.post(reverse('placement_approve'), {'recommendation_id': rec.id}, format='json')
        self.assertEqual(result.status_code, 409)
        self.assertTrue(Recommendation.objects.get(pk=rec.id).is_current)

    def test_no_assessments_and_optional_only_do_not_unlock_results(self):
        self.assessment.is_required = False
        self.assessment.save(update_fields=['is_required'])
        profile, progress, rows = self.rank()
        self.assertFalse(progress['has_required_assessments'])
        self.assertFalse(profile.is_finalized)
        self.assertEqual(rows, [])
        self.assessment.delete()
        self.client.force_authenticate(self.student)
        result = self.client.get(reverse('student_combined_results'))
        self.assertTrue(result.data['recommendations_locked'])
        self.assertEqual(result.data['recommendations'], [])

    def test_removing_requirements_invalidates_previous_current_results(self):
        self.rank()
        self.position.requirements.all().delete()
        _, _, rows = self.rank()
        self.assertEqual(rows, [])
        self.assertFalse(Recommendation.objects.filter(student=self.student, is_current=True).exists())

    def test_batch_rerank_keeps_ids_and_other_batch_history_with_mixed_candidates(self):
        for index in range(7):
            position = Position.objects.create(company=self.company, title=f'Candidate {index}')
            PositionRequirement.objects.create(position=position, skill_category=self.category, required_percentage=50)
        self.rank()
        existing = dict(Recommendation.objects.filter(batch=self.batch).values_list('position_id', 'id'))
        other_batch = Batch.objects.create(name='Historical cohort', instructor=self.owner)
        historical = Recommendation.objects.create(student=self.student, batch=other_batch,
            position=self.position, is_current=False, match_score=17)
        self.position.requirements.all().delete()
        _, _, rows = self.rank()
        current = Recommendation.objects.filter(batch=self.batch, is_current=True)
        self.assertEqual(current.count(), 7)
        self.assertEqual({row.position_id: row.id for row in current},
                         {key: value for key, value in existing.items() if key != self.position.id})
        self.assertFalse(Recommendation.objects.get(pk=existing[self.position.id]).is_current)
        historical.refresh_from_db()
        self.assertEqual(historical.match_score, 17)
        self.assertFalse(historical.is_current)
        self.assertEqual([row['position_id'] for row in rows], sorted(row.position_id for row in current))

    def test_failed_batch_persistence_rolls_back_stale_flag_and_keeps_prior_scores(self):
        self.rank()
        prior = list(Recommendation.objects.filter(batch=self.batch).values('id', 'is_current', 'match_score'))
        with patch.object(Recommendation.objects, 'bulk_create', side_effect=RuntimeError('Synthetic write failure')):
            with self.assertRaisesMessage(RuntimeError, 'Synthetic write failure'):
                self.rank()
        self.assertEqual(list(Recommendation.objects.filter(batch=self.batch).values('id', 'is_current', 'match_score')), prior)
