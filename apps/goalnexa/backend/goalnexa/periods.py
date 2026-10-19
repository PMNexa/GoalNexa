"""Targets per period (docs/period-targets.md): "10 calls a day", "3
workouts a week". A SUM metric with `target_per` set has `target_value` =
`base_value` + the quota per period; this module turns its check-ins into
the numbers the server stores on it (`refresh_metric`):

- `period_value`: the amount checked in during the current period;
- `cumulative_target`: base + quota x every counted period in the goal's
  range (cycle start, or the metric's creation -> target date; up to today
  without a target date) - a partial period counts by its share of
  counted days (a week from Wednesday is 3/5 of a weekday quota);
- `expected_value`: base + quota x the periods so far, today's period by
  the share of its counted days already begun;
- `hit_rate`: % of periods at or over their quota - every ended period,
  plus the current one once it's hit; `streak`: hits in a row up to now.

Days are counted in the goal's time zone - its organization's (platform-org
`Organization.timezone`, read through core's registry), else the owner's
(`ReminderSettings.timezone`), else UTC - over every day or weekdays only
(`count_days`).

`metric_pct` (goalnexa.progress) then measures a TOTAL metric against
`cumulative_target` and a HIT_RATE one by `hit_rate`; `pace_pct` is what
replaces the trend projection for both.
"""

from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.utils import timezone

from core_api.registry import endpoint_model
from goalnexa.models import CountDays, ProgressBy, TargetPer

ORGS_ENDPOINT = "/api/v1/orgs"
UTC = ZoneInfo("UTC")
CENT = Decimal("0.01")

#: How the current period is named on screens and in messages.
PERIOD_NOUNS = {
    TargetPer.DAY: ("today", "a day"),
    TargetPer.WEEK: ("this week", "a week"),
    TargetPer.MONTH: ("this month", "a month"),
    TargetPer.QUARTER: ("this quarter", "a quarter"),
    TargetPer.YEAR: ("this year", "a year"),
}


def _zone(name: str | None) -> ZoneInfo | None:
    if not name:
        return None
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        return None


def zone_for(goal, cache: dict | None = None) -> ZoneInfo:
    """The goal's time zone: its org's, else its owner's, else UTC."""
    cache = cache if cache is not None else {}
    key = ("org", goal.org_id) if goal.org_id else ("user", goal.owner_id)
    if key not in cache:
        zone = None
        if goal.org_id:
            model = endpoint_model(ORGS_ENDPOINT)
            if model is not None and hasattr(model, "timezone"):
                zone = _zone(model.objects.filter(id=goal.org_id).values_list("timezone", flat=True).first())
        if zone is None:
            from goalnexa.models import ReminderSettings

            zone = _zone(ReminderSettings.objects.filter(user_id=goal.owner_id).values_list("timezone", flat=True).first())
        cache[key] = zone or UTC
    return cache[key]


def local_date(when: datetime, zone: ZoneInfo) -> date:
    return when.astimezone(zone).date()


