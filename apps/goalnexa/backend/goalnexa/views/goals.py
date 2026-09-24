"""/api/v1/goals - a real BaseViewSet (see core_api.viewsets), same
generic-CRUD shape as platform-org's OrganizationViewSet: the standard
ModelViewSet actions plus everything BaseViewSet wires in for free
(`?sort=`, `?q=`, `?filter{field}=value`), and (via GoalSerializer)
`?include[]=metrics`/`?include[]=sub_goals` to sideload a goal's metrics/
sub-goals instead of leaving those fields off.
"""

from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated

from core_api.viewsets import BaseViewSet
from goalnexa.models import Goal
from goalnexa.serializers import GoalSerializer


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
        return super().get_queryset().filter(owner_id=self.request.user.id).order_by("-created_at")

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
        return get_object_or_404(Goal, id=parent_id, owner_id=self.request.user.id)

    def perform_create(self, serializer):
        serializer.save(owner_id=self.request.user.id, parent=self._resolve_parent())

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
        if "parent" in self.request.data:
            parent_id = self.request.data.get("parent")
            parent = self._resolve_parent(exclude_id=instance.id) if parent_id else None
        else:
            parent = instance.parent
        serializer.save(parent=parent)
