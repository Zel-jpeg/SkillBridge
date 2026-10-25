"""Shared provisional allocation. Reads never generate rankings or approvals."""
from collections import Counter
from functools import wraps
import hashlib
import json

from django.core import signing
from types import SimpleNamespace

from django.db import connection, transaction
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .change_events import notify_changes
from .combined_competency import combined_is_unlocked
from .models import BatchEnrollment, ManagementAction, OJTPlacement, Position, Recommendation
from .placement_allocator import allocate
from .recommendation_freshness import catalog_fingerprint


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, default=str).encode()).hexdigest()


STATE_ACTION = 'placement.suggestions.update'


def active_suggestions():
    return OJTPlacement.objects.filter(is_active_suggestion=True, status='suggested')


def read_state():
    entry = ManagementAction.objects.filter(action=STATE_ACTION, target_type='placement_allocation', target_id=1).first()
    metadata = entry.metadata if entry else {}
    choices = metadata.get('manual_choices')
    if choices is None:
        # Preserve choices made with the preceding version as well. Its audit
        # snapshots record changed student/recommendation pairs, without a flag.
        choices = {}
        current = {row['student_id']: row['recommendation_id'] for row in metadata.get('proposals', [])}
        if entry:
            history = list(ManagementAction.objects.filter(action=STATE_ACTION, id__lte=entry.id)
                           .order_by('-id').values_list('metadata', flat=True))
            for index, item in enumerate(history):
                if item.get('operation') == 'update':
                    break
                if item.get('operation') != 'choose':
                    continue
                previous = {row['student_id']: row['recommendation_id'] for row in history[index + 1].get('proposals', [])} if index + 1 < len(history) else {}
                for row in item.get('proposals', []):
                    sid, rid = row['student_id'], row['recommendation_id']
                    if previous.get(sid) != rid and current.get(sid) == rid:
                        rec = Recommendation.objects.filter(pk=rid, student_id=sid).first()
                        if rec:
                            choices.setdefault(str(sid), {'position_id': rec.position_id, 'batch_id': rec.batch_id})
    return SimpleNamespace(revision=metadata.get('revision', 0), input_signature=metadata.get('input_signature', ''),
                           updated_at=entry.created_at if entry else None,
                           manual_choices=choices, needs_choice_upgrade=bool(entry and 'manual_choices' not in metadata))


def lock_state():
    # A transaction-scoped PostgreSQL lock needs no new state/lock table. All
    # allocation and placement writes acquire it before student/position locks.
    # SQLite is only used for serial disposable tests, never production races.
    if connection.vendor == 'postgresql':
        with connection.cursor() as cursor:
            cursor.execute('SELECT pg_advisory_xact_lock(%s, %s)', [21314, 1])
    return read_state()


def context():
    catalog = catalog_fingerprint()
    enrollments = BatchEnrollment.objects.filter(
        batch__status='active', student__is_active=True, student__is_approved=True,
    ).select_related('student', 'batch').order_by('student_id', '-enrolled_at', '-id')
    by_student = {}
    for enrollment in enrollments:
        by_student.setdefault(enrollment.student_id, enrollment)
    approvals = list(OJTPlacement.objects.filter(status='approved').order_by('id').values('id', 'student_id', 'position_id'))
    approved_students = {row['student_id'] for row in approvals}
    occupancy = Counter(row['position_id'] for row in approvals)
    positions = list(Position.objects.order_by('id').values('id', 'slots_available'))
    capacities = {row['id']: max(0, row['slots_available'] - occupancy[row['id']]) for row in positions}
    eligible = {}
    for student_id, enrollment in by_student.items():
        if student_id not in approved_students and combined_is_unlocked(enrollment.student, enrollment.batch, catalog=catalog):
            eligible[student_id] = enrollment
    latest = {}
    for row in OJTPlacement.objects.filter(student_id__in=eligible, is_active_suggestion=False).order_by('-updated_at', '-id').values('student_id', 'position_id', 'status'):
        latest.setdefault((row['student_id'], row['position_id']), row['status'])
    recommendations = []
    for row in Recommendation.objects.filter(student_id__in=eligible, is_current=True).order_by('student_id', '-match_score', 'position_id').values(
        'id', 'student_id', 'batch_id', 'position_id', 'match_score', 'generated_at',
    ):
        if row['batch_id'] == eligible[row['student_id']].batch_id and latest.get((row['student_id'], row['position_id'])) not in ('removed', 'rejected'):
            recommendations.append(row)
    signature = digest({'catalog': catalog, 'positions': positions, 'approvals': approvals,
                        'memberships': [(key, value.batch_id) for key, value in by_student.items()],
                        'eligible': sorted(eligible), 'recommendations': recommendations, 'decisions': sorted(latest.items())})
    return {'signature': signature, 'recommendations': recommendations, 'capacities': capacities,
            'enrollments': by_student, 'eligible': eligible, 'approved_students': approved_students,
            'declined_students': {sid for (sid, _), status in latest.items() if status == 'rejected'}}


