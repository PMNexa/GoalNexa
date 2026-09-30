from django.db import models

from core_api.utils import TimestampedModel, generate_uuid7
from goalnexa.models.cycle import Cycle
from goalnexa.models.goal import Goal, GoalHealth


class GoalOutcome(models.TextChoices):
    ACHIEVED = "achieved", "Achieved"
    PARTIAL = "partial", "Partial"
    MISSED = "missed", "Missed"
    DROPPED = "dropped", "Dropped"


class GoalScore(TimestampedModel):
    """A goal's result in a closed cycle - written once, by
    `CycleViewSet.close`, and never recomputed: editing the goal later
    doesn't change its history. `score` is the OKR scale, 0.0-1.0 (0.7 is
    a good result for an ambitious goal); `outcome` follows from it
    (`goalnexa.cycles.outcome_for`) unless the goal was dropped.
    `rolled_to` is the goal's copy in the next cycle, if it was rolled over.
    """

    id = models.UUIDField(primary_key=True, default=generate_uuid7, editable=False)
    goal = models.ForeignKey(Goal, on_delete=models.CASCADE, db_column="goal_id", related_name="scores")
    cycle = models.ForeignKey(Cycle, on_delete=models.CASCADE, db_column="cycle_id", related_name="scores")
    score = models.DecimalField(max_digits=3, decimal_places=2)
    outcome = models.CharField(max_length=16, choices=GoalOutcome.choices)
    final_progress = models.DecimalField(max_digits=9, decimal_places=2, null=True, blank=True)
    final_health = models.CharField(max_length=16, choices=GoalHealth.choices, default=GoalHealth.UNKNOWN)
    reflection = models.TextField(blank=True, default="")
    rolled_to = models.ForeignKey(
        Goal, on_delete=models.SET_NULL, null=True, blank=True, db_column="rolled_to_id", related_name="rolled_from"
    )

    class Meta:
        db_table = "goal_score"
        verbose_name = "goal score"
        constraints = [models.UniqueConstraint(fields=["goal", "cycle"], name="uq_goal_score_goal_cycle")]
