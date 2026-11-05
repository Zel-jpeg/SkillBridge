from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest import skipUnless

from django.db import close_old_connections, connection
from django.urls import reverse
from rest_framework.test import APIClient, APITestCase, APITransactionTestCase

from .models import (Batch, BatchEnrollment, Company, CompetencyFramework, Institute,
                     InstructorAssignment, OJTPlacement, Position, Program, Recommendation,
                     SkillCategory, User)
from .opportunity_scope import eligible_recommendations
from .placement_scope import current_approvals


class CatalogFixtures:
    def setUp(self):
        self.admin = User.objects.create_user('scope-admin@example.invalid', role='admin')
        self.instructor = User.objects.create_user('scope-instructor@example.invalid', role='instructor', is_approved=True)
        self.programs = [Program.objects.create(code=f'PR{index}', name=f'Program {index}',
            institute=Institute.objects.create(code=f'I{index}', name=f'Institute {index}')) for index in range(3)]
        self.company = Company.objects.create(name='Shared synthetic partner')
        self.client.force_authenticate(self.admin)

    def opening(self, **fields):
        return self.client.post(reverse('admin_company_positions', args=[self.company.pk]), {
            'title': 'Shared opening', 'slots': 1, **fields,
        }, format='json')

    def enroll(self, index):
        student = User.objects.create_user(f'scope-{index}@example.invalid', role='student', is_approved=True)
        program = self.programs[index] if index < len(self.programs) else None
        batch = Batch.objects.create(name=f'Batch {index}', instructor=self.instructor,
                                     program=program, institute=program.institute if program else None)
        BatchEnrollment.objects.create(student=student, batch=batch)
        return student, batch

    def assign(self, student, batch, position, client=None):
        return (client or self.client).post(reverse('placement_manual_assign'), {
            'student_id': student.pk, 'batch_id': batch.pk, 'position_id': position.pk,
        }, format='json')


