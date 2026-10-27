from rest_framework import serializers

from core_api.serializers import BaseSerializer
from goalnexa.models import Metric, SnapTo
from goalnexa.serializers.layouts import METRIC_LAYOUT

#: `Metric.snap_to`'s API value for "inherited" (`Metric.snap_to_goal`): the
#: goal's setting, or a sub-metric's parent metric's.
SNAP_TO_GOAL = "goal"
METRIC_SNAP_TO_CHOICES = [(SNAP_TO_GOAL, "Inherited (from its goal, or its parent metric)"), *SnapTo.choices]

#: `snap_due` as a select (a generic form preselects a choice's default, not a checkbox's).
SNAP_DUE_CHOICES = [(True, "Yes"), (False, "No")]


def snap_due_field():
    return serializers.ChoiceField(
        label="Due at that moment", choices=SNAP_DUE_CHOICES, required=False,
        help_text=SNAP_MOMENT_HELP["snap_due"]["help_text"],
    )


#: Help for the moment fields (`SnapMoment`), shared by goals, metrics and template metrics.
SNAP_MOMENT_HELP = {
    "snap_weekday": {"help_text": "For check-ins for a week: the day they're for."},
    "snap_quarter_month": {"help_text": "For check-ins for a quarter: which of its months."},
    "snap_month": {"help_text": "For check-ins for a year: the month."},
    "snap_day": {"help_text": "For check-ins for a month, quarter or year: the day of the month (1-31; past the month's end = its last day)."},
    "snap_time": {"help_text": "For check-ins for a period: the time of day (the organization's time zone). Each check-in's time is set to this moment in its period."},
    "snap_due": {"help_text": "The period's check-in is due at that moment: flagged when it passes, and you're reminded. Off = not due then (a metric's own \"check in every\" schedule applies)."},
}


