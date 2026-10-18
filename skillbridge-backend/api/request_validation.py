"""Strict parsing for assessment-management request fields."""


def parse_boolean(value, field):
    if type(value) is bool:
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized == 'true':
            return True
        if normalized == 'false':
            return False
    raise ValueError(f'{field} must be true or false.')


def parse_choice_flags(choices, field='choices'):
    if not isinstance(choices, list):
        raise ValueError(f'{field} must be a list of choices.')
    parsed = []
    for index, choice in enumerate(choices):
        if not isinstance(choice, dict):
            raise ValueError(f'{field}.{index} must be a choice object.')
        if not isinstance(choice.get('text', ''), str):
            raise ValueError(f'{field}.{index}.text must be text.')
        parsed.append({**choice, 'is_correct': parse_boolean(
            choice.get('is_correct', False), f'{field}.{index}.is_correct',
        )})
    return parsed


def parse_question_fields(data, *, partial=False):
    if not isinstance(data, dict):
        raise ValueError('Each question must be an object.')
    result = dict(data)
    for field in ('question_text', 'category', 'correct_answer'):
        if not partial or field in result:
            if not isinstance(result.get(field, ''), str):
                raise ValueError(f'{field} must be text.')
            result[field] = result.get(field, '').strip()
    if not partial or 'question_type' in result:
        kind = result.get('question_type', 'mcq')
        if not isinstance(kind, str) or kind.lower() not in ('mcq', 'truefalse', 'identification'):
            raise ValueError('question_type must be mcq, truefalse or identification.')
        result['question_type'] = kind.lower()
    if not partial or 'choices' in result:
        result['choices'] = parse_choice_flags(result.get('choices', []))
    return result
