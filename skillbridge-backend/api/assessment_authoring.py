"""Plan and apply a complete authoring save under its assessment row lock."""
from django.db.models import Max
from rest_framework.exceptions import APIException, ValidationError
from .change_events import category_created
from .models import AnswerChoice, Question, SkillCategory, StudentResponse
from .request_validation import parse_question_fields


class AuthoringConflict(APIException):
    status_code = 409
    default_detail = {'error': 'Question changes are locked after an attempt exists.'}


def question_state(question):
    choices = [{'text': choice.choice_text, 'is_correct': choice.is_correct} for choice in question.choices.all()]
    return {'question_text': question.question_text, 'question_type': question.question_type,
            'category': question.skill_category.name if question.skill_category else '', 'choices': choices,
            'correct_answer': next((choice['text'] for choice in choices if choice['is_correct']), '')}


def authoring_questions(assessment):
    return [{'id': question.id, 'question_text': question.question_text, 'question_type': question.question_type,
             'question_order': question.question_order,
             'category': {'id': question.skill_category_id, 'name': question.skill_category.name} if question.skill_category_id else None,
             'choices': [{'id': choice.id, 'text': choice.choice_text, 'is_correct': choice.is_correct} for choice in question.choices.all()]}
            for question in assessment.questions.select_related('skill_category').prefetch_related('choices').order_by('question_order', 'id')]


def prepare_changes(assessment, changes, category_name, question_error):
    def invalid(message):
        raise ValidationError({'error': message, 'field': 'questions'})
    if not isinstance(changes, dict) or set(changes) - {'delete_ids', 'update', 'add'}:
        invalid('question_changes must contain delete_ids, update and/or add lists.')
    deletes, updates, additions = (changes.get(key, []) for key in ('delete_ids', 'update', 'add'))
    if not all(isinstance(value, list) for value in [deletes, updates, additions]):
        invalid('Question changes must be lists.')
    current = {question.id: question for question in assessment.questions.select_related('skill_category').prefetch_related('choices')}
    if any(type(pk) is not int or pk not in current for pk in deletes) or len(deletes) != len(set(deletes)):
        invalid('Deleted question IDs must be unique and belong to this assessment.')
    planned, seen = [], set()
    try:
        for row in updates:
            if not isinstance(row, dict): invalid('Each updated question must be an object.')
            pk = row.get('id')
            if type(pk) is not int or pk not in current or pk in seen or pk in deletes:
                invalid('Updated question IDs must be unique, belong to this assessment and not also be deleted.')
            seen.add(pk)
            state = question_state(current[pk])
            fields = parse_question_fields({key: value for key, value in row.items() if key != 'id'}, partial=True)
            fields['category'] = category_name(fields.get('category', state['category']))
            planned.append((current[pk], {**state, **fields}))
        for row in additions:
            fields = parse_question_fields(row)
            fields['category'] = category_name(fields['category'])
            planned.append((None, fields))
    except ValueError as exc:
        invalid(str(exc))
    if (deletes or updates or additions) and StudentResponse.objects.filter(assessment=assessment).exists():
        raise AuthoringConflict()
    final = [question_state(question) for pk, question in current.items() if pk not in deletes and pk not in seen]
    final.extend(fields for _, fields in planned)
    if assessment.publication_status == 'published':
        if not final: invalid('Add at least one question before publishing.')
        for row in final:
            error = question_error(row)
            if error: invalid(error)
    return deletes, planned


def apply_changes(assessment, plan, user):
    deletes, planned = plan
    assessment.questions.filter(pk__in=deletes).delete()
    order = assessment.questions.aggregate(last=Max('question_order'))['last'] or 0
    for question, fields in planned:
        category = None
        if fields['category']:
            category, created = SkillCategory.objects.get_or_create(name__iexact=fields['category'],
                defaults={'name': fields['category'], 'created_by': user})
            category_created(created)
        if question is None:
            order += 1
            question = Question(assessment=assessment, question_order=order)
        question.question_text, question.question_type, question.skill_category = fields['question_text'], fields['question_type'], category
        question.save()
        question.choices.all().delete()
        choices = ([{'text': fields['correct_answer'], 'is_correct': True}] if fields['correct_answer'] else []) if question.question_type == 'identification' else fields['choices']
        for choice in choices:
            if choice['text'].strip():
                AnswerChoice.objects.create(question=question, choice_text=choice['text'].strip(), is_correct=choice['is_correct'])
