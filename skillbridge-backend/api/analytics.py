"""Read-only staff analytics. Current cohort state is never a historical snapshot."""
from .recommendation_policy import order_fields, api_fields, assessment_band, top_api_fields
from collections import Counter, defaultdict
from zoneinfo import ZoneInfo

from django.db.models import Count, Exists, OuterRef, Q
from django.utils import timezone
from django.views.decorators.cache import never_cache
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .placement_scope import current_approvals
from .management_access import managed_batches
from .opportunity_scope import active_positions, eligible_recommendations, for_programs
from .analytics_activity import activity_dates, submission_activity
from .organization_visibility import batch_visibility_q
from .models import (Assessment, AssessmentAttemptHistory, BatchEnrollment, CombinedCategoryScore,
                     CombinedCompetencyProfile, Institute, OJTPlacement, Program, Recommendation,
                     SkillScore, StudentResponse, User)

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


def cohort_states(current, batches, assessments, *, include_skills):
    """Bulk-load evidence for each student's selected enrollment only."""
    from .views import assemble_management_states

    def group(rows, batch_of):
        grouped = defaultdict(list)
        for row in rows:
            batch_id = batch_of(row)
            if current[row.student_id].batch_id == batch_id:
                grouped[batch_id].append(row)
        return grouped

    students = defaultdict(list)
    review_required = defaultdict(set)
    for enrollment in current.values():
        students[enrollment.batch_id].append(enrollment.student)
        if enrollment.profile_review_required:
            review_required[enrollment.batch_id].add(enrollment.student_id)
    assessment_batches = {row.id: row.batch_id for row in assessments if row.batch_id in students}
    assessments_by_batch = defaultdict(list)
    for assessment in assessments:
        assessments_by_batch[assessment.batch_id].append(assessment)
    responses = group(StudentResponse.objects.filter(student_id__in=current, assessment_id__in=assessment_batches)
        .only('student_id', 'assessment_id', 'status', 'submitted_at', 'is_flagged', 'retake_allowed'),
        lambda row: assessment_batches[row.assessment_id])
    scores = group(SkillScore.objects.filter(student_id__in=current, assessment_id__in=assessment_batches)
        .select_related('skill_category').only('student_id', 'assessment_id', 'raw_score', 'max_score', 'skill_category__framework_id'),
        lambda row: assessment_batches[row.assessment_id])
    profiles = group(CombinedCompetencyProfile.objects.filter(student_id__in=current, batch_id__in=students)
        .only('student_id', 'batch_id', 'is_finalized', 'included_assessment_ids', 'ranking_input_fingerprint'), lambda row: row.batch_id)
    combined = group(CombinedCategoryScore.objects.filter(student_id__in=current, batch_id__in=students)
        .select_related('skill_category').only('student_id', 'batch_id', 'skill_category__name', 'raw_score',
            'max_score', 'percentage', 'source_assessment_ids').order_by('skill_category__name', 'skill_category_id'),
        lambda row: row.batch_id) if include_skills else {}
    states, catalogs = {}, {}
    for batch_id, cohort in students.items():
        states.update(assemble_management_states(cohort, batches[batch_id], assessments_by_batch[batch_id],
            responses[batch_id], scores[batch_id], profiles[batch_id], combined.get(batch_id, []),
            review_required[batch_id], catalog_cache=catalogs, analytics=True))
    return states