class OpportunityScopeTests(CatalogFixtures, APITestCase):
    def test_empty_eligibility_closes_new_opening_and_legacy_opening_serves_legacy_batch(self):
        student, batch = self.enroll(3)
        legacy = Position.objects.create(company=self.company, title='Existing opening')
        response = self.opening(eligible_program_ids=[])
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data['eligibility_configured'])
        closed = Position.objects.get(pk=response.data['id'])
        self.assertEqual(self.assign(student, batch, closed).status_code, 409)
        self.client.force_authenticate(student)
        catalog = self.client.get(reverse('student_companies')).data
        self.assertEqual([row['id'] for row in catalog[0]['positions']], [legacy.pk])
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.assign(student, batch, legacy).status_code, 201)

    def test_requirements_reference_one_eligible_framework_by_id(self):
        categories = []
        for program in self.programs:
            framework = CompetencyFramework.objects.create(program=program, version=1, name='Reviewed rubric')
            categories.append(SkillCategory.objects.create(framework=framework, name='Same name'))
        eligible = [program.pk for program in self.programs[:2]]
        for ids in [[categories[2].pk], [categories[0].pk, categories[1].pk]]:
            result = self.opening(eligible_program_ids=eligible,
                                  category_requirements=[{'category_id': pk, 'percentage': 70} for pk in ids])
            self.assertEqual(result.status_code, 400, result.data)
        self.assertFalse(Position.objects.exists())
        result = self.opening(eligible_program_ids=eligible,
                              category_requirements=[{'category_id': categories[0].pk, 'percentage': 70}])
        self.assertEqual(result.status_code, 201, result.data)
        self.assertEqual(result.data['category_requirements'][0]['category_id'], categories[0].pk)
        categories[0].framework.refresh_from_db()
        self.assertIsNotNone(categories[0].framework.locked_at)
        position = Position.objects.get(pk=result.data['id'])
        rejected = self.client.patch(reverse('admin_position_detail', args=[position.pk]),
                                     {'eligible_program_ids': [eligible[1]]}, format='json')
        self.assertEqual(rejected.status_code, 400)
        self.assertEqual(set(position.eligible_programs.values_list('id', flat=True)), set(eligible))

    def test_program_removal_keeps_approval_and_shared_occupancy(self):
        student, batch = self.enroll(0)
        another, other_batch = self.enroll(1)
        result = self.opening(eligible_program_ids=[row.pk for row in self.programs[:2]])
        position = Position.objects.get(pk=result.data['id'])
        assigned = self.assign(student, batch, position)
        self.assertEqual(assigned.status_code, 201, assigned.data)
        before = list(OJTPlacement.objects.values())
        result = self.client.patch(reverse('admin_position_detail', args=[position.pk]),
                                   {'eligible_program_ids': [self.programs[1].pk]}, format='json')
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(list(OJTPlacement.objects.values()), before)
        self.assertEqual(current_approvals(position=position).count(), 1)
        self.assertEqual(self.assign(another, other_batch, position).status_code, 409)

    def test_foreign_program_cannot_browse_or_manually_assign(self):
        student, batch = self.enroll(2)
        InstructorAssignment.objects.create(instructor=self.instructor, program=self.programs[2])
        result = self.opening(eligible_program_ids=[self.programs[0].pk])
        position = Position.objects.get(pk=result.data['id'])
        visible = self.opening(eligible_program_ids=[self.programs[2].pk]).data['id']
        self.assertEqual(self.assign(student, batch, position).status_code, 409)
        self.client.force_authenticate(student)
        result = self.client.get(reverse('student_companies'))
        self.assertEqual([row['id'] for row in result.data[0]['positions']], [visible])
        self.client.force_authenticate(self.instructor)
        result = self.client.get(reverse('instructor_companies'))
        self.assertEqual([row['id'] for row in result.data[0]['positions']], [visible])
        self.assertEqual(self.client.get(reverse('position_nlp_text', args=[position.pk])).status_code, 404)
        self.assertEqual(self.client.get(reverse('position_nlp_text', args=[visible])).status_code, 200)
        self.assertEqual(self.client.patch(reverse('instructor_company_edit', args=[self.company.pk]),
                                          {'name': 'Unauthorized'}, format='json').status_code, 403)

    def test_scope_removal_retires_live_suggestion_without_rewriting_its_snapshot(self):
        student, batch = self.enroll(0)
        other_student, other_batch = self.enroll(1)
        framework = CompetencyFramework.objects.create(program=batch.program, version=1, name='Reviewed rubric')
        category = SkillCategory.objects.create(framework=framework, name='Reviewed skill')
        batch.framework = framework
        batch.save(update_fields=['framework'])
        opening = self.opening(eligible_program_ids=[batch.program_id, other_batch.program_id],
                               category_requirements=[{'category_id': category.pk, 'percentage': 70}])
        snapshot = {'evidence': {'retained': 88}}
        compatible = Recommendation.objects.create(student=student, batch=batch, position_id=opening.data['id'],
                                                    match_score=0.8, assessment_details=snapshot)
        Recommendation.objects.create(student=other_student, batch=other_batch, position_id=opening.data['id'])
        self.assertEqual(list(eligible_recommendations(Recommendation.objects.all())), [compatible])

        result = self.client.patch(reverse('admin_position_detail', args=[opening.data['id']]),
                                   {'eligible_program_ids': [other_batch.program_id], 'category_requirements': []},
                                   format='json')
        self.assertEqual(result.status_code, 200, result.data)
        self.assertFalse(Recommendation.objects.filter(is_current=True).exists())
        compatible.refresh_from_db()
        self.assertEqual(compatible.assessment_details, snapshot)
        self.assertEqual(compatible.match_score, 0.8)


@skipUnless(connection.vendor == 'postgresql', 'Requires PostgreSQL row locks')
class SharedSlotRaceTests(CatalogFixtures, APITransactionTestCase):
    def test_two_programs_compete_for_one_slot(self):
        entries = [self.enroll(index) for index in range(2)]
        result = self.opening(eligible_program_ids=[program.pk for program in self.programs[:2]])
        self.assertEqual(result.status_code, 201, result.data)
        position = Position.objects.get(pk=result.data['id'])
        barrier = Barrier(2)

        def submit(entry):
            close_old_connections()
            try:
                client = APIClient()
                client.force_authenticate(self.admin)
                barrier.wait(timeout=10)
                return self.assign(*entry, position, client=client).status_code
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as workers:
            self.assertEqual(sorted(workers.map(submit, entries)), [201, 409])
        self.assertEqual(current_approvals(position=position).count(), 1)
