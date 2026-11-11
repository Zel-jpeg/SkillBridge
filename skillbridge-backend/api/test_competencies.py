"""Program category identity, shared reuse, frozen content and legacy isolation."""
import uuid
from unittest.mock import patch

from django.db.models.deletion import ProtectedError
from django.db import connection
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from .models import (Assessment, Batch, ChangeEvent, CompetencyFramework, Institute, InstituteSkill,
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

    def test_shared_institute_catalog_is_scoped_and_independent_of_program_copies(self):
        url = reverse('institute_skills', args=[self.program.institute_id])
        foreign_url = reverse('institute_skills', args=[self.other_program.institute_id])
        definition = {'name': 'Guest records', 'description': 'Review the service records.', 'tags': ['Intake']}
        self.client.force_authenticate(self.admin)
        created = self.client.post(url, definition, format='json')
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(self.client.post(url, {**definition, 'name': 'guest records'}, format='json').status_code, 409)
        self.assertEqual(self.client.post(foreign_url, definition, format='json').status_code, 201)
        detail = url + f'{created.data["id"]}/'
        foreign_detail = foreign_url + f'{created.data["id"]}/'
        self.assertEqual(self.client.put(foreign_detail, definition, format='json').status_code, 404)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.get(url).data, [created.data])
        self.assertEqual(self.client.get(foreign_url).status_code, 404)
        self.assertEqual(self.client.delete(detail).status_code, 403)
        copied = self.add(**{**definition, 'description': 'Program-specific interpretation.'})
        self.assertEqual(copied.status_code, 201, copied.data)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.delete(detail).status_code, 204)
        self.assertEqual(SkillCategory.objects.get(pk=copied.data['id']).description, 'Program-specific interpretation.')
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.get(url).status_code, 403)
        self.client.force_authenticate(self.owner)
        self.grant.is_active = False
        self.grant.save(update_fields=['is_active'])
        self.assertEqual(self.client.get(url).status_code, 404)
        if connection.vendor == 'postgresql':
            with connection.cursor() as cursor:
                cursor.execute("SELECT relrowsecurity FROM pg_class WHERE oid = 'api_instituteskill'::regclass")
                self.assertTrue(cursor.fetchone()[0])

    def test_same_program_coordinators_share_unused_skill_editing(self):
        category = self.add().data
        self.client.force_authenticate(self.peer)
        listed = self.client.get(self.base + 'categories/').data
        self.assertEqual(listed['count'], 1)
        self.assertEqual(listed['results'][0]['id'], category['id'])
        self.assertTrue(listed['results'][0]['can_edit'])
        data = {'name': category['name'], 'description': 'Shared program edit', 'expected_digest': category['digest']}
        self.assertEqual(self.client.patch(self.base + f'categories/{category["id"]}/', data, format='json').status_code, 200)
        self.assertEqual(self.add(name='Peer knowledge category').status_code, 201)
        self.assertEqual(self.change(name='Peer rename').status_code, 403)

    def test_skill_search_matches_tags_within_the_selected_version(self):
        category = self.add(tags=['Unique vocabulary']).data
        self.add(name='Unrelated category', tags=['Unrelated tag'])
        SkillCategory.objects.create(name='Shared category', tags=['Unique vocabulary'])
        response = self.client.get(self.base + 'categories/', {'search': 'VOCABULARY'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual([row['id'] for row in response.data['results']], [category['id']])

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

    def test_peer_can_remove_unused_skill_but_foreign_and_stale_requests_are_denied(self):
        row = self.add().data
        url = self.base + f'categories/{row["id"]}/'
        self.client.force_authenticate(self.foreign)
        self.assertEqual(self.client.delete(url, {'expected_digest': row['digest']}, format='json').status_code, 404)
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.delete(url, {'expected_digest': row['digest']}, format='json').status_code, 403)
        self.client.force_authenticate(self.peer)
        self.assertEqual(self.client.delete(url, {'expected_digest': 'stale'}, format='json').status_code, 409)
        self.assertEqual(self.client.delete(url, {'expected_digest': row['digest']}, format='json').status_code, 204)
        self.assertFalse(SkillCategory.objects.filter(pk=row['id']).exists())
        self.assertTrue(ManagementAction.objects.filter(action='category.remove', actor=self.peer).exists())

    def test_adding_to_used_skills_preserves_original_evidence_and_retries(self):
        row = self.add().data
        batch = Batch.objects.create(name='Used definitions', instructor=self.owner, program=self.program,
            institute=self.program.institute, framework_id=self.framework['id'])
        assessment = Assessment.objects.create(title='Existing work', batch=batch, created_by=self.owner)
        question = Question.objects.create(assessment=assessment, skill_category_id=row['id'], question_text='Saved question')
        score = SkillScore.objects.create(student=self.student, assessment=assessment, skill_category_id=row['id'],
            raw_score=7, max_score=10, percentage=70)
        payload = {'operation': 'add', 'name': 'Additional knowledge', 'description': 'Explains a new knowledge area.',
            'tags': ['New vocabulary'], 'expected_digest': self.detail()['digest'], 'request_id': str(uuid.uuid4())}
        self.client.force_authenticate(self.peer)
        result = self.client.post(self.base + 'revisions/', payload, format='json')
        self.assertEqual(result.status_code, 201, result.data)
        copied = SkillCategory.objects.get(framework_id=result.data['id'], source_category_id=row['id'])
        self.assertEqual((copied.name, copied.description, copied.tags), (row['name'], row['description'], row['tags']))
        self.assertTrue(SkillCategory.objects.filter(framework_id=result.data['id'], name=payload['name']).exists())
        replay = self.client.post(self.base + 'revisions/', payload, format='json')
        self.assertEqual((replay.status_code, replay.data['id']), (200, result.data['id']))
        for changes in ({'description': 'Changed retry'}, {'request_id': str(uuid.uuid4()), 'name': 'Concurrent addition'}):
            self.assertEqual(self.client.post(self.base + 'revisions/', {**payload, **changes}, format='json').status_code, 409)
        batch.refresh_from_db(); question.refresh_from_db(); score.refresh_from_db()
        self.assertEqual(batch.framework_id, self.framework['id'])
        self.assertEqual(question.skill_category_id, row['id'])
        self.assertEqual((score.raw_score, score.max_score, score.percentage), (7, 10, 70))
        self.assertEqual(CompetencyFramework.objects.count(), 2)

    def test_skill_addition_checks_duplicates_access_and_atomic_audit(self):
        row = self.add().data
        payload = {'operation': 'add', 'name': row['name'], 'description': 'New description.', 'tags': [],
            'expected_digest': self.detail()['digest'], 'request_id': str(uuid.uuid4())}
        url = self.base + 'revisions/'
        self.assertEqual(self.client.post(url, payload, format='json').status_code, 409)
        payload['name'] = 'Additional knowledge'
        with patch('api.competencies.record_action', side_effect=RuntimeError('Synthetic audit failure')):
            with self.assertRaises(RuntimeError):
                self.client.post(url, payload, format='json')
        self.assertEqual(CompetencyFramework.objects.count(), 1)
        self.client.force_authenticate(self.foreign)
        self.assertEqual(self.client.post(url, payload, format='json').status_code, 404)
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.post(url, payload, format='json').status_code, 403)
        self.client.force_authenticate(self.owner)
        self.grant.is_active = False; self.grant.save(update_fields=['is_active'])
        self.assertEqual(self.client.post(url, payload, format='json').status_code, 404)

    def test_used_skill_revision_keeps_questions_scores_batch_and_original_definitions(self):
        row = self.add().data
        other = self.add(name='Keep this skill').data
        batch = Batch.objects.create(name='Retained context', instructor=self.owner, program=self.program,
            institute=self.program.institute, framework_id=self.framework['id'])
        assessment = Assessment.objects.create(title='Retained assessment', batch=batch, created_by=self.owner)
        question = Question.objects.create(assessment=assessment, skill_category_id=row['id'], question_text='Retained question')
        score = SkillScore.objects.create(student=self.student, assessment=assessment, skill_category_id=row['id'],
            raw_score=7, max_score=10, percentage=70)
        url = self.base + f'categories/{row["id"]}/'
        self.client.force_authenticate(self.peer)
        self.assertEqual(self.client.delete(url, {'expected_digest': row['digest']}, format='json').status_code, 409)
        payload = {'operation': 'update', 'name': row['name'], 'description': 'New reviewed definition',
            'tags': ['New vocabulary'], 'expected_digest': self.detail()['digest'], 'request_id': str(uuid.uuid4())}
        revised = self.client.post(url + 'revisions/', payload, format='json')
        self.assertEqual(revised.status_code, 201, revised.data)
        self.assertEqual(self.client.post(url + 'revisions/', payload, format='json').data['id'], revised.data['id'])
        self.assertEqual(self.client.post(url + 'revisions/', {**payload, 'description': 'Changed retry'}, format='json').status_code, 409)
        self.assertEqual(self.create(request_id=payload['request_id'], name=self.framework['name'],
            description=self.framework['description'], source_framework_id=self.framework['id']).status_code, 409)
        new = SkillCategory.objects.get(framework_id=revised.data['id'], source_category_id=row['id'])
        self.assertEqual((new.description, new.tags), ('New reviewed definition', ['New vocabulary']))
        self.assertNotEqual(new.id, row['id'])
        self.assertEqual(SkillCategory.objects.get(pk=row['id']).description, row['description'])
        removal = self.client.post(url + 'revisions/', {'operation': 'remove',
            'expected_digest': self.detail()['digest'], 'request_id': str(uuid.uuid4())}, format='json')
        self.assertEqual(removal.status_code, 201, removal.data)
        self.assertEqual(list(SkillCategory.objects.filter(framework_id=removal.data['id']).values_list(
            'source_category_id', flat=True)), [other['id']])
        batch.refresh_from_db(); question.refresh_from_db(); score.refresh_from_db()
        self.assertEqual(batch.framework_id, self.framework['id'])
        self.assertEqual(question.skill_category_id, row['id'])
        self.assertEqual((score.skill_category_id, score.raw_score, score.max_score, score.percentage), (row['id'], 7, 10, 70))

    def test_revision_rejects_foreign_category_stale_catalog_and_revoked_coordinator(self):
        row = self.add().data
        url = self.base + f'categories/{row["id"]}/revisions/'
        payload = {'operation': 'remove', 'expected_digest': self.detail()['digest'], 'request_id': str(uuid.uuid4())}
        self.client.force_authenticate(self.foreign)
        self.assertEqual(self.client.post(url, payload, format='json').status_code, 404)
        self.client.force_authenticate(self.owner)
        self.add(name='Changed catalog')
        self.assertEqual(self.client.post(url, payload, format='json').status_code, 409)
        payload['expected_digest'] = self.detail()['digest']
        wrong = self.base + 'categories/999999/revisions/'
        self.assertEqual(self.client.post(wrong, payload, format='json').status_code, 404)
        self.grant.is_active = False; self.grant.save(update_fields=['is_active'])
        self.assertEqual(self.client.post(url, payload, format='json').status_code, 404)
        self.assertEqual(CompetencyFramework.objects.count(), 1)

    def test_copy_reference_is_preserved_when_an_unused_source_skill_is_removed(self):
        row = self.add().data
        self.create(source_framework_id=self.framework['id'])
        self.assertTrue(self.client.get(self.base + 'categories/').data['results'][0]['remove_requires_revision'])
        response = self.client.delete(self.base + f'categories/{row["id"]}/', {'expected_digest': row['digest']}, format='json')
        self.assertEqual(response.status_code, 409)
        self.assertTrue(SkillCategory.objects.filter(pk=row['id']).exists())

    def test_generic_suggestions_work_without_a_catalog_and_require_program_access(self):
        url = f'/api/management/programs/{self.program.id}/suggest-tags/'
        CompetencyFramework.objects.filter(pk=self.framework['id']).delete()
        before = (SkillCategory.objects.count(), ManagementAction.objects.count(), ChangeEvent.objects.count())
        data = {'name': 'Programming', 'description': 'Guest relations, itinerary planning, reservation handling.'}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['suggested_tags'], ['Guest relations', 'itinerary planning', 'reservation handling'])
        self.assertEqual((SkillCategory.objects.count(), ManagementAction.objects.count(), ChangeEvent.objects.count()), before)
        self.client.force_authenticate(self.foreign)
        self.assertEqual(self.client.post(url, data, format='json').status_code, 404)
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.post(url, data, format='json').status_code, 403)

    def test_suggestions_extract_keywords_from_full_tourism_and_social_work_descriptions(self):
        url = reverse('program_suggest_tags', args=[self.program.id])
        examples = (
            ('Accommodation Reservations',
             'Capture accurate accommodation booking details and verify reservation availability and confirmation.',
             ['booking details', 'reservation availability', 'confirmation']),
            ('Client Intake',
             'Collect relevant intake information and document client concerns before identifying referral needs.',
             ['relevant intake information', 'client concerns', 'identifying referral needs']),
        )
        for name, description, expected in examples:
            with self.subTest(name=name):
                result = self.client.post(url, {'name': name, 'description': description}, format='json')
                self.assertEqual(result.status_code, 200, result.data)
                self.assertEqual(result.data['suggested_tags'], expected)

    def test_institute_suggestions_use_only_its_shared_skills_and_require_admin_access(self):
        url = reverse('institute_suggest_tags', args=[self.program.institute_id])
        payload = {'name': 'Web Development', 'description': 'Capture accurate accommodation booking details.'}
        definition = {'name': 'Booking records', 'description': 'Capture accommodation booking details.'}
        InstituteSkill.objects.create(institute=self.other_program.institute, **definition, tags=['Foreign shared tag'])
        SkillCategory.objects.create(framework_id=self.framework['id'], **definition, tags=['Private program tag'])
        SkillCategory.objects.create(**definition, tags=['Shared IC tag'])

        self.assertEqual(self.client.post(url, payload, format='json').status_code, 403)
        self.client.force_authenticate(self.admin)
        empty = self.client.post(url, payload, format='json')
        self.assertEqual(empty.status_code, 200, empty.data)
        self.assertEqual(empty.data['suggested_tags'], ['accommodation booking details'])

        saved = InstituteSkill.objects.create(institute=self.program.institute, **definition, tags=['Guest requests'])
        result = self.client.post(url, payload, format='json')
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(result.data['suggested_tags'], ['accommodation booking details', 'Guest requests'])
        saved.refresh_from_db()
        self.assertEqual(saved.tags, ['Guest requests'])

    def test_suggestions_reuse_relevant_tags_only_from_latest_active_program_library(self):
        name = 'Accommodation Reservations'
        description = 'Capture accurate accommodation booking details and verify reservation availability.'
        related = {'name': 'Booking records', 'description': 'Verify reservation availability and booking details.'}
        current = self.create().data['id']
        retired = self.create().data['id']
        CompetencyFramework.objects.filter(pk=retired).update(is_active=False)
        sibling = Program.objects.create(institute=self.program.institute, code='SIB', name='Sibling program')
        for framework_id, tags in (
            (self.framework['id'], ['Older revision keyword']),
            (retired, ['Retired keyword']),
            (current, ['Booking Details', 'guest requests', 'booking amendments', 'room inventory', 'check-in time', 'extra tag']),
        ):
            SkillCategory.objects.create(framework_id=framework_id, **related, tags=tags)
        for program in (sibling, self.other_program):
            framework = CompetencyFramework.objects.create(program=program, name='Other skills', version=1)
            SkillCategory.objects.create(framework=framework, **related, tags=['Other program keyword'])
        SkillCategory.objects.create(**related, tags=['Shared taxonomy keyword'])
        SkillCategory.objects.create(framework_id=current, name=name, description=description, tags=['Same skill keyword'])
        SkillCategory.objects.create(framework_id=current, name='Food hygiene',
                                     description='Check food storage temperature.', tags=['Food safety'])

        self.client.force_authenticate(self.peer)
        url = reverse('program_suggest_tags', args=[self.program.id])
        result = self.client.post(url, {'name': name, 'description': description}, format='json')
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(result.data['suggested_tags'], [
            'booking details', 'reservation availability', 'guest requests', 'booking amendments',
            'room inventory', 'check-in time',
        ])

        SkillCategory.objects.create(framework_id=current, name='Booking notes',
                                     description=related['description'], tags=['Uncertain alternative'])
        result = self.client.post(url, {'name': name, 'description': description}, format='json')
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(result.data['suggested_tags'], ['booking details', 'reservation availability'])

    def test_revision_and_removal_roll_back_when_audit_fails(self):
        row = self.add().data
        payload = {'operation': 'remove', 'expected_digest': self.detail()['digest'], 'request_id': str(uuid.uuid4())}
        with patch('api.competencies.record_action', side_effect=RuntimeError('Synthetic audit failure')):
            with self.assertRaises(RuntimeError):
                self.client.post(self.base + f'categories/{row["id"]}/revisions/', payload, format='json')
            with self.assertRaises(RuntimeError):
                self.client.delete(self.base + f'categories/{row["id"]}/', {'expected_digest': row['digest']}, format='json')
        self.assertTrue(SkillCategory.objects.filter(pk=row['id']).exists())
        self.assertEqual(CompetencyFramework.objects.count(), 1)
