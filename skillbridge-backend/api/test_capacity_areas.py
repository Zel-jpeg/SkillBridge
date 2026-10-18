"""User-defined agency seats and deployed students by company area."""
from unittest.mock import patch
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase
from .combined_competency import recalculate_combined
from .models import (Assessment, Batch, BatchEnrollment, Company, OJTPlacement, Position,
                     PositionRequirement, Question, Recommendation, SkillCategory, SkillScore, StudentResponse, User)


class CapacityAreaTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email='area-admin@example.com', role='admin')
        self.instructor = User.objects.create_user(email='area-instructor@example.com', role='instructor')
        self.category = SkillCategory.objects.create(name='Programming')
        self.batch = Batch.objects.create(name='Synthetic area batch', instructor=self.instructor)
        self.assessment = Assessment.objects.create(title='Required', batch=self.batch, created_by=self.instructor)
        Question.objects.create(assessment=self.assessment, question_text='Synthetic', skill_category=self.category)
        self.positions = []
        for name in ['Synthetic Agency A', 'Synthetic Agency B']:
            company = Company.objects.create(name=name, address={'city': 'Davao City'})
            position = Position.objects.create(company=company, title='Intern', slots_available=5)
            PositionRequirement.objects.create(position=position, skill_category=self.category, required_percentage=70)
            self.positions.append(position)
        self.students = []
        for index in range(6):
            student = User.objects.create_user(email=f'area-student-{index}@example.com', role='student', address={'city': 'Tagum'})
            BatchEnrollment.objects.create(batch=self.batch, student=student)
            StudentResponse.objects.create(student=student, assessment=self.assessment, status='submitted', submitted_at=timezone.now())
            SkillScore.objects.create(student=student, assessment=self.assessment, skill_category=self.category, raw_score=1, max_score=1, percentage=100)
            with patch('api.recommendation_nlp.preprocess_texts', side_effect=lambda texts, model: (['synthetic shared evidence'] * len(texts), model, None)):
                recalculate_combined(student, self.batch)
            self.students.append(student)
        self.client.force_authenticate(self.admin)

    def approve(self, student, position):
        recommendation = Recommendation.objects.get(student=student, position=position, batch=self.batch, is_current=True)
        response = self.client.post(reverse('placement_approve'), {'recommendation_id': recommendation.id}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        return response.data['placement']['id']

    def suggestions(self):
        result = self.client.get(reverse('placement_suggestions'))
        self.assertEqual(result.status_code, 200)
        return {row['id']: row for company in result.data['companies'] for row in company['positions']}

    def test_one_assignment_leaves_four_of_five_seats_for_both_staff_roles(self):
        self.approve(self.students[0], self.positions[0])
        for role in [self.admin, self.instructor]:
            self.client.force_authenticate(role)
            position = self.suggestions()[self.positions[0].id]
            self.assertEqual((position['slots_available'], position['approved_count'], position['remaining_slots']), (5, 1, 4))
        report = self.client.get(reverse('placement_reports'), {'company_id': self.positions[0].company_id})
        self.assertEqual(report.data['records'][0]['position']['remaining_slots'], 4)

    def test_three_plus_three_company_assignments_mean_six_deployed_in_davao_not_residence(self):
        for index, student in enumerate(self.students):
            self.approve(student, self.positions[index // 3])
        analytics = self.client.get(reverse('placement_analytics')).data
        areas = {row['area']: row for row in analytics['area_breakdown']}
        self.assertEqual(areas['Davao City'], {'area': 'Davao City', 'student_count': 0, 'approved_placements': 6,
                                             'unplaced_students': 0, 'company_count': 2, 'total_slots': 10, 'available_slots': 4})
        self.assertEqual(areas['Tagum']['student_count'], 6)
        self.assertEqual(areas['Tagum']['approved_placements'], 0)
        self.assertEqual(areas['Tagum']['unplaced_students'], 0)
        self.assertEqual(analytics['top_areas']['by_placement_count'], [{'area': 'Davao City', 'count': 6}])
        for row in self.suggestions().values():
            self.assertEqual((row['slots_available'], row['approved_count'], row['remaining_slots']), (5, 3, 2))

    def test_nonapproved_history_does_not_consume_seats_and_students_are_denied_reports(self):
        approved = self.approve(self.students[0], self.positions[0])
        # Simulate removed history; only an approved state consumes a seat.
        OJTPlacement.objects.filter(pk=approved).update(status='removed')
        for status in ['suggested', 'rejected']:
            OJTPlacement.objects.create(student=self.students[1], position=self.positions[0], company=self.positions[0].company,
                                        batch=self.batch, status=status)
        self.assertEqual(self.suggestions()[self.positions[0].id]['remaining_slots'], 5)
        analytics = self.client.get(reverse('placement_analytics')).data['summary']
        self.assertEqual(analytics['approved_placements'], 0)
        self.assertEqual(analytics['remaining_slots'], 10)
        self.client.force_authenticate(self.students[0])
        self.assertEqual(self.client.get(reverse('placement_analytics')).status_code, 403)
        self.assertEqual(self.client.get(reverse('placement_reports')).status_code, 403)
