"""/api/v1/activities - a goal's feed (`Activity`, read-only; written by
`goalnexa.activity.record`), and /api/v1/goal-comments - comments on a
goal, optionally on one of its check-ins. Both follow the goal's
visibility; a comment is edited or deleted by its author only."""

from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated

from core_api.viewsets import BaseViewSet
from goalnexa.access import visible_goals
from goalnexa.activity import record
from goalnexa.models import Activity, ActivityVerb, CheckIn, Goal, GoalComment
from goalnexa.serializers import ActivitySerializer, GoalCommentSerializer

EXCERPT = 280


class ActivityViewSet(BaseViewSet):
    queryset = Activity.objects.all()
    serializer_class = ActivitySerializer
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated]
    scope_field = "goal__org_id"

    def get_queryset(self):
        return super().get_queryset().filter(visible_goals(self.request, "goal__")).order_by("-created_at")


class GoalCommentViewSet(BaseViewSet):
    queryset = GoalComment.objects.all()
    serializer_class = GoalCommentSerializer
    search_fields = ["body"]
    permission_classes = [IsAuthenticated]
    scope_field = "goal__org_id"

    def get_queryset(self):
        return super().get_queryset().filter(visible_goals(self.request, "goal__")).order_by("created_at")

    def perform_create(self, serializer):
        goal_id = self.request.data.get("goal")
        if not goal_id:
            raise ValidationError({"goal": ["This field is required."]})
        goal = get_object_or_404(Goal.objects.filter(visible_goals(self.request)), id=goal_id)
        check_in = None
        if self.request.data.get("check_in"):
            check_in = get_object_or_404(CheckIn.objects.filter(metric__goal=goal), id=self.request.data["check_in"])
        if not serializer.validated_data.get("body", "").strip():
            raise ValidationError({"body": ["Write something."]})
        comment = serializer.save(goal=goal, check_in=check_in, author_id=self.request.user.id)
        record(goal.id, ActivityVerb.COMMENTED, self.request.user.id, comment=comment.id, excerpt=comment.body[:EXCERPT])

    def _check_author(self, comment):
        if str(comment.author_id) != str(self.request.user.id):
            raise PermissionDenied("Only its author can change a comment.")

    def perform_update(self, serializer):
        self._check_author(serializer.instance)
        # The goal and check-in stay; only the text changes.
        serializer.save(goal=serializer.instance.goal, check_in=serializer.instance.check_in)

    def perform_destroy(self, instance):
        self._check_author(instance)
        instance.delete()
