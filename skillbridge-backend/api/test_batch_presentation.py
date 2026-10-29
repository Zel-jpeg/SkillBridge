from types import SimpleNamespace
from unittest.mock import Mock

from django.test import SimpleTestCase

from .management_access import batch_payload


class BatchPresentationTests(SimpleTestCase):
    def batch(self, photo_url):
        return SimpleNamespace(
            id=7, name='Synthetic batch', status='active', created_at=None,
            archived_at=None, instructor_id=2,
            instructor=SimpleNamespace(name='Synthetic Instructor', photo_url=photo_url),
            created_by_id=1, enrollments=Mock(), closeout_snapshots=[],
        )

    def test_current_responsible_instructor_photo_is_included_without_extra_count(self):
        batch = self.batch('https://example.invalid/instructor-photo.png')
        payload = batch_payload(batch, student_count=12)
        self.assertEqual(payload['instructor_photo_url'], batch.instructor.photo_url)
        self.assertEqual(payload['instructor_id'], 2)
        self.assertEqual(payload['student_count'], 12)
        batch.enrollments.count.assert_not_called()

    def test_empty_photo_stays_empty_for_client_initials_fallback(self):
        self.assertEqual(batch_payload(self.batch(''), student_count=0)['instructor_photo_url'], '')
