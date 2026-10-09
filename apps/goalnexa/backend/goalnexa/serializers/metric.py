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
        # `help_text` is the plain-language hint forms and table headers show.
        extra_kwargs = {
            "name": {"help_text": "The one number you track. For example: Distance run, or Users signed up."},
            "description": {"help_text": "Optional. How it is measured, or where the number comes from."},
            "unit": {"help_text": "What the number counts, such as km, users or $. Optional."},
            "base_value": {"help_text": "Where you start. Progress is measured from this value."},
            "target_value": {"help_text": "The number you want to reach. It can be lower than the start for something that should go down. Equal to the start = tracked only, with no % progress."},
            "current_value": {"help_text": "The latest reading. It updates by itself with each check-in; you rarely need to set it."},
            "aggregation": {"help_text": "Latest: each check-in is the new reading (a weight, a user count). Sum: each check-in is an amount added to the total (km run today)."},
            "check_in_every": {"help_text": "How often you plan to check in. You get a reminder when one is due. Empty = no schedule."},
            "parent": {"help_text": "Makes this a sub-metric that breaks down another metric of the same goal. Sub-metrics don't count toward the goal's progress."},
            "last_checked_in_at": {"read_only": True, "help_text": "When the latest check-in happened."},
            "check_in_due_at": {"read_only": True, "help_text": "When the next check-in is due, from the schedule."},
            "ingest_token_hint": {"read_only": True, "help_text": "The end of the metric's automatic check-in token, to tell tokens apart."},
        }
