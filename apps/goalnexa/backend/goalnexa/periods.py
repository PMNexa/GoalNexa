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

Periods run from one moment of the metric's frequency to the next (P-93,
`period_key`): a weekly Friday 17:00 metric's week is Friday 17:00 ->
Friday 17:00, and a check-in moves to the moment that opens its period
(`snap_time`). A period is keyed by the first day of the calendar period
its moment is in. A target period coarser than the frequency (a weekly
quota, daily check-ins at 09:00) opens on the calendar period's first day
at the frequency's time; with no frequency, periods are calendar ones.

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
from django.utils.translation import gettext, gettext_noop

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


def prev_start(start: date, per: str) -> date:
    if per == TargetPer.WEEK:
        return start - timedelta(days=7)
    if per == TargetPer.MONTH:
        return _add_months(start, -1)
    if per == TargetPer.QUARTER:
        return _add_months(start, -3)
    if per == TargetPer.YEAR:
        return _add_months(start, -12)
    return start - timedelta(days=1)


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
    start: date  # the period's key: the first day of the calendar period its moment is in
    first: date  # its first day (the moment's), clipped to the range
    last: date  # its last day (the day before the next moment's), clipped
    weight: float  # counted days in [first, last] / counted days in the whole period
    counted: int


def periods(range_first: date, range_last: date, per: str, count_days: str, row=None) -> list[Period]:
    """Every period of `per` touching the range, clipped to it - periods run
    from one of `row`'s moments to the next (`period_days`); periods with no
    counted day (a Saturday, for a weekday quota) are left out."""
    out = []
    start = day_key(range_first, per, row)
    while True:
        own_first, own_last = period_days(start, per, row)
        if own_first > range_last:
            break
        first, last = max(own_first, range_first), min(own_last, range_last)
        counted = counted_days(first, last, count_days)
        full = counted_days(own_first, own_last, count_days)
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
#: A period as a word in a sentence ("a target per week") - see `period_name`.
PERIOD_NAMES = {
    "day": gettext_noop("day"), "week": gettext_noop("week"), "month": gettext_noop("month"),
    "quarter": gettext_noop("quarter"), "year": gettext_noop("year"),
}


def period_name(code) -> str:
    """`code` ("week") as a word in the request's language."""
    code = str(code or "")
    return gettext(PERIOD_NAMES[code]) if code in PERIOD_NAMES else code


PERIOD_RANK = {TargetPer.DAY: 1, TargetPer.WEEK: 2, TargetPer.MONTH: 3, TargetPer.QUARTER: 4, TargetPer.YEAR: 5}


def _order(check_in) -> tuple:
    return (check_in.checked_in_at, check_in.created_at or check_in.checked_in_at)


def bucket(check_in, per: str, zone: ZoneInfo, row=None) -> date:
    """The key of the period of `per` (`row`'s moments) a check-in is in."""
    return period_key(check_in.checked_in_at, per, row if row is not None else check_in.metric, zone)


def counted_per(metric) -> str:
    """The period whose last check-in is the one that counts: `one_per`, else -
    for a new value (LATEST) - its check-in period (`snap_to`: they share the
    period's moment, so the one saved last wins). An amount adds up: ""."""
    from goalnexa.models import MetricAggregation

    one_per = getattr(metric, "one_per", "")
    if one_per:
        return one_per
    return getattr(metric, "snap_to", "") if metric.aggregation == MetricAggregation.LATEST else ""


def counted(metric, check_ins, zone: ZoneInfo | None = None) -> tuple[list, set]:
    """(the check-ins that count, oldest first; the ids of the replaced ones).
    With a `counted_per` period, only the last check-in of each counts (by
    `checked_in_at`, then when it was saved); otherwise every one does."""
    ordered = sorted(check_ins, key=_order)
    per = counted_per(metric)
    if not per:
        return ordered, set()
    zone = zone or zone_for(metric.goal)
    last: dict[date, object] = {}
    for check_in in ordered:
        last[bucket(check_in, per, zone, metric)] = check_in
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


