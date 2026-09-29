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
        parsed.append({**choice, 'is_correct': parse_boolean(
            choice.get('is_correct', False), f'{field}.{index}.is_correct',
        )})
    return parsed
