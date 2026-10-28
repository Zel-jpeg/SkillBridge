from datetime import timedelta
from unittest.mock import Mock, patch
import uuid

import requests
from concurrent.futures import ThreadPoolExecutor
import threading
from django.db import close_old_connections, connection, transaction
from django.test import TestCase, TransactionTestCase, override_settings, skipUnlessDBFeature
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from .email_outbox import enqueue, process_one, record_event
from .models import (Batch, BatchEnrollment, EmailAttempt, EmailCommand,
                     EmailDispatchControl, EmailNotice, EmailProviderEvent, User)


@override_settings(BREVO_API_KEY='synthetic-test-key', BREVO_SENDER_EMAIL='sender@example.invalid',
                   BREVO_WEBHOOK_SECRET='synthetic-webhook-secret', FRONTEND_URL='https://skillbridge.example.invalid',
                   BREVO_ACCOUNT_EMAIL_RESERVE=0)
class EmailOutboxTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user('owner@dnsc.edu.ph', name='Synthetic Instructor', role='instructor', is_approved=True)
        self.admin = User.objects.create_user('admin@example.invalid', role='admin')
        self.student = User.objects.create_user('student@dnsc.edu.ph', name='Synthetic Student', role='student', is_approved=True, school_id='2026-00001', course='BSIT')
        self.batch = Batch.objects.create(name='Synthetic Batch', instructor=self.owner)
        self.enrollment = BatchEnrollment.objects.create(batch=self.batch, student=self.student)
        self.client = APIClient()
        self.client.force_authenticate(self.owner)
        self.url = reverse('enrollment_emails', args=[self.batch.pk])
        self.network = patch('api.email_outbox.requests.get', return_value=Mock(status_code=200, json=lambda: {'plan': [{'type': 'free', 'creditsType': 'sendLimit', 'credits': 300}]}))
        self.get = self.network.start()
        self.addCleanup(self.network.stop)
        self.post_patch = patch('api.email_outbox.requests.post', side_effect=lambda *a, **k: Mock(status_code=201, json=lambda: {'messageId': f"<{k['json']['tags'][0]}@example.invalid>"}))
        self.post = self.post_patch.start()
        self.addCleanup(self.post_patch.stop)

    def notice(self, **kwargs):
        return enqueue(self.student, 'Synthetic enrollment', 'Synthetic instructions', enrollment=self.enrollment,
                       actor=self.owner, **kwargs)

    def action(self, action, *, ids=None, reason='', command_id=None, token=None):
        token = token or self.client.get(self.url).data['review_token']
        return self.client.post(self.url, {'action': action, 'student_ids': ids or [self.student.pk],
            'review_token': token, 'request_id': str(command_id or uuid.uuid4()), 'reason': reason}, format='json')

    def event(self, notice, event, stamp=None):
        return {'event': event, 'message-id': notice.message_id or f'<{notice.pk}@example.invalid>',
                'ts_event': (stamp or timezone.now()).timestamp(), 'tags': [f'sb-{notice.pk}']}

    def test_intent_is_atomic_and_never_sends_in_web_request(self):
        with self.assertRaises(ValueError):
            with transaction.atomic():
                self.notice()
                raise ValueError('rollback')
        self.assertEqual(EmailNotice.objects.count(), 0)
        notice = self.notice(held=True)
        self.assertEqual(notice.status, 'held')
        self.assertEqual(process_one(), 0)
        self.get.assert_not_called()
        self.post.assert_not_called()

    def test_real_enrollment_saves_a_held_notice_without_network(self):
        rows = [{'name': 'Synthetic New Student', 'school_id': '2026-00002', 'email': 'new@dnsc.edu.ph', 'course': 'BSIT'}]
        preview = self.client.post(reverse('instructor_batch_enroll_preview', args=[self.batch.pk]), {'students': rows}, format='json')
        self.assertEqual(preview.status_code, 200)
        response = self.client.post(reverse('instructor_batch_enroll', args=[self.batch.pk]),
            {'students': preview.data['rows'], 'review_token': preview.data['review_token'], 'email_mode': 'later'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['summary']['notifications_held'], 1)
        self.assertEqual(EmailNotice.objects.get().status, 'held')
        self.get.assert_not_called()
        self.post.assert_not_called()

    def test_100_recipients_wait_after_20_credits_then_resume(self):
        self.get.return_value.json = lambda: {'plan': [{'type': 'free', 'creditsType': 'sendLimit', 'credits': 20}]}
        for i in range(100):
            person = self.student if i == 0 else User.objects.create_user(
                f'synthetic-{i}@dnsc.edu.ph', name=f'Synthetic Student {i}', role='student', is_approved=True)
            enrollment, _ = BatchEnrollment.objects.get_or_create(batch=self.batch, student=person)
            enqueue(person, f'Synthetic {i}', 'Test', enrollment=enrollment, actor=self.owner)
        for _ in range(21):
            process_one()
        self.assertEqual(self.post.call_count, 20)
        self.assertEqual(EmailNotice.objects.filter(status='quota').count(), 80)
        control = EmailDispatchControl.objects.get(pk=1)
        self.get.return_value.json = lambda: {'plan': [{'type': 'free', 'creditsType': 'sendLimit', 'credits': 300}]}
        with patch('api.email_outbox.timezone.now', return_value=control.check_after + timedelta(seconds=1)):
            for _ in range(80):
                process_one()
        self.assertEqual(EmailNotice.objects.filter(status='accepted').count(), 100)
        self.assertEqual(self.post.call_count, 100)
        self.assertEqual(BatchEnrollment.objects.count(), 100)

    def test_1000_saved_jobs_are_bounded_private_and_use_one_lease(self):
        self.get.return_value.json = lambda: {'plan': [{'type': 'subscription', 'creditsType': 'sendLimit', 'credits': 1000}]}
        for i in range(1000):
            enqueue(self.student, f'Synthetic {i}', 'Test')
        for _ in range(1000):
            self.assertEqual(process_one(), 1)
        self.assertEqual(self.post.call_count, 1000)
        self.assertEqual(EmailAttempt.objects.count(), 1000)
        for call in self.post.call_args_list:
            self.assertEqual(len(call.kwargs['json']['to']), 1)
            self.assertEqual(call.kwargs['timeout'], (5, 15))
            self.assertFalse(call.kwargs['allow_redirects'])

    def test_failed_allowance_check_pauses_without_submitting(self):
        self.get.side_effect = requests.Timeout()
        self.notice()
        process_one()
        self.post.assert_not_called()
        self.assertEqual(EmailDispatchControl.objects.get().reason, 'allowance_unavailable')
        self.assertEqual(process_one(), 0)

    def test_read_timeout_and_crash_do_not_blindly_resend(self):
        self.post.side_effect = requests.ReadTimeout()
        notice = self.notice()
        process_one(); process_one()
        notice.refresh_from_db()
        self.assertEqual(notice.status, 'uncertain')
        self.assertEqual(self.post.call_count, 1)
        notice.status = 'sending'
        notice.lease_until = timezone.now() - timedelta(seconds=1)
        notice.save()
        process_one()
        notice.refresh_from_db()
        self.assertEqual(notice.status, 'uncertain')
        self.assertEqual(self.post.call_count, 1)

    def test_connect_failure_retries_only_five_times(self):
        self.post.side_effect = requests.ConnectTimeout()
        notice = self.notice()
        for _ in range(5):
            notice.refresh_from_db()
            with patch('api.email_outbox.timezone.now', return_value=notice.due_at + timedelta(seconds=1)):
                process_one()
        notice.refresh_from_db()
        self.assertEqual(notice.status, 'failed')
        self.assertEqual(notice.attempts, 5)

    def test_429_coordinates_a_shared_pause(self):
        self.post.side_effect = None
        self.post.return_value = Mock(status_code=429)
        notice = self.notice()
        process_one()
        notice.refresh_from_db()
        self.assertEqual(notice.status, 'retry')
        self.assertEqual(EmailDispatchControl.objects.get().reason, 'rate_limit')
        process_one()
        self.assertEqual(self.post.call_count, 1)

    def test_foreign_active_lease_prevents_second_sender(self):
        self.notice()
        EmailDispatchControl.objects.create(pk=1, lease_token=uuid.uuid4(), lease_until=timezone.now() + timedelta(minutes=1))
        self.assertEqual(process_one(), 0)
        self.get.assert_not_called()
        self.post.assert_not_called()

    def test_unenrolled_archived_changed_recipient_and_reassigned_jobs_cancel(self):
        for mutation in ('unenroll', 'archive', 'email', 'reassign'):
            with self.subTest(mutation=mutation):
                notice = self.notice()
                with transaction.atomic():
                    if mutation == 'unenroll':
                        self.enrollment.delete()
                    elif mutation == 'archive':
                        self.batch.status = 'archived'; self.batch.save()
                    elif mutation == 'email':
                        self.student.email = 'changed@dnsc.edu.ph'; self.student.save()
                    else:
                        other = User.objects.create_user('other@dnsc.edu.ph', role='instructor', is_approved=True)
                        self.batch.instructor = other; self.batch.save()
                    process_one()
                    notice.refresh_from_db()
                    self.assertEqual(notice.status, 'cancelled')
                    transaction.set_rollback(True)
                notice.delete()
                self.batch.refresh_from_db(); self.student.refresh_from_db()
                self.enrollment = BatchEnrollment.objects.get(batch=self.batch, student=self.student)
        self.post.assert_not_called()

    def test_webhook_authentication_duplicates_and_out_of_order_delivery(self):
        notice = self.notice()
        process_one(); notice.refresh_from_db()
        url = reverse('brevo_event')
        payload = self.event(notice, 'delivered')
        self.assertEqual(self.client.post(url, payload, format='json').status_code, 403)
        for _ in range(2):
            self.assertEqual(self.client.post(url, payload, format='json', HTTP_X_SKILLBRIDGE_WEBHOOK='synthetic-webhook-secret').status_code, 200)
        record_event(self.event(notice, 'deferred', timezone.now() - timedelta(minutes=1)))
        notice.refresh_from_db()
        self.assertEqual(notice.status, 'delivered')
        self.assertEqual(EmailProviderEvent.objects.count(), 2)
        self.assertFalse(hasattr(EmailProviderEvent.objects.first(), 'email'))

    def test_early_delivery_event_and_permanent_suppression(self):
        notice = self.notice()
        record_event(self.event(notice, 'hardBounce'))
        record_event(self.event(notice, 'delivered', timezone.now() + timedelta(seconds=1)))
        notice.refresh_from_db()
        self.assertEqual(notice.status, 'delivered')
        self.assertEqual(self.action('resend', reason='Synthetic request').data['changed'], 0)
        blocked = self.notice()
        process_one(); blocked.refresh_from_db()
        self.assertEqual(blocked.reason, 'blocked')
        self.post.assert_not_called()

    def test_missing_history_get_is_read_only_and_not_failed(self):
        response = self.client.get(self.url)
        self.assertEqual(response.data['rows'][0]['status'], 'history_unavailable')
        self.assertEqual(EmailNotice.objects.count(), 0)
        self.post.assert_not_called()

    def test_duplicate_command_and_stale_review_are_safe(self):
        notice = self.notice(held=True)
        token = self.client.get(self.url).data['review_token']
        command = uuid.uuid4()
        first = self.action('send', command_id=command, token=token)
        repeat = self.action('send', command_id=command, token=token)
        self.assertEqual(first.data, repeat.data)
        self.assertEqual(first.data['changed'], 1)
        self.assertEqual(EmailNotice.objects.count(), 1)
        self.assertEqual(EmailCommand.objects.count(), 1)
        self.assertEqual(self.action('send', token=token).status_code, 409)
        notice.refresh_from_db(); self.assertEqual(notice.status, 'queued')

    def test_resend_preserves_history_cooldown_and_confirmation_reason(self):
        notice = self.notice()
        process_one()
        self.assertEqual(self.action('resend', reason='').status_code, 400)
        self.assertEqual(self.action('resend', reason='Student requested another notice').data['changed'], 0)
        EmailNotice.objects.filter(pk=notice.pk).update(created_at=timezone.now() - timedelta(minutes=16), updated_at=timezone.now() - timedelta(minutes=16))
        response = self.action('resend', reason='Student requested another notice')
        self.assertEqual(response.data['changed'], 1)
        self.assertEqual(EmailNotice.objects.count(), 2)
        self.assertEqual(EmailNotice.objects.get(pk=notice.pk).status, 'accepted')

    def test_student_foreign_instructor_and_archived_batch_boundaries(self):
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.get(self.url).status_code, 403)
        self.assertEqual(self.client.post(self.url, {}, format='json').status_code, 403)
        other = User.objects.create_user('foreign@dnsc.edu.ph', role='instructor', is_approved=True)
        self.client.force_authenticate(other)
        self.assertEqual(self.client.get(self.url).status_code, 404)
        self.assertEqual(self.client.post(self.url, {}, format='json').status_code, 404)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get(self.url).status_code, 200)
        self.batch.status = 'archived'; self.batch.save()
        self.assertEqual(self.action('send').status_code, 409)

    def test_bad_provider_success_never_means_delivered(self):
        self.post.side_effect = None
        self.post.return_value = Mock(status_code=201, json=lambda: {})
        notice = self.notice()
        process_one(); notice.refresh_from_db()
        self.assertEqual(notice.status, 'uncertain')
        self.assertIsNone(notice.delivered_at)

    def test_50_student_enrollment_is_durable_and_returns_before_any_provider_io(self):
        rows = [{'name': f'Synthetic Bulk Student {i}', 'school_id': f'2026-{i + 100:05}',
                 'email': f'bulk-{i}@dnsc.edu.ph', 'course': 'BSIT'} for i in range(50)]
        preview = self.client.post(reverse('instructor_batch_enroll_preview', args=[self.batch.pk]), {'students': rows}, format='json')
        self.assertEqual(preview.data['summary']['ready'], 50)
        response = self.client.post(reverse('instructor_batch_enroll', args=[self.batch.pk]),
            {'students': preview.data['rows'], 'review_token': preview.data['review_token']}, format='json')
        self.assertEqual(response.data['summary']['enrolled'], 50)
        self.assertEqual(response.data['summary']['notifications_queued'], 50)
        self.assertEqual(EmailNotice.objects.filter(status='queued').count(), 50)
        self.get.assert_not_called(); self.post.assert_not_called()

    def test_provider_log_reconciliation_resolves_uncertainty_without_sending(self):
        notice = self.notice()
        notice.status = 'uncertain'; notice.save()
        now = timezone.now()
        EmailNotice.objects.filter(pk=notice.pk).update(updated_at=now - timedelta(minutes=3))
        self.get.return_value = Mock(status_code=200, json=lambda: {'events': [
            {'tag': f'sb-{notice.pk}', 'event': 'opened', 'date': now.isoformat()},
            {'tag': f'sb-{notice.pk}', 'event': 'delivered', 'date': 'invalid'}, {
            'tag': f'sb-{notice.pk}', 'event': 'delivered', 'messageId': '<reconciled@example.invalid>',
            'date': now.isoformat()}]})
        self.assertEqual(process_one(), 1)
        notice.refresh_from_db()
        self.assertEqual(notice.status, 'delivered')
        self.post.assert_not_called()
        process_one()
        self.assertEqual(self.get.call_count, 1)

    def test_untrusted_webhook_shape_and_time_are_rejected(self):
        notice = self.notice()
        for payload in [{}, [], self.event(notice, 'opened'),
                        {**self.event(notice, 'delivered'), 'ts_event': True},
                        self.event(notice, 'delivered', timezone.now() + timedelta(days=1))]:
            response = self.client.post(reverse('brevo_event'), payload, format='json',
                                        HTTP_AUTHORIZATION='Bearer synthetic-webhook-secret')
            self.assertEqual(response.status_code, 400)
        self.assertEqual(EmailProviderEvent.objects.count(), 0)

    def test_quota_bell_groups_exclude_other_batches_and_older_requests(self):
        from .email_outbox import reminders
        notice = self.notice()
        notice.status = 'quota'; notice.save()
        groups = reminders([self.batch])
        self.assertEqual(groups[0]['count'], 1)
        self.assertEqual(groups[0]['kind'], 'quota')
        self.assertNotIn(self.student.email, str(groups))
        self.assertEqual(reminders([]), [])
        self.notice(held=True)
        self.assertEqual(reminders([self.batch]), [])

    @override_settings(BREVO_ACCOUNT_EMAIL_RESERVE=1)
    def test_optional_account_reserve_does_not_block_account_notifications(self):
        self.get.return_value.json = lambda: {'plan': [{'type': 'free', 'creditsType': 'sendLimit', 'credits': 1}]}
        notice = self.notice()
        process_one(); notice.refresh_from_db()
        self.assertEqual(notice.reason, 'reserved_allowance')
        self.post.assert_not_called()
        enqueue(self.owner, 'Synthetic account notice', 'Test only')
        process_one()
        self.assertEqual(self.post.call_count, 1)
        notice.refresh_from_db()
        self.assertEqual(notice.status, 'quota')

    def test_retry_after_is_respected_without_logging_private_provider_body(self):
        self.post.side_effect = None
        self.post.return_value = Mock(status_code=429, headers={'Retry-After': '1800'})
        now = timezone.now()
        self.notice()
        process_one()
        control = EmailDispatchControl.objects.get(pk=1)
        self.assertGreaterEqual(control.check_after, now + timedelta(seconds=1800))

    def test_invalid_sender_configuration_pauses_the_batch_without_a_retry_storm(self):
        for _ in range(10):
            self.notice()
        with override_settings(BREVO_SENDER_EMAIL=''):
            process_one()
        self.post.assert_not_called()
        self.assertEqual(EmailDispatchControl.objects.get().reason, 'configuration')
        EmailDispatchControl.objects.all().delete()
        EmailNotice.objects.all().update(due_at=timezone.now())
        self.post.side_effect = None
        self.post.return_value = Mock(status_code=400, json=lambda: {'code': 'invalid_parameter', 'message': 'Sender secret@example.invalid is not verified'})
        process_one(); process_one()
        self.assertEqual(self.post.call_count, 1)
        self.assertEqual(EmailDispatchControl.objects.get().reason, 'configuration')
        self.assertNotIn('secret', str(list(EmailAttempt.objects.values('reason'))))

    def test_bulk_50_pending_sends_do_not_query_once_per_recipient(self):
        from django.test.utils import CaptureQueriesContext
        ids = []
        for i in range(50):
            person = User.objects.create_user(f'pending-{i}@dnsc.edu.ph', name=f'Synthetic Pending {i}', role='student', is_approved=True)
            BatchEnrollment.objects.create(batch=self.batch, student=person)
            ids.append(person.pk)
        token = self.client.get(self.url).data['review_token']
        with CaptureQueriesContext(connection) as queries:
            response = self.action('send', ids=ids, token=token)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['changed'], 50)
        self.assertEqual(EmailNotice.objects.filter(status='queued').count(), 50)
        self.assertLess(len(queries), 35)
        self.post.assert_not_called()


