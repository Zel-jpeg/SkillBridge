"""Recipient-scoped database invalidations, shared across Gunicorn workers.

Short ORM reads use the existing pooler/psycopg2 path without a LISTEN session
or gevent database adapter. Release connections before idle sleeps and yields.
"""
import json
import logging
import time

from django.db import DatabaseError, close_old_connections, connections
from django.http import HttpResponse, HttpResponseNotAllowed, StreamingHttpResponse

from .management_access import managed_assessments, managed_batches
from .models import BatchEnrollment, ChangeEvent, User
from .program_scope import assigned_program_ids
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


def scoped_change(user, rows):
    change = {'type': 'data_changed'}
    payloads = [row['payload'] for row in rows]
    for field in ('topics', 'batch_ids', 'student_ids', 'assessment_ids', 'program_ids'):
        if field == 'topics' or all(field in payload for payload in payloads):
            values = sorted({value for payload in payloads for value in payload.get(field, [])})
            if field == 'topics' or len(values) <= 100:
                change[field] = values
    if user.role == 'admin':
        return change

    batch_ids = change.get('batch_ids', [])
    student_ids = change.get('student_ids', [])
    if user.role == 'instructor':
        if batch_ids or student_ids:
            batches = managed_batches(user)
            if batch_ids:
                change['batch_ids'] = list(batches.filter(id__in=batch_ids).order_by('id').values_list('id', flat=True))
            if student_ids:
                change['student_ids'] = list(BatchEnrollment.objects.filter(batch__in=batches, student_id__in=student_ids)
                                             .order_by('student_id').values_list('student_id', flat=True).distinct())
        if change.get('assessment_ids'):
            change['assessment_ids'] = list(managed_assessments(user).filter(id__in=change['assessment_ids'])
                                            .order_by('id').values_list('id', flat=True))
        if change.get('program_ids'):
            change['program_ids'] = list(assigned_program_ids(user).filter(program_id__in=change['program_ids'])
                                         .order_by('program_id').values_list('program_id', flat=True))
    else:
        if batch_ids:
            change['batch_ids'] = list(BatchEnrollment.objects.filter(student=user, batch_id__in=batch_ids)
                                       .order_by('batch_id').values_list('batch_id', flat=True))
        if student_ids:
            change['student_ids'] = [user.id] if user.id in student_ids else []
        change.pop('assessment_ids', None)
        change.pop('program_ids', None)
    return change


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
                if rows:
                    cursor = rows[-1]['id']
                    merged = scoped_change(user, rows)
                    connections.close_all()
                    yield _message(merged)
                else:
                    connections.close_all()
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
