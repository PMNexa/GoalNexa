"""Goal templates (docs/team-templates.md) -

- `/api/v1/goal-templates`, `/api/v1/template-goals`,
  `/api/v1/template-metrics`: the template's shape. Every member of the
  org sees them; only its owners and admins change them, and every change
  is pushed to every team's instance (`goalnexa.templates.push_template`).
  Removing a goal or metric detaches the instance rows that have
  check-ins (they stay, as the team's own) and deletes the rest.
- `POST goal-templates/<id>/apply` `{"teams": [...], "cycle": <id>|null}`:
  an instance for each team (owners/admins).
- `GET goal-templates/<id>/board?cycle=<id>`: everything the team board
  shows - the template, the org's team tree, each team's instance numbers
  and the totals, with what the caller may change.
- `POST goal-templates/<id>/targets` `{"items": [{"metric", "base_value"?,
  "target_value"?, "planned_target"?}]}`: targets from the board, all or
  nothing - an instance's base/target (its team's lead, its owner, the
  org's owners/admins), a total's planned target (owners/admins; a lead
  for the teams below theirs).
"""

from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core_api.system import check_org_limit
from core_api.viewsets import BaseViewSet, visible_rows
from goalnexa.access import ORGS_ENDPOINT, visible_cycles, visible_goals
from goalnexa.activity import record
from goalnexa.models import (
    ActivityVerb,
    CheckIn,
    Cycle,
    CycleStatus,
    Goal,
    GoalStatus,
    GoalTemplate,
    Metric,
    MetricAggregation,
    RollupRule,
    TargetPer,
    TemplateGoal,
    TemplateMetric,
)
from goalnexa.periods import local_date, pace_hint, shown, shown_series, zone_for
from goalnexa.progress import metric_pct, refresh_goal, refresh_metric
from goalnexa.models.template import ORG_TOTAL, default_total_for
from goalnexa.rollups import batched, combine, schedule
from goalnexa.serializers import GoalTemplateSerializer, TemplateGoalSerializer, TemplateMetricSerializer
from goalnexa.teams import can_plan, can_set_targets, can_check_in, is_org_manager, team_names, team_parents
from goalnexa.templates import (
    has_check_ins,
    ordered,
    push_template,
    remove_template,
    remove_template_goal,
    remove_template_metric,
    apply_template,
    leave_template,
    recompute_totals,
)
from goalnexa.teams import subtree

MANAGERS_ONLY = "Only an owner or admin of the organization can change its goal templates."
MAX_TARGETS = 1000


def _visible_org_ids(request):
    orgs = visible_rows(ORGS_ENDPOINT, request)
    return None if orgs is None else orgs.values("id")


def visible_templates(request):
    queryset = GoalTemplate.objects.all()
    orgs = _visible_org_ids(request)
    return queryset.filter(org_id__in=orgs) if orgs is not None else queryset.filter(owner_id=request.user.id)


def _check_manager(request, org_id) -> None:
    if not is_org_manager(request, org_id):
        raise PermissionDenied(MANAGERS_ONLY)


