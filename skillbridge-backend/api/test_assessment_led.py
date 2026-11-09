"""Synthetic evidence/order, API, refresh and decision-history regressions."""
from copy import deepcopy
import itertools
import random
from types import SimpleNamespace as Obj
from unittest.mock import patch

from django.test import SimpleTestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from .recommendation_policy import (POLICY, VERSION, api_fields, describe,
    numerical_key, pooled_evidence, position_requirements, placement_evidence)
from .assessment_allocation import allocate_assessment_led
from .models import (User, Batch, BatchEnrollment, Assessment, StudentResponse,
    AnswerChoice, Question, SkillCategory, SkillScore, Company, Position, PositionRequirement,
    Recommendation, OJTPlacement, ManagementAction)


class EvidencePolicyTests(SimpleTestCase):
    def evidence(self, a=95, b=80):
        categories = [Obj(id=1, name='First', tags=[]), Obj(id=2, name='Second', tags=[])]
        rows = [Obj(skill_category_id=i, raw_score=value, max_score=100) for i, value in [(1, a), (2, b)]]
        return pooled_evidence(rows, categories)

    def test_minimum_coverage_does_not_round_grades_or_cancel_gaps(self):
        scores, totals, names, _ = self.evidence()
        d = describe(scores, totals, names, {1: 90, 2: 100})
        self.assertEqual(d['coverage'], 90)
        self.assertEqual(d['requirements'][0]['assessed_percentage'], 95)
        self.assertEqual(d['requirements'][1]['gap_percentage_points'], 20)
        self.assertFalse(d['all_targets_met'])

    def test_missing_evidence_and_assessed_zero_remain_distinct(self):
        a = describe({1: 80}, {1: [8, 10]}, {1: 'Known', 2: 'Other'}, {1: 80, 2: 80})
        b = describe({1: 80, 2: 0}, {1: [8, 10], 2: [0, 10]}, {1: 'Known', 2: 'Other'}, {1: 80, 2: 80})
        self.assertEqual(a['coverage'], b['coverage'])
        self.assertEqual(a['requirement_counts']['unassessed'], 1)
        self.assertEqual(b['requirement_counts']['below_minimum'], 1)
        self.assertIsNone(a['required_mean'])
        self.assertEqual(b['required_mean'], 40)

    def test_equal_vocabulary_aliases_pool_raw_max_without_writing_categories(self):
        categories = [Obj(id=1, name='Database', tags=['SQL']), Obj(id=2, name='Database Management', tags=['SQL'])]
        rows = [Obj(skill_category_id=1, raw_score=1, max_score=2), Obj(skill_category_id=2, raw_score=8, max_score=10)]
        scores, totals, _, mapping = pooled_evidence(rows, categories)
        self.assertEqual(mapping, {1: 1, 2: 1})
        self.assertEqual(totals, {1: [9, 12]})
        self.assertEqual(scores, {1: 75})
        self.assertEqual(categories[1].name, 'Database Management')

    def test_different_vocabulary_and_conflicting_targets_are_not_silently_merged(self):
        categories = [Obj(id=1, name='Database', tags=['SQL']), Obj(id=2, name='Database Management', tags=['NoSQL'])]
        _, _, _, mapping = pooled_evidence([], categories)
        self.assertNotEqual(mapping[1], mapping[2])
        position = Obj(requirements=Obj(all=lambda: [Obj(skill_category_id=1, required_percentage=75), Obj(skill_category_id=2, required_percentage=80)]))
        with self.assertRaisesRegex(ValueError, 'conflicting'):
            position_requirements(position, {1: 1, 2: 1})

    def test_coverage_and_demand_have_strict_precedence_over_support(self):
        rows = [dict(coverage=100, strength=20, support=0),
                dict(coverage=99.999, strength=100, support=100),
                dict(coverage=100, strength=19, support=100)]
        self.assertEqual(sorted(range(3), key=lambda i: numerical_key(rows[i], i)), [0, 2, 1])

    def test_new_custom_category_and_high_unrelated_score_do_not_change_coverage(self):
        a = describe({900: 80}, {900: [8, 10]}, {900: 'New custom domain'}, {900: 75})
        b = describe({900: 80, 901: 100}, {900: [8, 10], 901: [10, 10]},
                     {900: 'New custom domain', 901: 'Unrelated'}, {900: 75})
        self.assertEqual(a['coverage'], b['coverage'])
        self.assertEqual(b['coverage'], 100)

    def test_slot_competition_uses_actual_required_scores_not_personal_demand_ratio(self):
        edges = []
        for sid, score in [(1, 80), (2, 90)]:
            edges.append(dict(id=sid, student_id=sid, position_id=1, assessment_rank=1,
                match_score=99 if sid == 1 else 1,
                assessment_details=dict(policy=POLICY, all_targets_met=True, required_mean=score, support=50)))
        self.assertEqual(allocate_assessment_led(edges, {1: 1}), {2: 2})

    def test_unassessed_or_below_minimum_pairs_stay_out_of_automatic_allocation(self):
        edges = [dict(id=1, student_id=1, position_id=1, assessment_rank=1, match_score=99,
                      assessment_details=dict(policy=POLICY, all_targets_met=False, required_mean=90, support=100))]
        self.assertEqual(allocate_assessment_led(edges, {1: 3}), {})

    def test_random_capacity_graphs_match_independent_exhaustive_objective(self):
        rng = random.Random(428)
        for _ in range(30):
            edges = [dict(id=sid * 10 + pid, student_id=sid, position_id=pid,
                assessment_rank=pid, match_score=rng.randrange(100), assessment_details=dict(
                    policy=POLICY, all_targets_met=True, required_mean=rng.randrange(60, 101), support=rng.randrange(101)))
                for sid in (1, 2, 3) for pid in (1, 2, 3) if rng.random() > .3]
            capacities = {pid: rng.randrange(3) for pid in (1, 2, 3)}
            choices = [[None] + [e for e in edges if e['student_id'] == sid and capacities[e['position_id']]] for sid in (1, 2, 3)]
            preferences = {e['id']: rank for options in choices for rank, e in enumerate(options[1:], 1)}
            def objective(rows):
                return (len(rows), -sum(preferences[e['id']] for e in rows),
                    sum(e['assessment_details']['required_mean'] for e in rows),
                    sum(e['assessment_details']['support'] for e in rows))
            feasible = []
            for combination in itertools.product(*choices):
                rows = [e for e in combination if e]
                if all(sum(e['position_id'] == pid for e in rows) <= cap for pid, cap in capacities.items()):
                    feasible.append(objective(rows))
            selected = set(allocate_assessment_led(edges, capacities).values())
            self.assertEqual(objective([e for e in edges if e['id'] in selected]), max(feasible))
            self.assertEqual(allocate_assessment_led(edges, capacities), allocate_assessment_led(list(reversed(edges)), capacities))


