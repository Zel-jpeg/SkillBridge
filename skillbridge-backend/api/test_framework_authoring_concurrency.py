from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest import skipUnless
from django.db import connection, close_old_connections
from django.test import TransactionTestCase
from rest_framework.test import APIClient
from .competencies import current_framework, framework_payload
from .models import Assessment, Batch, CompetencyFramework, Institute, InstructorAssignment, Program, SkillCategory, User


@skipUnless(connection.vendor == 'postgresql', 'Requires PostgreSQL row locks')
class FrameworkAuthoringConcurrencyTests(TransactionTestCase):
    def setUp(self):
        self.owner = User.objects.create_user('race-author@example.invalid', role='instructor', is_approved=True)
        institute = Institute.objects.create(code='RACE', name='Race Institute')
        self.program = Program.objects.create(institute=institute, code='ANY', name='Arbitrary Program')
        InstructorAssignment.objects.create(instructor=self.owner, program=self.program)
        self.batch = Batch.objects.create(instructor=self.owner, name='Race cohort', program=self.program, institute=institute)
        self.frameworks = [CompetencyFramework.objects.create(program=self.program, version=version, name='Reviewed definitions', created_by=self.owner) for version in [1, 2]]
        for framework in self.frameworks:
            SkillCategory.objects.create(framework=framework, name='Reviewed category', description='Synthetic reviewed definition')

    def create_request(self, framework):
        version = current_framework(self.owner, self.program, framework.pk)
        return ('post', '/api/instructor/assessments/', {'title': 'Concurrent draft', 'batch_id': self.batch.id,
            'framework_id': version.id, 'framework_digest': framework_payload(version, self.owner)['digest'],
            'publication_status': 'draft', 'questions': []})

    def race(self, requests):
        barrier = Barrier(2)
        def perform(request):
            close_old_connections()
            try:
                client = APIClient(); client.force_authenticate(User.objects.get(pk=self.owner.id))
                method, url, payload = request
                barrier.wait(timeout=10)
                result = getattr(client, method)(url, payload, format='json')
                return result.status_code
            finally:
                close_old_connections()
        with ThreadPoolExecutor(max_workers=2) as pool:
            return list(pool.map(perform, requests))

    def test_competing_versions_cannot_bind_one_batch_to_different_definitions(self):
        statuses = self.race([self.create_request(version) for version in self.frameworks])
        self.assertEqual(sorted(statuses), [201, 400])
        self.assertEqual(Assessment.objects.count(), 1)
        self.batch.refresh_from_db()
        self.assertEqual(self.batch.framework_id, Assessment.objects.get().framework_id)

    def test_definition_edit_and_first_binding_cannot_silently_accept_changed_content(self):
        framework = self.frameworks[0]
        request = self.create_request(framework)
        edit = ('patch', f'/api/management/programs/{self.program.pk}/frameworks/{framework.pk}/',
                {'expected_digest': request[2]['framework_digest'], 'description': 'Changed reviewed definition'})
        statuses = self.race([request, edit])
        self.assertIn(sorted(statuses), [[201, 409], [200, 409]])
        framework.refresh_from_db()
        if Assessment.objects.exists():
            self.assertEqual(framework.description, '')
        else:
            self.assertEqual(framework.description, 'Changed reviewed definition')
