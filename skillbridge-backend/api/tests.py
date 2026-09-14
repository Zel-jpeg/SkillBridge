from unittest.mock import patch

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import (
    AnswerChoice,
    Assessment,
    Batch,
    BatchEnrollment,
    Company,
    OJTPlacement,
    Position,
    PositionRequirement,
    Question,
    Recommendation,
    RecommendationConfiguration,
    ResponseAnswer,
    SkillCategory,
    SkillScore,
    StudentResponse,
    StudentCompetencyProfile,
    User,
)


class AssessmentRandomizationTests(APITestCase):
    def setUp(self):
        self.instructor = User.objects.create_user(
            email='instructor@example.com',
            name='Test Instructor',
            role='instructor',
        )
        self.student = User.objects.create_user(
            email='student@example.com',
            name='Student One',
            role='student',
        )
        self.other_student = User.objects.create_user(
            email='student2@example.com',
            name='Student Two',
            role='student',
        )
        self.batch = Batch.objects.create(name='Test Batch', instructor=self.instructor)
        BatchEnrollment.objects.create(batch=self.batch, student=self.student)
        BatchEnrollment.objects.create(batch=self.batch, student=self.other_student)
        self.category = SkillCategory.objects.create(
            name='Programming',
            created_by=self.instructor,
        )
        self.assessment = Assessment.objects.create(
            title='Randomized Assessment',
            created_by=self.instructor,
            batch=self.batch,
            duration_minutes=30,
        )

        self.mcq = self._question('MCQ', 'mcq', 1)
        self.mcq_choices = [
            AnswerChoice.objects.create(
                question=self.mcq,
                choice_text=text,
                is_correct=index == 0,
            )
            for index, text in enumerate(('Correct', 'Wrong 1', 'Wrong 2', 'Wrong 3'))
        ]
        self.truefalse = self._question('True or false?', 'truefalse', 2)
        # Deliberately insert these backwards; the API must still return True, False.
        self.false_choice = AnswerChoice.objects.create(
            question=self.truefalse,
            choice_text='False',
            is_correct=False,
        )
        self.true_choice = AnswerChoice.objects.create(
            question=self.truefalse,
            choice_text='True',
            is_correct=True,
        )
        self.identification = self._question('Name the term', 'identification', 3)
        AnswerChoice.objects.create(
            question=self.identification,
            choice_text='Expected term',
            is_correct=True,
        )
        # Extra questions make accidental identical student permutations unlikely.
        self._question('MCQ 2', 'mcq', 4)
        self._question('Identification 2', 'identification', 5)

        self.start_url = reverse('assessment_start', args=[self.assessment.id])

    def _question(self, text, question_type, order):
        return Question.objects.create(
            assessment=self.assessment,
            skill_category=self.category,
            question_text=text,
            question_type=question_type,
            question_order=order,
        )

    def _start_as(self, student):
        self.client.force_authenticate(student)
        return self.client.post(self.start_url, format='json')

    def test_start_stores_and_reuses_layout_without_exposing_correctness(self):
        first = self._start_as(self.student)
        second = self._start_as(self.student)

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.data['questions'], second.data['questions'])
        self.assertNotEqual(
            StudentResponse.objects.get(student=self.student).question_layout,
            {},
        )

        by_id = {question['id']: question for question in first.data['questions']}
        self.assertEqual(
            [choice['text'] for choice in by_id[self.truefalse.id]['choices']],
            ['True', 'False'],
        )
        self.assertEqual(by_id[self.identification.id]['choices'], [])
        self.assertNotIn('is_correct', by_id[self.mcq.id]['choices'][0])
        self.assertCountEqual(
            [choice['id'] for choice in by_id[self.mcq.id]['choices']],
            [choice.id for choice in self.mcq_choices],
        )

    def test_each_student_gets_an_independently_stored_layout(self):
        first = self._start_as(self.student)
        second = self._start_as(self.other_student)

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        layouts = StudentResponse.objects.filter(assessment=self.assessment).values_list(
            'question_layout', flat=True,
        )
        self.assertEqual(len(layouts), 2)
        self.assertTrue(all(layout.get('question_ids') for layout in layouts))
        self.assertTrue(all(str(self.mcq.id) in layout.get('mcq_choice_ids', {}) for layout in layouts))

    def test_submit_scores_real_ids_and_review_keeps_attempt_layout(self):
        started = self._start_as(self.student)
        randomized_question_ids = [question['id'] for question in started.data['questions']]
        randomized_mcq_ids = next(
            question['choices']
            for question in started.data['questions']
            if question['id'] == self.mcq.id
        )

        submit = self.client.post(
            reverse('assessment_submit', args=[self.assessment.id]),
            {
                'answers': [
                    {
                        'question_id': self.mcq.id,
                        'selected_choice_id': self.mcq_choices[0].id,
                    },
                    {
                        'question_id': self.truefalse.id,
                        'selected_choice_id': self.true_choice.id,
                    },
                    {
                        'question_id': self.identification.id,
                        'text_answer': ' expected TERM ',
                    },
                ],
            },
            format='json',
        )

        self.assertEqual(submit.status_code, 200)
        self.assertEqual(submit.data['scores']['Programming']['raw'], 3)
        self.assertEqual(
            StudentResponse.objects.get(student=self.student).status,
            StudentResponse.STATUS_SUBMITTED,
        )
        self.assertEqual(ResponseAnswer.objects.filter(
            response__student=self.student,
        ).count(), 3)

        review = self.client.get(reverse('student_results_review'))
        self.assertEqual(review.status_code, 200)
        self.assertEqual(
            [question['id'] for question in review.data['questions']],
            randomized_question_ids,
        )
        review_mcq = next(
            question for question in review.data['questions'] if question['id'] == self.mcq.id
        )
        self.assertEqual(
            [choice['id'] for choice in review_mcq['choices']],
            [choice['id'] for choice in randomized_mcq_ids],
        )
        self.assertTrue(next(
            choice for choice in review_mcq['choices'] if choice['id'] == self.mcq_choices[0].id
        )['is_correct'])

    def test_allowed_retake_gets_a_fresh_layout(self):
        self._start_as(self.student)
        response = StudentResponse.objects.get(student=self.student)
        first_layout = response.question_layout
        fresh_layout = {
            **first_layout,
            'question_ids': first_layout['question_ids'][1:] + first_layout['question_ids'][:1],
        }
        response.submitted_at = response.started_at
        response.retake_allowed = True
        response.save(update_fields=['submitted_at', 'retake_allowed'])

        with patch('api.views.build_question_layout', return_value=fresh_layout):
            restarted = self._start_as(self.student)
        response.refresh_from_db()

        self.assertEqual(restarted.status_code, 200)
        self.assertIsNone(response.submitted_at)
        self.assertFalse(response.retake_allowed)
        self.assertEqual(response.question_layout, fresh_layout)

    def test_integrity_stop_saves_partial_answers_and_is_idempotent(self):
        started = self._start_as(self.student)
        stop_url = reverse('assessment_stop', args=[self.assessment.id])
        payload = {
            'response_id': started.data['response_id'],
            'reason': 'restricted_shortcut',
            'detail': 'Ctrl+C',
            'answers': [{
                'question_id': self.mcq.id,
                'selected_choice_id': self.mcq_choices[0].id,
            }],
        }

        stopped = self.client.post(stop_url, payload, format='json')
        duplicate = self.client.post(
            stop_url,
            {**payload, 'reason': 'tab_hidden', 'detail': ''},
            format='json',
        )

        self.assertEqual(stopped.status_code, 200)
        self.assertEqual(duplicate.status_code, 200)
        self.assertTrue(duplicate.data['already_stopped'])
        response = StudentResponse.objects.get(student=self.student)
        self.assertEqual(response.status, StudentResponse.STATUS_STOPPED)
        self.assertEqual(response.stopped_reason, 'restricted_shortcut')
        self.assertIn('Ctrl+C', response.stopped_reason_display)
        self.assertEqual(response.violation_count, 1)
        self.assertEqual(len(response.violation_events), 1)
        self.assertTrue(response.is_flagged)
        self.assertIsNotNone(response.stopped_at)
        self.assertIsNotNone(response.submitted_at)
        self.assertEqual(ResponseAnswer.objects.filter(response=response).count(), 1)

        blocked_start = self._start_as(self.student)
        self.assertEqual(blocked_start.status_code, 409)

        active = self.client.get(reverse('assessment_active'))
        self.assertEqual(active.status_code, 200)
        self.assertEqual(active.data['attempt_status'], StudentResponse.STATUS_STOPPED)
        self.assertTrue(active.data['is_flagged'])

    def test_authorized_retake_clears_stopped_integrity_state(self):
        started = self._start_as(self.student)
        self.client.post(
            reverse('assessment_stop', args=[self.assessment.id]),
            {
                'response_id': started.data['response_id'],
                'reason': 'tab_hidden',
                'answers': [],
            },
            format='json',
        )

        self.client.force_authenticate(self.instructor)
        allowed = self.client.patch(
            reverse('instructor_student_retake', args=[self.student.id]),
            {'retake_allowed': True},
            format='json',
        )
        self.assertEqual(allowed.status_code, 200)

        restarted = self._start_as(self.student)
        self.assertEqual(restarted.status_code, 200)
        response = StudentResponse.objects.get(student=self.student)
        self.assertEqual(response.status, StudentResponse.STATUS_IN_PROGRESS)
        self.assertFalse(response.is_flagged)
        self.assertEqual(response.stopped_reason, '')
        self.assertEqual(response.violation_events, [])
        self.assertEqual(response.violation_count, 0)
        self.assertIsNone(response.stopped_at)

    def test_admin_can_allow_retake_but_student_cannot(self):
        started = self._start_as(self.student)
        self.client.post(
            reverse('assessment_stop', args=[self.assessment.id]),
            {'response_id': started.data['response_id'], 'reason': 'window_lost_focus', 'answers': []},
            format='json',
        )
        retake_url = reverse('instructor_student_retake', args=[self.student.id])

        self.client.force_authenticate(self.other_student)
        forbidden = self.client.patch(retake_url, {'retake_allowed': True}, format='json')
        self.assertEqual(forbidden.status_code, 403)

        admin = User.objects.create_user(
            email='admin@example.com',
            name='Test Admin',
            role='admin',
        )
        self.client.force_authenticate(admin)
        allowed = self.client.patch(retake_url, {'retake_allowed': True}, format='json')
        self.assertEqual(allowed.status_code, 200)
        self.assertTrue(allowed.data['retake_allowed'])

    def test_normal_submit_wins_over_late_stop(self):
        started = self._start_as(self.student)
        submitted = self.client.post(
            reverse('assessment_submit', args=[self.assessment.id]),
            {'response_id': started.data['response_id'], 'answers': []},
            format='json',
        )
        late_stop = self.client.post(
            reverse('assessment_stop', args=[self.assessment.id]),
            {'response_id': started.data['response_id'], 'reason': 'page_closed', 'answers': []},
            format='json',
        )
        self.assertEqual(submitted.status_code, 200)
        self.assertEqual(late_stop.status_code, 409)
        response = StudentResponse.objects.get(student=self.student)
        self.assertEqual(response.status, StudentResponse.STATUS_SUBMITTED)
        self.assertFalse(response.is_flagged)


class HybridRecommendationTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email='hybrid-admin@example.com', name='Hybrid Admin', role='admin',
        )
        self.student = User.objects.create_user(
            email='hybrid-student@example.com', name='Hybrid Student', role='student',
            address={'pinLat': 7.0644, 'pinLng': 125.6078},
        )
        self.category = SkillCategory.objects.create(
            name='Programming', tags=['Python', 'Django'], created_by=self.admin,
        )
        self.assessment = Assessment.objects.create(
            title='Hybrid Test', created_by=self.admin,
        )
        StudentResponse.objects.create(
            student=self.student,
            assessment=self.assessment,
            started_at=timezone.now(),
            submitted_at=timezone.now(),
            status=StudentResponse.STATUS_SUBMITTED,
        )
        SkillScore.objects.create(
            student=self.student, assessment=self.assessment,
            skill_category=self.category, raw_score=9, max_score=10, percentage=90,
        )
        self.company = Company.objects.create(
            name='Near Company', location_lat=7.0644, location_lng=125.6078,
            added_by=self.admin,
        )
        self.position = Position.objects.create(
            company=self.company, title='Backend Developer Intern',
            tags=['REST API', 'Django'],
        )
        PositionRequirement.objects.create(
            position=self.position, skill_category=self.category, required_percentage=90,
        )

    @patch('api.recommendation_nlp.preprocess_texts')
    def test_hybrid_formula_and_components_are_persisted(self, preprocess):
        preprocess.return_value = (
            ['python django backend', 'python django backend'], 'simple_fallback', None,
        )
        from .scoring import generate_recommendations

        results = generate_recommendations(self.student, self.assessment, [self.category])
        recommendation = Recommendation.objects.get(student=self.student, position=self.position)

        self.assertEqual(results[0]['match_score'], 100.0)
        self.assertEqual(recommendation.category_score_component, 100.0)
        self.assertEqual(recommendation.nlp_score_component, 100.0)
        self.assertEqual(recommendation.location_score_component, 100.0)
        self.assertEqual(recommendation.model_used, 'simple_fallback')
        self.assertEqual(recommendation.distance_km, 0.0)
        profile = StudentCompetencyProfile.objects.get(
            student=self.student, assessment=self.assessment,
        )
        self.assertEqual(profile.orientation_label, 'Backend and data-oriented')
        self.assertIn('Programming (90.0%)', profile.orientation_summary)
        self.assertNotIn(self.position.title, profile.orientation_summary)
        self.assertIn('backend and data-oriented', profile.competency_profile_text.lower())
        self.assertNotIn(self.position.title, profile.competency_profile_text)
        self.assertTrue(profile.development_suggestions)
        self.client.force_authenticate(self.student)
        response = self.client.get(reverse('student_results'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data['competency_profile']['orientation_label'],
            'Backend and data-oriented',
        )

    @patch('api.recommendation_nlp.preprocess_texts')
    def test_missing_location_uses_neutral_component(self, preprocess):
        self.student.address = {}
        self.student.save(update_fields=['address'])
        preprocess.return_value = (
            ['python django backend', 'python django backend'], 'simple_fallback', None,
        )
        from .scoring import generate_recommendations

        generate_recommendations(self.student, self.assessment, [self.category])
        recommendation = Recommendation.objects.get(student=self.student, position=self.position)
        self.assertEqual(recommendation.location_score_component, 50.0)
        self.assertIsNone(recommendation.distance_km)
        self.assertEqual(recommendation.match_score, 92.5)

    def test_admin_can_select_model_and_request_non_persisting_tag_suggestions(self):
        self.client.force_authenticate(self.admin)
        suggestion = self.client.post(
            reverse('suggest_tags'), {'type': 'skill', 'name': 'Database'}, format='json',
        )
        selected = self.client.patch(
            reverse('admin_nlp_configuration'), {'active_model': 'spacy_sm'}, format='json',
        )

        self.assertEqual(suggestion.status_code, 200)
        self.assertIn('SQL', suggestion.data['suggested_tags'])
        self.category.refresh_from_db()
        self.assertEqual(self.category.tags, ['Python', 'Django'])
        self.assertEqual(selected.status_code, 200)
        self.assertEqual(RecommendationConfiguration.get_active().active_model, 'spacy_sm')


class OJTPlacementAPITests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email='placement-admin@example.com', name='Placement Admin', role='admin',
        )
        self.instructor = User.objects.create_user(
            email='placement-instructor@example.com', name='Placement Instructor',
            role='instructor', is_approved=True,
        )
        self.other_instructor = User.objects.create_user(
            email='other-instructor@example.com', name='Other Instructor',
            role='instructor', is_approved=True,
        )
        self.student_one = User.objects.create_user(
            email='placement-one@example.com', name='Student One', role='student',
            school_id='S-001', course='BSIT',
        )
        self.student_two = User.objects.create_user(
            email='placement-two@example.com', name='Student Two', role='student',
            school_id='S-002', course='BSIT',
        )
        self.student_three = User.objects.create_user(
            email='placement-three@example.com', name='Student Three', role='student',
            school_id='S-003', course='BSCS',
        )
        self.batch = Batch.objects.create(
            name='Placement Batch', instructor=self.instructor,
        )
        self.other_batch = Batch.objects.create(
            name='Other Batch', instructor=self.other_instructor,
        )
        BatchEnrollment.objects.create(batch=self.batch, student=self.student_one)
        BatchEnrollment.objects.create(batch=self.batch, student=self.student_two)
        BatchEnrollment.objects.create(batch=self.other_batch, student=self.student_three)

        self.company = Company.objects.create(name='Company One', added_by=self.admin)
        self.other_company = Company.objects.create(name='Company Two', added_by=self.admin)
        self.position = Position.objects.create(
            company=self.company, title='Developer Intern', slots_available=1,
        )
        self.other_position = Position.objects.create(
            company=self.other_company, title='QA Intern', slots_available=2,
        )
        self.recommendation_one = Recommendation.objects.create(
            student=self.student_one,
            position=self.position,
            match_score=95,
            category_score_component=90,
            nlp_score_component=96,
            location_score_component=100,
            distance_km=1.5,
        )
        self.recommendation_two = Recommendation.objects.create(
            student=self.student_two,
            position=self.position,
            match_score=80,
            category_score_component=82,
            nlp_score_component=78,
            location_score_component=80,
            distance_km=3.5,
        )
        self.other_recommendation = Recommendation.objects.create(
            student=self.student_one,
            position=self.other_position,
            match_score=75,
            category_score_component=80,
            nlp_score_component=70,
            location_score_component=75,
            distance_km=5,
        )

    def _approve(self, recommendation):
        self.client.force_authenticate(self.admin)
        return self.client.post(
            reverse('placement_approve'),
            {'recommendation_id': recommendation.id, 'remarks': 'Approved for OJT'},
            format='json',
        )

    def test_suggestions_are_ranked_and_instructor_is_batch_scoped(self):
        Recommendation.objects.create(
            student=self.student_three, position=self.position, match_score=99,
        )
        self.client.force_authenticate(self.instructor)
        response = self.client.get(reverse('placement_suggestions'))

        self.assertEqual(response.status_code, 200)
        position = next(
            item
            for company in response.data['companies']
            for item in company['positions']
            if item['id'] == self.position.id
        )
        self.assertEqual(
            [item['student']['id'] for item in position['suggested_students']],
            [self.student_one.id, self.student_two.id],
        )
        self.assertEqual(position['approved_count'], 0)
        self.assertEqual(position['remaining_slots'], 1)
        self.assertEqual(position['suggested_students'][0]['placement_status'], 'unplaced')

    def test_approve_snapshots_scores_and_blocks_duplicate_and_capacity(self):
        approved = self._approve(self.recommendation_one)
        duplicate = self._approve(self.other_recommendation)
        full = self._approve(self.recommendation_two)

        self.assertEqual(approved.status_code, 201)
        placement = OJTPlacement.objects.get(id=approved.data['placement']['id'])
        self.assertEqual(placement.status, OJTPlacement.STATUS_APPROVED)
        self.assertEqual(placement.match_score_at_assignment, 95)
        self.assertEqual(placement.category_score_component_at_assignment, 90)
        self.assertEqual(placement.nlp_score_component_at_assignment, 96)
        self.assertEqual(placement.location_score_component_at_assignment, 100)
        self.assertEqual(placement.distance_km_at_assignment, 1.5)
        self.assertEqual(placement.approved_by, self.admin)
        self.assertIsNotNone(placement.approved_at)
        self.assertEqual(duplicate.status_code, 409)
        self.assertIn('already has', duplicate.data['error'])
        self.assertEqual(full.status_code, 409)
        self.assertIn('No remaining slots', full.data['error'])

        suggestions = self.client.get(reverse('placement_suggestions'))
        position = next(
            item
            for company in suggestions.data['companies']
            for item in company['positions']
            if item['id'] == self.position.id
        )
        self.assertEqual(position['approved_count'], 1)
        self.assertEqual(position['remaining_slots'], 0)

        other_position = next(
            item
            for company in suggestions.data['companies']
            for item in company['positions']
            if item['id'] == self.other_position.id
        )
        self.assertEqual(other_position['suggested_students'], [])
        with_placed = self.client.get(
            reverse('placement_suggestions'), {'include_placed': 'true'},
        )
        other_position = next(
            item
            for company in with_placed.data['companies']
            for item in company['positions']
            if item['id'] == self.other_position.id
        )
        self.assertEqual(
            other_position['suggested_students'][0]['placement_status'],
            'already_placed',
        )

    def test_remove_and_reject_preserve_history_and_hide_normal_suggestions(self):
        approved = self._approve(self.recommendation_one)
        placement_id = approved.data['placement']['id']
        removed = self.client.post(
            reverse('placement_remove'),
            {'placement_id': placement_id, 'remarks': 'Student withdrew'},
            format='json',
        )
        rejected = self.client.post(
            reverse('placement_reject'),
            {'recommendation_id': self.recommendation_two.id, 'remarks': 'Not selected'},
            format='json',
        )

        self.assertEqual(removed.status_code, 200)
        self.assertEqual(rejected.status_code, 200)
        self.assertEqual(OJTPlacement.objects.count(), 2)
        self.assertIsNotNone(OJTPlacement.objects.get(id=placement_id).removed_at)
        self.assertIsNotNone(
            OJTPlacement.objects.get(recommendation=self.recommendation_two).rejected_at,
        )

        normal = self.client.get(reverse('placement_suggestions'))
        normal_position = next(
            item
            for company in normal.data['companies']
            for item in company['positions']
            if item['id'] == self.position.id
        )
        self.assertEqual(normal_position['suggested_students'], [])
        history_view = self.client.get(
            reverse('placement_suggestions'), {'include_history': 'true'},
        )
        history_position = next(
            item
            for company in history_view.data['companies']
            for item in company['positions']
            if item['id'] == self.position.id
        )
        self.assertEqual(
            {item['placement_status'] for item in history_position['suggested_students']},
            {'removed', 'rejected'},
        )
        history = self.client.get(reverse('placement_history'))
        self.assertEqual(history.status_code, 200)
        self.assertEqual(history.data['count'], 2)

    def test_manual_assignment_without_recommendation_allows_null_scores(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            reverse('placement_manual_assign'),
            {
                'student_id': self.student_three.id,
                'position_id': self.other_position.id,
                'batch_id': self.other_batch.id,
                'remarks': 'Coordinator assignment',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        placement = OJTPlacement.objects.get(id=response.data['placement']['id'])
        self.assertIsNone(placement.recommendation_id)
        self.assertIsNone(placement.match_score_at_assignment)
        self.assertEqual(placement.status, OJTPlacement.STATUS_APPROVED)
        self.assertEqual(placement.assigned_by, self.admin)

    def test_instructor_can_manage_own_students_but_not_other_batches(self):
        self.client.force_authenticate(self.instructor)
        approved = self.client.post(
            reverse('placement_approve'),
            {'recommendation_id': self.recommendation_one.id, 'remarks': 'Instructor approved'},
            format='json',
        )
        forbidden = self.client.post(
            reverse('placement_manual_assign'),
            {'student_id': self.student_three.id, 'position_id': self.other_position.id},
            format='json',
        )
        removed = self.client.post(
            reverse('placement_remove'),
            {
                'placement_id': approved.data['placement']['id'],
                'remarks': 'Placement changed',
            },
            format='json',
        )
        manual = self.client.post(
            reverse('placement_manual_assign'),
            {
                'student_id': self.student_two.id,
                'position_id': self.other_position.id,
                'remarks': 'Instructor manual assignment',
            },
            format='json',
        )

        self.assertEqual(approved.status_code, 201)
        self.assertEqual(forbidden.status_code, 403)
        self.assertEqual(removed.status_code, 200)
        self.assertEqual(manual.status_code, 201)
        history = self.client.get(reverse('placement_history'))
        self.assertEqual(history.status_code, 200)
        self.assertEqual(history.data['count'], 2)
        self.assertEqual(
            {item['student']['id'] for item in history.data['placements']},
            {self.student_one.id, self.student_two.id},
        )

    def test_placement_report_returns_export_ready_records_and_summary(self):
        self.company.address = {
            'barangay': 'San Isidro', 'city': 'Tagum', 'province': 'Davao del Norte',
        }
        self.company.save(update_fields=['address'])
        approved = self._approve(self.recommendation_one)

        response = self.client.get(reverse('placement_reports'), {
            'report_type': 'company_placements',
            'status': 'approved',
            'company_id': self.company.id,
            'batch_id': self.batch.id,
            'course': 'BSIT',
            'area': 'Tagum',
        })

        self.assertEqual(approved.status_code, 201)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['report_type'], 'company_placements')
        self.assertEqual(response.data['summary']['total_records'], 1)
        self.assertEqual(response.data['summary']['approved_count'], 1)
        record = response.data['records'][0]
        self.assertEqual(record['student']['email'], self.student_one.email)
        self.assertEqual(record['company']['address_text'], 'San Isidro, Tagum, Davao del Norte')
        self.assertEqual(record['position']['slots_available'], 1)
        self.assertEqual(record['position']['remaining_slots'], 0)
        self.assertEqual(record['match_score_at_assignment'], 95)

    def test_placement_report_preserves_history_and_scopes_instructor(self):
        approved = self._approve(self.recommendation_one)
        self.client.post(
            reverse('placement_remove'),
            {'placement_id': approved.data['placement']['id'], 'remarks': 'Removed'},
            format='json',
        )
        self.client.post(
            reverse('placement_reject'),
            {'recommendation_id': self.recommendation_two.id, 'remarks': 'Rejected'},
            format='json',
        )
        self.client.force_authenticate(self.admin)
        self.client.post(
            reverse('placement_manual_assign'),
            {
                'student_id': self.student_three.id,
                'position_id': self.other_position.id,
                'batch_id': self.other_batch.id,
            },
            format='json',
        )

        self.client.force_authenticate(self.instructor)
        response = self.client.get(reverse('placement_reports'), {
            'report_type': 'placement_history', 'status': 'all',
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['generated_by']['id'], self.instructor.id)
        self.assertEqual(
            {record['student']['id'] for record in response.data['records']},
            {self.student_one.id, self.student_two.id},
        )
        self.assertEqual(
            {record['status'] for record in response.data['records']},
            {'removed', 'rejected'},
        )

    def test_placement_report_validates_report_and_date_filters(self):
        self.client.force_authenticate(self.admin)
        invalid_type = self.client.get(reverse('placement_reports'), {
            'report_type': 'analytics',
        })
        invalid_date = self.client.get(reverse('placement_reports'), {
            'report_type': 'student_placements', 'date_from': '09/13/2026',
        })
        reversed_dates = self.client.get(reverse('placement_reports'), {
            'report_type': 'student_placements',
            'date_from': '2026-09-14', 'date_to': '2026-09-13',
        })

        self.assertEqual(invalid_type.status_code, 400)
        self.assertEqual(invalid_date.status_code, 400)
        self.assertEqual(reversed_dates.status_code, 400)

    def test_placement_analytics_counts_capacity_and_groups_areas(self):
        self.student_one.address = {'city': 'Tagum', 'province': 'Davao del Norte'}
        self.student_two.address = {'province': 'Davao del Norte'}
        self.student_one.save(update_fields=['address'])
        self.student_two.save(update_fields=['address'])
        self.company.address = {'city': 'Tagum', 'province': 'Davao del Norte'}
        self.other_company.address = {'province': 'Davao del Norte'}
        self.company.save(update_fields=['address'])
        self.other_company.save(update_fields=['address'])
        self._approve(self.recommendation_one)

        response = self.client.get(reverse('placement_analytics'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['summary'], {
            'total_ojt_slots': 3,
            'approved_placements': 1,
            'remaining_slots': 2,
            'unplaced_students': 2,
            'placement_fill_rate': 33.3,
        })
        areas = {row['area']: row for row in response.data['area_breakdown']}
        self.assertEqual(areas['Tagum']['student_count'], 1)
        self.assertEqual(areas['Tagum']['approved_placements'], 1)
        self.assertEqual(areas['Tagum']['available_slots'], 0)
        self.assertEqual(areas['Davao del Norte']['unplaced_students'], 1)
        self.assertEqual(areas['Davao del Norte']['company_count'], 1)
        self.assertEqual(areas['Davao del Norte']['available_slots'], 2)
        self.assertEqual(areas['Unknown Area']['student_count'], 1)
        self.assertEqual(areas['Unknown Area']['unplaced_students'], 1)
        self.assertEqual(
            response.data['top_areas']['by_placement_count'][0],
            {'area': 'Tagum', 'count': 1},
        )

        self.client.force_authenticate(self.instructor)
        self.assertEqual(
            self.client.get(reverse('placement_analytics')).status_code, 403,
        )

    def test_student_sees_only_approved_placement_and_instructor_sees_status(self):
        self.company.address = {
            'barangay': 'San Isidro', 'city': 'Tagum', 'province': 'Davao del Norte',
        }
        self.company.save(update_fields=['address'])
        approved = self._approve(self.recommendation_one)
        rejected = self.client.post(
            reverse('placement_reject'),
            {'recommendation_id': self.recommendation_two.id, 'remarks': 'Not selected'},
            format='json',
        )
        self.assertEqual(approved.status_code, 201)
        self.assertEqual(rejected.status_code, 200)

        self.client.force_authenticate(self.student_one)
        me = self.client.get(reverse('student_me'))
        results = self.client.get(reverse('student_results'))
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.data['placement']['status'], 'approved')
        self.assertEqual(me.data['placement']['company']['name'], 'Company One')
        self.assertEqual(me.data['placement']['position']['title'], 'Developer Intern')
        self.assertEqual(me.data['placement']['match_score_at_assignment'], 95)
        self.assertEqual(
            me.data['placement']['company']['address_text'],
            'San Isidro, Tagum, Davao del Norte',
        )
        self.assertEqual(results.data['placement']['id'], me.data['placement']['id'])

        self.client.force_authenticate(self.student_two)
        self.assertIsNone(self.client.get(reverse('student_me')).data['placement'])
        self.assertIsNone(self.client.get(reverse('student_results')).data['placement'])

        self.client.force_authenticate(self.instructor)
        batch_students = self.client.get(
            reverse('instructor_batch_students', args=[self.batch.id]),
        )
        dashboard_students = self.client.get(
            reverse('instructor_student_recommendations'),
        )
        batch_statuses = {
            row['id']: row['placement']['status']
            for row in batch_students.data['students']
        }
        dashboard_statuses = {
            row['id']: row['placement']['status']
            for row in dashboard_students.data
        }
        self.assertEqual(batch_statuses[self.student_one.id], 'approved')
        self.assertEqual(batch_statuses[self.student_two.id], 'rejected')
        self.assertEqual(dashboard_statuses, batch_statuses)
