"""Goal templates (docs/team-templates.md): one goal system several teams
of an org run. The template owns the SHAPE - goals, sub-goals, metrics
(name, unit, how check-ins add up, schedule) - and each team's instance
owns its NUMBERS (base, target, check-ins).

An instance is an ordinary goal tree: one `Goal` per template goal
(`Goal.template_goal`, `team_id`, `cycle`) and one `Metric` per template
metric (`Metric.template_metric`). A tree is identified by (template,
team, cycle, is_rollup) - a team has at most one instance of a template
per cycle; rollup trees (`goalnexa.rollups`) use the same code.

- `apply_template` creates the instances for some teams.
- `push_template` brings every tree back in line after the template
  changed (called by the template views after every write): new goals and
  metrics appear, renamed ones follow, moved ones move.
- `remove_template_goal` / `remove_template_metric`: an instance row with
  check-ins is DETACHED (becomes the team's own, history kept); an empty
  one is deleted; rollup rows are always deleted.
- `roll_over_instance` (closing a cycle): the team's instance in the next
  cycle, every target blank (= base) so the team commits again.
"""

from __future__ import annotations

from decimal import Decimal

from django.db.models import Q

from goalnexa.models import (
    CheckIn,
    CycleStatus,
    Goal,
    GoalStatus,
    GoalTemplate,
    GoalVisibility,
    Metric,
    MetricAggregation,
    ProgressBy,
    RollupRule,
    TemplateGoal,
    TemplateMetric,
)
from goalnexa.ordering import next_position
from goalnexa.progress import refresh_goal, refresh_metric

#: Template-owned fields an instance can't change (`GoalViewSet`/`MetricViewSet`).
LOCKED_GOAL_FIELDS = ("title", "description", "parent", "org_id", "team_id", "cycle", "snap_to")
LOCKED_METRIC_FIELDS = (
    "name", "description", "unit", "aggregation", "check_in_every", "parent", "goal", "target_per", "count_days", "progress_by", "one_per", "snap_to",
)


def ordered(rows) -> list:
    """Parents before children (then `position`), for rows with `parent_id`."""
    rows = sorted(rows, key=lambda r: (r.position, str(r.id)))
    by_id = {r.id: r for r in rows}
    out, seen = [], set()

    def visit(row, trail=()):
        if row.id in seen or row.id in trail:
            return
        if row.parent_id in by_id:
            visit(by_id[row.parent_id], (*trail, row.id))
        if row.id not in seen:
            seen.add(row.id)
            out.append(row)

    for row in rows:
        visit(row)
    return out


def tree_goals(template_id, team_id, cycle_id, is_rollup: bool):
    return Goal.objects.filter(
        template_goal__template_id=template_id, team_id=team_id, cycle_id=cycle_id, is_rollup=is_rollup
    )


def tree_keys(template_id) -> set:
    return set(
        Goal.objects.filter(template_goal__template_id=template_id)
        .values_list("team_id", "cycle_id", "is_rollup")
        .distinct()
    )


def _status_for(cycle) -> str:
    if cycle is not None and cycle.status != CycleStatus.ACTIVE:
        return GoalStatus.NOT_STARTED
    return GoalStatus.IN_PROGRESS


def _rollup_unit(tm: TemplateMetric) -> str:
    return "%" if tm.rollup == RollupRule.MIN and tm.progress_by == ProgressBy.TOTAL else tm.unit