def _frequency(row) -> str:
    return getattr(row, "snap_to", "") or ""


def moment_day(start: date, row, per: str | None = None) -> date:
    """The day of `row`'s moment in the calendar period of `per` (default:
    its frequency, `row.snap_to`) starting `start` (`SnapMoment`). A period
    other than the frequency (a coarser target period, or any time) starts
    on its first day."""
    per = per or _frequency(row)
    if row is None or per != _frequency(row):
        return start
    if per == TargetPer.WEEK:
        return start + timedelta(days=row.snap_weekday - 1)
    if per == TargetPer.MONTH:
        return _on_day(start.year, start.month, row.snap_day)
    if per == TargetPer.QUARTER:
        return _on_day(start.year, start.month + row.snap_quarter_month - 1, row.snap_day)
    if per == TargetPer.YEAR:
        return _on_day(start.year, row.snap_month, row.snap_day)
    return start


def moment(start: date, row, zone: ZoneInfo, per: str | None = None) -> datetime:
    """`row`'s moment in the calendar period of `per` starting `start`, in
    `zone`: the frequency's time (00:00 with no frequency) on `moment_day`."""
    day = moment_day(start, row, per)
    clock = (row.snap_time or "00:00") if row is not None and _frequency(row) else "00:00"
    hour, minute = (int(part) for part in clock.split(":"))
    return datetime(day.year, day.month, day.day, hour, minute, tzinfo=zone)


def period_key(when: datetime, per: str, row, zone: ZoneInfo) -> date:
    """The period of `per` that `when` is in (P-93): periods run from one of
    `row`'s moments to the next, so it's the latest moment at or before
    `when`. Named by the first day of the calendar period that moment is in."""
    start = period_start(local_date(when, zone), per)
    if when < moment(start, row, zone, per):
        start = prev_start(start, per)
    return start


def day_key(day: date, per: str, row=None) -> date:
    """`period_key` for a whole day (the moment's time ignored): the period
    whose days (`period_days`) include `day`."""
    start = period_start(day, per)
    return prev_start(start, per) if day < moment_day(start, row, per) else start


def period_days(start: date, per: str, row=None) -> tuple[date, date]:
    """(first day, last day) of the period keyed `start`: its moment's day
    to the day before the next moment's."""
    return moment_day(start, row, per), moment_day(next_start(start, per), row, per) - timedelta(days=1)


def period_bounds(start: date, per: str, row, zone: ZoneInfo) -> tuple[datetime, datetime]:
    """(opens, closes) of the period keyed `start`: its moment and the next one."""
    return moment(start, row, zone, per), moment(next_start(start, per), row, zone, per)


def snap_time(metric, when: datetime, zone: ZoneInfo | None = None) -> datetime:
    """`when` moved to the latest moment of `metric`'s frequency at or before
    it (P-93), in the goal's zone; unchanged with no frequency."""
    if not metric.snap_to:
        return when
    zone = zone or zone_for(metric.goal)
    return moment(period_key(when, metric.snap_to, metric, zone), metric, zone)


def period_moment(metric, day: date, zone: ZoneInfo | None = None) -> datetime:
    """A check-in sent for a period (`period` on a check-in): the moment of
    the period of `metric`'s frequency whose days include `day` - for a
    Friday 17:00 frequency, Thursday Nov 6 is the week from Friday Oct 31
    17:00. With no frequency: `day`, 00:00."""
    zone = zone or zone_for(metric.goal)
    if not metric.snap_to:
        return datetime(day.year, day.month, day.day, tzinfo=zone)
    return moment(day_key(day, metric.snap_to, metric), metric, zone)


