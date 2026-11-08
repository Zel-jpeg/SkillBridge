"""Exercise new programs from admin sign-in to isolated scores and recommendations."""

from unittest.mock import Mock, patch
from uuid import uuid4

from django.test import override_settings
from rest_framework.test import APIClient, APITestCase

from .models import ChangeEvent, User


@override_settings(REALTIME_PILOT_ENABLED=False, REALTIME_PILOT_PUBLISH_ENABLED=False)
class ReleaseWorkflowTests(APITestCase):
    def request(self, client, method, path, data=None, status=200):
        response = getattr(client, method)(path, data, format='json')
        self.assertEqual(response.status_code, status, f'{method} {path}')
        return response.data

    def google_session(self, email, role):
        client = APIClient()
        provider = Mock(status_code=200, json=lambda: {
            'email': email, 'email_verified': True, 'hd': 'dnsc.edu.ph',
            'name': f'Synthetic {role.title()}', 'picture': '',
        })
        with patch('api.views._google_userinfo', return_value=provider):
            login = self.request(client, 'post', '/api/auth/google/', {'token': 'synthetic-provider-token'})
        self.assertEqual(login['user']['role'], role)
        client.credentials(HTTP_AUTHORIZATION='Bearer ' + login['access'])
        return client

    def set_up_program(self, institute, code, name, number):
        instructor_email = f'release-instructor-{number}@dnsc.edu.ph'
        instructor = self.request(self.client, 'post', '/api/admin/instructors/', {
            'email': instructor_email, 'name': f'Synthetic Coordinator {number}', 'instructor_id': f'RELEASE-{number}',
            'department': institute['name'], 'courses': code,
        }, status=201)
        self.assertTrue(instructor['email_queued'])
        programs = f'/api/admin/institutes/{institute["id"]}/programs/'
        program = self.request(self.client, 'post', programs, {'code': code, 'name': name}, status=201)
        self.request(self.client, 'post', programs + f'{program["id"]}/instructors/', {
            'instructor_id': instructor['id'],
        }, status=201)

        staff = self.google_session(instructor_email, 'instructor')
        self.request(staff, 'get', '/api/admin/users/', status=403)
        batch = self.request(staff, 'post', '/api/instructor/batches/', {
            'name': f'{name} Cohort', 'program_id': program['id'],
        }, status=201)
        frameworks = f'/api/management/programs/{program["id"]}/frameworks/'
        framework = self.request(staff, 'post', frameworks, {'name': 'Release Skills', 'request_id': str(uuid4())}, status=201)
        framework_url = frameworks + f'{framework["id"]}/'
        category = self.request(staff, 'post', framework_url + 'categories/', {
            'name': 'Release Records', 'description': 'Identifies the reviewed record.', 'tags': ['Records'],
        }, status=201)
        digest = self.request(staff, 'get', framework_url)['digest']
        questions = [
            {'question_type': 'mcq', 'question_text': f'Which {name} record has been reviewed?',
             'choices': [{'text': 'Reviewed record', 'is_correct': True}, {'text': 'Draft record', 'is_correct': False}]},
            {'question_type': 'truefalse', 'question_text': f'A {name} record needs review.',
             'choices': [{'text': 'True', 'is_correct': True}, {'text': 'False', 'is_correct': False}]},
            {'question_type': 'identification', 'question_text': f'Give the reviewed {name} record code.',
             'correct_answer': 'Reviewed code'},
        ]
        assessment = self.request(staff, 'post', '/api/instructor/assessments/', {
            'title': f'{name} Assessment', 'batch_id': batch['id'], 'framework_id': framework['id'],
            'framework_digest': digest, 'duration_minutes': 30, 'publication_status': 'published',
            'is_required': True, 'include_in_competency': True,
            'questions': [{**question, 'category_id': category['id']} for question in questions],
        }, status=201)

        partners = f'/api/management/programs/{program["id"]}/partners/'
        partner = self.request(staff, 'post', partners, {'name': f'{name} Synthetic Partner'}, status=201)
        positions = {}
        for label, minimum in [('Foundation', 25), ('Advanced', 90)]:
            position = self.request(staff, 'post', partners + f'{partner["id"]}/positions/', {
                'title': f'{name} {label} Intern', 'slots': 2, 'description': f'Review {name} records.',
                'category_requirements': [{'category_id': category['id'], 'percentage': minimum}],
            }, status=201)
            positions[label] = position['id']

        student_email = f'release-student-{number}@dnsc.edu.ph'
        roster = f'/api/instructor/batches/{batch["id"]}/students/'
        enroll = f'/api/instructor/batches/{batch["id"]}/enroll/'
        review = self.request(staff, 'post', enroll + 'preview/', {'students': [{
            'school_id': f'2099-{1000 + number:05}', 'name': f'Synthetic Learner {number}',
            'email': student_email, 'course': program['code'],
        }]})
        self.request(staff, 'post', enroll, {'students': review['rows'], 'review_token': review['review_token'],
                                             'request_id': str(uuid4()), 'email_mode': 'later'})
        student = self.google_session(student_email, 'student')
        profile = self.request(student, 'patch', '/api/students/me/profile/', {
            'phone': '09000000000', 'stayingAt': 'home', 'travelWilling': 'panabo', 'homeProvince': 'Davao del Norte',
            'homeCity': 'Panabo City', 'homeBarangay': 'Synthetic Barangay', 'pinLat': 7.3, 'pinLng': 125.7,
        })
        self.request(student, 'get', roster, status=403)
        return dict(name=name, program=program['id'], category=category['id'], roster=roster, staff=staff,
                    instructor=instructor['id'], student=student, learner=profile['id'],
                    assessment=assessment['id'], partner=partner['id'], positions=positions, raw=number)

    def start_own_assessment(self, scenario, scenarios):
        student = scenario['student']
        own = scenario['assessment']
        listed = self.request(student, 'get', '/api/assessments/')['assessments']
        self.assertEqual([row['id'] for row in listed], [own])
        for foreign in scenarios:
            if foreign is scenario:
                continue
            self.request(student, 'post', f'/api/assessments/{foreign["assessment"]}/start/', status=404)
            self.request(student, 'post', f'/api/assessments/{foreign["assessment"]}/submit/', {}, status=404)
            self.request(scenario['staff'], 'get', foreign['roster'], status=404)
            self.request(scenario['staff'], 'get', f'/api/instructor/assessments/{foreign["assessment"]}/questions/', status=404)
        before = self.request(student, 'get', '/api/student/results/combined/')
        self.assertTrue(before['recommendations_locked'])
        self.assertEqual(before['recommendations'], [])
        attempt = self.request(student, 'post', f'/api/assessments/{own}/start/')
        answers = []
        for question in attempt['questions']:
            self.assertTrue(all(set(choice) == {'id', 'text'} for choice in question['choices']))
            kind = question['question_type']
            answer = {'question_id': question['id']}
            if kind == 'identification':
                answer['text_answer'] = '  REVIEWED code  ' if scenario['raw'] == 3 else 'Other code'
            else:
                expected = 'Reviewed record' if kind == 'mcq' else 'True' if scenario['raw'] >= 2 else 'False'
                answer['selected_choice_id'] = next(choice['id'] for choice in question['choices'] if choice['text'] == expected)
            answers.append(answer)
        return dict(response_id=attempt['response_id'], attempt_started_at=attempt['attempt_started_at'], answers=answers)

    @override_settings(REALTIME_PILOT_PUBLISH_ENABLED=True)
    def test_three_programs_grade_and_rank_only_their_own_students(self):
        email = 'release-admin@example.invalid'
        password = 'synthetic-test-password'
        admin = User.objects.create_user(email, password=password, role='admin', is_approved=True)
        login = self.request(self.client, 'post', '/api/auth/login/', {'email': email, 'password': password})
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + login['access'])
        path = '/api/admin/institutes/'
        ibpa = self.request(self.client, 'post', path, {'code': 'IBPA', 'name': 'Synthetic IBPA'}, status=201)
        other = self.request(self.client, 'post', path, {'code': 'FIELD', 'name': 'Synthetic Field Institute'}, status=201)
        scenarios = [self.set_up_program(ibpa, 'BSTOUR', 'Tourism Management', 2),
                     self.set_up_program(ibpa, 'BSENT', 'Entrepreneurship', 1),
                     self.set_up_program(other, 'BSFIELD', 'Field Documentation', 3)]
        # All three learners start before the first learner submits.
        payloads = [self.start_own_assessment(scenario, scenarios) for scenario in scenarios]
        for scenario, payload in zip(scenarios, payloads):
            with self.subTest(program=scenario['name']):
                student = scenario['student']
                submit = f'/api/assessments/{scenario["assessment"]}/submit/'
                expected_audience = {admin.pk, scenario['instructor'], scenario['learner']}
                with patch('api.realtime.publish_invalidations') as broadcast:
                    with self.captureOnCommitCallbacks(execute=True):
                        self.request(student, 'post', submit, payload)
                        broadcast.assert_not_called()
                    broadcast.assert_called_once()
                    self.assertEqual(set(broadcast.call_args.args[0]), expected_audience)
                    self.assertEqual(set(ChangeEvent.objects.values_list('recipient_id', flat=True)), expected_audience)
                    ChangeEvent.objects.all().delete()
                self.request(student, 'post', submit, payload, status=409)
                result = self.request(student, 'get', '/api/student/results/combined/')
                raw = scenario['raw']
                self.assertEqual((result['overall_raw_score'], result['overall_max_score'], result['overall_percentage']),
                                 (raw, 3, round(raw / 3 * 100, 2)))
                self.assertTrue(result['all_required_completed'])
                self.assertFalse(result['recommendations_locked'])
                recommendations = result['recommendations']
                expected_order = ['Advanced', 'Foundation'] if raw == 3 else ['Foundation', 'Advanced']
                self.assertEqual([row['position_id'] for row in recommendations],
                                 [scenario['positions'][label] for label in expected_order])
                for rank, (row, label) in enumerate(zip(recommendations, expected_order), 1):
                    self.assertEqual(row['recommendation_rank'], rank)
                    self.assertEqual(row['company_id'], scenario['partner'])
                    self.assertEqual(row['assessment_details']['ranking_inputs']['program_id'], scenario['program'])
                    self.assertEqual([item['category_id'] for item in row['assessment_details']['requirements']], [scenario['category']])
                    target = 25 if label == 'Foundation' else 90
                    coverage = 100 * min(result['overall_percentage'] / target, 1)
                    self.assertAlmostEqual(row['requirement_coverage'], coverage, places=2)
                roster = self.request(scenario['staff'], 'get', scenario['roster'])['students']
                self.assertEqual([row['id'] for row in roster], [scenario['learner']])
                self.assertTrue(roster[0]['all_required_completed'])
