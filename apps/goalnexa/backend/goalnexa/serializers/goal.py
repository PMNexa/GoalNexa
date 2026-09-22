from core_api.serializers import BaseSerializer
from goalnexa.models import Goal


class GoalSerializer(BaseSerializer):
    """No `Meta.fields` - every model field is emitted, and the `metrics`
    reverse relation (`Metric.goal`'s `related_name`) is auto-added and
    auto-deferred by `BaseSerializer` itself (it finds `MetricSerializer`
    via the model registry, no import needed here); pass
    `?include[]=metrics` to sideload a goal's metrics instead of leaving
    the field off. `owner_id` is read-only, same as `Organization.slug` -
    it's always `request.user.id` (see `GoalViewSet.perform_create`),
    never something a caller sets directly.
    """

    class Meta:
        model = Goal
        extra_kwargs = {"owner_id": {"read_only": True}}
        auto_exclude = ["created_at", "updated_at"]
