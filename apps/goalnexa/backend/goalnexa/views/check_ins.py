"""/api/v1/check-ins - same flat-resource, request-body-resolved-relation
shape as MetricViewSet (see its own docstring); `metric` is a read-only
sideload field on `CheckInSerializer`, resolved here from the request
body's `metric` id.

Creating a check-in also updates its `Metric.current_value` to the
check-in's `value` (see `Metric`'s own docstring on why `current_value`
isn't derived from the latest `CheckIn` on read instead).
"""

from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated

from core_api.viewsets import BaseViewSet
from goalnexa.models import CheckIn, Metric
from goalnexa.serializers import CheckInSerializer


class CheckInViewSet(BaseViewSet):
    queryset = CheckIn.objects.all()
    serializer_class = CheckInSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return super().get_queryset().filter(metric__goal__owner_id=self.request.user.id).order_by("-created_at")

    def _resolve_metric(self):
        metric_id = self.request.data.get("metric")
        if not metric_id:
            raise ValidationError({"metric": ["This field is required."]})
        return get_object_or_404(Metric, id=metric_id, goal__owner_id=self.request.user.id)

    def perform_create(self, serializer):
        metric = self._resolve_metric()
        check_in = serializer.save(metric=metric)
        Metric.objects.filter(id=metric.id).update(current_value=check_in.value)

    def perform_update(self, serializer):
        # Only `metric` is reassignable (presence-based, same rule as
        # MetricViewSet.perform_update). Editing a check-in's `value`/
        # `note` corrects the historical record - it deliberately does
        # NOT re-touch `Metric.current_value` the way perform_create
        # does: this check-in might not be the metric's most recent one,
        # and blindly overwriting current_value from an arbitrary past
        # edit would make it wrong, not right. Only a fresh check-in
        # (perform_create, always chronologically latest) updates it.
        instance = serializer.instance
        metric = self._resolve_metric() if "metric" in self.request.data else instance.metric
        serializer.save(metric=metric)
