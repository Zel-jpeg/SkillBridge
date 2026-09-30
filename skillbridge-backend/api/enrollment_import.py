"""Authoritative, side-effect-free enrollment review and atomic confirmation."""
import hashlib
import json
import logging
import re
import unicodedata
from collections import Counter

from django.core import signing
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.db.models.functions import Lower

from .models import Batch, BatchEnrollment, User

logger = logging.getLogger(__name__)
MAX_ROWS = 1000
READY = ('ready', 'existing_student')


def key(value):
    return re.sub(r'[^a-z0-9]', '', str(value).lower())


def email_component(value):
    value = str(value).strip().lower()
    value = re.sub('[‐‑‒–—−]', '-', value)
    value = unicodedata.normalize('NFKD', value)
    value = ''.join(c for c in value if not unicodedata.combining(c))
    value = re.sub(r'[^a-z0-9-]', '', value)
    return re.sub('-+', '-', value).strip('-')


def generate_dnsc_email(first_name, last_name):
    first, last = email_component(first_name), email_component(last_name)
    return f'{last}.{first}@dnsc.edu.ph' if first and last else ''


def format_student_name(value):
    """Capitalize words separated by spaces, without title-casing hyphen parts."""
    return ' '.join(part[:1].upper() + part[1:].lower() for part in str(value).split())


def normalize_program(value):
    normalized = key(value)
    return {
        'bsit': 'BSIT', 'bachelorofscienceininformationtechnology': 'BSIT',
        'bsis': 'BSIS', 'bachelorofscienceininformationsystems': 'BSIS',
    }.get(normalized, str(value).strip().upper())


def normalize_row(item, index):
    values = {key(k): v for k, v in item.items()}
    def field(*aliases):
        return next((str(values[k]).strip() for k in aliases if values.get(k) is not None), '')
    ids = [values[k] for k in ('schoolid', 'studentnumber', 'studentid') if k in values]
    first, last = format_student_name(field('firstname')), format_student_name(field('lastname'))
    email = field('email').lower()
    source = field('emailsource')
    if not email:
        email, source = generate_dnsc_email(first, last), 'Generated'
    elif source not in ('Generated', 'Edited'):
        source = 'Provided'
    name_edited = values.get('nameedited') is True
    display_name = field('name') or ' '.join(filter(None, (first, last)))
    row = {
        'source_row': item.get('source_row', index + 1),
        'worksheet': field('worksheet')[:100],
        'school_id': field('schoolid', 'studentnumber', 'studentid'),
        'first_name': first, 'last_name': last,
        'name': ' '.join(display_name.split()) if name_edited else format_student_name(display_name),
        'name_edited': name_edited,
        'course': normalize_program(field('course', 'program')),
        'year_level': field('yearlevel'), 'email': email, 'email_source': source,
        'status': 'ready', 'issues': [], 'existing_student': False,
    }
    issues = row['issues']
    if any(not isinstance(v, str) for v in ids) or not re.fullmatch(r'\d{4}-\d{5}', row['school_id']):
        issues.append('Student ID must be text in YYYY-NNNNN format.')
    if len({str(v).strip() for v in ids}) > 1:
        issues.append('Student ID aliases disagree.')
    if not row['name'] or len(row['name']) > 255:
        issues.append('A display name of 1–255 characters is required.')
    # Legacy templates provide a full name and email; never guess their split.
    if field('format') == 'iams' or first or last or source == 'Generated':
        if not email_component(first) or not email_component(last):
            issues.append('Correct the missing or unusable first and last names.')
    try:
        validate_email(email)
        if len(email) > 254 or email.rsplit('@', 1)[-1] != 'dnsc.edu.ph':
            raise ValidationError('domain')
    except ValidationError:
        issues.append('A valid @dnsc.edu.ph email is required.')
    if issues:
        row['status'] = 'invalid'
    if row['course'] not in ('BSIT', 'BSIS'):
        row['status'] = 'unsupported'
        issues.append('Unsupported program; only BSIT and BSIS may enroll.')
    row['format'] = field('format')
    return row


def match_row(row, batch, lock=False, matched_users=None, enrolled_ids=None):
    if row['status'] not in READY:
        return row, None
    if matched_users is None:
        query = User.objects.filter(Q(school_id=row['school_id']) | Q(email__iexact=row['email']))
        users = list(query.select_for_update() if lock else query)
    else:
        users = matched_users
    student = users[0] if len(users) == 1 else None
    if users and (len(users) != 1 or student.role != 'student' or not student.is_active
                  or student.email.lower() != row['email']
                  or (student.school_id and student.school_id != row['school_id'])
                  or (student.course and normalize_program(student.course) != row['course'])):
        row.update(status='conflict', issues=['Existing account identity or program conflicts; ask an administrator to resolve it.'])
        return row, None
    if student:
        row['existing_student'] = True
        already = (BatchEnrollment.objects.filter(batch=batch, student=student).exists()
                   if enrolled_ids is None else student.pk in enrolled_ids)
        row['status'] = 'already_enrolled' if already else 'existing_student'
    return row, student


