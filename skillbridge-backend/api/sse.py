# api/sse.py
#
# Server-Sent Events (SSE) endpoint for the admin panel.
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
# Railway: set Start Command in dashboard or via Procfile (see Procfile).

import json
import time
import logging

from django.http import StreamingHttpResponse, HttpResponse, HttpResponseNotAllowed

logger = logging.getLogger(__name__)


# ── Auth ──────────────────────────────────────────────────────────────────────

def _validate_admin(request):
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
        return User.objects.get(id=payload['user_id'], role='admin', is_active=True)
    except Exception:
        return None


# ── DB snapshot ───────────────────────────────────────────────────────────────

def _snapshot():
    """
    Read lightweight aggregate counts from the DB.
    Comparing two snapshots tells us which cache URLs are stale.
    """
    from .models import User, Company, StudentResponse
    return {
        'students':            User.objects.filter(role='student',     is_active=True).count(),
        'instructors_active':  User.objects.filter(role='instructor',  is_approved=True,  is_active=True).count(),
        'instructors_pending': User.objects.filter(role='instructor',  is_approved=False, is_active=True).count(),
        'companies':           Company.objects.count(),
        'submissions':         StudentResponse.objects.filter(submitted_at__isnull=False).count(),
    }


def _diff_urls(old, new):
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


# ── SSE stream generator ──────────────────────────────────────────────────────

def _event_stream():
    """
    Infinite generator that yields SSE-formatted strings.
    gevent makes time.sleep() non-blocking so this doesn't block a worker.
    """
    last = _snapshot()
    heartbeat_tick = 0

    # Immediately confirm the connection is live
    yield f"data: {json.dumps({'type': 'connected'})}\n\n"

    while True:
        time.sleep(10)          # non-blocking with gevent
        heartbeat_tick += 1

        try:
            current = _snapshot()
            stale_urls = _diff_urls(last, current)

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
            # Send a comment so the client knows we're still alive
            yield ": error\n\n"


# ── View ──────────────────────────────────────────────────────────────────────

def admin_events(request):
    """
    GET /api/admin/events/?token=<jwt>

    Streams SSE to authenticated admin users.
    """
    if request.method != 'GET':
        return HttpResponseNotAllowed(['GET'])

    user = _validate_admin(request)
    if not user:
        return HttpResponse('Unauthorized', status=401)

    response = StreamingHttpResponse(
        streaming_content=_event_stream(),
        content_type='text/event-stream; charset=utf-8',
    )
    # Prevent caching
    response['Cache-Control'] = 'no-cache'
    # Disable proxy / Nginx buffering so events arrive immediately
    response['X-Accel-Buffering'] = 'no'
    return response