import uuid
from datetime import date, timedelta
from decimal import Decimal
from unittest import mock

from django.core.cache import cache
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient, APIRequestFactory, force_authenticate

from goalnexa.management.commands.goalnexa_jobs import run_once
from goalnexa.models import CheckIn, Goal, GoalHealth, Metric, ReminderSettings
from goalnexa.progress import goal_health, next_due
from goalnexa.views import CheckInViewSet, MetricViewSet


# These test goalnexa's own view logic, not access control - so no host
# access policy (apps/main runs RBAC, which a bare actor has no roles in).
without_access_policy = override_settings(CORE_API_ACCESS_POLICY=None)


class Actor:
    """Stand-in for whatever resolves `request.user` - these views only read `.id`."""

    is_authenticated = True

    def __init__(self):
        self.id = uuid.uuid4()


@without_access_policy
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


@without_access_policy
class MetricBaseValueTests(TestCase):
    def setUp(self):
        self.actor = Actor()
        self.goal = Goal.objects.create(title="Lose weight", owner_id=self.actor.id)

    def create(self, data):
        request = APIRequestFactory().post("/api/v1/metrics", {"goal": str(self.goal.id), **data}, format="json")
        force_authenticate(request, user=self.actor)
        return MetricViewSet.as_view({"post": "create"})(request)

    def test_new_metric_starts_at_its_base(self):
        response = self.create({"name": "kg", "base_value": 80, "target_value": 70})
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(Decimal(response.data["current_value"]), Decimal("80"))

    def test_explicit_current_value_is_kept(self):
        response = self.create({"name": "kg", "base_value": 80, "target_value": 70, "current_value": 76})
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(Decimal(response.data["current_value"]), Decimal("76"))


class ApiTestCase(TestCase):
    """Calls through the URLconf (`/api/v1/...`, where every host mounts goalnexa)."""

    def setUp(self):
        cache.clear()  # ingest rate-limit counts
        self.actor = Actor()
        self.client = APIClient()
        self.client.force_authenticate(user=self.actor)

    def post(self, path, data=None, client=None):
        return (client or self.client).post(f"/api/v1/{path}", data or {}, format="json")

    def goal(self, **fields):
        return Goal.objects.create(**{"title": "G", "owner_id": self.actor.id, **fields})

    def check_in(self, metric, value, days_ago=0):
        when = (timezone.now() - timedelta(days=days_ago)).isoformat()
        response = self.post("check-ins", {"metric": str(metric.id), "value": value, "checked_in_at": when})
        self.assertEqual(response.status_code, 201, response.data)
        metric.refresh_from_db()
        return response


