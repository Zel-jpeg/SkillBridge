from unittest.mock import patch
from django.urls import reverse
from rest_framework.test import APITestCase

from .models import (Batch, BatchEnrollment, Company, OJTPlacement, Position, PositionRequirement,
                     SkillCategory, User)


class CatalogValidationTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email='catalog-admin@example.com', name='Admin', role='admin')
        self.owner = User.objects.create_user(email='catalog-owner@example.com', name='Owner', role='instructor')
        self.student = User.objects.create_user(email='catalog-student@example.com', name='Student', role='student')
        self.company = Company.objects.create(name='Synthetic company')
        self.category = SkillCategory.objects.create(name='Programming', created_by=self.owner)
        self.position = Position.objects.create(company=self.company, title='Original', slots_available=2)
        PositionRequirement.objects.create(position=self.position, skill_category=self.category, required_percentage=70)
        self.client.force_authenticate(self.admin)
        rerank = patch('api.views._rerun_recommendations_for_all_students')
        self.rerank = rerank.start()
        self.addCleanup(rerank.stop)

    def create(self, payload):
        return self.client.post(reverse('admin_company_positions', args=[self.company.id]), payload, format='json')

    def edit(self, payload):
        return self.client.patch(reverse('admin_position_detail', args=[self.position.id]), payload, format='json')

    def test_invalid_create_and_edit_never_save_partial_fields_or_requirements(self):
        invalid = [
            {'slots': 'not-a-number'}, {'slots': -1}, {'slots': 1.5}, {'slots': True}, {'slots': 2**31},
            {'requirements': []}, {'requirements': None}, {'requirements': 'bad'},
            {'requirements': {'Programming': 150}}, {'requirements': {'Programming': -1}},
            {'requirements': {'Programming': 'NaN'}}, {'requirements': {'Programming': 'Infinity'}},
            {'requirements': {'Programming': True}}, {'requirements': {'Programming': {}}},
            {'requirements': {'Unknown': 50}}, {'requirements': {'Programming': 20, 'programming': 30}},
            {'title': ''}, {'title': None}, {'title': ['bad']}, {'title': 'x' * 256},
            {'tags': {}}, {'tags': [None]},
        ]
        before = Position.objects.count()
        for values in invalid:
            for operation in [self.create, self.edit]:
                with self.subTest(values=values, operation=operation.__name__):
                    result = operation({'title': 'Changed', 'slots': 4, **values})
                    self.assertEqual(result.status_code, 400)
                    self.assertIn('error', result.data)
                    self.assertEqual(Position.objects.count(), before)
                    self.position.refresh_from_db()
                    self.assertEqual((self.position.title, self.position.slots_available), ('Original', 2))
                    self.assertEqual(self.position.requirements.get().required_percentage, 70)

    def test_valid_create_edit_zero_capacity_and_requirement_boundaries(self):
        created = self.create({'title': ' New ', 'slots': '0', 'requirements': {'Programming': 100}, 'tags': ' Python, python '})
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data['slots'], 0)
        self.assertEqual(created.data['tags'], ['Python'])
        updated = self.edit({'title': 'Updated', 'slots': 3, 'requirements': {'Programming': 0}})
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.data['requirements'], {})
        self.assertEqual(self.edit({'requirements': {'Programming': 99.5}}).status_code, 200)
        self.assertEqual(self.position.requirements.get().required_percentage, 99.5)

    def test_database_failure_rolls_back_create_and_replacement(self):
        with patch('api.models.PositionRequirement.objects.create', side_effect=RuntimeError('Synthetic write failure')):
            for operation in [self.create, self.edit]:
                with self.assertRaises(RuntimeError):
                    operation({'title': 'Changed', 'slots': 9, 'requirements': {'Programming': 80}})
        self.assertEqual(Position.objects.count(), 1)
        self.position.refresh_from_db()
        self.assertEqual(self.position.title, 'Original')
        self.assertEqual(self.position.requirements.get().required_percentage, 70)

    def test_company_edit_and_instructor_positions_are_validated_together(self):
        for role, route in [(self.admin, 'admin_company_detail'), (self.owner, 'instructor_company_edit')]:
            self.client.force_authenticate(role)
            for payload in [{'name': ''}, {'name': '   '}, {'name': 'Changed', 'lat': True}, {'lng': 'Infinity'}]:
                result = self.client.patch(reverse(route, args=[self.company.id]), payload, format='json')
                self.assertEqual(result.status_code, 400)
                self.company.refresh_from_db()
                self.assertEqual(self.company.name, 'Synthetic company')
        self.client.force_authenticate(self.owner)
        for positions in [[{'id': self.position.id, 'title': ''}], [{'id': self.position.id, 'slots': 2.5}],
                          [{'id': self.position.id}, {'id': self.position.id}], [{'id': True}]]:
            result = self.client.patch(reverse('instructor_company_edit', args=[self.company.id]),
                                       {'name': 'Changed', 'positions': positions}, format='json')
            self.assertEqual(result.status_code, 400)
            self.company.refresh_from_db()
            self.assertEqual(self.company.name, 'Synthetic company')

    def test_capacity_and_history_protected(self):
        batch = Batch.objects.create(name='Catalog history', instructor=self.owner)
        BatchEnrollment.objects.create(student=self.student, batch=batch)
        OJTPlacement.objects.create(student=self.student, batch=batch, position=self.position,
                                    company=self.company, assigned_by=self.admin, status='approved')
        self.assertEqual(self.edit({'slots': 0}).status_code, 409)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.patch(reverse('instructor_company_edit', args=[self.company.id]),
                         {'positions': [{'id': self.position.id, 'slots': 0}]}, format='json').status_code, 409)
        self.client.force_authenticate(self.admin)
        for route, pk in [('admin_position_detail', self.position.id), ('admin_company_detail', self.company.id)]:
            self.assertEqual(self.client.delete(reverse(route, args=[pk])).status_code, 409)
        self.assertTrue(Position.objects.filter(pk=self.position.id).exists())

    def test_role_boundaries_and_unreferenced_delete(self):
        for actor in [self.owner, self.student]:
            self.client.force_authenticate(actor)
            self.assertEqual(self.create({'title': 'No access'}).status_code, 403)
            self.assertEqual(self.edit({'slots': 0}).status_code, 403)
            self.assertEqual(self.client.delete(reverse('admin_position_detail', args=[self.position.id])).status_code, 403)
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.patch(reverse('instructor_company_edit', args=[self.company.id]), {'name': 'No'}, format='json').status_code, 403)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.delete(reverse('admin_position_detail', args=[self.position.id])).status_code, 204)
        self.assertEqual(self.client.delete(reverse('admin_position_detail', args=[self.position.id])).status_code, 404)
