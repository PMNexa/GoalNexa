"""`GET /api/v1/today` - the phone app's home screen (and its widget) in
one call: what's due, this period's quotas, and the goals at risk, scoped
exactly like the lists (`visible_goals`). Every number is the server's
own (stored, or `periods.pace_hint`) - a client shows them, it doesn't
recompute them.
"""

from django.conf import settings
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from goalnexa.access import visible_goals
from goalnexa.models import Goal, GoalHealth, GoalStatus, Metric
from goalnexa.periods import pace_hint, zone_for
from goalnexa.progress import metric_pct
from goalnexa.teams import can_check_in

#: Rows per list - a home screen, not a report.
LIMIT = 50
OPEN_STATUSES = [GoalStatus.NOT_STARTED, GoalStatus.IN_PROGRESS]


def _number(value):
    return None if value is None else float(value)


def _goal(goal: Goal, app_url: str) -> dict:
    return {
        "id": str(goal.id),
        "title": goal.title,
        "org_id": str(goal.org_id) if goal.org_id else None,
        "target_date": goal.target_date,
        "progress": _number(goal.progress),
        "projected_progress": _number(goal.projected_progress),
        "health": goal.health,
        "url": f"{app_url}/dashboard?goal={goal.id}",
    }


def _metric(metric: Metric, zones: dict) -> dict:
    pct = metric_pct(metric.current_value, metric)
    return {
        "id": str(metric.id),
        "name": metric.name,
        "unit": metric.unit,
        "aggregation": metric.aggregation,
        "base_value": float(metric.base_value),
        "target_value": float(metric.target_value),
        "current_value": float(metric.current_value),
        "progress": None if pct is None else round(pct, 2),
        "last_checked_in_at": metric.last_checked_in_at,
        "check_in_due_at": metric.check_in_due_at,
        "target_per": metric.target_per,
        "one_per": metric.one_per,
        "snap_to": metric.snap_to,
        "period_value": _number(metric.period_value),
        "hit_rate": _number(metric.hit_rate),
        "streak": metric.streak,
        "pace": pace_hint(metric, metric.goal, zone=zone_for(metric.goal, zones)),
        "goal": {"id": str(metric.goal_id), "title": metric.goal.title},
    }


class TodayView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Today: due check-ins, quotas, goals at risk",
        description=(
            "The caller's open goals (not started or in progress; no team totals), in three lists of up to "
            f"{LIMIT}: `due` - metrics whose scheduled check-in is due (`check_in_due_at` passed), oldest due "
            "first; `periods` - metrics with a target per period, with `pace` (done, quota and what's left this "
            "period); `at_risk` - goals at risk or off track, lowest progress first. `due` and `periods` hold only "
            "metrics the caller may check in on. `due_total` counts every due metric, past the limit too."
        ),
        parameters=[
            OpenApiParameter(
                "org", str, description="Only this organization's goals; `personal` for personal goals. Default: all."
            )
        ],
        responses={200: OpenApiTypes.OBJECT},
    )
    def get(self, request):
        now = timezone.now()
        goals = Goal.objects.filter(visible_goals(request), status__in=OPEN_STATUSES, is_rollup=False)
        org = request.query_params.get("org")
        if org == "personal":
            goals = goals.filter(org_id__isnull=True)
        elif org:
            goals = goals.filter(org_id=org)
        metrics = Metric.objects.filter(goal__in=goals).select_related("goal")

        zones: dict = {}
        allowed: dict = {}

        def may_check_in(metric: Metric) -> bool:
            goal = metric.goal
            if goal.id not in allowed:
                allowed[goal.id] = not goal.template_goal_id or can_check_in(request, goal)
            return allowed[goal.id]

        due_rows = metrics.filter(check_in_due_at__lte=now).order_by("check_in_due_at", "name")
        due = [m for m in due_rows[: LIMIT * 2] if may_check_in(m)][:LIMIT]
        periods = [
            m for m in metrics.exclude(target_per="").order_by("goal__position", "goal__title", "position", "name")[: LIMIT * 2]
            if may_check_in(m)
        ][:LIMIT]
        at_risk = goals.filter(health__in=[GoalHealth.AT_RISK, GoalHealth.OFF_TRACK]).order_by("progress", "title")[:LIMIT]

        app_url = (getattr(settings, "GOALNEXA_PUBLIC_URL", "") or request.build_absolute_uri("/")).rstrip("/")
        return Response({
            "now": now,
            "due_total": due_rows.count(),
            "due": [_metric(m, zones) for m in due],
            "periods": [_metric(m, zones) for m in periods],
            "at_risk": [_goal(g, app_url) for g in at_risk],
        })