def period_start(day: date, per: str) -> date:
    if per == TargetPer.WEEK:
        return day - timedelta(days=day.weekday())
    if per == TargetPer.MONTH:
        return day.replace(day=1)
    if per == TargetPer.QUARTER:
        return date(day.year, 3 * ((day.month - 1) // 3) + 1, 1)
    if per == TargetPer.YEAR:
        return date(day.year, 1, 1)
    return day


def _add_months(day: date, months: int) -> date:
    month = day.month - 1 + months
    year = day.year + month // 12
    month = month % 12 + 1
    return date(year, month, min(day.day, calendar.monthrange(year, month)[1]))


def next_start(start: date, per: str) -> date:
    if per == TargetPer.WEEK:
        return start + timedelta(days=7)
    if per == TargetPer.MONTH:
        return _add_months(start, 1)
    if per == TargetPer.QUARTER:
        return _add_months(start, 3)
    if per == TargetPer.YEAR:
        return _add_months(start, 12)
    return start + timedelta(days=1)


def counts(day: date, count_days: str) -> bool:
    return count_days != CountDays.WEEKDAYS or day.weekday() < 5


def counted_days(first: date, last: date, count_days: str) -> int:
    """Counted days from `first` to `last`, both included."""
    if last < first:
        return 0
    total = (last - first).days + 1
    if count_days != CountDays.WEEKDAYS:
        return total
    weeks, extra = divmod(total, 7)
    days = weeks * 5
    for offset in range(extra):
        if (first + timedelta(days=weeks * 7 + offset)).weekday() < 5:
            days += 1
    return days


@dataclass
class Period:
    start: date  # the period's own first day (unclipped)
    first: date  # clipped to the range
    last: date
    weight: float  # counted days in [first, last] / counted days in the whole period
    counted: int


def periods(range_first: date, range_last: date, per: str, count_days: str) -> list[Period]:
    """Every period touching the range, clipped to it; periods with no
    counted day (a Saturday, for a weekday quota) are left out."""
    out = []
    start = period_start(range_first, per)
    while start <= range_last:
        end = next_start(start, per) - timedelta(days=1)
        first, last = max(start, range_first), min(end, range_last)
        counted = counted_days(first, last, count_days)
        full = counted_days(start, end, count_days)
        if counted and full:
            out.append(Period(start, first, last, counted / full, counted))
        start = next_start(start, per)
    return out


def goal_range(metric, goal, zone: ZoneInfo, first_check_in: date | None) -> tuple[date, date | None]:
    """(first day, last day or None) the metric's quota runs over."""
    cycle = goal.cycle if goal.cycle_id else None
    first = cycle.starts_on if cycle else local_date(metric.created_at, zone)
    if first_check_in is not None and first_check_in < first:
        first = first_check_in
    last = goal.target_date or (cycle.ends_on if cycle else None)
    return first, last


#: Shortest first - `one_per` can't be longer than `target_per`.
PERIOD_RANK = {TargetPer.DAY: 1, TargetPer.WEEK: 2, TargetPer.MONTH: 3, TargetPer.QUARTER: 4, TargetPer.YEAR: 5}


def _order(check_in) -> tuple:
    return (check_in.checked_in_at, check_in.created_at or check_in.checked_in_at)


def bucket(check_in, per: str, zone: ZoneInfo) -> date:
    return period_start(local_date(check_in.checked_in_at, zone), per)


def counted(metric, check_ins, zone: ZoneInfo | None = None) -> tuple[list, set]:
    """(the check-ins that count, oldest first; the ids of the replaced ones).
    With `one_per` set, only the last check-in of each period counts (by
    `checked_in_at`, then when it was saved); otherwise every one does."""
    ordered = sorted(check_ins, key=_order)
    if not getattr(metric, "one_per", ""):
        return ordered, set()
    zone = zone or zone_for(metric.goal)
    last: dict[date, object] = {}
    for check_in in ordered:
        last[bucket(check_in, metric.one_per, zone)] = check_in
    kept_ids = {c.id for c in last.values()}
    return [c for c in ordered if c.id in kept_ids], {c.id for c in ordered if c.id not in kept_ids}


#: A goal's or metric's check-in setting (`snap_to` + `SnapMoment`), what
#: following rows copy. All but `snap_due` decide where check-ins land.
SNAP_FIELDS = ("snap_to", "snap_weekday", "snap_quarter_month", "snap_month", "snap_day", "snap_time", "snap_due")
STAMP_FIELDS = SNAP_FIELDS[:-1]
#: What a row following nothing gets: any time, the moment fields' defaults.
ANY_TIME = {
    "snap_to": "", "snap_weekday": 1, "snap_quarter_month": 1, "snap_month": 1, "snap_day": 1, "snap_time": "00:00",
    "snap_due": False,
}

#: A new row with its own setting: the model's defaults (due at the moment).
NEW_SETTINGS = {**ANY_TIME, "snap_due": True}


def snap_settings(row) -> dict:
    return {name: getattr(row, name) for name in SNAP_FIELDS}


def _on_day(year: int, month: int, day: int) -> date:
    return date(year, month, min(day, calendar.monthrange(year, month)[1]))


def moment_day(start: date, row) -> date:
    """The day in the period starting `start` (of `row.snap_to`) that
    `row`'s check-ins are for (`SnapMoment`)."""
    per = row.snap_to
    if per == TargetPer.WEEK:
        return start + timedelta(days=row.snap_weekday - 1)
    if per == TargetPer.MONTH:
        return _on_day(start.year, start.month, row.snap_day)
    if per == TargetPer.QUARTER:
        return _on_day(start.year, start.month + row.snap_quarter_month - 1, row.snap_day)
    if per == TargetPer.YEAR:
        return _on_day(start.year, row.snap_month, row.snap_day)
    return start


def moment(start: date, row, zone: ZoneInfo) -> datetime:
    """`row`'s moment in the period starting `start`, in `zone`."""
    day = moment_day(start, row)
    hour, minute = (int(part) for part in (row.snap_time or "00:00").split(":"))
    return datetime(day.year, day.month, day.day, hour, minute, tzinfo=zone)


def snap_time(metric, when: datetime, zone: ZoneInfo | None = None) -> datetime:
    """`when` moved to its `metric.snap_to` period's moment (`SnapMoment`:
    the first day, 00:00 by default) in the goal's zone (unchanged without
    a period). The moment is inside the period, so the check-in stays in it."""
    if not metric.snap_to:
        return when
    zone = zone or zone_for(metric.goal)
    return moment(period_start(local_date(when, zone), metric.snap_to), metric, zone)


def due_moment(metric, zone: ZoneInfo | None = None) -> datetime | None:
    """When a metric whose check-ins are due at their moment (`snap_due`)
    next needs one: the moment of the period after its latest check-in's,
    or - with none yet - of the period it was created in (the next one if
    it was created after that moment). None without that schedule."""
    if not (metric.snap_to and metric.snap_due):
        return None
    zone = zone or zone_for(metric.goal)
    if metric.last_checked_in_at is not None:
        start = period_start(local_date(metric.last_checked_in_at, zone), metric.snap_to)
        return moment(next_start(start, metric.snap_to), metric, zone)
    if metric.created_at is None:
        return None
    start = period_start(local_date(metric.created_at, zone), metric.snap_to)
    first = moment(start, metric, zone)
    return first if metric.created_at <= first else moment(next_start(start, metric.snap_to), metric, zone)


def resnap(metric) -> int:
    """Re-stamps every check-in of `metric` to its `snap_to` period's moment
    (after the setting changed); returns how many moved."""
    from goalnexa.models import CheckIn

    if not metric.snap_to:
        return 0
    zone = zone_for(metric.goal)
    moved = 0
    for check_in in CheckIn.objects.filter(metric_id=metric.id).only("id", "checked_in_at"):
        snapped = snap_time(metric, check_in.checked_in_at, zone)
        if snapped != check_in.checked_in_at:
            CheckIn.objects.filter(id=check_in.id).update(checked_in_at=snapped)
            moved += 1
    return moved


def metric_follow_plan(goal_id, goal_settings: dict, overrides: dict | None = None) -> list:
    """[(metric, settings)] for the metrics of a goal whose setting is about
    to change: a metric set to "inherited" (`snap_to_goal`) takes its parent
    metric's (P-67), a top-level one its goal's (`goal_settings`).
    `overrides` = {metric id: its new settings} for metrics changed directly
    (left out of the result). Only rows that would change are listed."""
    from goalnexa.models import Metric

    overrides = overrides or {}
    rows = list(Metric.objects.filter(goal_id=goal_id).select_related("goal"))
    by_id = {m.id: m for m in rows}
    effective: dict = {}

    def settings_of(metric, seen=()):
        if metric.id not in effective:
            if metric.id in overrides:
                value = overrides[metric.id]
            elif metric.snap_to_goal:
                parent = by_id.get(metric.parent_id)
                value = settings_of(parent, (*seen, metric.id)) if parent and parent.id not in seen else goal_settings
            else:
                value = snap_settings(metric)
            effective[metric.id] = value
        return effective[metric.id]

    return [(m, settings_of(m)) for m in rows if m.id not in overrides and settings_of(m) != snap_settings(m)]


def follow_plan(goal, settings: dict) -> tuple[list, list]:
    """What follows when `goal`'s setting becomes `settings`: ([(sub-goal,
    settings)], [(metric, settings)]) - every sub-goal set to "inherited"
    (`snap_to_parent`), all the way down, and every inheriting metric of
    those goals. Only rows that would change; nothing is saved."""
    from goalnexa.models import Goal

    goals, metrics = [], []
    queue, seen = [(goal.id, settings)], {goal.id}
    while queue:
        goal_id, value = queue.pop()
        metrics += metric_follow_plan(goal_id, value)
        for child in Goal.objects.filter(parent_id=goal_id, snap_to_parent=True, is_rollup=False).exclude(id__in=seen):
            seen.add(child.id)
            if snap_settings(child) != value:
                goals.append((child, value))
            queue.append((child.id, value))
    return goals, metrics


def apply_follow(goals: list, metrics: list) -> None:
    """Saves a `follow_plan`: moves the metrics' check-ins and refreshes them."""
    from goalnexa.models import Goal, Metric
    from goalnexa.progress import refresh_goal, refresh_metric  # progress imports periods

    for goal, value in goals:
        Goal.objects.filter(id=goal.id).update(**value)
    touched = set()
    for metric, value in metrics:
        moved = any(getattr(metric, name) != value[name] for name in STAMP_FIELDS)
        Metric.objects.filter(id=metric.id).update(**value)
        for name, field_value in value.items():
            setattr(metric, name, field_value)
        if moved:
            resnap(metric)
        refresh_metric(metric.id, sync_value=moved)
        touched.add(metric.goal_id)
    for goal_id in touched:
        refresh_goal(goal_id)


def replaced_by(check_in, zone: ZoneInfo | None = None):
    """The check-in this one replaced - the latest earlier one in its period -
    or None (no `one_per`, none earlier, or this one is itself replaced)."""
    metric = check_in.metric
    if not metric.one_per or check_in.replaced:
        return None
    zone = zone or zone_for(metric.goal)
    period = bucket(check_in, metric.one_per, zone)
    earlier = [
        c for c in type(check_in).objects.filter(metric_id=metric.id).exclude(id=check_in.id)
        if bucket(c, metric.one_per, zone) == period and _order(c) <= _order(check_in)
    ]
    return max(earlier, key=_order) if earlier else None


def _q(value: float) -> Decimal:
    return Decimal(str(round(value, 2))).quantize(CENT)


def compute(metric, goal, check_ins, *, today: date | None = None, zone: ZoneInfo | None = None) -> dict:
    """The stored period fields of one metric, from its check-ins. Empty
    (all None) when the metric has no target per period or no quota."""
    empty = {"period_value": None, "cumulative_target": None, "expected_value": None, "hit_rate": None, "streak": None}
    if not metric.target_per:
        return empty
    zone = zone or zone_for(goal)
    today = today or local_date(timezone.now(), zone)
    base = float(metric.base_value)
    quota = float(metric.target_value) - base
    if quota <= 0:
        return empty
    by_day: dict[date, float] = {}
    for check_in in check_ins:
        day = local_date(check_in.checked_in_at, zone)
        by_day[day] = by_day.get(day, 0.0) + float(check_in.value)
    first, last = goal_range(metric, goal, zone, min(by_day) if by_day else None)
    horizon = last if last is not None else max(today, first)
    plan = periods(first, horizon, metric.target_per, metric.count_days)
    value_of = {p.start: sum(v for d, v in by_day.items() if p.first <= d <= p.last) for p in plan}
    current = next((p for p in plan if p.first <= today <= p.last), None)

    expected_weight = 0.0
    hits = considered = 0
    flags = []
    for p in plan:
        need = quota * p.weight
        hit = value_of[p.start] + 1e-9 >= need
        if p.last < today:
            expected_weight += p.weight
            considered += 1
            hits += hit
            flags.append(hit)
        elif p is current:
            begun = counted_days(p.first, today, metric.count_days)
            expected_weight += p.weight * (begun / p.counted)
            if hit:
                considered += 1
                hits += 1
                flags.append(True)
    streak = 0
    for hit in reversed(flags):
        if not hit:
            break
        streak += 1
    if current is not None:
        period_value = value_of[current.start]
    elif plan and plan[-1].last < today:
        period_value = value_of[plan[-1].start]
    else:
        period_value = 0.0
    return {
        "period_value": _q(period_value),
        "cumulative_target": _q(base + quota * sum(p.weight for p in plan)),
        "expected_value": _q(base + quota * expected_weight),
        "hit_rate": _q(hits / considered * 100) if considered else None,
        "streak": streak,
    }


def pct(value, metric) -> float | None:
    """A period metric's progress, in % - the share of periods hit, or the
    total against `cumulative_target`."""
    if getattr(metric, "progress_by", ProgressBy.TOTAL) == ProgressBy.HIT_RATE:
        return None if metric.hit_rate is None else float(metric.hit_rate)
    if metric.cumulative_target is None:
        return None
    span = float(metric.cumulative_target) - float(metric.base_value)
    if span <= 0:
        return None
    return max(0.0, (float(value) - float(metric.base_value)) / span * 100)


def pace_pct(metric) -> float | None:
    """Where a period metric is heading, in %: its hit rate, or the total
    against what was expected so far (on pace = 100%)."""
    if metric.progress_by == ProgressBy.HIT_RATE:
        return None if metric.hit_rate is None else float(metric.hit_rate)
    if metric.expected_value is None:
        return None
    expected = float(metric.expected_value) - float(metric.base_value)
    if expected <= 0:
        return None
    return max(0.0, (float(metric.current_value) - float(metric.base_value)) / expected * 100)


def current_quota(
    metric, goal, *, today: date | None = None, zone: ZoneInfo | None = None, first_check_in: date | None = None
) -> tuple[Period | None, float]:
    """The current period (None outside the range or on an uncounted day)
    and its quota. `first_check_in` stretches the range back, like `compute`."""
    zone = zone or zone_for(goal)
    today = today or local_date(timezone.now(), zone)
    first, last = goal_range(metric, goal, zone, first_check_in)
    if today < first or (last is not None and today > last):
        return None, 0.0
    start = period_start(today, metric.target_per)
    end = next_start(start, metric.target_per) - timedelta(days=1)
    plan = periods(max(first, start), end if last is None else min(last, end), metric.target_per, metric.count_days)
    current = next((p for p in plan if p.first <= today <= p.last), None)
    if current is None:
        return None, 0.0
    quota = (float(metric.target_value) - float(metric.base_value)) * current.weight
    return current, quota


def shown(metric, goal, check_ins, per: str, day: date, *, zone: ZoneInfo | None = None) -> dict:
    """One metric in the period `per` around `day` - the team board's "Show
    by": `value` = the amount done in it (SUM; only check-ins that count,
    see `counted`) or its last reading (LATEST; None without a check-in in
    that period - an earlier reading isn't carried forward; SUM too: None
    = nothing checked in, not 0), `count` = the check-ins that count in it,
    `last_at` = the latest one's time, and `quota` = its target when the
    metric's target is per that same period (prorated, like
    `current_quota`), else None."""
    from goalnexa.models import MetricAggregation

    zone = zone or zone_for(goal)
    start = period_start(day, per)
    last = next_start(start, per) - timedelta(days=1)
    kept, _ = counted(metric, check_ins, zone)
    inside = [c for c in kept if start <= local_date(c.checked_in_at, zone) <= last]
    if not inside:
        value = None
    elif metric.aggregation == MetricAggregation.SUM:
        value = float(sum((c.value for c in inside), Decimal(0)))
    else:
        value = float(inside[-1].value)
    quota = None
    if metric.target_per == per and metric.target_value != metric.base_value:
        first = min((local_date(c.checked_in_at, zone) for c in check_ins), default=None)
        period, amount = current_quota(metric, goal, today=min(max(day, start), last), zone=zone, first_check_in=first)
        quota = round(amount, 2) if period is not None else None
    return {"start": start, "last": last, "value": None if value is None else round(value, 2), "quota": quota,
            "count": len(inside), "last_at": max(c.checked_in_at for c in inside).isoformat() if inside else None}


def shown_series(metric, goal, check_ins, per: str, day: date, count: int, *, zone: ZoneInfo | None = None) -> list[dict]:
    """`shown` for the `count` periods `per` ending with the one around
    `day`, oldest first - the team board's "Over time" columns."""
    zone = zone or zone_for(goal)
    starts = [period_start(day, per)]
    while len(starts) < count:
        starts.append(period_start(starts[-1] - timedelta(days=1), per))
    return [shown(metric, goal, check_ins, per, start, zone=zone) for start in reversed(starts)]


def pace_hint(metric, goal, *, zone: ZoneInfo | None = None, today: date | None = None) -> dict | None:
    """What's left, for screens and assistants. A period metric: this
    period's amount, its quota and what's left of it. A whole-goal SUM
    metric with a target date ahead: the amount needed per day (and per
    week from two weeks out) to land on target. Else None."""
    from goalnexa.models import MetricAggregation

    is_total = getattr(goal, "is_rollup", False) and metric.target_per  # a total keeps readings of its teams' sums
    if (metric.aggregation != MetricAggregation.SUM and not is_total) or metric.target_value == metric.base_value:
        return None
    zone = zone or zone_for(goal)
    today = today or local_date(timezone.now(), zone)
    if metric.target_per:
        current, quota = current_quota(metric, goal, today=today, zone=zone)
        if current is None:
            return {"per": metric.target_per, "in_period": False}
        done = float(metric.period_value or 0)
        return {
            "per": metric.target_per,
            "in_period": True,
            "period_label": PERIOD_NOUNS[metric.target_per][0],
            "done": round(done, 2),
            "quota": round(quota, 2),
            "left": round(max(0.0, quota - done), 2),
        }
    if goal.target_date is None or goal.target_date < today:
        return None
    left = float(metric.target_value) - float(metric.current_value)
    days = (goal.target_date - today).days + 1
    if left <= 0 or days <= 0:
        return {"per": "", "left": round(max(0.0, left), 2), "days_left": max(days, 0)}
    hint = {"per": "", "left": round(left, 2), "days_left": days, "per_day": round(left / days, 2)}
    if days >= 14:
        hint["per_week"] = round(left / days * 7, 2)
    return hint
