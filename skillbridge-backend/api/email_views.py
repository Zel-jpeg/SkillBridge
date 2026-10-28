"""Scoped enrollment email controls. GET is read-only; sends require reviewed IDs."""
from collections import Counter
from datetime import timedelta
import hashlib
import hmac
import json
import uuid

from django.conf import settings
from django.core import signing
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .email_outbox import UNSENT, email_storage_ready, enrollment_content, publish, record_event
from .management_access import record_action
from .email_progress import progress_groups, snapshot
from .models import (Batch, BatchEnrollment, EmailCommand, EmailDispatchControl, EmailNotice)

LABELS = {'held': 'Not scheduled', 'queued': 'Queued', 'sending': 'Sending',
          'quota': 'Waiting for daily allowance', 'retry': 'Retry scheduled',
          'accepted': 'Submitted', 'provider_pending': 'Delivery pending',
          'delivered': 'Delivered', 'failed': 'Needs attention', 'uncertain': 'Delivery uncertain',
          'cancelled': 'Cancelled', 'history_unavailable': 'History unavailable'}
REASONS = {
    'configuration': 'Email service needs administrator attention. Enrollment is saved.',
    'allowance_unavailable': 'Provider allowance could not be checked. Emails remain saved for another check.',
    'quota': 'Daily email allowance reached. Students are enrolled; pending emails will resume automatically when allowance is available.',
    'reserved_allowance': 'The remaining allowance is reserved for account notifications. Enrollment emails remain pending until more allowance is available.',
    'rate_limit': 'Provider request limit reached. Another attempt is scheduled.',
    'connection': 'The provider could not be reached. Another attempt is scheduled.',
    'acceptance_unknown': 'The provider may already have accepted this message. Review delivery history before an intentional resend.',
    'provider_rejected': 'The provider rejected this request. An administrator should review the sender and recipient.',
    'eligibility_changed': 'This account, batch, enrollment or responsible staff assignment is no longer eligible.',
    'invalid_recipient': 'The provider reported an invalid recipient. Review the student identity/address through the existing management workflow.',
    'hard_bounce': 'The recipient permanently rejected the email. Review the address before sending again.',
    'soft_bounce': 'The provider finished its temporary delivery attempts without confirming delivery.',
    'blocked': 'Sending to this recipient is blocked. Contact your administrator.',
    'spam': 'The recipient reported spam. Further enrollment emails are blocked.',
    'unsubscribed': 'The recipient is suppressed. Further enrollment emails are blocked.',
    'provider_error': 'Provider delivery failed. Review the history before sending again.',
}


def staff_batch(request, batch_id, *, lock=False):
    if not request.user.is_active or request.user.role not in ('admin', 'instructor') or (
            request.user.role == 'instructor' and not request.user.is_approved):
        raise PermissionDenied('Staff access required.')
    batches = Batch.objects.select_related('instructor')
    if lock:
        batches = batches.select_for_update(of=('self',))
    if request.user.role == 'instructor':
        batches = batches.filter(instructor=request.user)
    return get_object_or_404(batches, pk=batch_id)


def setup_pending():
    return Response({'error': 'Email delivery setup is pending. Apply backend migration 0027.',
                     'code': 'email_setup_required'}, status=503)


def roster(batch):
    enrollments = list(BatchEnrollment.objects.filter(batch=batch).select_related('student').order_by('student__name', 'pk'))
    notices = EmailNotice.objects.filter(kind='enrollment', batch_id_snapshot=batch.pk,
        enrollment_id__in=[enrollment.pk for enrollment in enrollments]).only(
            'id', 'enrollment_id', 'status', 'reason', 'created_at', 'updated_at', 'due_at',
            'attempts', 'accepted_at', 'delivered_at').prefetch_related('delivery_attempts').order_by('-created_at', '-pk')
    latest, history = {}, {}
    for notice in notices:
        if notice.enrollment_id not in latest:
            latest[notice.enrollment_id] = notice
        if len(history.setdefault(notice.enrollment_id, [])) < 5:
            history[notice.enrollment_id].append(notice)
    return enrollments, latest, history


def fingerprint(enrollments, latest):
    return hashlib.sha256(json.dumps([
        [e.pk, e.student_id, e.student.email, e.student.is_active, e.student.is_approved,
         str(latest[e.pk].pk), latest[e.pk].status, latest[e.pk].updated_at.isoformat()]
        if e.pk in latest else [e.pk, e.student_id, e.student.email, e.student.is_active, e.student.is_approved]
        for e in enrollments], separators=(',', ':')).encode()).hexdigest()


