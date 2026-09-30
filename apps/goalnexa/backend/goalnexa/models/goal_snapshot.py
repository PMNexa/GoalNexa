from django.db import models

from goalnexa.models.goal import Goal, GoalHealth


class GoalSnapshot(models.Model):
    """A goal's stored progress/health on one day - taken daily by
    `manage.py goalnexa_jobs`, so the digest can say what moved this week
    without replaying every check-in. Internal: no API."""

    goal = models.ForeignKey(Goal, on_delete=models.CASCADE, db_column="goal_id", related_name="snapshots")
    date = models.DateField()
    progress = models.DecimalField(max_digits=9, decimal_places=2, null=True, blank=True)
    projected_progress = models.DecimalField(max_digits=9, decimal_places=2, null=True, blank=True)
    health = models.CharField(max_length=16, choices=GoalHealth.choices, default=GoalHealth.UNKNOWN)

    class Meta:
        db_table = "goal_snapshot"
        constraints = [models.UniqueConstraint(fields=["goal", "date"], name="uq_goal_snapshot_goal_date")]
