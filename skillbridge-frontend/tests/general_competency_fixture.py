"""Synthetic graded program evidence for local F08 browser checks only."""
def seed(out, identities, owner, *, scoped_openings=False):
    import json
    from django.utils import timezone
    from rest_framework_simplejwt.tokens import AccessToken
    from api.models import (User, Institute, Program, InstructorAssignment, CompetencyFramework, SkillCategory,
        Batch, BatchEnrollment, Assessment, Question, AnswerChoice, StudentResponse, Company, Position, PositionRequirement)
    from api.scoring import score_submission, update_assessment_profile
    scenarios = []
    names = [('Enterprise example', ['Enterprise planning', 'Market analysis']),
             ('Tourism example', ['Visitor records', 'Service communication']),
             ('Arbitrary third program', ['Observation records', 'Experimental analysis'])]
    company = Company.objects.create(name='Synthetic cross-program partner')
    for index, (name, categories) in enumerate(names):
        institute = Institute.objects.create(code=f'TEXT{index}', name=f'Synthetic Text Institute {index}')
        program = Program.objects.create(institute=institute, code=f'ANY{index}', name=name)
        InstructorAssignment.objects.create(instructor=owner, program=program)
        framework = CompetencyFramework.objects.create(program=program, version=1, name='Reviewed synthetic framework', locked_at=timezone.now())
        batch = Batch.objects.create(name=f'{name} cohort', instructor=owner, institute=institute, program=program, framework=framework)
        student = User.objects.create_user(f'text-{index}@example.invalid', role='student', name=f'Synthetic Text Learner {index}',
            is_approved=True, phone='09000000000', school_id=f'SYN-TEXT-{index}', course=program.code, program=program)
        key = f'student_text_{index}'
        identities[key] = {'token': str(AccessToken.for_user(student)), 'user': {'id': student.pk, 'role': 'student',
            'name': student.name, 'is_approved': True, 'phone': student.phone}}
        BatchEnrollment.objects.create(batch=batch, student=student)
        assessment = Assessment.objects.create(title=f'{name} knowledge assessment', batch=batch, framework=framework, created_by=owner,
            publication_status='published', duration_minutes=30)
        position = Position.objects.create(title=f'Synthetic {name} opportunity', company=company, tags=['Reviewed role vocabulary'],
                                           eligibility_configured_at=timezone.now() if scoped_openings else None)
        if scoped_openings:
            position.eligible_programs.add(program)
        answers = []
        for category_index, category_name in enumerate(categories):
            category = SkillCategory.objects.create(framework=framework, name=category_name,
                description=f'Explains reviewed concepts and records in {category_name.lower()}.', tags=[f'{category_name} topic'])
            PositionRequirement.objects.create(position=position, skill_category=category, required_percentage=80)
            for question_index in range(5):
                question = Question.objects.create(assessment=assessment, skill_category=category, question_order=category_index * 5 + question_index + 1,
                    question_text=f'Synthetic {category_name} question {question_index + 1}?')
                correct = AnswerChoice.objects.create(question=question, choice_text='Reviewed answer', is_correct=True)
                wrong = AnswerChoice.objects.create(question=question, choice_text='Other answer', is_correct=False)
                answers.append({'question_id': question.pk, 'selected_choice_id': (correct if index < 2 and question_index < 4 else wrong).pk})
        response = StudentResponse.objects.create(student=student, assessment=assessment, status='submitted', submitted_at=timezone.now())
        score_submission(response, answers, [])
        update_assessment_profile(student, assessment)
        scenarios.append({'auth': key, 'student_id': student.pk, 'assessment_id': assessment.pk, 'batch_id': batch.pk,
                          'position_id': position.pk, 'categories': categories, 'percentage': 80 if index < 2 else 0})
    (out / 'general-text.json').write_text(json.dumps(scenarios), encoding='utf-8')
