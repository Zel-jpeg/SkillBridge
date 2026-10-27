"""Isolated synthetic assessment recovery, permissions and private evidence checks."""
from io import BytesIO
from uuid import uuid4
from unittest.mock import Mock, patch
from unittest import skipUnless
from django.db import connection, transaction, DataError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from PIL import Image, PngImagePlugin
from rest_framework.test import APITestCase
from rest_framework.exceptions import ValidationError
from .models import User, Batch, BatchEnrollment, Assessment, Question, AnswerChoice, StudentResponse, SkillScore, AssessmentAttemptHistory, SkillCategory
from . import retake_evidence


def image_upload():
    out = BytesIO()
    metadata = PngImagePlugin.PngInfo()
    metadata.add_text('private-note', 'synthetic metadata')
    Image.new('RGB', (1800, 1000), 'white').save(out, 'PNG', pnginfo=metadata)
    return SimpleUploadedFile('untrusted.dat', out.getvalue(), content_type='application/octet-stream')


class RecoveryTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email='recovery-owner@example.test', name='Owner', role='instructor')
        self.other = User.objects.create_user(email='recovery-other@example.test', role='instructor')
        self.admin = User.objects.create_user(email='recovery-admin@example.test', role='admin')
        self.student = User.objects.create_user(email='recovery-student@example.test', name='Synthetic Student', role='student')
        self.stranger = User.objects.create_user(email='recovery-stranger@example.test', role='student')
        self.batch = Batch.objects.create(name='Recovery fixture', instructor=self.owner)
        BatchEnrollment.objects.create(batch=self.batch, student=self.student)
        self.assessment = Assessment.objects.create(title='Recovery assessment', created_by=self.owner, batch=self.batch, duration_minutes=30)
        category = SkillCategory.objects.create(name='Programming', created_by=self.owner)
        self.question = Question.objects.create(assessment=self.assessment, question_text='Synthetic question', skill_category=category)
        self.choice = AnswerChoice.objects.create(question=self.question, choice_text='Choice', is_correct=True)
        self.client.force_authenticate(self.student)
        start = self.client.post(reverse('assessment_start', args=[self.assessment.id]))
        self.assertEqual(start.status_code, 200)
        self.attempt = StudentResponse.objects.get(pk=start.data['response_id'])
        self.identity = {'response_id': self.attempt.id, 'attempt_started_at': start.data['attempt_started_at']}
        self.answers = [{'question_id': self.question.id, 'selected_choice_id': self.choice.id}]
        self.endpoint = reverse('assessment_interruption', args=[self.assessment.id])
        self.request_url = reverse('student_retake_request', args=[self.assessment.id])
        self.review_url = reverse('review_retake_request', args=[self.assessment.id, self.student.id])
        self.evidence_url = reverse('retake_request_evidence', args=[self.assessment.id, self.student.id])

    def operation(self, action, **kwargs):
        return self.client.post(self.endpoint, {**self.identity, 'action': action, **kwargs}, format='json')

    def interrupt(self, seconds, reason='tab_hidden'):
        event_id = str(uuid4())
        self.assertEqual(self.operation('begin', event_id=event_id, reason=reason).status_code, 200)
        self.attempt.refresh_from_db()
        self.attempt.interruption_events[-1]['started_at'] = (timezone.now() - timezone.timedelta(seconds=seconds)).isoformat()
        self.attempt.save(update_fields=['interruption_events'])
        return self.operation('recover', event_id=event_id)

    def finalize(self):
        result = self.client.post(reverse('assessment_stop', args=[self.assessment.id]), {**self.identity, 'reason': 'interruption_review', 'answers': self.answers}, format='json')
        self.assertEqual(result.status_code, 200)

    def request(self, **extra):
        return self.client.post(self.request_url, {**self.identity, 'request_id': str(uuid4()),
            'explanation': 'A synthetic incoming call interrupted the assessment and I need another attempt.',
            'no_image_reason': 'The brief notification disappeared before I could capture it.', **extra}, format='json')

    def test_drafts_validate_and_resume_without_score_rows_or_timer_reset(self):
        result = self.operation('draft', answers=self.answers, revision=2)
        self.assertEqual(result.status_code, 200)
        result = self.operation('draft', answers=[], revision=1)
        self.assertEqual(result.status_code, 200)
        original = self.attempt.started_at
        start = self.client.post(reverse('assessment_start', args=[self.assessment.id]))
        self.assertEqual(start.data['draft_answers'], self.answers)
        self.assertEqual(start.data['attempt_started_at'], original.isoformat())
        self.assertFalse(SkillScore.objects.exists())
        bad = self.operation('draft', answers=[{'question_id': 999999}], revision=3)
        self.assertEqual(bad.status_code, 400)

    def test_short_focus_and_hidden_interruptions_are_neutral(self):
        for seconds, reason in [(0.1, 'window_lost_focus'), (1, 'tab_hidden')]:
            result = self.interrupt(seconds, reason)
            self.assertEqual(result.status_code, 200)
            self.assertFalse(result.data['review_required'])
            self.assertEqual(result.data['incident_count'], 0)
        self.attempt.refresh_from_db()
        self.assertFalse(self.attempt.is_flagged)
        self.assertEqual(self.attempt.status, 'in_progress')

    def test_three_meaningful_interruptions_require_review(self):
        for number in range(3):
            result = self.interrupt(11)
            self.assertEqual(result.data['review_required'], number == 2, result.data)
        result = self.client.post(reverse('assessment_submit', args=[self.assessment.id]), {**self.identity, 'answers': self.answers}, format='json')
        self.assertTrue(result.data['review_required'], result.data)
        self.attempt.refresh_from_db()
        self.assertEqual(self.attempt.status, 'stopped')
        self.assertEqual(self.attempt.stopped_reason, 'interruption_review')

    def test_cumulative_short_interruptions_and_long_open_event_require_review(self):
        for _ in range(7):
            result = self.interrupt(9)
        self.assertTrue(result.data['review_required'])
        self.assertEqual(result.data['incident_count'], 0)

    def test_long_open_event_enforced_at_submission_without_client_recovery(self):
        event_id = str(uuid4())
        self.operation('begin', event_id=event_id, reason='tab_hidden')
        self.attempt.refresh_from_db()
        self.attempt.interruption_events[0]['started_at'] = (timezone.now() - timezone.timedelta(seconds=61)).isoformat()
        self.attempt.save(update_fields=['interruption_events'])
        result = self.client.post(reverse('assessment_submit', args=[self.assessment.id]), {**self.identity, 'answers': self.answers}, format='json')
        self.assertEqual(result.status_code, 200)
        self.assertTrue(result.data['review_required'])
        self.attempt.refresh_from_db()
        self.assertEqual(self.attempt.stopped_reason, 'interruption_review')

    def test_open_event_blocks_submission_and_duplicate_event_does_not_duplicate(self):
        event_id = str(uuid4())
        for reason in ['window_lost_focus', 'tab_hidden', 'fullscreen_exited']:
            self.assertEqual(self.operation('begin', event_id=event_id, reason=reason).status_code, 200)
        self.attempt.refresh_from_db()
        self.assertEqual(len(self.attempt.interruption_events), 1)
        self.assertEqual(len(self.attempt.interruption_events[0]['reasons']), 3)
        result = self.client.post(reverse('assessment_submit', args=[self.assessment.id]), {**self.identity, 'answers': []}, format='json')
        self.assertEqual(result.status_code, 409)
        first = self.operation('recover', event_id=event_id)
        again = self.operation('recover', event_id=event_id)
        self.assertEqual(first.data['total_seconds'], again.data['total_seconds'])

    def test_stale_attempt_and_foreign_student_cannot_write(self):
        self.assertEqual(self.operation('draft', attempt_started_at='old', answers=[], revision=1).status_code, 400)
        self.client.force_authenticate(self.stranger)
        self.assertEqual(self.operation('draft', answers=[], revision=1).status_code, 404)
        self.assertEqual(self.client.get(self.request_url).status_code, 404)

    def test_request_requires_finalized_attempt_and_explanation_and_image_alternative(self):
        self.assertEqual(self.request().status_code, 409)
        self.finalize()
        self.assertEqual(self.request(explanation='short').status_code, 400)
        self.assertEqual(self.request(no_image_reason='').status_code, 400)
        self.assertEqual(self.request().status_code, 201)
        self.attempt.refresh_from_db()
        self.assertFalse(self.attempt.retake_allowed)
        self.assertEqual(self.attempt.retake_request_status, 'pending')
        self.assertEqual(self.client.get(self.request_url).data['request']['status'], 'pending')

    def test_explanation_accepts_500_characters_and_rejects_over_limit_without_saving(self):
        self.finalize()
        for explanation in ['x' * 29, 'x' * 501, 'x' * 2000]:
            self.assertEqual(self.request(explanation=explanation).status_code, 400)
            self.attempt.refresh_from_db()
            self.assertEqual(self.attempt.retake_request_status, '')
        self.assertEqual(self.request(explanation='é' * 500).status_code, 201)
        self.attempt.refresh_from_db()
        self.assertEqual(self.attempt.retake_explanation, 'é' * 500)

    def test_explanation_accepts_minimum_30_characters(self):
        self.finalize()
        self.assertEqual(self.request(explanation='x' * 30).status_code, 201)

    @skipUnless(connection.vendor == 'postgresql', 'Requires PostgreSQL varchar length enforcement')
    def test_database_rejects_over_500_even_without_api_validation(self):
        with self.assertRaises(DataError), transaction.atomic():
            StudentResponse.objects.filter(pk=self.attempt.pk).update(retake_explanation='x' * 501)
        self.attempt.refresh_from_db()
        self.assertEqual(self.attempt.retake_explanation, '')

    def test_request_retry_idempotent_and_second_request_conflicts(self):
        self.finalize()
        request_id = str(uuid4())
        self.assertEqual(self.request(request_id=request_id).status_code, 201)
        self.assertEqual(self.request(request_id=request_id).status_code, 200)
        self.assertEqual(self.request().status_code, 409)

    def test_review_scope_stale_identity_note_and_single_decision(self):
        self.finalize(); self.request()
        self.attempt.refresh_from_db()
        payload = {**self.identity, 'request_id': self.attempt.retake_request_id, 'decision': 'declined', 'note': 'Please discuss the interruption with your instructor.'}
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(reverse('retake_request_queue')).data['count'], 0)
        self.assertEqual(self.client.post(self.review_url, payload, format='json').status_code, 403)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.post(self.review_url, {**payload, 'request_id': str(uuid4())}, format='json').status_code, 409)
        self.assertEqual(self.client.post(self.review_url, {**payload, 'note': ''}, format='json').status_code, 400)
        self.assertEqual(self.client.post(self.review_url, payload, format='json').status_code, 200)
        self.assertEqual(self.client.post(self.review_url, payload, format='json').status_code, 409)

    def test_approved_retake_preserves_request_and_interruptions_in_history(self):
        self.interrupt(11); self.finalize(); self.request()
        self.attempt.refresh_from_db()
        self.client.force_authenticate(self.admin)
        result = self.client.post(self.review_url, {**self.identity, 'request_id': self.attempt.retake_request_id,
            'decision': 'approved', 'note': 'Reviewed interruption; a new attempt is approved.'}, format='json')
        self.assertEqual(result.status_code, 200)
        self.client.force_authenticate(self.student)
        restart = self.client.post(reverse('assessment_start', args=[self.assessment.id]))
        self.assertEqual(restart.status_code, 200)
        self.attempt.refresh_from_db()
        self.assertEqual(self.attempt.retake_request_status, '')
        self.assertEqual(self.attempt.draft_answers, [])
        history = AssessmentAttemptHistory.objects.get(response=self.attempt)
        self.assertEqual(history.retake_request['status'], 'approved')
        self.assertTrue(history.interruption_events)
        self.assertEqual(len(self.client.get(self.request_url).data['history']), 1)
        self.client.force_authenticate(self.owner)
        rows = self.client.get(reverse('retake_request_queue'), {'status': 'history'}).data
        self.assertEqual(rows['count'], 1)
        self.assertTrue(rows['results'][0]['read_only'])

    def test_pending_request_cannot_be_bypassed_by_legacy_approval(self):
        self.finalize(); self.request()
        self.client.force_authenticate(self.owner)
        result = self.client.patch(reverse('instructor_student_retake', args=[self.student.id]), {'assessment_id': self.assessment.id, 'retake_allowed': True}, format='json')
        self.assertEqual(result.status_code, 409)

    def test_expired_device_draft_can_request_review_after_deadline_but_cannot_restart(self):
        self.operation('draft', answers=self.answers, revision=1)
        self.attempt.refresh_from_db()
        self.attempt.expires_at = timezone.now() - timezone.timedelta(minutes=2)
        self.attempt.save(update_fields=['expires_at'])
        self.assessment.due_at = timezone.now() - timezone.timedelta(minutes=1)
        self.assessment.save(update_fields=['due_at'])
        self.assertTrue(self.client.get(self.request_url).data['can_request'])
        self.assertTrue(self.client.get(reverse('assessment_list')).data['assessments'][0]['can_request_retake'])
        self.assertEqual(self.request().status_code, 201)
        self.attempt.refresh_from_db()
        self.assertEqual(self.attempt.status, 'stopped')
        self.assertEqual(self.attempt.stopped_reason, 'attempt_expired')
        self.assertEqual(self.attempt.draft_answers, self.answers)
        self.assertEqual(self.attempt.answers.count(), 0)
        self.assertFalse(SkillScore.objects.exists())
        self.client.force_authenticate(self.owner)
        result = self.client.post(self.review_url, {**self.identity, 'request_id': self.attempt.retake_request_id,
            'decision': 'approved', 'note': 'Review complete; request another attempt.'}, format='json')
        self.assertEqual(result.status_code, 409)

    def test_image_upload_and_authorized_download_only(self):
        self.finalize()
        import json
        key = 'retakes/' + 'a' * 32 + '.webp'
        with patch('api.retake_evidence.upload', return_value=key) as upload:
            result = self.client.post(self.request_url, {'payload': json.dumps({**self.identity, 'request_id': str(uuid4()),
                'explanation': 'A system dialog interrupted my synthetic assessment attempt.'}), 'image': image_upload()}, format='multipart')
        self.assertEqual(result.status_code, 201)
        self.assertEqual(Image.open(BytesIO(upload.call_args.args[0])).format, 'WEBP')
        for user, status in [(self.stranger, 403), (self.other, 403), (self.student, 200), (self.owner, 200), (self.admin, 200)]:
            self.client.force_authenticate(user)
            with patch('api.retake_evidence.download', return_value=b'synthetic-webp'):
                result = self.client.get(self.evidence_url)
            self.assertEqual(result.status_code, status)
            if status == 200:
                self.assertEqual(result['Cache-Control'], 'private, no-store')

    def test_storage_failure_retains_attempt_and_leaves_request_unsaved(self):
        import json
        self.finalize()
        with patch('api.retake_evidence.upload', side_effect=retake_evidence.EvidenceUnavailable()):
            result = self.client.post(self.request_url, {'payload': json.dumps({**self.identity, 'request_id': str(uuid4()),
                'explanation': 'A synthetic alert interrupted this assessment attempt.'}), 'image': image_upload()}, format='multipart')
        self.assertEqual(result.status_code, 503)
        self.attempt.refresh_from_db()
        self.assertEqual(self.attempt.retake_request_status, '')
        self.assertEqual(self.attempt.status, 'stopped')
        self.assertFalse(self.attempt.retake_allowed)

    def test_queue_filters_pagination_and_no_evidence_paths(self):
        self.finalize(); self.request()
        self.client.force_authenticate(self.owner)
        result = self.client.get(reverse('retake_request_queue'), {'search': 'Synthetic', 'page': 99})
        self.assertEqual(result.data['page'], 1)
        self.assertEqual(result.data['count'], 1)
        self.assertNotIn('image_key', result.data['results'][0]['request'])
        self.assertEqual(self.client.get(reverse('retake_request_queue'), {'search': 'absent'}).data['count'], 0)
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.get(reverse('retake_request_queue')).status_code, 403)


