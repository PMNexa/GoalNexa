"""/api/v1/metrics - a plain top-level BaseViewSet, same flat-resource
shape OrganizationViewSet uses (no nested `/goals/{id}/metrics` route).

`goal` is a read-only sideload field on `MetricSerializer`
(`DynamicRelationField`, see `core_api.serializers.BaseSerializer`), so
which goal a metric belongs to is resolved here from the request body's
`goal` id directly, not through the serializer's own `validated_data` -
same pattern `OrganizationViewSet.perform_create` uses for
`OrgMembership.org`.
"""

from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated

from core_api.viewsets import BaseViewSet
from goalnexa.models import Goal, Metric
from goalnexa.serializers import MetricSerializer


class MetricViewSet(BaseViewSet):
    queryset = Metric.objects.all()
    serializer_class = MetricSerializer
    search_fields = ["name"]
    permission_classes = [IsAuthenticated]
    scope_field = "goal__org_id"  # its goal's org - see GoalViewSet

    def get_queryset(self):
        return super().get_queryset().filter(goal__owner_id=self.request.user.id).order_by("-created_at")

    def _resolve_goal(self):
        goal_id = self.request.data.get("goal")
        if not goal_id:
            raise ValidationError({"goal": ["This field is required."]})
        return get_object_or_404(Goal, id=goal_id, owner_id=self.request.user.id)

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
        return get_object_or_404(Metric, id=parent_id, goal__owner_id=self.request.user.id)

    def perform_create(self, serializer):
        # A new metric starts at its base, unless the caller gave a current
        # value explicitly (an emptied form field is omitted, not sent).
        extra = {}
        if "current_value" not in self.request.data:
            extra["current_value"] = serializer.validated_data.get("base_value", 0)
        serializer.save(goal=self._resolve_goal(), parent=self._resolve_parent(), **extra)

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
        serializer.save(goal=goal, parent=parent)
