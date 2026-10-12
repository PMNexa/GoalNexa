"""Team totals (docs/team-templates.md "Rollup"). For a template and a
cycle, every team with sub-teams and an instance somewhere under it - and
the org itself (`team_id` null) - gets a read-only rollup goal tree
mirroring the template. A team without sub-teams gets none: its total
would only repeat its own instance. A node's numbers come from EVERY instance in its subtree
(its own included), never from the rollups below it: an average of
averages would weigh a 2-team department like a 10-team one.

Per template metric (`TemplateMetric.rollup`), over the instances that
have committed a target (target != base - a team without one yet doesn't
drag the total; with none committed, the total is tracked only):

- SUM: value = sum of values, base = sum of bases, target = sum of targets;
- AVG: the same, as means;
- MIN: the lowest instance progress, as a % of 0 -> 100;
- NONE: no rollup metric.

A rollup metric's `planned_target` (top-down, set on the team board)
replaces the target for SUM and AVG. Values are stored as synthetic
check-ins (`source="rollup"`, at most one per day - today's is updated)
whenever they change, so charts, projection,
health, snapshots and the digest work for totals unchanged.

`schedule` is called whenever an instance goal is refreshed
(`goalnexa.progress.refresh_goal`); inside `batched()` (bulk check-ins,
apply, push) each (template, cycle) is recomputed once, at the end.
"""

from __future__ import annotations

import threading
from contextlib import contextmanager
from decimal import ROUND_HALF_UP, Decimal

from django.utils import timezone

from goalnexa.models import CheckIn, CheckInSource, Cycle, Goal, GoalStatus, GoalTemplate, Metric, ProgressBy, RollupRule
from goalnexa.progress import metric_pct, refresh_goal, refresh_metric
from goalnexa.teams import ancestors, subtree, team_names, team_parents

_state = threading.local()
CENT = Decimal("0.01")


@contextmanager
def batched():
    """Defers recomputes until the outermost block ends."""
    depth = getattr(_state, "depth", 0)
    if depth == 0:
        _state.pending = set()
    _state.depth = depth + 1
    try:
        yield
    finally:
        _state.depth -= 1
        if _state.depth == 0:
            pending, _state.pending = _state.pending, set()
            for template_id, cycle_id in pending:
                recompute(template_id, cycle_id)


def schedule(template_id, cycle_id) -> None:
    if getattr(_state, "depth", 0):
        _state.pending.add((template_id, cycle_id))
    else:
        recompute(template_id, cycle_id)


def on_goal_refreshed(goal: Goal) -> None:
    if goal.template_goal_id and not goal.is_rollup:
        template_id = goal.template_goal.template_id
        schedule(template_id, goal.cycle_id)


def recompute_org(org_id) -> None:
    """Every total of an org - after its team tree changed."""
    keys = (
        Goal.objects.filter(org_id=org_id, template_goal__isnull=False)
        .values_list("template_goal__template_id", "cycle_id")
        .distinct()
    )
    with batched():
        for template_id, cycle_id in keys:
            schedule(template_id, cycle_id)


def _q(value) -> Decimal:
    return Decimal(str(value)).quantize(CENT, rounding=ROUND_HALF_UP)


def combine(rule: str, rows: list, planned=None, pcts: list | None = None) -> tuple[Decimal, Decimal, Decimal]:
    """(base, target, value) of a rollup metric from instance `rows` -
    each `(base, target, value)`. MIN takes the instances' own progress in
    `pcts` when given (a target per period measures against its total)."""
    committed = [r for r in rows if r[0] != r[1]]
    if rule == RollupRule.MIN:
        if pcts is None:
            pcts = [metric_pct(v, _Span(b, t)) for b, t, v in committed]
        pcts = [p for p in pcts if p is not None]
        if not pcts:
            return Decimal(0), Decimal(0), Decimal(0)
        return Decimal(0), Decimal(100), _q(min(pcts))
    use = committed or rows
    if not use:
        return Decimal(0), Decimal(0), Decimal(0)
    if rule == RollupRule.AVG:
        n = len(use)
        base, target, value = (_q(sum(r[i] for r in use) / n) for i in range(3))
    else:
        base, target, value = (_q(sum(r[i] for r in use)) for i in range(3))
    if not committed:
        target = base  # tracked only until a team commits a target
    elif planned is not None:
        target = _q(planned)
    return base, target, value


PERIOD_FIELDS = ("period_value", "cumulative_target", "expected_value", "hit_rate", "streak")


