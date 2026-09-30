"""Closing a cycle (`CycleViewSet.close`): every goal in it gets a
`GoalScore` and one of three endings -

- DONE: the goal is marked completed.
- ROLLOVER: completed here, and copied (with its metrics and members)
  into the next cycle. A copied "reading" metric starts from where the old
  one ended (its current value becomes the new base); a "sum" metric starts
  from its original base again - it counts a new period's amounts.
- DROP: the goal is archived; its outcome is DROPPED whatever the score.

A score defaults to the goal's progress / 100, capped at 1.0 (the OKR
scale). Its outcome: ACHIEVED from 0.7 (the usual "stretch goal met"
line), PARTIAL from 0.3, else MISSED. All of it runs in one transaction.
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.utils import timezone

from goalnexa.activity import record
from goalnexa.models import (
    ActivityVerb,
    Cycle,
    CycleStatus,
    Goal,
    GoalMember,
    GoalOutcome,
    GoalScore,
    GoalStatus,
    Metric,
    MetricAggregation,
)
from goalnexa.progress import refresh_goal, refresh_metric

DONE, ROLLOVER, DROP = "done", "rollover", "drop"
ACTIONS = (DONE, ROLLOVER, DROP)
ACHIEVED_FROM = Decimal("0.7")
PARTIAL_FROM = Decimal("0.3")


def default_score(goal: Goal) -> Decimal:
    progress = goal.progress if goal.progress is not None else Decimal(0)
    return min(Decimal(1), max(Decimal(0), progress / 100)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def outcome_for(score: Decimal, action: str) -> str:
    if action == DROP:
        return GoalOutcome.DROPPED
    if score >= ACHIEVED_FROM:
        return GoalOutcome.ACHIEVED
    return GoalOutcome.PARTIAL if score >= PARTIAL_FROM else GoalOutcome.MISSED


def roll_over(goal: Goal, next_cycle: Cycle, actor_id) -> Goal:
    """A copy of `goal` in `next_cycle`, with its metrics and members."""
    copy = Goal.objects.create(
        title=goal.title,
        description=goal.description,
        owner_id=goal.owner_id,
        org_id=goal.org_id,
        visibility=goal.visibility,
        parent=goal.parent,
        cycle=next_cycle,
        target_date=next_cycle.ends_on,
        status=GoalStatus.IN_PROGRESS if next_cycle.status == CycleStatus.ACTIVE else GoalStatus.NOT_STARTED,
    )
    metrics = list(goal.metrics.all())
    new_by_old = {}
    for metric in metrics:
        base = metric.base_value if metric.aggregation == MetricAggregation.SUM else metric.current_value
        new_by_old[metric.id] = Metric.objects.create(
            goal=copy,
            name=metric.name,
            description=metric.description,
            unit=metric.unit,
            aggregation=metric.aggregation,
            check_in_every=metric.check_in_every,
            base_value=base,
            current_value=base,
            target_value=metric.target_value,
        )
    for metric in metrics:
        if metric.parent_id in new_by_old:
            Metric.objects.filter(id=new_by_old[metric.id].id).update(parent=new_by_old[metric.parent_id])
    for new in new_by_old.values():
        refresh_metric(new.id)
    GoalMember.objects.bulk_create(GoalMember(goal=copy, user_id=m.user_id) for m in goal.members.all())
    refresh_goal(copy.id)
    record(copy.id, ActivityVerb.GOAL_CREATED, actor_id, title=copy.title, rolled_from=goal.id, cycle=next_cycle.name)
    return copy


@transaction.atomic
def close_cycle(cycle: Cycle, decisions: dict, *, next_cycle: Cycle | None, retro: str, actor_id) -> list[GoalScore]:
    """`decisions`: goal id (str) -> `{"action", "score"?, "reflection"?}`.
    A goal with no decision is scored by default and marked DONE."""
    scores = []
    for goal in Goal.objects.filter(cycle=cycle).select_related("cycle").order_by("created_at"):
        decision = decisions.get(str(goal.id), {})
        action = decision.get("action", DONE)
        score = decision.get("score")
        score = default_score(goal) if score is None else Decimal(str(score)).quantize(Decimal("0.01"))
        rolled_to = roll_over(goal, next_cycle, actor_id) if action == ROLLOVER else None
        scores.append(
            GoalScore.objects.create(
                goal=goal,
                cycle=cycle,
                score=score,
                outcome=outcome_for(score, action),
                final_progress=goal.progress,
                final_health=goal.health,
                reflection=decision.get("reflection", ""),
                rolled_to=rolled_to,
            )
        )
        Goal.objects.filter(id=goal.id).update(status=GoalStatus.ARCHIVED if action == DROP else GoalStatus.COMPLETED)
        record(
            goal.id,
            ActivityVerb.SCORED,
            actor_id,
            cycle=cycle.name,
            score=score,
            outcome=scores[-1].outcome,
            rolled_to=rolled_to.id if rolled_to else None,
        )
    cycle.status = CycleStatus.CLOSED
    cycle.closed_at = timezone.now()
    cycle.retro = retro
    cycle.save(update_fields=["status", "closed_at", "retro", "updated_at"])
    return scores
