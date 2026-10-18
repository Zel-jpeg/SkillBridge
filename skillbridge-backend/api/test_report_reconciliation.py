"""Known synthetic report controls, cross-batch permissions and historical scores."""
from datetime import datetime, timezone as dt_timezone
import csv
import io
from django.urls import reverse
from rest_framework.test import APITestCase
from .models import Batch, BatchEnrollment, Company, OJTPlacement, Position, User


class ReportReconciliationTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user('report-admin@example.invalid', role='admin', name='Synthetic Admin')
        self.owner = User.objects.create_user('report-owner@example.invalid', role='instructor')
        self.other = User.objects.create_user('report-other@example.invalid', role='instructor')
        self.batch = Batch.objects.create(name='Synthetic Own Batch', instructor=self.owner)
        self.foreign = Batch.objects.create(name='Synthetic Foreign Batch', instructor=self.other)
        self.students = [User.objects.create_user(f'report-student{i}@example.invalid', name=f'Synthetic Student {i}', role='student', course='BSIT', address={'city': 'Resident Area'}) for i in range(4)]
        for student in self.students:
            BatchEnrollment.objects.create(batch=self.batch, student=student)
        BatchEnrollment.objects.create(batch=self.foreign, student=self.students[0])
        BatchEnrollment.objects.create(batch=self.foreign, student=self.students[1])
        self.a = Company.objects.create(name='Synthetic Agency A', address={'city': 'Davao City'})
        self.b = Company.objects.create(name='Synthetic Agency B', address={'city': 'Tagum'})
        self.full = Position.objects.create(company=self.a, title='Full position', slots_available=2)
        self.vacant = Position.objects.create(company=self.b, title='Vacant position', slots_available=3)
        self.empty = Position.objects.create(company=self.a, title='No placement records', slots_available=4)
        self.rows = []
        for student, batch, position, status in [
            (self.students[0], self.batch, self.full, 'approved'),
            (self.students[1], self.foreign, self.full, 'approved'),
            (self.students[0], self.foreign, self.full, 'rejected'),
            (self.students[0], self.batch, self.vacant, 'removed'),
            (self.students[2], self.batch, self.vacant, 'rejected'),
            (self.students[2], self.batch, self.vacant, 'suggested'),
        ]:
            row = OJTPlacement.objects.create(student=student, batch=batch, company=position.company,
                position=position, status=status, assigned_by=self.admin, remarks='Synthetic record',
                match_score_at_assignment=72.345, category_score_component_at_assignment=80,
                nlp_score_component_at_assignment=60, location_score_component_at_assignment=50,
                distance_km_at_assignment=0, approved_at=datetime(2026, 10, 17, 16, 30, tzinfo=dt_timezone.utc) if status == 'approved' else None)
            self.rows.append(row)
        self.client.force_authenticate(self.admin)

    def report(self, **filters):
        response = self.client.get(reverse('placement_reports'), filters)
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def test_known_controls_and_capacity_are_not_duplicated_by_history(self):
        report = self.report(report_type='placement_history')
        self.assertEqual(report['summary'], {'total_records': 6, 'unique_students': 3,
            'unique_companies': 2, 'unique_positions': 2,
            'status_counts': {'suggested': 1, 'approved': 2, 'removed': 1, 'rejected': 2},
            'slots_available': 5, 'approved_count': 2, 'remaining_slots': 3})
        for row in report['records']:
            self.assertEqual(row['match_score_at_assignment'], 72.345)
            self.assertEqual(row['distance_km_at_assignment'], 0)
            expected = (2, 2, 0) if row['position']['id'] == self.full.id else (3, 0, 3)
            self.assertEqual(tuple(row['position'][field] for field in ['slots_available', 'approved_count', 'remaining_slots']), expected)
        analytics = self.client.get(reverse('placement_analytics')).data
        self.assertEqual(analytics['summary']['total_ojt_slots'], 9)
        self.assertEqual(analytics['summary']['approved_placements'], 2)
        self.assertEqual(analytics['summary']['remaining_slots'], 7)
        areas = {row['area']: row for row in analytics['area_breakdown']}
        self.assertEqual(areas['Davao City']['approved_placements'], 2)
        self.assertEqual(areas['Davao City']['total_slots'], 6)
        self.assertEqual(areas['Davao City']['available_slots'], 4)
        self.assertEqual(areas['Resident Area']['student_count'], 4)
        dashboard = self.client.get(reverse('admin_reports')).data
        self.assertEqual(dashboard['submission_stats'], {'total': 4, 'submitted': 0, 'pending': 4})
        totals = {row['batch']: row['total'] for row in dashboard['batch_completion']}
        self.assertEqual(totals, {self.batch.name: 4, self.foreign.name: 2})

    def test_instructor_reports_and_history_scope_by_record_batch_not_shared_student(self):
        self.client.force_authenticate(self.owner)
        for report_type in ['company_placements', 'student_placements', 'placement_history']:
            with self.subTest(report_type=report_type):
                report = self.report(report_type=report_type)
                self.assertEqual({row['batch']['id'] for row in report['records']}, {self.batch.id})
                self.assertEqual(report['summary']['total_records'], 4)
                self.assertEqual(self.report(report_type=report_type, batch_id=self.foreign.id)['records'], [])
        history = self.client.get(reverse('placement_history')).data
        self.assertEqual({row['batch']['id'] for row in history['placements']}, {self.batch.id})
        # Unenrollment preserves the instructor's historical records and their scope.
        BatchEnrollment.objects.filter(batch=self.batch, student=self.students[0]).delete()
        self.assertEqual(self.report()['summary']['total_records'], 4)

    def test_filters_dates_empty_records_and_snapshot_do_not_recompute(self):
        report = self.report(status='approved', batch_id=self.batch.id, company_id=self.a.id,
            position_id=self.full.id, course='BSIT', area='Davao', date_field='approved_at',
            date_from='2026-10-18', date_to='2026-10-18')
        self.assertEqual([row['id'] for row in report['records']], [self.rows[0].id])
        self.assertEqual(report['timezone'], 'Asia/Manila')
        self.assertEqual(report['summary']['approved_count'], 2)  # occupancy is global, despite batch filter
        self.assertEqual(self.report(status='approved', date_field='approved_at', date_from='2026-10-19')['records'], [])
        self.assertEqual(self.report(position_id=self.empty.id)['summary']['total_records'], 0)
        self.client.force_authenticate(self.students[0])
        for name in ['placement_reports', 'placement_history', 'placement_analytics']:
            self.assertEqual(self.client.get(reverse(name)).status_code, 403)

    def test_csv_real_filters_metadata_and_formula_prefixes(self):
        from .csv_safety import safe_csv_cell
        for text in ['=1+1', '+1+1', '-1+1', '@SUM(1)', '\tvalue', '\rvalue', '\nvalue', ' =1+1', ' \t@SUM(1)']:
            self.assertEqual(safe_csv_cell(text), "'" + text)
        self.assertEqual(safe_csv_cell(-12), -12)
        self.assertEqual(safe_csv_cell('Synthetic Student'), 'Synthetic Student')
        self.students[0].name = ' =SUM(1,2)'
        self.students[0].save(update_fields=['name'])
        self.client.force_authenticate(self.owner)
        response = self.client.get(reverse('management_assessment_reports'),
            {'type': 'batch_progress', 'batch_id': self.batch.id, 'student_id': self.students[0].id, 'export': 'csv'})
        self.assertEqual(response.status_code, 200)
        rows = list(csv.reader(io.StringIO(response.content.decode('utf-8-sig'))))
        self.assertEqual(rows[0][0:2], ['SkillBridge Assessment Report', 'batch_progress'])
        self.assertIn(f'Batch: {self.batch.id}', rows[1])
        self.assertIn(f'Student: {self.students[0].id}', rows[1])
        self.assertEqual(len(rows), 4)
        self.assertIn("' =SUM(1,2)", rows[3])
        self.assertNotIn(self.foreign.name, str(rows))
