"""Progress math, server side - the same rules as goalnexa-frontend's
`lib/progress.ts` (keep the two in step), plus the values the server
stores from it:

- A metric's progress = how far its value has moved from `base_value`
  toward `target_value`, in % (`(value - base) / (target - base)`, never
  below 0). A metric whose target equals its base has none.
- A metric's readings over time: each check-in's value (LATEST), or the
  running total `base + sum so far` (SUM).
- A goal's progress = the mean of its ROOT metrics' (sub-metrics break a
  root down; they don't count).
- Projection: each metric's least-squares slope over its readings,
  carried forward from its latest reading to the target date; a metric
  with no trend (< 2 readings) is held where it is. The goal's is the
  mean.
- Health: see `goal_health`.

`refresh_metric` / `refresh_goal` write the stored values - called after
every write that can change them (check-ins, metrics, a goal's target
date) and by `manage.py goalnexa_jobs` as time passes.
"""

from __future__ import annotations

import calendar
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.utils import timezone

from goalnexa import periods
from goalnexa.models import ActivityVerb, CheckIn, CheckInCadence, Goal, GoalHealth, Metric, MetricAggregation, ProgressBy

#: Projected progress at or above this (but under 100%) is AT_RISK; below it, OFF_TRACK.
AT_RISK_FLOOR = 80.0


def metric_pct(value, metric: Metric) -> float | None:
    if getattr(metric, "target_per", ""):
        # A target per period: against every period's quota, or the hit rate (goalnexa.periods).
        return periods.pct(value, metric)
    base = float(metric.base_value)
    span = float(metric.target_value) - base
    if span == 0:
        return None
    return max(0.0, (float(value) - base) / span * 100)


def metric_readings(metric: Metric, check_ins, zone=None) -> list[tuple[datetime, float]]:
    """(when, value) per check-in, oldest first - SUM metrics as running
    totals. With one reading per period (`one_per`), a SUM check-in is its
    period's total so far: it replaces the period's earlier one in the total."""
    ordered = sorted(check_ins, key=lambda c: (c.checked_in_at, c.created_at or c.checked_in_at))
    if metric.aggregation != MetricAggregation.SUM:
        return [(c.checked_in_at, float(c.value)) for c in ordered]
    base = float(metric.base_value)
    readings = []
    if metric.one_per:
        zone = zone or periods.zone_for(metric.goal)
        by_period: dict = {}
        for c in ordered:
            by_period[periods.bucket(c, metric.one_per, zone)] = float(c.value)
            readings.append((c.checked_in_at, base + sum(by_period.values())))
        return readings
    total = base
    for c in ordered:
        total += float(c.value)
        readings.append((c.checked_in_at, total))
    return readings


def project_value(readings: list[tuple[datetime, float]], target: datetime) -> float | None:
    """The value at `target` on the least-squares trend, carried from the
    latest reading. None without a trend, or when `target` isn't after it."""
    if len(readings) < 2:
        return None
    last_t, last_v = readings[-1]
    if target <= last_t:
        return None
    ts = [t.timestamp() for t, _ in readings]
    vs = [v for _, v in readings]
    mean_t = sum(ts) / len(ts)
    mean_v = sum(vs) / len(vs)
    den = sum((t - mean_t) ** 2 for t in ts)
    if den == 0:
        return None
    slope = sum((t - mean_t) * (v - mean_v) for t, v in zip(ts, vs)) / den
    return last_v + slope * (target.timestamp() - last_t.timestamp())


def root_metrics(metrics: list[Metric]) -> list[Metric]:
    """Metrics with no parent, or whose parent isn't one of the same goal's."""
    goal_by_id = {m.id: m.goal_id for m in metrics}
    return [m for m in metrics if m.parent_id is None or m.parent_id == m.id or goal_by_id.get(m.parent_id) != m.goal_id]


def target_datetime(target_date: date) -> datetime:
    return timezone.make_aware(datetime.combine(target_date, time.min))


def goal_health(
    progress: float | None, projected: float | None, target_date: date | None, today: date, *, can_achieve: bool = True
) -> str:
    """ACHIEVED at 100%+ (unless `can_achieve` is off: a hit rate at 100%
    before the end isn't done yet). Otherwise, with a target date: past it
    = OFF_TRACK; before it, from the projection - 100%+ ON_TRACK,
    AT_RISK_FLOOR+ AT_RISK, below OFF_TRACK. UNKNOWN without metrics, a
    target date or a trend."""
    if progress is None:
        return GoalHealth.UNKNOWN
    if progress >= 100 and can_achieve:
        return GoalHealth.ACHIEVED
    if target_date is None:
        return GoalHealth.UNKNOWN
    if today > target_date:
        return GoalHealth.OFF_TRACK
    if projected is None:
        return GoalHealth.UNKNOWN
    if projected >= 100:
        return GoalHealth.ON_TRACK
    return GoalHealth.AT_RISK if projected >= AT_RISK_FLOOR else GoalHealth.OFF_TRACK


def _add_months(when: datetime, months: int) -> datetime:
    month = when.month - 1 + months
    year = when.year + month // 12
    month = month % 12 + 1
    return when.replace(year=year, month=month, day=min(when.day, calendar.monthrange(year, month)[1]))


def next_due(metric: Metric) -> datetime | None:
    """The last check-in (or the metric's creation) plus its cadence."""
    start = metric.last_checked_in_at or metric.created_at
    if not metric.check_in_every or start is None:
        return None
    if metric.check_in_every == CheckInCadence.DAILY:
        return start + timedelta(days=1)
    if metric.check_in_every == CheckInCadence.WEEKLY:
        return start + timedelta(weeks=1)
    return _add_months(start, 1)