@without_access_policy
class SumAggregationTests(ApiTestCase):
    def test_sum_metric_adds_check_ins_to_its_base(self):
        metric = Metric.objects.create(goal=self.goal(), name="km", base_value=5, target_value=100, aggregation="sum")
        self.check_in(metric, 12, days_ago=2)
        self.check_in(metric, 8)
        self.assertEqual(metric.current_value, Decimal("25"))

        response = self.client.patch(f"/api/v1/check-ins/{CheckIn.objects.filter(value=8).get().id}", {"value": 3}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        metric.refresh_from_db()
        self.assertEqual(metric.current_value, Decimal("20"))

    def test_switching_aggregation_recomputes_current_value(self):
        metric = Metric.objects.create(goal=self.goal(), name="km", target_value=100)
        self.check_in(metric, 10, days_ago=1)
        self.check_in(metric, 4)
        self.assertEqual(metric.current_value, Decimal("4"))
        self.client.patch(f"/api/v1/metrics/{metric.id}", {"aggregation": "sum"}, format="json")
        metric.refresh_from_db()
        self.assertEqual(metric.current_value, Decimal("14"))

    def test_hand_set_current_value_survives_unrelated_edit(self):
        metric = Metric.objects.create(goal=self.goal(), name="km", target_value=100)
        self.check_in(metric, 10)
        self.client.patch(f"/api/v1/metrics/{metric.id}", {"current_value": 11, "name": "Distance"}, format="json")
        metric.refresh_from_db()
        self.assertEqual(metric.current_value, Decimal("11"))


@without_access_policy
class ScheduleTests(ApiTestCase):
    def test_due_follows_the_latest_check_in(self):
        metric = Metric.objects.create(goal=self.goal(), name="km", target_value=100)
        response = self.client.patch(f"/api/v1/metrics/{metric.id}", {"check_in_every": "weekly"}, format="json")
        metric.refresh_from_db()
        self.assertEqual(metric.check_in_due_at, metric.created_at + timedelta(weeks=1))
        self.assertIsNotNone(response.data["check_in_due_at"])  # the response isn't stale

        self.check_in(metric, 5, days_ago=3)
        self.assertEqual(metric.check_in_due_at, metric.last_checked_in_at + timedelta(weeks=1))
        self.assertEqual(self.client.get("/api/v1/metrics?filter{check_in_due_at.lte}=" + (timezone.now() + timedelta(days=5)).isoformat().replace("+", "%2B")).json()["total"], 1)

        self.client.patch(f"/api/v1/metrics/{metric.id}", {"check_in_every": ""}, format="json")
        metric.refresh_from_db()
        self.assertIsNone(metric.check_in_due_at)

    def test_monthly_clamps_to_the_months_last_day(self):
        metric = Metric(check_in_every="monthly", last_checked_in_at=timezone.make_aware(timezone.datetime(2026, 1, 31, 9)))
        self.assertEqual(next_due(metric).date(), date(2026, 2, 28))


class GoalHealthRuleTests(SimpleTestCase):
    today = date(2026, 6, 1)

    def test_rules(self):
        later = date(2026, 9, 1)
        self.assertEqual(goal_health(None, None, later, self.today), GoalHealth.UNKNOWN)
        self.assertEqual(goal_health(100, None, None, self.today), GoalHealth.ACHIEVED)
        self.assertEqual(goal_health(50, None, None, self.today), GoalHealth.UNKNOWN)
        self.assertEqual(goal_health(50, 120, date(2026, 5, 1), self.today), GoalHealth.OFF_TRACK)
        self.assertEqual(goal_health(50, None, later, self.today), GoalHealth.UNKNOWN)
        self.assertEqual(goal_health(50, 100, later, self.today), GoalHealth.ON_TRACK)
        self.assertEqual(goal_health(50, 85, later, self.today), GoalHealth.AT_RISK)
        self.assertEqual(goal_health(50, 40, later, self.today), GoalHealth.OFF_TRACK)


@without_access_policy
class GoalProgressTests(ApiTestCase):
    def test_progress_projection_and_health_follow_check_ins(self):
        goal = self.goal(target_date=timezone.localdate() + timedelta(days=10))
        metric = Metric.objects.create(goal=goal, name="km", target_value=100)
        # A sub-metric doesn't count toward the goal.
        Metric.objects.create(goal=goal, name="part", target_value=10, current_value=10, parent=metric)
        self.check_in(metric, 10, days_ago=10)
        self.check_in(metric, 20)  # +10 per 10 days -> ~30 by the target date
        goal.refresh_from_db()
        self.assertEqual(goal.progress, Decimal("20.00"))
        self.assertAlmostEqual(float(goal.projected_progress), 30, delta=1)
        self.assertEqual(goal.health, GoalHealth.OFF_TRACK)

        self.check_in(metric, 100)
        goal.refresh_from_db()
        self.assertEqual(goal.health, GoalHealth.ACHIEVED)

    def test_moving_the_target_date_updates_health(self):
        # The target is the START of its day: 10-11 days away.
        goal = self.goal(target_date=timezone.localdate() + timedelta(days=11))
        metric = Metric.objects.create(goal=goal, name="km", target_value=100)
        self.check_in(metric, 0, days_ago=10)
        self.check_in(metric, 50)
        goal.refresh_from_db()
        self.assertEqual(goal.health, GoalHealth.ON_TRACK)  # 5 a day -> 100+
        response = self.client.patch(f"/api/v1/goals/{goal.id}", {"target_date": str(timezone.localdate() + timedelta(days=8))}, format="json")
        goal.refresh_from_db()
        self.assertEqual(goal.health, GoalHealth.AT_RISK)  # -> 85-90
        self.assertEqual(response.data["health"], GoalHealth.AT_RISK)

    def test_a_lapsed_goal_turns_off_track_on_the_next_job_run(self):
        goal = self.goal(target_date=timezone.localdate() - timedelta(days=1))
        Goal.objects.filter(id=goal.id).update(health=GoalHealth.ON_TRACK, progress=50)
        Metric.objects.create(goal=goal, name="km", target_value=100, current_value=50)
        with mock.patch("goalnexa.management.commands.goalnexa_jobs.send_due_reminders", return_value=0):
            self.assertEqual(run_once()["goals_refreshed"], 1)
        goal.refresh_from_db()
        self.assertEqual(goal.health, GoalHealth.OFF_TRACK)


@without_access_policy
class IngestTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.metric = Metric.objects.create(goal=self.goal(), name="km", target_value=100, aggregation="sum")
        response = self.post(f"metrics/{self.metric.id}/ingest-token")
        self.assertEqual(response.status_code, 201, response.data)
        self.token = response.data["token"]
        self.anonymous = APIClient()

    def ingest(self, data, token=None, **extra):
        headers = {"HTTP_AUTHORIZATION": f"Bearer {token or self.token}"} if token != "" else {}
        return self.anonymous.post(f"/api/v1/metrics/{self.metric.id}/ingest", data, format="json", **headers, **extra)

    def test_token_is_shown_once_and_hashed(self):
        self.metric.refresh_from_db()
        self.assertTrue(self.token.startswith("gnm_"))
        self.assertNotIn(self.token, self.metric.ingest_token_hash)
        self.assertEqual(self.metric.ingest_token_hint, self.token[-4:])
        self.assertNotIn("ingest_token_hash", self.client.get(f"/api/v1/metrics/{self.metric.id}").data)

    def test_ingest_adds_a_check_in(self):
        response = self.ingest({"value": 7, "note": "cron"})
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["current_value"], "7.00")
        self.assertEqual(CheckIn.objects.get(metric=self.metric).note, "cron")

    def test_token_in_query_and_form_body(self):
        response = self.anonymous.post(f"/api/v1/metrics/{self.metric.id}/ingest?token={self.token}", {"value": "3"})
        self.assertEqual(response.status_code, 201, response.data)

    def test_bad_missing_and_revoked_tokens_are_401(self):
        self.assertEqual(self.ingest({"value": 1}, token="gnm_wrong").status_code, 401)
        self.assertEqual(self.ingest({"value": 1}, token="").status_code, 401)
        self.assertEqual(self.client.delete(f"/api/v1/metrics/{self.metric.id}/ingest-token").status_code, 204)
        self.assertEqual(self.ingest({"value": 1}).status_code, 401)

    def test_rotating_replaces_the_old_token(self):
        new = self.post(f"metrics/{self.metric.id}/ingest-token").data["token"]
        self.assertEqual(self.ingest({"value": 1}).status_code, 401)
        self.assertEqual(self.ingest({"value": 1}, token=new).status_code, 201)

    def test_invalid_value_is_400(self):
        self.assertEqual(self.ingest({"value": "lots"}).status_code, 400)

    @override_settings(GOALNEXA_INGEST_RATE="2/min")
    def test_rate_limited_per_metric(self):
        codes = [self.ingest({"value": 1}).status_code for _ in range(3)]
        self.assertEqual(codes, [201, 201, 429])


