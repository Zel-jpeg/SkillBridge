"""Recipient-scoped database invalidations, shared across Gunicorn workers.

Short ORM reads use the existing pooler/psycopg2 path without a LISTEN session
or gevent database adapter. Release connections before idle sleeps and yields.
"""
import json
import logging
import time

from django.db import DatabaseError, close_old_connections, connections
from django.http import HttpResponse, HttpResponseNotAllowed, StreamingHttpResponse

from .models import BatchEnrollment, ChangeEvent, User
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework.exceptions import AuthenticationFailed

logger = logging.getLogger(__name__)
POLL_SECONDS = 1
HEARTBEAT_SECONDS = 15


def _get_user_from_token(request, allowed_roles):
    token = request.GET.get('token', '').strip()
    if not token:
        token = request.headers.get('Authorization', '').removeprefix('Bearer ').strip()
    try:
        from rest_framework_simplejwt.authentication import JWTAuthentication
        authentication = JWTAuthentication()
        user = authentication.get_user(authentication.get_validated_token(token))
        if user.role not in allowed_roles:
            return None
        if user.role in ('student', 'instructor') and not user.is_approved:
            return None
        if user.role == 'student' and not BatchEnrollment.objects.filter(student=user).exists():
            return None
        return user
    except (TokenError, AuthenticationFailed, User.DoesNotExist, KeyError, ValueError, TypeError):
        return None


def pending_events(user_id, cursor):
    return list(ChangeEvent.objects.filter(recipient_id=user_id, id__gt=cursor)
                .order_by('id').values('id', 'payload')[:500])


def _message(payload):
    return f'data: {json.dumps(payload)}\n\n'


def _event_stream(request, role, user_id):
    try:
        cursor = (ChangeEvent.objects.filter(recipient_id=user_id).order_by('-id')
                  .values_list('id', flat=True).first() or 0)
        connections.close_all()
        yield _message({'type': 'connected', 'resync': True})
        heartbeat = time.monotonic()
        while True:
            time.sleep(POLL_SECONDS)
            close_old_connections()
            rows = pending_events(user_id, cursor)
            now = time.monotonic()
            # Recheck token expiry and current DB authorization before delivery.
            if rows or now - heartbeat >= HEARTBEAT_SECONDS:
                user = _get_user_from_token(request, [role])
                if user is None or user.id != user_id:
                    connections.close_all()
                    yield _message({'type': 'auth_expired'})
                    return
                heartbeat = now
                connections.close_all()
                if rows:
                    cursor = rows[-1]['id']
                    merged = {'type': 'data_changed'}
                    for field in ('topics', 'batch_ids', 'student_ids', 'assessment_ids'):
                        if field == 'topics' or all(field in row['payload'] for row in rows):
                            values = sorted({value for row in rows for value in row['payload'].get(field, [])})
                            if field == 'topics' or len(values) <= 100:
                                merged[field] = values
                    yield _message(merged)
                else:
                    yield _message({'type': 'heartbeat'})
            else:
                connections.close_all()
    except GeneratorExit:
        return
    except Exception:
        logger.exception('SSE delivery interrupted; reconnect will resynchronize')
        yield _message({'type': 'reconnect'})
    finally:
        connections.close_all()


def _events(request, role):
    if request.method != 'GET':
        return HttpResponseNotAllowed(['GET'])
    try:
        user = _get_user_from_token(request, [role])
    except DatabaseError:
        return HttpResponse('Temporarily unavailable', status=503)
    if user is None:
        return HttpResponse('Unauthorized', status=401)
    # Axios preflight exposes authorization errors hidden by EventSource.
    if request.GET.get('check') == '1':
        return HttpResponse(status=204)
    response = StreamingHttpResponse(_event_stream(request, role, user.id), content_type='text/event-stream; charset=utf-8')
    response['Cache-Control'] = 'no-cache, no-store'
    response['X-Accel-Buffering'] = 'no'
    return response


def admin_events(request):
    return _events(request, 'admin')


def instructor_events(request):
    return _events(request, 'instructor')


def student_events(request):
    return _events(request, 'student')
