"""Direct API security checks with synthetic identities and real signed JWTs."""
from unittest.mock import patch
import logging
from django.core.cache import cache
from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from .models import (AnswerChoice, Assessment, Batch, BatchEnrollment, Company,
    OJTPlacement, Position, Question, Recommendation, SkillCategory, User)


class AccessSecurityTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.admin = User.objects.create_user('security-admin@example.invalid', role='admin', password='Synthetic-admin-password-901')
        self.owner = User.objects.create_user('security-owner@example.invalid', role='instructor', is_approved=True)
        self.other = User.objects.create_user('security-other@example.invalid', role='instructor', is_approved=True)
        self.student = User.objects.create_user('security-student@example.invalid', role='student', is_approved=True)
        self.outsider = User.objects.create_user('security-outsider@example.invalid', role='student', is_approved=True)
        self.batch = Batch.objects.create(name='Owned security batch', instructor=self.owner)
        self.foreign = Batch.objects.create(name='Foreign security batch', instructor=self.other)
        BatchEnrollment.objects.create(student=self.student, batch=self.batch)
        BatchEnrollment.objects.create(student=self.student, batch=self.foreign)
        BatchEnrollment.objects.create(student=self.outsider, batch=self.foreign)
        self.category = SkillCategory.objects.create(name='Synthetic security category')
        self.assessment = Assessment.objects.create(title='Owned keys', batch=self.batch, created_by=self.owner)
        self.foreign_assessment = Assessment.objects.create(title='Foreign keys', batch=self.foreign, created_by=self.other)
        self.question = Question.objects.create(assessment=self.assessment, skill_category=self.category, question_text='Synthetic question')
        self.key = AnswerChoice.objects.create(question=self.question, choice_text='Synthetic key', is_correct=True)
        self.company = Company.objects.create(name='Synthetic Security Agency')
        self.position = Position.objects.create(company=self.company, title='Security Intern', slots_available=5)
        self.rec = Recommendation.objects.create(student=self.student, batch=self.batch, position=self.position, match_score=72.345)

    def token_client(self, user):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION='Bearer ' + str(RefreshToken.for_user(user).access_token))
        return client

    def test_every_private_route_rejects_anonymous_requests(self):
        from .urls import urlpatterns
        # Readiness exposes only a coarse status and deliberately ignores JWTs;
        # its public/error/method contract is covered in test_health.
        public = {'login', 'refresh', 'google_login', 'register_role', 'health'}
        for route in urlpatterns:
            if route.name in public:
                continue
            args = [1 for _ in route.pattern.converters]
            methods = getattr(getattr(route.callback, 'cls', None), 'http_method_names', ['get'])
            method = next(method for method in methods if method not in ['options', 'head'])
            with self.subTest(route=route.name, method=method):
                result = getattr(self.client, method)(reverse(route.name, args=args), {}, format='json')
                self.assertEqual(result.status_code, 401)

    def test_student_cannot_call_staff_routes_and_instructor_cannot_call_admin_routes(self):
        from .urls import urlpatterns
        student, instructor = self.token_client(self.student), self.token_client(self.owner)
        for route in urlpatterns:
            path = str(route.pattern)
            # Placement analytics is intentionally shared with scoped instructors.
            staff = path.startswith(('admin/', 'instructor/', 'placements/', 'nlp/'))
            if not staff:
                continue
            args = [1 for _ in route.pattern.converters]
            methods = getattr(getattr(route.callback, 'cls', None), 'http_method_names', ['get'])
            method = next(method for method in methods if method not in ['options', 'head'])
            with self.subTest(role='student', route=route.name):
                result = getattr(student, method)(reverse(route.name, args=args), {}, format='json')
                self.assertIn(result.status_code, [401, 403])
            if path.startswith('admin/') and route.name != 'placement_analytics':
                with self.subTest(role='instructor', route=route.name):
                    result = getattr(instructor, method)(reverse(route.name, args=args), {}, format='json')
                    self.assertIn(result.status_code, [401, 403])

    def test_existing_access_tokens_stop_working_when_approval_is_revoked(self):
        for user in [self.owner, self.student]:
            with self.subTest(role=user.role):
                client = self.token_client(user)
                self.assertEqual(client.get(reverse('me')).status_code, 200)
                user.is_approved = False
                user.save(update_fields=['is_approved'])
                self.assertEqual(client.get(reverse('me')).status_code, 401)
                if user.role == 'instructor':
                    denied = client.post(reverse('instructor_batches'), {'name': 'Forbidden new batch'}, format='json')
                    self.assertEqual(denied.status_code, 401)
        self.assertFalse(Batch.objects.filter(name='Forbidden new batch').exists())

    def test_existing_student_token_stops_working_after_all_enrollments_are_removed(self):
        client = self.token_client(self.student)
        self.assertEqual(client.get(reverse('student_me')).status_code, 200)
        BatchEnrollment.objects.filter(student=self.student).delete()
        self.assertEqual(client.get(reverse('student_me')).status_code, 401)
        self.assertEqual(client.patch(reverse('student_profile'), {'name': 'Forbidden rename'}, format='json').status_code, 401)
        self.student.refresh_from_db()
        self.assertNotEqual(self.student.name, 'Forbidden rename')

    def test_roles_object_scope_and_delivery_do_not_reveal_keys(self):
        student = self.token_client(self.student)
        for name in ['admin_users', 'admin_reports', 'instructor_batches', 'placement_reports']:
            self.assertEqual(student.get(reverse(name)).status_code, 403, name)
        owner = self.token_client(self.owner)
        self.assertEqual(owner.get(reverse('instructor_assessment_questions', args=[self.foreign_assessment.pk])).status_code, 404)
        self.assertEqual(student.get(reverse('instructor_assessment_questions', args=[self.assessment.pk])).status_code, 403)
        # The newest enrollment is foreign, so explicitly use an own-batch-only student.
        BatchEnrollment.objects.filter(student=self.student, batch=self.foreign).delete()
        delivery = student.post(reverse('assessment_start', args=[self.assessment.pk]))
        self.assertEqual(delivery.status_code, 200, delivery.data)
        self.assertNotIn('is_correct', str(delivery.data))
        self.assertNotIn('correct_answer', str(delivery.data))
        self.assertEqual(student.patch(reverse('instructor_question_detail', args=[self.question.pk]), {'question_text': 'Forbidden'}, format='json').status_code, 403)

    def foreign_placement(self):
        return OJTPlacement.objects.create(student=self.student, batch=self.foreign, company=self.company,
            position=self.position, status='approved', remarks='Private foreign decision', assigned_by=self.other,
            match_score_at_assignment=92)

    def test_shared_student_does_not_authorize_foreign_placement_mutation(self):
        placement = self.foreign_placement()
        client = self.token_client(self.owner)
        for name in ['placement_remove', 'placement_reject']:
            result = client.post(reverse(name), {'placement_id': placement.pk, 'remarks': 'Forbidden change'}, format='json')
            self.assertEqual(result.status_code, 403, result.data)
            self.assertNotIn('Private foreign decision', str(result.data))
        placement.refresh_from_db()
        self.assertEqual(placement.status, 'approved')
        self.assertEqual(placement.remarks, 'Private foreign decision')
        self.assertEqual(placement.match_score_at_assignment, 92)

    def test_legacy_foreign_snapshot_cannot_be_mutated_via_owned_recommendation(self):
        placement = self.foreign_placement()
        placement.recommendation = self.rec
        placement.save(update_fields=['recommendation'])
        client = self.token_client(self.owner)
        for status in ['approved', 'removed', 'rejected', 'suggested']:
            placement.status = status
            placement.save(update_fields=['status'])
            for name in ['placement_remove', 'placement_reject']:
                with self.subTest(status=status, action=name):
                    result = client.post(reverse(name),
                        {'recommendation_id': self.rec.pk, 'remarks': 'Forbidden legacy mutation'}, format='json')
                    self.assertEqual(result.status_code, 403)
                    self.assertNotIn('Private foreign decision', str(result.data))
                    self.assertNotIn('placement', result.data)
                    placement.refresh_from_db()
                    self.assertEqual(placement.status, status)
                    self.assertEqual(placement.match_score_at_assignment, 92)

    def test_archived_student_placement_can_still_be_removed_and_history_retained(self):
        placement = OJTPlacement.objects.create(student=self.student, batch=self.batch,
            company=self.company, position=self.position, status='approved', match_score_at_assignment=72.345)
        self.student.is_active = False
        self.student.save(update_fields=['is_active'])
        result = self.token_client(self.owner).post(reverse('placement_remove'),
            {'placement_id': placement.pk, 'remarks': 'Synthetic archived placement removal'}, format='json')
        self.assertEqual(result.status_code, 200)
        placement.refresh_from_db()
        self.assertEqual(placement.status, 'removed')
        self.assertEqual(placement.match_score_at_assignment, 72.345)
        self.assertFalse(self.student.is_active)

    @patch('api.views.combined_is_unlocked', return_value=True)
    def test_instructor_cannot_reassign_a_legacy_foreign_suggestion_snapshot(self, unlocked):
        placement = self.foreign_placement()
        placement.status = 'suggested'
        placement.recommendation = self.rec
        placement.save(update_fields=['status', 'recommendation'])
        result = self.token_client(self.owner).post(reverse('placement_approve'),
            {'recommendation_id': self.rec.pk}, format='json')
        self.assertEqual(result.status_code, 403)
        self.assertNotIn('placement', result.data)
        placement.refresh_from_db()
        self.assertEqual(placement.status, 'suggested')
        self.assertEqual(placement.batch_id, self.foreign.pk)
        self.assertEqual(placement.match_score_at_assignment, 92)

    def test_archived_student_requires_restore_before_new_manual_assignment(self):
        self.student.is_active = False
        self.student.save(update_fields=['is_active'])
        client = self.token_client(self.owner)
        payload = {'student_id': self.student.pk, 'position_id': self.position.pk, 'batch_id': self.batch.pk}
        self.assertEqual(client.post(reverse('placement_manual_assign'), payload, format='json').status_code, 409)
        self.assertFalse(OJTPlacement.objects.exists())
        self.student.is_active = True
        self.student.save(update_fields=['is_active'])
        self.assertEqual(client.post(reverse('placement_manual_assign'), payload, format='json').status_code, 201)

    def test_manual_assignment_cannot_choose_foreign_batch_for_shared_student(self):
        result = self.token_client(self.owner).post(reverse('placement_manual_assign'),
            {'student_id': self.student.pk, 'position_id': self.position.pk, 'batch_id': self.foreign.pk}, format='json')
        self.assertEqual(result.status_code, 403, result.data)
        self.assertFalse(OJTPlacement.objects.exists())

    def test_implicit_manual_assignment_uses_an_owned_batch(self):
        result = self.token_client(self.owner).post(reverse('placement_manual_assign'),
            {'student_id': self.student.pk, 'position_id': self.position.pk}, format='json')
        self.assertEqual(result.status_code, 201, result.data)
        self.assertEqual(result.data['placement']['batch']['id'], self.batch.pk)

    def test_conflicting_foreign_approval_does_not_disclose_its_snapshot(self):
        self.foreign_placement()
        client = self.token_client(self.owner)
        for name, payload in [('placement_approve', {'recommendation_id': self.rec.pk}),
                              ('placement_manual_assign', {'student_id': self.student.pk, 'position_id': self.position.pk})]:
            result = client.post(reverse(name), payload, format='json')
            self.assertEqual(result.status_code, 409)
            self.assertNotIn('placement', result.data)
            self.assertNotIn('Private foreign decision', str(result.data))

    @patch('api.views.authenticate', return_value=None)
    def test_login_limit_cannot_be_bypassed_by_a_valid_jwt_or_spoofed_forwarded_ip(self, authenticate):
        for authenticated in [False, True]:
            with self.subTest(authenticated=authenticated):
                cache.clear()
                client = self.token_client(self.admin) if authenticated else APIClient()
                statuses = [client.post(reverse('login'), {'email': 'unknown@example.invalid', 'password': 'Synthetic'},
                    format='json', HTTP_X_FORWARDED_FOR=f'198.51.100.{index+1}').status_code for index in range(11)]
                self.assertEqual(statuses, [401]*10 + [429])

    @patch('api.views.authenticate')
    def test_auth_input_lengths_are_rejected_before_hashing_or_token_decoding(self, authenticate):
        for payload in [{'email': 'x'*255, 'password': 'Synthetic'}, {'email': 'synthetic@example.invalid', 'password': 'x'*4097}]:
            result = self.client.post(reverse('login'), payload, format='json')
            self.assertEqual(result.status_code, 400)
        authenticate.assert_not_called()
        self.assertEqual(self.client.post(reverse('refresh'), {'refresh': 'x'*8193}, format='json').status_code, 400)

    def test_legacy_admin_email_case_and_safe_identity_fields(self):
        self.admin.email = 'Security-Admin@example.invalid'
        self.admin.save(update_fields=['email'])
        result = self.client.post(reverse('login'), {'email': 'SECURITY-ADMIN@example.invalid', 'password': 'Synthetic-admin-password-901'}, format='json')
        self.assertEqual(result.status_code, 200)
        self.assertNotIn('password', result.data['user'])
        self.assertNotIn('is_superuser', result.data['user'])

    def test_role_claims_do_not_override_database_role_and_tampering_is_denied(self):
        token = RefreshToken.for_user(self.student).access_token
        token['role'] = 'admin'
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION='Bearer ' + str(token))
        self.assertEqual(client.get(reverse('admin_users')).status_code, 403)
        self.assertEqual(client.get(reverse('me')).data['role'], 'student')
        header, payload, signature = str(token).split('.')
        invalid = header + '.' + payload + '.' + ('A' if signature[0] != 'A' else 'B') + signature[1:]
        client.credentials(HTTP_AUTHORIZATION='Bearer ' + invalid)
        self.assertEqual(client.get(reverse('me')).status_code, 401)

    @patch('api.backends.User.set_password')
    def test_unknown_identity_uses_dummy_hash_and_identical_error(self, set_password):
        result = self.client.post(reverse('login'), {'email': 'missing@example.invalid', 'password': 'Synthetic'}, format='json')
        self.assertEqual(result.status_code, 401)
        self.assertEqual(result.data['error'], 'Invalid credentials.')
        set_password.assert_called_once_with('Synthetic')

    def test_server_access_logging_redacts_event_tokens(self):
        with self.assertLogs('django.server', level='INFO') as captured:
            logging.getLogger('django.server').info('GET /api/student/events/?token=%s&cursor=7 HTTP/1.1', 'synthetic-private-credential')
        self.assertNotIn('synthetic-private-credential', str(captured.output))
        self.assertIn('cursor=7', str(captured.output))

    def test_notification_html_treats_identity_fields_as_text(self):
        from .views import get_instructor_email_html, get_student_enrollment_email_html
        text = '<img src=x onerror="synthetic()">'
        messages = [get_instructor_email_html(text, 'http://localhost:5173', text, text),
                    get_student_enrollment_email_html(text, text, text, 'http://localhost:5173')]
        for message in messages:
            self.assertNotIn(text, message)
            self.assertIn('&lt;img', message)
