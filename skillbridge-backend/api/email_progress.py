"""Fixed recipient groups stored in existing command receipts; reads never send."""
from datetime import timedelta
from django.db.models import F, Window
from django.db.models.functions import RowNumber
from django.utils import timezone

from .models import EmailCommand, EmailDispatchControl, EmailNotice


def snapshot(notices, *, source, missing=0):
    return {'source': source, 'notice_ids': [str(notice.pk) for notice in notices],
            'total': len(notices) + missing}


def progress_groups(batches):
    """Five recent groups per authorized batch, with immutable denominators.

    Project only group metadata, never the enrollment receipt's identity rows.
    Missing/deleted notices remain in the denominator and need attention.
    """
    batch_map = {batch.pk: batch.name for batch in batches}
    if not batch_map:
        return []
    commands = list(EmailCommand.objects.filter(batch_id_snapshot__in=batch_map,
        result__has_key='email_group').annotate(group_rank=Window(
            expression=RowNumber(), partition_by=[F('batch_id_snapshot')],
            order_by=[F('created_at').desc(), F('id').desc()])).filter(group_rank__lte=5)
        .order_by('-created_at', '-id').values('id', 'batch_id_snapshot', 'created_at', 'result__email_group'))
    ids = {pk for command in commands for pk in command['result__email_group']['notice_ids']}
    notices = {str(notice.pk): notice for notice in EmailNotice.objects.filter(pk__in=ids).only(
        'id', 'batch_id_snapshot', 'status', 'reason', 'accepted_at', 'delivered_at', 'suppressed')}
    control = EmailDispatchControl.objects.filter(pk=1).first()
    paused = not (control and control.heartbeat_at and control.heartbeat_at > timezone.now() - timedelta(minutes=10))
    paused = paused or bool(control and control.reason in ('configuration', 'allowance_unavailable'))
    groups = []
    for command in commands:
        saved = command['result__email_group']
        total = saved['total']
        if not total:
            continue
        rows = [notices[pk] for pk in saved['notice_ids'] if pk in notices and
                notices[pk].batch_id_snapshot == command['batch_id_snapshot']]
        submitted = sum(bool(row.accepted_at) or row.status in ('accepted', 'provider_pending', 'delivered') for row in rows)
        delivered = sum(row.status == 'delivered' and not row.suppressed for row in rows)
        failed = total - len(rows) + sum(row.status == 'failed' or row.suppressed for row in rows)
        uncertain = sum(row.status == 'uncertain' and not row.suppressed for row in rows)
        cancelled = sum(row.status == 'cancelled' and not row.suppressed for row in rows)
        held = sum(row.status == 'held' and not row.suppressed for row in rows)
        waiting = sum(row.status in ('queued', 'retry', 'quota', 'sending') and not row.suppressed for row in rows)
        quota = sum(row.status == 'quota' for row in rows)
        state = ('attention' if failed or uncertain else 'cancelled' if cancelled else
                 'delivered' if delivered == total else 'submitted' if submitted == total else
                 'quota' if quota else 'held' if held and not waiting else 'paused' if paused else 'sending')
        groups.append({'id': str(command['id']), 'batch_id': command['batch_id_snapshot'],
            'batch_name': batch_map[command['batch_id_snapshot']], 'source': saved['source'],
            'created_at': command['created_at'].isoformat(), 'total': total, 'submitted': submitted,
            'delivered': delivered, 'waiting': waiting, 'held': held, 'failed': failed,
            'uncertain': uncertain, 'cancelled': cancelled, 'state': state})
    return groups