@override_settings(BREVO_API_KEY='synthetic-test-key', BREVO_SENDER_EMAIL='sender@example.invalid', BREVO_ACCOUNT_EMAIL_RESERVE=0)
@skipUnlessDBFeature('has_select_for_update')
class EmailConcurrencyTests(TransactionTestCase):
    def setUp(self):
        self.owner = User.objects.create_user('race-owner@dnsc.edu.ph', role='instructor', is_approved=True)
        self.student = User.objects.create_user('race-student@dnsc.edu.ph', role='student', is_approved=True)
        self.batch = Batch.objects.create(name='Synthetic Race Batch', instructor=self.owner)
        self.enrollment = BatchEnrollment.objects.create(batch=self.batch, student=self.student)
        self.notice = enqueue(self.student, 'Synthetic', 'Test only', enrollment=self.enrollment, actor=self.owner)

    @staticmethod
    def run_worker():
        close_old_connections()
        try:
            return process_one()
        finally:
            connection.close()

    def test_duplicate_enrollment_requests_share_one_result_and_one_notice(self):
        url = reverse('instructor_batch_enroll', args=[self.batch.pk])
        client = APIClient(); client.force_authenticate(self.owner)
        preview = client.post(url + 'preview/', {'students': [{'name': 'Synthetic Concurrent Enrollment',
            'school_id': '2026-99881', 'email': 'synthetic-concurrent@dnsc.edu.ph', 'course': 'BSIT'}]}, format='json')
        self.assertEqual(preview.status_code, 200)
        payload = {'students': preview.data['rows'], 'review_token': preview.data['review_token'],
                   'email_mode': 'later', 'request_id': str(uuid.uuid4())}
        barrier = threading.Barrier(2)
        def enroll():
            close_old_connections()
            try:
                actor = User.objects.get(pk=self.owner.pk)
                requester = APIClient(); requester.force_authenticate(actor)
                barrier.wait(timeout=10)
                response = requester.post(url, payload, format='json')
                return response.status_code, response.data
            finally:
                connection.close()
        with ThreadPoolExecutor(2) as pool:
            results = list(pool.map(lambda _: enroll(), range(2)))
        self.assertEqual(results[0], results[1])
        self.assertEqual(results[0][0], 200)
        self.assertEqual(results[0][1]['summary']['enrolled'], 1)
        self.assertEqual(EmailCommand.objects.filter(pk=payload['request_id']).count(), 1)
        self.assertEqual(EmailNotice.objects.filter(student__email='synthetic-concurrent@dnsc.edu.ph').count(), 1)

    @patch('api.email_outbox.requests.get', return_value=Mock(status_code=200, json=lambda: {'plan': [{'type': 'free', 'creditsType': 'sendLimit', 'credits': 1}]}))
    def test_two_workers_share_one_claim_and_one_remaining_credit(self, get):
        enqueue(self.student, 'Second synthetic', 'Test only', enrollment=self.enrollment, actor=self.owner)
        entered, release = threading.Event(), threading.Event()
        def provider(*args, **kwargs):
            entered.set()
            if not release.wait(10):
                raise RuntimeError('Synthetic provider wait timed out')
            return Mock(status_code=201, json=lambda: {'messageId': '<race@example.invalid>'})
        with patch('api.email_outbox.requests.post', side_effect=provider) as post, ThreadPoolExecutor(2) as pool:
            first = pool.submit(self.run_worker)
            self.assertTrue(entered.wait(10))
            try:
                self.assertEqual(pool.submit(self.run_worker).result(timeout=10), 0)
            finally:
                release.set()
            self.assertEqual(first.result(timeout=10), 1)
            process_one()
        self.assertEqual(post.call_count, 1)
        self.assertEqual(EmailNotice.objects.filter(status='accepted').count(), 1)
        self.assertEqual(EmailNotice.objects.filter(status='quota').count(), 1)

    def test_repeated_commands_across_connections_create_only_one_notice(self):
        self.notice.delete()
        client = APIClient(); client.force_authenticate(self.owner)
        url = reverse('enrollment_emails', args=[self.batch.pk])
        data = {'action': 'send', 'student_ids': [self.student.pk], 'review_token': client.get(url).data['review_token'], 'request_id': str(uuid.uuid4())}
        barrier = threading.Barrier(2)
        def send():
            close_old_connections()
            try:
                local = APIClient(); local.force_authenticate(self.owner)
                barrier.wait(timeout=10)
                response = local.post(url, data, format='json')
                return response.status_code, response.data
            finally:
                connection.close()
        with ThreadPoolExecutor(2) as pool:
            futures = [pool.submit(send) for _ in range(2)]
            results = [future.result(timeout=15) for future in futures]
        self.assertEqual([r[0] for r in results], [200, 200])
        self.assertEqual(results[0][1], results[1][1])
        self.assertEqual(EmailNotice.objects.count(), 1)

    def test_holding_a_job_during_allowance_lookup_prevents_submission(self):
        entered, release = threading.Event(), threading.Event()
        def account(*args, **kwargs):
            entered.set()
            release.wait(10)
            return Mock(status_code=200, json=lambda: {'plan': [{'type': 'free', 'creditsType': 'sendLimit', 'credits': 1}]})
        with patch('api.email_outbox.requests.get', side_effect=account), patch('api.email_outbox.requests.post') as post, ThreadPoolExecutor(1) as pool:
            future = pool.submit(self.run_worker)
            self.assertTrue(entered.wait(10))
            try:
                client = APIClient(); client.force_authenticate(self.owner)
                url = reverse('enrollment_emails', args=[self.batch.pk])
                token = client.get(url).data['review_token']
                response = client.post(url, {'action': 'hold', 'student_ids': [self.student.pk], 'review_token': token, 'request_id': str(uuid.uuid4())}, format='json')
                self.assertEqual(response.data['changed'], 1)
            finally:
                release.set()
            self.assertEqual(future.result(timeout=15), 0)
        post.assert_not_called()
        self.notice.refresh_from_db()
        self.assertEqual(self.notice.status, 'held')
