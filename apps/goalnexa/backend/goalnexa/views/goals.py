"""/api/v1/goals - a real BaseViewSet (see core_api.viewsets), same
generic-CRUD shape as platform-org's OrganizationViewSet: the standard
ModelViewSet actions plus everything BaseViewSet wires in for free
(`?sort=`, `?q=`, `?filter{field}=value`), and (via GoalSerializer)
`?include[]=metrics`/`?include[]=sub_goals` to sideload a goal's metrics/
sub-goals instead of leaving those fields off.
"""

from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core_api.viewsets import BaseViewSet
from goalnexa.access import visible_cycles, visible_goals
from goalnexa.activity import changes, record, snapshot
from core_api.system import check_org_limit
from goalnexa.models import ActivityVerb, CheckIn, Cycle, CycleStatus, Goal, GoalStatus, Metric
from goalnexa.progress import metric_pct, metric_readings, refresh_goal, root_metrics
from goalnexa.serializers import GoalSerializer


#: The goal fields a change of which goes in its feed.
FEED_FIELDS = ["title", "status", "target_date", "visibility", "org_id", "cycle", "parent"]


class GoalViewSet(BaseViewSet):
    queryset = Goal.objects.all()
    serializer_class = GoalSerializer
    # `QParamSearchFilter` (DRF's own `SearchFilter` under the `?q=` name -
    # see core_api.filters) silently no-ops without this - see
    # OrganizationViewSet's own comment on the same line.
    search_fields = ["title"]
    # Explicit, not relying on the process's DEFAULT_PERMISSION_CLASSES -
    # see OrganizationViewSet's own comment on why.
    permission_classes = [IsAuthenticated]
    # Access scope (core_api/access.py): a goal belongs to its org - a
    # role held within that org applies to it; a personal goal (no org)
    # needs an app-wide role.
    scope_field = "org_id"

    def get_queryset(self):
        # Own goals plus the org goals the caller may see (access.py).
        return super().get_queryset().filter(visible_goals(self.request)).order_by("-created_at")

    def _resolve_parent(self, exclude_id=None):
        """`parent` is optional (unlike `MetricViewSet._resolve_goal`,
        which is required) - most goals are top-level. No cycle check
        beyond "not itself" (`exclude_id` is the goal being updated, on a
        reassign) - a longer cycle (A's parent is B, B's parent becomes
        A's grandchild C, ...) isn't caught; low-risk enough for now given
        `sub_goals` sideloading and any future tree view would just loop,
        not corrupt data, but worth hardening if a real tree UI gets
        built on top of this.
        """
        parent_id = self.request.data.get("parent")
        if not parent_id:
            return None
        if exclude_id is not None and str(parent_id) == str(exclude_id):
            raise ValidationError({"parent": ["A goal can't be its own parent."]})
        return get_object_or_404(Goal.objects.filter(visible_goals(self.request)), id=parent_id)

    def _resolve_cycle(self, org_id):
        """`cycle` (optional, presence-based like `parent`): one the caller
        can see, in the goal's own org (or personal for a personal goal),
        and not closed."""
        cycle_id = self.request.data.get("cycle")
        if not cycle_id:
            return None
        cycle = get_object_or_404(Cycle.objects.filter(visible_cycles(self.request)), id=cycle_id)
        if str(cycle.org_id or "") != str(org_id or ""):
            raise ValidationError({"cycle": ["That cycle belongs to another organization."]})
        if cycle.status == CycleStatus.CLOSED:
            raise ValidationError({"cycle": ["That cycle is closed."]})
        return cycle

    def perform_create(self, serializer):
        org_id = serializer.validated_data.get("org_id")
        if org_id:
            current = Goal.objects.filter(org_id=org_id).exclude(status=GoalStatus.ARCHIVED).count()
            check_org_limit(org_id, "max_goals", current, "goals")
        cycle = self._resolve_cycle(org_id)
        goal = serializer.save(owner_id=self.request.user.id, parent=self._resolve_parent(), cycle=cycle)
        record(goal.id, ActivityVerb.GOAL_CREATED, self.request.user.id, title=goal.title)

    def perform_update(self, serializer):
        # Presence, not truthiness: "parent" ABSENT from the body (a plain
        # PATCH of other fields) leaves the existing parent untouched;
        # "parent" present but empty/null explicitly CLEARS it (un-parents
        # the goal); present with a value reassigns it. Truthiness alone
        # can't tell "the key was never sent" from "it was sent as null" -
        # both read as falsy - and this module's own edit form always
        # resends whatever `parent` it read (now un-deferred by default,
        # see core_api's BaseSerializer), including empty, so collapsing
        # that into "leave untouched" would make clearing a parent
        # impossible from the UI.
        instance = serializer.instance
        visibility = serializer.validated_data.get("visibility", instance.visibility)
        if visibility != instance.visibility and str(instance.owner_id) != str(self.request.user.id):
            raise PermissionDenied("Only the goal's owner can change who sees it.")
        before = snapshot(instance, FEED_FIELDS)
        org_id = serializer.validated_data.get("org_id", instance.org_id)
        if "cycle" in self.request.data:
            cycle = self._resolve_cycle(org_id)
        elif instance.cycle_id and str(instance.cycle.org_id or "") != str(org_id or ""):
            cycle = None  # moved to another org - its cycle doesn't come along
        else:
            cycle = instance.cycle
        if "parent" in self.request.data:
            parent_id = self.request.data.get("parent")
            parent = self._resolve_parent(exclude_id=instance.id) if parent_id else None
        else:
            parent = instance.parent
        goal = serializer.save(parent=parent, cycle=cycle)
        # Its target date may have moved - health and projection follow it.
        refresh_goal(goal.id)
        goal.refresh_from_db()  # the response shows the recomputed fields
        diff = changes(before, goal, FEED_FIELDS)
        if diff:
            record(goal.id, ActivityVerb.GOAL_CHANGED, self.request.user.id, changes=diff)

    @action(detail=True, methods=["get"])
    def chart(self, request, pk=None):
        """`GET goals/<id>/chart` - what the dashboard draws for one goal,
        as data: each metric's readings over time (value and % of the way
        from base to target, a sum metric as its running total), plus the
        goal's own numbers and its dashboard link. For a client that draws
        the chart itself - an AI agent, through `mcp_tools.py`."""
        goal = self.get_object()
        metrics = sorted(Metric.objects.filter(goal=goal), key=lambda m: m.name.lower())
        check_ins: dict = {}
        for check_in in CheckIn.objects.filter(metric__goal=goal):
            check_ins.setdefault(check_in.metric_id, []).append(check_in)
        roots = {m.id for m in root_metrics(metrics)}

        def pct(value, metric):
            value = metric_pct(value, metric)
            return None if value is None else round(value, 2)

        app_url = (getattr(settings, "GOALNEXA_PUBLIC_URL", "") or request.build_absolute_uri("/")).rstrip("/")
        return Response({
            "goal": {
                "id": str(goal.id),
                "title": goal.title,
                "target_date": goal.target_date,
                "progress": goal.progress,
                "projected_progress": goal.projected_progress,
                "health": goal.health,
            },
            "url": f"{app_url}/dashboard?goal={goal.id}",
            "metrics": [
                {
                    "id": str(metric.id),
                    "name": metric.name,
                    "unit": metric.unit,
                    "aggregation": metric.aggregation,
                    "counts_toward_goal": metric.id in roots,
                    "base_value": float(metric.base_value),
                    "target_value": float(metric.target_value),
                    "current_value": float(metric.current_value),
                    "progress": pct(metric.current_value, metric),
                    "started_at": metric.created_at,
                    "points": [
                        {"at": when, "value": value, "progress": pct(value, metric)}
                        for when, value in metric_readings(metric, check_ins.get(metric.id, []))
                    ],
                }
                for metric in metrics
            ],
        })
