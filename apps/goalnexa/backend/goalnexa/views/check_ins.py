"""/api/v1/check-ins - same flat-resource, request-body-resolved-relation
shape as MetricViewSet (see its own docstring); `metric` is a read-only
sideload field on `CheckInSerializer`, resolved here from the request
body's `metric` id.

`Metric.current_value` = the value of that metric's LATEST check-in by
`checked_in_at` (or, for a SUM metric, base + all of them - see
`Metric`'s own docstring on why it's stored rather than derived on read).
Since `checked_in_at` is user-editable (a reading can be logged after the
fact), "latest" isn't necessarily the check-in just written - so every
write (create/update/delete) recomputes it from the metric's own
check-ins instead of copying the new value over, along with the metric's
schedule and its goal's progress/health (`goalnexa.progress`). Each
write also goes in the goal's activity feed, and a new check-in records
who logged it and from where (`author_id`, `source`: web, an AI agent
when it's an MCP tool call, or the phone app).

A create may carry the caller's own `client_ref` (the phone app's offline
queue): the same one again, from the same author, answers 200 with the
check-in it already made - a retried request never logs twice.
"""

from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core_api.system import AGENT, WEB, seen
from core_api.viewsets import BaseViewSet
from goalnexa.access import visible_goals
from goalnexa.activity import record, request_source
from goalnexa.models import ActivityVerb, CheckIn, CheckInSource, Metric
from goalnexa.progress import refresh_metric_and_goal
from goalnexa.rollups import batched
from goalnexa.serializers import CheckInSerializer
from goalnexa.teams import can_check_in

#: Cells one bulk request may save (the team board).
MAX_BULK = 500
class ClientRefTaken(APIException):
    status_code = 409
    default_code = "client_ref_taken"
    default_detail = "You already used this client_ref for a check-in on another metric."


TOTAL = "This is a team total - it's calculated from the teams' check-ins. Check in on a team's own metric."


def check_can_check_in(request, metric) -> None:
    """A team total takes no check-ins; a template instance only from its
    team (`goalnexa.teams.can_check_in`)."""
    goal = metric.goal
    if goal.is_rollup:
        raise ValidationError({"metric": [TOTAL]})
    if goal.template_goal_id and not can_check_in(request, goal):
        raise PermissionDenied("Only the team's members can check in on its goals.")


def record_check_in(check_in: CheckIn, verb: str, actor_id) -> None:
    metric = check_in.metric
    extra = {}
    if metric.one_per and verb != ActivityVerb.CHECK_IN_REMOVED:
        # One reading per period: say what it replaced, or that it was replaced.
        from goalnexa.periods import replaced_by

        check_in.refresh_from_db(fields=["replaced"])
        earlier = replaced_by(check_in)
        if check_in.replaced:
            extra["replaced"] = True
        elif earlier is not None:
            extra["replaces"] = earlier.value
    record(
        metric.goal_id,
        verb,
        actor_id,
        metric=metric.id,
        metric_name=metric.name,
        unit=metric.unit,
        value=check_in.value,
        adds=metric.aggregation == "sum",
        source=check_in.source,
        check_in=check_in.id,
        **extra,
    )


