from django.urls import path
from rest_framework.routers import SimpleRouter

from core_api.registry import register_model_endpoint
from goalnexa.models import Activity, CheckIn, Cycle, Goal, GoalComment, GoalMember, GoalScore, Metric
from goalnexa.views import (
    ActivityViewSet,
    CheckInViewSet,
    CycleViewSet,
    DashboardShareDetailView,
    DashboardShareListView,
    GoalCommentViewSet,
    GoalScoreViewSet,
    GoalMemberViewSet,
    GoalViewSet,
    MetricIngestView,
    MetricViewSet,
    ReminderSettingsView,
    ReminderTestView,
    SharedDashboardView,
)

# trailing_slash=False - same convention platform_org.urls uses (no
# trailing slash on any of this platform's own resource paths).
router = SimpleRouter(trailing_slash=False)
router.register("goals", GoalViewSet, basename="goals")
router.register("goal-members", GoalMemberViewSet, basename="goal-members")
router.register("metrics", MetricViewSet, basename="metrics")
router.register("check-ins", CheckInViewSet, basename="check-ins")
router.register("cycles", CycleViewSet, basename="cycles")
router.register("goal-scores", GoalScoreViewSet, basename="goal-scores")
router.register("activities", ActivityViewSet, basename="activities")
router.register("goal-comments", GoalCommentViewSet, basename="goal-comments")

# Lets a relation field's schema (e.g. Metric.goal) tell the frontend
# where to fetch ITS OWN rows from for a picker - see core_api.registry's
# own docstring for why this can't just be derived from the model name.
register_model_endpoint(Goal, "/api/v1/goals")
register_model_endpoint(GoalMember, "/api/v1/goal-members")
register_model_endpoint(Metric, "/api/v1/metrics")
register_model_endpoint(CheckIn, "/api/v1/check-ins")
register_model_endpoint(Cycle, "/api/v1/cycles")
register_model_endpoint(GoalScore, "/api/v1/goal-scores")
register_model_endpoint(Activity, "/api/v1/activities")
register_model_endpoint(GoalComment, "/api/v1/goal-comments")

urlpatterns = [
    # Token-authenticated check-ins from scripts/webhooks (views/ingest.py).
    path("metrics/<str:pk>/ingest", MetricIngestView.as_view(), name="metric-ingest"),
    # The caller's own reminder settings - not a resource (views/reminders.py).
    path("reminder-settings", ReminderSettingsView.as_view(), name="reminder-settings"),
    path("reminder-settings/test", ReminderTestView.as_view(), name="reminder-settings-test"),
    # Public dashboard links: the owner's list, and what a link shows (views/shares.py).
    path("dashboard-shares", DashboardShareListView.as_view(), name="dashboard-shares"),
    path("dashboard-shares/<str:pk>", DashboardShareDetailView.as_view(), name="dashboard-share"),
    path("shared-dashboards/<str:token>", SharedDashboardView.as_view(), name="shared-dashboard"),
    *router.urls,
]
