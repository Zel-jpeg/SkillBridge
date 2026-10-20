from datetime import timedelta
from unittest.mock import patch

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import (Assessment, AssessmentAttemptHistory, Batch, BatchEnrollment, CombinedCategoryScore,
    CombinedCompetencyProfile, Company, OJTPlacement, Position, Recommendation, SkillCategory,
    SkillScore, StudentResponse, User)
from .recommendation_freshness import input_fingerprint


class AnalyticsTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user('analytics-admin@example.invalid', name='Admin', role='admin')
        self.owner = User.objects.create_user('analytics-owner@example.invalid', name='Owner', role='instructor', is_approved=True)
        self.other = User.objects.create_user('analytics-other@example.invalid', name='Foreign owner', role='instructor', is_approved=True)
        self.batch = Batch.objects.create(name='Owned cohort', instructor=self.owner)
        self.foreign = Batch.objects.create(name='Foreign cohort', instructor=self.other)
        self.student = User.objects.create_user('analytics-student@example.invalid', name='Synthetic student', role='student', course='BSIT', is_approved=True)
        self.foreign_student = User.objects.create_user('analytics-foreign@example.invalid', name='Private foreign student', role='student', is_approved=True)
        BatchEnrollment.objects.create(batch=self.batch, student=self.student)
        BatchEnrollment.objects.create(batch=self.foreign, student=self.foreign_student)
        self.assessment = Assessment.objects.create(title='Owned assessment', batch=self.batch, created_by=self.owner, publication_status='published')
        self.foreign_assessment = Assessment.objects.create(title='Private foreign assessment', batch=self.foreign, created_by=self.other)
        self.category = SkillCategory.objects.create(name='Synthetic skill')
        self.company = Company.objects.create(name='Shared agency', address={'city': 'Company City'})
        self.position = Position.objects.create(company=self.company, title='Shared internship', slots_available=5)
        self.url = reverse('management_analytics')
        self.client.force_authenticate(self.owner)

    def get(self, **params):
        response = self.client.get(self.url, params)
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def ready(self, score=0):
        response = StudentResponse.objects.create(student=self.student, assessment=self.assessment,
            status='submitted', submitted_at=timezone.now(), started_at=timezone.now())
        SkillScore.objects.create(student=self.student, assessment=self.assessment, skill_category=self.category,
            raw_score=score, max_score=100, percentage=score)
        CombinedCategoryScore.objects.create(student=self.student, batch=self.batch, skill_category=self.category,
            raw_score=score, max_score=100, percentage=score, source_assessment_ids=[self.assessment.id])
        CombinedCompetencyProfile.objects.create(student=self.student, batch=self.batch, is_finalized=True,
            included_assessment_ids=[self.assessment.id], ranking_input_fingerprint=input_fingerprint(self.student), finalized_at=timezone.now())
        Recommendation.objects.create(student=self.student, batch=self.batch, position=self.position, match_score=0)
        return response

    def test_instructor_scope_and_direct_parameter_denials(self):
        result = self.get()
        self.assertEqual(result['summary']['students'], 1)
        self.assertNotIn('Private foreign', str(result))
        self.assertNotIn('Foreign owner', str(result))
        self.assertEqual(result['options']['instructors'], [])
        for params, status in [({'batch_id': self.foreign.id}, 404), ({'assessment_id': self.foreign_assessment.id}, 404),
                               ({'instructor_id': self.other.id}, 403)]:
            self.assertEqual(self.client.get(self.url, params).status_code, status)
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.get(self.url).status_code, 403)
        self.owner.is_approved = False
        self.owner.save()
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.get(self.url).status_code, 403)

    def test_admin_current_cohort_deduplicates_memberships_and_explicit_batch_is_selectable(self):
        BatchEnrollment.objects.create(batch=self.foreign, student=self.student)
        self.client.force_authenticate(self.admin)
        result = self.get()
        self.assertEqual(result['summary']['students'], 2)
        record = next(row for row in result['students'] if row['id'] == self.student.id)
        self.assertEqual(record['batch_id'], self.foreign.id)
        self.assertEqual(sum(row['total'] for row in result['batches']), 2)
        selected = self.get(batch_id=self.batch.id)
        self.assertEqual(selected['summary']['students'], 1)
        self.assertEqual(selected['students'][0]['batch_id'], self.batch.id)

    def test_complete_and_unlocked_are_distinct_and_reads_never_recalculate(self):
        self.ready()
        with patch('api.combined_competency.recalculate_combined', side_effect=AssertionError('Analytics must not recalculate')):
            result = self.get()
        self.assertEqual(result['summary']['required_complete'], 1)
        self.assertEqual(result['summary']['awaiting_review'], 1)
        self.assertEqual(result['skills'][0]['needs_work'], 1)
        self.assertEqual(result['skills'][0]['average'], 0)
        self.assertEqual(sum(row['count'] for row in result['match_bands']), 1)
        self.assertEqual(result['students'][0]['top_match'], 0)
        profile = CombinedCompetencyProfile.objects.get(student=self.student, batch=self.batch)
        profile.ranking_input_fingerprint = 'stale'
        profile.save()
        locked = self.get()
        self.assertEqual(locked['summary']['required_complete'], 1)
        self.assertEqual(locked['summary']['awaiting_review'], 0)
        self.assertEqual(locked['skills'], [])
        self.assertIn('Final results unavailable', locked['students'][0]['reasons'])

    def test_followup_counts_distinct_students_overdue_requires_real_deadline(self):
        self.assessment.due_at = timezone.now() - timedelta(days=1)
        self.assessment.save()
        StudentResponse.objects.create(student=self.student, assessment=self.assessment, status='stopped', is_flagged=True)
        another = Assessment.objects.create(title='Second flagged', batch=self.batch, created_by=self.owner, publication_status='published')
        StudentResponse.objects.create(student=self.student, assessment=another, status='stopped')
        result = self.get()
        self.assertEqual(result['summary']['needs_followup'], 1)
        self.assertEqual(result['students'][0]['reasons'], ['Overdue required work', 'Stopped / flagged'])
        self.assertEqual(sum(row['stopped'] for row in result['assessments']), 2)
        for row in result['assessments']:
            self.assertEqual(row['assigned'], row['submitted'] + row['in_progress'] + row['not_started'] + row['stopped'])

    def test_capacity_is_global_and_other_batch_approval_prevents_second_candidate(self):
        self.ready()
        OJTPlacement.objects.create(student=self.foreign_student, batch=self.foreign, company=self.company, position=self.position, status='approved')
        result = self.get()
        self.assertEqual(result['summary']['slots_remaining'], 4)
        self.assertNotIn('Private foreign student', str(result))
        OJTPlacement.objects.create(student=self.student, batch=self.foreign, company=self.company, position=self.position, status='approved')
        result = self.get()
        self.assertEqual(result['summary']['approved'], 0)
        self.assertEqual(result['summary']['approved_other_batch'], 1)
        self.assertEqual(result['summary']['unplaced'], 0)
        self.assertEqual(result['summary']['awaiting_review'], 0)
        self.assertEqual(result['summary']['slots_remaining'], 3)

    def test_removed_placements_do_not_consume_capacity_or_count_as_approved(self):
        OJTPlacement.objects.create(student=self.student, batch=self.batch, company=self.company, position=self.position, status='removed')
        result = self.get()
        self.assertEqual(result['summary']['approved'], 0)
        self.assertEqual(result['summary']['unplaced'], 1)
        self.assertEqual(result['summary']['slots_remaining'], 5)
        self.assertEqual(next(row for row in result['geography'] if row['name'] == 'Company City')['remaining_slots'], 5)
        self.assertEqual(next(row for row in result['geography'] if row['name'] == 'Unknown Area')['unplaced_residents'], 1)

    def test_archive_and_no_required_work_are_not_completed_or_actionable(self):
        self.assessment.publication_status = 'draft'
        self.assessment.save()
        self.assertEqual(self.get()['summary']['required_complete'], 0)
        self.assertIn('No required assessments', self.get()['students'][0]['reasons'])
        self.batch.status = 'archived'
        self.batch.save()
        self.assertEqual(self.get()['summary']['students'], 0)
        historical = self.get(batch_status='archived', batch_id=self.batch.id)
        self.assertEqual(historical['summary']['students'], 1)
        self.assertEqual(historical['students'][0]['reasons'], [])
        self.assertTrue(historical['students'][0]['recommendations_locked'])
        self.student.is_active = False
        self.student.save()
        self.assertEqual(self.get(batch_status='archived', batch_id=self.batch.id)['summary']['students'], 1)

    def test_activity_uses_manila_date_deduplicates_current_history_and_keeps_real_retakes(self):
        response = self.ready()
        instant = timezone.now().replace(hour=18, minute=0, second=0, microsecond=0) - timedelta(days=3)
        response.submitted_at = instant
        response.save()
        for number, submitted_at in [(1, instant), (2, instant - timedelta(days=1))]:
            AssessmentAttemptHistory.objects.create(response=response, attempt_number=number, status='submitted',
                submitted_at=submitted_at, category_scores=[], answers=[])
        result = self.get(date_from=(instant.date() - timedelta(days=1)).isoformat(), date_to=(instant.date() + timedelta(days=1)).isoformat())
        self.assertEqual(sum(row['submissions'] for row in result['activity']), 2)
        day_after_utc = (instant.date() + timedelta(days=1)).isoformat()
        self.assertEqual(next(row['submissions'] for row in result['activity'] if row['date'] == day_after_utc), 1)
        self.assertEqual(result['summary']['students'], 1)

    def test_filters_validate_and_company_filters_do_not_change_student_denominator(self):
        self.ready()
        result = self.get(company_id=self.company.id)
        self.assertEqual(result['summary']['students'], 1)
        self.assertEqual(result['placement_students'], [])
        self.assertEqual(self.get(course='BSIS')['summary']['students'], 0)
        for params in [{'batch_id': 'oops'}, {'batch_status': 'unknown'}, {'date_from': '2026-99-99'},
                       {'date_from': '2020-01-01', 'date_to': '2026-01-01'}, {'export': 'keys'}]:
            self.assertEqual(self.client.get(self.url, params).status_code, 400, params)
        self.assertEqual(self.client.get(self.url + '?batch_id=1&batch_id=2').status_code, 400)
        self.assertEqual(self.get(_t='1792485785252')['summary']['students'], 1)

    def test_query_count_does_not_grow_per_student_and_no_answer_data_leaks(self):
        self.ready()
        with CaptureQueriesContext(connection) as first:
            self.get()
        for index in range(15):
            student = User.objects.create_user(f'scale-{index}@example.invalid', role='student')
            BatchEnrollment.objects.create(batch=self.batch, student=student)
        with CaptureQueriesContext(connection) as second:
            result = self.get()
        self.assertLessEqual(len(second), len(first) + 1)
        self.assertNotIn('answers', str(result))
        self.assertNotIn('ranking_input_fingerprint', str(result))