def scoped_ids(user, ctx):
    return {key for key, enrollment in ctx['enrollments'].items()
            if user.role == 'admin' or enrollment.batch.instructor_id == user.id}


def mapping():
    return {row.student_id: row for row in active_suggestions().filter(recommendation__isnull=False)
            .select_related('recommendation').order_by('student_id')}


def coordinator_choices(ctx, state):
    remaining = dict(ctx['capacities'])
    available = {(row['student_id'], row['batch_id'], row['position_id']): row for row in ctx['recommendations']}
    fixed, review = {}, set()
    for key, choice in sorted(state.manual_choices.items(), key=lambda item: int(item[0])):
        sid = int(key)
        if sid in ctx['approved_students'] or sid not in ctx['enrollments']:
            continue
        row = available.get((sid, choice['batch_id'], choice['position_id']))
        if row and remaining.get(row['position_id'], 0) > 0:
            fixed[sid] = row['id']
            remaining[row['position_id']] -= 1
        else:
            review.add(sid)
    return fixed, review, remaining


def calculate(ctx, state):
    fixed, review, remaining = coordinator_choices(ctx, state)
    edges = [row for row in ctx['recommendations'] if row['student_id'] not in fixed and row['student_id'] not in review]
    return {**allocate(edges, remaining), **fixed}


def save_revision(state, actor, operation, signature):
    state.revision += 1
    state.input_signature = signature
    entry = ManagementAction.objects.create(actor=actor, action=STATE_ACTION,
        target_type='placement_allocation', target_id=1,
        metadata={'revision': state.revision, 'input_signature': signature, 'operation': operation,
                  'manual_choices': state.manual_choices,
                  'proposals': list(active_suggestions().order_by('student_id').values('student_id', 'recommendation_id'))})
    state.updated_at = entry.created_at
    state.needs_choice_upgrade = False


def store_suggestion(recommendation, actor):
    placement = OJTPlacement(student_id=recommendation.student_id, batch_id=recommendation.batch_id,
        position_id=recommendation.position_id, company_id=recommendation.position.company_id,
        status='suggested', is_active_suggestion=True, assigned_by=actor)
    placement.copy_recommendation_snapshot(recommendation)
    return placement


def replace_suggestions(chosen, actor):
    # Keep unchanged records/IDs so a read-only refresh is stable for reviewers.
    current = mapping()
    keep = [row.pk for sid, row in current.items() if chosen.get(sid) == row.recommendation_id]
    active_suggestions().exclude(pk__in=keep).delete()
    new_ids = [rid for sid, rid in chosen.items() if sid not in current or current[sid].recommendation_id != rid]
    recommendations = Recommendation.objects.filter(pk__in=new_ids).select_related('position')
    OJTPlacement.objects.bulk_create([store_suggestion(rec, actor) for rec in recommendations])


