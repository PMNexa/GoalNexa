from django.db import connection
from django.http import JsonResponse


def health(request):
    """`GET /api/v1/health` - what every compose/stack healthcheck probes:
    the process answers and reaches its database. No auth, no data."""
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
    return JsonResponse({"ok": True})
