"""/api/v1/goal-members - who a goal is shared with besides its owner
(see `GoalMember`). Listed for everyone who can see the goal; only the
goal's owner adds or removes someone, and a member can remove themselves.
Only an org goal has members, and only members of that org can be added.
No update: add or remove a row instead.
"""

from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated

from core_api.viewsets import BaseViewSet
from goalnexa.access import is_org_member, visible_goals
from goalnexa.models import Goal, GoalMember
from goalnexa.serializers import GoalMemberSerializer


class GoalMemberViewSet(BaseViewSet):
    queryset = GoalMember.objects.all()
    serializer_class = GoalMemberSerializer
    http_method_names = ["get", "post", "delete", "head", "options"]
    permission_classes = [IsAuthenticated]
    scope_field = "goal__org_id"  # its goal's org - see GoalViewSet

    def get_queryset(self):
        return super().get_queryset().filter(visible_goals(self.request, "goal__")).order_by("created_at")

    def _resolve_goal(self):
        goal_id = self.request.data.get("goal")
        if not goal_id:
            raise ValidationError({"goal": ["This field is required."]})
        return get_object_or_404(Goal.objects.filter(visible_goals(self.request)), id=goal_id)

    def perform_create(self, serializer):
        goal = self._resolve_goal()
        user_id = serializer.validated_data["user_id"]
        if str(goal.owner_id) != str(self.request.user.id):
            raise PermissionDenied("Only the goal's owner can add members.")
        if goal.org_id is None:
            raise ValidationError({"goal": ["Only an organization's goal can have members."]})
        if str(user_id) == str(goal.owner_id):
            raise ValidationError({"user_id": ["The owner already sees this goal."]})
        if not is_org_member(self.request, goal.org_id, user_id):
            raise ValidationError({"user_id": ["Not a member of this goal's organization."]})
        if GoalMember.objects.filter(goal=goal, user_id=user_id).exists():
            raise ValidationError({"user_id": ["Already a member of this goal."]})
        serializer.save(goal=goal)

    def perform_destroy(self, instance):
        me = str(self.request.user.id)
        if me not in (str(instance.user_id), str(instance.goal.owner_id)):
            raise PermissionDenied("Only the goal's owner can remove members.")
        instance.delete()