def controlled_preprocess(texts, requested, **kwargs):
    # Deliberately favor First role's text so this test proves numerical policy
    # wins over the legacy hybrid. Recognize every generated student view rather
    # than assuming a single student document at input index zero.
    return ['alpha' if text.startswith(('The student demonstrates', 'Assessment results:', 'First role at'))
            else 'beta' for text in texts], requested, None


class AssessmentLedAPITests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email='policy-admin@local.invalid', name='Synthetic Admin', role='admin', is_approved=True)
        self.teacher = User.objects.create_user(email='policy-teacher@local.invalid', name='Synthetic Instructor', role='instructor', is_approved=True)
        self.student = User.objects.create_user(email='policy-student@local.invalid', name='Synthetic Learner', role='student', is_approved=True)
        self.batch = Batch.objects.create(name='Synthetic policy cohort', instructor=self.teacher, status='active')
        BatchEnrollment.objects.create(student=self.student, batch=self.batch, profile_confirmed_at=timezone.now())
        self.a = SkillCategory.objects.create(name='First', tags=['alpha'])
        self.b = SkillCategory.objects.create(name='Second', tags=['beta'])
        self.assessment = Assessment.objects.create(title='Synthetic evidence', batch=self.batch, created_by=self.teacher,
            publication_status='published', is_required=True, include_in_competency=True)
        StudentResponse.objects.create(student=self.student, assessment=self.assessment, status='submitted', submitted_at=timezone.now())
        for category, raw in [(self.a, 8), (self.b, 10)]:
            SkillScore.objects.create(student=self.student, assessment=self.assessment, skill_category=category,
                                      raw_score=raw, max_score=10, percentage=raw * 10)
        company = Company.objects.create(name='Synthetic partner', added_by=self.admin)
        self.positions = []
        for name, category, target in [('First role', self.a, 50), ('Second role', self.b, 95), ('Gap role', self.a, 90)]:
            position = Position.objects.create(title=name, company=company, slots_available=1)
            PositionRequirement.objects.create(position=position, skill_category=category, required_percentage=target)
            self.positions.append(position)
        self.patch = patch('api.recommendation_nlp.preprocess_texts', side_effect=controlled_preprocess)
        self.patch.start()
        self.addCleanup(self.patch.stop)

    def generate(self):
        from .combined_competency import recalculate_combined
        return recalculate_combined(self.student, self.batch)

    def test_saved_order_and_student_api_do_not_revert_to_old_hybrid(self):
        _, _, generated = self.generate()
        self.assertEqual(generated[0]['position_id'], self.positions[1].id)
        legacy_first = max(generated, key=lambda r: r['match_score'])
        self.assertEqual(legacy_first['position_id'], self.positions[0].id)
        self.client.force_authenticate(self.student)
        payload = self.client.get(reverse('student_combined_results')).data
        self.assertEqual(payload['recommendations'][0]['position_id'], self.positions[1].id)
        row = payload['recommendations'][0]
        self.assertEqual(row['recommendation_rank'], 1)
        self.assertEqual(row['requirement_coverage'], 100)
        self.assertEqual(row['assessment_details']['requirements'][0]['assessed_percentage'], 100)

    def test_new_policy_invalidates_old_fingerprint_without_regrading(self):
        from .combined_competency import combined_is_unlocked
        profile, _, _ = self.generate()
        before = list(SkillScore.objects.values('id', 'raw_score', 'max_score', 'percentage'))
        profile.ranking_input_fingerprint = 'old-policy-fingerprint'
        profile.save(update_fields=['ranking_input_fingerprint'])
        self.assertFalse(combined_is_unlocked(self.student, self.batch))
        self.client.force_authenticate(self.student)
        stale = self.client.get(reverse('student_combined_results')).data
        self.assertTrue(stale['recommendations_locked'])
        self.assertFalse(stale['competency_locked'])
        self.assertEqual(stale['recommendations'], [])
        self.assertEqual({r['category']: r['percentage'] for r in stale['combined_category_scores']}, {'First': 80, 'Second': 100})
        self.assertEqual(stale['overall_percentage'], 90)
        for actor, endpoint in [(self.admin, 'admin_student_recommendations'), (self.teacher, 'instructor_student_recommendations')]:
            self.client.force_authenticate(actor)
            learner = next(r for r in self.client.get(reverse(endpoint)).data if r['id'] == self.student.id)
            self.assertTrue(learner['recommendations_locked'])
            self.assertTrue(learner['has_submitted'])
            self.assertFalse(learner['competency_locked'])
            self.assertEqual(len(learner['combined_category_scores']), 2)
            self.assertEqual(learner['top_recommendations'], [])
        self.client.force_authenticate(self.admin)
        users = self.client.get(reverse('admin_users')).data
        admin_card = next(r for r in users['students'] if r['id'] == self.student.id)
        self.assertEqual(admin_card['status'], 'completed')
        self.assertFalse(admin_card['competency_locked'])
        self.assertEqual(len(admin_card['combined_category_scores']), 2)
        result = self.client.post(reverse('admin_rerun_recommendations'))
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.data['errors'], 0)
        self.assertEqual(before, list(SkillScore.objects.values('id', 'raw_score', 'max_score', 'percentage')))

    def test_future_approval_evidence_is_frozen_in_existing_audit_storage(self):
        self.generate()
        rec = Recommendation.objects.get(student=self.student, assessment_rank=1)
        approved = OJTPlacement(student=self.student, batch=self.batch, company=rec.position.company,
            position=rec.position, status='approved', assigned_by=self.admin, approved_by=self.admin)
        approved.copy_recommendation_snapshot(rec)
        approved.save()
        saved = deepcopy(placement_evidence(approved))
        self.assertEqual(saved['assessment_details']['policy'], POLICY)
        self.assertEqual(saved['assessment_details']['version'], VERSION)
        rec.assessment_details['coverage'] = 12
        rec.assessment_rank = 3
        rec.save(update_fields=['assessment_details', 'assessment_rank'])
        approved.refresh_from_db()
        del approved._assessment_snapshot
        self.assertEqual(placement_evidence(approved), saved)
        self.assertEqual(ManagementAction.objects.filter(target_type='placement', target_id=approved.pk).count(), 1)

    def test_generation_preserves_recommendation_ids_and_no_minimum_count_ui_contract(self):
        self.generate()
        before = list(Recommendation.objects.order_by('position_id').values_list('id', flat=True))
        self.generate()
        self.assertEqual(before, list(Recommendation.objects.order_by('position_id').values_list('id', flat=True)))
        rec = Recommendation.objects.get(student=self.student, assessment_rank=1)
        self.assertEqual(api_fields(rec)['ranking_policy'], POLICY)
        self.assertIn('requirement_counts', rec.assessment_details)  # data, not a required UI block

    def test_staff_and_catalog_consumers_receive_new_order_without_score_relabeling(self):
        self.generate()
        for user, endpoint in [(self.admin, 'admin_student_recommendations'),
                               (self.teacher, 'instructor_student_recommendations')]:
            self.client.force_authenticate(user)
            response = self.client.get(reverse(endpoint))
            self.assertEqual(response.status_code, 200, response.data)
            learner = next(row for row in response.data if row['id'] == self.student.id)
            self.assertEqual(learner['top_recommendations'][0]['recommendation_rank'], 1)
            self.assertEqual(learner['top_recommendations'][0]['position'], self.positions[1].title)
        self.client.force_authenticate(self.student)
        catalog = self.client.get(reverse('student_companies')).data
        positions = {p['id']: p for company in catalog for p in company['positions']}
        self.assertEqual(positions[self.positions[1].id]['recommendation_rank'], 1)
        saved = Recommendation.objects.get(student=self.student, position=self.positions[1])
        self.assertEqual(positions[self.positions[1].id]['match_score'], saved.match_score)
        self.assertEqual(positions[self.positions[1].id]['requirement_coverage'], 100)

    def test_current_reports_and_analytics_expose_rank_and_separate_numerical_status(self):
        self.generate()
        self.client.force_authenticate(self.admin)
        report = self.client.get(reverse('management_assessment_reports'), {'type': 'student_competency'})
        self.assertEqual(report.status_code, 200, report.data)
        rows = report.data['records'] if 'records' in report.data else report.data['rows']
        self.assertEqual(rows[0]['final_recommendations'][0]['recommendation_rank'], 1)
        export = self.client.get(reverse('management_assessment_reports'), {'type': 'student_competency', 'export': 'csv'})
        self.assertEqual(export.status_code, 200)
        self.assertIn('order #1; requirement coverage 100.0% (not confidence)', export.content.decode('utf-8'))
        analytics = self.client.get(reverse('management_analytics'))
        self.assertEqual(analytics.status_code, 200, analytics.data)
        learner = next(r for r in analytics.data['students'] if r['id'] == self.student.id)
        self.assertEqual(learner['top_recommendation_rank'], 1)
        self.assertEqual(learner['match_band'], 'Minimums met')
        self.assertEqual(learner['top_requirement_coverage'], 100)

    def test_shared_draft_excludes_below_target_but_preserves_valid_coordinator_choice(self):
        self.generate()
        self.client.force_authenticate(self.admin)
        result = self.client.post(reverse('placement_draft'), {'action': 'sync'}, format='json')
        self.assertEqual(result.status_code, 200, result.data)
        learner = next(r for r in result.data['students'] if r['student']['id'] == self.student.id)
        self.assertEqual(learner['proposal']['position_id'], self.positions[1].id)
        gap = Recommendation.objects.get(student=self.student, position=self.positions[2])
        response = self.client.post(reverse('placement_draft'), {'action': 'choose',
            'revision': result.data['revision'], 'student_id': self.student.id,
            'recommendation_id': gap.id}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        again = self.client.post(reverse('placement_draft'), {'action': 'sync'}, format='json')
        learner = next(r for r in again.data['students'] if r['student']['id'] == self.student.id)
        self.assertEqual(learner['proposal']['position_id'], self.positions[2].id)
        self.assertTrue(learner['coordinator_choice'])


class AssessmentSubmissionPolicyTests(APITestCase):
    """Submit real answers; score and recommend automatically without an admin rerun."""

    def test_final_required_submission_saves_grades_and_publishes_assessment_led_positions(self):
        teacher = User.objects.create_user(email='release-teacher@local.invalid', role='instructor', is_approved=True)
        student = User.objects.create_user(email='release-learner@local.invalid', role='student', is_approved=True)
        batch = Batch.objects.create(name='Synthetic submission cohort', instructor=teacher, status='active')
        BatchEnrollment.objects.create(student=student, batch=batch, profile_confirmed_at=timezone.now())
        web = SkillCategory.objects.create(name='Web Development', tags=['HTML', 'CSS'])
        programming = SkillCategory.objects.create(name='Programming', tags=['Python'])
        partner = Company.objects.create(name='Synthetic release partner')
        preferred = Position.objects.create(company=partner, title='Synthetic frontend role', slots_available=1)
        alternate = Position.objects.create(company=partner, title='Synthetic general role', slots_available=1)
        for position, targets in [(preferred, [(web, 90), (programming, 50)]),
                                  (alternate, [(web, 25), (programming, 25)])]:
            for category, target in targets:
                PositionRequirement.objects.create(position=position, skill_category=category, required_percentage=target)
        assessments = []
        for category in (web, programming):
            assessment = Assessment.objects.create(title=f'Synthetic {category.name}', batch=batch,
                created_by=teacher, publication_status='published', is_required=True, include_in_competency=True)
            for index in range(10):
                question = Question.objects.create(assessment=assessment, skill_category=category,
                    question_text=f'Synthetic question {index}', question_order=index + 1)
                AnswerChoice.objects.create(question=question, choice_text='Synthetic correct choice', is_correct=True)
                AnswerChoice.objects.create(question=question, choice_text='Synthetic other choice', is_correct=False)
            assessments.append(assessment)
        self.client.force_authenticate(student)
        for index, assessment in enumerate(assessments):
            started = self.client.post(reverse('assessment_start', args=[assessment.id]))
            self.assertEqual(started.status_code, 200, started.data)
            answers = [{'question_id': question.id,
                'selected_choice_id': question.choices.get(is_correct=(index == 0 or item < 6)).id}
                for item, question in enumerate(assessment.questions.order_by('question_order'))]
            submitted = self.client.post(reverse('assessment_submit', args=[assessment.id]), {
                'response_id': started.data['response_id'], 'attempt_started_at': started.data['attempt_started_at'],
                'answers': answers}, format='json')
            self.assertEqual(submitted.status_code, 200, submitted.data)
            if index == 0:
                self.assertTrue(submitted.data['recommendations_locked'])
                self.assertEqual(submitted.data['recommendations'], [])
                self.assertEqual(SkillScore.objects.get(student=student, assessment=assessment).percentage, 100)
            else:
                self.assertFalse(submitted.data['recommendations_locked'])
                self.assertEqual(submitted.data['recommendations'][0]['position_id'], preferred.id)
                self.assertEqual(submitted.data['recommendations'][0]['recommendation_rank'], 1)
        self.assertEqual(list(SkillScore.objects.filter(student=student).order_by('assessment_id')
            .values_list('raw_score', 'max_score', 'percentage')), [(10, 10, 100), (6, 10, 60)])
        result = self.client.get(reverse('student_combined_results'))
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(result.data['overall_percentage'], 80)
        self.assertFalse(result.data['competency_locked'])
        self.assertEqual(len(result.data['combined_category_scores']), 2)
        self.assertEqual(result.data['recommendations'][0]['position_id'], preferred.id)
        self.assertEqual(result.data['recommendations'][0]['requirement_coverage'], 100)
        self.assertEqual(result.data['recommendations'][0]['ranking_policy'], POLICY)
        self.assertEqual(Recommendation.objects.filter(student=student, batch=batch, is_current=True).count(), 2)
        self.assertEqual(OJTPlacement.objects.filter(student=student, status='approved').count(), 0)
