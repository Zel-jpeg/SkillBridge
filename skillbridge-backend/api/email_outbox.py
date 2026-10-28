"""Durable email intents, bounded dispatch and authenticated delivery evidence.

Only the management-command worker performs provider IO. Status reads never send.
The singleton lease serializes provider credit reservations across web processes.
"""
from datetime import timedelta, datetime, timezone as dt_timezone
from email.utils import parseaddr, parsedate_to_datetime
import hashlib
import json
import uuid

import requests
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import connection, transaction
from django.db.models import Case, IntegerField, Q, When
from django.utils import timezone

from .models import (BatchEnrollment, EmailAttempt, EmailCommand, EmailDispatchControl, EmailNotice,
                     EmailProviderEvent, User)

UNSENT = ('held', 'queued', 'quota', 'retry', 'failed')
PERMANENT = ('invalid_recipient', 'hard_bounce', 'blocked', 'spam', 'unsubscribed')
EVENTS = {'request', 'sent', 'delivered', 'deferred', 'soft_bounce', 'hard_bounce',
          'blocked', 'invalid', 'error', 'spam', 'unsubscribed'}


def email_storage_ready():
    """Check additive email tables without caching a pre-migration result.

    Optional staff reminders must not prevent existing analytics from loading
    during rollout. Connection errors and unrelated query failures still surface.
    This checks schema availability, not worker or provider configuration.
    """
    required = {model._meta.db_table for model in (
        EmailNotice, EmailAttempt, EmailProviderEvent, EmailDispatchControl, EmailCommand)}
    return required.issubset(connection.introspection.table_names())


def publish(batch_id):
    if not batch_id:
        return
    from .change_events import publish_changes
    from .models import Batch
    owner = Batch.objects.filter(pk=batch_id).values_list('instructor_id', flat=True).first()
    recipients = set(User.objects.filter(role='admin', is_active=True).values_list('id', flat=True))
    if owner:
        recipients.add(owner)
    transaction.on_commit(lambda: publish_changes({pk: {'topics': ['email'], 'batch_ids': [batch_id]}
                                                   for pk in recipients}), robust=True)


def reminders(batches):
    """Current staff-only groups; no recipient addresses or message content."""
    batch_map = {batch.pk: batch.name for batch in batches if batch.status == 'active'}
    notices = EmailNotice.objects.filter(kind='enrollment', enrollment__batch_id__in=batch_map,
        enrollment__student__is_active=True).order_by('enrollment_id', '-created_at', '-pk')
    seen, groups = set(), {}
    for notice in notices.only('id', 'enrollment_id', 'batch_id_snapshot', 'status', 'reason'):
        if notice.enrollment_id in seen:
            continue
        seen.add(notice.enrollment_id)
        kind = 'quota' if notice.status == 'quota' else 'attention' if notice.status in ('failed', 'uncertain') or notice.reason in ('configuration', 'allowance_unavailable') else None
        if kind is None:
            continue
        key = (notice.batch_id_snapshot, kind)
        group = groups.setdefault(key, {'batch_id': key[0], 'batch_name': batch_map.get(key[0], 'Batch'),
                                         'kind': kind, 'count': 0, 'revision': []})
        group['count'] += 1
        group['revision'].append(f'{notice.pk}:{notice.status}:{notice.reason}')
    return list(groups.values())


def enqueue(user, subject, body, html_body=None, *, enrollment=None, actor=None, held=False, key=None, notify_change=True):
    key = key or f'account:{uuid.uuid4()}'
    with transaction.atomic():
        notice, _ = EmailNotice.objects.get_or_create(key=key, defaults={
            'kind': 'enrollment' if enrollment else 'account', 'student': user,
            'enrollment': enrollment, 'batch_id_snapshot': enrollment.batch_id if enrollment else None,
            'actor': actor, 'recipient': user.email, 'recipient_name': user.name,
            'subject': subject, 'body': body, 'html_body': html_body or '',
            'status': 'held' if held else 'queued',
        })
        if notify_change:
            publish(notice.batch_id_snapshot)
    return notice


