"""Committed invalidations, shared by every worker through the existing database.

Explicit operation boundaries cover queryset/bulk writes as well as saves. No
model signals: an inner save/commit can precede scoring or import completion.
"""
import logging
from contextvars import ContextVar
from functools import wraps

from django.db import transaction
from django.db.models import Q

from .models import (
    Assessment, Batch, BatchEnrollment, ChangeEvent, OJTPlacement, Question,
    Recommendation, User,
)

logger = logging.getLogger(__name__)
_operation = ContextVar('change_operation', default=False)
_taxonomy_created = ContextVar('change_taxonomy_created', default=None)


def category_created(created):
    marker = _taxonomy_created.get()
    if created and marker is not None:
        marker.add('taxonomy')

TOPICS = {
    'student': ['students', 'results', 'placements', 'management'],
    'batch': ['batches', 'students', 'assessments', 'results', 'placements', 'management'],
    'assessment': ['assessments', 'students', 'results', 'placements', 'taxonomy', 'management'],
    'question': ['assessments', 'taxonomy', 'management'],
    'attempt': ['assessments', 'students', 'results', 'placements', 'management'],
    'catalog': ['catalog', 'results', 'students', 'placements'],
    'taxonomy': ['taxonomy', 'catalog', 'assessments', 'results', 'students', 'placements'],
    'configuration': ['configuration', 'results', 'students', 'placements'],
    'recommendations': ['results', 'students', 'placements'],
    'placement': ['placements', 'students', 'results', 'capacity'],
    'users': ['users', 'students', 'batches'],
    'identity': ['users', 'students', 'batches', 'placements'],
}


def _id(value):
    try:
        return int(value) if int(value) > 0 else None
    except (TypeError, ValueError):
        return None


def audience(kind, request, kwargs, response=None):
    """Capture both sides of removal/reassignment. IDs never cross role scope."""
    data = request.data if isinstance(request.data, dict) else {}
    body = getattr(response, 'data', None) or {}
    if not isinstance(body, dict):
        body = {}
    students, batches, people = set(), set(), set()
    student_id = _id(kwargs.get('student_id') or (data.get('student_id') if kind == 'placement' else None))
    if student_id:
        students.add(student_id)
    batch_id = _id(kwargs.get('batch_id') or (data.get('batch_id') if kind in ('assessment', 'placement') else None))
    if batch_id:
        batches.add(batch_id)
    if kind == 'batch' and response and not kwargs.get('batch_id'):
        batch_id = _id(body.get('id'))
        if batch_id:
            batches.add(batch_id)
    assessment_id = _id(kwargs.get('assessment_id') or (data.get('assessment_id') if kind == 'attempt' else None))
    assessment = None
    if kind == 'assessment' and response and not assessment_id:
        assessment_id = _id(body.get('id'))
    if kwargs.get('question_id'):
        assessment_id = Question.objects.filter(pk=kwargs['question_id']).values_list('assessment_id', flat=True).first()
    if assessment_id:
        assessment = Assessment.objects.filter(pk=assessment_id).values('batch_id', 'created_by_id').first()
        if assessment:
            if assessment['batch_id']:
                batches.add(assessment['batch_id'])
            else:
                people.add(assessment['created_by_id'])
    if kind in ('student', 'attempt') and request.user.is_authenticated:
        if request.user.role == 'student':
            students.add(request.user.id)
    if kind == 'placement':
        for model, field in ((Recommendation, 'recommendation_id'), (OJTPlacement, 'placement_id')):
            record_id = _id(data.get(field))
            if record_id:
                row = model.objects.filter(pk=record_id).values('student_id', 'batch_id').first()
                if row:
                    students.add(row['student_id'])
                    if row['batch_id']:
                        batches.add(row['batch_id'])
    if kind in ('users', 'identity'):
        person_id = _id(kwargs.get('user_id') or body.get('id') or body.get('user', {}).get('id'))
        if person_id:
            people.add(person_id)
            students.update(User.objects.filter(pk=person_id, role='student').values_list('id', flat=True))
            batches.update(Batch.objects.filter(instructor_id=person_id).values_list('id', flat=True))
    # A student's change can affect each instructor who is authorized to see it.
    batches.update(BatchEnrollment.objects.filter(student_id__in=students).values_list('batch_id', flat=True))
    # Only batch-wide changes invalidate other students' private result views.
    if kind in ('batch', 'assessment', 'question'):
        students.update(BatchEnrollment.objects.filter(batch_id__in=batches).values_list('student_id', flat=True))
    batch_owners = dict(Batch.objects.filter(pk__in=batches).values_list('id', 'instructor_id'))
    owners = set(batch_owners.values())
    admins = set(User.objects.filter(role='admin', is_active=True).values_list('id', flat=True))
    recipients = admins | owners | students | people
    if kind in ('catalog', 'taxonomy', 'recommendations', 'configuration'):
        recipients.update(User.objects.filter(is_active=True, role__in=['admin', 'instructor']).values_list('id', flat=True))
        recipients.update(BatchEnrollment.objects.filter(student__is_active=True, student__is_approved=True).values_list('student_id', flat=True))
    if kind == 'placement':
        # All staff can see shared capacity; unrelated staff get only that topic.
        recipients.update(User.objects.filter(is_active=True, role__in=['admin', 'instructor']).values_list('id', flat=True))
    # Resolve membership once for an import/rerun, not once per recipient.
    student_batches, owner_students, owner_batches = {}, {}, {}
    for batch_id, owner_id in batch_owners.items():
        owner_batches.setdefault(owner_id, set()).add(batch_id)
    for student_id, batch_id, owner_id in BatchEnrollment.objects.filter(
        Q(student_id__in=students) | Q(batch_id__in=batches),
    ).values_list('student_id', 'batch_id', 'batch__instructor_id'):
        student_batches.setdefault(student_id, set()).add(batch_id)
        owner_students.setdefault(owner_id, set()).add(student_id)
    result = {}
    assessment_staff = ({assessment['created_by_id']} if assessment and not assessment['batch_id']
                        else {batch_owners.get(assessment['batch_id'])} if assessment else set())
    for person in User.objects.filter(pk__in=recipients, is_active=True):
        topics = TOPICS[kind]
        own_batches = set(batches)
        own_students = set(students)
        if person.role == 'student':
            own_students &= {person.id}
            own_batches &= student_batches.get(person.id, set())
        elif person.role == 'instructor':
            own_batches &= owner_batches.get(person.id, set())
            own_students &= owner_students.get(person.id, set())
            if kind == 'placement' and person.id not in owners:
                topics = ['capacity']
        result[person.id] = {
            'topics': list(topics),
            # Draft IDs must not be disclosed to student subscribers.
            **({'assessment_ids': [assessment_id]} if assessment_id and (
                person.role == 'admin' or person.role == 'instructor' and person.id in assessment_staff
            ) else {}),
            # Omit large ID sets: topic-wide invalidation is the safe fallback.
            **({'batch_ids': sorted(own_batches)} if 0 < len(own_batches) <= 100 else {}),
            **({'student_ids': sorted(own_students)} if 0 < len(own_students) <= 100 else {}),
        }
    return result