def serialize(notice):
    attempts = sorted(notice.delivery_attempts.all(), key=lambda attempt: attempt.pk)[-5:]
    return {'id': str(notice.pk), 'status': notice.status, 'label': LABELS[notice.status],
            'reason': REASONS.get(notice.reason, ''), 'created_at': notice.created_at,
            'updated_at': notice.updated_at, 'next_attempt': notice.due_at if notice.status in ('retry', 'quota', 'queued') else None,
            'attempts': notice.attempts, 'accepted_at': notice.accepted_at, 'delivered_at': notice.delivered_at,
            'attempt_history': [{'label': LABELS[attempt.status], 'reason': REASONS.get(attempt.reason, ''),
                                 'created_at': attempt.created_at, 'http_status': attempt.http_status} for attempt in attempts]}


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def enrollment_emails(request, batch_id):
    batch = staff_batch(request, batch_id)
    if request.method == 'POST':
        return change_emails(request, batch_id)
    if not email_storage_ready():
        return setup_pending()
    enrollments, latest, history = roster(batch)
    control = EmailDispatchControl.objects.filter(pk=1).first()
    rows = []
    for enrollment in enrollments:
        person, notice = enrollment.student, latest.get(enrollment.pk)
        status = notice.status if notice else 'history_unavailable'
        rows.append({'student_id': person.pk, 'enrollment_id': enrollment.pk, 'name': person.name,
                     'school_id': person.school_id, 'email': person.email, 'photo_url': person.photo_url,
                     'eligible': person.is_active and person.is_approved and batch.status == 'active' and person.email.casefold().endswith('@dnsc.edu.ph'),
                     'status': status, 'label': LABELS[status],
                     'notice': serialize(notice) if notice else None,
                     'history': [serialize(n) for n in history.get(enrollment.pk, [])]})
    token = signing.dumps({'batch': batch.pk, 'actor': request.user.pk,
                          'fingerprint': fingerprint(enrollments, latest)}, salt='email-roster')
    heartbeat = control.heartbeat_at if control else None
    waiting = sum(row['eligible'] and row['status'] in ('queued', 'retry', 'quota', 'sending') for row in rows)
    service = {'worker_recent': bool(heartbeat and heartbeat > timezone.now() - timedelta(minutes=10)),
               'waiting_count': waiting, 'notice': REASONS.get(control.reason, '') if control and waiting else ''}
    if request.user.role == 'admin' and waiting:
        service['diagnostics'] = {'worker_recent': service['worker_recent'],
            'next_allowance_check': control.check_after if control and control.reason else None,
            'allowance_checked_at': control.checked_at if control else None}
    return Response({'batch': {'id': batch.pk, 'name': batch.name, 'status': batch.status},
                     'groups': progress_groups([batch]),
                     'rows': rows, 'summary': dict(Counter(row['status'] for row in rows)), 'review_token': token,
                     'service': service})