def due_moment(metric, zone: ZoneInfo | None = None) -> datetime | None:
    """When a metric with a frequency next needs a check-in: the moment after
    its latest check-in's - or, with none yet, after the one before its
    creation. None with no frequency (`snap_due` no longer matters - P-93)."""
    if not metric.snap_to:
        return None
    since = metric.last_checked_in_at or metric.created_at
    if since is None:
        return None
    zone = zone or zone_for(metric.goal)
    return moment(next_start(period_key(since, metric.snap_to, metric, zone), metric.snap_to), metric, zone)


def resnap(metric) -> int:
    """Moves every check-in of `metric` to the moment before the time it was
    given (`CheckIn.entered_at`) - after the frequency changed, or asked for
    with `resnap`; to any time, back to that time. Returns how many moved.
    A check-in from before P-93 has no `entered_at`: it starts from its
    stamp, or - stamped after it was made (dated forward by the old rule) -
    from when it was made. Best effort: its own time is gone."""
    from goalnexa.models import CheckIn

    zone = zone_for(metric.goal) if metric.snap_to else None
    moved = 0
    for check_in in CheckIn.objects.filter(metric_id=metric.id).only("id", "checked_in_at", "created_at", "entered_at"):
        source = check_in.entered_at
        if source is None:
            source = check_in.checked_in_at
            if check_in.created_at is not None and source > check_in.created_at:
                source = check_in.created_at
        if metric.snap_to:
            values = {"checked_in_at": snap_time(metric, source, zone), "entered_at": source}
        else:
            values = {"checked_in_at": source, "entered_at": None}
        if values["checked_in_at"] != check_in.checked_in_at or values["entered_at"] != check_in.entered_at:
            CheckIn.objects.filter(id=check_in.id).update(**values)
            moved += values["checked_in_at"] != check_in.checked_in_at
    return moved


def settled(settings: dict) -> dict:
    """A check-in setting as stored: `snap_due` = has a frequency (P-93 - the
    frequency is the schedule; the field stays for older code and apps)."""
    return {**settings, "snap_due": bool(settings.get("snap_to"))}