def enrollment_content(student, batch):
    from .views import get_student_enrollment_email_html
    frontend = settings.FRONTEND_URL.rstrip('/')
    return (
        'You have been enrolled in SkillBridge — Complete your OJT Assessment',
        f'Hi {student.name}, your OJT instructor {batch.instructor.name} has enrolled you in {batch.name}. '
        f'Sign in with your DNSC Google account at {frontend}/login to take your assessment.',
        get_student_enrollment_email_html(student.name, batch.instructor.name, batch.name, frontend),
    )


def eligible(notice):
    user = notice.student
    if user is None or not user.is_active or user.email.casefold() != notice.recipient.casefold():
        return False
    if notice.kind != 'enrollment':
        return True
    if not notice.recipient.casefold().endswith('@dnsc.edu.ph'):
        return False
    enrollment = BatchEnrollment.objects.select_related('batch__instructor').filter(
        pk=notice.enrollment_id, student=user, batch_id=notice.batch_id_snapshot,
        batch__status='active', student__is_approved=True,
        batch__instructor__is_active=True, batch__instructor__is_approved=True,
    ).first()
    if not enrollment:
        return False
    # A request made by a former owner must not outlive their access assignment.
    return bool(notice.actor and notice.actor.is_active and (
        notice.actor.role == 'admin' or notice.actor.role == 'instructor' and
        notice.actor.is_approved and enrollment.batch.instructor_id == notice.actor_id))


def _event_status(event):
    return {'request': ('accepted', ''), 'sent': ('accepted', ''),
            'delivered': ('delivered', ''), 'deferred': ('provider_pending', ''),
            'soft_bounce': ('failed', 'soft_bounce'), 'hard_bounce': ('failed', 'hard_bounce'),
            'blocked': ('failed', 'blocked'), 'invalid': ('failed', 'invalid_recipient'),
            'error': ('failed', 'provider_error'), 'spam': ('failed', 'spam'),
            'unsubscribed': ('failed', 'unsubscribed')}[event]


def apply_events(notice):
    events = EmailProviderEvent.objects.filter(
        Q(request_tag=f'sb-{notice.pk}') | Q(message_id=notice.message_id) if notice.message_id
        else Q(request_tag=f'sb-{notice.pk}')).order_by('occurred_at', 'pk')
    for event in events:
        # Correlation requires our opaque tag or an already known provider ID.
        if notice.message_id and event.message_id != notice.message_id:
            continue
        notice.message_id = event.message_id
        status, reason = _event_status(event.event)
        if reason in PERMANENT:
            notice.suppressed = True
        if notice.status == 'delivered' and event.event in ('request', 'sent', 'deferred'):
            continue
        notice.status, notice.reason = status, reason
        notice.accepted_at = notice.accepted_at or event.occurred_at
        if status == 'delivered':
            notice.delivered_at = event.occurred_at


