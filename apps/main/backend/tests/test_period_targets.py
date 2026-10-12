"""Targets per period (docs/period-targets.md, P-54..P-58): the period math
(`goalnexa.periods`) on fixed dates, and end to end through main's stack -
the org's time zone, stored period numbers, progress and health, validation,
pace hints, team totals and the end-of-period nudge.

`python manage.py test tests.test_period_targets` in apps/main/backend.
"""

from datetime import date, datetime, timedelta
from datetime import timezone as dt_timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest import mock
from zoneinfo import ZoneInfo

from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone

from goalnexa import periods
from goalnexa.models import Goal, Metric, ReminderSettings
from goalnexa.reminders import send_due_reminders
from tests.test_tenant_isolation import API, signup

UTC = ZoneInfo("UTC")


def at(day: date, hour=12, zone=UTC) -> datetime:
    return datetime(day.year, day.month, day.day, hour, tzinfo=zone)


def fake_metric(per="day", count_days="all", base=0, target=10, progress_by="total", created=date(2026, 10, 1)):
    return SimpleNamespace(
        target_per=per, count_days=count_days, base_value=Decimal(base), target_value=Decimal(target),
        progress_by=progress_by, created_at=at(created), aggregation="sum",
    )


def fake_goal(first=date(2026, 10, 1), last=date(2026, 10, 10)):
    cycle = SimpleNamespace(starts_on=first, ends_on=last)
    return SimpleNamespace(cycle_id=1, cycle=cycle, target_date=last, org_id=None, owner_id=None)


def check_ins(*pairs):
    return [SimpleNamespace(checked_in_at=at(day), value=Decimal(value)) for day, value in pairs]


class PeriodMathTests(SimpleTestCase):
    def test_daily_quota(self):
        d = date(2026, 10, 1)
        result = periods.compute(
            fake_metric(), fake_goal(),
            check_ins((d, 10), (d + timedelta(1), 5), (d + timedelta(2), 12)),
            today=d + timedelta(2), zone=UTC,
        )
        self.assertEqual(result["period_value"], Decimal(12))
        self.assertEqual(result["cumulative_target"], Decimal(100))  # 10 days x 10
        self.assertEqual(result["expected_value"], Decimal(30))  # day 3 has begun
        self.assertEqual(result["hit_rate"], Decimal("66.67"))  # day 1 and today hit, day 2 missed
        self.assertEqual(result["streak"], 1)

    def test_current_period_counts_once_hit_or_over(self):
        d = date(2026, 10, 1)
        result = periods.compute(fake_metric(), fake_goal(), check_ins((d, 10), (d + timedelta(1), 3)),
                                 today=d + timedelta(1), zone=UTC)
        self.assertEqual((result["hit_rate"], result["streak"]), (Decimal(100), 1))  # today isn't over yet

    def test_partial_weeks_are_prorated_by_counted_days(self):
        # Wed Oct 7 -> Tue Oct 13, 5 a week on weekdays: 3/5 of week 1 + 2/5 of week 2.
        goal = fake_goal(date(2026, 10, 7), date(2026, 10, 13))
        result = periods.compute(fake_metric("week", "weekdays", target=5), goal, [], today=date(2026, 10, 7), zone=UTC)
        self.assertEqual(result["cumulative_target"], Decimal(5))
        self.assertEqual(result["expected_value"], Decimal("1.00"))  # 1 of week 1's 3 counted days begun

    def test_weekends_are_skipped(self):
        goal = fake_goal(date(2026, 10, 5), date(2026, 10, 11))  # Mon -> Sun
        metric = fake_metric("day", "weekdays")
        self.assertEqual(periods.compute(metric, goal, [], today=date(2026, 10, 9), zone=UTC)["cumulative_target"], Decimal(50))
        period, quota = periods.current_quota(metric, goal, today=date(2026, 10, 10), zone=UTC)  # Saturday
        self.assertIsNone(period)

    def test_period_starts(self):
        day = date(2026, 8, 19)  # a Wednesday
        self.assertEqual(periods.period_start(day, "week"), date(2026, 8, 17))
        self.assertEqual(periods.period_start(day, "month"), date(2026, 8, 1))
        self.assertEqual(periods.period_start(day, "quarter"), date(2026, 7, 1))
        self.assertEqual(periods.period_start(day, "year"), date(2026, 1, 1))
        self.assertEqual(periods.next_start(date(2026, 11, 1), "quarter"), date(2027, 2, 1))

    def test_days_are_counted_in_the_goal_time_zone(self):
        late = datetime(2026, 10, 2, 23, 30, tzinfo=dt_timezone.utc)  # already Oct 3 in Ho Chi Minh City
        rows = [SimpleNamespace(checked_in_at=late, value=Decimal(10))]
        zone = ZoneInfo("Asia/Ho_Chi_Minh")
        result = periods.compute(fake_metric(), fake_goal(), rows, today=date(2026, 10, 3), zone=zone)
        self.assertEqual(result["period_value"], Decimal(10))
        result = periods.compute(fake_metric(), fake_goal(), rows, today=date(2026, 10, 3), zone=UTC)
        self.assertEqual(result["period_value"], Decimal(0))

    def test_hit_rate_and_pace_percentages(self):
        metric = fake_metric(progress_by="hit_rate")
        metric.hit_rate, metric.cumulative_target = Decimal(75), Decimal(100)
        self.assertEqual(periods.pct(Decimal(10), metric), 75.0)
        metric = fake_metric()
        metric.cumulative_target, metric.expected_value, metric.current_value = Decimal(100), Decimal(40), Decimal(30)
        self.assertEqual(periods.pct(Decimal(30), metric), 30.0)
        self.assertEqual(periods.pace_pct(metric), 75.0)  # 30 done of the 40 expected so far


