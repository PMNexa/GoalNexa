import uuid
from datetime import date, timedelta
from datetime import timezone as dt_timezone
from decimal import Decimal
from unittest import mock

from django.core.cache import cache
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient, APIRequestFactory, force_authenticate

from goalnexa.management.commands.goalnexa_jobs import run_once
from goalnexa.digest import compose, is_due, send_due_digests, snapshot_goals
from goalnexa.models import (
    Activity,
    CheckIn,
    Cycle,
    Goal,
    GoalComment,
    GoalHealth,
    GoalScore,
    GoalSnapshot,
    Metric,
    ReminderSettings,
)
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
        # Digest off: these tests are about reminders (DigestTests has its own).
        return self.client.put("/api/v1/reminder-settings", {"urls": urls, "digest": "off", **extra}, format="json")

    def test_settings_validate_urls(self):
        self.assertEqual(self.save_settings("not a url").status_code, 400)
        self.assertEqual(self.save_settings("nope://x").status_code, 400)
        response = self.save_settings("json://example.com/hook\n# a comment")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.client.get("/api/v1/reminder-settings").data["urls"], "json://example.com/hook\n# a comment")

    @override_settings(SYSTEM_SETTING_DEFAULTS={"reminders.allowed_schemes": ["tgram"]})
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
        with mock.patch("goalnexa.reminders.send", return_value=True):
            self.assertEqual(self.post("reminder-settings/test").status_code, 200)
        self.assertEqual(ReminderSettings.objects.get().user_id, self.actor.id)


@without_access_policy
class AttributionAndFeedTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.goal_row = self.goal(title="Run")
        self.metric = Metric.objects.create(goal=self.goal_row, name="km", target_value=100, aggregation="sum")

    def verbs(self):
        return list(Activity.objects.filter(goal=self.goal_row).order_by("created_at").values_list("verb", flat=True))

    def test_web_check_in_records_author_source_and_feed(self):
        response = self.check_in(self.metric, 5)
        self.assertEqual(response.data["source"], "web")
        self.assertEqual(str(response.data["author_id"]), str(self.actor.id))
        activity = Activity.objects.get(goal=self.goal_row, verb="checked_in")
        self.assertEqual(activity.data["metric_name"], "km")
        self.assertEqual(activity.data["value"], "5")
        self.assertTrue(activity.data["adds"])

    def test_source_and_author_cant_be_set_by_the_caller(self):
        response = self.post("check-ins", {"metric": str(self.metric.id), "value": 1, "source": "ingest", "author_id": str(uuid.uuid4())})
        self.assertEqual(response.data["source"], "web")
        self.assertEqual(str(response.data["author_id"]), str(self.actor.id))

    def test_ingest_check_in_is_attributed_to_ingest(self):
        token = self.post(f"metrics/{self.metric.id}/ingest-token").data["token"]
        APIClient().post(f"/api/v1/metrics/{self.metric.id}/ingest", {"value": 2}, format="json", HTTP_AUTHORIZATION=f"Bearer {token}")
        check_in = CheckIn.objects.get(metric=self.metric)
        self.assertEqual((check_in.source, check_in.author_id), ("ingest", None))
        self.assertIsNone(Activity.objects.get(verb="checked_in").actor_id)

    def test_metric_and_goal_changes_and_health_go_in_the_feed(self):
        self.client.patch(f"/api/v1/metrics/{self.metric.id}", {"target_value": 80}, format="json")
        change = Activity.objects.get(verb="metric_changed")
        self.assertEqual(change.data["changes"], {"target_value": ["100", "80"]})
        self.client.patch(f"/api/v1/metrics/{self.metric.id}", {"name": "km"}, format="json")  # no change, no row
        self.assertEqual(Activity.objects.filter(verb="metric_changed").count(), 1)
        self.check_in(self.metric, 80)
        self.assertIn("health_changed", self.verbs())  # -> achieved
        self.client.patch(f"/api/v1/goals/{self.goal_row.id}", {"status": "in_progress"}, format="json")
        self.assertEqual(Activity.objects.get(verb="goal_changed").data["changes"]["status"], ["not_started", "in_progress"])

    def test_feed_is_listed_newest_first(self):
        self.check_in(self.metric, 1)
        self.post("goal-comments", {"goal": str(self.goal_row.id), "body": "Nice"})
        items = self.client.get(f"/api/v1/activities?filter{{goal}}={self.goal_row.id}").json()["items"]
        self.assertEqual([i["verb"] for i in items][:2], ["commented", "checked_in"])


