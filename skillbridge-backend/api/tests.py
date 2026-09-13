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
