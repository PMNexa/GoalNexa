"""/api/v1/check-ins - same flat-resource, request-body-resolved-relation
shape as MetricViewSet (see its own docstring); `metric` is a read-only
sideload field on `CheckInSerializer`, resolved here from the request
body's `metric` id.

`Metric.current_value` = the value of that metric's LATEST check-in by
`checked_in_at` (see `Metric`'s own docstring on why it's stored rather
than derived on read). Since `checked_in_at` is user-editable (a reading
can be logged after the fact), "latest" isn't necessarily the check-in
just written - so every write (create/update/delete) recomputes it from
the metric's own check-ins instead of copying the new value over.
"""

from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated

from core_api.viewsets import BaseViewSet
from goalnexa.access import visible_goals
from goalnexa.models import CheckIn, Metric
from goalnexa.serializers import CheckInSerializer


def sync_current_value(metric_id) -> None:
    """Sets the metric's `current_value` to its latest check-in's value.
    Leaves it untouched if the metric has no check-ins left (it may have
    been set directly on the metric instead)."""
    latest = (
        CheckIn.objects.filter(metric_id=metric_id).order_by("-checked_in_at", "-created_at").values("value").first()
    )
    if latest is not None:
        Metric.objects.filter(id=metric_id).update(current_value=latest["value"])


class CheckInViewSet(BaseViewSet):
    queryset = CheckIn.objects.all()
    serializer_class = CheckInSerializer
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
        check_in = serializer.save(metric=self._resolve_metric())
        sync_current_value(check_in.metric_id)

    def perform_update(self, serializer):
        # Only `metric` is reassignable (presence-based, same rule as
        # MetricViewSet.perform_update). Both the old and new metric get
        # re-synced: moving a check-in, or changing its value/time, can
        # change which check-in is latest on either side.
        instance = serializer.instance
        old_metric_id = instance.metric_id
        metric = self._resolve_metric() if "metric" in self.request.data else instance.metric
        check_in = serializer.save(metric=metric)
        sync_current_value(check_in.metric_id)
        if old_metric_id != check_in.metric_id:
            sync_current_value(old_metric_id)

    def perform_destroy(self, instance):
        metric_id = instance.metric_id
        instance.delete()
        sync_current_value(metric_id)