def record_event(data):
    """Persist no addresses, subjects, content or raw provider error bodies."""
    if not isinstance(data, dict):
        raise ValueError('Invalid event.')
    event = {'hardBounce': 'hard_bounce', 'softBounce': 'soft_bounce'}.get(data.get('event'), data.get('event'))
    message_id = data.get('message-id')
    stamp = data.get('ts_event', data.get('ts'))
    if event not in EVENTS or not isinstance(message_id, str) or not 1 <= len(message_id) <= 255:
        raise ValueError('Invalid event.')
    if isinstance(stamp, bool) or not isinstance(stamp, (int, float)):
        raise ValueError('Invalid event time.')
    try:
        occurred = datetime.fromtimestamp(stamp, dt_timezone.utc)
    except (ValueError, OSError, OverflowError):
        raise ValueError('Invalid event time.')
    if occurred > timezone.now() + timedelta(minutes=10):
        raise ValueError('Invalid event time.')
    tags = data.get('tags', data.get('tag', []))
    if isinstance(tags, str):
        try:
            tags = json.loads(tags)
        except ValueError:
            tags = [tags]
    if not isinstance(tags, list) or len(tags) > 20:
        raise ValueError('Invalid event tags.')
    tag = next((tag for tag in tags if isinstance(tag, str) and tag.startswith('sb-') and len(tag) == 39), '')
    fingerprint = hashlib.sha256(json.dumps([message_id, event, stamp], separators=(',', ':')).encode()).hexdigest()
    with transaction.atomic():
        _, created = EmailProviderEvent.objects.get_or_create(fingerprint=fingerprint, defaults={
            'message_id': message_id, 'request_tag': tag, 'event': event, 'occurred_at': occurred})
        query = Q(message_id=message_id)
        if tag:
            try:
                query |= Q(pk=uuid.UUID(tag[3:]))
            except ValueError:
                raise ValueError('Invalid request tag.')
        notice = EmailNotice.objects.select_for_update().filter(query).first()
        if notice and created:
            apply_events(notice)
            notice.save()
            publish(notice.batch_id_snapshot)
    return created


def _allowance():
    """Only known usable provider credit permits submission; never guess a reset."""
    if not settings.BREVO_API_KEY:
        return None, 'configuration'
    try:
        validate_email(parseaddr(settings.BREVO_SENDER_EMAIL)[1])
    except ValidationError:
        return None, 'configuration'
    try:
        response = requests.get('https://api.brevo.com/v3/account',
                                headers={'api-key': settings.BREVO_API_KEY, 'accept': 'application/json'},
                                timeout=(5, 15), allow_redirects=False)
        if response.status_code in (401, 403):
            return None, 'configuration'
        if response.status_code != 200:
            return None, 'allowance_unavailable'
        plans = response.json().get('plan', [])
        credits = [p['credits'] for p in plans if p.get('type') in ('free', 'subscription', 'payAsYouGo')
                   and p.get('creditsType') == 'sendLimit' and type(p.get('credits')) is int and p['credits'] >= 0]
        return (sum(credits), '') if credits else (None, 'allowance_unavailable')
    except (requests.RequestException, ValueError, TypeError, AttributeError):
        return None, 'allowance_unavailable'


def _submit(notice):
    try:
        response = requests.post('https://api.brevo.com/v3/smtp/email',
            headers={'api-key': settings.BREVO_API_KEY, 'accept': 'application/json'},
            json={'sender': {'name': 'SkillBridge', 'email': parseaddr(settings.BREVO_SENDER_EMAIL)[1]},
                  'to': [{'email': notice.recipient, 'name': notice.recipient_name}],
                  'subject': notice.subject, 'textContent': notice.body,
                  **({'htmlContent': notice.html_body} if notice.html_body else {}),
                  'headers': {'idempotencyKey': str(notice.pk)}, 'tags': [f'sb-{notice.pk}']},
            timeout=(5, 15), allow_redirects=False)
    except requests.ConnectTimeout:
        return 'retry', 'connection', None, ''
    except requests.RequestException:
        return 'uncertain', 'acceptance_unknown', None, ''
    code = response.status_code
    if code == 201:
        try:
            message_id = response.json().get('messageId')
        except (ValueError, AttributeError):
            message_id = None
        if isinstance(message_id, str) and 0 < len(message_id) <= 255:
            return 'accepted', '', code, message_id
        return 'uncertain', 'acceptance_unknown', code, ''
    if code in (401, 403):
        return 'failed', 'configuration', code, ''
    if code == 429:
        value = response.headers.get('Retry-After', '')
        delay = 300
        if isinstance(value, str):
            try:
                delay = int(value) if value.isdigit() else int((parsedate_to_datetime(value) - timezone.now()).total_seconds())
            except (ValueError, TypeError, OverflowError):
                pass
        return 'retry', 'rate_limit', code, '', min(604800, max(300, delay))
    try:
        payload = response.json()
        error = payload.get('code', '')
        message = payload.get('message', '')
    except (ValueError, AttributeError):
        error, message = '', ''
    if code == 400 and isinstance(message, str) and 'sender' in message[:2000].casefold():
        return 'failed', 'configuration', code, ''
    if error in ('not_enough_credits', 'insufficient_credit', 'insufficient_credits'):
        return 'quota', 'quota', code, ''
    if error == 'duplicate_parameter':
        return 'uncertain', 'acceptance_unknown', code, ''
    if code >= 500:
        return 'uncertain', 'acceptance_unknown', code, ''
    return 'failed', 'provider_rejected', code, ''


