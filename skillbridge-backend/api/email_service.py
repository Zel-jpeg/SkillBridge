"""Durable enqueue compatibility for account and enrollment notifications.

The legacy synchronous deliver helper remains available for isolated diagnostics;
production dispatch is performed only by process_email_outbox.
"""
import logging
from email.utils import parseaddr

import requests
from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


def deliver_email(*, user_id, email, name, subject, body, html_body=None):
    try:
        if settings.BREVO_API_KEY:
            response = requests.post(
                'https://api.brevo.com/v3/smtp/email',
                headers={'api-key': settings.BREVO_API_KEY, 'accept': 'application/json'},
                json={'sender': {'name': 'SkillBridge', 'email': parseaddr(settings.BREVO_SENDER_EMAIL)[1]},
                      'to': [{'email': email, 'name': name}], 'subject': subject,
                      'textContent': body, **({'htmlContent': html_body} if html_body else {})},
                timeout=(5, 15), allow_redirects=False,
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


def queue_email(user, subject, body, html_body=None, **options):
    from .email_outbox import enqueue
    try:
        enqueue(user, subject, body, html_body, **options)
        return True
    except Exception:
        logger.warning('Email persistence failed user_id=%s', user.pk)
        return False
