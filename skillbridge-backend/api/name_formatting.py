"""Shared display-name formatting for student identity workflows."""


def format_person_name(value):
    """Capitalize words separated by spaces without title-casing hyphen parts."""
    return ' '.join(part[:1].upper() + part[1:].lower() for part in str(value).split())
