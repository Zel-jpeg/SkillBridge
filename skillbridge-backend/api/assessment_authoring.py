"""Plan and apply a complete authoring save under its assessment row lock."""
from functools import cache

from django.db.models import Max, Prefetch
from rest_framework.exceptions import APIException, ValidationError
from .change_events import category_created
from .models import AnswerChoice, Question, SkillCategory, StudentResponse
from .request_validation import parse_question_fields
from .authoring_scope import category_fields


class AuthoringConflict(APIException):
    status_code = 409
    default_detail = {'error': 'Question changes are locked after an attempt exists.'}


def question_state(question):
    choices = [{'text': choice.choice_text, 'is_correct': choice.is_correct} for choice in question.choices.all()]
    return {'question_text': question.question_text, 'question_type': question.question_type,
            **({'category_id': question.skill_category_id} if question.assessment.framework_id else {}),
            'category': question.skill_category.name if question.skill_category else '', 'choices': choices,
            'correct_answer': next((choice['text'] for choice in choices if choice['is_correct']), '')}


def authoring_questions(assessment):
    return [{'id': question.id, 'question_text': question.question_text, 'question_type': question.question_type,
             'question_order': question.question_order,
             'category': {'id': question.skill_category_id, 'name': question.skill_category.name} if question.skill_category_id else None,
             'choices': [{'id': choice.id, 'text': choice.choice_text, 'is_correct': choice.is_correct} for choice in question.choices.all()]}
            for question in assessment.questions.select_related('skill_category').prefetch_related('choices').order_by('question_order', 'id')]


def missing_category_error(categories):
    missing = [number for number, category in enumerate(categories, 1) if not (category or '').strip()]
    if not missing:
        return None
    if len(missing) == 1:
        return f'Question {missing[0]} is missing a skill category.'
    numbers = ', '.join(str(number) for number in missing[:8])
    if len(missing) > 8:
        numbers += f' and {len(missing) - 8} more'
    return f'{len(missing)} questions are missing a skill category: {numbers}.'


def prepare_changes(assessment, changes, category_name, question_error):
    def invalid(message):
        raise ValidationError({'error': message, 'field': 'questions'})
    if not isinstance(changes, dict) or set(changes) - {'delete_ids', 'update', 'add'}:
        invalid('question_changes must contain delete_ids, update and/or add lists.')
    deletes, updates, additions = (changes.get(key, []) for key in ('delete_ids', 'update', 'add'))
    if not all(isinstance(value, list) for value in [deletes, updates, additions]):
        invalid('Question changes must be lists.')
    current = {question.id: question for question in assessment.questions.select_related('skill_category')
               .prefetch_related(Prefetch('choices', queryset=AnswerChoice.objects.order_by('id')))
               .order_by('question_order', 'id')}
    framework = assessment.framework
    category_cache = {category.id: category for category in framework.categories.all()} if framework else None
    validate_name = cache(category_name)
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
            # A newly selected ID need not repeat its saved label. Omitted category
            # fields retain the original identity during partial question edits.
            merged = {**state, **fields}
            if 'category_id' in fields and 'category' not in fields:
                merged['category'] = ''
            category_fields(merged, framework, validate_name, category_cache=category_cache)
            planned.append((current[pk], merged))
        for row in additions:
            fields = parse_question_fields(row)
            category_fields(fields, framework, validate_name, category_cache=category_cache)
            planned.append((None, fields))
    except ValueError as exc:
        invalid(str(exc))
    if (deletes or updates or additions) and StudentResponse.objects.filter(assessment=assessment).exists():
        raise AuthoringConflict()
    updated = {question.id: fields for question, fields in planned if question is not None}
    final = []
    for pk, question in current.items():
        if pk in deletes:
            continue
        if pk in updated:
            final.append(updated[pk])
        else:
            final.append(category_fields(question_state(question), framework, validate_name, category_cache=category_cache))
    final.extend(fields for question, fields in planned if question is None)
    if assessment.publication_status == 'published':
        if not final: invalid('Add at least one question before publishing.')
        if error := missing_category_error(row['category'] for row in final):
            invalid(error)
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
        if assessment.framework_id:
            category = fields.get('_category')
        elif fields['category']:
            category, created = SkillCategory.objects.filter(framework__isnull=True).get_or_create(name__iexact=fields['category'],
                defaults={'name': fields['category'], 'created_by': user})
            category_created(created)
        choices = ([{'text': fields['correct_answer'], 'is_correct': True}] if fields['correct_answer'] else []) if fields['question_type'] == 'identification' else fields['choices']
        desired_choices = [(choice['text'].strip(), choice['is_correct']) for choice in choices if choice['text'].strip()]
        if question is None:
            order += 1
            question = Question(assessment=assessment, question_order=order)
            saved_choices = []
        else:
            saved_choices = [(choice.choice_text, choice.is_correct) for choice in question.choices.all()]
        question.question_text, question.question_type, question.skill_category = fields['question_text'], fields['question_type'], category
        question.save()
        if saved_choices != desired_choices:
            if saved_choices:
                question.choices.all().delete()
            for text, correct in desired_choices:
                AnswerChoice.objects.create(question=question, choice_text=text, is_correct=correct)
