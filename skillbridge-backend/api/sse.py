# api/sse.py
#
# Server-Sent Events (SSE) endpoint for admin and instructor panels.
#
# How it works:
#   1. Client connects via EventSource with JWT in query param
#   2. Server polls DB every 10 s comparing row counts (snapshot diff)
#   3. When something changes → sends { type: 'data_changed', invalidate: [...urls] }
#   4. Client invalidates those cache keys + re-fetches in the background
#
# Requires gunicorn with gevent workers so time.sleep() is non-blocking:
#   gunicorn core.wsgi:application --worker-class gevent --workers 2 --timeout 120
#
# Two SSE endpoints:
#   GET /api/admin/events/?token=<jwt>       → admin panel real-time updates
#   GET /api/instructor/events/?token=<jwt>  → instructor panel real-time updates

import json
import time
import logging

from django.http import StreamingHttpResponse, HttpResponse, HttpResponseNotAllowed

logger = logging.getLogger(__name__)


# ── Auth helpers ──────────────────────────────────────────────────────────────

def _get_user_from_token(request, allowed_roles):
    """
    Validate the JWT passed as ?token=<jwt> query param.
    EventSource doesn't support custom headers, so we use a query param.
    Returns the User instance on success, None on failure.
    """
    token_str = request.GET.get('token', '').strip()
    if not token_str:
        return None
    try:
        from rest_framework_simplejwt.tokens import AccessToken
        payload = AccessToken(token_str)
        from .models import User
        user = User.objects.get(id=payload['user_id'], is_active=True)
        if user.role not in allowed_roles:
            return None
        return user
    except Exception:
        return None


def _validate_admin(request):
    return _get_user_from_token(request, ['admin'])


def _validate_instructor(request):
    return _get_user_from_token(request, ['instructor'])


# ── Admin DB snapshot ─────────────────────────────────────────────────────────

def _admin_snapshot():
    """
    Lightweight aggregate counts for the admin panel.
    Comparing two snapshots tells us which cache URLs are stale.
    """
    from .models import User, Company, StudentResponse
    return {
        'students':            User.objects.filter(role='student',    is_active=True).count(),
        'instructors_active':  User.objects.filter(role='instructor', is_approved=True,  is_active=True).count(),
        'instructors_pending': User.objects.filter(role='instructor', is_approved=False, is_active=True).count(),
        'companies':           Company.objects.count(),
        'submissions':         StudentResponse.objects.filter(submitted_at__isnull=False).count(),
    }


def _admin_diff_urls(old, new):
    """Return list of frontend cache URLs to invalidate based on what changed."""
    urls = set()
    if old['students'] != new['students'] or old['submissions'] != new['submissions']:
        urls.update([
            '/api/admin/stats/',
            '/api/admin/users/',
            '/api/admin/students/recommendations/',
        ])
    if old['companies'] != new['companies']:
        urls.update(['/api/admin/stats/', '/api/admin/companies/'])
    if (old['instructors_active']  != new['instructors_active'] or
            old['instructors_pending'] != new['instructors_pending']):
        urls.add('/api/admin/users/')
    return list(urls)


# ── Instructor DB snapshot ────────────────────────────────────────────────────

def _instructor_snapshot():
    """
    Lightweight aggregate counts for the instructor panel.
    Tracks student submissions and active student count.
    """
    from .models import User, StudentResponse
    return {
        'submissions':     StudentResponse.objects.filter(submitted_at__isnull=False).count(),
        'active_students': User.objects.filter(role='student', is_active=True).count(),
    }


def _instructor_diff_urls(old, new):
    """
    Return frontend cache URLs to invalidate for instructors.
    Fires when a student submits an assessment or student count changes.
    Also invalidates /api/instructor/batches/ so useEnrolledStudents
    re-fetches per-batch student statuses (pending → completed).
    """
    urls = set()
    if (old['submissions']     != new['submissions'] or
            old['active_students'] != new['active_students']):
        urls.update([
            '/api/instructor/students/recommendations/',
            '/api/instructor/batches/',
        ])
    return list(urls)


# ── Generic SSE stream generator ─────────────────────────────────────────────

def _event_stream(snapshot_fn, diff_fn):
    """
    Infinite generator that yields SSE-formatted strings.
    gevent makes time.sleep() non-blocking so this doesn't block a worker.

    snapshot_fn: callable → dict of current DB counts
    diff_fn:     callable(old, new) → list of stale URLs
    """
    last = snapshot_fn()
    heartbeat_tick = 0

    # Immediately confirm the connection is live
    yield f"data: {json.dumps({'type': 'connected'})}\n\n"

    while True:
        time.sleep(10)          # non-blocking with gevent
        heartbeat_tick += 1

        try:
            current    = snapshot_fn()
            stale_urls = diff_fn(last, current)

            if stale_urls:
                last = current
                payload = json.dumps({'type': 'data_changed', 'invalidate': stale_urls})
                yield f"data: {payload}\n\n"
            elif heartbeat_tick % 3 == 0:
                # Send a comment-line heartbeat every ~30 s to prevent proxies
                # from closing idle connections (Railway / Vercel edge).
                yield ": heartbeat\n\n"

        except GeneratorExit:
            break
        except Exception as exc:
            logger.error("SSE stream error: %s", exc)
            yield ": error\n\n"


def _make_response(stream):
    """Wrap a stream generator in a properly configured StreamingHttpResponse."""
    response = StreamingHttpResponse(
        streaming_content=stream,
        content_type='text/event-stream; charset=utf-8',
    )
    response['Cache-Control']    = 'no-cache'
    response['X-Accel-Buffering'] = 'no'   # disable Railway/Nginx buffering
    return response


# ── Views ─────────────────────────────────────────────────────────────────────

def admin_events(request):
    """
    GET /api/admin/events/?token=<jwt>
    Streams SSE to authenticated admin users.
    """
    if request.method != 'GET':
        return HttpResponseNotAllowed(['GET'])

    if not _validate_admin(request):
        return HttpResponse('Unauthorized', status=401)

    return _make_response(_event_stream(_admin_snapshot, _admin_diff_urls))


def instructor_events(request):
    """
    GET /api/instructor/events/?token=<jwt>
    Streams SSE to authenticated (approved) instructor users.
    Fires when students submit assessments or student roster changes.
    """
    if request.method != 'GET':
        return HttpResponseNotAllowed(['GET'])

    if not _validate_instructor(request):
        return HttpResponse('Unauthorized', status=401)

    return _make_response(_event_stream(_instructor_snapshot, _instructor_diff_urls))