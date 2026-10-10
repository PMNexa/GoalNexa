"""`POST /api/v1/metrics/<id>/ingest` - a check-in from a script, cron job,
Home Assistant, n8n, a CI step or any webhook, authenticated by the
metric's own ingest token (`MetricViewSet.ingest_token`) instead of a
login. The token is for this one metric only: it can add check-ins to it
and nothing else.

    curl -X POST https://<host>/api/v1/metrics/<id>/ingest \\
      -H "Authorization: Bearer gnm_..." -H "Content-Type: application/json" \\
      -d '{"value": 42, "note": "nightly job"}'

The body is a check-in's: `value` (a reading, or for a SUM metric the
amount to add), optional `note` and `checked_in_at`; JSON or form-encoded.
A sender that can't set headers may put the token in `?token=` instead
(it then shows up in access logs - prefer the header). Rate limited per
metric (`GOALNEXA_INGEST_RATE`, default 60/min).
"""

import hmac
import uuid

from django.conf import settings
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiExample, OpenApiParameter, extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView

from core_api.errors import Unauthorized
from goalnexa.models import ActivityVerb, CheckInSource, Metric
from goalnexa.progress import refresh_metric_and_goal
from goalnexa.serializers import CheckInSerializer
from goalnexa.views.check_ins import record_check_in
from goalnexa.views.metrics import hash_ingest_token


class IngestThrottle(SimpleRateThrottle):
    scope = "goalnexa_ingest"

    def get_rate(self):
        return getattr(settings, "GOALNEXA_INGEST_RATE", "60/min")

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": view.kwargs.get("pk")}


def _token(request) -> str:
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        return header[len("Bearer "):].strip()
    return request.query_params.get("token", "")


class MetricIngestView(APIView):
    # The token is checked here, not by the host's login authentication
    # (which would reject a `gnm_` bearer token as a bad JWT).
    authentication_classes = []
    permission_classes = []
    throttle_classes = [IngestThrottle]
    # No authentication class to describe, so the scheme is declared here
    # (core_api.openapi) - see docs/api-reference.md.
    openapi_auth = {
        "metricIngestToken": {
            "type": "http",
            "scheme": "bearer",
            "description": "A metric's ingest token (`gnm_...`), from `POST /api/v1/metrics/{id}/ingest-token`. "
            "Works for that metric's ingest endpoint only.",
        }
    }
    # An unknown metric is a 401 too (see `post`); no roles involved.
    openapi_errors = ("400", "401", "429")

    @extend_schema(
        operation_id="metrics_ingest",
        tags=["metrics"],
        summary="Check in with a metric's ingest token",
        description="For scripts, cron jobs and webhooks: adds a check-in to one metric without a login. "
        "Send the token as `Authorization: Bearer gnm_...`, or as `?token=` when the sender can't set headers "
        "(it then shows up in access logs). Rate limited per metric. A wrong token and an unknown metric "
        "both answer 401.",
        parameters=[
            OpenApiParameter("id", OpenApiTypes.UUID, OpenApiParameter.PATH, description="The metric's id."),
            OpenApiParameter("token", str, OpenApiParameter.QUERY, required=False, description="The ingest token, if not in the header."),
        ],
        request=inline_serializer(
            "MetricIngest",
            {
                "value": serializers.DecimalField(
                    max_digits=14, decimal_places=2,
                    help_text="The new reading - or, for a `sum` metric, the amount to add.",
                ),
                "note": serializers.CharField(required=False, allow_blank=True),
                "checked_in_at": serializers.DateTimeField(required=False, help_text="When it happened; default now."),
            },
        ),
        responses={
            201: inline_serializer(
                "MetricIngestResponse",
                {
                    "id": serializers.UUIDField(),
                    "value": serializers.DecimalField(max_digits=14, decimal_places=2),
                    "note": serializers.CharField(),
                    "checked_in_at": serializers.DateTimeField(),
                    "current_value": serializers.DecimalField(
                        max_digits=14, decimal_places=2, help_text="The metric's value after this check-in."
                    ),
                },
            )
        },
        examples=[OpenApiExample("Nightly job", value={"value": 42, "note": "nightly job"}, request_only=True)],
    )
    def post(self, request, pk):
        metric = Metric.objects.filter(id=pk).first() if _is_uuid(pk) else None
        token = _token(request)
        # One answer for "no such metric" and "wrong token", so the
        # endpoint doesn't tell which metric ids exist.
        if metric is None or not metric.ingest_token_hash or not token:
            raise Unauthorized("Invalid or missing ingest token.")
        if not hmac.compare_digest(metric.ingest_token_hash, hash_ingest_token(token)):
            raise Unauthorized("Invalid or missing ingest token.")
        data = {key: request.data[key] for key in ("value", "note", "checked_in_at") if key in request.data}
        serializer = CheckInSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        check_in = serializer.save(metric=metric, source=CheckInSource.INGEST)
        refresh_metric_and_goal(metric.id)
        record_check_in(check_in, ActivityVerb.CHECKED_IN, None)
        metric.refresh_from_db(fields=["current_value"])
        return Response({**serializer.data, "id": str(check_in.id), "current_value": str(metric.current_value)}, status=201)



def _is_uuid(value) -> bool:
    try:
        uuid.UUID(str(value))
    except ValueError:
        return False
    return True
