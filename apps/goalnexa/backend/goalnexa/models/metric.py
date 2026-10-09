from django.db import models

from core_api.utils import TimestampedModel, generate_uuid7
from goalnexa.models.goal import Goal


class MetricAggregation(models.TextChoices):
    """How check-ins make up `current_value` (see `goalnexa.progress`)."""

    LATEST = "latest", "The new value (a reading)"
    SUM = "sum", "An amount to add to the total"


class CheckInCadence(models.TextChoices):
    NONE = "", "No schedule"
    DAILY = "daily", "Daily"
    WEEKLY = "weekly", "Weekly"
    MONTHLY = "monthly", "Monthly"


class Metric(TimestampedModel):
    """A tracked, numeric measure of progress toward a `Goal` (1-n, like
    `OrgMembership.org` -> `related_name="memberships"`) - e.g. "revenue"
    target 100000 unit "$", or "workouts" target 20 unit "sessions".
    `current_value` is a running total this module updates as `CheckIn`
    rows come in (see check_in.py); it isn't derived on read from a
    `CheckIn` aggregate, so it stays cheap to show on a plain goal list.

    `base_value` is where the metric started: progress is how far
    `current_value` has moved from it toward `target_value`, i.e.
    `(current - base) / (target - base)` - so a metric that should go DOWN
    (weight 80 -> 70) works the same as one that goes up. A new metric's
    `current_value` starts at its base unless one is given (see
    `MetricViewSet.perform_create`).

    `aggregation` says what a check-in's `value` is: LATEST (the default)
    = a reading, `current_value` is the latest one; SUM = an amount done
    ("ran 12 km"), `current_value` is `base_value` plus all of them.

    `check_in_every` is how often the metric expects a check-in. The
    server keeps `last_checked_in_at` and `check_in_due_at` (the last
    check-in, or the metric's creation, plus that period; null without a
    schedule) - stored, so "what's overdue" is one filter
    (`?filter{check_in_due_at.lte}=<now>`). `reminded_at` is when a
    reminder last went out for it (`goalnexa.reminders`).

    `ingest_token_hash` is the SHA-256 of the metric's ingest token - the
    secret a script or webhook posts readings with, no login needed
    (`MetricViewSet.ingest`). Only the hash is kept; `ingest_token_hint`
    is its last characters, so a UI can tell tokens apart ("" = none).
    """

    id = models.UUIDField(primary_key=True, default=generate_uuid7, editable=False)
    goal = models.ForeignKey(Goal, on_delete=models.CASCADE, db_column="goal_id", related_name="metrics")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    unit = models.CharField(max_length=32, blank=True, default="")
    base_value = models.DecimalField(
        max_digits=14, decimal_places=2, default=0, help_text="Where the metric starts - progress is measured from here."
    )
    target_value = models.DecimalField(max_digits=14, decimal_places=2)
    current_value = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        help_text="Kept by check-ins: the latest one's value, or the base plus all of them. Left blank on a new metric, it starts at the base value.",
    )
    aggregation = models.CharField(
        "each check-in is",
        max_length=16,
        choices=MetricAggregation.choices,
        default=MetricAggregation.LATEST,
        # db_default: the previous release's code, still running while a
        # deploy migrates, inserts metrics without these columns.
        db_default=MetricAggregation.LATEST,
        help_text="A reading (weight, revenue to date) or an amount done (km run, calls made) - then the metric is the base plus all of them.",
    )
    check_in_every = models.CharField(
        max_length=16,
        choices=CheckInCadence.choices,
        default=CheckInCadence.NONE,
        db_default=CheckInCadence.NONE,
        blank=True,
        help_text="How often this metric should get a check-in - an overdue one is flagged and reminded.",
    )
    last_checked_in_at = models.DateTimeField(null=True, blank=True, help_text="When the latest check-in was taken.")
    check_in_due_at = models.DateTimeField(null=True, blank=True, help_text="When the next check-in is due.")
    reminded_at = models.DateTimeField(null=True, blank=True)
    ingest_token_hash = models.CharField(max_length=64, blank=True, default="", db_default="")
    ingest_token_hint = models.CharField(
        max_length=8, blank=True, default="", db_default="", help_text="The end of this metric's ingest token, if it has one."
    )
    # Self-referential, optional - a sub-metric under a bigger one (both
    # still belong to `goal` directly, same as their parent - a sub-metric
    # isn't implicitly scoped to its parent's goal). SET_NULL, same
    # reasoning as Goal.parent.
    parent = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, db_column="parent_id", related_name="sub_metrics"
    )

    # Order among its siblings - metrics of the same goal under the same parent metric; lowest first. Set by
    # `POST <resource>/reorder` (drag and drop); a new one goes last.
    # `db_default` so the previous release's code can still insert rows
    # while a deploy migrates first.
    position = models.PositiveIntegerField(default=0, db_default=0)

    class Meta:
        db_table = "metric"