def reconcile_one(control, now):
    """Bounded fallback: one tagged provider lookup per minute, never a resend."""
    if not settings.BREVO_API_KEY or control.reconcile_after and control.reconcile_after > now:
        return False
    notice = EmailNotice.objects.filter(status__in=['accepted', 'provider_pending', 'uncertain'],
        updated_at__lte=now - timedelta(minutes=2), created_at__gte=now - timedelta(days=7),
        due_at__lte=now).order_by('due_at', 'created_at').first()
    if not notice:
        return False
    EmailDispatchControl.objects.filter(pk=1, lease_token=control.lease_token).update(reconcile_after=now + timedelta(minutes=1))
    EmailNotice.objects.filter(pk=notice.pk).update(due_at=now + timedelta(minutes=15))
    tag = f'sb-{notice.pk}'
    try:
        response = requests.get('https://api.brevo.com/v3/smtp/statistics/events',
            headers={'api-key': settings.BREVO_API_KEY, 'accept': 'application/json'},
            params={'tags': json.dumps([tag]), 'limit': 100, 'days': 7},
            timeout=(5, 15), allow_redirects=False)
        if response.status_code != 200:
            return False
        events = response.json().get('events', [])
        if not isinstance(events, list):
            return False
        for event in events[:100]:
            if not isinstance(event, dict) or event.get('tag') != tag:
                continue
            name = event.get('event')
            if not isinstance(name, str) or name not in EVENTS | {'hardBounce', 'softBounce'}:
                continue
            try:
                stamp = datetime.fromisoformat(event['date'].replace('Z', '+00:00'))
                if stamp.tzinfo is None:
                    continue
                record_event({'event': name, 'message-id': event.get('messageId'),
                              'ts_event': stamp.timestamp(), 'tags': [tag]})
            except (ValueError, KeyError, TypeError, AttributeError):
                # Tracking opens/clicks or one malformed entry must not hide a
                # valid delivery event elsewhere in the same provider response.
                continue
        return bool(events)
    except (requests.RequestException, ValueError, KeyError, TypeError, AttributeError):
        return False