def sync_tree(
    template: GoalTemplate,
    team_id,
    cycle,
    is_rollup: bool,
    *,
    owner_id=None,
    visibility: str | None = None,
    values: dict | None = None,
    title_suffix: str = "",
) -> dict:
    """Creates or updates one tree to match `template`; returns
    `{template_goal_id: Goal}`. New rows take `owner_id`/`visibility`
    (else the tree root's), and metric numbers from `values`
    (`{template_metric_id: (base, target)}`), else the template's
    defaults (a blank target = the base: tracked only). `title_suffix`
    follows every title (a total's " · North total")."""
    cycle_id = cycle.id if cycle is not None else None
    existing = {g.template_goal_id: g for g in tree_goals(template.id, team_id, cycle_id, is_rollup)}
    tgs = ordered(TemplateGoal.objects.filter(template=template))
    root = next((existing[tg.id] for tg in tgs if tg.parent_id is None and tg.id in existing), None)
    owner_id = owner_id or (root.owner_id if root else template.owner_id)
    visibility = visibility or (root.visibility if root else GoalVisibility.PUBLIC)
    target_date = root.target_date if root else (cycle.ends_on if cycle is not None else None)
    goal_by_tg: dict = {}
    created = []
    for tg in tgs:
        parent = goal_by_tg.get(tg.parent_id) if tg.parent_id else None
        goal = existing.get(tg.id)
        if goal is None:
            goal = Goal.objects.create(
                template_goal=tg,
                team_id=team_id,
                cycle_id=cycle_id,
                is_rollup=is_rollup,
                org_id=template.org_id,
                owner_id=owner_id,
                visibility=GoalVisibility.PUBLIC if is_rollup else visibility,
                target_date=target_date,
                status=_status_for(cycle),
                title=tg.title + title_suffix,
                description=tg.description,
                parent=parent,
                position=tg.position,
            )
            if parent is None:
                goal.position = next_position(goal)
                goal.save(update_fields=["position"])
            created.append(goal)
        else:
            changes = {}
            for name, value in (("title", tg.title + title_suffix), ("description", tg.description)):
                if getattr(goal, name) != value:
                    changes[name] = value
            if goal.parent_id != (parent.id if parent else None):
                changes["parent"] = parent
            if parent is not None and goal.position != tg.position:
                changes["position"] = tg.position
            if changes:
                for name, value in changes.items():
                    setattr(goal, name, value)
                Goal.objects.filter(id=goal.id).update(**changes)
        goal_by_tg[tg.id] = goal
    _sync_metrics(template, goal_by_tg, is_rollup, values or {})
    for goal in goal_by_tg.values():
        refresh_goal(goal.id)
    return goal_by_tg


def _sync_metrics(template, goal_by_tg: dict, is_rollup: bool, values: dict) -> None:
    tms = ordered(TemplateMetric.objects.filter(template_goal__template=template))
    if is_rollup:
        tms = [tm for tm in tms if tm.rollup != RollupRule.NONE]
    goal_ids = [g.id for g in goal_by_tg.values()]
    existing = {m.template_metric_id: m for m in Metric.objects.filter(goal_id__in=goal_ids, template_metric__isnull=False)}
    wanted = {tm.id for tm in tms}
    if is_rollup:
        # A metric whose template metric stopped rolling up.
        Metric.objects.filter(goal_id__in=goal_ids, template_metric__isnull=False).exclude(template_metric_id__in=wanted).delete()
    metric_by_tm: dict = {}
    for tm in tms:
        goal = goal_by_tg.get(tm.template_goal_id)
        if goal is None:
            continue
        parent = metric_by_tm.get(tm.parent_id) if tm.parent_id else None
        locked = {
            "goal": goal,
            "name": tm.name,
            "description": tm.description,
            "unit": _rollup_unit(tm) if is_rollup else tm.unit,
            "aggregation": MetricAggregation.LATEST if is_rollup else tm.aggregation,
            "check_in_every": "" if is_rollup else tm.check_in_every,
            "parent": parent,
            "position": tm.position,
            # A total of "the team furthest behind" over a total-per-period is a plain %.
            "target_per": "" if is_rollup and tm.rollup == RollupRule.MIN and tm.progress_by == ProgressBy.TOTAL else tm.target_per,
            "count_days": tm.count_days,
            "progress_by": tm.progress_by,
            "one_per": "" if is_rollup else tm.one_per,  # a total has one reading a day already
            "snap_to": "" if is_rollup else tm.snap_to,
            "snap_to_goal": False,  # the template's, not its goal's
        }
        metric = existing.get(tm.id)
        if metric is None:
            if is_rollup:
                base = target = Decimal(0)
            else:
                base, target = values.get(tm.id, (tm.default_base, tm.default_target))
                target = base if target is None else target
            metric = Metric.objects.create(
                template_metric=tm, base_value=base, target_value=target, current_value=base, **locked
            )
            refresh_metric(metric.id)
        else:
            changes = {}
            for name, value in locked.items():
                current = getattr(metric, name)
                if name in ("goal", "parent"):
                    if getattr(metric, f"{name}_id") != (value.id if value else None):
                        changes[name] = value
                elif current != value:
                    changes[name] = value
            if changes:
                Metric.objects.filter(id=metric.id).update(**changes)
                for name, value in changes.items():
                    setattr(metric, name, value)
                if "snap_to" in changes:
                    from goalnexa.periods import resnap

                    resnap(metric)
                if changes.keys() & {"check_in_every", "aggregation", "target_per", "count_days", "progress_by", "one_per", "snap_to"}:
                    refresh_metric(metric.id, sync_value=bool(changes.keys() & {"aggregation", "one_per", "snap_to"}))
        metric_by_tm[tm.id] = metric