def validate_one_per(one_per: str, target_per: str, snap_to: str = "") -> None:
    """One reading per period, and the period check-ins are for, can't be
    longer than the target's period; check-ins for a period can't be longer
    than the one reading's either."""
    from goalnexa.periods import PERIOD_RANK

    if one_per and target_per and PERIOD_RANK[one_per] > PERIOD_RANK[target_per]:
        raise serializers.ValidationError(
            {"one_per": [f"Can't be longer than the target's period: a target per {target_per} needs at most one reading per {target_per}."]}
        )
    if snap_to and target_per and PERIOD_RANK[snap_to] > PERIOD_RANK[target_per]:
        raise serializers.ValidationError(
            {"snap_to": [f"Can't be longer than the target's period: a target per {target_per} needs check-ins for a {target_per} at most."]}
        )
    if snap_to and one_per and PERIOD_RANK[snap_to] > PERIOD_RANK[one_per]:
        raise serializers.ValidationError(
            {"snap_to": [f"Can't be longer than \"one reading per {one_per}\" - every check-in would land in the same {one_per}."]}
        )


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

    `template_metric` links an instance (or team total) metric to its goal
    template; `planned_target` is a team total's top-down target (set on
    the team board). `is_total` says the metric is a team total
    (read-only); `in_my_team` that it's in the caller's team's instance -
    what an assistant picks when several teams share a metric's name;
    `for_me` that it's in the caller's OWN copy (a member's share of their
    team's goal, `Goal.assignee_id`) - picked before the team's.
    """

    is_total = serializers.SerializerMethodField()
    # "goal" = same as the goal's (`Metric.snap_to_goal`), resolved by
    # `MetricViewSet` - the stored `snap_to` is always the period in effect,
    # read back as `snap_period`. Null = any time, like "" (a generic form's
    # emptied select sends null).
    snap_to = serializers.ChoiceField(
        label="Check-ins are for", choices=METRIC_SNAP_TO_CHOICES, required=False, allow_blank=True, allow_null=True, initial=SNAP_TO_GOAL,
        help_text="Inherited (the default): its goal's setting - a sub-metric's, its parent metric's. Any time: each check-in keeps its own time. A period: each check-in is dated at the moment picked in its period (the organization's time zone), whoever checks in. Changing it moves existing check-ins.",
    )
    snap_period = serializers.CharField(
        source="snap_to", read_only=True,
        help_text="The period check-ins are for, after \"inherited\": empty = any time.",
    )
    snap_due = snap_due_field()
    in_my_team = serializers.SerializerMethodField()
    for_me = serializers.SerializerMethodField()
    pace = serializers.SerializerMethodField()

    class Meta:
        model = Metric
        # Named explicitly: the first CharField would be a check-in setting (`snap_to`).
        display_field = "name"
        form_layout = METRIC_LAYOUT
        auto_exclude = ["created_at", "updated_at", "reminded_at", "ingest_token_hash", "snap_to_goal"]
        # `help_text` is the plain-language hint forms and table headers show.
        extra_kwargs = {
            "name": {"help_text": "The one number you track. For example: Distance run, or Users signed up."},
            "description": {"help_text": "Optional. How it is measured, or where the number comes from."},
            "unit": {"help_text": "What the number counts, such as km, users or $. Optional."},
            "base_value": {"help_text": "Where you start. Progress is measured from this value."},
            "target_value": {"help_text": "The number you want to reach. It can be lower than the start for something that should go down. Equal to the start = tracked only, with no % progress."},
            "current_value": {"help_text": "The latest reading. It updates by itself with each check-in; you rarely need to set it."},
            "aggregation": {"help_text": "Latest: each check-in is the new reading (a weight, a user count). Sum: each check-in is an amount added to the total (km run today)."},
            "check_in_every": {"help_text": "How often you plan to check in, counted from the last check-in. You get a reminder when one is due. Empty = no schedule. Not used when check-ins are for a period and due at its moment (snap_due)."},
            "parent": {"help_text": "Makes this a sub-metric that breaks down another metric of the same goal. Sub-metrics don't count toward the goal's progress."},
            "position": {"read_only": True, "help_text": "Order among metrics with the same parent, lowest first. Changed by dragging, or POST reorder."},
            "last_checked_in_at": {"read_only": True, "help_text": "When the latest check-in happened."},
            "check_in_due_at": {"read_only": True, "help_text": "When the next check-in is due, from the schedule."},
            "ingest_token_hint": {"read_only": True, "help_text": "The end of the metric's automatic check-in token, to tell tokens apart."},
            "template_metric": {"read_only": True, "help_text": "The goal template's metric this one follows - its name, unit and how check-ins add up are the template's."},
            "planned_target": {"read_only": True, "help_text": "A team total's top-down target, set on the team board. Its progress is measured against it."},
            "target_per": {"help_text": "What the target is for: the whole goal, or each day/week/month/quarter/year (a quota - for metrics whose check-ins are amounts to add). With a period, the target is the amount per period."},
            "count_days": {"help_text": "For a target per day or week: count every day, or weekdays only."},
            "progress_by": {"help_text": "For a target per period: progress is the total against every period's target, or how often the target is hit."},
            "one_per": {"help_text": "Which check-ins count: every one, or only the last one each day/week/month/quarter/year - a later check-in replaces the earlier one (for amounts to add: each check-in is the period's total so far)."},
            "period_value": {"read_only": True, "help_text": "Amount checked in during the current period (a target per period)."},
            "cumulative_target": {"read_only": True, "help_text": "Every period's target added up over the goal's dates - what the total is measured against."},
            "expected_value": {"read_only": True, "help_text": "Where the total should be by now if every period's target were met."},
            "hit_rate": {"read_only": True, "help_text": "Share of periods at or over target so far, in %."},
            "streak": {"read_only": True, "help_text": "Periods in a row at or over target, up to now."},
            "period_reminded_for": {"read_only": True},
            **SNAP_MOMENT_HELP,
        }

    def validate(self, attrs):
        attrs = super().validate(attrs)
        instance = self.instance
        target_per = attrs.get("target_per", getattr(instance, "target_per", ""))
        aggregation = attrs.get("aggregation", getattr(instance, "aggregation", "latest"))
        progress_by = attrs.get("progress_by", getattr(instance, "progress_by", "total"))
        if target_per and aggregation != "sum":
            raise serializers.ValidationError({"target_per": ["A target per period needs check-ins that are amounts to add (Sum)."]})
        if progress_by == "hit_rate" and not target_per:
            raise serializers.ValidationError({"progress_by": ["How often the target is hit needs a target per period."]})
        if "snap_to" in attrs and attrs["snap_to"] is None:
            attrs["snap_to"] = ""
        # `snap_to` against these: `MetricViewSet._snap_settings`, which knows the goal.
        validate_one_per(attrs.get("one_per", getattr(instance, "one_per", "")), target_per)
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if "snap_to" in data and instance.snap_to_goal:
            data["snap_to"] = SNAP_TO_GOAL
        return data

    def get_pace(self, obj) -> dict | None:
        """What's left: this period's amount and quota (a target per
        period), or the amount needed per day/week to land on target by the
        goal's target date (a running total)."""
        if not obj.goal_id or obj.goal.is_rollup and not obj.target_per:
            return None
        from goalnexa.periods import pace_hint, zone_for

        zones = self.context.setdefault("_zones", {})
        return pace_hint(obj, obj.goal, zone=zone_for(obj.goal, zones))

    def get_is_total(self, obj) -> bool:
        return bool(obj.goal.is_rollup) if obj.goal_id else False

    def get_for_me(self, obj) -> bool:
        """Whether this metric is in the caller's own copy of their team's goal."""
        request = self.context.get("request")
        return bool(request is not None and obj.goal_id and obj.goal.assignee_id and str(obj.goal.assignee_id) == str(request.user.id))

    def get_in_my_team(self, obj) -> bool:
        """Whether this metric's goal is the instance of one of the caller's
        teams (a member's copy: only for that member)."""
        request = self.context.get("request")
        if request is None or not obj.goal_id or obj.goal.team_id is None or obj.goal.is_rollup:
            return False
        if obj.goal.assignee_id:
            return str(obj.goal.assignee_id) == str(request.user.id)
        mine = self.context.get("_my_team_ids")
        if mine is None:
            from goalnexa.teams import my_team_ids

            mine = self.context["_my_team_ids"] = my_team_ids(request.user.id, request)
        return obj.goal.team_id in mine
