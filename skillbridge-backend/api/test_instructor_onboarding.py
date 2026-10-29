"""Isolated admin-created instructor journey; never contact identity/mail providers."""
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest import skipUnless
from unittest.mock import Mock, patch

from django.db import connection, close_old_connections, IntegrityError
from django.test import TransactionTestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from .email_outbox import process_one
from .models import Batch, EmailNotice, User


class InstructorOnboardingTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user('onboarding-admin@dnsc.edu.ph', role='admin', is_approved=True)
        self.teacher = User.objects.create_user('onboarding-existing@dnsc.edu.ph', role='instructor', is_approved=True, school_id='EXISTING-001')
        self.student = User.objects.create_user('onboarding-student@dnsc.edu.ph', role='student', is_approved=True, school_id='2099-00001')
        self.url = reverse('admin_instructors')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + str(AccessToken.for_user(self.admin)))
        self.payload = dict(email='new.faculty@dnsc.edu.ph', name='Synthetic New Faculty', instructor_id='FACULTY-001',
                            department='Synthetic Department', courses='BSIS')

    def create(self, **changes):
        return self.client.post(self.url, {**self.payload, **changes}, format='json')

    def google(self, user):
        client = APIClient()
        with patch('api.views._google_userinfo', return_value=Mock(status_code=200,
                json=lambda: dict(email=user.email, email_verified=True, hd='dnsc.edu.ph', name='Synthetic Google Faculty', picture=''))):
            return client.post(reverse('google_login'), {'token': 'synthetic-provider-token'}, format='json')

    @patch('api.email_outbox.requests.post')
    @patch('api.email_outbox.requests.get')
    def test_creation_queues_one_welcome_and_google_login_works_without_email_delivery(self, get, post):
        result = self.create(email='  NEW.FACULTY@DNSC.EDU.PH  ')
        self.assertEqual(result.status_code, 201, result.data)
        self.assertTrue(result.data['email_queued'])
        self.assertFalse(result.data['email_sent'])
        user = User.objects.get(pk=result.data['id'])
        self.assertEqual((user.email, user.school_id, user.department, user.course),
            (self.payload['email'], self.payload['instructor_id'], self.payload['department'], self.payload['courses']))
        self.assertEqual((user.role, user.is_active, user.is_approved, user.has_usable_password()), ('instructor', True, True, False))
        notice = EmailNotice.objects.get(student=user)
        self.assertEqual((notice.kind, notice.status), ('account', 'queued'))
        self.assertIn('DNSC Google account', notice.body)
        self.assertNotIn('password', notice.body.lower())
        login = self.google(user)
        self.assertEqual(login.status_code, 200, login.data)
        instructor = APIClient()
        instructor.credentials(HTTP_AUTHORIZATION='Bearer ' + login.data['access'])
        self.assertEqual(instructor.get(reverse('admin_users')).status_code, 403)
        self.assertEqual(instructor.get(reverse('instructor_batches')).status_code, 200)
        own = instructor.post(reverse('instructor_batches'), {'name': 'Synthetic new faculty batch'}, format='json')
        self.assertEqual(own.status_code, 201, own.data)
        self.assertEqual(Batch.objects.get(pk=own.data['id']).instructor_id, user.pk)
        notice.refresh_from_db()
        self.assertEqual(notice.status, 'queued')
        get.assert_not_called(); post.assert_not_called()

    def test_duplicate_email_and_global_student_or_instructor_id_are_rejected_without_extra_email(self):
        self.assertEqual(self.create().status_code, 201)
        for changes in ({}, {'email': ' NEW.FACULTY@DNSC.EDU.PH '},
                        {'email': 'other.faculty@dnsc.edu.ph'},
                        {'email': 'student-id.faculty@dnsc.edu.ph', 'instructor_id': self.student.school_id},
                        {'email': self.student.email, 'instructor_id': 'NEW-ID'},
                        {'email': self.teacher.email, 'instructor_id': 'NEW-ID'}):
            with self.subTest(changes=changes):
                self.assertEqual(self.create(**changes).status_code, 409)
        self.assertEqual(EmailNotice.objects.count(), 1)

    def test_invalid_payloads_are_rejected_atomically(self):
        for field, value in [('email', ''), ('email', 'outside@example.invalid'), ('email', 'two@@dnsc.edu.ph'),
                             ('email', 'space local@dnsc.edu.ph'), ('name', ' '), ('instructor_id', ''),
                             ('email', []), ('name', {}), ('department', []), ('courses', None),
                             ('name', 'X' * 256), ('instructor_id', 'X' * 21)]:
            with self.subTest(field=field, value_type=type(value).__name__):
                self.assertEqual(self.create(**{field: value}).status_code, 400)
        self.assertFalse(User.objects.filter(email=self.payload['email']).exists())
        self.assertFalse(EmailNotice.objects.exists())

    def test_queue_storage_failure_reports_saved_account_without_claiming_delivery(self):
        with patch('api.email_outbox.enqueue', side_effect=RuntimeError('Synthetic queue failure')):
            result = self.create()
        self.assertEqual(result.status_code, 201, result.data)
        self.assertFalse(result.data['email_queued'])
        self.assertFalse(result.data['email_sent'])
        user = User.objects.get(pk=result.data['id'])
        self.assertEqual(self.google(user).status_code, 200)
        self.assertFalse(EmailNotice.objects.exists())

    def test_account_insert_rolls_back_if_google_only_password_setup_fails(self):
        with patch.object(User, 'set_unusable_password', side_effect=RuntimeError('Synthetic password setup failure')):
            with self.assertRaises(RuntimeError):
                self.create()
        self.assertFalse(User.objects.filter(email=self.payload['email']).exists())
        self.assertFalse(EmailNotice.objects.exists())

    def test_unrelated_integrity_errors_are_not_reported_as_duplicate_accounts(self):
        with patch.object(User.objects, 'create', side_effect=IntegrityError('Synthetic unrelated integrity error')):
            with self.assertRaises(IntegrityError):
                self.create()
        self.assertFalse(User.objects.filter(email=self.payload['email']).exists())
        self.assertFalse(EmailNotice.objects.exists())

    def test_only_active_admin_can_create_and_disabled_instructor_cannot_sign_in(self):
        for actor in (self.teacher, self.student, None):
            self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + str(AccessToken.for_user(actor)) if actor else '')
            self.assertIn(self.create().status_code, (401, 403))
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + str(AccessToken.for_user(self.admin)))
        created = self.create()
        self.assertEqual(created.status_code, 201)
        user = User.objects.get(pk=created.data['id'])
        user.is_active = False; user.save(update_fields=['is_active'])
        self.assertEqual(self.google(user).status_code, 403)
        self.admin.is_active = False; self.admin.save(update_fields=['is_active'])
        self.assertEqual(self.create(email='another.faculty@dnsc.edu.ph', instructor_id='ANOTHER').status_code, 401)

    @override_settings(BREVO_API_KEY='synthetic', BREVO_SENDER_EMAIL='sender@example.invalid')
    def test_quota_keeps_welcome_pending_without_blocking_instructor_access(self):
        created = self.create()
        self.assertEqual(created.status_code, 201)
        with patch('api.email_outbox.requests.get', return_value=Mock(status_code=200,
                json=lambda: {'plan': [{'type': 'free', 'creditsType': 'sendLimit', 'credits': 0}]})), \
                patch('api.email_outbox.requests.post') as send:
            process_one()
        notice = EmailNotice.objects.get()
        self.assertEqual((notice.status, notice.reason), ('quota', 'quota'))
        send.assert_not_called()
        self.assertEqual(self.google(notice.student).status_code, 200)