@override_settings(AUTH_FIRST_RUN_SETUP=False)
class PeriodTargetApiTests(TestCase):
    def setUp(self):
        self.alice = signup("Alice")
        self.org = self.ok(self.alice, "orgs", name="Acme", timezone="UTC")
        today = timezone.localdate()
        self.cycle = self.ok(self.alice, "cycles", name="Sprint", org_id=self.org["id"],
                             starts_on=str(today - timedelta(days=2)), ends_on=str(today + timedelta(days=7)))
        self.goal = self.ok(self.alice, "goals", title="Calls", org_id=self.org["id"], cycle=self.cycle["id"],
                            target_date=str(today + timedelta(days=7)))

    def ok(self, client, path, expect=201, **body):
        response = client.post(f"{API}/{path}", body, format="json")
        self.assertEqual(response.status_code, expect, response.content)
        return response.json() if response.content else None

    def metric(self, **extra):
        body = {"goal": self.goal["id"], "name": "Calls", "aggregation": "sum", "target_per": "day",
                "base_value": 0, "target_value": 10, **extra}
        return self.ok(self.alice, "metrics", **body)

    def check_in(self, metric, value, days_ago=0):
        when = timezone.now() - timedelta(days=days_ago)
        return self.ok(self.alice, "check-ins", metric=metric["id"], value=value, checked_in_at=when.isoformat())

    def test_org_time_zone_is_validated(self):
        response = self.alice.patch(f"{API}/orgs/{self.org['id']}", {"timezone": "Mars/Olympus"}, format="json")
        self.assertEqual(response.status_code, 400, response.content)
        response = self.alice.patch(f"{API}/orgs/{self.org['id']}", {"timezone": "Asia/Ho_Chi_Minh"}, format="json")
        self.assertEqual(response.json()["timezone"], "Asia/Ho_Chi_Minh")

    def test_a_quota_needs_amounts_and_hit_rate_needs_a_period(self):
        response = self.alice.post(f"{API}/metrics", {"goal": self.goal["id"], "name": "Weight", "target_value": 70,
                                                       "target_per": "day"}, format="json")
        self.assertEqual(response.status_code, 400, response.content)
        response = self.alice.post(f"{API}/metrics", {"goal": self.goal["id"], "name": "x", "aggregation": "sum",
                                                       "target_value": 5, "progress_by": "hit_rate"}, format="json")
        self.assertEqual(response.status_code, 400, response.content)

    def test_period_numbers_progress_and_pace(self):
        metric = self.metric()
        self.check_in(metric, 10, days_ago=2)
        self.check_in(metric, 4, days_ago=1)
        self.check_in(metric, 6)
        row = self.alice.get(f"{API}/metrics/{metric['id']}").json()
        self.assertEqual(row["period_value"], "6.00")
        self.assertEqual(row["cumulative_target"], "100.00")  # 10 days of the cycle
        self.assertEqual(row["expected_value"], "30.00")
        self.assertEqual(row["hit_rate"], "50.00")  # day 1 hit, day 2 missed, today not yet
        self.assertEqual(row["pace"], {"per": "day", "in_period": True, "period_label": "today", "done": 6.0,
                                       "quota": 10.0, "left": 4.0})
        goal = self.alice.get(f"{API}/goals/{self.goal['id']}").json()
        self.assertEqual(goal["progress"], "20.00")  # 20 of 100
        self.assertEqual(goal["projected_progress"], "66.67")  # 20 of the 30 expected so far
        self.assertEqual(goal["health"], "off_track")

    def test_a_perfect_hit_rate_is_not_achieved_before_the_end(self):
        metric = self.metric(progress_by="hit_rate")
        self.check_in(metric, 10, days_ago=2)  # every day of the cycle so far
        self.check_in(metric, 10, days_ago=1)
        goal = self.alice.get(f"{API}/goals/{self.goal['id']}").json()
        self.assertEqual((goal["progress"], goal["health"]), ("100.00", "on_track"))

    def test_running_total_pace_hint(self):
        metric = self.ok(self.alice, "metrics", goal=self.goal["id"], name="Units", aggregation="sum", target_value=80)
        self.check_in(metric, 24)
        pace = self.alice.get(f"{API}/metrics/{metric['id']}").json()["pace"]
        self.assertEqual((pace["left"], pace["days_left"], pace["per_day"]), (56.0, 8, 7.0))

    def test_end_of_period_nudge(self):
        metric = self.metric()
        self.check_in(metric, 4)
        ReminderSettings.objects.create(user_id=self.alice.user_id, urls="ntfy://topic", enabled=True)
        evening = timezone.now().astimezone(UTC).replace(hour=19)
        with mock.patch("goalnexa.reminders.deliver", return_value=True) as deliver:
            self.assertEqual(send_due_reminders(evening), 1)
            self.assertEqual(send_due_reminders(evening), 0)  # once per period
        title, body = deliver.call_args.args[1:3]
        self.assertIn("still short", title)
        self.assertIn("4/10 today (6 to go)", body)
        with mock.patch("goalnexa.reminders.deliver", return_value=True):
            morning = evening.replace(hour=9)
            Metric.objects.filter(id=metric["id"]).update(period_reminded_for=None)
            self.assertEqual(send_due_reminders(morning), 0)  # not before NUDGE_HOUR

    def test_template_totals_add_quotas_and_average_hit_rates(self):
        north = self.ok(self.alice, "teams", org=self.org["id"], name="North")
        south = self.ok(self.alice, "teams", org=self.org["id"], name="South")
        template = self.ok(self.alice, "goal-templates", org_id=self.org["id"], title="Daily")
        tg = self.ok(self.alice, "template-goals", template=template["id"], title="Calls")
        calls = self.ok(self.alice, "template-metrics", template_goal=tg["id"], name="Calls", aggregation="sum",
                        target_per="day", default_target=10, rollup="sum")
        streak = self.ok(self.alice, "template-metrics", template_goal=tg["id"], name="Workout", aggregation="sum",
                         target_per="day", progress_by="hit_rate", default_target=1, rollup="avg")
        bad = self.alice.post(f"{API}/template-metrics", {"template_goal": tg["id"], "name": "x", "aggregation": "sum",
                                                          "target_per": "day", "progress_by": "hit_rate", "rollup": "sum"},
                              format="json")
        self.assertEqual(bad.status_code, 400, bad.content)
        self.ok(self.alice, f"goal-templates/{template['id']}/apply", teams=[north["id"], south["id"]], cycle=self.cycle["id"])

        def instance(tm, team):
            return Metric.objects.get(template_metric_id=tm["id"], goal__team_id=team["id"], goal__is_rollup=False)

        self.assertEqual(instance(calls, north).target_per, "day")  # the template's
        self.check_in({"id": str(instance(calls, north).id)}, 7)
        self.check_in({"id": str(instance(calls, south).id)}, 5)
        self.check_in({"id": str(instance(streak, north).id)}, 1, days_ago=1)
        self.check_in({"id": str(instance(streak, south).id)}, 0, days_ago=1)
        total = Metric.objects.get(template_metric_id=calls["id"], goal__is_rollup=True, goal__team_id=None)
        self.assertEqual((total.target_value, total.period_value, total.cumulative_target),
                         (Decimal(20), Decimal(12), Decimal(200)))
        rate = Metric.objects.get(template_metric_id=streak["id"], goal__is_rollup=True, goal__team_id=None)
        # North hit 1 of the cycle's 2 ended days (50%), South none: the average.
        self.assertEqual(rate.hit_rate, Decimal(25))
        board = self.alice.get(f"{API}/goal-templates/{template['id']}/board", {"cycle": self.cycle["id"]}).json()
        self.assertEqual(board["metrics"][0]["target_per"], "day")
        self.assertEqual(board["instances"][north["id"]]["metrics"][calls["id"]]["pace"]["left"], 3.0)
        # The quota's period is the template's - locked in the team's copy.
        response = self.alice.patch(f"{API}/metrics/{instance(calls, north).id}", {"target_per": "week"}, format="json")
        self.assertEqual(response.status_code, 400, response.content)
        self.assertTrue(Goal.objects.filter(is_rollup=True).exists())


