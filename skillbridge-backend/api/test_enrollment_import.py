import copy
import json
import subprocess
from pathlib import Path
from unittest.mock import Mock, patch

from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .email_service import deliver_email, queue_email
from .enrollment_import import format_student_name, generate_dnsc_email, normalize_row, review_rows
from .models import Batch, BatchEnrollment, User


class EnrollmentImportTests(TestCase):
    def setUp(self):
        self.instructor = User.objects.create_user('teacher@dnsc.edu.ph', name='Test Instructor', role='instructor')
        self.admin = User.objects.create_user('admin@dnsc.edu.ph', name='Test Admin', role='admin')
        self.batch = Batch.objects.create(name='TEST IAMS', instructor=self.instructor)
        self.client = APIClient()
        self.client.force_authenticate(self.instructor)
        self.url = f'/api/instructor/batches/{self.batch.pk}/enroll/'
        self.row = {'Student Number': '2026-01982', 'First Name': 'Azel', 'Last Name': 'Villanueva',
                    'Program': 'BSIT', 'YearLevel': '4', 'source_row': 9, 'worksheet': 'Students', 'format': 'iams'}

    def preview(self, rows=None):
        return self.client.post(self.url + 'preview/', {'students': rows if rows is not None else [self.row]}, format='json')

    def confirm(self, preview=None):
        data = (preview or self.preview()).data
        return self.client.post(self.url, {'students': data['rows'], 'review_token': data['review_token']}, format='json')

    def student(self, **kwargs):
        return User.objects.create_user(**{'email': 'villanueva.azel@dnsc.edu.ph', 'name': 'Existing Name',
                                           'role': 'student', 'school_id': '2026-01982', 'course': 'BSIT', **kwargs})

    def test_email_normalization(self):
        cases = [('Azel', 'Villanueva', 'villanueva.azel'), (' David Rey ', 'Bali-os', 'bali-os.davidrey'),
                 ('José', 'D’Ángelo', 'dangelo.jose'), ('Anne 2', '—De––la Cruz—', 'de-lacruz.anne2')]
        for first, last, expected in cases:
            self.assertEqual(generate_dnsc_email(first, last), expected + '@dnsc.edu.ph')
        self.assertEqual(generate_dnsc_email('!!!', 'Test'), '')

    def test_space_based_name_formatting_in_preview_and_confirmation(self):
        self.assertEqual(format_student_name('  BALI-OS  '), 'Bali-os')
        self.assertEqual(format_student_name(' DELA   CERNA '), 'Dela Cerna')
        row = {**self.row, 'First Name': 'DAVID REY', 'Last Name': 'BALI-OS'}
        preview = self.preview([row])
        self.assertEqual(preview.data['rows'][0]['first_name'], 'David Rey')
        self.assertEqual(preview.data['rows'][0]['last_name'], 'Bali-os')
        self.assertEqual(preview.data['rows'][0]['name'], 'David Rey Bali-os')
        self.assertEqual(preview.data['rows'][0]['email'], 'bali-os.davidrey@dnsc.edu.ph')
        self.confirm(preview)
        self.assertEqual(User.objects.get(school_id='2026-01982').name, 'David Rey Bali-os')

    def test_legacy_manual_and_reviewed_display_names(self):
        for row, expected in (
            ({'name': 'DAVID REY BALI-OS', 'student_id': '2026-00001', 'email': 'legacy@dnsc.edu.ph', 'course': 'BSIT'}, 'David Rey Bali-os'),
            ({'name': 'DAVID REY DELA CERNA', 'school_id': '2026-00002', 'email': 'manual@dnsc.edu.ph', 'course': 'BSIS'}, 'David Rey Dela Cerna'),
        ):
            preview = self.preview([row])
            self.assertEqual(preview.data['rows'][0]['name'], expected)
            self.confirm(preview)
            self.assertEqual(User.objects.get(school_id=row.get('student_id', row.get('school_id'))).name, expected)
        edited = self.preview([{**self.row, 'First Name': 'DAVID REY', 'Last Name': 'BALI-OS',
                                'name': 'CUSTOM DISPLAY-NAME'}]).data['rows'][0]
        self.assertEqual(edited['name'], 'Custom Display-name')
        corrected = self.preview([{**self.row, 'First Name': 'DAVID REY', 'Last Name': 'BALI-OS',
                                   'name': 'David Rey McDonald', 'name_edited': True}])
        self.assertEqual(corrected.data['rows'][0]['name'], 'David Rey McDonald')
        self.confirm(corrected)
        self.assertEqual(User.objects.get(school_id='2026-01982').name, 'David Rey McDonald')

    def test_existing_student_name_is_not_reformatted(self):
        existing = self.student(name='Existing McNAME')
        self.assertEqual(self.preview().data['rows'][0]['status'], 'existing_student')
        self.confirm()
        existing.refresh_from_db()
        self.assertEqual(existing.name, 'Existing McNAME')

    def test_aliases_preserve_text_and_reject_numbers_and_conflicting_aliases(self):
        for alias in ('Student Number', 'Student ID', 'student_id', 'studentId', 'school_id'):
            row = normalize_row({alias: '0001-00002', 'name': 'Synthetic Person', 'email': 'person@dnsc.edu.ph', 'course': 'BSIS'}, 0)
            self.assertEqual(row['school_id'], '0001-00002')
            self.assertEqual(row['status'], 'ready')
            self.assertNotIn('id', row)
        for extra in ({'Student Number': 202601982}, {'student_id': '2026-00001'}):
            self.assertEqual(normalize_row({**self.row, **extra}, 0)['status'], 'invalid')

    @patch('api.views.send_instructor_email')
    def test_preview_no_writes_or_email(self, mail):
        before = (User.objects.count(), BatchEnrollment.objects.count())
        response = self.preview()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['summary']['ready'], 1)
        self.assertEqual(response.data['rows'][0]['email_source'], 'Generated')
        self.assertEqual(before, (User.objects.count(), BatchEnrollment.objects.count()))
        mail.assert_not_called()

    def test_program_mapping_and_unsupported_are_visible(self):
        for program in ('b.s.i.t.', 'BS IT', 'Bachelor of Science in Information Technology'):
            self.assertEqual(normalize_row({**self.row, 'Program': program}, 0)['course'], 'BSIT')
        result = self.preview([{**self.row, 'Program': 'BCRIM'}]).data
        self.assertEqual(result['summary']['unsupported'], 1)
        self.assertEqual(len(result['rows']), 1)
        self.assertEqual(self.confirm(self.preview([{**self.row, 'Program': 'BCRIM'}])).data['summary']['enrolled'], 0)

    def test_missing_names_and_email_validation(self):
        for extra in ({'First Name': ''}, {'Last Name': '!!!'}, {'email': 'wrong@example.com'}, {'email': 'bad@evil@dnsc.edu.ph'}):
            self.assertEqual(self.preview([{**self.row, **extra}]).data['rows'][0]['status'], 'invalid')
        reviewed = self.preview([{**self.row, 'email': 'controlled@dnsc.edu.ph', 'email_source': 'Edited'}]).data['rows'][0]
        self.assertEqual(reviewed['email_source'], 'Edited')

    def test_existing_template(self):
        row = {'name': 'Synthetic Person', 'studentId': '0001-00002', 'email': 'test@dnsc.edu.ph', 'course': 'bsis'}
        result = self.preview([row]).data['rows'][0]
        self.assertEqual(result['status'], 'ready')
        self.assertEqual(result['email_source'], 'Provided')
        self.assertEqual(result['first_name'], '')

    def test_actual_frontend_parser_to_backend_contract(self):
        # Header detection belongs to SheetJS, not a duplicate Python parser.
        # Exercise that real boundary from the isolated backend test suite.
        headers = ['Student Number', 'Last Name', 'First Name', 'Program', 'YearLevel']
        sheets = [
            [['Davao Del Norte State College'], ['Address'], [], [], ['Student Data'],
             ['System Generated: 2026-09-30'], [], headers,
             ['0001-00002', 'Bali-os', 'David Rey', 'BSIT', '4']],
            [headers, ['2026-00003', 'Synthetic', 'Other', 'BCRIM', '4']],
            [['name', 'studentId', 'email', 'Course'], ['Legacy Synthetic', '2026-00004', 'legacy@dnsc.edu.ph', 'BSIS']],
        ]
        script = """
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';
import { parseWorkbook } from './src/utils/studentEnrollmentImport.js';
const book = XLSX.utils.book_new();
JSON.parse(readFileSync(0, 'utf8')).forEach((rows, i) =>
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Sheet' + i));
console.log(JSON.stringify(parseWorkbook(book)));
"""
        parsed = subprocess.run(['node', '--input-type=module', '-e', script], input=json.dumps(sheets),
                                text=True, capture_output=True, check=True, timeout=30,
                                cwd=Path(__file__).resolve().parents[2] / 'skillbridge-frontend')
        rows = json.loads(parsed.stdout)['students']
        self.assertEqual(rows[0]['source_row'], 9)
        self.assertEqual(rows[0]['school_id'], '0001-00002')
        result = self.preview(rows)
        self.assertEqual(result.data['summary']['total'], 3)
        self.assertEqual(result.data['summary']['ready'], 2)
        self.assertEqual(result.data['summary']['unsupported'], 1)
        self.assertEqual(result.data['rows'][0]['email'], 'bali-os.davidrey@dnsc.edu.ph')

    def test_confirmation_does_not_promote_blocked_preview_row(self):
        preview = self.preview([{**self.row, 'student_id': '2026-00001'}])
        self.assertEqual(preview.data['summary']['invalid'], 1)
        result = self.confirm(preview)
        self.assertEqual(result.data['summary']['enrolled'], 0)
        self.assertFalse(User.objects.filter(role='student').exists())

    def test_file_duplicates_by_id_and_normalized_email(self):
        for other in (self.row, {**self.row, 'Student Number': '2026-09999'},
                      {**self.row, 'email': 'other@dnsc.edu.ph'}):
            response = self.preview([self.row, other])
            self.assertEqual(response.data['summary']['duplicate'], 2)
            self.assertEqual(self.confirm(response).data['summary']['enrolled'], 0)

    def test_existing_user_matching_and_conflicts(self):
        existing = self.student()
        self.assertEqual(self.preview().data['rows'][0]['status'], 'existing_student')
        for extra in ({'email': 'different@dnsc.edu.ph'}, {'Student Number': '2026-09999'}, {'Program': 'BSIS'}):
            self.assertEqual(self.preview([{**self.row, **extra}]).data['rows'][0]['status'], 'conflict')
        existing.refresh_from_db()
        self.assertEqual(existing.school_id, '2026-01982')
        self.assertEqual(existing.name, 'Existing Name')

    def test_bulk_preview_uses_two_queries(self):
        self.student()
        other = {**self.row, 'Student Number': '2026-00004', 'First Name': 'Other'}
        with self.assertNumQueries(2):
            rows = review_rows([self.row, other], self.batch)
        self.assertEqual([r['status'] for r in rows], ['existing_student', 'ready'])

    @patch('api.enrollment_import.BatchEnrollment.objects.get_or_create', side_effect=IntegrityError('sensitive'))
    def test_failed_row_rolls_back_existing_identity_updates(self, create):
        student = self.student(school_id='', course='', is_approved=False)
        self.confirm()
        student.refresh_from_db()
        self.assertEqual(student.school_id, '')
        self.assertEqual(student.course, '')
        self.assertFalse(student.is_approved)

    def test_reject_instructor_or_inactive_identity(self):
        self.assertEqual(self.preview([{**self.row, 'email': self.instructor.email}]).data['rows'][0]['status'], 'conflict')
        self.student(is_active=False)
        self.assertEqual(self.preview().data['rows'][0]['status'], 'conflict')

    @patch('api.views.send_instructor_email', return_value=True)
    def test_confirmation_internal_id_school_id_and_after_commit(self, mail):
        with self.captureOnCommitCallbacks(execute=True) as callbacks:
            response = self.confirm()
            mail.assert_not_called()
        self.assertEqual(len(callbacks), 1)
        mail.assert_called_once()
        student = User.objects.get(school_id='2026-01982')
        self.assertIsInstance(student.pk, int)
        self.assertNotEqual(str(student.pk), '2026-01982')
        self.assertFalse(student.has_usable_password())
        self.assertTrue(BatchEnrollment.objects.filter(student=student, batch=self.batch).exists())
        self.assertEqual(response.data['rows'][0]['notification_status'], 'queued')

    @patch('api.views.send_instructor_email', return_value=True)
    def test_existing_student_empty_id_backfilled_only(self, mail):
        student = self.student(school_id='')
        with self.captureOnCommitCallbacks(execute=True):
            self.confirm()
        student.refresh_from_db()
        self.assertEqual(student.school_id, '2026-01982')
        self.assertEqual(student.name, 'Existing Name')
        self.assertEqual(User.objects.filter(role='student').count(), 1)

    @patch('api.views.send_instructor_email')
    def test_already_enrolled_no_email(self, mail):
        student = self.student()
        BatchEnrollment.objects.create(student=student, batch=self.batch)
        preview = self.preview()
        self.assertEqual(preview.data['summary']['already_enrolled'], 1)
        with self.captureOnCommitCallbacks(execute=True):
            result = self.confirm(preview)
        self.assertEqual(result.data['rows'][0]['notification_status'], 'skipped_existing_enrollment')
        mail.assert_not_called()

    @patch('api.views.send_instructor_email', side_effect=RuntimeError('private secret'))
    def test_notification_failure_preserves_enrollment(self, mail):
        with self.assertLogs('api.enrollment_import', level='WARNING') as logs:
            with self.captureOnCommitCallbacks(execute=True):
                result = self.confirm()
        self.assertEqual(result.data['rows'][0]['status'], 'enrolled')
        self.assertEqual(result.data['rows'][0]['notification_status'], 'dispatch_failed')
        self.assertEqual(BatchEnrollment.objects.count(), 1)
        self.assertNotIn('private secret', str(logs.output))
        self.assertNotIn('@', str(logs.output))

    @patch('api.enrollment_import.BatchEnrollment.objects.get_or_create', side_effect=IntegrityError('sensitive'))
    def test_failed_enrollment_rolls_back_new_user(self, create):
        result = self.confirm()
        self.assertEqual(result.data['rows'][0]['status'], 'conflict')
        self.assertFalse(User.objects.filter(role='student').exists())
        self.assertNotIn('sensitive', str(result.data))

    def test_review_required_expired_changed_or_wrong_actor(self):
        self.assertEqual(self.client.post(self.url, {'students': [self.row]}, format='json').status_code, 400)
        self.assertEqual(self.client.post(self.url, {'students': [self.row], 'review_token': []}, format='json').status_code, 400)
        self.assertEqual(self.client.post(self.url + 'preview/', [self.row], format='json').status_code, 400)
        preview = self.preview()
        changed = copy.deepcopy(preview.data)
        changed['rows'][0]['email'] = 'changed@dnsc.edu.ph'
        self.assertEqual(self.client.post(self.url, {'students': changed['rows'], 'review_token': changed['review_token']}, format='json').status_code, 400)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.confirm(preview).status_code, 400)
        self.client.force_authenticate(self.instructor)
        with patch('django.core.signing.time.time', return_value=9999999999):
            self.assertEqual(self.confirm(preview).status_code, 400)

    def test_revalidation_after_preview(self):
        preview = self.preview()
        self.student(email='changed@dnsc.edu.ph')
        self.assertEqual(self.confirm(preview).data['rows'][0]['status'], 'conflict')

    def test_authorization_and_batch_scope(self):
        other = User.objects.create_user('other@dnsc.edu.ph', name='Other', role='instructor')
        self.client.force_authenticate(other)
        self.assertEqual(self.preview().status_code, 404)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.preview().status_code, 200)
        self.assertEqual(self.confirm().status_code, 200)
        self.client.force_authenticate(self.student(email='third@dnsc.edu.ph', school_id='2026-00003'))
        self.assertEqual(self.preview().status_code, 403)
        self.assertEqual(self.client.post(self.url, {}, format='json').status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.preview().status_code, 401)

    def test_archived_batch_and_payload_limits(self):
        for payload in ([], {}, [None], [self.row] * 1001):
            self.assertEqual(self.preview(payload).status_code, 400)
        self.batch.status = 'archived'
        self.batch.save()
        self.assertEqual(self.preview().status_code, 404)

    def test_database_identity_constraints(self):
        self.student()
        for extra in ({'email': 'other@dnsc.edu.ph'}, {'email': 'VILLANUEVA.AZEL@dnsc.edu.ph', 'school_id': '2026-00003'}):
            with self.assertRaises(IntegrityError), transaction.atomic():
                self.student(**extra)


