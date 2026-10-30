"""Explicit OJT lifecycle transitions. History never grants current placement access."""
import json
from functools import wraps

from django.core import signing
from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .change_events import notify_changes
from .management_access import managed_batches, record_action
from .models import (Batch, BatchEnrollment, Company, Position, OJTPlacement,
                     CombinedCompetencyProfile, ManagementAction, Recommendation, StudentResponse, User)
from .placement_drafts import lock_state, digest, read_state, save_revision
from .placement_scope import current_approvals


def lifecycle_lock(view):
    """Same lock order as allocation writes, without generating allocation revisions."""
    @wraps(view)
    def wrapped(request, *args, **kwargs):
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return view(request, *args, **kwargs)
        if request.method != 'GET' and not isinstance(request.data, dict):
            raise ValidationError({'error': 'Provide a JSON object.'})
        with transaction.atomic():
            lock_state()
            return view(request, *args, **kwargs)
    return wrapped


def manager(user, admin=False):
    if not user.is_active or user.role not in (('admin',) if admin else ('admin', 'instructor')):
        raise PermissionDenied('Only authorized staff can perform this action.')
    if user.role == 'instructor' and not user.is_approved:
        raise PermissionDenied('Instructor approval is required.')


def available(position):
    return position.archived_at is None and position.company.archived_at is None


def unchanged(payload):
    response = Response({**payload, 'idempotent': True})
    response.skip_change_event = True
    return response


def unfinished(batch):
    return StudentResponse.objects.filter(assessment__batch=batch, status='in_progress',
                                          submitted_at__isnull=True, started_at__isnull=False)


def release_suggestions(actor, **scope):
    rows = OJTPlacement.objects.filter(is_active_suggestion=True, **scope)
    ids = list(rows.values_list('pk', flat=True))
    if ids:
        record_action(actor, 'placement.suggestions.release', 'placement_allocation', 1,
                      scope.get('batch_id'), placement_ids=ids)
        rows.delete()  # Only replaceable generated allocations; recorded decisions remain.
    if scope.get('batch_id'):
        state = read_state()
        dropped = [sid for sid, choice in state.manual_choices.items()
                   if choice['batch_id'] == scope['batch_id'] and
                   (not scope.get('student_id') or int(sid) == scope['student_id'])]
        if dropped:
            state.manual_choices = {sid: choice for sid, choice in state.manual_choices.items() if sid not in dropped}
            save_revision(state, actor, 'batch.release', state.input_signature)
            record_action(actor, 'placement.choices.release', 'batch', scope['batch_id'], scope['batch_id'],
                          student_ids=[int(sid) for sid in dropped])


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@notify_changes('catalog')
@lifecycle_lock
def catalog_archive(request, kind, object_id):
    manager(request.user, admin=True)
    restore = request.data.get('restore', False)
    if type(restore) is not bool:
        raise ValidationError({'error': 'Restore must be true or false.'})
    model = Company if kind == 'partner' else Position
    with transaction.atomic():
        row = get_object_or_404(model.objects.select_for_update(), pk=object_id)
        if (row.archived_at is None) != (not restore):
            return unchanged({'id': row.pk, 'archived_at': row.archived_at})
        if (row.archived_at is None) == (not restore):
            if not restore:
                scope = {'company_id' if kind == 'partner' else 'position_id': row.pk}
                count = current_approvals(**scope).count()
                if count:
                    return Response({'error': f'Review {count} current approved decision(s) before archiving this {kind}. Archive the relevant batch or resolve its current decisions first.',
                                     'current_approved_count': count}, status=409)
                release_suggestions(request.user, **scope)
            row.archived_at = None if restore else timezone.now()
            row.save(update_fields=['archived_at'])
            record_action(request.user, f'{kind}.restore' if restore else f'{kind}.archive', kind, row.pk)
    return Response({'id': row.pk, 'archived_at': row.archived_at})