@override_settings(AUTH_FIRST_RUN_SETUP=False)
class OneReadingPerPeriodTests(TestCase):
    """P-60: `Metric.one_per` - only the last check-in of each period counts;
    earlier ones are kept and marked `replaced`."""

    def setUp(self):
        self.alice = signup("Alice")
        self.org = self.ok(self.alice, "orgs", name="Acme", timezone="UTC")
        self.goal = self.ok(self.alice, "goals", title="Walk", org_id=self.org["id"])

    def ok(self, client, path, expect=201, **body):
        response = client.post(f"{API}/{path}", body, format="json")
        self.assertEqual(response.status_code, expect, response.content)
        return response.json() if response.content else None

    def check_in(self, metric, value, when):
        return self.ok(self.alice, "check-ins", metric=metric["id"], value=value, checked_in_at=when.isoformat())

    def metric(self, **extra):
        body = {"goal": self.goal["id"], "name": "Steps", "aggregation": "sum", "one_per": "day",
                "base_value": 0, "target_value": 100000, **extra}
        return self.ok(self.alice, "metrics", **body)

    def test_a_sum_check_in_is_the_days_total_so_far(self):
        metric = self.metric()
        noon = timezone.now().astimezone(UTC).replace(hour=12, minute=0, second=0, microsecond=0) - timedelta(days=1)
        first = self.check_in(metric, 8000, noon)
        self.assertIsNone(first["replaces"])
        second = self.check_in(metric, 10500, noon + timedelta(hours=6))
        self.assertEqual(second["replaces"]["value"], "8000.00")
        self.check_in(metric, 6000, noon + timedelta(days=1))
        row = self.alice.get(f"{API}/metrics/{metric['id']}").json()
        self.assertEqual(row["current_value"], "16500.00")  # 10,500 + 6,000, not 24,500
        listed = self.alice.get(f"{API}/check-ins", {"filter{metric}": metric["id"]}).json()["items"]
        self.assertEqual(sorted((c["value"], c["replaced"]) for c in listed),
                         [("10500.00", False), ("6000.00", False), ("8000.00", True)])
        feed = self.alice.get(f"{API}/activities", {"filter{goal}": self.goal["id"]}).json()["items"]
        self.assertIn("8000", [str(a["data"].get("replaces")) for a in feed])

    def test_a_backdated_check_in_is_itself_replaced(self):
        metric = self.metric()
        evening = timezone.now().astimezone(UTC).replace(hour=18, minute=0, second=0, microsecond=0) - timedelta(days=1)
        self.check_in(metric, 9000, evening)
        late = self.check_in(metric, 3000, evening - timedelta(hours=8))
        self.assertTrue(late["replaced"])
        self.assertEqual(self.alice.get(f"{API}/metrics/{metric['id']}").json()["current_value"], "9000.00")

    def test_switching_it_recomputes_the_history(self):
        metric = self.metric(one_per="")
        noon = timezone.now().astimezone(UTC).replace(hour=12, minute=0, second=0, microsecond=0) - timedelta(days=1)
        self.check_in(metric, 8000, noon)
        self.check_in(metric, 10500, noon + timedelta(hours=1))
        self.assertEqual(self.alice.get(f"{API}/metrics/{metric['id']}").json()["current_value"], "18500.00")
        row = self.alice.patch(f"{API}/metrics/{metric['id']}", {"one_per": "day"}, format="json").json()
        self.assertEqual(row["current_value"], "10500.00")
        row = self.alice.patch(f"{API}/metrics/{metric['id']}", {"one_per": ""}, format="json").json()
        self.assertEqual(row["current_value"], "18500.00")
        self.assertFalse(any(c["replaced"] for c in self.alice.get(f"{API}/check-ins").json()["items"]))

    def test_daily_quota_counts_each_days_last_reading(self):
        today = timezone.localdate()
        goal = self.ok(self.alice, "goals", title="Calls", org_id=self.org["id"],
                       target_date=str(today + timedelta(days=5)))
        metric = self.ok(self.alice, "metrics", goal=goal["id"], name="Calls", aggregation="sum", target_value=10,
                         target_per="day", one_per="day")
        now = timezone.now()
        self.check_in(metric, 6, now - timedelta(minutes=2))
        self.check_in(metric, 11, now - timedelta(minutes=1))
        row = self.alice.get(f"{API}/metrics/{metric['id']}").json()
        self.assertEqual((row["period_value"], row["pace"]["left"]), ("11.00", 0.0))

    def test_it_cant_be_longer_than_the_target_period(self):
        response = self.alice.post(f"{API}/metrics", {"goal": self.goal["id"], "name": "x", "aggregation": "sum",
                                                       "target_value": 10, "target_per": "day", "one_per": "week"},
                                   format="json")
        self.assertEqual(response.status_code, 400, response.content)
        self.assertIn("one_per", response.json()["field_errors"])

    def test_a_reading_metric_keeps_its_latest_value(self):
        metric = self.metric(aggregation="latest", target_value=70, base_value=80, name="Weight")
        noon = timezone.now().astimezone(UTC).replace(hour=12, minute=0, second=0, microsecond=0) - timedelta(days=1)
        self.check_in(metric, 79, noon)
        self.check_in(metric, 78.5, noon + timedelta(hours=2))
        self.assertEqual(self.alice.get(f"{API}/metrics/{metric['id']}").json()["current_value"], "78.50")

    def test_templates_carry_it_locked(self):
        team = self.ok(self.alice, "teams", org=self.org["id"], name="North")
        template = self.ok(self.alice, "goal-templates", org_id=self.org["id"], title="Daily")
        tg = self.ok(self.alice, "template-goals", template=template["id"], title="Walk")
        tm = self.ok(self.alice, "template-metrics", template_goal=tg["id"], name="Steps", aggregation="sum",
                     one_per="day", default_target=100000)
        self.ok(self.alice, f"goal-templates/{template['id']}/apply", teams=[team["id"]])
        copy = Metric.objects.get(template_metric_id=tm["id"], goal__is_rollup=False)
        total = Metric.objects.get(template_metric_id=tm["id"], goal__is_rollup=True, goal__team_id=None)
        self.assertEqual((copy.one_per, total.one_per), ("day", ""))
        response = self.alice.patch(f"{API}/metrics/{copy.id}", {"one_per": ""}, format="json")
        self.assertEqual(response.status_code, 400, response.content)


