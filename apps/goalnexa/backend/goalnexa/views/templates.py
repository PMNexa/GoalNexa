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

from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.shortcuts import get_object_or_404
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
    Cycle,
    CycleStatus,
    Goal,
    GoalStatus,
    GoalTemplate,
    Metric,
    MetricAggregation,
    TemplateGoal,
    TemplateMetric,
)
from goalnexa.periods import pace_hint, zone_for
from goalnexa.progress import metric_pct, refresh_goal, refresh_metric
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
        description="Everything the team board shows for one cycle: the template's goals and metrics, the "
        "organization's team tree, each team's instance (its metrics' base, target and current values, and "
        "whether you may check in or set its targets) and the totals per team and for the organization "
        "(with planned targets, the teams' own sum and whether you may plan).",
        parameters=[OpenApiParameter("cycle", OpenApiTypes.STR, description="A cycle id; empty or none = goals in no cycle.")],
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
        for goal in goals:
            if goal.is_rollup:
                continue
            for metric in metrics_by_goal.get(goal.id, []):
                instance_numbers.setdefault(metric.template_metric_id, []).append(
                    (goal.team_id, (metric.base_value, metric.target_value, metric.current_value))
                )
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
            for metric in metrics_by_goal.get(goal.id, []):
                entry["metrics"][str(metric.template_metric_id)] = metric_row(metric)
        for key, entry in instances.items():
            if not entry.get("visible"):
                instances[key] = {"visible": False, "goals": {}, "metrics": {}}
        return Response({
            "template": {"id": str(template.id), "title": template.title, "org_id": str(template.org_id)},
            "cycle": str(cycle_id) if cycle_id else None,
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

