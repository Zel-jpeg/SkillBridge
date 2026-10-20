"""Read-only staff analytics. Current cohort state is never a historical snapshot."""
from collections import Counter, defaultdict
from datetime import date, timedelta
from zoneinfo import ZoneInfo

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .management_access import managed_batches
from .models import (Assessment, AssessmentAttemptHistory, BatchEnrollment, OJTPlacement,
                     Position, Recommendation, StudentResponse, User)

MANILA = ZoneInfo('Asia/Manila')


def positive_id(params, key):
    value = params.get(key)
    if value is None or value == '':
        return None
    if len(value) > 18 or not value.isascii() or not value.isdigit() or int(value) < 1:
        raise ValidationError({'error': f'Invalid {key}.'})
    return int(value)


def area_of(address):
    if isinstance(address, dict):
        return next((value.strip() for key in ('city', 'municipality', 'province')
                     if isinstance((value := address.get(key)), str) and value.strip()), 'Unknown Area')
    return address.strip() if isinstance(address, str) and address.strip() else 'Unknown Area'


def rate(count, total):
    return round(100 * count / total, 1) if total else None


def analytics_payload(user, params):
    # Imported at call time to avoid the URL/views import cycle. This helper only
    # reads saved evidence and runs the same current/finalization gates as rosters.
    from .views import bulk_management_states

    if user.role not in ('admin', 'instructor') or not user.is_active or (user.role == 'instructor' and not user.is_approved):
        raise PermissionDenied('Approved staff only.')
    allowed = {'batch_id', 'instructor_id', 'course', 'batch_status', 'assessment_id',
               'company_id', 'position_id', 'area', 'date_from', 'date_to', '_t'}
    if set(params) - allowed or any(len(params.getlist(key)) != 1 for key in params):
        raise ValidationError({'error': 'Unsupported or repeated analytics filter.'})
    batch_id = positive_id(params, 'batch_id')
    instructor_id = positive_id(params, 'instructor_id')
    assessment_id = positive_id(params, 'assessment_id')
    company_id = positive_id(params, 'company_id')
    position_id = positive_id(params, 'position_id')
    if instructor_id and user.role != 'admin':
        raise PermissionDenied('Instructor filtering is admin-only.')
    status = params.get('batch_status', 'active')
    if status not in ('active', 'archived', 'all'):
        raise ValidationError({'error': 'Invalid batch_status.'})
    now = timezone.now()
    today = now.astimezone(MANILA).date()
    try:
        end = date.fromisoformat(params.get('date_to') or today.isoformat())
        start = date.fromisoformat(params.get('date_from') or (end - timedelta(days=55)).isoformat())
    except ValueError:
        raise ValidationError({'error': 'Activity dates must use YYYY-MM-DD.'})
    if start > end or (end - start).days > 365 or end > today:
        raise ValidationError({'error': 'Activity range must be ordered, no more than 366 days, and not in the future.'})

    owned = list(managed_batches(user).select_related('instructor').order_by('-created_at', '-id'))
    owned_map = {batch.id: batch for batch in owned}
    if batch_id and batch_id not in owned_map:
        raise NotFound('Batch not found.')
    selected = [batch for batch in owned if (status == 'all' or batch.status == status)]
    if instructor_id:
        if instructor_id not in {batch.instructor_id for batch in owned}:
            raise NotFound('Instructor has no accessible batches.')
        selected = [batch for batch in selected if batch.instructor_id == instructor_id]
    if batch_id:
        selected = [batch for batch in selected if batch.id == batch_id]
        if not selected:
            raise ValidationError({'error': 'Selected batch does not match the status/instructor filter.'})
    elif user.role == 'instructor' and status == 'active':
        selected = selected[:1]  # Same default active-batch ordering as the dashboard.
    selected_ids = [batch.id for batch in selected]
    course = params.get('course', '').strip()
    if len(course) > 100 or len(params.get('area', '')) > 255:
        raise ValidationError({'error': 'Filter text is too long.'})
    enrollments = list(BatchEnrollment.objects.filter(batch_id__in=selected_ids, student__role='student')
        .filter(Q(student__is_active=True) | Q(batch__status='archived')).select_related('student', 'batch', 'batch__instructor')
        .order_by('student_id', '-enrolled_at', '-id'))
    # One latest selected enrollment per student keeps system totals distinct.
    # Explicit batch selection exposes that batch's full roster, even if another
    # active membership is newer. No foreign enrollment is used for instructors.
    current = {}
    for enrollment in enrollments:
        if not course or enrollment.student.course == course:
            current.setdefault(enrollment.student_id, enrollment)
    grouped = defaultdict(list)
    for enrollment in current.values():
        grouped[enrollment.batch_id].append(enrollment.student)
    states = {}
    for batch in selected:
        if grouped[batch.id]:
            for student_id, value in bulk_management_states(grouped[batch.id], batch, include_history=False).items():
                states[(student_id, batch.id)] = value

    assessments = list(Assessment.objects.filter(batch_id__in=selected_ids).select_related('batch')
                       .order_by('display_order', 'created_at', 'id'))
    if assessment_id and assessment_id not in {assessment.id for assessment in assessments}:
        raise NotFound('Assessment not found in this scope.')
    assessment_map = {assessment.id: assessment for assessment in assessments}
    analysis_assessments = [assessment for assessment in assessments if not assessment_id or assessment.id == assessment_id]
    analysis_ids = [assessment.id for assessment in analysis_assessments]
    recs = defaultdict(list)
    for rec in (Recommendation.objects.filter(student_id__in=current, batch_id__in=selected_ids, is_current=True)
            .select_related('position__company').order_by('student_id', '-match_score', 'position_id', 'id')):
        if current[rec.student_id].batch_id == rec.batch_id:
            recs[(rec.student_id, rec.batch_id)].append(rec)
    placements = list(OJTPlacement.objects.filter(student_id__in=current, batch_id__in=selected_ids,
        status='approved').select_related('position', 'company'))
    approved = {placement.student_id: placement for placement in placements
                if current[placement.student_id].batch_id == placement.batch_id}
    # A saved approved placement in a different batch is not an unplaced student
    # and must not become a candidate for a second approval.
    other_approved = set(OJTPlacement.objects.filter(student_id__in=current, status='approved')
                         .values_list('student_id', flat=True)) - set(approved)
    students = []
    skill_rows = {}
    batch_rows = {batch.id: {'id': batch.id, 'name': batch.name, 'instructor': batch.instructor.name,
                   'total': 0, 'completed': 0, 'approved': 0} for batch in selected}
    attempt_rows = {assessment.id: {'id': assessment.id, 'batch_id': assessment.batch_id,
        'name': assessment.title, 'batch': assessment.batch.name, 'publication_status': assessment.publication_status,
        'required': assessment.is_required and assessment.include_in_competency, 'assigned': 0,
        'submitted': 0, 'in_progress': 0, 'not_started': 0, 'stopped': 0, 'retake_approved': 0}
        for assessment in analysis_assessments}
    match_bands = Counter({'Strong': 0, 'Fair': 0, 'Low': 0, 'No current match': 0, 'Locked': 0})
    for student_id, enrollment in current.items():
        student, batch = enrollment.student, enrollment.batch
        state, unlocked = states[(student_id, batch.id)]
        complete = state['all_required_completed']
        relevant_recs = recs[(student_id, batch.id)] if unlocked else []
        top = relevant_recs[0] if relevant_recs else None
        placement = approved.get(student_id)
        reasons = []
        attempt_states = {}
        retake_count = 0
        for result in state['assessment_results']:
            assessment = assessment_map[result['id']]
            valid = result['attempt_status'] == 'submitted' and result['submitted_at'] is not None and not result['is_flagged']
            integrity = result['is_flagged'] or result['attempt_status'] == 'stopped'
            bucket = 'stopped' if integrity else 'submitted' if valid else 'in_progress' if result['attempt_status'] else 'not_started'
            attempt_states[str(result['id'])] = bucket
            retake_count += int(result['retake_allowed'])
            if integrity:
                reasons.append('Stopped / flagged')
            if (batch.status == 'active' and assessment.publication_status == 'published'
                    and assessment.is_required and assessment.include_in_competency
                    and assessment.due_at and assessment.due_at < now and not valid):
                reasons.append('Overdue required work')
            if result['id'] in attempt_rows:
                row = attempt_rows[result['id']]
                row['assigned'] += 1
                row[bucket] += 1
                row['retake_approved'] += int(result['retake_allowed'])
        if not state['has_required_assessments']:
            reasons.append('No required assessments')
        elif complete and not unlocked and batch.status == 'active':
            reasons.append('Final results unavailable')
        if unlocked and not top and not placement and student_id not in other_approved:
            reasons.append('No current recommendations')
        reasons = sorted(set(reasons))
        if batch.status != 'active':
            reasons = []  # Archived records are history, not a current action queue.
        waiting = bool(top and not placement and student_id not in other_approved)
        band = 'Locked' if not unlocked else 'No current match' if top is None else 'Strong' if top.match_score >= 80 else 'Fair' if top.match_score >= 60 else 'Low'
        match_bands[band] += 1
        scores = state['combined_category_scores']
        for score in scores:
            key = score['category_id']
            group = skill_rows.setdefault(key, {'id': key, 'name': score['category'], 'sample': 0,
                'strong': 0, 'fair': 0, 'needs_work': 0, 'sum': 0.0})
            group['sample'] += 1
            group['sum'] += score['percentage']
            group['strong' if score['percentage'] >= 80 else 'fair' if score['percentage'] >= 60 else 'needs_work'] += 1
        batch_rows[batch.id]['total'] += 1
        batch_rows[batch.id]['completed'] += int(complete)
        batch_rows[batch.id]['approved'] += int(placement is not None)
        students.append({'id': student_id, 'name': student.name, 'school_id': student.school_id or '',
            'course': student.course or '', 'batch_id': batch.id, 'batch': batch.name, 'batch_status': batch.status,
            'instructor': batch.instructor.name, 'required_completed': state['completed_required_count'],
            'required_total': state['total_required_count'], 'required_complete': complete,
            'recommendations_locked': not unlocked, 'awaiting_review': waiting,
            'match_band': band, 'top_match': round(top.match_score, 2) if top else None,
            'top_company': top.position.company.name if top else '',
            'top_position': top.position.title if top else '',
            'placement_status': 'approved' if placement else 'approved_other_batch' if student_id in other_approved else 'unplaced',
            'company_id': placement.company_id if placement else None,
            'company': placement.company.name if placement else '', 'position_id': placement.position_id if placement else None,
            'position': placement.position.title if placement else '',
            'company_area': area_of(placement.company.address) if placement else '',
            'resident_area': area_of(student.address), 'reasons': reasons,
            'attempt_states': attempt_states, 'retake_count': retake_count,
            'scores': {str(score['category_id']): score['percentage'] for score in scores}})
    students.sort(key=lambda row: (row['name'].casefold(), row['id']))
    for group in skill_rows.values():
        group['average'] = round(group.pop('sum') / group['sample'], 2)
        group['missing'] = len(students) - group['sample']
    for row in attempt_rows.values():
        row['completion_rate'] = rate(row['submitted'], row['assigned'])
    for row in batch_rows.values():
        row['completion_rate'] = rate(row['completed'], row['total'])

    # Catalog availability is shared, but no foreign student/placement identities
    # are serialized. All approved assignments consume seats, regardless of filters.
    occupied = dict(OJTPlacement.objects.filter(status='approved').values('position_id')
                    .annotate(total=Count('id')).values_list('position_id', 'total'))
    catalog = list(Position.objects.select_related('company').order_by('company__name', 'title', 'id'))
    if position_id and position_id not in {position.id for position in catalog}:
        raise NotFound('Position not found.')
    if company_id and company_id not in {position.company_id for position in catalog}:
        raise NotFound('Company has no configured positions.')
    capacity = [{'id': position.id, 'company_id': position.company_id, 'company': position.company.name,
        'name': position.title, 'area': area_of(position.company.address), 'total': position.slots_available or 0,
        'occupied': occupied.get(position.id, 0), 'remaining': max(0, (position.slots_available or 0) - occupied.get(position.id, 0))}
        for position in catalog if (not position_id or position.id == position_id)
        and (not company_id or position.company_id == company_id)
        and (not params.get('area') or area_of(position.company.address) == params['area'])]
    placed_filtered = [row for row in students if (not company_id or row['company_id'] == company_id)
        and (not position_id or row['position_id'] == position_id)
        and (not params.get('area') or row['company_area'] == params['area'])]
    company_counts = Counter((row['company_id'], row['company']) for row in placed_filtered if row['placement_status'] == 'approved')
    area_counts = Counter(row['company_area'] for row in placed_filtered if row['placement_status'] == 'approved')
    residents = Counter(row['resident_area'] for row in students)
    unplaced_residents = Counter(row['resident_area'] for row in students if row['placement_status'] == 'unplaced')
    capacity_by_area = defaultdict(lambda: {'companies': set(), 'total': 0, 'remaining': 0})
    for row in capacity:
        capacity_by_area[row['area']]['companies'].add(row['company_id'])
        capacity_by_area[row['area']]['total'] += row['total']
        capacity_by_area[row['area']]['remaining'] += row['remaining']
    geography = [{'name': area, 'residents': residents[area], 'unplaced_residents': unplaced_residents[area],
        'approved_deployments': area_counts[area], 'companies': len(capacity_by_area[area]['companies']),
        'total_slots': capacity_by_area[area]['total'], 'remaining_slots': capacity_by_area[area]['remaining']}
        for area in sorted(set(residents) | set(area_counts) | set(capacity_by_area))]

    # This is recorded submission ACTIVITY, not a historical completion rate.
    # Deduplicate an identical saved current/history timestamp for the same attempt.
    response_scope = StudentResponse.objects.filter(student_id__in=current, assessment_id__in=analysis_ids)
    events = set()
    def add_event(student_id, batch_id, assessment_id, submitted_at, status, flagged):
        if (not submitted_at or status != 'submitted' or flagged or student_id not in current
                or current[student_id].batch_id != batch_id):
            return
        day = submitted_at.astimezone(MANILA).date()
        if start <= day <= end:
            events.add((student_id, assessment_id, submitted_at.isoformat(), day))
    for response in response_scope.select_related('assessment'):
        add_event(response.student_id, response.assessment.batch_id, response.assessment_id,
                  response.submitted_at, response.status, response.is_flagged)
    for history in AssessmentAttemptHistory.objects.filter(response__in=response_scope).select_related('response__assessment'):
        add_event(history.response.student_id, history.response.assessment.batch_id, history.response.assessment_id,
                  history.submitted_at, history.status, history.is_flagged)
    days = Counter(event[3] for event in events)
    activity = [{'date': (start + timedelta(days=offset)).isoformat(), 'submissions': days[start + timedelta(days=offset)]}
                for offset in range((end - start).days + 1)]
    summary = {'students': len(students), 'required_complete': sum(row['required_complete'] for row in students),
        'approved': len(approved), 'approved_other_batch': len(other_approved),
        'unplaced': sum(row['placement_status'] == 'unplaced' for row in students),
        'awaiting_review': sum(row['awaiting_review'] for row in students),
        'needs_followup': sum(bool(row['reasons']) for row in students),
        'slots_remaining': sum(row['remaining'] for row in capacity),
        'slots_total': sum(row['total'] for row in capacity),
        'pending_instructors': User.objects.filter(role='instructor', is_active=True, is_approved=False).count() if user.role == 'admin' else 0}
    summary['completion_rate'] = rate(summary['required_complete'], summary['students'])
    summary['placement_rate'] = rate(summary['approved'], summary['students'])
    return {'generated_at': now.isoformat(), 'role': user.role,
        'scope': {'batch_ids': selected_ids, 'batch_status': status, 'course': course, 'instructor_id': instructor_id,
            'assessment_id': assessment_id, 'company_id': company_id, 'position_id': position_id, 'area': params.get('area', ''),
            'date_from': start.isoformat(), 'date_to': end.isoformat(),
            'cohort_unit': 'Distinct students; newest selected enrollment. Active cohorts exclude archived accounts; archived cohorts retain historical enrollments.',
            'capacity_scope': 'Shared system-wide seats; only company/position/area filters apply',
            'activity_note': 'Recorded valid submitted attempts, including saved prior retakes. Not a historical completion rate. Deleted records and unsaved historical states cannot be reconstructed.'},
        'summary': summary, 'students': students, 'placement_students': placed_filtered,
        'assessments': list(attempt_rows.values()), 'batches': list(batch_rows.values()),
        'skills': sorted(skill_rows.values(), key=lambda row: row['name']), 'capacity': capacity,
        'match_bands': [{'name': name, 'count': count} for name, count in match_bands.items()],
        'companies': [{'id': key[0], 'name': key[1], 'count': count} for key, count in company_counts.most_common()],
        'areas': [{'name': name, 'count': count} for name, count in area_counts.most_common()], 'geography': geography, 'activity': activity,
        'options': {'batches': [{'id': batch.id, 'name': batch.name, 'status': batch.status, 'instructor_id': batch.instructor_id} for batch in owned],
            'instructors': [{'id': owner_id, 'name': name} for owner_id, name in sorted({(batch.instructor_id, batch.instructor.name) for batch in owned})] if user.role == 'admin' else [],
            'courses': sorted(set(BatchEnrollment.objects.filter(batch_id__in=owned_map, student__role='student')
                                  .exclude(student__course='').values_list('student__course', flat=True))),
            'assessments': [{'id': assessment.id, 'name': assessment.title, 'batch_id': assessment.batch_id} for assessment in assessments],
            'companies': [{'id': key, 'name': name} for key, name in sorted({(position.company_id, position.company.name) for position in catalog})],
            'positions': [{'id': position.id, 'name': position.title, 'company_id': position.company_id} for position in catalog],
            'areas': sorted({area_of(position.company.address) for position in catalog})}}


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def management_analytics(request):
    return Response(analytics_payload(request.user, request.query_params))
