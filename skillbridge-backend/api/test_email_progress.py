from datetime import timedelta
from unittest.mock import Mock, patch
import uuid

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from .email_outbox import eligible, process_one
from .email_progress import progress_groups
from .models import Batch, BatchEnrollment, EmailCommand, EmailDispatchControl, EmailNotice, ManagementAction, User


class EmailProgressTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user('progress-owner@example.invalid', role='instructor', is_approved=True)
        self.admin = User.objects.create_user('progress-admin@example.invalid', role='admin')
        self.batch = Batch.objects.create(name='Synthetic progress batch', instructor=self.owner)
        self.url = reverse('instructor_batch_enroll', args=[self.batch.pk])
        self.email_url = reverse('enrollment_emails', args=[self.batch.pk])
        self.progress_url = reverse('email_progress', args=[self.batch.pk])
        self.client.force_authenticate(self.owner)

    def review(self, count=1, mode='now'):
        rows = [{'name': f'Synthetic Student {i}', 'school_id': f'2026-{i:05}',
                 'email': f'progress-{i}@dnsc.edu.ph', 'course': 'BSIT'} for i in range(1, count + 1)]
        result = self.client.post(self.url + 'preview/', {'students': rows}, format='json')
        self.assertEqual(result.status_code, 200, result.data)
        return {'students': result.data['rows'], 'review_token': result.data['review_token'],
                'email_mode': mode, 'request_id': str(uuid.uuid4())}

    def enroll(self, count=1, mode='now'):
        payload = self.review(count, mode)
        response = self.client.post(self.url, payload, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        return payload, response.data

    def groups(self):
        response = self.client.get(self.progress_url)
        self.assertEqual(response.status_code, 200, response.data)
        return response.data['groups']

    @patch('api.email_outbox.requests.post')
    @patch('api.email_outbox.requests.get')
    def test_fifty_recipients_two_submissions_quota_reset_and_delivery_are_distinct(self, get, post):
        with patch('api.email_outbox.settings.BREVO_API_KEY', 'synthetic'), \
                patch('api.email_outbox.settings.BREVO_SENDER_EMAIL', 'sender@example.invalid'):
            _, result = self.enroll(50)
            get.assert_not_called(); post.assert_not_called()
            get.return_value = Mock(status_code=200, json=lambda: {'plan': [{'type': 'free', 'creditsType': 'sendLimit', 'credits': 2}]})
            post.side_effect = lambda *args, **kwargs: Mock(status_code=201, json=lambda: {'messageId': kwargs['json']['tags'][0]})
            process_one(); process_one(); process_one()
        group = self.groups()[0]
        self.assertEqual((group['id'], group['total'], group['submitted'], group['waiting'], group['state']),
                         (result['request_id'], 50, 2, 48, 'quota'))
        self.assertEqual(group['delivered'], 0)
        # Receiving provider acceptance for every request is not a delivery claim.
        EmailNotice.objects.update(status='accepted', accepted_at=timezone.now())
        self.assertEqual(self.groups()[0]['state'], 'submitted')
        EmailNotice.objects.update(status='delivered', delivered_at=timezone.now())
        self.assertEqual(self.groups()[0]['state'], 'delivered')
        EmailNotice.objects.filter(pk=EmailNotice.objects.first().pk).update(status='failed', suppressed=True)
        group = self.groups()[0]
        self.assertEqual((group['state'], group['submitted'], group['delivered'], group['failed']), ('attention', 50, 49, 1))

    def test_lost_enrollment_response_reuses_receipt_before_expired_review_check(self):
        payload, original = self.enroll(2, 'later')
        with patch('api.enrollment_import.verify_token', return_value=False):
            retried = self.client.post(self.url, payload, format='json')
        self.assertEqual(retried.status_code, 200)
        self.assertEqual(retried.data, original)
        self.assertEqual((BatchEnrollment.objects.count(), EmailNotice.objects.count(), EmailCommand.objects.count()), (2, 2, 1))
        self.assertEqual(ManagementAction.objects.filter(action='enrollment.confirm').count(), 1)
        payload['email_mode'] = 'now'
        self.assertEqual(self.client.post(self.url, payload, format='json').status_code, 409)
        payload['email_mode'] = 'later'
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.post(self.url, payload, format='json').status_code, 409)

    def test_groups_keep_their_denominator_through_partial_release_resend_and_unenroll(self):
        _, original = self.enroll(3, 'later')
        group = self.groups()[0]
        self.assertEqual((group['total'], group['held'], group['state']), (3, 3, 'held'))
        student = BatchEnrollment.objects.first().student
        token = self.client.get(self.email_url).data['review_token']
        action = self.client.post(self.email_url, {'action': 'send', 'student_ids': [student.pk],
            'review_token': token, 'request_id': str(uuid.uuid4())}, format='json')
        self.assertEqual(action.status_code, 200)
        groups = {item['id']: item for item in self.groups()}
        self.assertEqual((groups[original['request_id']]['total'], groups[original['request_id']]['held']), (3, 2))
        self.assertEqual(groups[action.data['request_id']]['total'], 1)
        notice = EmailNotice.objects.get(student=student)
        notice.status, notice.accepted_at = 'accepted', timezone.now()
        notice.save()
        EmailNotice.objects.filter(pk=notice.pk).update(updated_at=timezone.now() - timedelta(minutes=16))
        token = self.client.get(self.email_url).data['review_token']
        action = self.client.post(self.email_url, {'action': 'resend', 'student_ids': [student.pk],
            'review_token': token, 'request_id': str(uuid.uuid4()), 'reason': 'Synthetic student request'}, format='json')
        self.assertEqual(action.data['changed'], 1)
        self.assertEqual(next(item for item in self.groups() if item['id'] == original['request_id'])['total'], 3)
        BatchEnrollment.objects.filter(student=student).delete()
        notice.delete()
        group = next(item for item in self.groups() if item['id'] == original['request_id'])
        self.assertEqual((group['total'], group['failed'], group['state']), (3, 1, 'attention'))

    def test_notification_persistence_failure_still_saves_enrollment_and_reports_attention(self):
        with patch('api.views.send_instructor_email', return_value=False):
            _, result = self.enroll()
        self.assertEqual(result['summary']['enrolled'], 1)
        self.assertEqual(result['summary']['notifications_failed'], 1)
        self.assertEqual((self.groups()[0]['total'], self.groups()[0]['failed'], self.groups()[0]['state']), (1, 1, 'attention'))

    def test_progress_reads_are_scoped_read_only_and_require_approved_active_staff(self):
        payload, _ = self.enroll()
        self.assertEqual(self.groups()[0]['state'], 'paused')
        before = (EmailNotice.objects.count(), EmailCommand.objects.count(), ManagementAction.objects.count())
        with patch('api.email_outbox.requests.get', side_effect=AssertionError('Reads never send')), \
                patch('api.email_outbox.requests.post', side_effect=AssertionError('Reads never send')):
            self.groups()
        self.assertEqual(before, (EmailNotice.objects.count(), EmailCommand.objects.count(), ManagementAction.objects.count()))
        other = User.objects.create_user('progress-other@example.invalid', role='instructor', is_approved=True)
        self.client.force_authenticate(other)
        self.assertEqual(self.client.get(self.progress_url).status_code, 404)
        self.client.force_authenticate(self.owner)
        self.owner.is_approved = False; self.owner.save()
        self.assertEqual(self.client.get(self.progress_url).status_code, 403)
        self.assertEqual(self.client.post(self.url + 'preview/', {'students': []}, format='json').status_code, 403)
        self.assertEqual(self.client.post(self.url, payload, format='json').status_code, 403)
        self.owner.is_approved = True; self.owner.is_active = False; self.owner.save()
        self.assertEqual(self.client.post(self.url, payload, format='json').status_code, 403)

    def test_queries_are_bounded_and_only_five_recent_groups_per_batch_are_returned(self):
        _, first = self.enroll()
        receipt = EmailCommand.objects.get(pk=first['request_id'])
        for _ in range(8):
            EmailCommand.objects.create(id=uuid.uuid4(), actor=self.owner, batch_id_snapshot=self.batch.pk,
                digest='synthetic', result={'email_group': receipt.result['email_group']})
        with CaptureQueriesContext(connection) as queries:
            groups = progress_groups([self.batch])
        self.assertEqual(len(groups), 5)
        self.assertEqual(len(queries), 3)
        self.assertNotIn('progress-1@', str(groups))
        self.assertNotIn('notice_ids', str(groups))

    def test_admin_retry_rechecks_recipient_and_uses_current_staff_authority(self):
        self.enroll()
        notice = EmailNotice.objects.get()
        EmailNotice.objects.filter(pk=notice.pk).update(status='failed', reason='connection')
        other = User.objects.create_user('progress-new-owner@example.invalid', role='instructor', is_approved=True)
        self.batch.instructor = other; self.batch.save()
        self.client.force_authenticate(self.admin)
        def retry():
            token = self.client.get(self.email_url).data['review_token']
            return self.client.post(self.email_url, {'action': 'retry', 'student_ids': [notice.student_id],
                'review_token': token, 'request_id': str(uuid.uuid4())}, format='json')
        self.assertEqual(retry().data['changed'], 1)
        notice.refresh_from_db()
        self.assertEqual(notice.actor_id, self.admin.pk)
        self.assertTrue(eligible(notice))
        EmailNotice.objects.filter(pk=notice.pk).update(status='failed', reason='connection')
        User.objects.filter(pk=notice.student_id).update(email='progress-changed@dnsc.edu.ph')
        response = retry()
        self.assertEqual((response.data['changed'], response.data['skipped']), (0, 1))

    def test_service_warning_requires_unsent_eligible_jobs_and_diagnostics_are_admin_only(self):
        self.enroll(mode='later')
        EmailDispatchControl.objects.create(pk=1, reason='quota', checked_at=timezone.now())
        notice = EmailNotice.objects.get()
        for actor in (self.owner, self.admin):
            self.client.force_authenticate(actor)
            for status in ('held', 'accepted', 'provider_pending', 'delivered', 'failed', 'uncertain', 'cancelled'):
                with self.subTest(role=actor.role, status=status):
                    EmailNotice.objects.filter(pk=notice.pk).update(status=status)
                    service = self.client.get(self.email_url).data['service']
                    self.assertEqual(service['waiting_count'], 0)
                    self.assertEqual(service['notice'], '')
                    self.assertNotIn('diagnostics', service)
            for status in ('queued', 'retry', 'quota', 'sending'):
                with self.subTest(role=actor.role, status=status):
                    EmailNotice.objects.filter(pk=notice.pk).update(status=status)
                    service = self.client.get(self.email_url).data['service']
                    self.assertEqual(service['waiting_count'], 1)
                    self.assertFalse(service['worker_recent'])
                    self.assertEqual('diagnostics' in service, actor.role == 'admin')
                    self.assertNotIn('allowance_checked_at', service)
                    self.assertNotIn('next_allowance_check', service)
        User.objects.filter(pk=notice.student_id).update(is_active=False)
        self.assertEqual(self.client.get(self.email_url).data['service']['waiting_count'], 0)
        notice.delete()
        service = self.client.get(self.email_url).data['service']
        self.assertEqual(service['waiting_count'], 0)
        self.assertNotIn('diagnostics', service)

    def test_email_roster_includes_current_profile_photo_only_for_authorized_staff(self):
        self.enroll(2, 'later')
        students = list(User.objects.filter(role='student').order_by('name'))
        photo = 'https://images.example.invalid/synthetic-profile.webp'
        User.objects.filter(pk=students[0].pk).update(photo_url=photo)
        for actor in (self.owner, self.admin):
            self.client.force_authenticate(actor)
            response = self.client.get(self.email_url)
            self.assertEqual(response.status_code, 200)
            photos = {row['student_id']: row['photo_url'] for row in response.data['rows']}
            self.assertEqual(photos, {students[0].pk: photo, students[1].pk: ''})
        self.client.force_authenticate(students[0])
        self.assertEqual(self.client.get(self.email_url).status_code, 403)
        other = User.objects.create_user('photo-other@example.invalid', role='instructor', is_approved=True)
        self.client.force_authenticate(other)
        self.assertEqual(self.client.get(self.email_url).status_code, 404)