def metric_follow_plan(goal_id, goal_settings: dict, overrides: dict | None = None) -> list:
    """[(metric, settings)] for the metrics of a goal whose setting is about
    to change: a metric set to "inherited" (`snap_to_goal`) takes its parent
    metric's (P-80), a top-level one its goal's (`goal_settings`).
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


def apply_follow(goals: list, metrics: list, *, move: bool = True) -> None:
    """Saves a `follow_plan` and refreshes the metrics; with `move` (the
    default) their check-ins move to the new moments (`resnap`)."""
    from goalnexa.models import Goal, Metric
    from goalnexa.progress import refresh_goal, refresh_metric  # progress imports periods

    for goal, value in goals:
        Goal.objects.filter(id=goal.id).update(**settled(value))
    touched = set()
    for metric, value in metrics:
        value = settled(value)
        changed = any(getattr(metric, name) != value[name] for name in STAMP_FIELDS)
        Metric.objects.filter(id=metric.id).update(**value)
        for name, field_value in value.items():
            setattr(metric, name, field_value)
        if changed and move:
            resnap(metric)
        refresh_metric(metric.id, sync_value=changed)
        touched.add(metric.goal_id)
    for goal_id in touched:
        refresh_goal(goal_id)


def inheriting_metrics(goal) -> list:
    """Every metric whose frequency comes from `goal`: its inheriting metrics
    (and their inheriting sub-metrics), and those of its inheriting sub-goals,
    all the way down."""
    from goalnexa.models import Goal, Metric

    found, queue, seen = [], [goal.id], {goal.id}
    while queue:
        goal_id = queue.pop()
        rows = list(Metric.objects.filter(goal_id=goal_id).select_related("goal"))
        by_id = {m.id: m for m in rows}

        def follows(metric, depth=0) -> bool:
            if not metric.snap_to_goal or depth > len(rows):
                return False
            parent = by_id.get(metric.parent_id)
            return parent is None or follows(parent, depth + 1)

        found += [m for m in rows if follows(m)]
        for child in Goal.objects.filter(parent_id=goal_id, snap_to_parent=True, is_rollup=False).exclude(id__in=seen):
            seen.add(child.id)
            queue.append(child.id)
    return found


def replaced_by(check_in, zone: ZoneInfo | None = None):
    """The check-in this one replaced - the latest earlier one in its period -
    or None (no `counted_per`, none earlier, or this one is itself replaced)."""
    metric = check_in.metric
    per = counted_per(metric)
    if not per or check_in.replaced:
        return None
    zone = zone or zone_for(metric.goal)
    period = bucket(check_in, per, zone, metric)
    earlier = [
        c for c in type(check_in).objects.filter(metric_id=metric.id).exclude(id=check_in.id)
        if bucket(c, per, zone, metric) == period and _order(c) <= _order(check_in)
    ]
    return max(earlier, key=_order) if earlier else None


def _q(value: float) -> Decimal:
    return Decimal(str(round(value, 2))).quantize(CENT)


def _now_key(metric, per: str, zone: ZoneInfo, today: date | None, now: datetime | None) -> tuple[date, date]:
    """(today, the key of the period of `per` running now): from `now` (default
    the clock), or - when only `today` is given - from that whole day."""
    if today is not None:
        return today, day_key(today, per, metric)
    now = now or timezone.now()
    return local_date(now, zone), period_key(now, per, metric, zone)


def compute(
    metric, goal, check_ins, *, today: date | None = None, zone: ZoneInfo | None = None, now: datetime | None = None
) -> dict:
    """The stored period fields of one metric, from its check-ins. Empty
    (all None) when the metric has no target per period or no quota. Periods
    run from one of the metric's moments to the next (P-93)."""
    empty = {"period_value": None, "cumulative_target": None, "expected_value": None, "hit_rate": None, "streak": None}
    if not metric.target_per:
        return empty
    per = metric.target_per
    zone = zone or zone_for(goal)
    today, current_key = _now_key(metric, per, zone, today, now)
    base = float(metric.base_value)
    quota = float(metric.target_value) - base
    if quota <= 0:
        return empty
    entries = [
        (local_date(c.checked_in_at, zone), period_key(c.checked_in_at, per, metric, zone), float(c.value))
        for c in check_ins
    ]
    first, last = goal_range(metric, goal, zone, min(e[0] for e in entries) if entries else None)
    horizon = last if last is not None else max(today, first)
    plan = periods(first, horizon, per, metric.count_days, metric)
    value_of = {p.start: 0.0 for p in plan}
    for day, key, value in entries:
        if first <= day <= horizon and key in value_of:
            value_of[key] += value
    current = next((p for p in plan if p.start == current_key), None)

    expected_weight = 0.0
    hits = considered = 0
    flags = []
    for p in plan:
        need = quota * p.weight
        hit = value_of[p.start] + 1e-9 >= need
        if p.start < current_key:
            expected_weight += p.weight
            considered += 1
            hits += hit
            flags.append(hit)
        elif p is current:
            begun = counted_days(p.first, min(today, p.last), metric.count_days)
            expected_weight += p.weight * min(1.0, begun / p.counted)
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
    elif plan and plan[-1].start < current_key:
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
    metric, goal, *, today: date | None = None, zone: ZoneInfo | None = None, first_check_in: date | None = None,
    now: datetime | None = None, key: date | None = None,
) -> tuple[Period | None, float]:
    """The current period (None outside the range or on an uncounted day) -
    or the one keyed `key` - and its quota. `first_check_in` stretches the
    range back, like `compute`."""
    per = metric.target_per
    zone = zone or zone_for(goal)
    today, current_key = _now_key(metric, per, zone, today, now)
    key = key or current_key
    own_first, own_last = period_days(key, per, metric)
    day = min(max(today, own_first), own_last) if key != current_key else today
    first, last = goal_range(metric, goal, zone, first_check_in)
    if day < first or (last is not None and day > last):
        return None, 0.0
    plan = periods(max(first, own_first), own_last if last is None else min(last, own_last), per, metric.count_days, metric)
    current = next((p for p in plan if p.start == key), None)
    if current is None:
        return None, 0.0
    quota = (float(metric.target_value) - float(metric.base_value)) * current.weight
    return current, quota


