from core_api.serializers import BaseSerializer
from goalnexa.models import GoalMember


class GoalMemberSerializer(BaseSerializer):
    """`goal` (forward) is auto-added and read-only on write, same as
    `MetricSerializer.goal` - `GoalMemberViewSet.perform_create` resolves
    it from the request body. No update: a row is added or removed."""

    class Meta:
        model = GoalMember
        auto_exclude = ["updated_at"]
