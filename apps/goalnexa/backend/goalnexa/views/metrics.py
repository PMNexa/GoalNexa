"""/api/v1/metrics - a plain top-level BaseViewSet, same flat-resource
shape OrganizationViewSet uses (no nested `/goals/{id}/metrics` route).

`goal` is a read-only sideload field on `MetricSerializer`
(`DynamicRelationField`, see `core_api.serializers.BaseSerializer`), so
which goal a metric belongs to is resolved here from the request body's
`goal` id directly, not through the serializer's own `validated_data` -
same pattern `OrganizationViewSet.perform_create` uses for
`OrgMembership.org`.

Every write re-runs `goalnexa.progress` for the metric and its goal (a
new root metric, a changed base or target, a move to another goal all
change the goal's progress). `POST/DELETE <id>/ingest-token` issues or
revokes the metric's ingest token (see `views/ingest.py`).
"""

import hashlib
import secrets

from django.shortcuts import get_object_or_404
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core_api.viewsets import BaseViewSet
from goalnexa.access import visible_goals
from goalnexa.activity import changes, record, snapshot
from goalnexa.models import ActivityVerb, Goal, Metric
from goalnexa.ordering import ReorderMixin, next_position, sibling_key
from goalnexa.periods import NEW_SETTINGS, SNAP_FIELDS, STAMP_FIELDS, apply_follow, metric_follow_plan, resnap, snap_settings
from goalnexa.progress import refresh_goal, refresh_metric, refresh_metric_and_goal
from goalnexa.serializers import MetricSerializer
from goalnexa.serializers.metric import SNAP_TO_GOAL, validate_one_per
from goalnexa.teams import can_set_targets
from goalnexa.templates import LOCKED_METRIC_FIELDS
from goalnexa.views.goals import SET_BY_TEMPLATE, TOTAL_READ_ONLY, locked_changes

#: What every ingest token starts with - recognizable if it leaks.
INGEST_TOKEN_PREFIX = "gnm_"


#: The metric fields a change of which goes in the goal's feed.
FEED_FIELDS = ["name", "unit", "base_value", "target_value", "aggregation", "check_in_every", "goal"]