@without_access_policy
class ReminderTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.metric = Metric.objects.create(goal=self.goal(title="Run"), name="km", target_value=100, check_in_every="daily")
        Metric.objects.filter(id=self.metric.id).update(check_in_due_at=timezone.now() - timedelta(hours=1))

    def save_settings(self, urls="json://example.com/hook", **extra):
        return self.client.put("/api/v1/reminder-settings", {"urls": urls, **extra}, format="json")

    def test_settings_validate_urls(self):
        self.assertEqual(self.save_settings("not a url").status_code, 400)
        self.assertEqual(self.save_settings("nope://x").status_code, 400)
        response = self.save_settings("json://example.com/hook\n# a comment")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.client.get("/api/v1/reminder-settings").data["urls"], "json://example.com/hook\n# a comment")

    @override_settings(GOALNEXA_REMINDER_SCHEMES=["tgram"])
    def test_settings_respect_allowed_schemes(self):
        self.assertEqual(self.save_settings("json://example.com/hook").status_code, 400)

    def test_due_metric_is_reminded_once_per_due_date(self):
        self.save_settings()
        with mock.patch("goalnexa.reminders.send", return_value=True) as send:
            self.assertEqual(run_once()["users_reminded"], 1)
            self.assertEqual(run_once()["users_reminded"], 0)
        title, body = send.call_args.args[1:]
        self.assertIn("1 check-in due", title)
        self.assertIn("Run → km", body)
        self.assertIn("/dashboard", body)

        # Checking in moves the due date; once that passes, it's reminded again.
        self.check_in(self.metric, 5, days_ago=2)
        with mock.patch("goalnexa.reminders.send", return_value=True) as send:
            self.assertEqual(run_once()["users_reminded"], 1)

    def test_no_settings_or_disabled_means_no_reminder_yet(self):
        with mock.patch("goalnexa.reminders.send", return_value=True) as send:
            run_once()
            self.save_settings(enabled=False)
            run_once()
        send.assert_not_called()
        self.metric.refresh_from_db()
        self.assertIsNone(self.metric.reminded_at)

    def test_completed_goals_are_skipped(self):
        self.save_settings()
        Goal.objects.filter(id=self.metric.goal_id).update(status="completed")
        with mock.patch("goalnexa.reminders.send", return_value=True) as send:
            run_once()
        send.assert_not_called()

    def test_test_message(self):
        self.assertEqual(self.post("reminder-settings/test").status_code, 400)
        self.save_settings()
        with mock.patch("goalnexa.views.reminders.send", return_value=True):
            self.assertEqual(self.post("reminder-settings/test").status_code, 200)
        self.assertEqual(ReminderSettings.objects.get().user_id, self.actor.id)
