from django.db import models
from django.utils import timezone

from core_api.utils import generate_uuid7
from goalnexa.models.goal import Goal


class ActivityVerb(models.TextChoices):
    GOAL_CREATED = "goal_created", "Created the goal"
    GOAL_CHANGED = "goal_changed", "Changed the goal"
    METRIC_ADDED = "metric_added", "Added a metric"
    METRIC_CHANGED = "metric_changed", "Changed a metric"
    METRIC_REMOVED = "metric_removed", "Removed a metric"
    CHECKED_IN = "checked_in", "Checked in"
    CHECK_IN_CHANGED = "check_in_changed", "Changed a check-in"
    CHECK_IN_REMOVED = "check_in_removed", "Removed a check-in"
    HEALTH_CHANGED = "health_changed", "Health changed"
    COMMENTED = "commented", "Commented"
    SCORED = "scored", "Scored in a cycle"


class Activity(models.Model):
    """What happened to a goal, newest first - the goal's feed
    (`goalnexa.activity.record`, called from the same writes that refresh
    progress). `actor_id` is who did it (bare id); null for the system
    (a health change) or an ingest-token check-in. `data` holds what the
    feed shows (names, old -> new values), so a row still reads right after
    the metric it mentions is gone. Read-only over the API."""

    id = models.UUIDField(primary_key=True, default=generate_uuid7, editable=False)
    goal = models.ForeignKey(Goal, on_delete=models.CASCADE, db_column="goal_id", related_name="activities")
    actor_id = models.UUIDField(null=True, blank=True)
    verb = models.CharField(max_length=32, choices=ActivityVerb.choices)
    data = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "activity"
        verbose_name_plural = "activities"
        indexes = [models.Index(fields=["goal", "created_at"], name="activity_goal_time_idx")]
