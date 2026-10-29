"""Bounded staff collection payloads; full evidence is fetched for one student.

Select pages using small saved-state reads. Keep the existing result gates and
serializers shared with legacy dashboard/report consumers. No recalculation.
"""
from collections import Counter

from django.db.models import Max
from rest_framework.exceptions import ValidationError

from .models import (Assessment, BatchEnrollment, CombinedCategoryScore, OJTPlacement,
                     Recommendation, SkillScore, StudentResponse, User)
from .placement_scope import current_approvals


def _integer(params, key, default, maximum):
    value = params.get(key, str(default))
    if len(value) > 19 or not value.isascii() or not value.isdigit() or not 1 <= int(value) <= maximum:
        raise ValidationError({'error': f'Invalid {key}.'})
    return int(value)


def detail_student_id(params):
    if 'student_id' not in params:
        return None
    if len(params.getlist('student_id')) != 1:
        raise ValidationError({'error': 'Repeated student_id.'})
    return _integer(params, 'student_id', 1, 2**63 - 1)


def _parameters(params, choices):
    allowed = {'page', 'page_size', 'counts_only', 'search', '_t'} | set(choices)
    if set(params) - allowed or any(len(params.getlist(key)) != 1 for key in params):
        raise ValidationError({'error': 'Unsupported or repeated collection filter.'})
    values = {}
    for key, (default, options) in choices.items():
        value = params.get(key, default)
        if len(value) > 255 or (options is not None and value not in options):
            raise ValidationError({'error': f'Invalid {key}.'})
        values[key] = value
    if len(params.get('search', '')) > 255 or params.get('counts_only', '0') not in ('0', '1'):
        raise ValidationError({'error': 'Invalid collection query.'})
    return values, _integer(params, 'page', 1, 1000000), _integer(params, 'page_size', 10, 50)