@without_access_policy
class CommentTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.goal_row = self.goal()
        self.metric = Metric.objects.create(goal=self.goal_row, name="km", target_value=100)

    def test_comment_on_a_goal_and_its_check_in(self):
        check_in_id = self.check_in(self.metric, 3).data["id"]
        response = self.post("goal-comments", {"goal": str(self.goal_row.id), "body": "Good run", "check_in": check_in_id})
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(str(response.data["author_id"]), str(self.actor.id))
        other_goal = self.goal(title="Other")
        other_metric = Metric.objects.create(goal=other_goal, name="x", target_value=1)
        foreign = self.check_in(other_metric, 1).data["id"]
        self.assertEqual(self.post("goal-comments", {"goal": str(self.goal_row.id), "body": "x", "check_in": foreign}).status_code, 404)
        self.assertEqual(self.post("goal-comments", {"goal": str(self.goal_row.id), "body": "  "}).status_code, 400)

    def test_only_the_author_edits_or_deletes(self):
        comment = GoalComment.objects.create(goal=self.goal_row, author_id=uuid.uuid4(), body="Theirs")
        self.assertEqual(self.client.patch(f"/api/v1/goal-comments/{comment.id}", {"body": "Mine"}, format="json").status_code, 403)
        self.assertEqual(self.client.delete(f"/api/v1/goal-comments/{comment.id}").status_code, 403)
        mine = self.post("goal-comments", {"goal": str(self.goal_row.id), "body": "Mine"}).data["id"]
        self.assertEqual(self.client.patch(f"/api/v1/goal-comments/{mine}", {"body": "Edited"}, format="json").status_code, 200)
        self.assertEqual(GoalComment.objects.get(id=mine).goal_id, self.goal_row.id)
        self.assertEqual(self.client.delete(f"/api/v1/goal-comments/{mine}").status_code, 204)


@without_access_policy
class CycleTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        today = timezone.localdate()
        self.q1 = self.post("cycles", {"name": "Q1", "starts_on": str(today - timedelta(days=80)), "ends_on": str(today + timedelta(days=10))}).data
        self.q2 = self.post("cycles", {"name": "Q2", "starts_on": str(today + timedelta(days=11)), "ends_on": str(today + timedelta(days=100)), "status": "planning"}).data

    def goal_in_q1(self, title, progress_value, aggregation="latest"):
        response = self.post("goals", {"title": title, "cycle": self.q1["id"]})
        self.assertEqual(response.status_code, 201, response.data)
        goal = Goal.objects.get(id=response.data["id"])
        metric = Metric.objects.create(goal=goal, name="m", base_value=10, target_value=110, aggregation=aggregation)
        self.check_in(metric, progress_value)
        goal.refresh_from_db()
        return goal

    def close(self, **body):
        return self.post(f"cycles/{self.q1['id']}/close", body)

    def test_create_validates_dates_and_status(self):
        today = str(timezone.localdate())
        self.assertEqual(self.post("cycles", {"name": "Bad", "starts_on": today, "ends_on": "2000-01-01"}).status_code, 400)
        self.assertEqual(self.post("cycles", {"name": "Bad", "starts_on": today, "ends_on": today, "status": "closed"}).status_code, 400)

    def test_close_scores_and_ends_every_goal(self):
        done = self.goal_in_q1("Done", 90)  # 80%
        rolled = self.goal_in_q1("Rolled", 40)  # 30%
        dropped = self.goal_in_q1("Dropped", 20)
        response = self.close(
            decisions=[
                {"goal": str(rolled.id), "action": "rollover", "score": 0.5, "reflection": "Slow start"},
                {"goal": str(dropped.id), "action": "drop"},
            ],
            next_cycle=self.q2["id"],
            retro="Hiring took longer",
        )
        self.assertEqual(response.status_code, 200, response.data)
        scores = {s.goal_id: s for s in GoalScore.objects.all()}
        self.assertEqual((scores[done.id].score, scores[done.id].outcome), (Decimal("0.80"), "achieved"))
        self.assertEqual((scores[rolled.id].score, scores[rolled.id].outcome), (Decimal("0.50"), "partial"))
        self.assertEqual(scores[dropped.id].outcome, "dropped")
        self.assertEqual(scores[rolled.id].reflection, "Slow start")
        statuses = dict(Goal.objects.filter(id__in=[done.id, rolled.id, dropped.id]).values_list("id", "status"))
        self.assertEqual(statuses, {done.id: "completed", rolled.id: "completed", dropped.id: "archived"})
        cycle = Cycle.objects.get(id=self.q1["id"])
        self.assertEqual((cycle.status, cycle.retro), ("closed", "Hiring took longer"))

        copy = scores[rolled.id].rolled_to
        self.assertEqual((copy.title, str(copy.cycle_id), copy.status), ("Rolled", self.q2["id"], "not_started"))
        self.assertEqual(copy.metrics.get().base_value, Decimal("40"))  # a reading starts where it ended
        self.assertEqual(copy.metrics.get().current_value, Decimal("40"))

    def test_rolled_over_sum_metric_starts_a_new_period(self):
        goal = self.goal_in_q1("Km", 30, aggregation="sum")
        self.close(decisions=[{"goal": str(goal.id), "action": "rollover"}], next_cycle=self.q2["id"])
        self.assertEqual(GoalScore.objects.get().rolled_to.metrics.get().base_value, Decimal("10"))

    def test_close_validation(self):
        goal = self.goal_in_q1("G", 50)
        self.assertEqual(self.close(decisions=[{"goal": str(goal.id), "action": "rollover"}]).status_code, 400)
        self.assertEqual(self.close(decisions=[{"goal": str(goal.id), "score": 1.5}]).status_code, 400)
        self.assertEqual(self.close(decisions=[{"goal": str(uuid.uuid4())}]).status_code, 400)
        self.assertEqual(self.close(next_cycle=self.q1["id"]).status_code, 400)
        self.assertFalse(GoalScore.objects.exists())

    def test_closed_cycle_is_read_only(self):
        self.close()
        self.assertEqual(self.close().status_code, 400)
        self.assertEqual(self.client.patch(f"/api/v1/cycles/{self.q1['id']}", {"name": "X"}, format="json").status_code, 400)
        self.assertEqual(self.post("goals", {"title": "Late", "cycle": self.q1["id"]}).status_code, 400)

    def test_goal_and_cycle_must_share_an_org(self):
        org_cycle = Cycle.objects.create(name="Org Q1", owner_id=self.actor.id, org_id=uuid.uuid4(), starts_on=timezone.localdate(), ends_on=timezone.localdate())
        # Invisible (not a member of that org) - or, when visible, another org's.
        self.assertIn(self.post("goals", {"title": "G", "cycle": str(org_cycle.id)}).status_code, (400, 404))


