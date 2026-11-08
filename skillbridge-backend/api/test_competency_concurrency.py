from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest import skipUnless
import uuid

from django.db import connection, close_old_connections
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import CompetencyFramework, Institute, InstructorAssignment, ManagementAction, Program, SkillCategory, User


@skipUnless(connection.vendor == 'postgresql', 'Requires PostgreSQL row locking')
class CompetencyConcurrencyTests(TransactionTestCase):
    def setUp(self):
        self.owner = User.objects.create_user('framework-race@example.invalid', role='instructor', is_approved=True)
        institute = Institute.objects.create(code='RACE', name='Synthetic Race Institute')
        self.program = Program.objects.create(institute=institute, code='ANY', name='Any Degree')
        InstructorAssignment.objects.create(instructor=self.owner, program=self.program)
        self.base = f'/api/management/programs/{self.program.id}/frameworks/'

    def request(self, barrier, method, url, data):
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(User.objects.get(pk=self.owner.id))
            barrier.wait(10)
            response = getattr(client, method)(url, data, format='json')
            return response.status_code, response.data
        finally:
            close_old_connections()

    def race(self, first, second):
        barrier = Barrier(2)
        with ThreadPoolExecutor(max_workers=2) as pool:
            a = pool.submit(self.request, barrier, *first)
            b = pool.submit(self.request, barrier, *second)
            return [a.result(20), b.result(20)]

    def test_replayed_framework_create_commits_one_version_and_audit(self):
        request = ('post', self.base, {'name': 'Knowledge', 'request_id': str(uuid.uuid4())})
        outcomes = self.race(request, request)
        self.assertEqual(sorted(code for code, _ in outcomes), [200, 201], outcomes)
        self.assertEqual({data['id'] for _, data in outcomes}, {CompetencyFramework.objects.get().id})
        self.assertEqual(ManagementAction.objects.filter(action='framework.create').count(), 1)

    def test_simultaneous_shared_category_create_reuses_one_identity(self):
        framework = CompetencyFramework.objects.create(program=self.program, version=1, name='Knowledge', created_by=self.owner)
        request = ('post', self.base + f'{framework.id}/categories/', {'name': 'Shared Knowledge', 'description': 'Explains the stated knowledge.'})
        outcomes = self.race(request, request)
        self.assertEqual(sorted(code for code, _ in outcomes), [200, 201], outcomes)
        self.assertEqual(SkillCategory.objects.count(), 1)
        self.assertEqual(ManagementAction.objects.filter(action='category.create').count(), 1)

    def test_freeze_and_definition_edit_cannot_both_commit_from_inconsistent_reviews(self):
        framework = CompetencyFramework.objects.create(program=self.program, version=1, name='Knowledge', created_by=self.owner)
        category = SkillCategory.objects.create(framework=framework, name='Shared', description='Original definition', created_by=self.owner)
        client = APIClient()
        client.force_authenticate(self.owner)
        base = self.base + f'{framework.id}/'
        reviewed_framework = client.get(base).data
        reviewed_category = client.get(base + f'categories/{category.id}/').data
        outcomes = self.race(('patch', base, {'freeze': True, 'expected_digest': reviewed_framework['digest']}),
            ('patch', base + f'categories/{category.id}/', {'name': 'Shared', 'description': 'Changed definition', 'expected_digest': reviewed_category['digest']}))
        self.assertEqual(sorted(code for code, _ in outcomes), [200, 409], outcomes)
        framework.refresh_from_db()
        category.refresh_from_db()
        self.assertEqual(category.description, 'Original definition' if framework.locked_at else 'Changed definition')

    def test_skill_addition_replay_and_competing_additions_preserve_the_latest_library(self):
        framework = CompetencyFramework.objects.create(program=self.program, version=1, name='Knowledge',
            created_by=self.owner, locked_at=timezone.now())
        SkillCategory.objects.create(framework=framework, name='Original skill', description='Original knowledge.')
        client = APIClient()
        client.force_authenticate(self.owner)
        detail = self.base + f'{framework.id}/'
        payload = {'operation': 'add', 'name': 'Added skill', 'description': 'Additional knowledge.',
            'expected_digest': client.get(detail).data['digest'], 'request_id': str(uuid.uuid4())}
        request = ('post', detail + 'revisions/', payload)
        outcomes = self.race(request, request)
        self.assertEqual(sorted(code for code, _ in outcomes), [200, 201], outcomes)
        self.assertEqual(len({data['id'] for _, data in outcomes}), 1)
        latest = CompetencyFramework.objects.order_by('-version').first()
        detail = self.base + f'{latest.id}/'
        payload.update(expected_digest=client.get(detail).data['digest'])
        outcomes = self.race(
            ('post', detail + 'revisions/', {**payload, 'name': 'First new skill', 'request_id': str(uuid.uuid4())}),
            ('post', detail + 'revisions/', {**payload, 'name': 'Second new skill', 'request_id': str(uuid.uuid4())}))
        self.assertEqual(sorted(code for code, _ in outcomes), [201, 409], outcomes)
        latest = CompetencyFramework.objects.order_by('-version').first()
        self.assertEqual(latest.categories.count(), 3)
        self.assertTrue(latest.categories.filter(name='Added skill').exists())
        self.assertEqual(ManagementAction.objects.filter(action='category.revise').count(), 2)
