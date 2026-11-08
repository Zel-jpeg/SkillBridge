from copy import deepcopy
from types import SimpleNamespace as Obj
from django.test import SimpleTestCase
from .recommendation_nlp import (build_student_profile, build_position_description, generate_competency_insights,
                                 category_definition, TEXT_GENERATION_VERSION, DEFINITION_WORD_LIMIT, DEFINITION_CHAR_LIMIT)


class GeneralCompetencyTextTests(SimpleTestCase):
    def score(self, name='Records knowledge', percentage=80, **changes):
        category = Obj(id=1, name=name, description='Recognizes booking records and explains arrival reservations.', tags=['Saved vocabulary'])
        return Obj(skill_category=category, percentage=percentage, max_score=10, raw_score=8, **changes)

    def position(self, rows):
        return Obj(title='Arbitrary opportunity', company=Obj(name='Synthetic partner'), tags=[],
            requirements=Obj(all=lambda: [Obj(skill_category=row.skill_category, required_percentage=row.percentage) for row in rows]))

    def test_arbitrary_category_results_replace_computing_and_career_orientation_rules(self):
        rows = [self.score('Visitor records', 85), self.score('Enterprise planning', 85), self.score('Programming', 70)]
        result = generate_competency_insights(rows)
        self.assertEqual(result['orientation_label'], 'Highest-scoring assessed areas (tied)')
        self.assertIn('Visitor records (85%)', result['orientation_summary'])
        self.assertIn('Enterprise planning (85%)', result['orientation_summary'])
        self.assertNotIn('Programming (70%)', result['orientation_summary'])
        self.assertNotIn('Backend', str(result))
        self.assertNotIn('Highest-scoring', result['competency_profile_text'])

    def test_saved_definition_is_symmetric_bounded_once_and_not_individual_mastery(self):
        row = self.score()
        row.skill_category.description = ' '.join(f'synthetic{index}' for index in range(200))
        definition = category_definition(row.skill_category)
        self.assertLessEqual(len(definition), DEFINITION_CHAR_LIMIT)
        self.assertLessEqual(len(definition.split()), DEFINITION_WORD_LIMIT)
        student, position = build_student_profile([row]), build_position_description(self.position([row]))
        for text in [student, position]:
            self.assertEqual(text.count(definition), 1)
            self.assertIn('Contextual category definition', text)
            self.assertNotIn('synthetic199', text)
        self.assertIn('not separately assessed', student)
        self.assertEqual(TEXT_GENERATION_VERSION, 'general-category-context-v4')

    def test_position_text_includes_bounded_role_context_once(self):
        position = self.position([self.score()])
        original = build_position_description(position)
        position.description = '  Review   booking records.  ' + 'context ' * 110 + 'excluded tail'
        updated = build_position_description(position)
        self.assertTrue(updated.startswith(original))
        self.assertEqual(updated.count('Review booking records.'), 1)
        self.assertNotIn('excluded tail', updated)

    def test_missing_and_zero_are_distinct_and_neither_expands_context_as_positive_evidence(self):
        zero = self.score(percentage=0)
        missing = self.score(percentage=None)
        zero_result, missing_result = generate_competency_insights([zero]), generate_competency_insights([missing])
        self.assertIn('No assessed category scored above zero', zero_result['orientation_summary'])
        self.assertEqual(zero_result['supporting_categories'][0]['percentage'], 0)
        self.assertEqual(missing_result['supporting_categories'], [])
        for text in [zero_result['competency_profile_text'], missing_result['competency_profile_text']]:
            self.assertNotIn('booking', text)
            self.assertNotIn('Saved vocabulary', text)
        zero.max_score = 0
        self.assertEqual(generate_competency_insights([zero])['supporting_categories'], [])

    def test_context_tags_never_change_scores_or_claim_subskill_mastery(self):
        row = self.score(percentage=60)
        before = deepcopy(vars(row))
        result = generate_competency_insights([row])
        self.assertIn('not individually assessed', result['development_suggestions'][0]['message'])
        self.assertEqual((row.raw_score, row.max_score, row.percentage), (before['raw_score'], before['max_score'], before['percentage']))
        self.assertEqual(row.skill_category.tags, before['skill_category'].tags)

    def test_nonfinite_or_missing_denominator_evidence_is_omitted_without_becoming_zero(self):
        for value in [float('nan'), float('inf'), -1, 101, False, 'bad']:
            self.assertEqual(generate_competency_insights([self.score(percentage=value)])['supporting_categories'], [])

    def test_long_description_tail_and_unrelated_category_do_not_change_assessed_profile(self):
        row = self.score()
        row.skill_category.description = ' '.join(['reviewed'] * 12) + ' First ignored tail'
        first = build_student_profile([row])
        row.skill_category.description = ' '.join(['reviewed'] * 12) + ' Different ignored tail'
        self.assertEqual(build_student_profile([row]), first)
        self.assertNotIn('unrelated', first)

    def test_every_exact_highest_tie_is_retained_and_zero_does_not_get_a_positive_orientation(self):
        rows = [self.score(f'Area {index}', 80) for index in range(5)]
        result = generate_competency_insights(rows)
        for index in range(5):
            self.assertIn(f'Area {index} (80%)', result['orientation_summary'])
        self.assertEqual(len(result['development_suggestions']), 5)


from rest_framework.test import APITestCase


class ScopedResultIsolationTests(APITestCase):
    def test_scoped_assessment_results_do_not_enter_legacy_ranking_or_fail_on_result_reads(self):
        from django.utils import timezone
        from .models import (User, Institute, Program, CompetencyFramework, SkillCategory, Batch, BatchEnrollment,
                             Assessment, StudentResponse, SkillScore, Recommendation)
        from .combined_competency import recalculate_combined
        owner = User.objects.create_user('general-owner@example.invalid', role='instructor', is_approved=True)
        student = User.objects.create_user('general-student@example.invalid', role='student', is_approved=True)
        institute = Institute.objects.create(code='ANY', name='Arbitrary Institute')
        program = Program.objects.create(institute=institute, code='ANY', name='Arbitrary Program')
        framework = CompetencyFramework.objects.create(program=program, version=1, name='Reviewed definitions')
        category = SkillCategory.objects.create(framework=framework, name='Saved category', description='Reviewed records concepts', tags=[])
        batch = Batch.objects.create(name='Arbitrary cohort', instructor=owner, institute=institute, program=program, framework=framework)
        BatchEnrollment.objects.create(student=student, batch=batch)
        assessment = Assessment.objects.create(title='Required assessment', created_by=owner, batch=batch, framework=framework)
        StudentResponse.objects.create(student=student, assessment=assessment, status='submitted', submitted_at=timezone.now())
        SkillScore.objects.create(student=student, assessment=assessment, skill_category=category, raw_score=4, max_score=5, percentage=80)
        profile, progress, recommendations = recalculate_combined(student, batch)
        self.assertTrue(profile.is_finalized)
        self.assertIn('Saved category', profile.competency_profile_text)
        self.assertEqual(recommendations, [])
        self.assertFalse(Recommendation.objects.exists())
        self.client.force_authenticate(student)
        self.assertEqual(self.client.get('/api/student/results/', {'assessment_id': assessment.id}).status_code, 200)
        self.assertEqual(self.client.get('/api/student/results/combined/').status_code, 200)
