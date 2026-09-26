from rest_framework.routers import SimpleRouter

from core_api.registry import register_model_endpoint
from goalnexa.models import CheckIn, Goal, GoalMember, Metric
from goalnexa.views import CheckInViewSet, GoalMemberViewSet, GoalViewSet, MetricViewSet

# trailing_slash=False - same convention platform_org.urls uses (no
# trailing slash on any of this platform's own resource paths).
router = SimpleRouter(trailing_slash=False)
router.register("goals", GoalViewSet, basename="goals")
router.register("goal-members", GoalMemberViewSet, basename="goal-members")
router.register("metrics", MetricViewSet, basename="metrics")
router.register("check-ins", CheckInViewSet, basename="check-ins")

# Lets a relation field's schema (e.g. Metric.goal) tell the frontend
# where to fetch ITS OWN rows from for a picker - see core_api.registry's
# own docstring for why this can't just be derived from the model name.
register_model_endpoint(Goal, "/api/v1/goals")
register_model_endpoint(GoalMember, "/api/v1/goal-members")
register_model_endpoint(Metric, "/api/v1/metrics")
register_model_endpoint(CheckIn, "/api/v1/check-ins")

urlpatterns = router.urls
