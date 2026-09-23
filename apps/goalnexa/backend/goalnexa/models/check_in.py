from django.db import models
from django.utils import timezone

from core_api.utils import TimestampedModel, generate_uuid7
from goalnexa.models.metric import Metric


class CheckIn(TimestampedModel):
    """A progress log entry against a `Metric` (1-n, like `Metric.goal`) -
    `value` is the metric's new reading as of this check-in (e.g. "82" for
    a weight metric currently at 85), not a delta to add.

    `checked_in_at` is WHEN the reading was taken - user-editable (log a
    reading after the fact), defaulting to now when left blank. Distinct
    from `created_at` (when the row was written), which stays internal.
    `Metric.current_value` tracks the value of the metric's LATEST
    check-in by `checked_in_at` (see CheckInViewSet's own docstring) -
    stored, not derived on read, so a plain goal/metric list stays a
    single-table query.
    """

    id = models.UUIDField(primary_key=True, default=generate_uuid7, editable=False)
    metric = models.ForeignKey(Metric, on_delete=models.CASCADE, db_column="metric_id", related_name="check_ins")
    value = models.DecimalField(max_digits=14, decimal_places=2)
    note = models.TextField(blank=True, default="")
    checked_in_at = models.DateTimeField(
        default=timezone.now, help_text="When this reading was taken. Leave blank for now."
    )

    class Meta:
        db_table = "check_in"
        # Names the resource in generic UIs (schema `label`/`label_plural`) -
        # Django's default from the class name would be "check in".
        verbose_name = "check-in"
        verbose_name_plural = "check-ins"
        indexes = [models.Index(fields=["metric", "checked_in_at"], name="check_in_metric_time_idx")]
