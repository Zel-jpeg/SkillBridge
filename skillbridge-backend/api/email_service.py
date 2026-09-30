"""Small bounded in-process dispatcher. Queued never means delivered."""
import logging
import threading
import queue
from email.utils import parseaddr

import requests
from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)
_pending = queue.Queue(maxsize=1000)
_worker_lock = threading.Lock()
_worker = None


def deliver_email(*, user_id, email, name, subject, body, html_body=None):
    try:
        if settings.BREVO_API_KEY:
            response = requests.post(
                'https://api.brevo.com/v3/smtp/email',
                headers={'api-key': settings.BREVO_API_KEY, 'accept': 'application/json'},
                json={'sender': {'name': 'SkillBridge', 'email': parseaddr(settings.BREVO_SENDER_EMAIL)[1]},
                      'to': [{'email': email, 'name': name}], 'subject': subject,
                      'textContent': body, **({'htmlContent': html_body} if html_body else {})},
                timeout=(5, 15),
            )
            if 200 <= response.status_code < 300:
                logger.info('Email provider accepted user_id=%s', user_id)
                return True
            logger.warning('Email provider rejected user_id=%s status=%s', user_id, response.status_code)
    except Exception:
        # Provider errors can contain private recipients, response bodies and keys.
        logger.warning('Email dispatch failed user_id=%s', user_id)
    if settings.ENROLLMENT_SMTP_FALLBACK and not settings.RAILWAY_ENVIRONMENT:
        try:
            sent = send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [email], html_message=html_body)
            return sent == 1
        except Exception:
            logger.warning('SMTP dispatch failed user_id=%s', user_id)
    return False


def queue_email(user, subject, body, html_body=None):
    global _worker
    if not settings.BREVO_API_KEY and not (settings.ENROLLMENT_SMTP_FALLBACK and not settings.RAILWAY_ENVIRONMENT):
        return False
    def run():
        while True:
            message = _pending.get()
            try:
                if not deliver_email(**message):
                    logger.warning('Queued email failed user_id=%s', message['user_id'])
            finally:
                _pending.task_done()
    try:
        with _worker_lock:
            if _worker is None or not _worker.is_alive():
                _worker = threading.Thread(target=run, name='skillbridge-email', daemon=True)
                _worker.start()
        _pending.put_nowait(dict(user_id=user.pk, email=user.email, name=user.name,
                                subject=subject, body=body, html_body=html_body))
        return True
    except Exception:
        logger.warning('Email worker unavailable user_id=%s', user.pk)
        return False