@override_settings(AUTH_FIRST_RUN_SETUP=False)
class BoardShowByTests(TestCase):
    """The team board's "Show by" (`board?show=&at=`): each cell's numbers in
    one period, and the totals combined from the teams'."""

    def setUp(self):
        self.alice = signup("Alice")
        self.org = self.ok(self.alice, "orgs", name="Acme", timezone="UTC")

    def ok(self, client, path, expect=201, **body):
        response = client.post(f"{API}/{path}", body, format="json")
        self.assertEqual(response.status_code, expect, response.content)
        return response.json() if response.content else None

    def test_cells_and_totals_in_a_period(self):
        north = self.ok(self.alice, "teams", org=self.org["id"], name="North")
        south = self.ok(self.alice, "teams", org=self.org["id"], name="South")
        template = self.ok(self.alice, "goal-templates", org_id=self.org["id"], title="Sales")
        tg = self.ok(self.alice, "template-goals", template=template["id"], title="Sell")
        calls = self.ok(self.alice, "template-metrics", template_goal=tg["id"], name="Calls", aggregation="sum",
                        target_per="day", default_target=10, rollup="sum")
        mrr = self.ok(self.alice, "template-metrics", template_goal=tg["id"], name="MRR", default_target=1000, rollup="sum")
        self.ok(self.alice, f"goal-templates/{template['id']}/apply", teams=[north["id"], south["id"]])

        def metric(tm, team):
            return str(Metric.objects.get(template_metric_id=tm["id"], goal__team_id=team["id"], goal__is_rollup=False).id)

        noon = timezone.now().astimezone(UTC).replace(hour=12, minute=0, second=0, microsecond=0)
        yesterday = noon - timedelta(days=1)
        for metric_id, value, when in [
            (metric(calls, north), 6, yesterday), (metric(calls, north), 4, noon), (metric(calls, south), 7, yesterday),
            (metric(mrr, north), 500, yesterday), (metric(mrr, north), 650, noon),
        ]:
            self.ok(self.alice, "check-ins", metric=metric_id, value=value, checked_in_at=when.isoformat())

        def board(**params):
            response = self.alice.get(f"{API}/goal-templates/{template['id']}/board", params)
            self.assertEqual(response.status_code, 200, response.content)
            return response.json()

        data = board(show="day", at=yesterday.isoformat())
        cell = data["instances"][north["id"]]["metrics"][calls["id"]]["shown"]
        self.assertEqual((cell["value"], cell["quota"], cell["start"]), (6.0, 10.0, yesterday.date().isoformat()))
        self.assertEqual(data["instances"][north["id"]]["metrics"][mrr["id"]]["shown"]["value"], 500.0)  # as of then
        total = data["totals"]["org"]["metrics"][calls["id"]]["shown"]
        self.assertEqual((total["value"], total["quota"]), (13.0, 20.0))
        today = board(show="day")["instances"][north["id"]]["metrics"]
        self.assertEqual((today[calls["id"]]["shown"]["value"], today[mrr["id"]]["shown"]["value"]), (4.0, 650.0))
        self.assertNotIn("shown", board()["instances"][north["id"]]["metrics"][calls["id"]])
        self.assertEqual(self.alice.get(f"{API}/goal-templates/{template['id']}/board", {"show": "fortnight"}).status_code, 400)
        # "Last update": each team's latest check-in on the picked day; totals count the teams updated.
        data = board(at=yesterday.isoformat())
        north_update = data["instances"][north["id"]]["last_update"][tg["id"]]
        self.assertEqual(north_update["on_day"][:13], (yesterday + timedelta(minutes=0)).strftime("%Y-%m-%dT%H"))
        self.assertEqual(data["totals"]["org"]["updated"][tg["id"]], {"teams": 2, "updated": 2})
        today_board = board()
        self.assertIsNone(today_board["instances"][south["id"]]["last_update"][tg["id"]]["on_day"])  # South: yesterday only
        self.assertEqual(today_board["totals"]["org"]["updated"][tg["id"]], {"teams": 2, "updated": 1})


