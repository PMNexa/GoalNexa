from rest_framework.routers import SimpleRouter

from goalnexa.views import CheckInViewSet, GoalViewSet, MetricViewSet

# trailing_slash=False - same convention platform_org.urls uses (no
# trailing slash on any of this platform's own resource paths).
router = SimpleRouter(trailing_slash=False)
router.register("goals", GoalViewSet, basename="goals")
router.register("metrics", MetricViewSet, basename="metrics")
router.register("check-ins", CheckInViewSet, basename="check-ins")

urlpatterns = router.urls
