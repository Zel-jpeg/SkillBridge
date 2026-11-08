"""Partner candidates keep their evidence gates while cohort reads stay bounded."""
from unittest.mock import patch

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from .combined_competency import combined_is_unlocked
from .models import (Assessment, Batch, BatchEnrollment, Company, CombinedCompetencyProfile,
                     CompetencyFramework, Institute, InstructorAssignment, Position,
                     PositionRequirement, Program, Recommendation, SkillCategory, SkillScore,
                     StudentResponse, User)
from .recommendation_freshness import cached_catalog_fingerprint, input_fingerprint


class PartnerQueryBatchingTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user('partner-admin@example.invalid', role='admin')
        self.owner = User.objects.create_user('partner-owner@example.invalid', role='instructor', is_approved=True)
        self.other = User.objects.create_user('partner-other@example.invalid', role='instructor', is_approved=True)
        self.ic = Institute.objects.create(code='IC', name='Institute of Computing')
        self.institute = Institute.objects.create(code='ANY', name='Arbitrary Institute')
        self.company = Company.objects.create(name='Synthetic Partner')
        self.catalogs = {}
        self.created_students = 0

    def cohort(self, name, *, scoped=False, owner=None, archived=False):
        owner = owner or self.owner
        program = framework = None
        if scoped:
            program = Program.objects.create(institute=self.institute, code=name, name=name)
            InstructorAssignment.objects.create(program=program, instructor=owner)
            framework = CompetencyFramework.objects.create(program=program, name='Reviewed skills', version=1)
        batch = Batch.objects.create(instructor=owner, name=name, institute=self.institute if scoped else self.ic,
                                     program=program, framework=framework, status='archived' if archived else 'active')
        category = SkillCategory.objects.create(framework=framework, name=f'{name} records')
        assessment = Assessment.objects.create(title=f'{name} required', batch=batch, framework=framework,
                                               created_by=owner, publication_status='published')
        position = Position.objects.create(company=self.company, title=f'{name} intern',
            eligibility_configured_at=timezone.now() if scoped else None)
        if scoped:
            position.eligible_programs.add(program)
        PositionRequirement.objects.create(position=position, skill_category=category, required_percentage=50)
        return batch, category, assessment, position

    def learner(self, cohort, *, state='ready', student=None):
        batch, category, assessment, position = cohort
        if student is None:
            self.created_students += 1
            student = User.objects.create_user(f'partner-{self.created_students}@example.invalid',
                role='student', name=f'Synthetic Learner {self.created_students}', is_approved=True,
                course='BSIT' if self.created_students % 2 else 'BSIS')
        BatchEnrollment.objects.create(student=student, batch=batch, profile_review_required=state == 'review')
        if state != 'incomplete':
            StudentResponse.objects.create(student=student, assessment=assessment, status='stopped' if state == 'stopped' else 'submitted',
                submitted_at=timezone.now(), is_flagged=state == 'flagged')
            SkillScore.objects.create(student=student, assessment=assessment, skill_category=category,
                raw_score=1, max_score=1, percentage=100)
        if state != 'missing_profile':
            CombinedCompetencyProfile.objects.create(student=student, batch=batch, is_finalized=state != 'unfinished_profile',
                included_assessment_ids=[] if state == 'wrong_sources' else [assessment.id],
                ranking_input_fingerprint='stale' if state == 'stale' else input_fingerprint(student,
                    cached_catalog_fingerprint(batch, self.catalogs), batch=batch))
        Recommendation.objects.create(student=student, batch=batch, position=position, match_score=80,
            category_score_component=100, nlp_score_component=60, location_score_component=50)
        return student

    @staticmethod
    def direct_states(students, batch, **options):
        """The previous company endpoint's direct per-enrollment gate is the oracle."""
        catalog = cached_catalog_fingerprint(batch, options['catalog_cache'])
        return {student.id: ({}, combined_is_unlocked(student, batch, catalog=catalog)) for student in students}

    def test_payload_matches_direct_gates_across_programs_mixed_history_and_incomplete_evidence(self):
        mixed = self.cohort('Shared IC')
        scoped = self.cohort('OTHER', scoped=True)
        foreign = self.cohort('FOREIGN', scoped=True, owner=self.other)
        archived = self.cohort('Archived IC', archived=True)
        ready = self.learner(mixed)
        second = self.learner(mixed)
        self.learner(scoped, student=ready)
        foreign_student = self.learner(foreign)
        self.learner(archived, student=ready)
        for cohort in (mixed, scoped):
            for state in ('incomplete', 'review', 'flagged', 'stopped', 'stale', 'missing_profile', 'unfinished_profile', 'wrong_sources'):
                self.learner(cohort, state=state)
        # Closing an included optional assessment retains its saved score evidence.
        closed = Assessment.objects.create(title='Closed optional', batch=scoped[0], framework=scoped[0].framework,
            created_by=self.owner, publication_status='closed', is_required=False)
        StudentResponse.objects.create(student=ready, assessment=closed, status='submitted', submitted_at=timezone.now())
        SkillScore.objects.create(student=ready, assessment=closed, skill_category=scoped[1], raw_score=1, max_score=1, percentage=100)
        CombinedCompetencyProfile.objects.filter(student=ready, batch=scoped[0]).update(
            included_assessment_ids=sorted([scoped[2].id, closed.id]))

        for actor in (self.owner, self.admin):
            with self.subTest(role=actor.role):
                self.client.force_authenticate(actor)
                with patch('api.views.bulk_management_states', side_effect=self.direct_states):
                    expected = self.client.get(reverse('instructor_companies'))
                with CaptureQueriesContext(connection) as queries:
                    result = self.client.get(reverse('instructor_companies'))
                self.assertEqual(result.status_code, 200)
                self.assertEqual(result.data, expected.data)
                self.assertFalse(any(query['sql'].lstrip().upper().startswith(('INSERT', 'UPDATE', 'DELETE')) for query in queries))
                positions = {position['id']: position for company in result.data for position in company['positions']}
                self.assertEqual({row['id'] for row in positions[mixed[3].id]['matched_students']}, {ready.id, second.id})
                self.assertEqual([row['id'] for row in positions[scoped[3].id]['matched_students']], [ready.id])
                if actor.role == 'instructor':
                    self.assertNotIn(foreign[3].id, positions)
                else:
                    self.assertEqual([row['id'] for row in positions[foreign[3].id]['matched_students']], [foreign_student.id])

    def test_company_gate_query_count_does_not_grow_with_students_in_a_batch(self):
        cohort = self.cohort('Bounded IC')
        self.learner(cohort)
        self.client.force_authenticate(self.owner)
        with CaptureQueriesContext(connection) as first:
            self.assertEqual(self.client.get(reverse('instructor_companies')).status_code, 200)
        for _ in range(19):
            self.learner(cohort)
        with CaptureQueriesContext(connection) as larger:
            response = self.client.get(reverse('instructor_companies'))
        with patch('api.views.bulk_management_states', side_effect=self.direct_states):
            with CaptureQueriesContext(connection) as previous:
                expected = self.client.get(reverse('instructor_companies'))
        self.assertEqual(response.data, expected.data)
        self.assertEqual(len(response.data[0]['positions'][0]['matched_students']), 20)
        self.assertLessEqual(len(larger), len(first) + 1)
        self.assertGreater(len(previous), len(larger) + 50)