def change_emails(request, batch_id):
    data = request.data
    if not isinstance(data, dict) or set(data) - {'action', 'student_ids', 'review_token', 'request_id', 'reason'}:
        raise ValidationError({'error': 'Provide an email action and reviewed student selection.'})
    action, ids = data.get('action'), data.get('student_ids')
    if action not in ('send', 'retry', 'resend', 'hold', 'cancel') or not isinstance(ids, list) or not 1 <= len(ids) <= 1000:
        raise ValidationError({'error': 'Choose an action and 1–1000 students.'})
    if any(type(pk) is not int or pk <= 0 for pk in ids) or len(set(ids)) != len(ids):
        raise ValidationError({'error': 'Student IDs must be distinct positive integers.'})
    reason = data.get('reason', '')
    if not isinstance(reason, str) or len(reason) > 200 or action == 'resend' and not reason.strip():
        raise ValidationError({'error': 'Record a short reason for an intentional resend.'})
    try:
        request_id = uuid.UUID(data.get('request_id', ''))
    except (ValueError, TypeError, AttributeError):
        raise ValidationError({'error': 'Provide a valid request ID.'})
    digest = hashlib.sha256(json.dumps([batch_id, action, sorted(ids), reason], separators=(',', ':')).encode()).hexdigest()
    with transaction.atomic():
        batch = staff_batch(request, batch_id, lock=True)
        if not email_storage_ready():
            return setup_pending()
        if batch.status != 'active':
            return Response({'error': 'Archived batches are read-only.'}, status=409)
        previous = EmailCommand.objects.filter(pk=request_id).first()
        if previous:
            if previous.actor_id != request.user.pk or previous.digest != digest:
                return Response({'error': 'This request ID is already in use.'}, status=409)
            return Response(previous.result)
        enrollments, latest, _ = roster(batch)
        try:
            reviewed = signing.loads(data.get('review_token', ''), salt='email-roster', max_age=600)
        except (signing.BadSignature, TypeError):
            reviewed = None
        if reviewed != {'batch': batch.pk, 'actor': request.user.pk, 'fingerprint': fingerprint(enrollments, latest)}:
            return Response({'error': 'Email status or recipients changed. Refresh and review the selection again.'}, status=409)
        selected = [e for e in enrollments if e.student_id in ids]
        if len(selected) != len(ids):
            raise ValidationError({'error': 'Choose students currently enrolled in this batch.'})
        locked = {notice.pk: notice for notice in EmailNotice.objects.select_for_update().filter(
            pk__in=[latest[e.pk].pk for e in selected if e.pk in latest])}
        suppressed_addresses = {(student_id, email.casefold()) for student_id, email in EmailNotice.objects.filter(
            student_id__in=ids, suppressed=True).values_list('student_id', 'recipient')}
        updates, new_notices, group_notices = [], [], []
        changed, skipped = 0, 0
        now = timezone.now()
        for enrollment in selected:
            person, notice = enrollment.student, latest.get(enrollment.pk)
            if not person.is_active or not person.is_approved or not person.email.casefold().endswith('@dnsc.edu.ph'):
                skipped += 1
                continue
            if notice:
                notice = locked[notice.pk]
            status = notice.status if notice else 'history_unavailable'
            if action in ('hold', 'cancel'):
                if notice and status in UNSENT:
                    notice.status = 'held' if action == 'hold' else 'cancelled'
                    notice.reason = ''
                    updates.append(notice)
                    changed += 1
                else:
                    skipped += 1
                continue
            suppressed = (person.pk, person.email.casefold()) in suppressed_addresses
            if suppressed:
                skipped += 1
                continue
            if action == 'retry' and notice and status == 'failed' and notice.reason in ('configuration', 'connection', 'rate_limit'):
                if person.email.casefold() != notice.recipient.casefold():
                    skipped += 1
                    continue
                notice.actor = request.user
                notice.status, notice.reason, notice.attempts, notice.due_at = 'queued', '', 0, timezone.now()
                updates.append(notice)
                group_notices.append(notice)
                changed += 1
            elif action == 'send' and notice and status == 'held':
                if person.email.casefold() != notice.recipient.casefold():
                    skipped += 1
                    continue
                notice.actor = request.user
                notice.status, notice.due_at = 'queued', timezone.now()
                updates.append(notice)
                group_notices.append(notice)
                changed += 1
            elif (action == 'send' and notice is None) or (action == 'resend' and status in ('accepted', 'provider_pending', 'delivered', 'uncertain', 'failed', 'cancelled')):
                if notice and notice.updated_at > timezone.now() - timedelta(minutes=15):
                    skipped += 1
                    continue
                subject, body, html = enrollment_content(person, batch)
                new_notices.append(EmailNotice(key=f'{request_id}:{person.pk}', kind='enrollment',
                    student=person, enrollment=enrollment, batch_id_snapshot=batch.pk, actor=request.user,
                    recipient=person.email, recipient_name=person.name, subject=subject, body=body, html_body=html))
                changed += 1
            else:
                skipped += 1
        for notice in updates:
            notice.updated_at = now
        if updates:
            EmailNotice.objects.bulk_update(updates, ['status', 'reason', 'due_at', 'attempts', 'actor', 'updated_at'], batch_size=200)
        if new_notices:
            EmailNotice.objects.bulk_create(new_notices, batch_size=200)
        result = {'changed': changed, 'skipped': skipped, 'request_id': str(request_id)}
        if action in ('send', 'retry', 'resend') and (group_notices or new_notices):
            result['email_group'] = snapshot(group_notices + new_notices, source=action)
        EmailCommand.objects.create(id=request_id, actor=request.user, batch_id_snapshot=batch.pk, digest=digest, result=result)
        record_action(request.user, f'email.{action}', 'batch', batch.pk, batch.pk,
                      changed=changed, skipped=skipped, reason=reason.strip())
        publish(batch.pk)
    return Response(result)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def email_progress(request, batch_id):
    batch = staff_batch(request, batch_id)
    if not email_storage_ready():
        return Response({'groups': [], 'storage_ready': False})
    return Response({'groups': progress_groups([batch]), 'storage_ready': True})


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def brevo_event(request):
    secret = getattr(settings, 'BREVO_WEBHOOK_SECRET', '')
    authorization = request.headers.get('Authorization', '')
    provided = request.headers.get('X-SkillBridge-Webhook', '') or (
        authorization[7:] if authorization.startswith('Bearer ') else '')
    if not secret or not hmac.compare_digest(secret.encode(), provided.encode()):
        return Response({'error': 'Forbidden'}, status=403)
    if len(request.body) > 65536:
        return Response({'error': 'Event too large.'}, status=413)
    try:
        record_event(request.data)
    except (ValueError, TypeError):
        return Response({'error': 'Invalid delivery event.'}, status=400)
    return Response({'received': True})
