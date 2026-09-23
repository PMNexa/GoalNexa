import uuid
from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from goalnexa.models import CheckIn, Goal, Metric
from goalnexa.views import CheckInViewSet


class Actor:
    """Stand-in for whatever resolves `request.user` - these views only read `.id`."""

    is_authenticated = True

    def __init__(self):
        self.id = uuid.uuid4()


class CheckInTimeTests(TestCase):
    def setUp(self):
        self.actor = Actor()
        self.factory = APIRequestFactory()
        goal = Goal.objects.create(title="Run", owner_id=self.actor.id)
        self.metric = Metric.objects.create(goal=goal, name="km", target_value=100)

    def call(self, method, data=None, pk=None):
        action = {"post": "create", "patch": "partial_update", "delete": "destroy"}[method]
        view = CheckInViewSet.as_view({method: action})
        path = "/api/v1/check-ins" + (f"/{pk}" if pk else "")
        request = getattr(self.factory, method)(path, data, format="json")
        force_authenticate(request, user=self.actor)
        return view(request, pk=pk) if pk else view(request)

    def current_value(self):
        self.metric.refresh_from_db()
        return self.metric.current_value

    def test_blank_checked_in_at_defaults_to_now(self):
        before = timezone.now()
        response = self.call("post", {"metric": str(self.metric.id), "value": 10})
        self.assertEqual(response.status_code, 201, response.data)
        checked_in_at = CheckIn.objects.get(id=response.data["id"]).checked_in_at
        self.assertTrue(before <= checked_in_at <= timezone.now())

    def test_explicit_checked_in_at_is_kept(self):
        when = timezone.now() - timedelta(days=3)
        response = self.call("post", {"metric": str(self.metric.id), "value": 10, "checked_in_at": when.isoformat()})
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(CheckIn.objects.get(id=response.data["id"]).checked_in_at, when)

    def test_current_value_follows_latest_checked_in_at_not_latest_written(self):
        now = timezone.now()
        self.call("post", {"metric": str(self.metric.id), "value": 50, "checked_in_at": now.isoformat()})
        # Logged afterwards, but taken earlier - must not become current.
        backdated = self.call(
            "post", {"metric": str(self.metric.id), "value": 20, "checked_in_at": (now - timedelta(days=1)).isoformat()}
        )
        self.assertEqual(self.current_value(), Decimal("50"))

        # Moving the backdated one to the future makes it latest.
        self.call("patch", {"checked_in_at": (now + timedelta(hours=1)).isoformat()}, pk=backdated.data["id"])
        self.assertEqual(self.current_value(), Decimal("20"))

        # Deleting it falls back to the remaining latest.
        self.call("delete", pk=backdated.data["id"])
        self.assertEqual(self.current_value(), Decimal("50"))