def process_one():
    """Return 1 when a job changed, 0 when no work is due. No IO under row locks."""
    now = timezone.now()
    token = uuid.uuid4()
    with transaction.atomic():
        control, _ = EmailDispatchControl.objects.get_or_create(pk=1)
        control = EmailDispatchControl.objects.select_for_update().get(pk=1)
        if control.lease_until and control.lease_until > now:
            return 0
        control.lease_token, control.lease_until = token, now + timedelta(seconds=90)
        control.heartbeat_at = now
        control.save()
    try:
        # A dead process may have submitted its claimed message. Never blindly replay it.
        stale = list(EmailNotice.objects.filter(status='sending', lease_until__lte=now))
        for notice in stale:
            with transaction.atomic():
                notice = EmailNotice.objects.select_for_update().get(pk=notice.pk)
                if notice.status != 'sending' or notice.lease_until > now:
                    continue
                notice.status, notice.reason = 'uncertain', 'acceptance_unknown'
                apply_events(notice)
                notice.save()
                publish(notice.batch_id_snapshot)
        reconciled = reconcile_one(control, now)
        if not EmailNotice.objects.filter(status__in=['queued', 'retry', 'quota'], due_at__lte=now).exists():
            return int(reconciled)
        if control.check_after and control.check_after > now and control.reason:
            return 0
        if control.check_after is None or control.check_after <= now:
            credits, reason = _allowance()
            with transaction.atomic():
                current = EmailDispatchControl.objects.select_for_update().get(pk=1)
                if current.lease_token != token:
                    return 0
                current.credits, current.reason, current.checked_at = credits, reason, now
                current.check_after = now + timedelta(seconds=300 if reason or credits == 0 else 60)
                if credits == 0:
                    current.reason = 'quota'
                current.save()
                control = current
        if control.credits == 0 and not control.reason:
            control.reason = 'quota'
            control.save(update_fields=['reason'])
        if control.reason or not control.credits:
            pending = EmailNotice.objects.filter(status__in=['queued', 'retry', 'quota'], due_at__lte=now)
            batches = set(pending.values_list('batch_id_snapshot', flat=True))
            # Conditional SQL update cannot resurrect a concurrently held/cancelled job.
            changed = pending.update(reason=control.reason, due_at=control.check_after, updated_at=now,
                                     **({'status': 'quota'} if control.reason == 'quota' else {}))
            for batch in batches:
                publish(batch)
            return 1 if changed else 0
        with transaction.atomic():
            current = EmailDispatchControl.objects.select_for_update().get(pk=1)
            if current.lease_token != token:
                return 0
            notice = EmailNotice.objects.select_for_update(of=('self',)).select_related('student', 'actor').filter(
                status__in=['queued', 'retry', 'quota'], due_at__lte=now).order_by(
                    Case(When(kind='account', then=0), default=1, output_field=IntegerField()), 'created_at', 'pk').first()
            if notice is None:
                return 0
            if not eligible(notice):
                notice.status, notice.reason = 'cancelled', 'eligibility_changed'
                notice.save()
                publish(notice.batch_id_snapshot)
                return 1
            if EmailNotice.objects.filter(student=notice.student, recipient__iexact=notice.recipient, suppressed=True).exists():
                notice.status, notice.reason = 'failed', 'blocked'
                notice.save()
                publish(notice.batch_id_snapshot)
                return 1
            if notice.kind == 'enrollment' and current.credits <= settings.BREVO_ACCOUNT_EMAIL_RESERVE:
                notice.status, notice.reason, notice.due_at = 'quota', 'reserved_allowance', current.check_after
                notice.save()
                publish(notice.batch_id_snapshot)
                return 1
            notice.status, notice.reason = 'sending', ''
            notice.lease_until = now + timedelta(seconds=90)
            notice.attempts += 1
            notice.save()
            current.credits -= 1
            current.save()
        outcome = _submit(notice)
        status, reason, http_status, message_id = outcome[:4]
        pause_seconds = outcome[4] if len(outcome) > 4 else 300
        with transaction.atomic():
            notice = EmailNotice.objects.select_for_update().get(pk=notice.pk)
            # A webhook can have arrived while the request was in flight.
            if notice.status == 'sending' or (notice.status == 'uncertain' and status == 'accepted'):
                notice.status, notice.reason, notice.message_id = status, reason, message_id
                if status == 'accepted':
                    notice.accepted_at = timezone.now()
                if status == 'retry':
                    notice.due_at = timezone.now() + timedelta(seconds=max(
                        pause_seconds if reason == 'rate_limit' else 0, min(3600, 60 * 2 ** min(notice.attempts, 6))))
                    if notice.attempts >= 5:
                        notice.status = 'failed'
                apply_events(notice)
                notice.save()
            EmailAttempt.objects.create(notice=notice, status=status, reason=reason, http_status=http_status)
            if reason in ('configuration', 'quota', 'rate_limit'):
                EmailDispatchControl.objects.filter(pk=1, lease_token=token).update(
                    reason=reason, check_after=timezone.now() + timedelta(seconds=pause_seconds))
            publish(notice.batch_id_snapshot)
        return 1
    finally:
        EmailDispatchControl.objects.filter(pk=1, lease_token=token).update(lease_until=None, lease_token=None)