def hash_ingest_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class MetricViewSet(ReorderMixin, BaseViewSet):
    queryset = Metric.objects.all()
    serializer_class = MetricSerializer
    search_fields = ["name"]
    permission_classes = [IsAuthenticated]
    scope_field = "goal__org_id"  # its goal's org - see GoalViewSet

    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .filter(visible_goals(self.request, "goal__"))
            .select_related("goal")
            .order_by("-created_at")
        )

    def _resolve_goal(self):
        goal_id = self.request.data.get("goal")
        if not goal_id:
            raise ValidationError({"goal": ["This field is required."]})
        return get_object_or_404(Goal.objects.filter(visible_goals(self.request)), id=goal_id)

    def _resolve_parent(self, exclude_id=None):
        """Optional, unlike `_resolve_goal` - see `GoalViewSet._resolve_parent`'s
        own docstring for the same "not itself, no deeper cycle check" rule.
        Deliberately NOT required to share `goal` with its parent metric -
        see `Metric.parent`'s own docstring.
        """
        parent_id = self.request.data.get("parent")
        if not parent_id:
            return None
        if exclude_id is not None and str(parent_id) == str(exclude_id):
            raise ValidationError({"parent": ["A metric can't be its own parent."]})
        return get_object_or_404(Metric.objects.filter(visible_goals(self.request, "goal__")), id=parent_id)

    def _snap_settings(self, serializer, goal, parent) -> dict:
        """The check-in setting to save (`snap_to` + `SnapMoment` +
        `snap_to_goal`): "goal" (and, on a new metric, nothing sent) is
        inherited - a sub-metric's from its parent metric (same goal), else
        the goal's; anything else is the metric's own, the fields sent over
        what it had. The period in effect is checked against the metric's
        target and one-reading periods. Takes the fields out of
        `validated_data`."""
        data, instance = serializer.validated_data, serializer.instance
        sent = {name: data.pop(name) for name in SNAP_FIELDS if name in data}
        if "snap_to" in sent:
            follows = (sent["snap_to"] or "") == SNAP_TO_GOAL
        else:
            follows = instance.snap_to_goal if instance else True
        if follows:
            source = parent if parent is not None and parent.goal_id == goal.id else goal
            value = snap_settings(source)
        else:
            value = {**(snap_settings(instance) if instance else NEW_SETTINGS), **sent}
        one_per = data.get("one_per", getattr(instance, "one_per", ""))
        target_per = data.get("target_per", getattr(instance, "target_per", ""))
        try:
            validate_one_per(one_per, target_per, value["snap_to"])
        except ValidationError:
            if not follows:
                raise
            raise ValidationError({"snap_to": [
                f"What it inherits is check-ins for a whole {value['snap_to']}, longer than this metric's target or one-reading period. Pick a period for this metric."
            ]})
        return {**value, "snap_to_goal": follows}

    @staticmethod
    def _sub_metric_plan(metric_id, goal, value) -> list:
        """The inheriting sub-metrics (all the way down) that follow
        `metric_id`'s new setting - checked like the metric itself."""
        plan = metric_follow_plan(goal.id, snap_settings(goal), {metric_id: value})
        for sub, sub_value in plan:
            try:
                validate_one_per(sub.one_per, sub.target_per, sub_value["snap_to"])
            except ValidationError:
                raise ValidationError({"snap_to": [
                    f'"{sub.name}" inherits this setting and can\'t have check-ins for a whole {sub_value["snap_to"]}. Pick a period for it first.'
                ]})
        return plan

    def perform_create(self, serializer):
        # A new metric starts at its base, unless the caller gave a current
        # value explicitly (an emptied form field is omitted, not sent).
        extra = {}
        if "current_value" not in self.request.data:
            extra["current_value"] = serializer.validated_data.get("base_value", 0)
        goal = self._resolve_goal()
        if goal.is_rollup:
            raise ValidationError({"goal": [TOTAL_READ_ONLY]})
        parent = self._resolve_parent()
        metric = serializer.save(goal=goal, parent=parent, **self._snap_settings(serializer, goal, parent), **extra)
        metric.position = next_position(metric)
        metric.save(update_fields=["position"])
        refresh_metric_and_goal(metric.id)
        metric.refresh_from_db()  # the response shows the recomputed fields
        record(metric.goal_id, ActivityVerb.METRIC_ADDED, self.request.user.id, metric=metric.id, metric_name=metric.name)

    def perform_update(self, serializer):
        # Presence, not truthiness - see GoalViewSet.perform_update's own
        # docstring for why (`goal`/`parent` are both now un-deferred by
        # default, so this module's own edit form always resends them,
        # including empty - truthiness alone can't tell "never sent" from
        # "sent as null").  `goal` staying empty/falsy-but-present still
        # 400s via `_resolve_goal` (it's required, unlike `parent`).
        instance = serializer.instance
        data = self.request.data
        if instance.goal.is_rollup:
            raise PermissionDenied(TOTAL_READ_ONLY + " Set its planned target on the team board.")
        if instance.template_metric_id:
            locked = locked_changes(self.request, serializer, instance, LOCKED_METRIC_FIELDS)
            if locked:
                raise ValidationError({name: [SET_BY_TEMPLATE] for name in locked})
            numbers = {"base_value", "target_value", "current_value"} & set(serializer.validated_data)
            if numbers and not can_set_targets(self.request, instance.goal):
                raise PermissionDenied("Only the team's lead, the goal's owner or the organization's owners and admins can set its targets.")
        goal = self._resolve_goal() if "goal" in data else instance.goal
        parent = (self._resolve_parent(exclude_id=instance.id) if data.get("parent") else None) if "parent" in data else instance.parent
        old_goal_id = instance.goal_id
        old_value_rule = (instance.aggregation, instance.base_value, instance.one_per, instance.snap_to)
        old_stamp = tuple(getattr(instance, name) for name in STAMP_FIELDS)
        before = snapshot(instance, FEED_FIELDS)
        old_siblings = sibling_key(instance)
        snap = self._snap_settings(serializer, goal, parent)
        value = {name: snap[name] for name in SNAP_FIELDS}
        sub_plan = self._sub_metric_plan(instance.id, goal, value) if value != snap_settings(instance) or goal.id != instance.goal_id else []
        metric = serializer.save(goal=goal, parent=parent, **snap)
        if sibling_key(metric) != old_siblings:  # moved - it goes last in its new place
            metric.position = next_position(metric)
            metric.save(update_fields=["position"])
        # A current value set by hand stays - unless what check-ins add up
        # to just changed (a SUM metric counts from its base; which
        # check-ins count follows `one_per`).
        moved = tuple(getattr(metric, name) for name in STAMP_FIELDS) != old_stamp
        if moved:
            resnap(metric)  # existing check-ins move to their period's moment too
        refresh_metric(metric.id, sync_value=moved or (metric.aggregation, metric.base_value, metric.one_per, metric.snap_to) != old_value_rule)
        apply_follow([], sub_plan)  # its inheriting sub-metrics follow
        refresh_goal(metric.goal_id)
        if old_goal_id != metric.goal_id:
            refresh_goal(old_goal_id)
        metric.refresh_from_db()  # the response shows the recomputed fields
        diff = changes(before, metric, FEED_FIELDS)
        if diff:
            record(metric.goal_id, ActivityVerb.METRIC_CHANGED, self.request.user.id, metric=metric.id, metric_name=metric.name, changes=diff)

    def perform_destroy(self, instance):
        if instance.goal.is_rollup:
            raise PermissionDenied(TOTAL_READ_ONLY)
        if instance.template_metric_id:
            raise ValidationError({"template_metric": ["Part of a goal template - remove it from the template."]})
        goal_id = instance.goal_id
        record(goal_id, ActivityVerb.METRIC_REMOVED, self.request.user.id, metric_name=instance.name)
        instance.delete()
        refresh_goal(goal_id)

    @action(detail=True, methods=["post", "delete"], url_path="ingest-token")
    def ingest_token(self, request, pk=None):
        """POST: a new ingest token, replacing any old one - returned this
        once, only its hash is kept. DELETE: revoke it. Needs the right to
        update the metric (the access policy maps both to `update`)."""
        metric = self.get_object()
        if request.method == "DELETE":
            metric.ingest_token_hash = metric.ingest_token_hint = ""
            metric.save(update_fields=["ingest_token_hash", "ingest_token_hint", "updated_at"])
            return Response(status=204)
        token = INGEST_TOKEN_PREFIX + secrets.token_urlsafe(32)
        metric.ingest_token_hash = hash_ingest_token(token)
        metric.ingest_token_hint = token[-4:]
        metric.save(update_fields=["ingest_token_hash", "ingest_token_hint", "updated_at"])
        return Response(
            {"token": token, "hint": metric.ingest_token_hint, "url": request.build_absolute_uri(f"/api/v1/metrics/{metric.id}/ingest")},
            status=201,
        )
