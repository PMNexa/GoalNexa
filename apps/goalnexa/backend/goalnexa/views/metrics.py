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
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core_api.viewsets import BaseViewSet
from goalnexa.access import visible_goals
from goalnexa.activity import changes, record, snapshot
from goalnexa.models import ActivityVerb, Goal, Metric
from goalnexa.progress import refresh_goal, refresh_metric, refresh_metric_and_goal
from goalnexa.serializers import MetricSerializer

#: What every ingest token starts with - recognizable if it leaks.
INGEST_TOKEN_PREFIX = "gnm_"


#: The metric fields a change of which goes in the goal's feed.
FEED_FIELDS = ["name", "unit", "base_value", "target_value", "aggregation", "check_in_every", "goal"]


def hash_ingest_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class MetricViewSet(BaseViewSet):
    queryset = Metric.objects.all()
    serializer_class = MetricSerializer
    search_fields = ["name"]
    permission_classes = [IsAuthenticated]
    scope_field = "goal__org_id"  # its goal's org - see GoalViewSet

    def get_queryset(self):
        return super().get_queryset().filter(visible_goals(self.request, "goal__")).order_by("-created_at")

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

    def perform_create(self, serializer):
        # A new metric starts at its base, unless the caller gave a current
        # value explicitly (an emptied form field is omitted, not sent).
        extra = {}
        if "current_value" not in self.request.data:
            extra["current_value"] = serializer.validated_data.get("base_value", 0)
        metric = serializer.save(goal=self._resolve_goal(), parent=self._resolve_parent(), **extra)
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
        goal = self._resolve_goal() if "goal" in data else instance.goal
        parent = (self._resolve_parent(exclude_id=instance.id) if data.get("parent") else None) if "parent" in data else instance.parent
        old_goal_id = instance.goal_id
        old_value_rule = (instance.aggregation, instance.base_value)
        before = snapshot(instance, FEED_FIELDS)
        metric = serializer.save(goal=goal, parent=parent)
        # A current value set by hand stays - unless what check-ins add up
        # to just changed (a SUM metric counts from its base).
        refresh_metric(metric.id, sync_value=(metric.aggregation, metric.base_value) != old_value_rule)
        refresh_goal(metric.goal_id)
        if old_goal_id != metric.goal_id:
            refresh_goal(old_goal_id)
        metric.refresh_from_db()  # the response shows the recomputed fields
        diff = changes(before, metric, FEED_FIELDS)
        if diff:
            record(metric.goal_id, ActivityVerb.METRIC_CHANGED, self.request.user.id, metric=metric.id, metric_name=metric.name, changes=diff)

    def perform_destroy(self, instance):
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