class CheckInViewSet(BaseViewSet):
    queryset = CheckIn.objects.all()
    serializer_class = CheckInSerializer
    # A check-in has no name of its own - find it by its note, metric or goal.
    search_fields = ["note", "metric__name", "metric__goal__title"]
    permission_classes = [IsAuthenticated]
    scope_field = "metric__goal__org_id"  # its goal's org - see GoalViewSet

    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .filter(visible_goals(self.request, "metric__goal__"))
            .order_by("-checked_in_at", "-created_at")
        )

    def _resolve_metric(self):
        metric_id = self.request.data.get("metric")
        if not metric_id:
            raise ValidationError({"metric": ["This field is required."]})
        return get_object_or_404(Metric.objects.filter(visible_goals(self.request, "goal__")), id=metric_id)

    def _by_client_ref(self, request) -> CheckIn | None:
        """The caller's earlier check-in with this request's `client_ref`."""
        ref = request.data.get("client_ref")
        if not isinstance(ref, str) or not ref:
            return None
        existing = CheckIn.objects.filter(author_id=request.user.id, client_ref=ref).first()
        if existing is not None and str(existing.metric_id) != str(request.data.get("metric")):
            raise ClientRefTaken()
        return existing

    def create(self, request, *args, **kwargs):
        existing = self._by_client_ref(request)
        if existing is None:
            try:
                with transaction.atomic():
                    return super().create(request, *args, **kwargs)
            except IntegrityError:
                # The same client_ref sent twice at once: the other one won.
                existing = self._by_client_ref(request)
                if existing is None:
                    raise
        return Response(self.get_serializer(existing).data, status=200)

    def perform_create(self, serializer):
        source = request_source(self.request)
        metric = self._resolve_metric()
        check_can_check_in(self.request, metric)
        check_in = serializer.save(metric=metric, author_id=self.request.user.id, source=source)
        refresh_metric_and_goal(check_in.metric_id)
        record_check_in(check_in, ActivityVerb.CHECKED_IN, self.request.user.id)
        seen(self.request.user.id, AGENT if source == CheckInSource.AGENT else WEB)

    def perform_update(self, serializer):
        # Only `metric` is reassignable (presence-based, same rule as
        # MetricViewSet.perform_update). Both the old and new metric get
        # re-synced: moving a check-in, or changing its value/time, can
        # change which check-in is latest on either side.
        instance = serializer.instance
        old_metric_id = instance.metric_id
        check_can_check_in(self.request, instance.metric)
        metric = self._resolve_metric() if "metric" in self.request.data else instance.metric
        if metric.id != old_metric_id:
            check_can_check_in(self.request, metric)
        serializer.validated_data.pop("client_ref", None)  # set once, at create
        check_in = serializer.save(metric=metric)
        refresh_metric_and_goal(check_in.metric_id)
        if old_metric_id != check_in.metric_id:
            refresh_metric_and_goal(old_metric_id)
        record_check_in(check_in, ActivityVerb.CHECK_IN_CHANGED, self.request.user.id)

    def perform_destroy(self, instance):
        check_can_check_in(self.request, instance.metric)
        metric_id = instance.metric_id
        record_check_in(instance, ActivityVerb.CHECK_IN_REMOVED, self.request.user.id)
        instance.delete()
        refresh_metric_and_goal(metric_id)

    @extend_schema(
        description="Save several check-ins at once, all or nothing - the team board's Save. Each item is a "
        "check-in's fields (metric, value, note, checked_in_at); team totals are recalculated once at the end.",
        request=inline_serializer("BulkCheckIns", {
            "items": serializers.ListField(child=inline_serializer("BulkCheckIn", {
                "metric": serializers.UUIDField(),
                "value": serializers.DecimalField(max_digits=14, decimal_places=2),
                "note": serializers.CharField(required=False, allow_blank=True),
                "checked_in_at": serializers.DateTimeField(required=False),
            })),
        }),
        responses={201: CheckInSerializer(many=True)},
    )
    @action(detail=False, methods=["post"])
    def bulk(self, request):
        items = request.data.get("items")
        if not isinstance(items, list) or not items or len(items) > MAX_BULK:
            raise ValidationError({"items": [f"A list of 1 to {MAX_BULK} check-ins."]})
        source = request_source(request)
        created = []
        with transaction.atomic(), batched():
            for index, item in enumerate(items):
                if not isinstance(item, dict) or not item.get("metric"):
                    raise ValidationError({"items": [f"Item {index + 1}: a metric is required."]})
                metric = get_object_or_404(Metric.objects.filter(visible_goals(request, "goal__")), id=item["metric"])
                check_can_check_in(request, metric)
                serializer = self.get_serializer(data={k: v for k, v in item.items() if k not in ("metric", "client_ref")})
                if not serializer.is_valid():
                    raise ValidationError({"items": [f"Item {index + 1}: {serializer.errors}"]})
                created.append(serializer.save(metric=metric, author_id=request.user.id, source=source))
            for check_in in created:
                refresh_metric_and_goal(check_in.metric_id)
                record_check_in(check_in, ActivityVerb.CHECKED_IN, request.user.id)
        seen(request.user.id, AGENT if source == CheckInSource.AGENT else WEB)
        return Response(self.get_serializer(created, many=True).data, status=201)
