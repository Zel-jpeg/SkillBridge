"""Read filters for full institute-shared batches; not placement eligibility."""
from django.db.models import Q
from .models import Program


def batch_visibility_q(institute_id=None, program_id=None, prefix=''):
    """Apply inside the caller's authorized queryset; shared rosters stay intact."""
    scope = Q(**{f'{prefix}institute_id': int(institute_id)}) if institute_id else Q()
    if not program_id:
        return scope
    parent = Program.objects.filter(pk=program_id).values_list('institute_id', flat=True).first()
    if parent is None or (institute_id and int(institute_id) != parent):
        return Q(**{f'{prefix}pk__in': []})
    return scope & (Q(**{f'{prefix}program_id': int(program_id)}) |
                    Q(**{f'{prefix}program__isnull': True, f'{prefix}institute_id': parent}))