@override_settings(BREVO_API_KEY='synthetic-key', BREVO_SENDER_EMAIL='sender@example.com', ENROLLMENT_SMTP_FALLBACK=False)
class EmailServiceTests(TestCase):
    message = dict(user_id=123, email='private@dnsc.edu.ph', name='Synthetic', subject='Enrollment', body='Google login instructions')

    @patch('api.email_service.requests.post')
    def test_https_timeout_and_provider_acceptance(self, post):
        post.return_value = Mock(status_code=201)
        with self.assertLogs('api.email_service', level='INFO') as logs:
            self.assertTrue(deliver_email(**self.message))
        self.assertEqual(post.call_args.kwargs['timeout'], (5, 15))
        self.assertEqual(post.call_args.kwargs['json']['textContent'], self.message['body'])
        self.assertNotIn('@', str(logs.output))

    @patch('api.email_service.send_mail')
    @patch('api.email_service.requests.post')
    @override_settings(ENROLLMENT_SMTP_FALLBACK=True, RAILWAY_ENVIRONMENT=True)
    def test_failure_privacy_and_no_railway_smtp(self, post, smtp):
        post.side_effect = RuntimeError('private@dnsc.edu.ph secret response body')
        with self.assertLogs('api.email_service', level='WARNING') as logs:
            self.assertFalse(deliver_email(**self.message))
        self.assertNotIn('@', str(logs.output))
        self.assertNotIn('secret', str(logs.output))
        smtp.assert_not_called()

    @patch('api.email_service.requests.post')
    def test_provider_error_body_not_logged(self, post):
        post.return_value = Mock(status_code=400, text='secret private@dnsc.edu.ph')
        with self.assertLogs('api.email_service', level='WARNING') as logs:
            self.assertFalse(deliver_email(**self.message))
        self.assertNotIn('secret', str(logs.output))

    @override_settings(BREVO_API_KEY='', ENROLLMENT_SMTP_FALLBACK=True, RAILWAY_ENVIRONMENT=False)
    @patch('api.email_service.send_mail', return_value=1)
    def test_opt_in_local_smtp(self, smtp):
        self.assertTrue(deliver_email(**self.message))
        smtp.assert_called_once()

    @patch('api.email_service.threading.Thread')
    @patch('api.email_service._worker', None)
    def test_worker_start_failure(self, thread):
        thread.return_value.start.side_effect = RuntimeError('secret')
        self.assertFalse(queue_email(Mock(pk=123), 'subject', 'body'))
