from unittest.mock import patch

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from .combined_competency import recalculate_combined
from .models import (
    AnswerChoice, Assessment, AssessmentAttemptHistory, Batch, BatchEnrollment, CombinedCategoryScore,
    CombinedCompetencyProfile, Company, OJTPlacement, Position,
    PositionRequirement, Question, Recommendation, RecommendationConfiguration,
    SkillCategory, SkillScore, StudentResponse, User,
)


class CombinedCompetencyTests(APITestCase):
    def setUp(self):
        self.instructor = User.objects.create_user(email='combined-instructor@example.com', name='Instructor', role='instructor')
        self.admin = User.objects.create_user(email='combined-admin@example.com', name='Admin', role='admin')
        self.student = User.objects.create_user(email='combined-student@example.com', name='Student', role='student')
        self.other_student = User.objects.create_user(email='combined-other@example.com', name='Other', role='student')
        self.batch = Batch.objects.create(name='Combined Batch', instructor=self.instructor)
        self.other_batch = Batch.objects.create(name='Other Batch', instructor=self.instructor)
        BatchEnrollment.objects.create(batch=self.batch, student=self.student)
        BatchEnrollment.objects.create(batch=self.other_batch, student=self.other_student)
        self.database = SkillCategory.objects.create(name='Database', tags=['SQL'], created_by=self.instructor)
        self.network = SkillCategory.objects.create(name='Networking', tags=['Routing'], created_by=self.instructor)
        self.programming = SkillCategory.objects.create(name='Programming', tags=['Python'], created_by=self.instructor)
        self.company = Company.objects.create(name='Employer', added_by=self.admin)
        self.position = Position.objects.create(company=self.company, title='IT Intern', slots_available=2)
        for category in (self.database, self.network, self.programming):
            PositionRequirement.objects.create(position=self.position, skill_category=category, required_percentage=70)
        self.model_calls = []

        def fake_preprocess(texts, model_id):
            self.model_calls.append(model_id)
            return ['shared competency text'] * len(texts), model_id, None

        patcher = patch('api.recommendation_nlp.preprocess_texts', side_effect=fake_preprocess)
        patcher.start()
        self.addCleanup(patcher.stop)

    def make_assessment(self, title, categories, batch=None, **kwargs):
        assessment = Assessment.objects.create(
            title=title, created_by=self.instructor, batch=batch or self.batch, **kwargs,
        )
        for index, category in enumerate(categories, 1):
            question = Question.objects.create(
                assessment=assessment, skill_category=category,
                question_text=f'{title} {index}', question_order=index,
            )
            AnswerChoice.objects.create(question=question, choice_text='Private correct choice', is_correct=True)
            AnswerChoice.objects.create(question=question, choice_text='Wrong choice', is_correct=False)
        return assessment

    def saved_score(self, assessment, category, raw, maximum, *, student=None, status='submitted', flagged=False):
        student = student or self.student
        StudentResponse.objects.create(
            student=student, assessment=assessment,
            started_at=timezone.now(), submitted_at=timezone.now(),
            status=status, is_flagged=flagged,
        )
        SkillScore.objects.create(
            student=student, assessment=assessment, skill_category=category,
            raw_score=raw, max_score=maximum,
            percentage=round(raw / maximum * 100, 2),
        )

    def submit(self, assessment, *, correct=True):
        self.client.force_authenticate(self.student)
        started = self.client.post(reverse('assessment_start', args=[assessment.id]))
        self.assertEqual(started.status_code, 200)
        answers = [{
            'question_id': question.id,
            'selected_choice_id': question.choices.get(is_correct=correct).id,
        } for question in assessment.questions.all()]
        result = self.client.post(reverse('assessment_submit', args=[assessment.id]), {
            'response_id': started.data['response_id'], 'answers': answers,
        }, format='json')
        self.assertEqual(result.status_code, 200)
        return result

    def combined(self):
        self.client.force_authenticate(self.student)
        return self.client.get(reverse('student_combined_results'))

    def test_weighted_same_category_and_cross_batch_isolation(self):
        general = self.make_assessment('General', [self.database, self.network])
        focused = self.make_assessment('Database focus', [self.database])
        foreign = self.make_assessment('Other batch', [self.database], batch=self.other_batch)
        BatchEnrollment.objects.create(batch=self.other_batch, student=self.student)
        self.saved_score(general, self.database, 6, 10)
        SkillScore.objects.create(student=self.student, assessment=general, skill_category=self.network,
                                  raw_score=3, max_score=4, percentage=75)
        self.saved_score(focused, self.database, 17, 20)
        self.saved_score(foreign, self.database, 99, 100)
        profile, progress, recommendations = recalculate_combined(self.student, self.batch)
        score = CombinedCategoryScore.objects.get(student=self.student, batch=self.batch, skill_category=self.database)
        self.assertEqual((score.raw_score, score.max_score, score.percentage), (23, 30, 76.67))
        self.assertEqual(score.source_assessment_ids, [general.id, focused.id])
        self.assertEqual(CombinedCategoryScore.objects.get(student=self.student, batch=self.batch, skill_category=self.network).percentage, 75)
        self.assertEqual(profile.included_assessment_ids, [general.id, focused.id])
        self.assertEqual(progress['completed_required_count'], 2)
        self.assertTrue(profile.is_finalized)
        self.assertTrue(recommendations)
        self.assertEqual(Recommendation.objects.get(student=self.student, batch=self.batch, position=self.position).model_used, 'spacy_md')
        self.assertEqual(SkillScore.objects.get(student=self.student, assessment=general, skill_category=self.database).raw_score, 6)

    def test_locked_until_final_required_and_no_api_leakage(self):
        first = self.make_assessment('First', [self.database])
        second = self.make_assessment('Second', [self.programming])
        Recommendation.objects.create(student=self.student, position=self.position, match_score=99)
        result = self.submit(first)
        stale = Recommendation.objects.create(
            student=self.student, batch=self.batch, position=self.position, match_score=98,
        )
        self.assertTrue(result.data['recommendations_locked'])
        partial_profile = CombinedCompetencyProfile.objects.get(student=self.student, batch=self.batch)
        self.assertFalse(partial_profile.is_finalized)
        self.assertEqual(partial_profile.competency_profile_text, '')
        self.assertEqual(result.data['recommendations'], [])
        self.assertEqual(self.combined().data['combined_category_scores'], [])
        self.assertTrue(self.combined().data['recommendations_locked'])
        self.assertEqual(self.client.get(reverse('student_results'), {'assessment_id': first.id}).data['recommendations'], [])
        companies = self.client.get(reverse('student_companies')).data
        self.assertIsNone(companies[0]['positions'][0]['match_score'])
        self.assertTrue(self.client.get(reverse('student_me')).data['recommendations_locked'])
        self.client.force_authenticate(self.instructor)
        roster = self.client.get(reverse('instructor_batch_students', args=[self.batch.id])).data['students'][0]
        self.assertTrue(roster['recommendations_locked'])
        self.assertEqual(roster['top_recommendations'], [])
        self.assertEqual(roster['remaining_required_count'], 1)
        self.assertEqual(roster['assessment_results'][0]['category_scores'][0]['raw_score'], 1)
        dashboard = self.client.get(reverse('instructor_student_recommendations')).data[0]
        self.assertEqual(dashboard['top_recommendations'], [])
        instructor_companies = self.client.get(reverse('instructor_companies')).data
        self.assertEqual(instructor_companies[0]['positions'][0]['matched_students'], [])
        self.client.force_authenticate(self.admin)
        admin_students = self.client.get(reverse('admin_student_recommendations')).data
        self.assertEqual(next(s for s in admin_students if s['id'] == self.student.id)['top_recommendations'], [])
        admin_user = next(s for s in self.client.get(reverse('admin_users')).data['students'] if s['id'] == self.student.id)
        self.assertIsNone(admin_user['top_match_score'])
        suggestions = self.client.get(reverse('placement_suggestions')).data
        self.assertEqual(suggestions['companies'][0]['positions'][0]['suggested_students'], [])
        self.assertEqual(self.client.get(reverse('admin_stats')).data['recommendations_made'], 0)
        locked_report = self.client.get(reverse('admin_reports')).data
        self.assertEqual(locked_report['recommendation_stats']['total'], 0)
        self.assertEqual(locked_report['skill_breakdown'], [])
        self.assertEqual(self.client.post(reverse('placement_approve'), {
            'recommendation_id': stale.id,
        }, format='json').status_code, 409)

        finished = self.submit(second)
        self.assertFalse(finished.data['recommendations_locked'])
        combined = self.combined().data
        self.assertTrue(combined['is_finalized'])
        self.assertEqual({row['category'] for row in combined['combined_category_scores']}, {'Database', 'Programming'})
        self.assertEqual({a['id'] for a in combined['included_assessments']}, {first.id, second.id})
        self.assertEqual(combined['remaining_required_count'], 0)
        self.assertTrue(combined['recommendations'])
        self.assertEqual(combined['active_model'], 'spacy_md')
        self.assertIsNotNone(combined['generated_at'])
        self.client.force_authenticate(self.admin)
        self.assertEqual({row['category'] for row in self.client.get(reverse('admin_reports')).data['skill_breakdown']},
                         {'Database', 'Programming'})

    def test_inclusion_toggle_and_closing_requirement_recalculate(self):
        completed = self.make_assessment('Completed', [self.database])
        second = self.make_assessment('Pending', [self.network])
        optional = self.make_assessment('Optional completed', [self.programming], is_required=False)
        self.submit(completed)
        self.submit(optional)
        self.assertTrue(self.combined().data['recommendations_locked'])

        self.client.force_authenticate(self.instructor)
        closed = self.client.patch(reverse('instructor_assessment_detail', args=[second.id]), {
            'publication_status': 'closed',
        }, format='json')
        self.assertEqual(closed.status_code, 200)
        self.assertFalse(self.combined().data['recommendations_locked'])
        self.assertEqual(len(self.combined().data['combined_category_scores']), 2)

        self.client.force_authenticate(self.instructor)
        excluded = self.client.patch(reverse('instructor_assessment_detail', args=[optional.id]), {
            'include_in_competency': False,
        }, format='json')
        self.assertEqual(excluded.status_code, 200)
        combined = self.combined().data
        self.assertEqual({row['category'] for row in combined['combined_category_scores']}, {'Database'})
        self.assertEqual(combined['included_assessments'], [{'id': completed.id, 'title': completed.title}])
        self.assertEqual(SkillScore.objects.filter(student=self.student, assessment=optional).count(), 1)

        self.client.force_authenticate(self.instructor)
        reopened = self.client.patch(reverse('instructor_assessment_detail', args=[second.id]), {
            'publication_status': 'published',
        }, format='json')
        self.assertEqual(reopened.status_code, 200)
        self.assertTrue(self.combined().data['recommendations_locked'])
        self.assertEqual(Recommendation.objects.filter(student=self.student, batch=self.batch, is_current=True).count(), 0)

    def test_stopped_required_attempt_locks_until_successful_retake(self):
        assessment = self.make_assessment('Required', [self.database])
        self.client.force_authenticate(self.student)
        started = self.client.post(reverse('assessment_start', args=[assessment.id]))
        question = assessment.questions.get()
        stopped = self.client.post(reverse('assessment_stop', args=[assessment.id]), {
            'response_id': started.data['response_id'], 'reason': 'tab_hidden',
            'answers': [{'question_id': question.id,
                         'selected_choice_id': question.choices.get(is_correct=True).id}],
        }, format='json')
        self.assertEqual(stopped.status_code, 200)
        self.assertTrue(self.combined().data['recommendations_locked'])
        self.assertEqual(self.combined().data['combined_category_scores'], [])
        self.assertEqual(SkillScore.objects.get(student=self.student, assessment=assessment).raw_score, 1)
        self.client.force_authenticate(self.instructor)
        self.assertEqual(self.client.patch(reverse('instructor_student_retake', args=[self.student.id]), {
            'assessment_id': assessment.id, 'retake_allowed': True,
        }, format='json').status_code, 200)
        self.submit(assessment)
        self.assertFalse(self.combined().data['recommendations_locked'])
        self.assertEqual(self.combined().data['combined_category_scores'][0]['raw_score'], 1)

    def test_optional_only_batch_does_not_finalize_without_required_work(self):
        optional = self.make_assessment('Optional only', [self.database], is_required=False)
        submitted = self.submit(optional)
        self.assertTrue(submitted.data['recommendations_locked'])
        combined = self.combined().data
        self.assertFalse(combined['has_required_assessments'])
        self.assertFalse(combined['all_required_completed'])
        self.assertFalse(combined['is_finalized'])
        self.assertEqual(combined['recommendations'], [])
        self.assertEqual(combined['combined_category_scores'], [])

    def test_flagged_submitted_attempt_does_not_complete_requirement(self):
        assessment = self.make_assessment('Flagged required', [self.database])
        self.saved_score(assessment, self.database, 1, 1, flagged=True)
        profile, progress, recommendations = recalculate_combined(self.student, self.batch)
        self.assertEqual(progress['total_required_count'], 1)
        self.assertEqual(progress['completed_required_count'], 0)
        self.assertFalse(progress['all_required_completed'])
        self.assertFalse(profile.is_finalized)
        self.assertEqual(profile.included_assessment_ids, [])
        self.assertEqual(recommendations, [])

    def test_optional_excluded_draft_closed_and_stopped_evidence(self):
        required = self.make_assessment('Required', [self.database])
        optional = self.make_assessment('Optional', [self.network], is_required=False)
        excluded = self.make_assessment('Not competency', [self.programming], include_in_competency=False)
        draft = self.make_assessment('Draft', [self.network], publication_status='draft')
        closed = self.make_assessment('Closed history', [self.programming], publication_status='closed')
        stopped = self.make_assessment('Stopped', [self.network], is_required=False)
        self.saved_score(required, self.database, 2, 3)
        self.saved_score(optional, self.network, 1, 2)
        self.saved_score(excluded, self.programming, 9, 10)
        self.saved_score(draft, self.network, 9, 10)
        self.saved_score(closed, self.programming, 3, 5)
        self.saved_score(stopped, self.network, 9, 10, status='stopped', flagged=True)
        profile, progress, _ = recalculate_combined(self.student, self.batch)
        self.assertTrue(progress['all_required_completed'])
        self.assertEqual(progress['total_required_count'], 1)
        self.assertEqual(profile.included_assessment_ids, [required.id, optional.id, closed.id])
        self.assertEqual(set(CombinedCategoryScore.objects.filter(student=self.student, batch=self.batch).values_list('skill_category__name', flat=True)),
                         {'Database', 'Networking', 'Programming'})
        self.assertEqual(CombinedCategoryScore.objects.get(student=self.student, batch=self.batch, skill_category=self.network).raw_score, 1)

    def test_optional_completion_retake_and_new_requirement_recalculate(self):
        required = self.make_assessment('Required', [self.database])
        optional = self.make_assessment('Optional', [self.database], is_required=False)
        self.submit(required, correct=True)
        initial = self.combined().data
        self.assertFalse(initial['recommendations_locked'])
        self.assertEqual(initial['combined_category_scores'][0]['raw_score'], 1)
        self.submit(optional, correct=True)
        updated = self.combined().data
        self.assertEqual(updated['combined_category_scores'][0]['raw_score'], 2)
        self.assertEqual(updated['combined_category_scores'][0]['max_score'], 2)

        self.client.force_authenticate(self.instructor)
        self.assertEqual(self.client.patch(reverse('instructor_student_retake', args=[self.student.id]), {
            'assessment_id': optional.id, 'retake_allowed': True,
        }, format='json').status_code, 200)
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.post(reverse('assessment_start', args=[optional.id])).status_code, 200)
        history = AssessmentAttemptHistory.objects.get(
            response__student=self.student, response__assessment=optional,
        )
        self.assertEqual(history.status, 'submitted')
        self.assertEqual(history.attempt_number, 1)
        self.assertEqual(history.category_scores[0]['raw_score'], 1)
        self.assertEqual(history.answers[0]['question_id'], optional.questions.get().id)
        self.assertEqual(self.combined().data['combined_category_scores'][0]['raw_score'], 1)
        question = optional.questions.get()
        retaken = self.client.post(reverse('assessment_submit', args=[optional.id]), {
            'answers': [{'question_id': question.id,
                         'selected_choice_id': question.choices.get(is_correct=False).id}],
        }, format='json')
        self.assertEqual(retaken.status_code, 200)
        self.assertEqual(self.combined().data['combined_category_scores'][0]['raw_score'], 1)
        self.assertEqual(self.combined().data['combined_category_scores'][0]['max_score'], 2)
        self.assertEqual(SkillScore.objects.filter(student=self.student, assessment=optional).count(), 1)
        history.refresh_from_db()
        self.assertEqual(history.category_scores[0]['raw_score'], 1)
        self.client.force_authenticate(self.instructor)
        roster = self.client.get(reverse('instructor_batch_students', args=[self.batch.id])).data['students'][0]
        optional_result = next(row for row in roster['assessment_results'] if row['id'] == optional.id)
        self.assertEqual(optional_result['prior_attempts'][0]['category_scores'][0]['raw_score'], 1)

        self.client.force_authenticate(self.instructor)
        created = self.client.post(reverse('instructor_assessments'), {
            'title': 'New required', 'batch_id': self.batch.id,
            'questions': [{'question_text': 'Programming?', 'question_type': 'mcq',
                           'category': 'Programming', 'choices': [
                               {'text': 'Python', 'is_correct': True},
                               {'text': 'Wrong', 'is_correct': False},
                           ]}],
        }, format='json')
        self.assertEqual(created.status_code, 201)
        self.client.force_authenticate(self.student)
        self.assertTrue(self.combined().data['recommendations_locked'])
        self.assertEqual(self.client.get(reverse('student_results'), {'assessment_id': required.id}).data['recommendations'], [])
        self.assertEqual(Recommendation.objects.filter(student=self.student, batch=self.batch, is_current=True).count(), 0)
        self.submit(Assessment.objects.get(id=created.data['id']))
        self.assertFalse(self.combined().data['recommendations_locked'])

    def test_single_assessment_model_selection_and_answer_key_protection(self):
        config = RecommendationConfiguration.get_active()
        config.active_model = 'stanza_en'
        config.save(update_fields=['active_model'])
        comprehensive = self.make_assessment('Comprehensive', [self.database, self.network, self.programming])
        submitted = self.submit(comprehensive)
        self.assertFalse(submitted.data['recommendations_locked'])
        combined = self.combined().data
        self.assertEqual(combined['active_model'], 'stanza_en')
        self.assertEqual(combined['model_used'], 'stanza_en')
        self.assertIn('stanza_en', self.model_calls)
        self.assertEqual(len(combined['combined_category_scores']), 3)
        self.assertEqual({s['percentage'] for s in combined['combined_category_scores']}, {100.0})
        self.assertEqual(Recommendation.objects.get(student=self.student, batch=self.batch, position=self.position).match_score,
                         92.5)  # 60% category + 25% NLP + 15% neutral location
        review = self.client.get(reverse('student_results_review'), {'assessment_id': comprehensive.id})
        self.assertEqual(review.status_code, 200)
        self.assertNotIn('correct_answers', submitted.data)
        self.assertNotIn('is_correct', str(review.data))
        self.assertNotIn('correct_text', str(review.data))
        assessment_result = self.client.get(reverse('student_results'), {'assessment_id': comprehensive.id}).data
        self.assertEqual(assessment_result['assessment']['id'], comprehensive.id)
        self.assertEqual(assessment_result['assessment']['attempt_status'], 'submitted')
        self.assertEqual(len(assessment_result['skill_scores']), 3)
        self.assertFalse(assessment_result['recommendations_locked'])

    def test_admin_rerun_backfills_finished_legacy_batch(self):
        assessment = self.make_assessment('Legacy comprehensive', [self.database])
        self.saved_score(assessment, self.database, 7, 10)
        self.client.force_authenticate(self.admin)
        rerun = self.client.post(reverse('admin_rerun_recommendations'))
        self.assertEqual(rerun.status_code, 200)
        self.assertGreaterEqual(rerun.data['students_processed'], 1)
        self.assertEqual(rerun.data['errors'], 0)
        profile = CombinedCompetencyProfile.objects.get(student=self.student, batch=self.batch)
        self.assertTrue(profile.is_finalized)
        self.assertEqual(profile.included_assessment_ids, [assessment.id])
        self.assertTrue(Recommendation.objects.filter(student=self.student, batch=self.batch, is_current=True).exists())

    def test_approved_placement_snapshot_is_untouched_by_recalculation(self):
        assessment = self.make_assessment('Required', [self.database])
        self.submit(assessment)
        recommendation = Recommendation.objects.get(student=self.student, batch=self.batch, position=self.position)
        placement = OJTPlacement.objects.create(
            student=self.student, company=self.company, position=self.position,
            recommendation=recommendation, batch=self.batch, status='approved',
            match_score_at_assignment=recommendation.match_score,
        )
        snapshot = placement.match_score_at_assignment
        recalculate_combined(self.student, self.batch)
        placement.refresh_from_db()
        self.assertEqual(placement.recommendation_id, recommendation.id)
        self.assertEqual(placement.match_score_at_assignment, snapshot)