class EvidenceTests(SimpleTestCase):
    def test_conversion_is_webp_bounded_and_metadata_free(self):
        content = retake_evidence.convert_evidence(image_upload())
        image = Image.open(BytesIO(content))
        self.assertEqual(image.format, 'WEBP')
        self.assertLessEqual(max(image.size), 1600)
        self.assertLessEqual(len(content), 512 * 1024)
        self.assertFalse(image.getexif())
        self.assertNotIn('private-note', image.info)

    def test_invalid_and_oversized_images_rejected(self):
        for content in [b'<svg></svg>', b'not-an-image', b'x' * (5 * 1024 * 1024 + 1)]:
            with self.assertRaises(ValidationError):
                retake_evidence.convert_evidence(SimpleUploadedFile('test.png', content))

    @override_settings(SUPABASE_STORAGE_URL='https://synthetic.supabase.co', SUPABASE_STORAGE_SERVICE_KEY='synthetic', RETAKE_EVIDENCE_BUCKET='retake-evidence')
    def test_bucket_must_be_private_and_branding_bucket_never_used(self):
        with patch('api.retake_evidence.requests.request', return_value=Mock(status_code=200, json=lambda: {'public': True})):
            with self.assertRaises(retake_evidence.EvidenceUnavailable):
                retake_evidence.private_bucket()
        with override_settings(RETAKE_EVIDENCE_BUCKET='company-branding'):
            with self.assertRaises(retake_evidence.EvidenceUnavailable):
                retake_evidence.private_bucket()

    @override_settings(SUPABASE_STORAGE_URL='https://synthetic.supabase.co', SUPABASE_STORAGE_SERVICE_KEY='synthetic', RETAKE_EVIDENCE_BUCKET='retake-evidence')
    def test_private_authenticated_download_and_nonredirecting_requests(self):
        with patch('api.retake_evidence.requests.request', return_value=Mock(status_code=200, json=lambda: {'public': False}, content=b'webp')) as http:
            self.assertEqual(retake_evidence.download('retakes/' + 'a' * 32 + '.webp'), b'webp')
            self.assertIn('/object/authenticated/retake-evidence/', http.call_args.args[1])
            self.assertFalse(http.call_args.kwargs['allow_redirects'])
