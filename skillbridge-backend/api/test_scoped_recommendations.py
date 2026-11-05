from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest import skipUnless
from unittest.mock import patch

from django.db import close_old_connections, connection
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase, APITransactionTestCase

from .combined_competency import recalculate_combined
from .models import (Assessment, Batch, BatchEnrollment, Company, CompetencyFramework, Institute,
                     OJTPlacement, Position, PositionRequirement, Program, Recommendation,
                     SkillCategory, SkillScore, StudentResponse, User)
from .recommendation_freshness import catalog_fingerprint, recommendations_stale
from .recommendation_policy import placement_evidence


class ScopedRankingFixtures:
    def setUp(self):
        self.admin = User.objects.create_user('scoped-rank-admin@example.invalid', role='admin')
        self.instructor = User.objects.create_user('scoped-rank-staff@example.invalid', role='instructor', is_approved=True)
        self.company = Company.objects.create(name='Synthetic shared partner')
        self.port = self.cohort('PORT', 'Port operations')
        self.food = self.cohort('FOOD', 'Food production')
        self.client.force_authenticate(self.admin)
        self.port_opening = self.opening('DockManifest', [self.port, self.food], self.port[3])
        self.food_opening = self.opening('KitchenLog', [self.food], self.food[3])
        preprocessor = patch('api.recommendation_nlp.preprocess_texts', side_effect=self.tokens)
        self.preprocess = preprocessor.start()
        self.addCleanup(preprocessor.stop)

    @staticmethod
    def tokens(texts, model):
        return ['synthetic matched token'] * len(texts), model, None

    def cohort(self, code, name):
        institute = Institute.objects.create(code=code, name=name)
        program = Program.objects.create(code=code, name=name, institute=institute)
        framework = CompetencyFramework.objects.create(program=program, version=1, name='Reviewed requirements')
        category = SkillCategory.objects.create(framework=framework, name='Operational records', tags=[code],
                                               description=f'Review operations records for {name}.')
        batch = Batch.objects.create(name=name, instructor=self.instructor, institute=institute,
                                     program=program, framework=framework)
        student = User.objects.create_user(f'{code.lower()}-synthetic@example.invalid', role='student',
                                           program=program, is_approved=True)
        BatchEnrollment.objects.create(student=student, batch=batch)
        assessment = Assessment.objects.create(title='Required evidence', batch=batch, framework=framework,
                                               created_by=self.instructor)
        StudentResponse.objects.create(student=student, assessment=assessment, status='submitted', submitted_at=timezone.now())
        SkillScore.objects.create(student=student, assessment=assessment, skill_category=category,
                                  raw_score=8, max_score=10, percentage=80)
        return student, batch, assessment, category

    def opening(self, title, cohorts, category=None):
        result = self.client.post(reverse('admin_company_positions', args=[self.company.pk]), {
            'title': title, 'slots': 2, 'eligible_program_ids': [row[1].program_id for row in cohorts],
            'category_requirements': [{'category_id': category.pk, 'percentage': 70}] if category else [],
        }, format='json')
        self.assertEqual(result.status_code, 201, result.data)
        return result.data['id']

    def combined_result(self, cohort):
        self.client.force_authenticate(cohort[0])
        result = self.client.get(reverse('student_combined_results'))
        self.assertEqual(result.status_code, 200, result.data)
        return result.data