def _decimal(value, field):
    if value is None:
        return None
    try:
        return Decimal(str(value)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        raise ValidationError({field: ["A number."]}) from None


def _num(value) -> float | None:
    return None if value is None else float(value)


def _combine_shown(rule: str, rows: list[dict]) -> dict | None:
    """A total's numbers in a shown period, from its teams': added up, the
    mean or the lowest (by the template metric's rule) - None when it isn't
    totalled or no team has a number yet."""
    values = [row["value"] for row in rows if row["value"] is not None]
    if rule == RollupRule.NONE or not rows or not values:
        return None
    if rule == RollupRule.SUM:
        value = sum(values)
    elif rule == RollupRule.AVG:
        value = sum(values) / len(values)
    else:
        value = min(values)
    quotas = [row["quota"] for row in rows]
    quota = None
    if quotas and all(q is not None for q in quotas):
        quota = sum(quotas) if rule == RollupRule.SUM else sum(quotas) / len(quotas) if rule == RollupRule.AVG else None
    return {"start": rows[0]["start"], "last": rows[0]["last"], "value": round(value, 2),
            "quota": None if quota is None else round(quota, 2)}


class GoalTemplateViewSet(BaseViewSet):
    queryset = GoalTemplate.objects.all()
    serializer_class = GoalTemplateSerializer
    search_fields = ["title"]
    permission_classes = [IsAuthenticated]
    scope_field = "org_id"

    def get_queryset(self):
        return super().get_queryset().filter(id__in=visible_templates(self.request).values("id")).order_by("title")

    def perform_create(self, serializer):
        org_id = serializer.validated_data.get("org_id")
        if not org_id:
            raise ValidationError({"org_id": ["This field is required."]})
        _check_manager(self.request, org_id)
        serializer.save(owner_id=self.request.user.id)

    def perform_update(self, serializer):
        template = serializer.instance
        _check_manager(self.request, template.org_id)
        if str(serializer.validated_data.get("org_id", template.org_id)) != str(template.org_id):
            raise ValidationError({"org_id": ["A template stays in its organization."]})
        serializer.save()

    def perform_destroy(self, instance):
        _check_manager(self.request, instance.org_id)
        with transaction.atomic():
            remove_template(instance)
            instance.delete()

    def _cycle(self, template, cycle_id, *, open_only=False):
        if not cycle_id or cycle_id == "none":
            return None
        cycle = get_object_or_404(Cycle.objects.filter(visible_cycles(self.request)), id=cycle_id)
        if str(cycle.org_id or "") != str(template.org_id):
            raise ValidationError({"cycle": ["That cycle belongs to another organization."]})
        if open_only and cycle.status == CycleStatus.CLOSED:
            raise ValidationError({"cycle": ["That cycle is closed."]})
        return cycle

    @extend_schema(
        description="Create an instance of this template for each team - its goals and metrics, with the "
        "template's default targets - in a cycle (or none). Teams that already have one in that cycle are "
        "skipped. Organization owners and admins only.",
        request=inline_serializer("ApplyTemplate", {
            "teams": serializers.ListField(child=serializers.UUIDField(), help_text="Team ids, in the template's organization."),
            "cycle": serializers.UUIDField(required=False, allow_null=True, help_text="The cycle, or null for none."),
        }),
        responses={201: inline_serializer("AppliedTemplate", {"goals": serializers.ListField(child=serializers.UUIDField())})},
    )
    @action(detail=True, methods=["post"])
    def apply(self, request, pk=None):
        template = self.get_object()
        _check_manager(request, template.org_id)
        team_ids = request.data.get("teams")
        if not isinstance(team_ids, list) or not team_ids:
            raise ValidationError({"teams": ["Pick at least one team."]})
        parents = team_parents(template.org_id)
        known = {str(t): t for t in parents}
        if any(str(t) not in known for t in team_ids):
            raise ValidationError({"teams": ["Only teams of the template's organization."]})
        if not TemplateGoal.objects.filter(template=template).exists():
            raise ValidationError({"teams": ["Add a goal to the template first."]})
        cycle = self._cycle(template, request.data.get("cycle"), open_only=True)
        per_tree = TemplateGoal.objects.filter(template=template).count()
        current = Goal.objects.filter(org_id=template.org_id, is_rollup=False).exclude(status=GoalStatus.ARCHIVED).count()
        check_org_limit(template.org_id, "max_goals", current + per_tree * len(team_ids) - 1, "goals")
        with transaction.atomic():
            roots = apply_template(template, [known[str(t)] for t in team_ids], cycle, request.user.id)
        for root in roots:
            record(root.id, ActivityVerb.GOAL_CREATED, request.user.id, title=root.title, template=template.title)
        return Response({"goals": [str(r.id) for r in roots]}, status=201)

    @extend_schema(
        description="Take teams out of the template in a cycle (organization owners and admins): a team's "
        "copy with check-ins is detached - kept as the team's own goals - and an empty one is deleted.",
        request=inline_serializer("LeaveTemplate", {
            "teams": serializers.ListField(child=serializers.UUIDField(), help_text="Team ids, in the template's organization."),
            "cycle": serializers.UUIDField(required=False, allow_null=True, help_text="The cycle, or null for none."),
        }),
        responses={200: inline_serializer("LeftTemplate", {
            "deleted": serializers.ListField(child=serializers.UUIDField()),
            "detached": serializers.ListField(child=serializers.UUIDField()),
        })},
    )
    @action(detail=True, methods=["post"])
    def leave(self, request, pk=None):
        template = self.get_object()
        _check_manager(request, template.org_id)
        team_ids = request.data.get("teams")
        if not isinstance(team_ids, list) or not team_ids:
            raise ValidationError({"teams": ["Pick at least one team."]})
        known = {str(t): t for t in team_parents(template.org_id)}
        if any(str(t) not in known for t in team_ids):
            raise ValidationError({"teams": ["Only teams of the template's organization."]})
        cycle = self._cycle(template, request.data.get("cycle"), open_only=True)
        with transaction.atomic():
            result = leave_template(template, [known[str(t)] for t in team_ids], cycle)
        return Response(result)

    @extend_schema(
        description="Which totals the template calculates (organization owners and admins): \"org\" for the "
        "whole organization and/or teams that have sub-teams. Replaces the list; every cycle's totals follow.",
        request=inline_serializer("TemplateTotals", {
            "total_for": serializers.ListField(child=serializers.CharField(), help_text='"org" and/or team ids.'),
        }),
        responses={200: inline_serializer("TemplateTotalsSet", {"total_for": serializers.ListField(child=serializers.CharField())})},
    )
    @action(detail=True, methods=["post"])
    def totals(self, request, pk=None):
        template = self.get_object()
        _check_manager(request, template.org_id)
        wanted = request.data.get("total_for")
        if not isinstance(wanted, list):
            raise ValidationError({"total_for": ["A list: \"org\" and/or team ids."]})
        parents = team_parents(template.org_id)
        with_children = {str(p) for p in parents.values() if p}
        picked = []
        for item in wanted:
            item = str(item)
            if item != ORG_TOTAL and item not in with_children:
                raise ValidationError({"total_for": ["Only \"org\" or a team of the organization that has sub-teams."]})
            if item not in picked:
                picked.append(item)
        with transaction.atomic():
            template.total_for = picked
            template.save(update_fields=["total_for", "updated_at"])
            recompute_totals(template)
        return Response({"total_for": picked})

    @extend_schema(
        description="Everything the team board shows for one cycle: the template's goals and metrics, the "
        "organization's team tree, each team's instance (its metrics' base, target and current values, and "
        "whether you may check in or set its targets) and the totals per team and for the organization "
        "(with planned targets, the teams' own sum and whether you may plan).",
        parameters=[
            OpenApiParameter("cycle", OpenApiTypes.STR, description="A cycle id; empty or none = goals in no cycle."),
            OpenApiParameter("show", OpenApiTypes.STR, enum=["day", "week", "month", "quarter", "year"],
                             description="Also give each cell that period's numbers (`shown`): the amount done in it, or "
                             "its last reading in it (none without one), and its target when the metric's target is per that period."),
            OpenApiParameter("periods", OpenApiTypes.INT,
                             description="With `show`: also each cell's numbers in that many periods ending with the one "
                             "around `at` (`history`, oldest first; 1-60)."),
            OpenApiParameter("at", OpenApiTypes.DATETIME, description="The day each team's `last_update` is for, "
                             "and with `show` the period around this time (each goal's time zone). Default: now."),
        ],
        responses={200: OpenApiTypes.OBJECT},
    )
    @action(detail=True, methods=["get"])
    def board(self, request, pk=None):
        template = self.get_object()
        cycle = self._cycle(template, request.query_params.get("cycle"))
        cycle_id = cycle.id if cycle else None
        tgs = ordered(TemplateGoal.objects.filter(template=template))
        tms = ordered(TemplateMetric.objects.filter(template_goal__template=template))
        parents = team_parents(template.org_id)
        names = team_names(parents.keys())
        goals = list(Goal.objects.filter(template_goal__template=template, cycle_id=cycle_id).select_related("cycle").prefetch_related("members"))
        visible = set(Goal.objects.filter(id__in=[g.id for g in goals]).filter(visible_goals(request)).values_list("id", flat=True))
        metrics = list(Metric.objects.filter(goal__in=goals, template_metric__isnull=False))
        goal_by_id = {g.id: g for g in goals}
        metrics_by_goal: dict = {}
        for metric in metrics:
            metrics_by_goal.setdefault(metric.goal_id, []).append(metric)

        zones: dict = {}
        # "Show by" a period: each cell's numbers in the period around `at`.
        show = request.query_params.get("show") or ""
        if show and show not in TargetPer.values:
            raise ValidationError({"show": ["day, week, month, quarter or year."]})
        at = parse_datetime(request.query_params.get("at") or "") if request.query_params.get("at") else None
        if request.query_params.get("at") and at is None:
            raise ValidationError({"at": ["An ISO 8601 date and time."]})
        at = at or timezone.now()
        try:
            history_count = int(request.query_params.get("periods") or 0)
        except ValueError:
            raise ValidationError({"periods": ["A whole number, 1-60."]}) from None
        if history_count and not (show and 1 <= history_count <= 60):
            raise ValidationError({"periods": ["A whole number, 1-60, with show."]})
        if timezone.is_naive(at):
            at = timezone.make_aware(at)
        check_ins_by_metric: dict = {}
        if show:
            instance_metric_ids = [m.id for m in metrics if not goal_by_id[m.goal_id].is_rollup]
            for check_in in CheckIn.objects.filter(metric_id__in=instance_metric_ids):
                check_ins_by_metric.setdefault(check_in.metric_id, []).append(check_in)

        # "Last update" per instance goal: its latest check-in on `at`'s day
        # (the goal's zone) - from check-ins within a day either side.
        instance_goal_ids = [g.id for g in goals if not g.is_rollup]
        last_on_day: dict = {}
        nearby = CheckIn.objects.filter(
            metric__goal_id__in=instance_goal_ids,
            checked_in_at__gte=at - timedelta(days=1, hours=14),
            checked_in_at__lte=at + timedelta(days=1, hours=14),
        ).values_list("metric__goal_id", "checked_in_at")
        for goal_id, when in nearby:
            zone = zone_for(goal_by_id[goal_id], zones)
            if local_date(when, zone) == local_date(at, zone) and (goal_id not in last_on_day or when > last_on_day[goal_id]):
                last_on_day[goal_id] = when

        def shown_row(metric) -> dict:
            goal = goal_by_id[metric.goal_id]
            zone = zone_for(goal, zones)
            check_ins = check_ins_by_metric.get(metric.id, [])
            numbers = shown(metric, goal, check_ins, show, local_date(at, zone), zone=zone)
            row = {**numbers, "start": numbers["start"].isoformat(), "last": numbers["last"].isoformat()}
            if history_count:
                row["history"] = [
                    {**n, "start": n["start"].isoformat(), "last": n["last"].isoformat()}
                    for n in shown_series(metric, goal, check_ins, show, local_date(at, zone), history_count, zone=zone)
                ]
            return row

        def metric_row(metric, rollup=False):
            goal = goal_by_id[metric.goal_id]
            row = {
                "id": str(metric.id),
                "base_value": _num(metric.base_value),
                "target_value": _num(metric.target_value),
                "current_value": _num(metric.current_value),
                "progress": metric_pct(metric.current_value, metric),
                "check_in_due_at": metric.check_in_due_at,
                "last_checked_in_at": metric.last_checked_in_at,
                "target_per": metric.target_per,
                "one_per": metric.one_per,
                "period_value": _num(metric.period_value),
                "cumulative_target": _num(metric.cumulative_target),
                "expected_value": _num(metric.expected_value),
                "hit_rate": _num(metric.hit_rate),
                "streak": metric.streak,
                "pace": pace_hint(metric, goal, zone=zone_for(goal, zones)),
            }
            if rollup:
                row["planned_target"] = _num(metric.planned_target)
            return row

        instances: dict = {}
        totals: dict = {}
        instance_numbers: dict = {}
        shown_by_metric: dict = {}
        shown_numbers: dict = {}
        for goal in goals:
            if goal.is_rollup:
                continue
            for metric in metrics_by_goal.get(goal.id, []):
                instance_numbers.setdefault(metric.template_metric_id, []).append(
                    (goal.team_id, (metric.base_value, metric.target_value, metric.current_value))
                )
                if show:
                    shown_by_metric[metric.id] = shown_row(metric)
                    shown_numbers.setdefault(metric.template_metric_id, []).append((goal.team_id, shown_by_metric[metric.id]))
        root_tgs = {tg.id for tg in tgs if tg.parent_id is None}
        for goal in goals:
            key = str(goal.team_id) if goal.team_id else "org"
            if goal.is_rollup:
                entry = totals.setdefault(key, {"goals": {}, "metrics": {}, "can_plan": None})
                if entry["can_plan"] is None:
                    entry["can_plan"] = can_plan(request, goal)
                entry["goals"][str(goal.template_goal_id)] = str(goal.id)
                members = subtree(parents, goal.team_id) | ({None} if goal.team_id is None else set())
                for metric in metrics_by_goal.get(goal.id, []):
                    row = metric_row(metric, rollup=True)
                    numbers = [r for team, r in instance_numbers.get(metric.template_metric_id, []) if team in members]
                    tm = next((t for t in tms if t.id == metric.template_metric_id), None)
                    if tm is not None:
                        _, teams_target, _ = combine(tm.rollup, numbers)
                        row["teams_target"] = _num(teams_target)
                    if show and tm is not None:
                        team_rows = [n for team, n in shown_numbers.get(metric.template_metric_id, []) if team in members]
                        row["shown"] = _combine_shown(tm.rollup, team_rows)
                        if history_count and team_rows:
                            row["history"] = [
                                _combine_shown(tm.rollup, [n["history"][i] for n in team_rows])
                                for i in range(history_count)
                            ]
                    entry["metrics"][str(metric.template_metric_id)] = row
                continue
            entry = instances.setdefault(key, {"goals": {}, "metrics": {}, "visible": False})
            entry["goals"][str(goal.template_goal_id)] = str(goal.id)
            if goal.template_goal_id in root_tgs:
                entry["root"] = str(goal.id)
                entry["visible"] = goal.id in visible
                entry["visibility"] = goal.visibility
                entry["status"] = goal.status
                entry["can_check_in"] = can_check_in(request, goal)
                entry["can_set_targets"] = can_set_targets(request, goal)
            last_ever = max((m.last_checked_in_at for m in metrics_by_goal.get(goal.id, []) if m.last_checked_in_at), default=None)
            entry.setdefault("last_update", {})[str(goal.template_goal_id)] = {
                "on_day": last_on_day.get(goal.id), "last": last_ever,
            }
            for metric in metrics_by_goal.get(goal.id, []):
                entry["metrics"][str(metric.template_metric_id)] = metric_row(metric)
                if show:
                    numbers = dict(shown_by_metric[metric.id])
                    history = numbers.pop("history", None)
                    entry["metrics"][str(metric.template_metric_id)]["shown"] = numbers
                    if history is not None:
                        entry["metrics"][str(metric.template_metric_id)]["history"] = history
        # A total's "Last update": how many of its teams' copies were updated that day.
        updated_by_tg: dict = {}
        for goal in goals:
            if not goal.is_rollup:
                updated_by_tg.setdefault(goal.template_goal_id, []).append((goal.team_id, goal.id in last_on_day))
        for key, entry in totals.items():
            members = subtree(parents, None if key == "org" else next((t for t in parents if str(t) == key), None))
            if key == "org":
                members = set(parents) | {None}
            entry["updated"] = {
                str(tg_id): {"teams": sum(1 for team, _ in rows if team in members),
                             "updated": sum(1 for team, done in rows if team in members and done)}
                for tg_id, rows in updated_by_tg.items()
            }
        for key, entry in instances.items():
            if not entry.get("visible"):
                instances[key] = {"visible": False, "goals": {}, "metrics": {}}
        return Response({
            "template": {"id": str(template.id), "title": template.title, "org_id": str(template.org_id)},
            "total_for": template.total_for if template.total_for is not None else default_total_for(),
            "cycle": str(cycle_id) if cycle_id else None,
            "show": show,
            "can_manage": is_org_manager(request, template.org_id),
            "goals": [
                {"id": str(tg.id), "parent": str(tg.parent_id) if tg.parent_id else None, "title": tg.title}
                for tg in tgs
            ],
            "metrics": [
                {
                    "id": str(tm.id),
                    "template_goal": str(tm.template_goal_id),
                    "parent": str(tm.parent_id) if tm.parent_id else None,
                    "name": tm.name,
                    "unit": tm.unit,
                    "aggregation": tm.aggregation,
                    "rollup": tm.rollup,
                    "default_target": _num(tm.default_target),
                    "target_per": tm.target_per,
                    "count_days": tm.count_days,
                    "progress_by": tm.progress_by,
                    "one_per": tm.one_per,
                    "snap_to": tm.snap_to,
                }
                for tm in tms
            ],
            "teams": [
                {"id": str(t), "parent": str(p) if p else None, "name": names.get(str(t), "")}
                for t, p in parents.items()
            ],
            "instances": instances,
            "totals": totals,
        })

    @extend_schema(
        description="Set targets from the team board, all or nothing: an instance metric's base_value and/or "
        "target_value (its team's lead, the goal's owner, the organization's owners and admins), or a team "
        "total's planned_target (null clears it; owners and admins, or a lead for the teams below theirs).",
        request=inline_serializer("TemplateTargets", {
            "items": serializers.ListField(child=inline_serializer("TemplateTarget", {
                "metric": serializers.UUIDField(),
                "base_value": serializers.DecimalField(max_digits=14, decimal_places=2, required=False),
                "target_value": serializers.DecimalField(max_digits=14, decimal_places=2, required=False),
                "planned_target": serializers.DecimalField(max_digits=14, decimal_places=2, required=False, allow_null=True),
            })),
        }),
        responses={204: None},
    )
    @action(detail=True, methods=["post"])
    def targets(self, request, pk=None):
        template = self.get_object()
        items = request.data.get("items")
        if not isinstance(items, list) or not items or len(items) > MAX_TARGETS:
            raise ValidationError({"items": [f"A list of 1 to {MAX_TARGETS} changes."]})
        ids = [str(item.get("metric") or "") if isinstance(item, dict) else "" for item in items]
        metrics = {
            str(m.id): m
            for m in Metric.objects.filter(
                id__in=[i for i in ids if i], template_metric__template_goal__template=template
            ).filter(visible_goals(request, "goal__")).select_related("goal")
        }
        if any(i not in metrics for i in ids):
            raise ValidationError({"items": ["Unknown metric - only metrics of this template's teams and totals."]})
        with transaction.atomic(), batched():
            for item in items:
                metric = metrics[str(item["metric"])]
                goal = metric.goal
                if goal.is_rollup:
                    if set(item) - {"metric", "planned_target"}:
                        raise ValidationError({"items": ["A total's base and target are its teams' - set planned_target."]})
                    if not can_plan(request, goal):
                        raise PermissionDenied("Only the organization's owners and admins, or the lead of a team above it, can plan this total.")
                    Metric.objects.filter(id=metric.id).update(planned_target=_decimal(item.get("planned_target"), "planned_target"))
                    schedule(template.id, goal.cycle_id)
                    continue
                if "planned_target" in item:
                    raise ValidationError({"items": ["Only a team total has a planned target."]})
                if not can_set_targets(request, goal):
                    raise PermissionDenied("Only the team's lead, the goal's owner or the organization's owners and admins can set its targets.")
                changes = {}
                for name in ("base_value", "target_value"):
                    if name in item:
                        value = _decimal(item[name], name)
                        if value is None:
                            raise ValidationError({name: ["A number."]})
                        changes[name] = value
                if not changes:
                    continue
                before = {name: str(getattr(metric, name)) for name in changes}
                Metric.objects.filter(id=metric.id).update(**changes)
                refresh_metric(metric.id, sync_value=metric.aggregation == MetricAggregation.SUM and "base_value" in changes)
                refresh_goal(goal.id)
                record(goal.id, ActivityVerb.METRIC_CHANGED, request.user.id, metric=metric.id, metric_name=metric.name,
                       changes={name: [before[name], str(value)] for name, value in changes.items()})
        return Response(status=204)


class _TemplatePartViewSet(BaseViewSet):
    """Shared by template goals and metrics: visible with their template,
    changed by its org's owners/admins, every change pushed."""

    permission_classes = [IsAuthenticated]
    template_path = ""

    def get_queryset(self):
        queryset = super().get_queryset().order_by("position", "created_at")
        orgs = _visible_org_ids(self.request)
        if orgs is None:
            return queryset.filter(**{f"{self.template_path}owner_id": self.request.user.id})
        return queryset.filter(**{f"{self.template_path}org_id__in": orgs})

    def _push(self, template):
        with transaction.atomic():
            push_template(template)


class TemplateGoalViewSet(_TemplatePartViewSet):
    queryset = TemplateGoal.objects.all()
    serializer_class = TemplateGoalSerializer
    search_fields = ["title"]
    scope_field = "template__org_id"
    template_path = "template__"

    def _resolve(self, instance=None):
        data = self.request.data
        if "template" in data or instance is None:
            template_id = data.get("template")
            if not template_id:
                raise ValidationError({"template": ["This field is required."]})
            template = get_object_or_404(visible_templates(self.request), id=template_id)
            if instance is not None and template.id != instance.template_id:
                raise ValidationError({"template": ["A goal stays in its template."]})
        else:
            template = instance.template
        _check_manager(self.request, template.org_id)
        parent = instance.parent if instance is not None and "parent" not in data else None
        if data.get("parent"):
            parent = get_object_or_404(TemplateGoal.objects.filter(template=template), id=data["parent"])
            if instance is not None:
                node = parent
                while node is not None:
                    if node.id == instance.id:
                        raise ValidationError({"parent": ["A goal can't be under itself."]})
                    node = node.parent
        return template, parent

    def perform_create(self, serializer):
        template, parent = self._resolve()
        if "position" not in self.request.data:
            siblings = TemplateGoal.objects.filter(template=template, parent=parent)
            serializer.validated_data["position"] = (max((s.position for s in siblings), default=-1) + 1)
        serializer.save(template=template, parent=parent)
        self._push(template)

    def perform_update(self, serializer):
        template, parent = self._resolve(serializer.instance)
        serializer.save(template=template, parent=parent)
        self._push(template)

    def perform_destroy(self, instance):
        _check_manager(self.request, instance.template.org_id)
        template = instance.template
        with transaction.atomic():
            remove_template_goal(instance)
            instance.delete()
            push_template(template)


class TemplateMetricViewSet(_TemplatePartViewSet):
    queryset = TemplateMetric.objects.all()
    serializer_class = TemplateMetricSerializer
    search_fields = ["name"]
    scope_field = "template_goal__template__org_id"
    template_path = "template_goal__template__"

    def _resolve(self, instance=None):
        data = self.request.data
        if "template_goal" in data or instance is None:
            tg_id = data.get("template_goal")
            if not tg_id:
                raise ValidationError({"template_goal": ["This field is required."]})
            tg = get_object_or_404(TemplateGoal.objects.filter(template__in=visible_templates(self.request)), id=tg_id)
            if instance is not None and tg.template_id != instance.template_goal.template_id:
                raise ValidationError({"template_goal": ["A metric stays in its template."]})
        else:
            tg = instance.template_goal
        _check_manager(self.request, tg.template.org_id)
        parent = instance.parent if instance is not None and "parent" not in data else None
        if data.get("parent"):
            parent = get_object_or_404(TemplateMetric.objects.filter(template_goal__template=tg.template), id=data["parent"])
            if instance is not None:
                node = parent
                while node is not None:
                    if node.id == instance.id:
                        raise ValidationError({"parent": ["A metric can't be under itself."]})
                    node = node.parent
        return tg, parent

    def perform_create(self, serializer):
        tg, parent = self._resolve()
        if "position" not in self.request.data:
            siblings = TemplateMetric.objects.filter(template_goal=tg, parent=parent)
            serializer.validated_data["position"] = (max((s.position for s in siblings), default=-1) + 1)
        serializer.save(template_goal=tg, parent=parent)
        self._push(tg.template)

    def perform_update(self, serializer):
        instance = serializer.instance
        tg, parent = self._resolve(instance)
        aggregation = serializer.validated_data.get("aggregation", instance.aggregation)
        if aggregation != instance.aggregation and has_check_ins(
            Metric.objects.filter(template_metric=instance, goal__is_rollup=False).values_list("id", flat=True)
        ):
            raise ValidationError({"aggregation": ["Teams have checked in - changing this would change what their check-ins mean."]})
        serializer.save(template_goal=tg, parent=parent)
        self._push(tg.template)

    def perform_destroy(self, instance):
        _check_manager(self.request, instance.template_goal.template.org_id)
        template = instance.template_goal.template
        with transaction.atomic():
            remove_template_metric(instance)
            instance.delete()
            push_template(template)

