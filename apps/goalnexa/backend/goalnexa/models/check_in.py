from django.db import models

from core_api.utils import TimestampedModel, generate_uuid7
from goalnexa.models.metric import Metric


class CheckIn(TimestampedModel):
    """A progress log entry against a `Metric` (1-n, like `Metric.goal`) -
    `value` is the metric's new reading as of this check-in (e.g. "82" for
    a weight metric currently at 85), not a delta to add. `created_at`
    (from `TimestampedModel`) already doubles as the check-in timestamp,
    so there's no separate `checked_in_at` field to keep in sync with it.
    Creating one also updates `Metric.current_value` to match (see
    CheckInViewSet.perform_create) - `current_value` isn't derived from
    the latest `CheckIn` on read, so a plain goal/metric list stays a
    single-table query.
    """

    id = models.UUIDField(primary_key=True, default=generate_uuid7, editable=False)
    metric = models.ForeignKey(Metric, on_delete=models.CASCADE, db_column="metric_id", related_name="check_ins")
    value = models.DecimalField(max_digits=14, decimal_places=2)
    note = models.TextField(blank=True, default="")

    class Meta:
        db_table = "check_in"
