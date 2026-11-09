"""Generic program API journey joining coordinator catalogs to real graded evidence."""
from uuid import uuid4
from unittest.mock import patch

from rest_framework.test import APITestCase

from .models import (Assessment, Batch, BatchEnrollment, OJTPlacement, Question,
                     Recommendation, SkillScore, User)
from .recommendation_policy import placement_evidence


class CoordinatorAcceptanceTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user('accept-admin@example.invalid', role='admin')
        self.owner = User.objects.create_user('accept-owner@example.invalid', role='instructor', is_approved=True)
        self.peer = User.objects.create_user('accept-peer@example.invalid', role='instructor', is_approved=True)
        preprocessor = patch('api.recommendation_nlp.preprocess_texts',
                             side_effect=lambda texts, model: (['reviewed synthetic record'] * len(texts), model, None))
        preprocessor.start()
        self.addCleanup(preprocessor.stop)

    def request(self, user, method, url, data=None, status=200):
        # Match JWT authentication, which resolves current saved account fields.
        self.client.force_authenticate(User.objects.get(pk=user.pk))
        response = getattr(self.client, method)(url, data or {}, format='json')
        self.assertEqual(response.status_code, status, (url, response.data))
        return response.data

    def prepare(self, index, name, company=None):
        # Names are demonstration content; all programs use these same endpoints.
        institute = self.request(self.admin, 'post', '/api/admin/institutes/',
            {'code': f'ACCEPT{index}', 'name': f'Synthetic institute {index}'}, 201)
        programs = f'/api/admin/institutes/{institute["id"]}/programs/'
        program = self.request(self.admin, 'post', programs, {'code': f'DEG{index}', 'name': name}, 201)
        grants = programs + f'{program["id"]}/instructors/'
        grant = self.request(self.admin, 'post', grants, {'instructor_id': self.owner.pk}, 201)
        self.request(self.admin, 'post', grants, {'instructor_id': self.peer.pk}, 201)
        base = f'/api/management/programs/{program["id"]}/'
        framework = self.request(self.owner, 'post', base + 'frameworks/',
            {'name': 'Reviewed knowledge', 'request_id': str(uuid4())}, 201)
        framework_url = base + f'frameworks/{framework["id"]}/'
        categories = [self.request(self.owner, 'post', framework_url + 'categories/',
            {'name': category, 'description': 'Identifies the correct document and procedure.', 'tags': ['Reviewed records']}, 201)
            for category in ['Records knowledge', 'Service knowledge']]
        self.assertFalse(Batch.objects.filter(program_id=program['id']).exists())
        if company is None:
            company = self.request(self.owner, 'post', base + 'partners/', {'name': 'Coordinator shared organization'}, 201)
        else:
            lookup = self.request(self.owner, 'get', base + 'partner-options/')
            self.assertIn(company['id'], [row['id'] for row in lookup['results']])
            self.assertTrue(all(set(row) == {'id', 'name', 'address'} for row in lookup['results']))
        position = self.request(self.owner, 'post', base + f'partners/{company["id"]}/positions/', {
            'title': name + ' records opening', 'slots': 1, 'tags': ['Reviewed records'], 'reuse_existing': True,
            'category_requirements': [{'category_id': row['id'], 'percentage': 50} for row in categories],
        }, 201)
        batch = self.request(self.owner, 'post', '/api/instructor/batches/',
            {'name': name + ' cohort', 'program_id': program['id']}, 201)
        enroll = f'/api/instructor/batches/{batch["id"]}/enroll/'
        review = self.request(self.owner, 'post', enroll + 'preview/', {'students': [{
            'school_id': f'2099-{index + 1:05}', 'name': f'Synthetic learner {index}',
            'email': f'accept-{index}@dnsc.edu.ph', 'course': program['code'],
        }]})
        payload = {'students': review['rows'], 'review_token': review['review_token'],
                   'request_id': str(uuid4()), 'email_mode': 'later'}
        self.request(self.owner, 'post', enroll, payload)
        self.request(self.owner, 'post', enroll, payload)  # reviewed replay retains one membership
        student = User.objects.get(email=f'accept-{index}@dnsc.edu.ph')
        self.assertEqual(BatchEnrollment.objects.filter(batch_id=batch['id']).count(), 1)
        self.assertEqual(student.program_id, program['id'])
        self.request(student, 'patch', '/api/students/me/profile/', {'phone': '09000000000',
            'stayingAt': 'home', 'travelWilling': 'panabo', 'homeProvince': 'Davao del Norte',
            'homeCity': 'Panabo City', 'homeBarangay': 'Synthetic Barangay', 'pinLat': 7.3, 'pinLng': 125.7})
        records, service = [row['id'] for row in categories]
        def choice(category, kind='mcq'):
            return {'question_type': kind, 'question_text': 'Choose the reviewed response.', 'category_id': category,
                'choices': [{'text': 'True' if kind == 'truefalse' else 'Reviewed record', 'is_correct': kind != 'truefalse'},
                            {'text': 'False' if kind == 'truefalse' else 'Other record', 'is_correct': kind == 'truefalse'}]}
        groups = [[choice(records), choice(records, 'truefalse')], [
            {'question_type': 'identification', 'question_text': 'Enter the count when no records exist.',
             'category_id': records, 'correct_answer': '0', 'choices': []}, choice(service)]]
        exams = []
        for number, questions in enumerate(groups):
            digest = self.request(self.owner, 'get', framework_url)['digest']
            exam = self.request(self.owner, 'post', '/api/instructor/assessments/', {
                'title': f'{name} knowledge {number + 1}', 'batch_id': batch['id'], 'framework_id': framework['id'],
                'framework_digest': digest, 'duration_minutes': 30, 'publication_status': 'published',
                'is_required': True, 'include_in_competency': True, 'questions': questions,
            }, 201)
            exams.append(exam)
        return dict(program=program, base=base, grant_url=grants + f'{grant["id"]}/', company=company,
                    position=position, batch=batch, student=student, categories=categories, exams=exams)

    def complete(self, scenario):
        student = scenario['student']
        before = self.request(student, 'get', '/api/student/results/combined/')
        self.assertTrue(before['recommendations_locked'])
        for number, exam in enumerate(scenario['exams']):
            path = f'/api/assessments/{exam["id"]}/'
            attempt = self.request(student, 'post', path + 'start/')
            again = self.request(student, 'post', path + 'start/')
            self.assertEqual(attempt['questions'], again['questions'])
            self.assertEqual(attempt['attempt_started_at'], again['attempt_started_at'])
            self.assertNotIn('is_correct', str(attempt['questions']))
            answers = []
            for question in Question.objects.filter(assessment_id=exam['id']):
                if question.question_type == 'identification':
                    answers.append({'question_id': question.pk, 'text_answer': ' 0 '})
                elif question.skill_category_id != scenario['categories'][1]['id']:
                    answers.append({'question_id': question.pk, 'selected_choice_id': question.choices.get(is_correct=True).pk})
                # Deliberate omission must contribute zero with the full denominator.
            identity = {key: attempt[key] for key in ('response_id', 'attempt_started_at')}
            payload = {**identity, 'answers': answers}
            graded = self.request(student, 'post', path + 'submit/', payload)
            self.assertEqual(graded['recommendations_locked'], number == 0)
            self.request(student, 'post', path + 'submit/', payload, 409)
        result = self.request(student, 'get', '/api/student/results/combined/')
        self.assertEqual((result['overall_raw_score'], result['overall_max_score'], result['overall_percentage']), (3, 4, 75))
        self.assertEqual({row['category']: (row['raw_score'], row['max_score'], row['percentage'])
                          for row in result['combined_category_scores']}, {
                              'Records knowledge': (3, 3, 100), 'Service knowledge': (0, 1, 0)})
        self.assertEqual([row['position_id'] for row in result['recommendations']], [scenario['position']['id']])
        return result

    def test_three_generic_programs_join_catalog_grading_rankings_and_decisions(self):
        legacy = Batch.objects.create(name='Existing IC cohort', instructor=self.owner)
        original = list(Batch.objects.filter(pk=legacy.pk).values())
        scenarios = []
        for index, name in enumerate(['Tourism example', 'Social Work example', 'Unrelated arbitrary program']):
            scenario = self.prepare(index, name, scenarios[0]['company'] if scenarios else None)
            scenarios.append(scenario)
            self.complete(scenario)
        first, second, third = scenarios
        category_ids = {row['id'] for scenario in scenarios for row in scenario['categories']}
        self.assertEqual(len(category_ids), 6)  # shared names never merge identities
        for scenario in scenarios:
            partner = self.request(self.peer, 'get', scenario['base'] + f'partners/{first["company"]["id"]}/')
            self.assertEqual([row['id'] for row in partner['positions']], [scenario['position']['id']])
            self.assertTrue(partner['can_edit'])
            self.assertFalse(partner['can_archive'])
            self.request(self.peer, 'get', f'/api/instructor/batches/{scenario["batch"]["id"]}/students/', status=404)

        rec = Recommendation.objects.get(student=first['student'], position_id=first['position']['id'])
        self.request(self.owner, 'post', '/api/placements/approve/', {'recommendation_id': rec.pk}, 201)
        placement = OJTPlacement.objects.get(student=first['student'], status='approved')
        snapshot = placement_evidence(placement)
        position_url = first['base'] + f'positions/{first["position"]["id"]}/'
        position = self.request(self.owner, 'get', position_url)
        self.request(self.owner, 'patch', position_url, {'revision': position['revision'], 'slots': 0}, 409)
        self.request(self.owner, 'post', position_url + 'archive/', {'revision': position['revision']}, 409)

        # A different program's coordinator edit invalidates only its own ranking.
        other_url = second['base'] + f'positions/{second["position"]["id"]}/'
        other = self.request(self.owner, 'get', other_url)
        self.request(self.owner, 'patch', other_url, {'revision': other['revision'], 'tags': ['Changed service vocabulary']})
        stale = self.request(second['student'], 'get', '/api/student/results/combined/')
        self.assertTrue(stale['recommendations_stale'])
        self.assertFalse(stale['competency_locked'])
        self.assertEqual(stale['recommendations'], [])
        independent = self.request(third['student'], 'get', '/api/student/results/combined/')
        self.assertFalse(independent['recommendations_stale'])
        self.assertEqual(len(independent['recommendations']), 1)

        self.request(self.admin, 'patch', first['grant_url'], {'is_active': False})
        self.request(self.owner, 'get', first['base'] + 'partners/', status=404)
        self.request(self.owner, 'patch', position_url, {'revision': position['revision'], 'slots': 2}, 404)
        self.request(self.owner, 'get', third['base'] + 'partners/')
        self.assertEqual(placement_evidence(OJTPlacement.objects.get(pk=placement.pk)), snapshot)
        self.assertEqual(SkillScore.objects.filter(student=first['student']).count(), 3)
        self.assertEqual(list(Batch.objects.filter(pk=legacy.pk).values()), original)
