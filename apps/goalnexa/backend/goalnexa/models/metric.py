from django.db import models

from core_api.utils import TimestampedModel, generate_uuid7
from goalnexa.models.goal import Goal


class Metric(TimestampedModel):
    """A tracked, numeric measure of progress toward a `Goal` (1-n, like
    `OrgMembership.org` -> `related_name="memberships"`) - e.g. "revenue"
    target 100000 unit "$", or "workouts" target 20 unit "sessions".
    `current_value` is a running total this module updates as `CheckIn`
    rows come in (see check_in.py); it isn't derived on read from a
    `CheckIn` aggregate, so it stays cheap to show on a plain goal list.
    """

    id = models.UUIDField(primary_key=True, default=generate_uuid7, editable=False)
    goal = models.ForeignKey(Goal, on_delete=models.CASCADE, db_column="goal_id", related_name="metrics")
    name = models.CharField(max_length=255)
    unit = models.CharField(max_length=32, blank=True, default="")
    target_value = models.DecimalField(max_digits=14, decimal_places=2)
    current_value = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    # Self-referential, optional - a sub-metric under a bigger one (both
    # still belong to `goal` directly, same as their parent - a sub-metric
    # isn't implicitly scoped to its parent's goal). SET_NULL, same
    # reasoning as Goal.parent.
    parent = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, db_column="parent_id", related_name="sub_metrics"
    )

    class Meta:
        db_table = "metric"
