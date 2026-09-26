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

    `org_id` is a bare `UUIDField`, not a real FK (see `Goal.org_id`'s own
    docstring - no cross-module DB access from goalnexa into
    platform_org). `related_endpoints` tells `BaseViewSet.schema` to
    describe it as a relation anyway, purely so the frontend gets a real
    org picker instead of a raw-id text box - it's still a plain
    serializer field otherwise, written through `validated_data` like any
    other (no `GoalViewSet._resolve_*` needed for it).

    `members` (the reverse `GoalMember` relation) is left out: who a goal
    is shared with is managed at `/api/v1/goal-members` (goalnexa-frontend's
    goal members panel), not as a generic related-rows tab whose form
    would ask for a raw user id.
    """

    class Meta:
        model = Goal
        extra_kwargs = {"owner_id": {"read_only": True}}
        auto_exclude = ["created_at", "updated_at", "members"]
        related_endpoints = {"org_id": "/api/v1/orgs"}