def review_rows(items, batch):
    if not isinstance(items, list) or not 1 <= len(items) <= MAX_ROWS or any(not isinstance(i, dict) for i in items):
        raise ValueError(f'Provide 1–{MAX_ROWS} student rows.')
    rows = [normalize_row(item, i) for i, item in enumerate(items)]
    ids, emails = Counter(r['school_id'] for r in rows), Counter(r['email'] for r in rows)
    # One identity query and one enrollment query, even for multi-sheet imports.
    users = list(User.objects.annotate(normalized_email=Lower('email')).filter(
        Q(school_id__in=[sid for sid in ids if sid]) | Q(normalized_email__in=[email for email in emails if email])))
    by_id, by_email = {}, {}
    for user in users:
        if user.school_id:
            by_id.setdefault(user.school_id, []).append(user)
        by_email.setdefault(user.email.lower(), []).append(user)
    enrolled_ids = set(BatchEnrollment.objects.filter(batch=batch, student_id__in=[u.pk for u in users])
                       .values_list('student_id', flat=True))
    for row in rows:
        if (row['school_id'] and ids[row['school_id']] > 1) or (row['email'] and emails[row['email']] > 1):
            row.update(status='duplicate', issues=row['issues'] + ['Repeated Student ID or email in this file; remove or correct duplicate rows.'])
        else:
            matches = {u.pk: u for u in by_id.get(row['school_id'], []) + by_email.get(row['email'], [])}
            match_row(row, batch, matched_users=list(matches.values()), enrolled_ids=enrolled_ids)
    return rows


def summary(rows):
    counts = Counter(r['status'] for r in rows)
    return {'total': len(rows), 'ready': sum(counts[s] for s in READY),
            'existing_students': sum(r.get('existing_student', False) for r in rows),
            **{s: counts[s] for s in ('already_enrolled', 'duplicate', 'invalid', 'conflict', 'enrolled', 'skipped', 'failed')},
            'unsupported': sum(r['course'] not in ('BSIT', 'BSIS') for r in rows),
            'notifications_queued': sum(r.get('notification_status') == 'queued' for r in rows)}


def digest(items):
    return hashlib.sha256(json.dumps(items, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def review_token(rows, batch, actor):
    return signing.dumps({'digest': digest(rows), 'batch': batch.pk, 'actor': actor.pk}, salt='enrollment-review')


def verify_token(token, rows, batch, actor):
    if not isinstance(token, str) or not isinstance(rows, list):
        return False
    try:
        payload = signing.loads(token, salt='enrollment-review', max_age=1800)
        return payload == {'digest': digest(rows), 'batch': batch.pk, 'actor': actor.pk}
    except (signing.BadSignature, TypeError):
        return False


def confirm_rows(items, batch, notify):
    rows = review_rows(items, batch)
    for row, reviewed in zip(rows, items):
        # A blocked preview row must never become eligible merely because its
        # aliases were canonicalized or a database conflict changed afterward.
        if reviewed.get('status') not in READY:
            row.update(status=reviewed.get('status', 'skipped'), issues=reviewed.get('issues', []))
        row['notification_status'] = 'skipped'
        if row['status'] == 'already_enrolled':
            row['notification_status'] = 'skipped_existing_enrollment'
        if row['status'] not in READY:
            continue
        try:
            with transaction.atomic():
                # Serialize enrollment/archive decisions for this batch; identity
                # uniqueness is also enforced by database constraints across batches.
                locked_batch = Batch.objects.select_for_update().get(pk=batch.pk)
                if locked_batch.status != 'active':
                    row.update(status='skipped', issues=['Batch is no longer active.'])
                    continue
                row, student = match_row(row, locked_batch, lock=True)
                if row['status'] not in READY:
                    if row['status'] == 'already_enrolled':
                        row['notification_status'] = 'skipped_existing_enrollment'
                    continue
                if student is None:
                    student = User.objects.create_user(email=row['email'], name=row['name'], role='student',
                                                       school_id=row['school_id'], course=row['course'], is_approved=True)
                else:
                    student.is_approved = True
                    student.school_id = student.school_id or row['school_id']
                    student.course = student.course or row['course']
                    student.save(update_fields=['is_approved', 'school_id', 'course'])
                enrollment, created = BatchEnrollment.objects.get_or_create(batch=locked_batch, student=student)
                row.update(status='enrolled' if created else 'already_enrolled', id=student.pk, enrollment_id=enrollment.pk)
                if created:
                    def after_commit(result=row, person=student, record_id=enrollment.pk):
                        try:
                            result['notification_status'] = 'queued' if notify(person, record_id) else 'dispatch_failed'
                        except Exception:
                            logger.warning('Enrollment notification dispatch failed enrollment_id=%s', record_id)
                            result['notification_status'] = 'dispatch_failed'
                    transaction.on_commit(after_commit)
                else:
                    row['notification_status'] = 'skipped_existing_enrollment'
        except IntegrityError:
            row.update(status='conflict', issues=['Identity changed during confirmation. Preview again.'], notification_status='skipped')
        except Exception:
            logger.warning('Enrollment row failed batch_id=%s', batch.pk)
            row.update(status='failed', issues=['Enrollment failed for this row. Preview again before retrying.'], notification_status='skipped')
    return rows
