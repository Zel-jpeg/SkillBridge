"""Current program authority and label matching, without view dependencies."""
import unicodedata

from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied, ValidationError

from .models import Institute, InstructorAssignment, Program


def label_key(value):
    return ''.join(c for c in unicodedata.normalize('NFKC', str(value)).casefold() if c.isalnum())


def matches_program(value, program):
    return bool(label_key(value)) and label_key(value) in {
        label_key(v) for v in [program.code, program.name, *program.aliases]}


def assigned_program_ids(user):
    return InstructorAssignment.objects.filter(instructor=user, is_active=True,
        instructor__is_active=True, instructor__is_approved=True).values('program_id')


def active_program(user, value, *, lock=False):
    if type(value) is not int or value <= 0:
        raise ValidationError({'error': 'Choose a program.', 'field': 'program_id'})
    # Catalog/grant mutations lock this same parent, so a confirmed operation
    # cannot race an archive, rename, alias change or grant revocation.
    if lock:
        parent = get_object_or_404(Program.objects.only('institute_id'), pk=value)
        get_object_or_404(Institute.objects.select_for_update(), pk=parent.institute_id)
    rows = Program.objects.select_related('institute').filter(is_active=True, institute__is_active=True)
    if user.role != 'admin':
        rows = rows.filter(pk__in=assigned_program_ids(user)) if user.role == 'instructor' else rows.none()
    return get_object_or_404(rows, pk=value)


def require_owner_assignment(owner, program):
    if not InstructorAssignment.objects.filter(instructor=owner, program=program,
            is_active=True, instructor__is_active=True, instructor__is_approved=True).exists():
        raise ValidationError({'error': 'Choose an instructor assigned to this program.', 'field': 'instructor_id'})


def enrollment_context(batch, actor, *, lock=False):
    if batch.program_id:
        program = active_program(actor, batch.program_id, lock=lock)
        if program.institute_id != batch.institute_id:
            raise PermissionDenied('Batch program context needs administrator review.')
        require_owner_assignment(batch.instructor, program)
        batch.program = program