class ScopedRecommendationTests(ScopedRankingFixtures, APITestCase):
    def test_exact_framework_filters_corpus_and_keeps_ids_in_provenance(self):
        student, batch, assessment, category = self.port
        future = CompetencyFramework.objects.create(program=batch.program, version=2, name='Future requirements')
        future_category = SkillCategory.objects.create(framework=future, name=category.name, tags=category.tags)
        self.opening('FutureRubric', [self.port], future_category)
        self.opening('ManualOnly', [self.port])
        global_category = SkillCategory.objects.create(name=category.name, tags=category.tags)
        legacy = Position.objects.create(company=self.company, title='LegacyRubric')
        PositionRequirement.objects.create(position=legacy, skill_category=global_category, required_percentage=70)
        SkillScore.objects.create(student=student, assessment=assessment, skill_category=future_category,
                                  raw_score=100, max_score=100, percentage=100)

        profile, _, rows = recalculate_combined(student, batch)
        self.assertEqual([row['position_id'] for row in rows], [self.port_opening])
        texts, _ = self.preprocess.call_args.args
        self.assertEqual(len(texts), 2)
        self.assertIn('DockManifest', texts[1])
        self.assertTrue(all(term not in ' '.join(texts) for term in ('KitchenLog', 'FutureRubric', 'ManualOnly', 'LegacyRubric')))
        details = rows[0]['assessment_details']
        self.assertEqual(details['required_mean'], 80)
        self.assertEqual(details['requirements'][0]['category_id'], category.pk)
        self.assertEqual(details['ranking_inputs']['program_id'], batch.program_id)
        self.assertEqual(details['ranking_inputs']['framework_id'], batch.framework_id)
        self.assertEqual(details['ranking_inputs']['framework_version'], 1)
        self.assertEqual(details['ranking_inputs']['catalog_fingerprint'], catalog_fingerprint(batch))
        self.assertFalse(recommendations_stale(profile, student))
        self.assertEqual(self.combined_result(self.port)['overall_max_score'], 10)
        self.assertTrue(SkillScore.objects.filter(skill_category=future_category, raw_score=100).exists())

        _, _, other = recalculate_combined(*self.food[:2])
        self.assertEqual([row['position_id'] for row in other], [self.food_opening])
        self.assertEqual(len(self.preprocess.call_args.args[0]), 2)

    def test_independent_edits_and_relevant_eligibility_have_scoped_freshness(self):
        recalculate_combined(*self.port[:2])
        recalculate_combined(*self.food[:2])
        port_record = Recommendation.objects.get(student=self.port[0])
        before = port_record.assessment_details
        food_url = reverse('admin_position_detail', args=[self.food_opening])
        result = self.client.patch(food_url, {'title': 'KitchenRecords'}, format='json')
        self.assertEqual(result.status_code, 200, result.data)
        self.assertTrue(self.combined_result(self.food)['recommendations_stale'])
        self.assertEqual(len(self.combined_result(self.port)['recommendations']), 1)

        self.client.force_authenticate(self.admin)
        port_url = reverse('admin_position_detail', args=[self.port_opening])
        result = self.client.patch(port_url, {'eligible_program_ids': [self.port[1].program_id]}, format='json')
        self.assertEqual(result.status_code, 200, result.data)
        self.assertFalse(self.combined_result(self.port)['recommendations_stale'])

        self.client.force_authenticate(self.admin)
        result = self.client.patch(port_url, {'eligible_program_ids': [self.food[1].program_id],
                                              'category_requirements': []}, format='json')
        self.assertEqual(result.status_code, 200, result.data)
        port_record.refresh_from_db()
        self.assertFalse(port_record.is_current)
        self.assertEqual(port_record.assessment_details, before)
        current = self.combined_result(self.port)
        self.assertTrue(current['recommendations_stale'])
        self.assertFalse(current['competency_locked'])
        self.assertEqual(current['recommendations'], [])

        _, _, rows = recalculate_combined(*self.port[:2])
        self.assertEqual(rows, [])
        self.assertFalse(self.combined_result(self.port)['recommendations_stale'])

    def test_stale_approval_refused_and_issued_evidence_survives_reranking(self):
        recalculate_combined(*self.port[:2])
        record = Recommendation.objects.get(student=self.port[0])
        Position.objects.filter(pk=self.port_opening).update(tags=['changed relevant vocabulary'])
        approval_url = reverse('placement_approve')
        self.assertEqual(self.client.post(approval_url, {'recommendation_id': record.pk}, format='json').status_code, 409)
        recalculate_combined(*self.port[:2])
        result = self.client.post(approval_url, {'recommendation_id': record.pk}, format='json')
        self.assertEqual(result.status_code, 201, result.data)
        placement = OJTPlacement.objects.get()
        evidence = placement_evidence(placement)
        self.assertEqual(evidence['assessment_details']['ranking_inputs']['framework_id'], self.port[1].framework_id)
        PositionRequirement.objects.filter(position_id=self.port_opening).update(required_percentage=90)
        recalculate_combined(*self.port[:2])
        record.refresh_from_db()
        self.assertNotEqual(record.assessment_details, evidence['assessment_details'])
        self.assertEqual(placement_evidence(OJTPlacement.objects.get(pk=placement.pk)), evidence)

    def test_zero_scores_and_profile_review_produce_no_current_ranking(self):
        student, batch, assessment, _ = self.port
        BatchEnrollment.objects.filter(student=student, batch=batch).update(profile_review_required=True)
        profile, _, rows = recalculate_combined(student, batch)
        self.assertFalse(profile.is_finalized)
        self.assertEqual(rows, [])
        self.assertTrue(self.combined_result(self.port)['competency_locked'])
        BatchEnrollment.objects.filter(student=student, batch=batch).update(profile_review_required=False)
        SkillScore.objects.filter(student=student, assessment=assessment).update(raw_score=0, percentage=0)
        profile, _, rows = recalculate_combined(student, batch)
        self.assertTrue(profile.is_finalized)
        self.assertEqual(rows, [])
        self.assertEqual(self.combined_result(self.port)['overall_percentage'], 0)
        self.preprocess.assert_not_called()

    def test_edit_during_scoring_cannot_publish_an_old_scoped_corpus(self):
        def change_during_scoring(texts, model):
            Position.objects.filter(pk=self.port_opening).update(title='Edited during scoring')
            return self.tokens(texts, model)

        self.preprocess.side_effect = change_during_scoring
        profile, _, rows = recalculate_combined(*self.port[:2])
        self.assertEqual(rows, [])
        self.assertTrue(recommendations_stale(profile, self.port[0]))
        self.assertFalse(Recommendation.objects.filter(student=self.port[0], is_current=True).exists())


@skipUnless(connection.vendor == 'postgresql', 'Requires PostgreSQL enrollment row locks')
class ScopedRankingConcurrencyTests(ScopedRankingFixtures, APITransactionTestCase):
    def test_two_refreshes_preserve_one_coherent_profile_and_ranking(self):
        barrier = Barrier(2)

        def refresh():
            close_old_connections()
            try:
                student, batch = User.objects.get(pk=self.port[0].pk), Batch.objects.get(pk=self.port[1].pk)
                barrier.wait(timeout=10)
                profile, _, rows = recalculate_combined(student, batch)
                return profile.ranking_input_fingerprint, [row['position_id'] for row in rows]
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as workers:
            jobs = [workers.submit(refresh) for _ in range(2)]
            outcomes = [job.result(timeout=20) for job in jobs]
        self.assertEqual(outcomes[0], outcomes[1])
        self.assertEqual(outcomes[0][1], [self.port_opening])
        current = Recommendation.objects.get(student=self.port[0], is_current=True)
        self.assertEqual(current.assessment_rank, 1)
        self.assertEqual(len(self.combined_result(self.port)['recommendations']), 1)
