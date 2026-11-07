from rest_framework import serializers

from core_api.serializers import BaseSerializer
from goalnexa.models import CheckIn
from goalnexa.periods import counted_per

#: The generic check-in form: `period` is for apps and assistants (the website picks a time), shown only when set.
CHECK_IN_LAYOUT = [
    {"title": "Check-in", "fields": ["metric", "value", "note", "checked_in_at", {"name": "period", "show_if": {"field": "period", "not_in": [""]}}]},
]


class CheckInSerializer(BaseSerializer):
    """No `Meta.fields` - every model field is emitted. `metric` (forward)
    is auto-added, auto-deferred, and read-only on write, same as
    `MetricSerializer.goal` - see `CheckInViewSet.perform_create` for how
    a check-in's metric actually gets set on create.

    `checked_in_at` is a plain writable field - omit it (the generic form
    does when it's left blank) and the model default (now) applies. It's
    what the dashboard's progress-over-time chart plots against;
    `created_at` stays hidden like on Goal/Metric.

    `period` (write-only, P-93) names the period a check-in is for instead
    of a time: any day of it - the check-in goes to that period's moment.
    """

    period = serializers.DateField(
        write_only=True, required=False, allow_null=True,
        help_text="For a metric with a frequency: any day of the period this check-in is for, instead of checked_in_at - "
                  "it's dated at that period's moment (a weekly Friday 17:00 frequency: Thursday Nov 6 is the week from "
                  "Friday Oct 31 17:00). Without a frequency: that day, 00:00.",
    )

    class Meta:
        model = CheckIn
        form_layout = CHECK_IN_LAYOUT
        auto_exclude = ["created_at", "updated_at", "comments"]
        # Who logged it and from where - the server's to set (CheckInViewSet).
        # `help_text` is the plain-language hint forms and table headers show.
        extra_kwargs = {
            "value": {"help_text": "The new reading, or for a sum metric the amount to add (ran 5 km: enter 5)."},
            "note": {"help_text": "Optional. Anything worth remembering about this check-in."},
            "checked_in_at": {"help_text": "When the reading was taken. Leave blank for now."},
            "author_id": {"read_only": True, "help_text": "Who logged it."},
            "source": {"read_only": True, "help_text": "Where it came from: the website, an AI assistant, the phone app, or an automatic script."},
            "entered_at": {"read_only": True, "help_text": "For a metric with a frequency: the time as given, before it moved to the moment (checked_in_at)."},
            "replaced": {"read_only": True, "help_text": "A later check-in in the same period replaced it (the metric keeps one reading per period), so it doesn't count."},
        }

    @staticmethod
    def _apply_period(validated_data, metric) -> dict:
        period = validated_data.pop("period", None)
        if period is not None and metric is not None:
            from goalnexa.periods import period_moment

            validated_data["checked_in_at"] = period_moment(metric, period)
        return validated_data

    def create(self, validated_data):
        return super().create(self._apply_period(validated_data, validated_data.get("metric")))

    def update(self, instance, validated_data):
        return super().update(instance, self._apply_period(validated_data, instance.metric))

    def to_representation(self, instance):
        """A single check-in (not a list) of a metric with one reading per
        period also says which one it replaced: `replaces`."""
        data = super().to_representation(instance)
        if not isinstance(self.parent, serializers.ListSerializer) and getattr(instance, "metric_id", None) and counted_per(instance.metric):
            from goalnexa.periods import replaced_by

            instance.refresh_from_db(fields=["replaced"])
            data["replaced"] = instance.replaced
            earlier = replaced_by(instance)
            data["replaces"] = (
                {"id": str(earlier.id), "value": str(earlier.value), "checked_in_at": earlier.checked_in_at.isoformat()}
                if earlier else None
            )
        return data
