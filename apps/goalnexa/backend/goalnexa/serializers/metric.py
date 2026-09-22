from core_api.serializers import BaseSerializer
from goalnexa.models import Metric


class MetricSerializer(BaseSerializer):
    """No `Meta.fields` - every model field is emitted. `goal` (forward)
    and `check_ins` (reverse) are auto-added and auto-deferred by
    `BaseSerializer` itself. `goal` renders as a bare id by default (or
    the full `Goal` on `?include[]=goal`) and is read-only on write, same
    as `OrgMembership.org` - see `MetricViewSet.perform_create` for how a
    metric's goal actually gets set on create.
    """

    class Meta:
        model = Metric
        auto_exclude = ["created_at", "updated_at"]
