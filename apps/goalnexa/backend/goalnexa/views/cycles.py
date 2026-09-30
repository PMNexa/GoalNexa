"""/api/v1/cycles - periods goals are set for (`Cycle`), and
/api/v1/goal-scores - how each goal did when its cycle closed (read-only).

`POST cycles/<id>/close` ends a cycle (`goalnexa.cycles.close_cycle`):

    {"decisions": [{"goal": "<id>", "action": "done|rollover|drop",
                    "score": 0.8, "reflection": "..."}, ...],
     "next_cycle": "<id>",   # required if any goal rolls over
     "retro": "..."}

A goal left out is scored by default and marked done. The access policy
maps it to `update` on cycles. A closed cycle can't be edited or reopened.
"""

from decimal import Decimal, InvalidOperation

from django.shortcuts import get_object_or_404
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core_api.viewsets import BaseViewSet
from goalnexa.access import visible_cycles, visible_goals
from goalnexa.cycles import ACTIONS, ROLLOVER, close_cycle
from goalnexa.models import Cycle, CycleStatus, GoalScore
from goalnexa.serializers import CycleSerializer, GoalScoreSerializer


class CycleViewSet(BaseViewSet):
    queryset = Cycle.objects.all()
    serializer_class = CycleSerializer
    search_fields = ["name"]
    permission_classes = [IsAuthenticated]
    scope_field = "org_id"

    def get_queryset(self):
        return super().get_queryset().filter(visible_cycles(self.request)).order_by("-starts_on", "name")

    def _check_dates_and_status(self, data, instance=None):
        starts = data.get("starts_on", getattr(instance, "starts_on", None))
        ends = data.get("ends_on", getattr(instance, "ends_on", None))
        if starts and ends and ends < starts:
            raise ValidationError({"ends_on": ["Ends before it starts."]})
        if data.get("status") == CycleStatus.CLOSED:
            raise ValidationError({"status": ["Close a cycle with its Close action - it scores the goals."]})

    def perform_create(self, serializer):
        self._check_dates_and_status(serializer.validated_data)
        serializer.save(owner_id=self.request.user.id)

    def perform_update(self, serializer):
        instance = serializer.instance
        if instance.status == CycleStatus.CLOSED:
            raise ValidationError({"status": ["This cycle is closed."]})
        if "org_id" in serializer.validated_data and str(serializer.validated_data["org_id"] or "") != str(instance.org_id or ""):
            raise ValidationError({"org_id": ["A cycle can't move to another organization."]})
        self._check_dates_and_status(serializer.validated_data, instance)
        serializer.save()

    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        cycle = self.get_object()
        if cycle.status == CycleStatus.CLOSED:
            raise ValidationError({"status": ["This cycle is already closed."]})
        decisions = {}
        visible_ids = {
            str(i) for i in cycle.goals.filter(visible_goals(request)).values_list("id", flat=True)
        }
        for item in request.data.get("decisions") or []:
            goal_id = str(item.get("goal", ""))
            if goal_id not in visible_ids:
                raise ValidationError({"decisions": [f"Not a goal of this cycle: {goal_id}"]})
            act = item.get("action", "done")
            if act not in ACTIONS:
                raise ValidationError({"decisions": [f"Unknown action: {act}"]})
            score = item.get("score")
            if score is not None:
                try:
                    score = Decimal(str(score))
                except InvalidOperation:
                    raise ValidationError({"decisions": [f"Not a score: {score}"]}) from None
                if not Decimal(0) <= score <= Decimal(1):
                    raise ValidationError({"decisions": ["A score is between 0 and 1."]})
            decisions[goal_id] = {"action": act, "score": score, "reflection": str(item.get("reflection") or "")}
        next_cycle = None
        if request.data.get("next_cycle"):
            next_cycle = get_object_or_404(Cycle.objects.filter(visible_cycles(request)), id=request.data["next_cycle"])
            if next_cycle.id == cycle.id or next_cycle.status == CycleStatus.CLOSED:
                raise ValidationError({"next_cycle": ["Pick another cycle that isn't closed."]})
            if str(next_cycle.org_id or "") != str(cycle.org_id or ""):
                raise ValidationError({"next_cycle": ["That cycle belongs to another organization."]})
        if next_cycle is None and any(d["action"] == ROLLOVER for d in decisions.values()):
            raise ValidationError({"next_cycle": ["Pick the cycle to roll goals over into."]})
        scores = close_cycle(
            cycle, decisions, next_cycle=next_cycle, retro=str(request.data.get("retro") or ""), actor_id=request.user.id
        )
        return Response(
            {
                "cycle": CycleSerializer(Cycle.objects.get(id=cycle.id)).data,
                "scores": GoalScoreSerializer(scores, many=True).data,
            }
        )


class GoalScoreViewSet(BaseViewSet):
    queryset = GoalScore.objects.all()
    serializer_class = GoalScoreSerializer
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated]
    scope_field = "goal__org_id"

    def get_queryset(self):
        return super().get_queryset().filter(visible_goals(self.request, "goal__")).order_by("-created_at")
