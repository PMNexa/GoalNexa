"""Public dashboard links (`DashboardShare`).

- `GET /api/v1/dashboard-shares` - the caller's own links.
- `POST /api/v1/dashboard-shares` - `{title, goals: [ids], hidden_metrics:
  [ids]}`: a link to those goals (1-8, each one the caller can see).
- `DELETE /api/v1/dashboard-shares/<id>` - revokes one of the caller's links.
- `GET /api/v1/shared-dashboards/<token>` - what the link shows, no login:
  the goals the link's owner can still see, their metrics and check-ins.
  Only what the charts need - no notes, authors, owners or org ids.

Plain views like `reminder-settings`, not a `BaseViewSet`: a user only
ever has their own links, nothing to browse, filter or grant roles on.
"""

import uuid

from django.conf import settings
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView

from goalnexa.access import visible_goals
from goalnexa.digest import as_user
from goalnexa.models import CheckIn, DashboardShare, Goal, Metric

MAX_GOALS = 8


def _share_payload(share: DashboardShare) -> dict:
    return {
        "id": str(share.id),
        "token": share.token,
        "title": share.title,
        "goals": share.goal_ids,
        "hidden_metrics": share.hidden_metric_ids,
        "created_at": share.created_at.isoformat(),
    }


def _ids(data, key: str, limit: int) -> list[str]:
    raw = data.get(key) or []
    if not isinstance(raw, list) or len(raw) > limit:
        raise ValidationError({key: [f"A list of at most {limit} ids."]})
    try:
        return list(dict.fromkeys(str(uuid.UUID(str(value))) for value in raw))
    except ValueError:
        raise ValidationError({key: ["Not a valid id."]}) from None


class DashboardShareListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # The usual list envelope, unpaginated: a person has a handful of links.
        items = [_share_payload(share) for share in DashboardShare.objects.filter(owner_id=request.user.id)]
        return Response({"items": items, "total": len(items)})

    def post(self, request):
        goal_ids = _ids(request.data, "goals", MAX_GOALS)
        if not goal_ids:
            raise ValidationError({"goals": ["Pick at least one goal."]})
        visible = Goal.objects.filter(visible_goals(request), id__in=goal_ids).count()
        if visible != len(goal_ids):
            raise ValidationError({"goals": ["Only goals you can see."]})
        hidden = _ids(request.data, "hidden_metrics", 500)
        hidden = [str(i) for i in Metric.objects.filter(id__in=hidden, goal_id__in=goal_ids).values_list("id", flat=True)]
        share = DashboardShare.objects.create(
            owner_id=request.user.id,
            title=str(request.data.get("title") or "")[:255],
            goal_ids=goal_ids,
            hidden_metric_ids=hidden,
        )
        return Response(_share_payload(share), status=201)


class DashboardShareDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        deleted, _ = DashboardShare.objects.filter(id=pk if _is_uuid(pk) else None, owner_id=request.user.id).delete()
        if not deleted:
            raise NotFound()
        return Response(status=204)


class SharedDashboardThrottle(SimpleRateThrottle):
    """Per client IP - nobody is signed in."""

    scope = "goalnexa_shared_dashboard"

    def get_rate(self):
        return getattr(settings, "GOALNEXA_SHARED_DASHBOARD_RATE", "120/min")

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


def _decimal(value) -> str | None:
    return None if value is None else str(value)


class SharedDashboardView(APIView):
    authentication_classes = []
    permission_classes = []
    throttle_classes = [SharedDashboardThrottle]

    def get(self, request, token):
        share = DashboardShare.objects.filter(token=token).first() if token else None
        if share is None:
            raise NotFound("This link was removed or never existed.")
        rows = Goal.objects.filter(visible_goals(as_user(share.owner_id)), id__in=share.goal_ids)
        by_id = {str(goal.id): goal for goal in rows}
        # The link's order, which is the order the dashboard showed them in.
        goals = [by_id[goal_id] for goal_id in share.goal_ids if goal_id in by_id]
        metrics = Metric.objects.filter(goal__in=goals).order_by("name")
        check_ins = CheckIn.objects.filter(metric__in=metrics).order_by("checked_in_at")
        return Response({
            "title": share.title,
            "goals": [
                {
                    "id": str(goal.id),
                    "title": goal.title,
                    "status": goal.status,
                    "target_date": goal.target_date.isoformat() if goal.target_date else None,
                    "parent": str(goal.parent_id) if goal.parent_id and goal.parent_id in by_id else None,
                    "progress": _decimal(goal.progress),
                    "projected_progress": _decimal(goal.projected_progress),
                    "health": goal.health,
                }
                for goal in goals
            ],
            "metrics": [
                {
                    "id": str(metric.id),
                    "goal": str(metric.goal_id),
                    "name": metric.name,
                    "unit": metric.unit,
                    "base_value": _decimal(metric.base_value),
                    "target_value": _decimal(metric.target_value),
                    "current_value": _decimal(metric.current_value),
                    "parent": str(metric.parent_id) if metric.parent_id else None,
                    "aggregation": metric.aggregation,
                }
                for metric in metrics
            ],
            "check_ins": [
                {
                    "id": str(check_in.id),
                    "metric": str(check_in.metric_id),
                    "value": _decimal(check_in.value),
                    "checked_in_at": check_in.checked_in_at.isoformat(),
                    "source": check_in.source,
                }
                for check_in in check_ins
            ],
            "hidden_metrics": share.hidden_metric_ids,
        })


def _is_uuid(value) -> bool:
    try:
        uuid.UUID(str(value))
    except ValueError:
        return False
    return True