def _page(rows, requested, size):
    page = min(requested, max(1, (len(rows) + size - 1) // size))
    return rows[(page - 1) * size:page * size], {'count': len(rows), 'page': page, 'page_size': size}


def _search(row, query):
    return not query or any(query in str(row.get(key) or '').lower() for key in ('name', 'email', 'school_id'))


def admin_collection(params):
    from .views import _admin_users_payload, admin_current_management_states

    filters, page, size = _parameters(params, {
        'tab': ('students', {'students', 'instructors', 'pending', 'all', 'archived'}),
        'status': ('all', {'all', 'completed', 'pending', 'stopped'}),
        'course': ('all', None), 'instructor': ('all', None),
        'sort': ('name', {'name', 'course', 'match'}), 'direction': ('asc', {'asc', 'desc'}),
    })
    users = list(User.objects.filter(role__in=['student', 'instructor']).only(
        'name', 'email', 'school_id', 'course', 'role', 'is_active', 'is_approved', 'address').order_by('name', 'id'))
    students = [user for user in users if user.role == 'student' and user.is_active]
    current, states = admin_current_management_states(students, summary_only=True)
    ids = [student.id for student in students]
    latest = {}
    for sid, status in StudentResponse.objects.filter(student_id__in=ids).order_by('student_id', '-started_at', '-id').values_list('student_id', 'status'):
        latest.setdefault(sid, status)
    top = {(row['student_id'], row['batch_id']): row['score'] for row in
           Recommendation.objects.filter(student_id__in=ids, is_current=True).order_by()
           .values('student_id', 'batch_id').annotate(score=Max('match_score'))}
    instructors = {}
    for sid, name in BatchEnrollment.objects.filter(student_id__in=ids).values_list('student_id', 'batch__instructor__name'):
        instructors.setdefault(sid, name)
    rows = []
    counts = dict.fromkeys(('all', 'students', 'instructors', 'pending', 'archived'), 0)
    instructor_options = set()
    for user in users:
        bucket = ('archived' if not user.is_active else 'students' if user.role == 'student'
                  else 'instructors' if user.is_approved else 'pending')
        counts[bucket] += 1
        counts['all'] += int(bucket in ('students', 'instructors'))
        enrollment = current.get(user.id)
        unlocked = states.get(user.id, ({}, False))[1]
        instructor = (enrollment.batch.instructor.name if enrollment else instructors.get(user.id)) or 'TBD'
        if bucket == 'students':
            instructor_options.add(instructor)
        row = {'id': user.id, 'name': user.name, 'email': user.email, 'school_id': user.school_id,
               'course': user.course if user.role == 'student' else None,
               'bucket': bucket, 'instructor': instructor,
               'status': 'stopped' if latest.get(user.id) == 'stopped' else 'completed' if unlocked else 'pending',
               'match': round(top[(user.id, enrollment.batch_id)], 2)
               if enrollment and unlocked and (user.id, enrollment.batch_id) in top else -1}
        rows.append(row)
    query = params.get('search', '').strip().lower()
    tab = filters['tab']
    rows = [row for row in rows if (row['bucket'] in ('students', 'instructors') if tab == 'all' else row['bucket'] == tab)
            and (tab == 'pending' or _search(row, query))
            and (tab != 'students' or (
                (filters['status'] == 'all' or row['status'] == filters['status'])
                and (filters['course'] == 'all' or row['course'] == filters['course'])
                and (filters['instructor'] == 'all' or row['instructor'] == filters['instructor'])))]
    # A stable ID tie-break prevents records being skipped between equal-key pages.
    rows.sort(key=lambda row: (row[filters['sort']] if row[filters['sort']] is not None else '', row['id']),
              reverse=filters['direction'] == 'desc')
    selected, pagination = _page(rows, page, size)
    payload = _admin_users_payload([row['id'] for row in selected] if params.get('counts_only') != '1' else [], include_history=False)
    for key in ('students', 'instructors', 'pending_instructors', 'archived_students', 'archived_instructors'):
        by_id = {row['id']: row for row in payload[key]}
        payload[key] = [by_id[row['id']] for row in selected if row['id'] in by_id]
    for row in payload['students']:
        row['detail_url'] = f"/api/admin/users/?student_id={row['id']}"
    return {**payload, 'pagination': pagination, 'counts': counts,
            'options': {'instructors': sorted(instructor_options)}}


def batch_collection(params, batch):
    from .views import _batch_students_payload, bulk_management_states

    filters, page, size = _parameters(params, {
        'course': ('all', None), 'account': ('all', {'all', 'active', 'archived'}),
        'assessment': ('all', {'all', 'complete', 'incomplete', 'stopped', 'retake'}),
        'recommendation': ('all', {'all', 'available', 'awaiting', 'approved'}),
    })
    students = list(User.objects.filter(enrollments__batch=batch).only(
        'name', 'email', 'school_id', 'course', 'address', 'is_active').order_by('name', 'id'))
    ids = [student.id for student in students]
    states = bulk_management_states(students, batch, summary_only=True)
    rec_ids = set(Recommendation.objects.filter(student_id__in=ids, batch=batch, is_current=True).values_list('student_id', flat=True))
    approved_ids = set(current_approvals(student_id__in=ids).values_list('student_id', flat=True))
    recorded_approved = set(OJTPlacement.objects.filter(student_id__in=ids, batch=batch, status='approved', is_active_suggestion=False).values_list('student_id', flat=True))
    rows = []
    for student in students:
        state, unlocked = states[student.id]
        attempts = state['assessment_results']
        available = student.is_active and unlocked and student.id in rec_ids
        rows.append({'id': student.id, 'name': student.name, 'email': student.email, 'school_id': student.school_id,
            'course': student.course, 'archived': not student.is_active,
            'complete': state['all_required_completed'], 'unlocked': student.is_active and unlocked,
            'stopped': any(a['attempt_status'] == 'stopped' or a['is_flagged'] for a in attempts),
            'retake': any(a['retake_allowed'] for a in attempts), 'available': available,
            'awaiting': available and student.id not in approved_ids, 'approved': student.id in recorded_approved})
    assessments = list(Assessment.objects.filter(batch=batch, publication_status='published').values('is_required', 'include_in_competency'))
    summary = {'student_count': len(rows), 'courses': dict(Counter(row['course'] for row in rows)),
        'published_required_count': sum(a['is_required'] and a['include_in_competency'] for a in assessments),
        'optional_count': sum(not a['is_required'] for a in assessments),
        'completed_students': sum(row['complete'] for row in rows),
        'in_progress_students': sum(not row['complete'] for row in rows),
        'stopped_or_flagged_students': sum(row['stopped'] for row in rows),
        'retake_approved_students': sum(row['retake'] for row in rows),
        'recommendations_unlocked_students': sum(row['unlocked'] for row in rows),
        'recommendations_available_students': sum(row['available'] for row in rows),
        'awaiting_review_students': sum(row['awaiting'] for row in rows)}
    complete_ids = [row['id'] for row in rows if row['complete']]
    unlocked_ids = [row['id'] for row in rows if row['unlocked']]
    raw_names, combined_names = {}, {}
    for sid, name in SkillScore.objects.filter(student_id__in=ids, assessment__batch=batch).values_list('student_id', 'skill_category__name'):
        raw_names.setdefault(sid, set()).add(name)
    for sid, name in CombinedCategoryScore.objects.filter(student_id__in=unlocked_ids, batch=batch).values_list('student_id', 'skill_category__name'):
        combined_names.setdefault(sid, set()).add(name)
    score_names = {sid: combined_names.get(sid) or raw_names.get(sid, set()) for sid in ids}
    categories = {name for sid in complete_ids for name in score_names[sid]}
    if not categories:
        categories = {name for names in score_names.values() for name in names}
    query = params.get('search', '').strip().lower()
    filtered = [row for row in rows if _search(row, query)
        and (filters['course'] == 'all' or row['course'] == filters['course'])
        and (filters['account'] == 'all' or row['archived'] == (filters['account'] == 'archived'))
        and (filters['assessment'] == 'all' or (not row['complete'] if filters['assessment'] == 'incomplete' else row[filters['assessment']]))
        and (filters['recommendation'] == 'all' or row[filters['recommendation']])]
    selected, pagination = _page(filtered, page, size)
    payload = (_batch_students_payload(batch, [row['id'] for row in selected], include_history=False)
               if params.get('counts_only') != '1' else {'batch': {'id': batch.id, 'name': batch.name}, 'students': []})
    by_id = {row['id']: row for row in payload['students']}
    for row in by_id.values():
        row['detail_url'] = f"/api/instructor/batches/{batch.id}/students/?student_id={row['id']}"
    return {**payload, 'students': [by_id[row['id']] for row in selected if row['id'] in by_id],
            'summary': summary, 'categories': sorted(categories), 'pagination': pagination}
