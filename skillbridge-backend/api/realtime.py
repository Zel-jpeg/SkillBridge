"""Opt-in private Broadcast hints; Django GETs remain the data authority.

This module never provisions Supabase roles/policies or changes signing keys.
Configuration is intentionally separate from Storage and Django JWT credentials.
"""
from dataclasses import dataclass
import hashlib
import hmac
import logging
import time
from urllib.parse import quote, urlsplit
import uuid

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.exceptions import UnsupportedAlgorithm
from django.conf import settings
from django.db.models import Exists, OuterRef, Q
import jwt
import requests
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .management_access import instructor_scope_revision
from .models import BatchEnrollment, User

logger = logging.getLogger(__name__)
RECEIVER_ROLE = 'sb_realtime_receiver'
TOKEN_SECONDS = 60
MAX_PILOT_USERS = 2
MAX_BROADCAST_RECIPIENTS = 25
EVENT = 'refresh'


@dataclass(frozen=True)
class PilotConfiguration:
    url: str
    user_ids: frozenset | None
    publishable_key: str
    signing_key: object
    signing_kid: str
    topic_secret: bytes
    publish_key: str


def _pilot_ids(value):
    if not isinstance(value, str):
        return None
    values = [part.strip() for part in value.split(',') if part.strip()]
    if not values or any(not part.isascii() or not part.isdecimal() or int(part) < 1 for part in values):
        return None
    ids = frozenset(map(int, values))
    return ids if len(ids) <= MAX_PILOT_USERS else None


def configuration():
    """Invalid or incomplete opt-in settings leave all sessions on SSE."""
    if getattr(settings, 'REALTIME_PILOT_ENABLED', False) is not True:
        return None
    try:
        mode = getattr(settings, 'REALTIME_ROLLOUT_MODE', 'allowlist')
        if mode == 'allowlist':
            ids = _pilot_ids(getattr(settings, 'REALTIME_PILOT_USER_IDS', ''))
            if not ids:
                return None
        elif mode == 'eligible' and settings.REALTIME_PILOT_PUBLISH_ENABLED is True:
            ids = None
        else:
            return None
        parsed = urlsplit(getattr(settings, 'SUPABASE_REALTIME_URL', '').strip())
        host = parsed.hostname or ''
        # An exact hosted Supabase endpoint prevents secret-bearing requests to
        # arbitrary configured paths, credentials, query strings or redirects.
        project = host.removesuffix('.supabase.co')
        if (parsed.scheme != 'https' or parsed.username or parsed.password or parsed.port or
                not host.endswith('.supabase.co') or not project or
                not project.isascii() or not project.isalnum() or
                parsed.path not in ('', '/', '/realtime/v1', '/realtime/v1/') or parsed.query or parsed.fragment):
            return None
        public = getattr(settings, 'SUPABASE_REALTIME_PUBLISHABLE_KEY', '').strip()
        publish = getattr(settings, 'SUPABASE_REALTIME_PUBLISH_KEY', '').strip()
        kid = getattr(settings, 'SUPABASE_REALTIME_SIGNING_KID', '').strip()
        secret = getattr(settings, 'SUPABASE_REALTIME_TOPIC_SECRET', '').encode('utf-8')
        pem = getattr(settings, 'SUPABASE_REALTIME_SIGNING_KEY', '').replace('\\n', '\n').encode('utf-8')
        if (not public.startswith('sb_publishable_') or len(public) <= len('sb_publishable_') or
                not publish or any(char.isspace() for char in public + publish) or
                not kid or len(kid) > 128 or any(char.isspace() for char in kid) or len(secret) < 32):
            return None
        if publish.startswith('sb_secret_'):
            if len(publish) <= len('sb_secret_'):
                return None
        else:
            # Legacy service-role API keys are JWTs. Merely classify this
            # backend configuration; Supabase verifies its actual signature.
            if jwt.decode(publish, options={'verify_signature': False}).get('role') != 'service_role':
                return None
        key = serialization.load_pem_private_key(pem, password=None)
        if not isinstance(key, ec.EllipticCurvePrivateKey) or key.curve.name != 'secp256r1':
            return None
        return PilotConfiguration(f'https://{host}/realtime/v1', ids, public, key, kid, secret, publish)
    except (ValueError, TypeError, AttributeError, UnsupportedAlgorithm, jwt.PyJWTError):
        return None