@without_access_policy
class DigestTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.goal_row = self.goal(title="Revenue", target_date=timezone.localdate() + timedelta(days=30))
        self.metric = Metric.objects.create(goal=self.goal_row, name="MRR", target_value=100, check_in_every="daily")
        self.settings = ReminderSettings.objects.create(user_id=self.actor.id, urls="json://example.com/hook", digest="weekly", digest_weekday=0, digest_hour=8, timezone="Asia/Ho_Chi_Minh")

    def test_is_due_on_the_users_local_day_and_hour(self):
        monday_9_local = timezone.datetime(2026, 10, 5, 2, 0, tzinfo=dt_timezone.utc)  # 09:00 in Ho Chi Minh
        self.assertTrue(is_due(self.settings, monday_9_local))
        self.assertFalse(is_due(self.settings, monday_9_local - timedelta(hours=2)))  # 07:00 local
        self.assertFalse(is_due(self.settings, monday_9_local + timedelta(days=1)))  # Tuesday
        self.settings.last_digest_at = monday_9_local - timedelta(hours=1)
        self.assertFalse(is_due(self.settings, monday_9_local))  # already sent today
        self.settings.digest = "daily"
        self.assertTrue(is_due(self.settings, monday_9_local + timedelta(days=1)))

    def test_compose_reports_movement_attention_and_due(self):
        GoalSnapshot.objects.create(goal=self.goal_row, date=timezone.localdate() - timedelta(days=8), progress=10)
        self.check_in(self.metric, 5, days_ago=10)
        self.check_in(self.metric, 30, days_ago=5)
        Metric.objects.filter(id=self.metric.id).update(check_in_due_at=timezone.now() - timedelta(hours=1))
        self.goal(title="Done already", status="completed")
        title, body = compose(self.actor.id, "weekly", timezone.now(), "https://app.example")
        self.assertIn("1 goal", title)
        self.assertIn("Revenue: 10% → 30% (+20)", body)
        self.assertIn("Check-ins due:\n- Revenue → MRR", body)
        self.assertIn("https://app.example/dashboard", body)
        self.assertNotIn("Done already", body)

    def test_no_goals_no_digest(self):
        self.assertIsNone(compose(uuid.uuid4(), "weekly", timezone.now()))

    def test_sent_once_per_period(self):
        now = timezone.datetime(2026, 10, 5, 2, 0, tzinfo=dt_timezone.utc)
        with mock.patch("goalnexa.reminders.send", return_value=True) as send:
            self.assertEqual(send_due_digests(now), 1)
            self.assertEqual(send_due_digests(now + timedelta(hours=1)), 0)
        self.assertIn("weekly digest", send.call_args.args[1])

    def test_snapshots_once_a_day(self):
        today = timezone.localdate()
        self.assertEqual(snapshot_goals(today), 1)
        self.assertEqual(snapshot_goals(today), 0)
        self.assertEqual(snapshot_goals(today + timedelta(days=1)), 1)

    def test_settings_api_takes_digest_fields(self):
        response = self.client.put("/api/v1/reminder-settings", {"urls": "json://example.com/h", "digest": "daily", "digest_hour": 7, "timezone": "Europe/Berlin"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual((response.data["digest"], response.data["digest_hour"], response.data["timezone"]), ("daily", 7, "Europe/Berlin"))
        for bad in ({"digest": "hourly"}, {"digest_hour": 24}, {"timezone": "Mars/Base"}):
            self.assertEqual(self.client.put("/api/v1/reminder-settings", {"urls": "", **bad}, format="json").status_code, 400)