def push_template(template: GoalTemplate) -> None:
    """Every instance and rollup tree of `template`, brought in line with it."""
    from goalnexa.models import Cycle
    from goalnexa.rollups import batched, schedule

    with batched():
        cycles = {c.id: c for c in Cycle.objects.filter(id__in={k[1] for k in tree_keys(template.id) if k[1]})}
        for team_id, cycle_id, is_rollup in tree_keys(template.id):
            if is_rollup:
                continue  # the recompute below rebuilds rollups
            sync_tree(template, team_id, cycles.get(cycle_id), False)
        for cycle_id in {k[1] for k in tree_keys(template.id)}:
            schedule(template.id, cycle_id)


def has_check_ins(metric_ids) -> bool:
    return CheckIn.objects.filter(metric_id__in=list(metric_ids)).exclude(source="rollup").exists()


def _descendants(model, root) -> list:
    found, frontier = [root], [root.id]
    while frontier:
        children = list(model.objects.filter(parent_id__in=frontier))
        found.extend(children)
        frontier = [c.id for c in children]
    return found


def remove_template_metric(tm: TemplateMetric) -> None:
    """Before deleting `tm` (and its sub-metrics): instance metrics with
    check-ins are detached, empty ones and rollup ones deleted."""
    tms = _descendants(TemplateMetric, tm)
    goals = set()
    for metric in Metric.objects.filter(template_metric__in=tms).select_related("goal"):
        goals.add(metric.goal_id)
        if not metric.goal.is_rollup and has_check_ins([metric.id]):
            Metric.objects.filter(id=metric.id).update(template_metric=None)
        else:
            metric.delete()
    for goal_id in goals:
        refresh_goal(goal_id)


def remove_template_goal(tg: TemplateGoal) -> None:
    """Before deleting `tg` (and its sub-goals): an instance goal whose
    metrics have check-ins is detached with them; an empty one, and every
    rollup one, is deleted."""
    tgs = _descendants(TemplateGoal, tg)
    for goal in Goal.objects.filter(template_goal__in=tgs):
        metric_ids = list(goal.metrics.values_list("id", flat=True))
        if not goal.is_rollup and has_check_ins(metric_ids):
            Goal.objects.filter(id=goal.id).update(template_goal=None)
            Metric.objects.filter(goal=goal).update(template_metric=None)
        else:
            Goal.objects.filter(parent=goal).update(parent=goal.parent)
            goal.delete()


def remove_template(template: GoalTemplate) -> None:
    """Before deleting a template: its rollups go; every instance stays as
    the team's own goals (the links clear themselves - SET_NULL)."""
    Goal.objects.filter(template_goal__template=template, is_rollup=True).delete()


def lead_of(team_id):
    from goalnexa.teams import TEAM_MEMBERS_ENDPOINT
    from core_api.registry import endpoint_model

    model = endpoint_model(TEAM_MEMBERS_ENDPOINT)
    if model is None:
        return None
    return model.objects.filter(team_id=team_id, role="lead").order_by("created_at").values_list("user_id", flat=True).first()


def apply_template(template: GoalTemplate, team_ids, cycle, actor_id) -> list[Goal]:
    """One instance per team in `cycle` (skipping teams that have one);
    returns the new root goals. Each is owned by its team's first lead,
    else by `actor_id`."""
    from goalnexa.rollups import batched, schedule

    roots = []
    with batched():
        for team_id in team_ids:
            if tree_goals(template.id, team_id, cycle.id if cycle else None, False).exists():
                continue
            goal_by_tg = sync_tree(template, team_id, cycle, False, owner_id=lead_of(team_id) or actor_id)
            roots.extend(g for g in goal_by_tg.values() if g.parent_id is None)
        schedule(template.id, cycle.id if cycle else None)
    return roots


def roll_over_instance(goal: Goal, next_cycle) -> Goal | None:
    """`goal`'s counterpart in the team's instance in `next_cycle`, created
    if needed: same shape, a reading metric starting from where it ended, a
    sum metric from its old base, and every target blank (= base)."""
    tg = goal.template_goal
    if tg is None:
        return None
    template = tg.template
    old = tree_goals(template.id, goal.team_id, goal.cycle_id, False)
    values = {}
    for metric in Metric.objects.filter(goal__in=old, template_metric__isnull=False):
        base = metric.base_value if metric.aggregation == MetricAggregation.SUM else metric.current_value
        values[metric.template_metric_id] = (base, base)
    root = next((g for g in old if g.template_goal and g.template_goal.parent_id is None), goal)
    goal_by_tg = sync_tree(
        template, goal.team_id, next_cycle, False, owner_id=root.owner_id, visibility=root.visibility, values=values
    )
    for new in goal_by_tg.values():
        if new.parent_id is None:
            Goal.objects.filter(id=new.id).update(target_date=next_cycle.ends_on)
    return goal_by_tg.get(tg.id)


def instance_filter(template_id) -> Q:
    return Q(template_goal__template_id=template_id, is_rollup=False)
