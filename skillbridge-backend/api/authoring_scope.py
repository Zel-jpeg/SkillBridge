"""Framework identity for staff authoring. Call mutations within a transaction."""
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from .competencies import context, current_framework, DefinitionChanged, writable_program, framework_payload
from .models import Assessment, Batch, CompetencyFramework, SkillCategory, User, InstructorAssignment

UNSET = object()


def fail(message):
    raise ValidationError({'error': message, 'field': 'framework_id'})


def resolve_framework(user, batch, value=UNSET, *, existing=None, creating=False):
    original = existing.framework_id if existing else None
    if value is not UNSET and value is not None and (type(value) is not int or value <= 0):
        fail('Choose a valid saved framework version.')
    if existing and value is not UNSET and value != original:
        raise DefinitionChanged({'error': 'An assessment keeps its original framework. Create a new assessment to use another version.'})
    chosen = original if existing else (None if value is UNSET else value)
    if batch and batch.program_id:
        if chosen is None and not existing:
            chosen = batch.framework_id
        if not chosen:
            fail('Choose a reviewed framework for this program before authoring an assessment.')
        if batch.framework_id and batch.framework_id != chosen:
            fail('This batch uses a different framework version. Choose its recorded version.')
    elif batch and chosen:
        fail('A program framework cannot be assigned to an unmapped legacy batch.')
    if chosen is None:
        return None
    parent = get_object_or_404(CompetencyFramework.objects.only('program_id'), pk=chosen)
    program = context(user, parent.program_id, lock=True)
    framework = current_framework(user, program, chosen, lock=True)
    if batch and (batch.program_id != program.id or batch.institute_id != program.institute_id):
        fail('Choose a framework belonging to this batch’s program.')
    if creating or batch and existing and existing.batch_id is None:
        writable_program(program)
        if batch:
            from .program_scope import require_owner_assignment
            require_owner_assignment(batch.instructor, program)
        if not framework.is_active:
            fail('Choose an active framework version for a new assessment or assignment.')
        if not framework.categories.exists():
            fail('Define and review at least one category before using this framework for an assessment.')
        if batch and batch.status != 'active':
            fail('Choose an active batch.')
    # Do not implicitly convert old assessments/categories when binding a batch.
    if batch and not batch.framework_id and Assessment.objects.filter(batch=batch).exclude(
            framework_id=chosen).exists():
        fail('Existing batch assessments need reviewed framework mapping before this version can be bound.')
    return framework


def bind_batch(batch, framework):
    if framework and not framework.locked_at:
        framework.locked_at = timezone.now()
        framework.save(update_fields=['locked_at'])
        from .change_events import publish_changes
        recipients = list(User.objects.filter(is_active=True).filter(Q(role='admin') | Q(
            pk__in=InstructorAssignment.objects.filter(program_id=framework.program_id, is_active=True,
                instructor__is_approved=True).values('instructor_id'))).values_list('pk', flat=True))
        program_id = framework.program_id
        transaction.on_commit(lambda recipients=recipients: publish_changes({pk: {'topics': ['competencies'], 'program_ids': [program_id]} for pk in recipients}))
    if batch and framework and not batch.framework_id:
        # Lifecycle allocation lock serializes authoring/batch operations. The
        # institute/framework locks also serialize catalog edits and grant changes.
        Batch.objects.filter(pk=batch.pk, framework__isnull=True).update(framework=framework)
        batch.framework = framework
        from .change_events import publish_changes
        recipients = list(User.objects.filter(is_active=True).filter(Q(role='admin') | Q(pk=batch.instructor_id)).values_list('pk', flat=True))
        batch_id = batch.pk
        transaction.on_commit(lambda recipients=recipients: publish_changes({pk: {'topics': ['batches'], 'batch_ids': [batch_id]} for pk in recipients}))


def category_fields(fields, framework, legacy_name):
    """Canonicalize identity without creating a category or trusting its label."""
    if framework is None:
        if fields.get('category_id') is not None:
            fail('Scoped category IDs require a program framework.')
        fields['category'] = legacy_name(fields.get('category', ''))
        return fields
    value = fields.get('category_id')
    if value is None:
        if fields.get('category', ''):
            fail('Choose a category ID from the selected framework; names alone cannot assign it.')
        fields['category'] = ''
        fields['_category'] = None
        return fields
    if type(value) is not int or value <= 0:
        fail('Choose a valid category ID from this framework.')
    category = get_object_or_404(SkillCategory.objects.filter(framework=framework), pk=value)
    if fields.get('category') and fields['category'] != category.name:
        fail('The category name and ID disagree. Reload the saved definition.')
    fields.update(category_id=category.id, category=category.name, _category=category)
    return fields


def stored_scope_error(assessment):
    framework_id = assessment.framework_id
    if assessment.batch_id:
        batch = assessment.batch
        if batch.program_id and (not framework_id or batch.framework_id not in (None, framework_id) or
                assessment.framework.program_id != batch.program_id):
            return 'The batch and assessment must use the same reviewed program framework.'
        if not batch.program_id and framework_id:
            return 'This legacy batch has no reviewed program framework.'
    if assessment.questions.filter(skill_category__isnull=False).exclude(
            skill_category__framework_id=framework_id).exists():
        return 'A question category is outside the assessment framework. Review category mapping before publication.'
    return None


def metadata(assessment):
    framework = assessment.framework
    return {'framework_id': assessment.framework_id,
            'program_id': framework.program_id if framework else (assessment.batch.program_id if assessment.batch_id else None),
            'framework_name': framework.name if framework else None,
            'framework_version': framework.version if framework else None}


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def authoring_catalog(request, program_id, framework_id):
    program = context(request.user, program_id)
    framework = current_framework(request.user, program, framework_id)
    return Response({'framework': framework_payload(framework, request.user),
                     'categories': [{'id': category.id, 'framework_id': framework.id, 'name': category.name,
                                     'description': category.description, 'tags': category.tags}
                                    for category in framework.categories.all().order_by('name', 'id')]})