@override_settings(AUTH_FIRST_RUN_SETUP=False)
class SnapToTests(TestCase):
    """P-63: `Metric.snap_to` - a check-in is for a whole period; its time is
    snapped to the period's first day (00:00, the goal's zone) from every source."""

    def setUp(self):
        self.alice = signup("Alice")
        self.org = self.ok(self.alice, "orgs", name="Acme", timezone="Asia/Ho_Chi_Minh")
        self.goal = self.ok(self.alice, "goals", title="Sales", org_id=self.org["id"])

    def ok(self, client, path, expect=201, **body):
        response = client.post(f"{API}/{path}", body, format="json")
        self.assertEqual(response.status_code, expect, response.content)
        return response.json() if response.content else None

    def test_check_ins_snap_to_the_period_start_in_the_org_zone(self):
        metric = self.ok(self.alice, "metrics", goal=self.goal["id"], name="Revenue", aggregation="sum",
                         target_value=1000, snap_to="week")
        # Thu Oct 8 2026, 20:00 UTC = Fri Oct 9 03:00 in Ho Chi Minh City -> week of Mon Oct 5 there.
        row = self.ok(self.alice, "check-ins", metric=metric["id"], value=10,
                      checked_in_at="2026-10-08T20:00:00Z")
        self.assertEqual(row["checked_in_at"], "2026-10-04T17:00:00Z")  # Oct 5 00:00 +07:00
        bulk = self.ok(self.alice, "check-ins/bulk", items=[{"metric": metric["id"], "value": 5,
                                                              "checked_in_at": "2026-10-11T10:00:00+07:00"}])
        self.assertEqual(bulk[0]["checked_in_at"], "2026-10-04T17:00:00Z")

    def test_changing_it_moves_existing_check_ins(self):
        metric = self.ok(self.alice, "metrics", goal=self.goal["id"], name="Revenue", aggregation="sum", target_value=1000)
        self.ok(self.alice, "check-ins", metric=metric["id"], value=10, checked_in_at="2026-10-14T09:30:00+07:00")
        self.alice.patch(f"{API}/metrics/{metric['id']}", {"snap_to": "month"}, format="json")
        row = self.alice.get(f"{API}/check-ins", {"filter{metric}": metric["id"]}).json()["items"][0]
        self.assertEqual(row["checked_in_at"], "2026-09-30T17:00:00Z")  # Oct 1 00:00 +07:00

    def test_it_cant_be_longer_than_the_target_or_one_reading_period(self):
        for extra in ({"target_per": "day", "snap_to": "week"}, {"one_per": "week", "snap_to": "month"}):
            response = self.alice.post(f"{API}/metrics", {"goal": self.goal["id"], "name": "x", "aggregation": "sum",
                                                           "target_value": 10, **extra}, format="json")
            self.assertEqual(response.status_code, 400, response.content)
            self.assertIn("snap_to", response.json()["field_errors"])

    def test_with_one_reading_per_week_a_second_check_in_replaces_the_first(self):
        metric = self.ok(self.alice, "metrics", goal=self.goal["id"], name="Revenue", aggregation="sum",
                         target_value=1000, snap_to="week", one_per="week")
        self.ok(self.alice, "check-ins", metric=metric["id"], value=300, checked_in_at="2026-10-06T09:00:00+07:00")
        second = self.ok(self.alice, "check-ins", metric=metric["id"], value=450, checked_in_at="2026-10-08T09:00:00+07:00")
        self.assertEqual(second["replaces"]["value"], "300.00")  # same snapped time: the later saved wins
        self.assertEqual(self.alice.get(f"{API}/metrics/{metric['id']}").json()["current_value"], "450.00")