def shown_key(metric, per: str, at, zone: ZoneInfo) -> date:
    """The key of `metric`'s period of `per` running at `at` (a datetime), or
    whose days include `at` (a date)."""
    if isinstance(at, datetime):
        return period_key(at, per, metric, zone)
    return day_key(at, per, metric)


def shown(metric, goal, check_ins, per: str, at, *, zone: ZoneInfo | None = None, key: date | None = None) -> dict:
    """One metric in its own period of `per` running at `at` (or keyed `key`)
    - the team board's "Show by" (P-93: each metric's own period, from one of
    its moments to the next): `value` = the amount done in it (SUM; only
    check-ins that count, see `counted`) or its last reading (LATEST; None
    without a check-in in that period - an earlier reading isn't carried
    forward; SUM too: None = nothing checked in, not 0), `count` = the
    check-ins that count in it, `last_at` = the latest one's time, `opens`/
    `closes` = its moments, `first`/`last` = its days, and `quota` = its
    target when the metric's target is per that same period (prorated, like
    `current_quota`), else None."""
    from goalnexa.models import MetricAggregation

    zone = zone or zone_for(goal)
    start = key or shown_key(metric, per, at, zone)
    first_day, last_day = period_days(start, per, metric)
    opens, closes = period_bounds(start, per, metric, zone)
    kept, _ = counted(metric, check_ins, zone)
    inside = [c for c in kept if period_key(c.checked_in_at, per, metric, zone) == start]
    if not inside:
        value = None
    elif metric.aggregation == MetricAggregation.SUM:
        value = float(sum((c.value for c in inside), Decimal(0)))
    else:
        value = float(inside[-1].value)
    quota = None
    if metric.target_per == per and metric.target_value != metric.base_value:
        first = min((local_date(c.checked_in_at, zone) for c in check_ins), default=None)
        period, amount = current_quota(metric, goal, zone=zone, first_check_in=first, key=start)
        quota = round(amount, 2) if period is not None else None
    return {"start": start, "first": first_day, "last": last_day, "opens": opens.isoformat(), "closes": closes.isoformat(),
            "value": None if value is None else round(value, 2), "quota": quota,
            "count": len(inside), "last_at": max(c.checked_in_at for c in inside).isoformat() if inside else None}


def shown_series(metric, goal, check_ins, per: str, at, count: int, *, zone: ZoneInfo | None = None) -> list[dict]:
    """`shown` for the `count` periods of `metric`'s own `per` ending with the
    one running at `at`, oldest first - the team board's "Over time" columns."""
    zone = zone or zone_for(goal)
    keys = [shown_key(metric, per, at, zone)]
    while len(keys) < count:
        keys.append(prev_start(keys[-1], per))
    return [shown(metric, goal, check_ins, per, at, zone=zone, key=key) for key in reversed(keys)]


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
    if metric.target_per:
        current, quota = current_quota(metric, goal, today=today, zone=zone)
        if current is None:
            return {"per": metric.target_per, "in_period": False}
        done = float(metric.period_value or 0)
        _opens, closes = period_bounds(current.start, metric.target_per, metric, zone)
        return {
            "per": metric.target_per,
            "in_period": True,
            "period_label": PERIOD_NOUNS[metric.target_per][0],
            "done": round(done, 2),
            "quota": round(quota, 2),
            "left": round(max(0.0, quota - done), 2),
            "closes": closes.isoformat(),
        }
    today = today or local_date(timezone.now(), zone)
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
