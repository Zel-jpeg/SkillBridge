"""Program category identity, shared reuse, frozen content and legacy isolation."""
import uuid
from unittest.mock import patch

from django.db.models.deletion import ProtectedError
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from .models import (Assessment, Batch, ChangeEvent, CompetencyFramework, Institute,
                     InstructorAssignment, ManagementAction, Program, Question, SkillCategory, SkillScore, User)


class CompetencyCatalogTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user('framework-admin@example.invalid', role='admin')
        self.owner = User.objects.create_user('framework-owner@example.invalid', role='instructor', is_approved=True)
        self.peer = User.objects.create_user('framework-peer@example.invalid', role='instructor', is_approved=True)
        self.foreign = User.objects.create_user('framework-foreign@example.invalid', role='instructor', is_approved=True)
        self.student = User.objects.create_user('framework-student@example.invalid', role='student', is_approved=True)
        institute = Institute.objects.create(code='ANY', name='Any Institute')
        other_institute = Institute.objects.create(code='OTHER', name='Other Institute')
        self.program = Program.objects.create(institute=institute, code='ANY', name='Any Degree')
        self.other_program = Program.objects.create(institute=other_institute, code='ANY', name='Any Degree')
        self.grant = InstructorAssignment.objects.create(instructor=self.owner, program=self.program)
        InstructorAssignment.objects.create(instructor=self.peer, program=self.program)
        InstructorAssignment.objects.create(instructor=self.foreign, program=self.other_program)
        self.client.force_authenticate(self.owner)
        self.framework = self.create().data
        self.base = self.url(self.framework['id'])

    def url(self, framework_id=None, program=None):
        path = f'/api/management/programs/{(program or self.program).id}/frameworks/'
        return path + (f'{framework_id}/' if framework_id else '')

    def create(self, program=None, **changes):
        return self.client.post(self.url(program=program), {'name': 'OJT knowledge framework',
            'description': 'Synthetic reviewed knowledge definitions.', 'request_id': str(uuid.uuid4()), **changes}, format='json')

    def add(self, base=None, **changes):
        return self.client.post((base or self.base) + 'categories/', {'name': 'Shared category',
            'description': 'Recognizes and explains the stated knowledge area.', 'tags': ['Manual vocabulary'], **changes}, format='json')

    def detail(self):
        return self.client.get(self.base).data

    def change(self, **changes):
        return self.client.patch(self.base, {'expected_digest': self.detail()['digest'], **changes}, format='json')

    def test_same_program_catalog_is_reusable_without_editing_another_authors_definition(self):
        category = self.add().data
        self.client.force_authenticate(self.peer)
        listed = self.client.get(self.base + 'categories/').data
        self.assertEqual(listed['count'], 1)
        self.assertEqual(listed['results'][0]['id'], category['id'])
        self.assertFalse(listed['results'][0]['can_edit'])
        data = {'name': category['name'], 'description': 'Unauthorized edit', 'expected_digest': category['digest']}
        self.assertEqual(self.client.patch(self.base + f'categories/{category["id"]}/', data, format='json').status_code, 403)
        self.assertEqual(self.add(name='Peer knowledge category').status_code, 201)
        self.assertEqual(self.change(name='Peer rename').status_code, 403)

    def test_first_skill_and_its_version_save_atomically_and_replay(self):
        nonce = str(uuid.uuid4())
        category = {'name': 'Guest records', 'description': 'Review booking records.', 'tags': ['Booking']}
        self.assertEqual(self.create(self.other_program, initial_category=category).status_code, 404)
        self.client.force_authenticate(self.foreign)
        malformed = {**category, 'description': ' '}
        self.assertEqual(self.create(self.other_program, initial_category=malformed).status_code, 400)
        self.assertFalse(self.other_program.competency_frameworks.exists())
        saved = self.create(self.other_program, initial_category=category, request_id=nonce)
        self.assertEqual(saved.status_code, 201)
        self.assertEqual(saved.data['category_count'], 1)
        replay = self.create(self.other_program, initial_category=category, request_id=nonce)
        self.assertEqual((replay.status_code, replay.data['id']), (200, saved.data['id']))
        self.assertEqual(self.create(self.other_program, initial_category=category).status_code, 409)
        self.assertEqual(self.other_program.competency_frameworks.get().categories.get().name, 'Guest records')

    def test_shared_ic_catalog_requires_active_ic_assignment_and_is_read_only(self):
        institute = Institute.objects.create(code='IC', name='Institute of Computing')
        program = Program.objects.create(institute=institute, code='BSIT', name='Information Technology')
        shared = SkillCategory.objects.create(name='Shared networking', description='Check connections.')
        endpoint = reverse('staff_shared_ic_skills')
        options = reverse('staff_organization_options')
        for actor in (self.owner, self.student):
            self.client.force_authenticate(actor)
            self.assertEqual(self.client.get(endpoint).status_code, 403)
        self.client.force_authenticate(self.owner)
        self.assertIsNone(self.client.get(options).data['shared_skill_institute_id'])
        grant = InstructorAssignment.objects.create(instructor=self.owner, program=program)
        self.assertEqual(self.client.get(options).data['shared_skill_institute_id'], institute.id)
        self.assertEqual([row['id'] for row in self.client.get(endpoint).data], [shared.id])
        self.assertEqual(self.client.post(endpoint, {'name': 'Write denied'}).status_code, 405)
        grant.is_active = False
        grant.save(update_fields=['is_active'])
        self.assertEqual(self.client.get(endpoint).status_code, 403)

    def test_foreign_context_and_student_are_denied_even_when_names_and_codes_match(self):
        original = self.add().data
        for actor, expected in [(self.foreign, 404), (self.student, 403)]:
            self.client.force_authenticate(actor)
            for path in [self.url(), self.base, self.base + 'categories/']:
                self.assertEqual(self.client.get(path).status_code, expected)
            self.assertEqual(self.add().status_code, expected)
        self.client.force_authenticate(self.foreign)
        other = self.create(program=self.other_program)
        self.assertEqual(other.status_code, 201)
        copied_name = self.add(base=self.url(other.data['id'], program=self.other_program))
        self.assertEqual(copied_name.status_code, 201, copied_name.data)
        self.assertNotEqual(copied_name.data['id'], original['id'])

    def test_definition_validation_rejects_wrong_shapes_without_partial_rows(self):
        for changes in [{'name': []}, {'description': ''}, {'description': 42}, {'tags': 'text'},
                        {'tags': [False]}, {'tags': ['x' * 81]}, {'tags': ['a'] * 31}, {'program_id': self.other_program.id}]:
            self.assertEqual(self.add(**changes).status_code, 400, changes)
        self.assertFalse(SkillCategory.objects.exists())
        result = self.add(tags=['Manual', 'manual', 'Two words'])
        self.assertEqual(result.data['tags'], ['Manual', 'Two words'])

    def test_category_create_replay_reuses_identity_but_never_silently_overwrites(self):
        first = self.add()
        self.assertEqual(first.status_code, 201)
        repeat = self.add()
        self.assertEqual((repeat.status_code, repeat.data['id']), (200, first.data['id']))
        self.assertEqual(self.add(description='Different claimed content').status_code, 409)
        self.assertEqual(SkillCategory.objects.count(), 1)

    def test_creator_and_admin_can_edit_unused_definition_and_stale_digest_cannot_overwrite(self):
        category = self.add().data
        url = self.base + f'categories/{category["id"]}/'
        data = {'name': category['name'], 'description': 'A revised unused definition.', 'tags': ['Reviewed'], 'expected_digest': category['digest']}
        changed = self.client.patch(url, data, format='json')
        self.assertEqual(changed.status_code, 200, changed.data)
        self.assertEqual(self.client.patch(url, {**data, 'description': 'Stale change'}, format='json').status_code, 409)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.patch(url, {**data, 'expected_digest': changed.data['digest'], 'description': 'Admin review'}, format='json').status_code, 200)

    def test_freeze_binds_current_category_set_and_is_permanent(self):
        stale = self.detail()['digest']
        self.assertEqual(self.change(freeze=True).status_code, 409)
        category = self.add().data
        self.assertEqual(self.client.patch(self.base, {'expected_digest': stale, 'freeze': True}, format='json').status_code, 409)
        frozen = self.change(freeze=True)
        self.assertEqual(frozen.status_code, 200, frozen.data)
        self.assertTrue(frozen.data['locked'])
        self.assertEqual(self.add(name='Late category').status_code, 409)
        self.assertEqual(self.change(name='Rewrite consumed title').status_code, 409)
        self.assertEqual(self.change(freeze=False).status_code, 400)
        response = self.client.patch(self.base + f'categories/{category["id"]}/',
            {'name': 'Rewrite', 'description': 'Must not change', 'expected_digest': category['digest']}, format='json')
        self.assertEqual(response.status_code, 409)

    def test_new_version_copies_definitions_with_new_ids_and_preserves_old_frozen_content(self):
        old = self.add().data
        self.change(freeze=True)
        self.client.force_authenticate(self.peer)
        result = self.create(source_framework_id=self.framework['id'])
        self.assertEqual(result.status_code, 201, result.data)
        self.assertEqual(result.data['version'], 2)
        self.assertFalse(result.data['locked'])
        new = SkillCategory.objects.get(framework_id=result.data['id'])
        self.assertNotEqual(new.id, old['id'])
        self.assertEqual((new.source_category_id, new.description, new.tags, new.created_by_id),
                         (old['id'], old['description'], old['tags'], self.peer.id))
        self.assertEqual(SkillCategory.objects.get(pk=old['id']).description, old['description'])

    def test_framework_creation_replay_is_scoped_idempotent_and_different_payload_conflicts(self):
        key = str(uuid.uuid4())
        first = self.create(request_id=key)
        second = self.create(request_id=key)
        self.assertEqual((first.status_code, second.status_code), (201, 200))
        self.assertEqual(first.data['id'], second.data['id'])
        self.assertEqual(self.create(request_id=key, name='Different payload').status_code, 409)
        self.assertEqual(CompetencyFramework.objects.count(), 2)

    def test_batch_or_score_reference_locks_definitions_and_protected_fk_keeps_evidence(self):
        category = self.add().data
        batch = Batch.objects.create(name='Existing context', instructor=self.owner, program=self.program,
            institute=self.program.institute, framework_id=self.framework['id'])
        self.assertTrue(self.detail()['locked'])
        self.assertEqual(self.add(name='Late addition').status_code, 409)
        assessment = Assessment.objects.create(title='Synthetic retained test', batch=batch, created_by=self.owner)
        question = Question.objects.create(assessment=assessment, skill_category_id=category['id'], question_text='Synthetic')
        score = SkillScore.objects.create(student=self.student, assessment=assessment, skill_category_id=category['id'],
            raw_score=7, max_score=10, percentage=70)
        with self.assertRaises(ProtectedError):
            SkillCategory.objects.get(pk=category['id']).delete()
        self.assertTrue(Question.objects.filter(pk=question.id).exists())
        score.refresh_from_db()
        self.assertEqual((score.raw_score, score.max_score, score.percentage), (7, 10, 70))

    def test_retire_restore_preserves_identity_frozen_content_and_catalog_reads(self):
        self.add()
        self.change(freeze=True)
        self.assertEqual(self.change(is_active=False).status_code, 200)
        self.assertEqual(self.add(name='Retired write').status_code, 409)
        self.assertEqual(self.client.get(self.base + 'categories/').data['count'], 1)
        self.assertEqual(self.create(source_framework_id=self.framework['id']).status_code, 201)
        restored = self.change(is_active=True)
        self.assertTrue(restored.data['locked'])
        self.assertEqual(CompetencyFramework.objects.count(), 2)

    def test_archived_program_keeps_assigned_read_access_and_blocks_new_definitions(self):
        self.add()
        self.program.is_active = False
        self.program.save(update_fields=['is_active'])
        self.assertEqual(self.client.get('/api/management/competency-programs/?status=all').data['count'], 1)
        self.assertEqual(self.client.get(self.base).status_code, 200)
        self.assertEqual(self.add(name='Unavailable').status_code, 400)
        self.assertEqual(self.create().status_code, 400)

    def test_revocation_on_same_jwt_removes_catalog_access(self):
        self.client.force_authenticate(None)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + str(AccessToken.for_user(self.owner)))
        self.assertEqual(self.client.get(self.base).status_code, 200)
        self.grant.is_active = False
        self.grant.save(update_fields=['is_active'])
        self.assertEqual(self.client.get(self.base).status_code, 404)
        self.assertEqual(self.client.get('/api/management/competency-programs/').data['count'], 0)

    def test_legacy_names_authoring_requirements_and_fingerprint_are_isolated(self):
        from .catalog_validation import requirements_value
        from .recommendation_freshness import catalog_fingerprint
        from .views import _question_category_name
        legacy = SkillCategory.objects.create(name='Shared category', description='Existing IC definition')
        baseline = catalog_fingerprint()
        self.add()
        self.assertEqual(catalog_fingerprint(), baseline)
        self.assertEqual(_question_category_name('Shared category'), 'Shared category')
        self.assertEqual(requirements_value({'Shared category': 60})[0][0].id, legacy.id)
        self.assertEqual([row['id'] for row in self.client.get('/api/categories/').data], [legacy.id])
        self.client.force_authenticate(self.admin)
        scoped = SkillCategory.objects.exclude(pk=legacy.pk).get()
        self.assertEqual(self.client.delete(f'/api/admin/skills/{scoped.id}/').status_code, 404)

    def test_rollback_leaves_no_partial_definition_or_audit(self):
        with patch('api.competencies.record_action', side_effect=RuntimeError('Synthetic audit failure')):
            with self.assertRaises(RuntimeError):
                self.add()
        self.assertFalse(SkillCategory.objects.exists())

    def test_events_only_reach_same_program_staff_and_admins_with_program_scope(self):
        ChangeEvent.objects.all().delete()
        with self.captureOnCommitCallbacks(execute=True):
            self.add()
        rows = dict(ChangeEvent.objects.values_list('recipient_id', 'payload'))
        self.assertEqual(set(rows), {self.admin.id, self.owner.id, self.peer.id})
        for payload in rows.values():
            self.assertEqual(payload['topics'], ['competencies'])
            self.assertEqual(payload['program_ids'], [self.program.id])