def combine_period(rule: str, progress_by: str, metrics: list, planned=None) -> tuple[dict, Decimal]:
    """A total of target-per-period metrics: (its fields, its value). The
    teams' quotas, this period's amounts, total targets and expected-so-far
    add up (or average, `avg`); a hit rate is the teams' average or lowest;
    the streak, the shortest. Teams with no target yet are left out (with
    none, the total is tracked only). A planned target (sum/avg of a total)
    scales the teams' total targets to it."""
    committed = [m for m in metrics if m.target_value != m.base_value]
    use = committed or metrics
    fields: dict = {name: None for name in PERIOD_FIELDS}
    if not use:
        return {"base_value": Decimal(0), "target_value": Decimal(0), **fields}, Decimal(0)
    mean = rule == RollupRule.AVG

    def agg(name):
        values = [getattr(m, name) for m in use if getattr(m, name) is not None]
        if not values:
            return None
        total = sum(Decimal(v) for v in values)
        return _q(total / len(values) if mean else total)

    base, target, value = agg("base_value"), agg("target_value"), agg("current_value")
    for name in ("period_value", "cumulative_target", "expected_value"):
        fields[name] = agg(name)
    if not committed:
        target = base
    elif planned is not None and progress_by == ProgressBy.TOTAL and target != base:
        scale = (Decimal(planned) - base) / (target - base)
        for name in ("cumulative_target", "expected_value"):
            if fields[name] is not None:
                fields[name] = _q(base + (fields[name] - base) * scale)
        target = _q(planned)
    if progress_by == ProgressBy.HIT_RATE:
        rates = [m.hit_rate for m in committed if m.hit_rate is not None]
        if rates:
            fields["hit_rate"] = _q(min(rates) if rule == RollupRule.MIN else sum(rates) / len(rates))
        streaks = [m.streak for m in committed if m.streak is not None]
        fields["streak"] = min(streaks) if streaks else None
    return {"base_value": base, "target_value": target, **fields}, value


class _Span:
    def __init__(self, base, target):
        self.base_value = base
        self.target_value = target


def recompute(template_id, cycle_id) -> None:
    from goalnexa.templates import sync_tree, tree_goals

    template = GoalTemplate.objects.filter(id=template_id).first()
    if template is None:
        return
    cycle = Cycle.objects.filter(id=cycle_id).first() if cycle_id else None
    instances = list(
        Goal.objects.filter(template_goal__template_id=template_id, cycle_id=cycle_id, is_rollup=False).exclude(
            status=GoalStatus.ARCHIVED
        )
    )
    parents = team_parents(template.org_id)
    teams = {g.team_id for g in instances}
    has_children = set(parents.values())
    nodes: set = set()
    if instances:
        nodes.add(None)
        for team_id in teams:
            if team_id is not None and team_id in parents:
                if team_id in has_children:
                    nodes.add(team_id)
                nodes.update(ancestors(parents, team_id))
    rollups = Goal.objects.filter(template_goal__template_id=template_id, cycle_id=cycle_id, is_rollup=True)
    stale = rollups.exclude(team_id__in=[n for n in nodes if n is not None])
    if None in nodes:
        stale = stale.exclude(team_id__isnull=True)
    stale.delete()
    if not nodes:
        return
    metrics_by_tm: dict = {}
    for metric in Metric.objects.filter(goal__in=instances, template_metric__isnull=False).select_related("goal"):
        metrics_by_tm.setdefault(metric.template_metric_id, []).append((metric.goal.team_id, metric))
    names = team_names([n for n in nodes if n is not None])
    dates_by_tg: dict = {}
    for goal in instances:
        dates_by_tg.setdefault(goal.template_goal_id, []).append((goal.team_id, goal.target_date))
    for node in nodes:
        members = subtree(parents, node)
        if node is None:
            members = members | {None}
        label = names.get(str(node), "Team") if node is not None else "Organization"
        sync_tree(template, node, cycle, True, owner_id=template.owner_id, title_suffix=f" · {label} total")
        goals = list(tree_goals(template_id, node, cycle_id, True))
        for goal in goals:
            dates = [d for team, d in dates_by_tg.get(goal.template_goal_id, []) if team in members and d]
            target_date = max(dates) if dates else None
            if goal.target_date != target_date:
                Goal.objects.filter(id=goal.id).update(target_date=target_date)
        for metric in Metric.objects.filter(goal__in=goals, template_metric__isnull=False).select_related("template_metric"):
            tm = metric.template_metric
            mine = [m for team, m in metrics_by_tm.get(tm.id, []) if team in members]
            if metric.target_per:
                wanted, value = combine_period(tm.rollup, tm.progress_by, mine, metric.planned_target)
            else:
                rows = [(m.base_value, m.target_value, m.current_value) for m in mine]
                pcts = [metric_pct(m.current_value, m) for m in mine if m.target_value != m.base_value]
                base, target, value = combine(tm.rollup, rows, metric.planned_target, pcts)
                wanted = {"base_value": base, "target_value": target}
            changes = {name: v for name, v in wanted.items() if getattr(metric, name) != v}
            if changes:
                Metric.objects.filter(id=metric.id).update(**changes)
            latest = CheckIn.objects.filter(metric=metric).order_by("-checked_in_at", "-created_at").first()
            if latest is None or latest.value != value:
                # One reading per day: a total's trend (projection) runs over
                # days, not over the seconds between the teams' check-ins.
                now = timezone.now()
                if latest is not None and timezone.localdate(latest.checked_in_at) == timezone.localdate(now):
                    CheckIn.objects.filter(id=latest.id).update(value=value, checked_in_at=now)
                else:
                    CheckIn.objects.create(metric=metric, value=value, source=CheckInSource.ROLLUP, checked_in_at=now)
                refresh_metric(metric.id)
        for goal in goals:
            refresh_goal(goal.id)