def refresh_metric(metric_id, *, sync_value: bool = True) -> Metric | None:
    """Recomputes a metric's stored `current_value` (unless `sync_value` is
    off, or it has no check-ins - then a value set directly stays),
    `last_checked_in_at` and `check_in_due_at` - clearing `reminded_at`
    when the due date moves."""
    metric = Metric.objects.filter(id=metric_id).select_related("goal__cycle").first()
    if metric is None:
        return None
    check_ins = list(CheckIn.objects.filter(metric_id=metric_id))
    zone = periods.zone_for(metric.goal) if metric.one_per or metric.target_per else None
    # One reading per period: only the last check-in of each counts (goalnexa.periods.counted).
    kept, replaced = periods.counted(metric, check_ins, zone)
    latest = kept[-1] if kept else None
    updates = {"last_checked_in_at": latest.checked_in_at if latest else None}
    if sync_value and latest is not None:
        if metric.aggregation == MetricAggregation.SUM:
            updates["current_value"] = metric.base_value + sum((c.value for c in kept), Decimal(0))
        else:
            updates["current_value"] = latest.value
    if any(c.replaced != (c.id in replaced) for c in check_ins):
        CheckIn.objects.filter(metric_id=metric_id, id__in=replaced, replaced=False).update(replaced=True)
        CheckIn.objects.filter(metric_id=metric_id, replaced=True).exclude(id__in=replaced).update(replaced=False)
    old_due = metric.check_in_due_at
    for name, value in updates.items():
        setattr(metric, name, value)
    if not metric.goal.is_rollup:  # a total's period numbers are its teams' (goalnexa.rollups)
        updates.update(periods.compute(metric, metric.goal, kept, zone=zone))
        for name in ("period_value", "cumulative_target", "expected_value", "hit_rate", "streak"):
            setattr(metric, name, updates[name])
    metric.check_in_due_at = updates["check_in_due_at"] = next_due(metric)
    if metric.check_in_due_at != old_due:
        # A new due date starts a new reminder cycle (goalnexa.reminders).
        metric.reminded_at = updates["reminded_at"] = None
    Metric.objects.filter(id=metric_id).update(**updates)
    return metric


def compute_goal(goal: Goal, metrics: list[Metric], check_ins_by_metric: dict, today: date) -> dict:
    """The stored fields for one goal, from its metrics and their check-ins."""
    usable = [m for m in root_metrics(metrics) if m.goal_id == goal.id and metric_pct(m.current_value, m) is not None]
    if not usable:
        return {"progress": None, "projected_progress": None, "health": GoalHealth.UNKNOWN}
    progress = sum(metric_pct(m.current_value, m) for m in usable) / len(usable)
    projected = None
    if goal.target_date is not None:
        target = target_datetime(goal.target_date)
        zones = {m.id: periods.zone_for(goal) for m in usable if m.one_per}
        # A target per period projects by pace (goalnexa.periods), not by trend.
        values = [
            None if m.target_per else project_value(metric_readings(m, check_ins_by_metric.get(m.id, []), zones.get(m.id)), target)
            for m in usable
        ]
        paces = [periods.pace_pct(m) if m.target_per else None for m in usable]
        if any(v is not None for v in values) or any(p is not None for p in paces):
            projected = sum(
                pace if m.target_per and pace is not None
                else metric_pct(v, m) if v is not None
                else metric_pct(m.current_value, m)
                for m, v, pace in zip(usable, values, paces)
            ) / len(usable)
    # A hit rate is at 100% from the first period hit - it's done only once its goal ends.
    open_hit_rate = any(
        m.target_per and m.progress_by == ProgressBy.HIT_RATE and (goal.target_date is None or today <= goal.target_date)
        for m in usable
    )
    return {
        "progress": _pct(progress),
        "projected_progress": _pct(projected),
        "health": goal_health(progress, projected, goal.target_date, today, can_achieve=not open_hit_rate),
    }


def _pct(value: float | None) -> Decimal | None:
    # Fits the column (max_digits=9): a runaway projection is capped, not an error.
    return None if value is None else Decimal(str(round(min(value, 9_999_999.0), 2)))


def refresh_goal(goal_id) -> Goal | None:
    goal = Goal.objects.filter(id=goal_id).first()
    if goal is None:
        return None
    metrics = list(Metric.objects.filter(goal_id=goal_id))
    check_ins_by_metric: dict = {}
    if goal.target_date is not None:
        for check_in in CheckIn.objects.filter(metric__goal_id=goal_id):
            check_ins_by_metric.setdefault(check_in.metric_id, []).append(check_in)
    fields = compute_goal(goal, metrics, check_ins_by_metric, timezone.localdate())
    Goal.objects.filter(id=goal_id).update(**fields)
    # A team total (goalnexa.rollups) is the system's own: no feed entry,
    # no milestone email for the template's owner.
    if fields["health"] != goal.health and fields["health"] != GoalHealth.UNKNOWN and not goal.is_rollup:
        from goalnexa.activity import record  # activity imports models only; kept lazy for the migration's sake

        record(goal.id, ActivityVerb.HEALTH_CHANGED, **{"from": goal.health, "to": fields["health"]})
    if fields.get("progress") != goal.progress and not goal.is_rollup:
        from goalnexa.lifecycle import on_progress  # milestone emails (50%, 100%)

        on_progress(goal, goal.progress, fields.get("progress"))
    for name, value in fields.items():
        setattr(goal, name, value)
    if goal.template_goal_id and not goal.is_rollup:
        from goalnexa.rollups import on_goal_refreshed  # the team totals this instance counts in

        on_goal_refreshed(goal)
    return goal


def refresh_metric_and_goal(metric_id, *, sync_value: bool = True) -> None:
    metric = refresh_metric(metric_id, sync_value=sync_value)
    if metric is not None:
        refresh_goal(metric.goal_id)
