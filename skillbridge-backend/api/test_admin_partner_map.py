from rest_framework.test import APITestCase
from .models import Batch, BatchEnrollment, Company, Institute, OJTPlacement, Position, Program, User


class AdminPartnerMapTests(APITestCase):
    def test_remaining_slots_count_all_current_approvals_once_across_programs(self):
        admin = User.objects.create_user(email='map-admin@example.invalid', role='admin')
        owner = User.objects.create_user(email='map-owner@example.invalid', role='instructor', is_approved=True)
        company = Company.objects.create(name='Synthetic shared map partner')
        position = Position.objects.create(company=company, title='Shared opening', slots_available=5)
        for number in range(3):
            institute = Institute.objects.create(code=f'MAP{number}', name=f'Synthetic institute {number}')
            program = Program.objects.create(institute=institute, code=f'P{number}', name=f'Program {number}')
            batch = Batch.objects.create(name=f'Map cohort {number}', instructor=owner, institute=institute,
                                         program=program, status='archived' if number == 2 else 'active')
            student = User.objects.create_user(email=f'map-{number}@example.invalid', role='student')
            BatchEnrollment.objects.create(batch=batch, student=student)
            position.eligible_programs.add(program)
            OJTPlacement.objects.create(student=student, batch=batch, company=company, position=position, status='approved')
        self.client.force_authenticate(admin)
        result = self.client.get('/api/admin/companies/')
        self.assertEqual(result.status_code, 200)
        row = result.data[0]['positions'][0]
        self.assertEqual(row['approved_count'], 2)
        self.assertEqual(row['remaining_slots'], 3)
        self.assertEqual(len(row['eligible_programs']), 3)
        self.client.force_authenticate(owner)
        self.assertEqual(self.client.get('/api/admin/companies/').status_code, 403)
