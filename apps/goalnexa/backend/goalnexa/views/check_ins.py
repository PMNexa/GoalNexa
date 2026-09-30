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
who logged it and from where (`author_id`, `source`: web, or an AI agent
when it's an MCP tool call).
"""

from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated

from core_api.viewsets import BaseViewSet
from goalnexa.access import visible_goals
from goalnexa.activity import record, request_source
from goalnexa.models import ActivityVerb, CheckIn, Metric
from goalnexa.progress import refresh_metric_and_goal
from goalnexa.serializers import CheckInSerializer


def record_check_in(check_in: CheckIn, verb: str, actor_id) -> None:
    metric = check_in.metric
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

    def perform_create(self, serializer):
        source = request_source(self.request)
        check_in = serializer.save(metric=self._resolve_metric(), author_id=self.request.user.id, source=source)
        refresh_metric_and_goal(check_in.metric_id)
        record_check_in(check_in, ActivityVerb.CHECKED_IN, self.request.user.id)

    def perform_update(self, serializer):
        # Only `metric` is reassignable (presence-based, same rule as
        # MetricViewSet.perform_update). Both the old and new metric get
        # re-synced: moving a check-in, or changing its value/time, can
        # change which check-in is latest on either side.
        instance = serializer.instance
        old_metric_id = instance.metric_id
        metric = self._resolve_metric() if "metric" in self.request.data else instance.metric
        check_in = serializer.save(metric=metric)
        refresh_metric_and_goal(check_in.metric_id)
        if old_metric_id != check_in.metric_id:
            refresh_metric_and_goal(old_metric_id)
        record_check_in(check_in, ActivityVerb.CHECK_IN_CHANGED, self.request.user.id)

    def perform_destroy(self, instance):
        metric_id = instance.metric_id
        record_check_in(instance, ActivityVerb.CHECK_IN_REMOVED, self.request.user.id)
        instance.delete()
        refresh_metric_and_goal(metric_id)