def payload(user, ctx, state, proposed=None):
    from .views import serialize_recommendation
    own = scoped_ids(user, ctx)
    _, needs_review, _ = coordinator_choices(ctx, state)
    current = mapping()
    selected = proposed if proposed is not None else {key: value.recommendation_id for key, value in current.items()}
    row_by_id = {row['id']: row for row in ctx['recommendations']}
    counts = (Counter(active_suggestions().values_list('position_id', flat=True)) if proposed is None else
              Counter(row_by_id[rid]['position_id'] for sid, rid in selected.items() if rid in row_by_id and row_by_id[rid]['student_id'] == sid))
    visible_recs = Recommendation.objects.filter(id__in=[row['id'] for row in ctx['recommendations'] if row['student_id'] in own]).select_related('position__company').prefetch_related('position__requirements__skill_category')
    ranked = {}
    for recommendation in visible_recs.order_by('-match_score', 'position_id'):
        ranked.setdefault(recommendation.student_id, []).append(serialize_recommendation(recommendation))
    entries = []
    for student_id in sorted(own):
        enrollment = ctx['enrollments'][student_id]
        if student_id in ctx['approved_students']:
            continue
        options = ranked.get(student_id, [])
        selected_id = selected.get(student_id)
        chosen = next((row for row in options if row['id'] == selected_id), None)
        reason = 'proposed' if chosen else 'awaiting_capacity' if options else 'no_current_matches' if student_id in ctx['eligible'] else 'results_locked'
        if reason == 'no_current_matches' and student_id in ctx['declined_students']:
            reason = 'suggestions_declined'
        if options and not state.revision and proposed is None:
            reason = 'awaiting_draft'
        elif reason == 'awaiting_capacity' and any(ctx['capacities'].get(row['position_id'], 0) > counts[row['position_id']] for row in options):
            reason = 'awaiting_update'
        if student_id in needs_review and student_id in ctx['eligible']:
            reason = 'coordinator_review'
        entries.append({'student': {'id': student_id, 'name': enrollment.student.name,
                        'school_id': enrollment.student.school_id, 'course': enrollment.student.course,
                        'photo_url': enrollment.student.photo_url},
                        'batch': {'id': enrollment.batch_id, 'name': enrollment.batch.name},
                        'status': reason, 'proposal': chosen, 'alternatives': options,
                        'coordinator_choice': str(student_id) in state.manual_choices,
                        'needs_review': bool(chosen and chosen['match_score'] < 60)})
    return {'revision': state.revision, 'generated': state.revision > 0,
            'sync_key': digest([ctx['signature'], state.revision]),
            'stale': bool(state.revision and ctx['signature'] != state.input_signature),
            'updated_at': state.updated_at if state.revision else None,
            'students': entries, 'proposed_counts': dict(counts),
            'scope': 'All active batches; student records limited to your access.',
            'policy': 'Maximize allocated students, then total match score. No score cutoff. Ties use stable student/position IDs.',
            'can_generate': user.role == 'admin'}


def notify_draft_changes(view):
    notify = notify_changes('placement')(view)

    @wraps(view)
    def wrapped(request):
        if request.method == 'POST' and not isinstance(request.data, dict):
            return Response({'error': 'Expected a JSON object.'}, status=400)
        # A preview is read-only, including the invalidation event log.
        return view(request) if request.method == 'GET' or request.data.get('action') == 'preview' else notify(request)
    return wrapped


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@notify_draft_changes
def placement_draft(request):
    if request.user.role not in ('admin', 'instructor'):
        return Response({'error': 'Forbidden'}, status=403)
    if request.method == 'GET':
        state = read_state()
        return Response(payload(request.user, context(), state))
    action = request.data.get('action')
    if action not in ('preview', 'apply', 'choose', 'sync'):
        return Response({'error': 'Choose sync, preview, apply or choose.'}, status=400)
    if action in ('preview', 'apply') and request.user.role != 'admin':
        return Response({'error': 'Only an administrator can update the shared allocation across all batches.'}, status=403)
    with transaction.atomic():
        state = lock_state()
        # Existing placement mutations take this same transaction lock first.
        ctx = context()
        if action == 'sync':
            changed = not state.revision or state.input_signature != ctx['signature'] or state.needs_choice_upgrade
            if changed:
                replace_suggestions(calculate(ctx, state), request.user)
                save_revision(state, request.user, 'automatic_update', ctx['signature'])
            result = payload(request.user, ctx, state)
            result['changed'] = changed
            response = Response(result)
            response.skip_change_event = not changed
            return response
        if action in ('preview', 'apply'):
            chosen = calculate(ctx, state)
            token_data = {'signature': ctx['signature'], 'revision': state.revision, 'allocation': digest(chosen)}
            if action == 'preview':
                result = payload(request.user, ctx, state, chosen)
                result['preview_token'] = signing.dumps(token_data, salt='placement-draft')
                current = mapping()
                result['changes'] = sum(sid not in current or current[sid].recommendation_id != rid for sid, rid in chosen.items())
                result['released'] = len(set(current) - set(chosen))
                return Response(result)
            try:
                token = request.data.get('preview_token', '')
                if not isinstance(token, str):
                    raise TypeError('Preview token must be a string')
                expected = signing.loads(token, salt='placement-draft', max_age=600)
            except (signing.BadSignature, TypeError):
                return Response({'error': 'Preview expired. Preview the current allocation again.'}, status=409)
            if expected != token_data:
                return Response({'error': 'Placement inputs changed. Preview the allocation again.'}, status=409)
            replace_suggestions(chosen, request.user)
            save_revision(state, request.user, 'update', ctx['signature'])
        else:
            student_id = request.data.get('student_id')
            if type(student_id) is not int or student_id not in scoped_ids(request.user, ctx):
                return Response({'error': 'Student is outside your active batches.'}, status=403)
            if type(request.data.get('revision')) is not int or request.data['revision'] != state.revision:
                return Response({'error': 'Suggestions changed. Refresh before choosing a position.'}, status=409)
            if ctx['signature'] != state.input_signature:
                return Response({'error': 'Shared suggestions need updating before changing a position.'}, status=409)
            rid = request.data.get('recommendation_id')
            row = next((item for item in ctx['recommendations'] if type(rid) is int and item['id'] == rid and item['student_id'] == student_id), None)
            if not row:
                return Response({'error': 'Current recommendation unavailable.'}, status=409)
            held = active_suggestions().filter(position_id=row['position_id']).exclude(student_id=student_id).count()
            if held >= ctx['capacities'].get(row['position_id'], 0):
                return Response({'error': 'All suggested slots for this position are already proposed. Review the shared suggestions first.'}, status=409)
            state.manual_choices[str(student_id)] = {'batch_id': row['batch_id'], 'position_id': row['position_id']}
            replace_suggestions(calculate(ctx, state), request.user)
            save_revision(state, request.user, 'choose', ctx['signature'])
        return Response(payload(request.user, ctx, state))