def eligible_users(user_ids):
    """Match account eligibility on exchange and immediately before publishing."""
    enrolled = BatchEnrollment.objects.filter(student_id=OuterRef('pk'))
    return User.objects.filter(pk__in=user_ids, is_active=True).annotate(
        realtime_enrolled=Exists(enrolled),
    ).filter(Q(role='admin') | Q(role='instructor', is_approved=True) |
             Q(role='student', is_approved=True, realtime_enrolled=True))


def _identity(user, config, purpose):
    return hmac.new(config.topic_secret, f'{purpose}:v1:{user.pk}:{user.role}'.encode('ascii'), hashlib.sha256).digest()


def recipient_topic(user, config):
    return f'sb-pilot:{_identity(user, config, "topic").hex()}'


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def realtime_session(request):
    """Exchange the existing API session for a short-lived receive-only token."""
    response = Response({'transport': 'sse'})
    response['Cache-Control'] = 'no-store'
    response['Pragma'] = 'no-cache'
    config = configuration()
    if config is None or (config.user_ids is not None and request.user.pk not in config.user_ids):
        return response
    user = eligible_users([request.user.pk]).first()
    if user is None:
        return response
    now = int(time.time())
    # Never extend the lifetime of the currently authenticated Django access JWT.
    try:
        expires = min(now + TOKEN_SECONDS, int(request.auth['exp']))
    except (KeyError, TypeError, ValueError, OverflowError):
        return response
    if expires <= now:
        return response
    topic = recipient_topic(user, config)
    claims = {'role': RECEIVER_ROLE, 'sub': str(uuid.UUID(bytes=_identity(user, config, 'subject')[:16], version=4)),
              'iat': now, 'exp': expires, 'jti': str(uuid.uuid4()), 'sb_topic': topic}
    try:
        token = jwt.encode(claims, config.signing_key, algorithm='ES256', headers={'kid': config.signing_kid})
    except (ValueError, TypeError, jwt.PyJWTError):
        logger.warning('Realtime session unavailable; using SSE')
        return response
    response.data = {'transport': 'supabase_broadcast', 'url': config.url,
                     'publishable_key': config.publishable_key, 'token': token,
                     'topic': topic, 'expires_at': expires, 'event': EVENT}
    if user.role == 'instructor':
        response.data['scope_revision'] = instructor_scope_revision(user)
    return response


def publish_invalidations(recipients):
    """Best-effort publication after commit; keep the persisted SSE events.

    No entity identifiers or records cross this transport. In eligible mode a
    single bounded request covers the private topics for the operation.
    """
    if getattr(settings, 'REALTIME_PILOT_PUBLISH_ENABLED', False) is not True:
        return 0
    config = configuration()
    if config is None:
        return 0
    from .change_events import TOPICS
    allowed = {topic for topics in TOPICS.values() for topic in topics} | {'email', 'scope'}
    candidates = recipients if config.user_ids is None else config.user_ids.intersection(recipients)
    users = list(eligible_users(candidates)[:MAX_BROADCAST_RECIPIENTS + 1])
    if len(users) > MAX_BROADCAST_RECIPIENTS:
        logger.warning('Realtime audience exceeds batch limit; clients will revalidate')
        return 0
    messages = []
    for user in users:
        data = recipients[user.pk]
        topics = data.get('topics', []) if isinstance(data, dict) else []
        if not isinstance(topics, (tuple, list)):
            continue
        topics = sorted({topic for topic in topics if isinstance(topic, str) and topic in allowed})
        if not topics:
            continue
        payload = {'type': 'data_changed', 'topics': topics, 'event_id': str(uuid.uuid4())}
        messages.append({'topic': recipient_topic(user, config), 'event': EVENT, 'private': True, 'payload': payload})
    if not messages:
        return 0

    def send(endpoint, data):
        try:
            result = requests.post(endpoint, headers={'apikey': config.publish_key, 'Content-Type': 'application/json'},
                                   json=data, timeout=(.5, .5), allow_redirects=False)
            if 200 <= result.status_code < 300:
                return True
        except requests.RequestException:
            # Provider exception messages can include URLs, keys or payloads.
            pass
        logger.warning('Realtime publication unavailable; visible refresh will recover')
        return False

    endpoint = f'{config.url}/api/broadcast'
    if config.user_ids is None:
        return len(messages) if send(endpoint, {'messages': messages}) else 0
    return sum(send(f'{endpoint}/{quote(message["topic"], safe="")}/events/{EVENT}?private=true',
                    message['payload']) for message in messages)
