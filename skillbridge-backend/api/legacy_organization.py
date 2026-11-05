"""One-time mapping for the reviewed DNSC computing labels in existing records."""
from collections import Counter, defaultdict

from django.db import connections
from django.db.models import Q

from .models import Batch, BatchEnrollment, Institute, Program, User
from .program_scope import label_key


INSTITUTE = {'code': 'IC', 'name': 'Institute of Computing'}
PROGRAMS = {
    'BSIT': {'name': 'Bachelor of Science in Information Technology', 'aliases': []},
    'BSIS': {'name': 'Bachelor of Science in Information Systems',
             'aliases': ['Bachelor of Science in Information System']},
}
INSTITUTE_LABELS = {label_key(label) for label in INSTITUTE.values()}
COURSE_CODES = {label_key(label): code for code, program in PROGRAMS.items()
                for label in [code, program['name'], *program['aliases']]}


def mapping_plan(using='default'):
    institutes = list(Institute.objects.using(using).filter(
        Q(code__iexact=INSTITUTE['code']) | Q(name__iexact=INSTITUTE['name'])).order_by('pk').values())
    if len(institutes) > 1 or any(
            not row['is_active'] or any(row[field].casefold() != value.casefold() for field, value in INSTITUTE.items())
            for row in institutes):
        raise ValueError('Conflicting or inactive computing institute configuration.')
    institute_id = institutes[0]['id'] if institutes else None
    existing_programs = list(Program.objects.using(using).filter(institute_id=institute_id).order_by('pk').values())
    found = {}
    for row in existing_programs:
        code = row['code'].upper()
        labels = {label_key(label) for label in [row['code'], row['name'], *row['aliases']]}
        claims = {COURSE_CODES[label] for label in labels if label in COURSE_CODES}
        if claims and (claims != {code} or not row['is_active'] or label_key(row['name']) not in COURSE_CODES):
            raise ValueError('Conflicting or inactive computing program configuration.')
        if claims:
            found[code] = row['id']

    batches = {row['id']: row for row in Batch.objects.using(using).order_by('pk')
               .values('id', 'institute_id', 'program_id', 'framework_id', 'program__institute_id', 'status')}
    memberships, rosters = defaultdict(list), defaultdict(list)
    for student, batch in BatchEnrollment.objects.using(using).order_by('pk').values_list('student_id', 'batch_id'):
        memberships[student].append(batch)
        rosters[batch].append(student)

    known, updates, review = {}, {}, Counter()
    for row in User.objects.using(using).filter(role='student').order_by('pk').values('id', 'program_id', 'course', 'department'):
        student, current_program = row['id'], row['program_id']
        course_code = COURSE_CODES.get(label_key(row['course']))
        if current_program:
            if course_code and found.get(course_code) == current_program:
                known[student] = course_code
            continue
        if not course_code or label_key(row['department']) not in INSTITUTE_LABELS:
            review['students_without_confirmed_labels'] += 1
            continue
        if any((batch['institute_id'] is not None and batch['institute_id'] != institute_id)
               or (batch['program_id'] is not None and batch['program_id'] != found.get(course_code))
               for batch in (batches[key] for key in memberships[student])):
            review['students_with_conflicting_enrollments'] += 1
            continue
        known[student] = updates[student] = course_code

    batch_updates = []
    for batch_id, row in batches.items():
        if row['institute_id'] or row['program_id'] or row['framework_id']:
            continue
        if not rosters[batch_id] or any(student not in known for student in rosters[batch_id]):
            review['batches_with_empty_or_unconfirmed_rosters'] += 1
            continue
        batch_updates.append(batch_id)
    return {'institute_id': institute_id, 'existing_programs': found,
            'students': updates, 'batches': batch_updates, 'review_counts': dict(review),
            'relevant_catalog': {'institutes': institutes, 'programs': existing_programs}}


def mapping_summary(plan):
    changes = bool(plan['students'] or plan['batches'])
    return {'students_by_program': dict(Counter(plan['students'].values())), 'batches': len(plan['batches']),
            'institute_to_create': changes and plan['institute_id'] is None,
            'programs_to_create': sorted(PROGRAMS.keys() - plan['existing_programs'].keys()) if changes else [],
            'review_counts': plan['review_counts']}


def apply_mapping(plan, using='default'):
    if not connections[using].in_atomic_block:
        raise RuntimeError('IC reconciliation requires an atomic transaction.')
    summary = mapping_summary(plan)
    if not (plan['students'] or plan['batches']):
        return summary
    institute_id = plan['institute_id'] or Institute.objects.using(using).create(**INSTITUTE).pk
    programs = dict(plan['existing_programs'])
    for code in summary['programs_to_create']:
        programs[code] = Program.objects.using(using).create(institute_id=institute_id, code=code, **PROGRAMS[code]).pk
    for code, count in summary['students_by_program'].items():
        ids = [student for student, target in plan['students'].items() if target == code]
        actual = User.objects.using(using).filter(pk__in=ids, program__isnull=True).update(program_id=programs[code])
        if actual != count:
            raise ValueError('Student program links changed after review.')
    actual = Batch.objects.using(using).filter(pk__in=plan['batches'], institute__isnull=True,
                                               program__isnull=True, framework__isnull=True).update(institute_id=institute_id)
    if actual != summary['batches']:
        raise ValueError('Batch links changed after review.')
    return summary