def placement_write_lock(view):
    """Serialize existing decisions with draft writes; never take a draft seat twice."""
    @wraps(view)
    def wrapped(request, *args, **kwargs):
        if request.user.role not in ('admin', 'instructor'):
            return view(request, *args, **kwargs)
        with transaction.atomic():
            state = lock_state()
            before = context() if state.revision else None
            fresh = before and before['signature'] == state.input_signature
            if view.__name__ in ('placement_approve', 'placement_manual_assign'):
                def numeric(value):
                    try:
                        return int(value) if not isinstance(value, bool) and int(value) > 0 else None
                    except (ValueError, TypeError):
                        return None
                rec = Recommendation.objects.filter(pk=numeric(request.data.get('recommendation_id'))).first()
                sid = rec.student_id if rec else numeric(request.data.get('student_id'))
                pid = rec.position_id if rec else numeric(request.data.get('position_id'))
                if type(sid) is int and type(pid) is int and before:
                    # Preserve the existing view's authorization and idempotent paths.
                    own = request.user.role == 'admin' or (bool(rec.batch_id and rec.batch.instructor_id == request.user.id) if rec else BatchEnrollment.objects.filter(student_id=sid, batch__instructor=request.user).exists())
                    approved = OJTPlacement.objects.filter(student_id=sid, status='approved').exists()
                    held = active_suggestions().filter(position_id=pid).exclude(student_id=sid).count()
                    if own and not approved and (not fresh or (held and held >= before['capacities'].get(pid, 0))):
                        return Response({'error': 'This slot is committed in the shared suggestions or the suggestions need updating. Review the proposed allocations first.'}, status=409)
            response = view(request, *args, **kwargs)
            if response.status_code < 300 and state.revision and not response.data.get('idempotent'):
                record = response.data.get('placement', {})
                sid = record.get('student', {}).get('id')
                released_elsewhere = False
                if sid:
                    choice = state.manual_choices.get(str(sid))
                    if choice and (view.__name__ in ('placement_approve', 'placement_manual_assign') or choice['position_id'] == record.get('position', {}).get('id')):
                        state.manual_choices.pop(str(sid), None)
                    proposals = active_suggestions().filter(student_id=sid)
                    released_elsewhere = proposals.exclude(position_id=record.get('position', {}).get('id')).exists()
                    if view.__name__ == 'placement_reject':
                        proposals = proposals.filter(recommendation_id=record.get('recommendation_id'))
                    proposals.delete()
                after = context()
                keeps_allocation = view.__name__ in ('placement_approve', 'placement_manual_assign') and not released_elsewhere
                save_revision(state, request.user, view.__name__, after['signature'] if fresh and keeps_allocation else state.input_signature)
            return response
    return wrapped


def placement_catalog_lock(view):
    """Catalog deletion/capacity edits use the allocation lock before row locks."""
    @wraps(view)
    def wrapped(request, *args, **kwargs):
        if request.user.role != 'admin':
            return view(request, *args, **kwargs)
        with transaction.atomic():
            lock_state()
            return view(request, *args, **kwargs)
    return wrapped
