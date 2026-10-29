"""Missing optional email tables must not break analytics on the current core schema."""
from io import StringIO
from unittest.mock import patch
import uuid

from django.core.management import call_command, CommandError
from django.db import connection, OperationalError
from django.test import TestCase, TransactionTestCase
from django.urls import reverse
from rest_framework.test import APIClient

from .email_outbox import email_storage_ready
from .models import (Batch, BatchEnrollment, EmailCommand, EmailNotice, User,
                     EmailAttempt, EmailDispatchControl, EmailProviderEvent)


class EmailSchemaReadinessTests(TestCase):
    def test_a_partially_available_email_schema_is_not_ready(self):
        tables = connection.introspection.table_names()
        self.assertTrue(email_storage_ready())
        with patch.object(connection.introspection, 'table_names',
                          return_value=[table for table in tables if table != EmailCommand._meta.db_table]):
            self.assertFalse(email_storage_ready())

    def test_connection_failures_are_not_hidden_as_pending_setup(self):
        with patch.object(connection.introspection, 'table_names',
                          side_effect=OperationalError('Synthetic connection failure')):
            with self.assertRaises(OperationalError):
                email_storage_ready()


class EmailSchemaRolloutTests(TransactionTestCase):
    def test_analytics_survives_missing_email_tables_and_email_controls_recover(self):
        # Keep mandatory lifecycle columns. Physically remove just the optional
        # email tables, rather than running current models against an old core schema.
        email_models = (EmailDispatchControl, EmailProviderEvent, EmailCommand, EmailNotice, EmailAttempt)
        def restore_email_schema():
            existing = set(connection.introspection.table_names())
            with connection.schema_editor() as editor:
                for model in email_models:
                    if model._meta.db_table not in existing:
                        editor.create_model(model)
        with connection.schema_editor() as editor:
            for model in reversed(email_models):
                editor.delete_model(model)
        try:
            self.assertFalse(email_storage_ready())
            admin = User.objects.create_user('rollout-admin@example.invalid', role='admin', name='Admin')
            owner = User.objects.create_user('rollout-owner@example.invalid', role='instructor',
                                             name='Owner', is_approved=True)
            other = User.objects.create_user('rollout-other@example.invalid', role='instructor',
                                             name='Other owner', is_approved=True)
            student = User.objects.create_user('rollout-student@dnsc.edu.ph', role='student',
                                               name='Synthetic student', is_approved=True)
            batch = Batch.objects.create(name='Rollout cohort', instructor=owner)
            foreign = Batch.objects.create(name='Foreign cohort', instructor=other)
            BatchEnrollment.objects.create(batch=batch, student=student)
            client = APIClient()
            analytics_url = reverse('management_analytics')
            email_url = reverse('enrollment_emails', args=[batch.pk])
            with patch('api.email_outbox.requests.get', side_effect=AssertionError('No provider IO')), \
                    patch('api.email_outbox.requests.post', side_effect=AssertionError('No sends')):
                for staff in (admin, owner):
                    client.force_authenticate(staff)
                    response = client.get(analytics_url)
                    self.assertEqual(response.status_code, 200, response.data)
                    self.assertEqual(response.data['summary']['students'], 1)
                    self.assertFalse(response.data['email_storage_ready'])
                    self.assertEqual(response.data['email_notifications'], [])
                    response = client.get(email_url)
                    self.assertEqual(response.status_code, 503, response.data)
                    self.assertEqual(response.data['code'], 'email_setup_required')
                    response = client.post(email_url, {'action': 'send', 'student_ids': [student.pk],
                        'request_id': str(uuid.uuid4()), 'review_token': 'not-issued'}, format='json')
                    self.assertEqual(response.status_code, 503, response.data)

                # Access checks still run before revealing feature setup status.
                client.force_authenticate(owner)
                self.assertEqual(client.get(reverse('enrollment_emails', args=[foreign.pk])).status_code, 404)
                self.assertEqual(client.get(analytics_url, {'batch_id': foreign.pk}).status_code, 404)
                client.force_authenticate(student)
                self.assertEqual(client.get(email_url).status_code, 403)
                self.assertEqual(client.get(analytics_url).status_code, 403)
                with self.assertRaisesMessage(CommandError, 'Apply backend migration 0027'):
                    call_command('process_email_outbox', once=True, stdout=StringIO())

                restore_email_schema()
                self.assertTrue(email_storage_ready())
                client.force_authenticate(owner)
                response = client.get(analytics_url)
                self.assertEqual(response.status_code, 200, response.data)
                self.assertTrue(response.data['email_storage_ready'])
                self.assertEqual(response.data['summary']['students'], 1)
                response = client.get(email_url)
                self.assertEqual(response.status_code, 200, response.data)
                self.assertEqual(response.data['rows'][0]['status'], 'history_unavailable')
                self.assertEqual(BatchEnrollment.objects.filter(batch=batch, student=student).count(), 1)
                self.assertEqual(EmailNotice.objects.count(), 0)
        finally:
            restore_email_schema()