def publish_changes(recipients):
    """Delivery failure cannot turn a committed operation into an API failure.

    Clients resync on every connection and revalidate visible queries every 30s.
    That is also recovery for a process dying between commit and this callback.
    """
    try:
        ChangeEvent.objects.bulk_create([
            ChangeEvent(recipient_id=user_id, payload=payload)
            for user_id, payload in recipients.items()
        ], batch_size=500)
    except Exception:
        logger.exception('Change notification publication failed; clients will revalidate')


def _safe_audience(*args):
    try:
        return audience(*args)
    except Exception as exc:
        logger.error('Change scope lookup failed type=%s; clients will revalidate', type(exc).__name__)
        return {}


def notify_changes(kind):
    def decorate(view):
        @wraps(view)
        def wrapped(request, *args, **kwargs):
            if request.method in ('GET', 'HEAD', 'OPTIONS'):
                return view(request, *args, **kwargs)
            # Parse errors belong to DRF's 400 path. Do not swallow them inside
            # audience recovery, where Request resets its parsed data to {}.
            _ = request.data
            before = _safe_audience(kind, request, kwargs)
            marker = _operation.set(True)
            extra = set()
            taxonomy_marker = _taxonomy_created.set(extra)
            try:
                response = view(request, *args, **kwargs)
            finally:
                _operation.reset(marker)
                _taxonomy_created.reset(taxonomy_marker)
            if 200 <= response.status_code < 300 and not getattr(response, 'skip_change_event', False):
                after = _safe_audience(kind, request, kwargs, response)
                for user_id, old in before.items():
                    current = after.setdefault(user_id, old)
                    for field in ('topics', 'batch_ids', 'student_ids', 'assessment_ids'):
                        if field in old or field in current:
                            current[field] = sorted(set(old.get(field, [])) | set(current.get(field, [])))
                if extra:
                    for user_id in _safe_audience('taxonomy', request, {}):
                        current = after.setdefault(user_id, {'topics': []})
                        current['topics'] = sorted(set(current['topics']) | set(TOPICS['taxonomy']))
                        # New shared categories affect any authorized preview.
                        current.pop('student_ids', None)
                        current.pop('batch_ids', None)
                transaction.on_commit(lambda: publish_changes(after), robust=True)
            return response
        return wrapped
    return decorate


def combined_changed(student, batch):
    """Legacy GET backfill/helper calls also publish, after full recalculation.

    Endpoint operations publish once at their outer boundary instead, including
    bulk reruns. This hook never changes the recommendation algorithm.
    """
    if _operation.get():
        return
    from types import SimpleNamespace
    request = SimpleNamespace(data={}, user=student)
    recipients = _safe_audience('student', request, {'student_id': student.id, 'batch_id': batch.id})
    transaction.on_commit(lambda: publish_changes(recipients), robust=True)
