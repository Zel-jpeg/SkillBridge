"""Actual independent PostgreSQL connections; synthetic transactions only."""
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, Event
from time import monotonic, sleep
from uuid import uuid4
from unittest import skipUnless
from unittest.mock import patch
from .recommendation_freshness import input_fingerprint
from django.db import connection, close_old_connections
from django.test import TransactionTestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from .models import (AnswerChoice, Assessment, Batch, BatchEnrollment, Company,
    CombinedCategoryScore, CombinedCompetencyProfile, OJTPlacement, Position, Question,
    Recommendation, SkillCategory, SkillScore, StudentResponse, User)


@skipUnless(connection.vendor == 'postgresql', 'Requires disposable PostgreSQL row locking')
class ConcurrentWorkflowTests(TransactionTestCase):
    def setUp(self):
        self.admin = User.objects.create_user('race-admin@example.invalid', role='admin')
        self.owner = User.objects.create_user('race-instructor@example.invalid', role='instructor', is_approved=True)
        self.batch = Batch.objects.create(name='Synthetic race batch', instructor=self.owner)
        self.students = [User.objects.create_user(f'race-{i}@example.invalid', role='student', is_approved=True) for i in range(2)]
        for student in self.students:
            BatchEnrollment.objects.create(student=student, batch=self.batch)
        self.category = SkillCategory.objects.create(name='Synthetic skill')
        self.assessment, self.question = self.new_assessment()
        self.company = Company.objects.create(name='Synthetic race company')
        self.position = Position.objects.create(company=self.company, title='Last seat', slots_available=1)
        for student in self.students:
            StudentResponse.objects.create(student=student, assessment=self.assessment, submitted_at=timezone.now(), status='submitted')
            SkillScore.objects.create(student=student, assessment=self.assessment, skill_category=self.category, raw_score=1, max_score=1, percentage=100)
            CombinedCategoryScore.objects.create(student=student, batch=self.batch, skill_category=self.category, raw_score=1, max_score=1, percentage=100, source_assessment_ids=[self.assessment.id])
            CombinedCompetencyProfile.objects.create(student=student, batch=self.batch, is_finalized=True,
                included_assessment_ids=[self.assessment.id], ranking_input_fingerprint=input_fingerprint(student))
        self.recs = [Recommendation.objects.create(student=student, batch=self.batch, position=self.position, match_score=70 + i) for i, student in enumerate(self.students)]

    def new_assessment(self):
        assessment = Assessment.objects.create(title='Synthetic original', batch=self.batch, created_by=self.owner)
        question = Question.objects.create(assessment=assessment, question_text='Original question', skill_category=self.category)
        AnswerChoice.objects.create(question=question, choice_text='Yes', is_correct=True)
        AnswerChoice.objects.create(question=question, choice_text='No', is_correct=False)
        return assessment, question

    def request(self, user_id, method, path, payload=None, pids=None, entered=None, barrier=None):
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(User.objects.get(pk=user_id))
            if pids is not None:
                with connection.cursor() as cursor:
                    cursor.execute('SELECT pg_backend_pid()')
                    pids.append(cursor.fetchone()[0])
            if entered: entered.set()
            if barrier: barrier.wait(timeout=10)
            response = getattr(client, method)(path, payload or {}, format='json')
            return response.status_code, response.data
        finally:
            close_old_connections()

    def test_two_students_compete_for_one_remaining_slot(self):
        barrier = Barrier(2)
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(self.request, self.admin.pk, 'post', reverse('placement_approve'),
                {'recommendation_id': rec.pk}, barrier=barrier) for rec in self.recs]
            outcomes = [future.result(timeout=20) for future in futures]
        self.assertEqual(sorted(result[0] for result in outcomes), [201, 409])
        placement = OJTPlacement.objects.get(status='approved')
        self.assertEqual(placement.batch_id, self.batch.pk)
        self.assertEqual(placement.match_score_at_assignment, Recommendation.objects.get(pk=placement.recommendation_id).match_score)
        self.assertEqual(self.position.ojt_placements.filter(status='approved').count(), 1)

    def test_archive_and_republish_serialize_without_exposing_an_archived_published_assessment(self):
        self.assessment.publication_status = 'closed'
        self.assessment.save()
        barrier = Barrier(2)
        with ThreadPoolExecutor(max_workers=2) as pool:
            archive = pool.submit(self.request, self.owner.pk, 'post', reverse('assessment_archive', args=[self.assessment.pk]), barrier=barrier)
            publish = pool.submit(self.request, self.admin.pk, 'patch', reverse('instructor_assessment_detail', args=[self.assessment.pk]),
                                  {'publication_status': 'published'}, barrier=barrier)
            outcomes = [archive.result(timeout=20), publish.result(timeout=20)]
        self.assertEqual(sorted(result[0] for result in outcomes), [200, 409])
        self.assessment.refresh_from_db()
        self.assertFalse(self.assessment.is_archived and self.assessment.publication_status == 'published')

    def test_duplicate_archive_commits_one_audit_and_preserves_saved_evidence(self):
        from .models import ManagementAction
        self.assessment.publication_status = 'closed'
        self.assessment.save()
        before = list(SkillScore.objects.values('id', 'raw_score', 'max_score', 'percentage'))
        barrier = Barrier(2)
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(self.request, self.owner.pk, 'post', reverse('assessment_archive', args=[self.assessment.pk]),
                                   barrier=barrier) for _ in range(2)]
            outcomes = [future.result(timeout=20) for future in futures]
        self.assertEqual([result[0] for result in outcomes], [200, 200])
        self.assertEqual(ManagementAction.objects.filter(action='assessment.archive').count(), 1)
        self.assertEqual(list(SkillScore.objects.values('id', 'raw_score', 'max_score', 'percentage')), before)

    def test_archived_assessment_never_delivers_a_new_attempt(self):
        assessment, _ = self.new_assessment()
        assessment.publication_status = 'closed'
        assessment.save()
        self.assertEqual(self.request(self.owner.pk, 'post', reverse('assessment_archive', args=[assessment.pk]))[0], 200)
        self.assertEqual(self.request(self.students[0].pk, 'post', reverse('assessment_start', args=[assessment.pk]))[0], 409)
        self.assertFalse(StudentResponse.objects.filter(assessment=assessment).exists())

    def test_extra_time_and_submit_serialize_without_modifying_a_finalized_attempt(self):
        from .models import ManagementAction
        assessment, _ = self.new_assessment()
        student = self.students[0]
        started = self.request(student.pk, 'post', reverse('assessment_start', args=[assessment.pk]))
        self.assertEqual(started[0], 200)
        identity = started[1]['attempt_started_at']
        barrier = Barrier(2)
        with ThreadPoolExecutor(max_workers=2) as pool:
            extension = pool.submit(self.request, self.owner.pk, 'post', reverse('assessment_extra_time', args=[assessment.pk, student.pk]),
                {'minutes': 10, 'reason': 'Synthetic concurrent extension', 'request_id': str(uuid4()), 'attempt_started_at': identity}, barrier=barrier)
            submit = pool.submit(self.request, student.pk, 'post', reverse('assessment_submit', args=[assessment.pk]),
                {'answers': [], 'attempt_started_at': identity}, barrier=barrier)
            extension_result, submit_result = extension.result(timeout=30), submit.result(timeout=30)
        self.assertEqual(submit_result[0], 200)
        self.assertIn(extension_result[0], [200, 409])
        response = StudentResponse.objects.get(student=student, assessment=assessment)
        self.assertEqual(response.status, 'submitted')
        self.assertEqual(response.extra_time_seconds, 600 if extension_result[0] == 200 else 0)
        self.assertEqual(ManagementAction.objects.filter(action='attempt.extra_time').count(), 1 if extension_result[0] == 200 else 0)

    def test_duplicate_request_id_creates_one_copy_with_independent_keys(self):
        from .models import ManagementAction
        nonce = str(uuid4())
        barrier = Barrier(2)
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(self.request, self.owner.pk, 'post', reverse('assessment_duplicate', args=[self.assessment.pk]),
                       {'request_id': nonce}, barrier=barrier) for _ in range(2)]
            results = [future.result(timeout=20) for future in futures]
        self.assertEqual(sorted(result[0] for result in results), [200, 201])
        self.assertEqual(len({result[1]['id'] for result in results}), 1)
        copy = Assessment.objects.get(pk=results[0][1]['id'])
        self.assertFalse(copy.is_required); self.assertFalse(copy.include_in_competency)
        self.assertNotEqual(copy.questions.get().pk, self.question.pk)
        self.assertEqual(ManagementAction.objects.filter(action='assessment.duplicate').count(), 1)

    def test_simultaneous_same_approval_is_idempotent(self):
        barrier = Barrier(2)
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(self.request, self.admin.pk, 'post', reverse('placement_approve'),
                {'recommendation_id': self.recs[0].pk}, barrier=barrier) for _ in range(2)]
            outcomes = [future.result(timeout=20) for future in futures]
        self.assertEqual(sorted(result[0] for result in outcomes), [200, 201])
        self.assertEqual(OJTPlacement.objects.count(), 1)
        self.assertEqual(len({result[1]['placement']['id'] for result in outcomes}), 1)

    def test_archived_student_cannot_receive_a_new_recommendation_approval(self):
        self.students[0].is_active = False
        self.students[0].save(update_fields=['is_active'])
        result = self.request(self.admin.pk, 'post', reverse('placement_approve'), {'recommendation_id': self.recs[0].pk})
        self.assertEqual(result[0], 409)
        self.assertFalse(OJTPlacement.objects.exists())
        self.students[0].is_active = True
        self.students[0].save(update_fields=['is_active'])
        self.assertEqual(self.request(self.admin.pk, 'post', reverse('placement_approve'), {'recommendation_id': self.recs[0].pk})[0], 201)

    def test_approval_records_evidence_batch_despite_newer_foreign_enrollment(self):
        other = User.objects.create_user('race-other@example.invalid', role='instructor')
        newer = Batch.objects.create(name='Newer foreign batch', instructor=other)
        BatchEnrollment.objects.create(student=self.students[0], batch=newer)
        BatchEnrollment.objects.create(student=self.students[1], batch=newer)
        result = self.request(self.owner.pk, 'post', reverse('placement_approve'), {'recommendation_id': self.recs[0].pk})
        self.assertEqual(result[0], 201)
        self.assertEqual(result[1]['placement']['batch']['id'], self.batch.pk)
        self.assertEqual(OJTPlacement.objects.get().batch_id, self.batch.pk)
        rejected = self.request(self.owner.pk, 'post', reverse('placement_reject'), {'recommendation_id': self.recs[1].pk, 'remarks': 'Synthetic rejection'})
        self.assertEqual(rejected[0], 200, rejected[1])
        self.assertEqual(rejected[1]['placement']['batch']['id'], self.batch.pk)
        client = APIClient()
        client.force_authenticate(self.owner)
        report = client.get(reverse('placement_reports')).data
        self.assertEqual(report['summary']['total_records'], 2)
        self.assertEqual({row['batch']['id'] for row in report['records']}, {self.batch.pk})

    def assert_blocked(self, blocked_pid, holder_pid):
        deadline = monotonic() + 5
        while monotonic() < deadline:
            with connection.cursor() as cursor:
                cursor.execute('SELECT pg_blocking_pids(%s)', [blocked_pid])
                if holder_pid in cursor.fetchone()[0]: return
            sleep(0.01)
        self.fail('Expected parent-row PostgreSQL lock was not observed')

    def race_authoring_start(self, first_operation):
        from . import assessment_authoring, views
        assessment, question = self.new_assessment()
        locked, entered, release = Event(), Event(), Event()
        first_pids, second_pids = [], []
        original = assessment_authoring.apply_changes if first_operation == 'edit' else views.build_question_layout
        def hold(*args, **kwargs):
            locked.set()
            self.assertTrue(release.wait(10))
            return original(*args, **kwargs)
        target = 'api.assessment_authoring.apply_changes' if first_operation == 'edit' else 'api.views.build_question_layout'
        edit = (self.owner.pk, 'patch', reverse('instructor_assessment_detail', args=[assessment.pk]),
            {'question_changes': {'update': [{'id': question.pk, 'question_text': 'Edited before delivery'}]}})
        start = (self.students[0].pk, 'post', reverse('assessment_start', args=[assessment.pk]), {})
        first, second = (edit, start) if first_operation == 'edit' else (start, edit)
        with patch(target, side_effect=hold), ThreadPoolExecutor(max_workers=2) as pool:
            one = pool.submit(self.request, *first, pids=first_pids)
            try:
                self.assertTrue(locked.wait(10))
                two = pool.submit(self.request, *second, pids=second_pids, entered=entered)
                self.assertTrue(entered.wait(10))
                self.assert_blocked(second_pids[0], first_pids[0])
            finally:
                release.set()
            first_result, second_result = one.result(timeout=20), two.result(timeout=20)
        question.refresh_from_db()
        self.assertEqual(first_result[0], 200)
        if first_operation == 'edit':
            self.assertEqual(second_result[0], 200)
            self.assertEqual(second_result[1]['questions'][0]['question_text'], 'Edited before delivery')
            self.assertEqual(question.question_text, 'Edited before delivery')
        else:
            self.assertEqual(second_result[0], 409)
            self.assertEqual(first_result[1]['questions'][0]['question_text'], 'Original question')
            self.assertEqual(question.question_text, 'Original question')
        self.assertEqual(StudentResponse.objects.filter(assessment=assessment).count(), 1)

    def test_authoring_commit_precedes_first_delivery(self):
        self.race_authoring_start('edit')

    def test_first_delivery_prevents_later_question_changes(self):
        self.race_authoring_start('start')