def closeout_state(batch):
    # No ensure_combined/recalculation: a preview captures retained facts only.
    from .views import (serialize_student_assessment_results, serialize_combined_scores,
                        serialize_combined_profile, _serialize_placement, _placement_select_related)
    from .models import CombinedCompetencyProfile
    profiles = {p.student_id: p for p in CombinedCompetencyProfile.objects.filter(batch=batch)}
    placements = list(_placement_select_related(OJTPlacement.objects.filter(batch=batch, is_active_suggestion=False)).order_by('id'))
    serialized_placements = []
    for row in placements:
        item = _serialize_placement(row)
        item['student'] = {key: item['student'][key] for key in ('id', 'name', 'school_id', 'course')}
        item['company'] = {key: item['company'][key] for key in ('id', 'name', 'address')}
        serialized_placements.append(item)
    by_student = {}
    for row in serialized_placements:
        by_student.setdefault(row['student']['id'], []).append(row)
    matches = {}
    for row in Recommendation.objects.filter(batch=batch).select_related('position__company').order_by('student_id', '-match_score', 'position_id'):
        matches.setdefault(row.student_id, []).append({'position_id': row.position_id, 'position': row.position.title,
            'partner': row.position.company.name, 'is_current': row.is_current, 'match_score': row.match_score,
            'category': row.category_score_component, 'nlp': row.nlp_score_component,
            'location': row.location_score_component, 'distance_km': row.distance_km,
            'model_used': row.model_used, 'generated_at': row.generated_at})
    students = []
    for enrollment in BatchEnrollment.objects.filter(batch=batch).select_related('student').order_by('student__name', 'id'):
        student = enrollment.student
        assessments = serialize_student_assessment_results(student, batch)
        for assessment in assessments:
            assessment.pop('attempt_timing', None)
            for attempt in assessment.get('prior_attempts', []):
                attempt.pop('answers', None)
        from .assessment_progress import required_progress
        from .recommendation_freshness import recommendations_stale
        profile = profiles.get(student.pk)
        students.append({'id': student.pk, 'name': student.name, 'school_id': student.school_id,
                         'course': student.course, 'enrolled_at': enrollment.enrolled_at,
                         'assessments': assessments,
                         'combined_scores': serialize_combined_scores(student, batch),
                         'combined_profile_finalized': bool(profile and profile.is_finalized),
                         'recommendations': matches.get(student.pk, []),
                         'progress': required_progress(student, batch),
                         'recommendations_stale': recommendations_stale(profile, student),
                         'combined_profile': serialize_combined_profile(profiles.get(student.pk), include_nlp_text=False),
                         'placements': by_student.get(student.pk, [])})
    occupancy = dict(current_approvals().values('position_id')
                     .annotate(n=Count('id')).values_list('position_id', 'n'))
    catalog = [{'id': p.pk, 'partner_id': p.company_id, 'partner': p.company.name,
                'address': p.company.address, 'position': p.title, 'slots': p.slots_available,
                'archived': not available(p), 'current_approved_shared': occupancy.get(p.pk, 0),
                'requirements': {r.skill_category.name: r.required_percentage for r in p.requirements.all()}}
               for p in Position.objects.select_related('company').prefetch_related('requirements__skill_category').order_by('id')]
    state = {'schema_version': 2, 'batch': {'id': batch.pk, 'name': batch.name, 'status': batch.status,
                                          'instructor_id': batch.instructor_id, 'instructor': batch.instructor.name},
             'students': students, 'placements': serialized_placements,
             'assessment_definitions': list(batch.assessment_set.order_by('id').values('id', 'title',
                 'publication_status', 'is_required', 'include_in_competency', 'available_at', 'due_at')),
             'catalog': catalog, 'catalog_scope': 'Shared catalog at report time; allocations include active enrolled batches and detached legacy approvals.',
             'unfinished_attempts': unfinished(batch).count(),
             'pending_retakes': StudentResponse.objects.filter(assessment__batch=batch).filter(
                 Q(retake_request_status='pending') | Q(retake_allowed=True)).count(),
             'approved_decisions': sum(p.status == 'approved' for p in placements),
             'snapshot_count': len(batch.closeout_snapshots)}
    return json.loads(json.dumps(state, cls=DjangoJSONEncoder))


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@notify_changes('batch')
@lifecycle_lock
def batch_closeout(request, batch_id):
    manager(request.user)
    with transaction.atomic():
        batch = get_object_or_404(managed_batches(request.user).select_for_update(), pk=batch_id)
        if request.method == 'GET' and request.query_params.get('version'):
            try:
                version = int(request.query_params['version'])
                snapshot = batch.closeout_snapshots[version - 1] if version > 0 else None
            except (ValueError, IndexError):
                snapshot = None
            if snapshot is None:
                return Response({'error': 'Saved closeout version not found.'}, status=404)
            return Response(snapshot)
        if request.method == 'POST':
            list(batch.assessment_set.select_for_update().order_by('id'))
            # Profile saves and enrollment changes lock the same user rows.
            list(User.objects.select_for_update().filter(enrollments__batch=batch).order_by('id'))
        state = closeout_state(batch)
        binding = {'batch': batch.pk, 'actor': request.user.pk, 'digest': digest(state)}
        if request.method == 'GET':
            return Response({'preview': state, 'review_token': signing.dumps(binding, salt='cycle-closeout')})
        try:
            reviewed = signing.loads(request.data.get('review_token', ''), salt='cycle-closeout', max_age=900)
        except (signing.BadSignature, TypeError):
            reviewed = None
        if reviewed != binding:
            return Response({'error': 'Batch data changed or the review expired. Review the latest closeout before confirming.'}, status=409)
        if batch.status != 'active':
            return Response({'error': 'This batch is already archived. Download its saved version or reactivate it before another closeout.'}, status=409)
        if state['unfinished_attempts'] or state['pending_retakes']:
            return Response({'error': 'Resolve unfinished assessments and pending or approved retakes before archiving this recommendation batch.'}, status=409)
        note = request.data.get('note', '')
        if not isinstance(note, str) or len(note) > 500:
            raise ValidationError({'error': 'The optional archive note must be at most 500 characters.'})
        snapshot = {**state, 'version': len(batch.closeout_snapshots) + 1,
                    'batch': {**state['batch'], 'status': 'archived'},
                    'generated_at': timezone.now().isoformat(), 'timezone': 'Asia/Manila',
                    'generated_by': {'id': request.user.pk, 'name': request.user.name, 'role': request.user.role},
                    'archive_note': note.strip()}
        versions = [*batch.closeout_snapshots, snapshot]
        if len(json.dumps(versions).encode()) > 16 * 1024 * 1024:
            raise ValidationError({'error': 'This batch has reached its closeout storage limit. Contact the administrator; existing versions remain preserved.'})
        release_suggestions(request.user, batch_id=batch.pk)
        batch.closeout_snapshots = versions
        batch.status = 'archived'
        batch.archived_at = timezone.now()
        batch.save(update_fields=['closeout_snapshots', 'status', 'archived_at'])
        from .combined_competency import recalculate_enrolled_students
        recalculate_enrolled_students(batch)
        record_action(request.user, 'batch.closeout', 'batch', batch.pk, batch.pk, version=snapshot['version'])
    return Response({'version': snapshot['version'], 'batch_id': batch.pk, 'status': 'archived'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_history(request):
    if request.user.role != 'student':
        raise PermissionDenied('Students only.')
    from .views import serialize_student_assessment_results
    from .student_assessment_order import assessment_numbers, assessment_title
    from .assessment_progress import current_enrollment
    from .student_batch_history import recorded_batches, previous_batches
    records = []
    batches = (previous_batches(request.user, current_enrollment(request.user))
               if request.query_params.get('previous') == '1' else recorded_batches(request.user))
    for batch in batches.order_by('-created_at', '-id'):
        # Reopened batches show current attempts; issued versions remain immutable
        # and downloadable through the separate saved-report endpoint.
        saved = batch.closeout_snapshots[-1] if batch.status == 'archived' and batch.closeout_snapshots else None
        own = next((s for s in saved['students'] if s['id'] == request.user.pk), None) if saved else None
        assessments = own['assessments'] if own else serialize_student_assessment_results(request.user, batch)
        # Student history exposes score summaries, never staff-only retake answers/notes.
        assessments = [{key: a.get(key) for key in ('id', 'title', 'attempt_status', 'submitted_at', 'category_scores')}
                       for a in assessments]
        numbers = assessment_numbers(request.user, batch)
        assessments = sorted(
            [{**item, 'title': assessment_title(numbers, item['id'])} for item in assessments],
            key=lambda item: numbers.get(item['id'], float('inf')),
        )
        placements = ([p for p in saved['placements'] if p['student']['id'] == request.user.pk
                       and p['status'] in ('approved', 'completed')] if saved else [
            {'id': p.pk, 'status': p.status, 'company': {'id': p.company_id, 'name': p.company.name},
             'position': {'id': p.position_id, 'title': p.position.title},
             'approved_at': p.approved_at, 'completed_at': p.completed_at}
            for p in OJTPlacement.objects.filter(student=request.user, batch=batch,
                status__in=['approved', 'completed']).select_related('company', 'position')])
        placements = [{key: p.get(key) for key in ('id', 'status', 'company', 'position', 'approved_at', 'completed_at')}
                      for p in placements]
        records.append({'batch': {'id': batch.pk, 'name': batch.name, 'status': batch.status},
                        'snapshot_at': saved['generated_at'] if saved else None,
                        'assessments': assessments,
                        'outcome': saved.get('exceptions', {}).get(str(request.user.pk), '') if saved else '',
                        'placements': placements,
                        'combined_scores': own['combined_scores'] if own else []})
    return Response({'batches': records})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@notify_changes('student')
@lifecycle_lock
def confirm_profile(request):
    from .assessment_progress import current_enrollment
    from .profile_validation import profile_data
    if request.user.role != 'student':
        raise PermissionDenied('Students only.')
    with transaction.atomic():
        enrollment = current_enrollment(request.user)
        if enrollment is None:
            raise ValidationError({'error': 'An active batch is required.'})
        Batch.objects.select_for_update().get(pk=enrollment.batch_id)
        user = User.objects.select_for_update().get(pk=request.user.pk)
        profile_data({'name': user.name, 'studentId': user.school_id, 'course': user.course, 'phone': user.phone}, user)
        if not isinstance(user.address, dict) or not user.address.get('travelWilling') or not user.address.get('stayingAt'):
            raise ValidationError({'error': 'Review your residence and travel preference in your profile first.'})
        profile_data({'stayingAt': user.address['stayingAt'], 'travelWilling': user.address['travelWilling'],
                      'pinLat': user.address.get('pinLat'), 'pinLng': user.address.get('pinLng')}, user)
        for group in ('home', 'boarding') if user.address['stayingAt'] == 'boarding' else ('home',):
            address = user.address.get(group)
            if not isinstance(address, dict) or any(not isinstance(address.get(part), str) or
                    not address[part].strip() or len(address[part]) > 255 for part in ('province', 'city', 'barangay')):
                raise ValidationError({'error': f'Complete and save your {group} address before confirming.'})
        if type(request.data.get('batch_id')) is not int or request.data['batch_id'] != enrollment.batch_id:
            raise ValidationError({'error': 'Your batch changed. Review the current batch before confirming.'})
        if enrollment.profile_confirmed_at and not enrollment.profile_review_required:
            return unchanged({'profile_confirmed_at': enrollment.profile_confirmed_at})
        enrollment.profile_confirmed_at = timezone.now()
        enrollment.profile_review_required = False
        enrollment.save(update_fields=['profile_confirmed_at', 'profile_review_required'])
        from .assessment_progress import required_progress
        if required_progress(user, enrollment.batch)['all_required_completed']:
            # Same-batch re-enrollment keeps its scores; refresh matching for the
            # newly confirmed profile instead of leaving a changed pin stale.
            from .combined_competency import recalculate_combined
            recalculate_combined(user, enrollment.batch)
    return Response({'profile_confirmed_at': enrollment.profile_confirmed_at})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@notify_changes('batch')
@lifecycle_lock
def transfer_student(request, batch_id):
    """Explicitly move active membership; recorded evidence and removal audit remain."""
    manager(request.user)
    target = get_object_or_404(managed_batches(request.user).select_for_update(), pk=batch_id, status='active')
    token = request.data.get('review_token')
    if token:
        try:
            binding = signing.loads(token, salt='student-transfer', max_age=900)
        except (signing.BadSignature, TypeError):
            raise ValidationError({'error': 'Review this transfer again; the review expired.'})
        if binding.get('actor') != request.user.pk or binding.get('target') != target.pk:
            raise PermissionDenied('This transfer review is outside your scope.')
        previous = ManagementAction.objects.filter(action='enrollment.transfer', actor=request.user,
            target_id=binding['student'], batch_id_snapshot=target.pk, metadata__review=digest(binding)).first()
        if previous:
            return unchanged({'transferred': True})
        student = get_object_or_404(User.objects, pk=binding['student'], role='student', is_active=True)
    else:
        school_id = request.data.get('school_id')
        if not isinstance(school_id, str) or len(school_id) > 20:
            raise ValidationError({'error': 'Enter the student school ID.'})
        student = get_object_or_404(User.objects, school_id=school_id.strip(), role='student', is_active=True)
    current = BatchEnrollment.objects.filter(student=student, batch__status='active').exclude(batch=target).select_related('batch').order_by('id')
    if not student.is_approved:
        return Response({'error': 'Approve the student account before transferring its active enrollment.'}, status=409)
    if current.count() != 1:
        return Response({'error': 'A transfer requires exactly one other active batch. Review this student’s memberships with an administrator.'}, status=409)
    source = current.first()
    source_batch = Batch.objects.select_for_update().get(pk=source.batch_id)
    # Match assessment-start/closeout order: batch before student. Holding the
    # user first can deadlock with the new response's deferred foreign keys.
    student = get_object_or_404(User.objects.select_for_update(), pk=student.pk, role='student', is_active=True)
    if not student.is_approved:
        return Response({'error': 'Approve the student account before transferring its active enrollment.'}, status=409)
    if request.user.role == 'instructor' and source_batch.instructor_id != request.user.pk:
        raise PermissionDenied('An administrator must handle a transfer between instructors.')
    if unfinished(source_batch).filter(student=student).exists():
        return Response({'error': 'Resolve this student’s unfinished assessment before transferring.'}, status=409)
    if StudentResponse.objects.filter(assessment__batch=source_batch, student=student).filter(
            Q(retake_request_status='pending') | Q(retake_allowed=True)).exists():
        return Response({'error': 'Resolve this student’s pending or approved retakes before transferring.'}, status=409)
    expected = {'student': student.pk, 'actor': request.user.pk, 'source': source.batch_id,
                'enrollment': source.pk, 'target': target.pk, 'identity': [student.school_id, student.email, student.course]}
    if not token:
        response = Response({'student': {'name': student.name, 'school_id': student.school_id},
                         'source': source.batch.name, 'target': target.name,
                         'review_token': signing.dumps(expected, salt='student-transfer')})
        response.skip_change_event = True
        return response
    if binding != expected:
        return Response({'error': 'The enrollment or identity changed. Review the transfer again.'}, status=409)
    source_id = source.batch_id
    request._transfer_source_batch_id = source_id
    source_order = source.assessment_order
    source.delete()
    Recommendation.objects.filter(student=student, batch_id=source_id).update(is_current=False)
    CombinedCompetencyProfile.objects.filter(student=student, batch_id=source_id).update(is_finalized=False, finalized_at=None)
    release_suggestions(request.user, student_id=student.pk, batch_id=source_id)
    record_action(request.user, 'enrollment.remove', 'student', student.pk, source_id,
                  reason='explicit_transfer', target_batch_id=target.pk, assessment_order=source_order)
    from .enrollment_import import review_rows, confirm_rows
    rows = review_rows([{'school_id': student.school_id, 'email': student.email,
                         'name': student.name, 'course': student.course}], target)
    def notice(person, enrollment_id):
        from .email_outbox import enrollment_content
        from .views import send_instructor_email
        enrollment = BatchEnrollment.objects.get(pk=enrollment_id)
        subject, body, html = enrollment_content(person, target)
        saved = send_instructor_email(person, subject, body, html, enrollment=enrollment, actor=request.user,
            held=True, key=f'enrollment:{enrollment_id}:initial', notify_change=False)
        return 'held' if saved else False
    result = confirm_rows(rows, target, notice)
    if result[0]['status'] not in ('enrolled', 'already_enrolled'):
        # Roll back source removal as well; never leave a half-completed transfer.
        raise ValidationError({'error': 'Transfer could not be saved. The original enrollment is preserved.'})
    enrollment = BatchEnrollment.objects.get(student=student, batch=target)
    enrollment.profile_review_required = True
    enrollment.profile_confirmed_at = None
    enrollment.save(update_fields=['profile_review_required', 'profile_confirmed_at'])
    record_action(request.user, 'enrollment.transfer', 'student', student.pk, target.pk,
                  source_batch_id=source_id, review=digest(expected))
    return Response({'transferred': True, 'email_status': result[0].get('notification_status')})