@skipUnless(connection.vendor == 'postgresql', 'Requires disposable PostgreSQL uniqueness race')
class InstructorCreationRaceAudit(TransactionTestCase):
    """Concurrent email and instructor-ID conflicts must remain ordinary conflicts."""
    def test_two_admins_creating_the_same_identity_leave_one_user_and_one_welcome(self):
        self.run_race(same_email=True)

    def test_two_admins_claiming_the_same_instructor_id_leave_one_user_and_one_welcome(self):
        self.run_race(same_email=False)

    def run_race(self, *, same_email):
        admin = User.objects.create_user('race-onboarding-admin@dnsc.edu.ph', role='admin')
        barrier = Barrier(2)
        original = User.objects.create
        payload = dict(email='race.faculty@dnsc.edu.ph', name='Synthetic Race Faculty', instructor_id='RACE-F001')

        def synchronized_create(**kwargs):
            barrier.wait(timeout=15)
            return original(**kwargs)

        def create(index):
            close_old_connections()
            try:
                client = APIClient(raise_request_exception=False)
                client.force_authenticate(admin)
                request_payload = payload if same_email else {**payload, 'email': f'race-{index}.faculty@dnsc.edu.ph'}
                result = client.post(reverse('admin_instructors'), request_payload, format='json')
                return result.status_code, result.exc_info[0].__name__ if result.exc_info else None
            finally:
                close_old_connections()

        with patch.object(User.objects, 'create', side_effect=synchronized_create):
            with ThreadPoolExecutor(max_workers=2) as pool:
                results = list(pool.map(create, range(2)))
        self.assertEqual(User.objects.filter(school_id=payload['instructor_id']).count(), 1)
        self.assertEqual(EmailNotice.objects.filter(student__school_id=payload['instructor_id']).count(), 1)
        # The diagnostic makes unexpected server errors explicit in audit evidence.
        statuses = sorted(code for code, _ in results)
        print('INSTRUCTOR CREATION RACE HTTP statuses:', statuses,
              'exception types:', [error for _, error in results if error], flush=True)
        self.assertEqual(statuses, [201, 409])