def analytics_payload(user, params):
    from .email_outbox import email_storage_ready, reminders
    from .email_progress import progress_groups

    if user.role not in ('admin', 'instructor') or not user.is_active or (user.role == 'instructor' and not user.is_approved):
        raise PermissionDenied('Approved staff only.')
    allowed = {'batch_id', 'instructor_id', 'institute_id', 'program_id', 'course', 'batch_status', 'assessment_id',
               'company_id', 'position_id', 'area', 'date_from', 'date_to', 'activity_period', 'view', '_t'}
    if set(params) - allowed or any(len(params.getlist(key)) != 1 for key in params):
        raise ValidationError({'error': 'Unsupported or repeated analytics filter.'})
    if 'view' in params and params['view'] != 'overview':
        raise ValidationError({'error': 'Unsupported analytics view.'})
    full = 'view' not in params
    batch_id = positive_id(params, 'batch_id')
    instructor_id = positive_id(params, 'instructor_id')
    institute_id = positive_id(params, 'institute_id')
    program_id = positive_id(params, 'program_id')
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
    activity_period, start, end = activity_dates(params, today)

    owned_query = managed_batches(user).select_related('instructor', 'institute', 'program', 'framework__program').order_by('-created_at', '-id')
    owned = list(owned_query)
    if user.role == 'admin':
        institute_options = list(Institute.objects.order_by('name', 'id').values('id', 'name', 'code', 'is_active'))
        program_options = list(Program.objects.order_by('name', 'id').values('id', 'name', 'code', 'institute_id', 'is_active'))
        if institute_id and not any(row['id'] == institute_id for row in institute_options):
            raise NotFound('Institute not found.')
        chosen_program = next((row for row in program_options if row['id'] == program_id), None)
        if program_id and not chosen_program:
            raise NotFound('Program not found.')
        if institute_id and chosen_program and chosen_program['institute_id'] != institute_id:
            raise ValidationError({'error': 'Selected program does not belong to this institute.'})
    else:
        institute_options = [{'id': key, 'name': name} for key, name in sorted({(batch.institute_id, batch.institute.name) for batch in owned if batch.institute_id})]
        program_options = [{'id': key, 'name': name, 'institute_id': parent} for key, name, parent in sorted({
            (batch.program_id, batch.program.name, batch.program.institute_id) for batch in owned if batch.program_id})]
    owned_map = {batch.id: batch for batch in owned}
    if batch_id and batch_id not in owned_map:
        raise NotFound('Batch not found.')
    selected = [batch for batch in owned if (status == 'all' or batch.status == status)]
    organization_ids = set(owned_query.filter(batch_visibility_q(institute_id, program_id)).values_list('pk', flat=True)) if institute_id or program_id else set(owned_map)
    organization_batches = [batch for batch in owned if batch.pk in organization_ids]
    if (institute_id or program_id) and not organization_batches and user.role == 'instructor':
        raise NotFound('No accessible batches in this scope.')
    selected = [batch for batch in selected if batch.pk in organization_ids]
    if instructor_id:
        if instructor_id not in {batch.instructor_id for batch in owned}:
            raise NotFound('Instructor has no accessible batches.')
        selected = [batch for batch in selected if batch.instructor_id == instructor_id]
    if batch_id:
        selected = [batch for batch in selected if batch.id == batch_id]
        if not selected:
            raise ValidationError({'error': 'Selected batch does not match the status/instructor filter.'})
    elif user.role == 'instructor' and status == 'active' and not (institute_id or program_id):
        selected = selected[:1]  # Same default active-batch ordering as the dashboard.
    selected_ids = [batch.id for batch in selected]
    course = params.get('course', '').strip()
    if len(course) > 100 or len(params.get('area', '')) > 255:
        raise ValidationError({'error': 'Filter text is too long.'})
    enrollments = list(BatchEnrollment.objects.filter(batch_id__in=selected_ids, student__role='student')
        .filter(Q(student__is_active=True) | Q(batch__status='archived')).select_related('student')
        .only('batch_id', 'enrolled_at', 'profile_review_required', 'student__name', 'student__course', 'student__school_id', 'student__address')
        .order_by('student_id', '-enrolled_at', '-id'))
    # One latest selected enrollment per student keeps system totals distinct.
    # Explicit batch selection exposes that batch's full roster, even if another
    # active membership is newer. No foreign enrollment is used for instructors.
    current = {}
    for enrollment in enrollments:
        if not course or enrollment.student.course == course:
            current.setdefault(enrollment.student_id, enrollment)
    assessments = list(Assessment.objects.filter(batch_id__in=selected_ids)
                       .only('batch_id', 'title', 'publication_status', 'archived_at', 'is_required', 'include_in_competency', 'due_at', 'framework_id')
                       .order_by('display_order', 'created_at', 'id'))
    if assessment_id and assessment_id not in {assessment.id for assessment in assessments}:
        raise NotFound('Assessment not found in this scope.')
    states = cohort_states(current, owned_map, assessments, include_skills=full or bool(program_id))
    assessment_map = {assessment.id: assessment for assessment in assessments}
    analysis_assessments = [assessment for assessment in assessments if not assessment_id or assessment.id == assessment_id]
    analysis_ids = [assessment.id for assessment in analysis_assessments]
    recs = defaultdict(list)
    for rec in (eligible_recommendations(Recommendation.objects.filter(student_id__in=current, batch_id__in=selected_ids, is_current=True))
            .select_related('position__company').order_by(*order_fields('student_id'))):
        if current[rec.student_id].batch_id == rec.batch_id:
            recs[(rec.student_id, rec.batch_id)].append(rec)
    placements = list(OJTPlacement.objects.filter(student_id__in=current, batch_id__in=selected_ids,
        status='approved').select_related('position', 'company'))
    approved = {placement.student_id: placement for placement in placements
                if current[placement.student_id].batch_id == placement.batch_id}
    # A saved approved placement in a different batch is not an unplaced student
    # and must not become a candidate for a second approval.
    other_approved = set(current_approvals(student_id__in=current)
                         .values_list('student_id', flat=True)) - set(approved)
    students = []
    skill_rows = {}
    framework_sizes = Counter(owned_map[enrollment.batch_id].framework_id for enrollment in current.values())
    batch_rows = {batch.id: {'id': batch.id, 'name': batch.name, 'instructor': batch.instructor.name,
                   'total': 0, 'completed': 0, 'approved': 0} for batch in selected}
    attempt_rows = {assessment.id: {'id': assessment.id, 'batch_id': assessment.batch_id,
        'name': assessment.title, 'batch': owned_map[assessment.batch_id].name, 'publication_status': assessment.publication_status,
        'required': assessment.is_required and assessment.include_in_competency, 'assigned': 0,
        'submitted': 0, 'in_progress': 0, 'not_started': 0, 'stopped': 0, 'retake_approved': 0}
        for assessment in analysis_assessments} if full else {}
    match_bands = Counter({'Strong': 0, 'Fair': 0, 'Low': 0, 'No current match': 0, 'Locked': 0})
    for student_id, enrollment in current.items():
        student, batch = enrollment.student, owned_map[enrollment.batch_id]
        state, unlocked = states[student_id]
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
            if full:
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
        scores = state['combined_category_scores']
        for score in scores:
            key = score['category_id']
            group = skill_rows.setdefault(key, {'id': key, 'name': score['category'], 'sample': 0,
                'framework_id': batch.framework_id, 'program_id': batch.program_id,
                'framework_label': f'{batch.framework.program.name} · {batch.framework.name} v{batch.framework.version}' if batch.framework_id else '',
                'strong': 0, 'fair': 0, 'needs_work': 0, 'sum': 0.0})
            group['sample'] += 1
            group['sum'] += score['percentage']
            group['strong' if score['percentage'] >= 80 else 'fair' if score['percentage'] >= 60 else 'needs_work'] += 1
        batch_rows[batch.id]['total'] += 1
        batch_rows[batch.id]['completed'] += int(complete)
        batch_rows[batch.id]['approved'] += int(placement is not None)
        row = {'id': student_id, 'name': student.name,
            'batch_id': batch.id, 'batch': batch.name, 'required_completed': state['completed_required_count'],
            'required_total': state['total_required_count'], 'required_complete': complete,
            'awaiting_review': waiting, 'reasons': reasons,
            'placement_status': 'approved' if placement else 'approved_other_batch' if student_id in other_approved else 'unplaced'}
        if full or program_id:
            row['school_id'] = student.school_id or ''
        if full:
            band = 'Locked' if not unlocked else 'No current match' if top is None else assessment_band(top)
            match_bands[band] += 1
            row.update({**top_api_fields(top), 'course': student.course or '', 'batch_status': batch.status,
                'instructor': batch.instructor.name, 'recommendations_locked': not unlocked,
                'competency_locked': state.get('competency_locked', not unlocked),
                'match_band': band, 'top_match': round(top.match_score, 2) if top else None,
                'top_company': top.position.company.name if top else '',
                'top_position': top.position.title if top else '',
                'company_id': placement.company_id if placement else None,
                'company': placement.company.name if placement else '', 'position_id': placement.position_id if placement else None,
                'position': placement.position.title if placement else '',
                'company_area': area_of(placement.company.address) if placement else '',
                'resident_area': area_of(student.address),
                'attempt_states': attempt_states, 'retake_count': retake_count,
                'scores': {str(score['category_id']): score['percentage'] for score in scores}})
        students.append(row)
    students.sort(key=lambda row: (row['name'].casefold(), row['id']))
    for group in skill_rows.values():
        group['average'] = round(group.pop('sum') / group['sample'], 2)
        group['missing'] = max(0, framework_sizes[group['framework_id']] - group['sample'])
    for row in attempt_rows.values():
        row['completion_rate'] = rate(row['submitted'], row['assigned'])
    for row in batch_rows.values():
        row['completion_rate'] = rate(row['completed'], row['total'])

    # Catalog availability is shared, but no foreign student/placement identities
    # are serialized. All approved assignments consume seats, regardless of filters.
    occupied = dict(current_approvals().values('position_id')
                    .annotate(total=Count('id')).values_list('position_id', 'total'))
    openings = active_positions()
    scoped_catalog = user.role == 'instructor' or bool(institute_id or program_id or batch_id)
    if scoped_catalog:
        openings = for_programs(openings, {batch.program_id for batch in selected})
    catalog = list(openings.select_related('company').order_by('company__name', 'title', 'id'))
    if position_id and position_id not in {position.id for position in catalog}:
        raise NotFound('Position not found.')
    if company_id and company_id not in {position.company_id for position in catalog}:
        raise NotFound('Partner has no configured positions.')
    capacity = [{'id': position.id, 'company_id': position.company_id, 'company': position.company.name,
        'name': position.title, 'area': area_of(position.company.address), 'total': position.slots_available or 0,
        'occupied': occupied.get(position.id, 0), 'remaining': max(0, (position.slots_available or 0) - occupied.get(position.id, 0))}
        for position in catalog if (not position_id or position.id == position_id)
        and (not company_id or position.company_id == company_id)
        and (not params.get('area') or area_of(position.company.address) == params['area'])]
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
    dashboard_attention = {}
    if user.role == 'admin':
        enrolled = BatchEnrollment.objects.filter(student_id=OuterRef('student_id'), batch_id=OuterRef('assessment__batch_id'))
        pending_requests = StudentResponse.objects.filter(assessment__batch_id__in=selected_ids,
            assessment__batch__status='active', assessment__archived_at__isnull=True, student__is_active=True,
            retake_request_status='pending').filter(Exists(enrolled))
        request_scopes = list(pending_requests.values('assessment__batch__institute_id', 'assessment__batch__program_id').annotate(count=Count('id')))
        required_batches = {item.batch_id for item in assessments if not item.is_archived and item.publication_status == Assessment.PUBLICATION_PUBLISHED and item.is_required and item.include_in_competency}
        dashboard_attention = {
            'pending_retakes': sum(item['count'] for item in request_scopes),
            'retake_scopes': [{'institute_id': item['assessment__batch__institute_id'], 'program_id': item['assessment__batch__program_id'], 'count': item['count']} for item in request_scopes],
            'batches_without_required': [item.pk for item in selected if item.status == 'active' and item.pk not in required_batches],
            'unavailable_results': sum('Final results unavailable' in row['reasons'] for row in students),
        }
    email_ready = email_storage_ready()
    batch_options = [{'id': batch.id, 'name': batch.name, 'status': batch.status, 'instructor_id': batch.instructor_id,
                      'institute_id': batch.institute_id, 'program_id': batch.program_id} for batch in owned]
    email_payload = {'email_storage_ready': email_ready,
        'email_notifications': reminders(selected) if email_ready else [],
        'email_progress': progress_groups([batch for batch in selected if batch.status == 'active']) if email_ready else []}
    if not full:
        return {'generated_at': now.isoformat(), 'role': user.role, 'view': 'overview',
            'scope': {'batch_ids': selected_ids, 'institute_id': institute_id, 'program_id': program_id, 'batch_status': status},
            'summary': summary, 'dashboard_attention': dashboard_attention, **email_payload,
            'students': students, 'skills': sorted(skill_rows.values(), key=lambda row: row['name']),
            'options': {'batches': batch_options}}

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
        if day <= today:
            events.add((student_id, assessment_id, submitted_at.isoformat(), day))
    for response in response_scope.select_related('assessment'):
        add_event(response.student_id, response.assessment.batch_id, response.assessment_id,
                  response.submitted_at, response.status, response.is_flagged)
    for history in AssessmentAttemptHistory.objects.filter(response__in=response_scope).select_related('response__assessment'):
        add_event(history.response.student_id, history.response.assessment.batch_id, history.response.assessment_id,
                  history.submitted_at, history.status, history.is_flagged)
    activity_days = Counter(event[3] for event in events)
    start, activity_interval, activity = submission_activity(events, start, end, activity_period)
    return {'generated_at': now.isoformat(), 'role': user.role,
        'scope': {'batch_ids': selected_ids, 'batch_status': status, 'course': course, 'instructor_id': instructor_id,
            'institute_id': institute_id, 'program_id': program_id,
            'assessment_id': assessment_id, 'company_id': company_id, 'position_id': position_id, 'area': params.get('area', ''),
            'date_from': start.isoformat(), 'date_to': end.isoformat(),
            'activity_period': activity_period, 'activity_interval': activity_interval,
            'shared_batch_ids': [batch.pk for batch in selected if batch.institute_id and not batch.program_id],
            'cohort_unit': 'Distinct students; newest selected enrollment. Active batches exclude archived accounts; archived batches retain historical enrollments.',
            'capacity_scope': 'Eligible openings; occupancy includes all current approvals' if scoped_catalog else 'Shared system-wide slots; only partner/position/area filters apply',
            'activity_note': 'Recorded valid submitted attempts, including saved prior retakes. Not a historical completion rate. Deleted records and unsaved historical states cannot be reconstructed.'},
        'summary': summary, 'dashboard_attention': dashboard_attention, **email_payload,
        'students': students, 'placement_students': placed_filtered,
        'assessments': list(attempt_rows.values()), 'batches': list(batch_rows.values()),
        'skills': sorted(skill_rows.values(), key=lambda row: row['name']), 'capacity': capacity,
        'match_bands': [{'name': name, 'count': count} for name, count in match_bands.items()],
        'companies': [{'id': key[0], 'name': key[1], 'count': count} for key, count in company_counts.most_common()],
        'areas': [{'name': name, 'count': count} for name, count in area_counts.most_common()], 'geography': geography, 'activity': activity,
        'activity_days': [{'date': day.isoformat(), 'submissions': count} for day, count in sorted(activity_days.items())],
        'options': {'batches': batch_options,
            'institutes': institute_options,
            'programs': program_options,
            'instructors': [{'id': owner_id, 'name': name} for owner_id, name in sorted({(batch.instructor_id, batch.instructor.name) for batch in owned})] if user.role == 'admin' else [],
            'courses': sorted(set(BatchEnrollment.objects.filter(batch_id__in=owned_map, student__role='student')
                                  .exclude(student__course='').values_list('student__course', flat=True))),
            'assessments': [{'id': assessment.id, 'name': assessment.title, 'batch_id': assessment.batch_id} for assessment in assessments],
            'companies': [{'id': key, 'name': name} for key, name in sorted({(position.company_id, position.company.name) for position in catalog})],
            'positions': [{'id': position.id, 'name': position.title, 'company_id': position.company_id} for position in catalog],
            'areas': sorted({area_of(position.company.address) for position in catalog})}}


@never_cache
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def management_analytics(request):
    return Response(analytics_payload(request.user, request.query_params))
