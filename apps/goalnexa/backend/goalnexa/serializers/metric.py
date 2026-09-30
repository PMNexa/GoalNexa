from core_api.serializers import BaseSerializer
from goalnexa.models import Metric


class MetricSerializer(BaseSerializer):
    """No `Meta.fields` - every model field is emitted. `goal` (forward)
    and `check_ins` (reverse) are auto-added and auto-deferred by
    `BaseSerializer` itself. `goal` renders as a bare id by default (or
    the full `Goal` on `?include[]=goal`) and is read-only on write, same
    as `OrgMembership.org` - see `MetricViewSet.perform_create` for how a
    metric's goal actually gets set on create.

    The schedule fields (`last_checked_in_at`, `check_in_due_at`) and
    `ingest_token_hint` are the server's to keep (`goalnexa.progress`,
    `MetricViewSet.ingest_token`); `reminded_at` and the token's hash
    aren't shown at all.
    """

    class Meta:
        model = Metric
        auto_exclude = ["created_at", "updated_at", "reminded_at", "ingest_token_hash"]
        extra_kwargs = {
            "last_checked_in_at": {"read_only": True},
            "check_in_due_at": {"read_only": True},
            "ingest_token_hint": {"read_only": True},
        }
