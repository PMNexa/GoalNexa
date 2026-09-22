from core_api.serializers import BaseSerializer
from goalnexa.models import CheckIn


class CheckInSerializer(BaseSerializer):
    """No `Meta.fields` - every model field is emitted. `metric` (forward)
    is auto-added, auto-deferred, and read-only on write, same as
    `MetricSerializer.goal` - see `CheckInViewSet.perform_create` for how
    a check-in's metric actually gets set on create.
    """

    class Meta:
        model = CheckIn
        auto_exclude = ["created_at", "updated_at"]
