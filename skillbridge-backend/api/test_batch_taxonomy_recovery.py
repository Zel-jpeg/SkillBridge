"""Validation/rollback for batches and safe taxonomy history boundaries."""
from unittest.mock import patch
from django.urls import reverse
from rest_framework.test import APITestCase
from .models import Batch, BatchEnrollment, SkillCategory, Question, Assessment, User, SkillScore


class BatchTaxonomyRecoveryTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email='recovery-admin@example.com', role='admin')
        self.owner = User.objects.create_user(email='recovery-owner@example.com', role='instructor')
        self.batch = Batch.objects.create(name='Original batch', instructor=self.owner)
        self.category = SkillCategory.objects.create(name='Original category', created_by=self.admin)
        self.client.force_authenticate(self.owner)

    def test_batch_names_are_typed_and_bounded_before_create(self):
        for name in [[], 42, None, '', 'x' * 101]:
            with self.subTest(name=name):
                self.assertEqual(self.client.post(reverse('instructor_batches'), {'name': name}, format='json').status_code, 400)
                self.assertEqual(Batch.objects.count(), 1)

    def test_archive_and_unarchive_rollback_if_recalculation_fails(self):
        for endpoint, old_status in [('instructor_batch_archive', 'active'), ('instructor_batch_unarchive', 'archived')]:
            self.batch.status = old_status
            self.batch.save(update_fields=['status'])
            with patch('api.views.recalculate_enrolled_students', side_effect=RuntimeError('synthetic downstream failure')):
                with self.assertRaises(RuntimeError):
                    self.client.post(reverse(endpoint, args=[self.batch.id]))
            self.batch.refresh_from_db()
            self.assertEqual(self.batch.status, old_status)

    def test_malformed_taxonomy_create_edit_cannot_partially_save(self):
        self.client.force_authenticate(self.admin)
        for data in [{'name': []}, {'name': 'x' * 101}, {'name': 'Updated', 'description': []},
                     {'name': 'Updated', 'tags': [{'bad': 'shape'}]}]:
            with self.subTest(data=data):
                self.assertEqual(self.client.post(reverse('admin_skills'), data, format='json').status_code, 400)
                self.assertEqual(self.client.put(reverse('admin_skill_detail', args=[self.category.id]), data, format='json').status_code, 400)
                self.category.refresh_from_db()
                self.assertEqual(self.category.name, 'Original category')
                self.assertEqual(SkillCategory.objects.count(), 1)

    def test_referenced_category_cannot_be_deleted_but_unused_category_can(self):
        assessment = Assessment.objects.create(title='History boundary', batch=self.batch, created_by=self.owner)
        question = Question.objects.create(assessment=assessment, skill_category=self.category, question_text='Preserved category')
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.delete(reverse('admin_skill_detail', args=[self.category.id])).status_code, 409)
        question.refresh_from_db()
        self.assertEqual(question.skill_category_id, self.category.id)
        question.delete()
        student = User.objects.create_user(email='taxonomy-history@example.com', role='student')
        score = SkillScore.objects.create(student=student, assessment=assessment, skill_category=self.category,
                                          raw_score=1, max_score=2, percentage=50)
        self.assertEqual(self.client.delete(reverse('admin_skill_detail', args=[self.category.id])).status_code, 409)
        self.assertTrue(SkillScore.objects.filter(pk=score.pk).exists())
        unused = SkillCategory.objects.create(name='Unused')
        self.assertEqual(self.client.delete(reverse('admin_skill_detail', args=[unused.id])).status_code, 204)

    def test_selected_batch_unenrollment_preserves_other_membership_and_scores(self):
        student = User.objects.create_user(email='unenroll-history@example.com', role='student')
        other_batch = Batch.objects.create(name='Other owned batch', instructor=self.owner)
        for batch in [self.batch, other_batch]:
            BatchEnrollment.objects.create(batch=batch, student=student)
        assessment = Assessment.objects.create(title='Retained history', batch=self.batch, created_by=self.owner)
        score = SkillScore.objects.create(student=student, assessment=assessment, skill_category=self.category, raw_score=1, max_score=2, percentage=50)
        endpoint = reverse('instructor_student_remove', args=[student.id]) + f'?batch_id={self.batch.id}'
        self.assertEqual(self.client.delete(endpoint).status_code, 200)
        self.assertFalse(BatchEnrollment.objects.filter(batch=self.batch, student=student).exists())
        self.assertTrue(BatchEnrollment.objects.filter(batch=other_batch, student=student).exists())
        self.assertTrue(SkillScore.objects.filter(pk=score.pk).exists())
        self.assertEqual(self.client.delete(endpoint).status_code, 404)
