"""Small, read-only readiness probe; no account or provider details."""
import logging

from django.db import DatabaseError, connection
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

logger = logging.getLogger(__name__)


@api_view(['GET', 'HEAD'])
@authentication_classes([])
@permission_classes([AllowAny])
def health(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
            cursor.fetchone()
    except DatabaseError:
        # Drivers can include connection strings in exceptions. Keep the public
        # response and log independent of credentials, schema and driver text.
        logger.warning('Readiness database check unavailable')
        response = Response({'status': 'unavailable'}, status=503)
    else:
        response = Response({'status': 'ok'})
    response['Cache-Control'] = 'no-store'
    return response
