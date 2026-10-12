from rest_framework import serializers

from core_api.serializers import BaseSerializer
from goalnexa.models import CheckIn


class CheckInSerializer(BaseSerializer):
    """No `Meta.fields` - every model field is emitted. `metric` (forward)
    is auto-added, auto-deferred, and read-only on write, same as
    `MetricSerializer.goal` - see `CheckInViewSet.perform_create` for how
    a check-in's metric actually gets set on create.

    `checked_in_at` is a plain writable field - omit it (the generic form
    does when it's left blank) and the model default (now) applies. It's
    what the dashboard's progress-over-time chart plots against;
    `created_at` stays hidden like on Goal/Metric.
    """

    class Meta:
        model = CheckIn
        auto_exclude = ["created_at", "updated_at", "comments"]
        # Who logged it and from where - the server's to set (CheckInViewSet).
        # `help_text` is the plain-language hint forms and table headers show.
        extra_kwargs = {
            "value": {"help_text": "The new reading, or for a sum metric the amount to add (ran 5 km: enter 5)."},
            "note": {"help_text": "Optional. Anything worth remembering about this check-in."},
            "checked_in_at": {"help_text": "When the reading was taken. Leave blank for now."},
            "author_id": {"read_only": True, "help_text": "Who logged it."},
            "source": {"read_only": True, "help_text": "Where it came from: the website, an AI assistant, or an automatic script."},
            "replaced": {"read_only": True, "help_text": "A later check-in in the same period replaced it (the metric keeps one reading per period), so it doesn't count."},
        }

    def to_representation(self, instance):
        """A single check-in (not a list) of a metric with one reading per
        period also says which one it replaced: `replaces`."""
        data = super().to_representation(instance)
        if not isinstance(self.parent, serializers.ListSerializer) and getattr(instance, "metric_id", None) and instance.metric.one_per:
            from goalnexa.periods import replaced_by

            instance.refresh_from_db(fields=["replaced"])
            data["replaced"] = instance.replaced
            earlier = replaced_by(instance)
            data["replaces"] = (
                {"id": str(earlier.id), "value": str(earlier.value), "checked_in_at": earlier.checked_in_at.isoformat()}
                if earlier else None
            )
        return data
