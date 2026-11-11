from datetime import datetime, timedelta, timezone as datetime_timezone
from zoneinfo import ZoneInfo
from unittest.mock import patch

from django.db import connection
from django.test import override_settings
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

    @override_settings(SUPABASE_STORAGE_URL='https://images.example.invalid', COMPANY_IMAGE_BUCKET='logos', COMPANY_IMAGE_PREFIX='companies')
    def test_record_logo_urls_follow_top_approved_and_suggested_partners(self):
        self.company.image_key = 'companies/' + 'a' * 32 + '.webp'
        self.company.save(update_fields=['image_key'])
        self.ready()
        expected = 'https://images.example.invalid/storage/v1/object/public/logos/' + self.company.image_key
        for user in (self.owner, self.admin):
            self.client.force_authenticate(user)
            row = next(row for row in self.get()['students'] if row['id'] == self.student.id)
            self.assertEqual(row['top_company_image_url'], expected)
            self.assertIsNone(row['company_image_url'])
        self.client.force_authenticate(self.owner)
        rec = Recommendation.objects.get(student=self.student, position=self.position)
        placement = OJTPlacement.objects.create(student=self.student, batch=self.batch,
            company=self.company, position=self.position, recommendation=rec,
            status='suggested', is_active_suggestion=True)
        suggested = self.get()['suggested_students'][0]
        self.assertEqual(suggested['company_image_url'], expected)
        placement.status = 'approved'
        placement.is_active_suggestion = False
        placement.save(update_fields=['status', 'is_active_suggestion'])
        row = self.get()['students'][0]
        self.assertEqual(row['company_image_url'], expected)

    def test_record_without_current_recommendation_has_no_top_logo(self):
        row = self.get()['students'][0]
        self.assertIsNone(row['top_company_image_url'])
        self.assertIsNone(row['company_image_url'])

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
        # Ranking staleness cannot remove valid numerical assessment evidence.
        self.assertEqual(locked['skills'][0]['average'], 0)
        self.assertTrue(locked['students'][0]['recommendations_locked'])
        self.assertFalse(locked['students'][0]['competency_locked'])
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
        # A legacy overlapping membership still reserves its active-batch decision.
        BatchEnrollment.objects.create(student=self.student, batch=self.foreign)
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

    def test_activity_defaults_to_current_manila_month_and_supports_presets(self):
        now = datetime(2026, 10, 26, 2, tzinfo=datetime_timezone.utc)
        with patch('api.analytics.timezone.now', return_value=now):
            self.ready()
            result = self.get()
            self.assertEqual(result['scope']['activity_period'], 'monthly')
            self.assertEqual(result['scope']['date_from'], '2026-10-01')
            self.assertEqual(result['scope']['date_to'], '2026-10-26')
            for period, start in [('daily', '2026-10-26'), ('weekly', '2026-10-26'), ('yearly', '2026-01-01')]:
                data = self.get(activity_period=period)
                self.assertEqual(data['scope']['date_from'], start)
                self.assertEqual(sum(row['submissions'] for row in data['activity']), 1)
                self.assertEqual(data['summary'], result['summary'])

    def test_all_time_includes_old_retakes_without_foreign_flagged_or_duplicate_events(self):
        response = self.ready()
        old = timezone.now() - timedelta(days=800)
        for number, submitted, flagged in [(1, old, False), (2, response.submitted_at, False),
                                          (3, old - timedelta(days=400), True)]:
            AssessmentAttemptHistory.objects.create(response=response, attempt_number=number,
                status='submitted', submitted_at=submitted, is_flagged=flagged, category_scores=[], answers=[])
        StudentResponse.objects.create(student=self.foreign_student, assessment=self.foreign_assessment,
            status='submitted', submitted_at=old - timedelta(days=800))
        data = self.get(activity_period='all_time')
        self.assertEqual(data['scope']['date_from'], old.astimezone(ZoneInfo('Asia/Manila')).date().isoformat())
        self.assertEqual(data['scope']['activity_interval'], 'month')
        self.assertLess(len(data['activity']), 30)
        self.assertEqual(sum(row['submissions'] for row in data['activity']), 2)
        self.assertEqual(sum(row['submissions'] for row in data['activity_days']), 2)
        monthly = self.get()
        self.assertEqual(monthly['activity_days'], data['activity_days'])
        self.assertEqual(sum(row['submissions'] for row in monthly['activity']), 1)

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

    def test_overview_matches_full_report_for_each_role_without_loading_report_history(self):
        from .models import Institute
        self.batch.institute = Institute.objects.create(code='SCOPE', name='Synthetic Shared Institute')
        self.batch.save(update_fields=['institute'])
        self.ready(83)
        for user in (self.owner, self.admin):
            self.client.force_authenticate(user)
            report = self.get()
            with CaptureQueriesContext(connection) as queries:
                overview = self.get(view='overview')
            for field in ('summary', 'dashboard_attention', 'email_notifications', 'email_progress'):
                self.assertEqual(overview[field], report[field])
            self.assertEqual(overview['scope']['batch_ids'], report['scope']['batch_ids'])
            self.assertEqual(overview['scope']['shared_batch_ids'], report['scope']['shared_batch_ids'])
            self.assertIn(self.batch.id, overview['scope']['shared_batch_ids'])
            self.assertEqual(overview['options']['batches'], report['options']['batches'])
            self.assertEqual(overview['students'], [{key: row[key] for key in (
                'id', 'name', 'batch_id', 'batch', 'required_completed', 'required_total',
                'required_complete', 'awaiting_review', 'reasons', 'placement_status',
            )} for row in report['students']])
            self.assertFalse({'activity', 'placement_students', 'capacity'} & overview.keys())
            self.assertFalse(any('api_assessmentattempthistory' in query['sql'] or 'api_combinedcategoryscore' in query['sql']
                                 for query in queries))
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.get(self.url, {'view': 'overview'}).status_code, 403)

    def test_analytics_batches_selected_cohort_evidence_and_keeps_query_count_bounded(self):
        self.ready()
        self.client.force_authenticate(self.admin)
        with CaptureQueriesContext(connection) as before:
            self.get()
        for index in range(8):
            batch = Batch.objects.create(name=f'Batch {index}', instructor=self.owner)
            assessment = Assessment.objects.create(batch=batch, created_by=self.owner, title=f'Exam {index}',
                publication_status='published', is_required=True, include_in_competency=True)
            student = User.objects.create_user(f'cohort-{index}@example.invalid', role='student')
            BatchEnrollment.objects.create(batch=batch, student=student)
            StudentResponse.objects.create(student=student, assessment=assessment, started_at=timezone.now(),
                submitted_at=timezone.now(), status='submitted')
        # The other active membership is newer and cannot borrow the original
        # batch's saved result, score or current recommendation.
        BatchEnrollment.objects.create(batch=batch, student=self.student, profile_review_required=True)
        with CaptureQueriesContext(connection) as after:
            result = self.get()
        self.assertLessEqual(len(after), len(before) + 1)
        row = next(row for row in result['students'] if row['id'] == self.student.id)
        self.assertEqual(row['batch_id'], batch.id)
        self.assertFalse(row['required_complete'])
        self.assertTrue(row['recommendations_locked'])
        self.assertFalse(row['scores'])
        original = self.get(batch_id=self.batch.id)
        self.assertEqual(original['students'][0]['scores'], {str(self.category.id): 0.0})

    def test_map_weights_respect_owned_cohort_and_partner_filter(self):
        self.company.address = {'province': 'Davao del Norte', 'city': 'Panabo'}
        self.company.location_lat, self.company.location_lng = 7.3, 125.6
        self.company.save()
        for student, batch in [(self.student, self.batch), (self.foreign_student, self.foreign)]:
            OJTPlacement.objects.create(student=student, batch=batch, company=self.company, position=self.position, status='approved')
        result = self.get()
        self.assertEqual(result['placement_map']['approved_students'], 1)
        self.assertEqual(result['placement_map']['points'][0]['count'], 1)
        self.assertEqual(result['placement_students'][0]['partner_city_id'], '1102315000')
        self.client.force_authenticate(self.admin)
        result = self.get()
        self.assertEqual(result['placement_map']['approved_students'], 2)
        self.assertEqual(result['placement_map']['points'][0]['count'], 2)

    def test_matching_batch_scope_still_excludes_foreign_batches(self):
        from .models import Batch
        second = Batch.objects.create(name='Second owned', instructor=self.owner)
        another = User.objects.create_user('second-geo@example.invalid', role='student', name='Second')
        BatchEnrollment.objects.create(batch=second, student=another)
        result = self.get(batch_scope='matching')
        self.assertEqual(result['summary']['students'], 2)
        self.assertNotIn(self.foreign.id, result['scope']['batch_ids'])

    def test_admin_catalog_scope_includes_configured_partners_without_batches(self):
        from .models import Institute, Program
        institute = Institute.objects.create(code='CAT', name='Catalog institute')
        program = Program.objects.create(institute=institute, code='CAT', name='Catalog program')
        foreign_institute = Institute.objects.create(code='OTHER', name='Other institute')
        foreign_program = Program.objects.create(institute=foreign_institute, code='OTHER', name='Other program')
        company = Company.objects.create(name='Configured new-program partner', management_program=program,
            address={'province': 'Davao del Norte', 'city': 'Panabo'})
        position = Position.objects.create(company=company, title='New-program opening', management_program=program,
            eligibility_configured_at=timezone.now(), slots_available=2)
        position.eligible_programs.add(program)
        Company.objects.create(name='Empty new-program partner', management_program=program,
            address={'province': 'Cebu', 'city': 'Cebu City'})
        foreign_company = Company.objects.create(name='Foreign configured partner', management_program=foreign_program,
            address={'city': 'Davao City'})
        foreign_position = Position.objects.create(company=foreign_company, title='Foreign configured opening',
            eligibility_configured_at=timezone.now(), slots_available=2)
        foreign_position.eligible_programs.add(foreign_program)
        self.client.force_authenticate(self.admin)
        for filters in ({'program_id': program.id}, {'institute_id': institute.id}):
            with self.subTest(filters=filters):
                result = self.get(**filters)
                self.assertEqual(result['summary']['students'], 0)
                self.assertEqual([row['id'] for row in result['capacity']], [position.id])
                for key in ('placement_map', 'suggested_placement_map'):
                    self.assertEqual({row['id'] for row in result[key]['areas']['city']},
                                     {'1102315000', '0730600000'})
                self.assertNotIn(foreign_company.name, str(result['capacity']))
        restricted = self.get(program_id=program.id, instructor_id=self.owner.id)
        self.assertEqual(restricted['capacity'], [])
        self.assertEqual(restricted['placement_map']['areas']['city'], [])

    def test_admin_catalog_scope_keeps_shared_institute_and_explicit_batch_boundaries(self):
        from .models import Institute, Program
        institute = Institute.objects.create(code='SHARED', name='Shared institute')
        program = Program.objects.create(institute=institute, code='SCOPED', name='Scoped program')
        self.batch.institute = institute
        self.batch.save(update_fields=['institute'])
        company = Company.objects.create(name='Program-only partner', management_program=program)
        position = Position.objects.create(company=company, title='Program-only opening',
            eligibility_configured_at=timezone.now(), slots_available=2)
        position.eligible_programs.add(program)
        self.client.force_authenticate(self.admin)
        result = self.get(program_id=program.id)
        self.assertEqual({row['id'] for row in result['capacity']}, {self.position.id, position.id})
        restricted = self.get(program_id=program.id, batch_id=self.batch.id)
        self.assertEqual([row['id'] for row in restricted['capacity']], [self.position.id])

    def test_approved_partner_areas_respect_company_position_and_area_filters(self):
        self.company.address = {'province': 'Davao del Norte', 'city': 'Panabo'}
        self.company.save()
        second_company = Company.objects.create(name='Other approved partner',
            address={'province': 'Cebu', 'city': 'Cebu City'})
        second_position = Position.objects.create(company=second_company, title='Other opening', slots_available=2)
        second_student = User.objects.create_user('filtered-map-student@example.invalid',
            name='Second approved student', role='student', is_approved=True)
        BatchEnrollment.objects.create(batch=self.batch, student=second_student)
        for student, company, position in [(self.student, self.company, self.position),
                                          (second_student, second_company, second_position)]:
            OJTPlacement.objects.create(student=student, batch=self.batch, company=company,
                position=position, status='approved')
        self.assertEqual({row['id'] for row in self.get()['placement_map']['areas']['city']},
                         {'1102315000', '0730600000'})
        for filters in ({'company_id': self.company.pk}, {'position_id': self.position.pk}, {'area': 'Panabo'}):
            with self.subTest(filters=filters):
                result = self.get(**filters)
                self.assertEqual(result['placement_map']['student_count'], 1)
                areas = result['placement_map']['areas']['city']
                self.assertEqual([(row['id'], row['count'], row['partner_count']) for row in areas],
                                 [('1102315000', 1, 1)])

    def test_suggested_geography_uses_saved_active_current_allocation(self):
        from .models import ManagementAction
        self.company.address = {'province': 'Cebu', 'city': 'Cebu City'}
        self.company.location_lat, self.company.location_lng = 10.32, 123.9
        self.company.save()
        self.ready()
        rec = Recommendation.objects.get(student=self.student, position=self.position)
        OJTPlacement.objects.create(student=self.student, batch=self.batch, company=self.company,
            position=self.position, recommendation=rec, status='suggested', is_active_suggestion=True)
        before = ManagementAction.objects.count()
        result = self.get()
        self.assertEqual(result['suggested_placement_map']['student_count'], 1)
        self.assertEqual(result['suggested_placement_map']['points'][0]['count'], 1)
        self.assertEqual(result['suggested_students'][0]['company'], self.company.name)
        self.assertEqual(result['suggested_students'][0]['partner_city_id'], '0730600000')
        self.assertEqual(result['summary']['approved'], 0)
        self.assertEqual(result['summary']['unplaced'], 1)
        self.assertEqual(ManagementAction.objects.count(), before)
        rec.is_current = False
        rec.save(update_fields=['is_current'])
        self.assertEqual(self.get()['suggested_placement_map']['student_count'], 0)

    def test_approved_student_and_inactive_suggestions_do_not_enter_suggested_map(self):
        self.ready()
        rec = Recommendation.objects.get(student=self.student, position=self.position)
        pending = OJTPlacement.objects.create(student=self.student, batch=self.batch,
            company=self.company, position=self.position, recommendation=rec, status='suggested')
        self.assertEqual(self.get()['suggested_placement_map']['student_count'], 0)
        pending.is_active_suggestion = True
        pending.save(update_fields=['is_active_suggestion'])
        OJTPlacement.objects.create(student=self.student, batch=self.batch, company=self.company,
            position=self.position, status='approved')
        result = self.get()
        self.assertEqual(result['placement_map']['student_count'], 1)
        self.assertEqual(result['suggested_placement_map']['student_count'], 0)

    def test_partner_area_list_omits_places_without_partners_but_keeps_zero_counts(self):
        self.company.address = {'province': 'Cebu', 'city': 'Cebu City'}
        self.company.save()
        result = self.get()
        areas = result['placement_map']['areas']['city']
        self.assertEqual(len(areas), 1)
        self.assertEqual(areas[0]['id'], '0730600000')
        self.assertEqual(areas[0]['partner_count'], 1)
        self.assertEqual(areas[0]['count'], 0)

    def test_suggested_map_preserves_instructor_ownership(self):
        self.ready()
        rec = Recommendation.objects.get(student=self.student, position=self.position)
        OJTPlacement.objects.create(student=self.student, batch=self.batch, company=self.company,
            position=self.position, recommendation=rec, status='suggested', is_active_suggestion=True)
        foreign_rec = Recommendation.objects.create(student=self.foreign_student, batch=self.foreign,
            position=self.position, match_score=70)
        OJTPlacement.objects.create(student=self.foreign_student, batch=self.foreign, company=self.company,
            position=self.position, recommendation=foreign_rec, status='suggested', is_active_suggestion=True)
        result = self.get()
        self.assertEqual(result['suggested_placement_map']['student_count'], 1)
        self.assertEqual([row['id'] for row in result['suggested_students']], [self.student.id])
        self.assertNotIn(self.foreign_student.name, str(result['suggested_students']))

    def test_partner_location_appears_before_openings_or_placements_exist(self):
        Company.objects.create(name='New partner without openings', address={'province': 'Cebu', 'city': 'Cebu City'})
        result = self.get()
        city = next(row for row in result['placement_map']['areas']['city'] if row['id'] == '0730600000')
        self.assertEqual(city['partner_count'], 1)
        self.assertEqual(city['count'], 0)
