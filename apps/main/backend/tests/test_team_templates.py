"""Teams, goal templates, team totals, the team board and team visibility
(docs/team-templates.md, P-48..P-53) end to end, through main's real stack
like test_tenant_isolation.py.

The org: Alice owns it. Sales (a department) has two teams, North and
South. Dave leads North, Erin is in South, Frank is in no team, Bob is a
stranger.

`python manage.py test tests.test_team_templates` in apps/main/backend.
"""

from decimal import Decimal

from django.test import TestCase, override_settings

from goalnexa.models import CheckIn, Goal, GoalStatus, Metric
from tests.test_tenant_isolation import API, ids, signup


@override_settings(AUTH_FIRST_RUN_SETUP=False)
class TeamSetup(TestCase):
    def setUp(self):
        self.alice = signup("Alice")
        self.dave = signup("Dave")
        self.erin = signup("Erin")
        self.frank = signup("Frank")
        self.bob = signup("Bob")
        self.org = self.ok(self.alice, "orgs", name="Acme")
        for client in (self.dave, self.erin, self.frank):
            self.join(client)
        self.sales = self.ok(self.alice, "teams", org=self.org["id"], name="Sales")
        self.north = self.ok(self.alice, "teams", org=self.org["id"], name="North", parent=self.sales["id"])
        self.south = self.ok(self.alice, "teams", org=self.org["id"], name="South", parent=self.sales["id"])
        self.ok(self.alice, "team-members", team=self.north["id"], user_id=self.dave.user_id, role="lead")
        self.ok(self.alice, "team-members", team=self.south["id"], user_id=self.erin.user_id)
        self.cycle = self.ok(self.alice, "cycles", name="Q4", org_id=self.org["id"], starts_on="2026-10-01", ends_on="2026-12-31")

        self.template = self.ok(self.alice, "goal-templates", org_id=self.org["id"], title="Sales targets")
        self.revenue_goal = self.ok(self.alice, "template-goals", template=self.template["id"], title="Grow revenue")
        self.hiring_goal = self.ok(self.alice, "template-goals", template=self.template["id"], title="Hiring", parent=self.revenue_goal["id"])
        self.mrr = self.ok(self.alice, "template-metrics", template_goal=self.revenue_goal["id"], name="MRR", unit="$",
                           rollup="sum", default_base=0, default_target=100)
        self.nps = self.ok(self.alice, "template-metrics", template_goal=self.revenue_goal["id"], name="NPS",
                           rollup="avg", default_base=0, default_target=50)
        self.hires = self.ok(self.alice, "template-metrics", template_goal=self.hiring_goal["id"], name="Hires",
                             aggregation="sum", rollup="min", default_base=0)
        # Sales' total is calculated only when ticked; most tests want it.
        self.ok(self.alice, f"goal-templates/{self.template['id']}/totals", expect=200, total_for=["org", self.sales["id"]])

    # --- helpers ---------------------------------------------------------

    def post(self, client, path, **body):
        return client.post(f"{API}/{path}", body, format="json")

    def ok(self, client, path, expect=201, **body):
        response = self.post(client, path, **body)
        self.assertEqual(response.status_code, expect, response.content)
        return response.json() if response.content else None

    def join(self, client):
        email = client.get(f"{API}/auth/me").json()["email"]
        token = self.ok(self.alice, "org-invitations", org=self.org["id"], email=email)["token"]
        self.assertEqual(self.post(client, f"org-invitations/token/{token}/accept").status_code, 200)

    def apply(self, *teams, by=None, cycle=None):
        return self.ok(by or self.alice, f"goal-templates/{self.template['id']}/apply",
                       teams=[t["id"] for t in teams], cycle=cycle or self.cycle["id"])

    def tick_totals(self, *nodes, by=None, expect=200):
        return self.ok(by or self.alice, f"goal-templates/{self.template['id']}/totals", expect=expect, total_for=list(nodes))

    def instance_metric(self, team, template_metric):
        return Metric.objects.get(template_metric_id=template_metric["id"], goal__team_id=team["id"], goal__is_rollup=False,
                                  goal__cycle_id=self.cycle["id"], goal__assignee_id__isnull=True)

    def total(self, template_metric, team=None):
        return Metric.objects.get(template_metric_id=template_metric["id"], goal__is_rollup=True,
                                  goal__team_id=team["id"] if team else None, goal__cycle_id=self.cycle["id"])

    def check_in(self, client, metric, value, status=201):
        response = self.post(client, "check-ins", metric=str(metric.id), value=value)
        self.assertEqual(response.status_code, status, response.content)
        return response

    def set_target(self, client, metric, target, status=204, **extra):
        response = self.post(client, f"goal-templates/{self.template['id']}/targets",
                             items=[{"metric": str(metric.id), "target_value": target, **extra}])
        self.assertEqual(response.status_code, status, response.content)

    def client_patch(self, client, path, **body):
        return client.patch(f"{API}/{path}", body, format="json")


class TeamTemplateTests(TeamSetup):
    # --- teams -------------------------------------------------------------

    def test_only_org_managers_change_teams(self):
        self.assertEqual(self.post(self.dave, "teams", org=self.org["id"], name="Ops").status_code, 403)
        self.assertEqual(self.post(self.bob, "teams", org=self.org["id"], name="Ops").status_code, 404)
        self.assertEqual(self.client_patch(self.dave, f"teams/{self.north['id']}", name="N").status_code, 403)
        # Every org member sees the tree; a stranger doesn't.
        self.assertEqual(ids(self.frank.get(f"{API}/teams")), {self.sales["id"], self.north["id"], self.south["id"]})
        self.assertEqual(ids(self.bob.get(f"{API}/teams")), set())

    def test_team_cannot_be_under_itself(self):
        response = self.client_patch(self.alice, f"teams/{self.sales['id']}", parent=self.north["id"])
        self.assertEqual(response.status_code, 400, response.content)

    def test_team_members_must_be_in_the_org(self):
        response = self.post(self.alice, "team-members", team=self.north["id"], user_id=self.bob.user_id)
        self.assertEqual(response.status_code, 400, response.content)
        rows = self.alice.get(f"{API}/team-members", {"filter{team}": self.north["id"]}).json()["items"]
        self.assertEqual([(r["name"], r["role"]) for r in rows], [("Dave", "lead")])

    def test_leaving_the_org_leaves_its_teams(self):
        membership = next(m for m in self.erin.get(f"{API}/org-members").json()["items"] if m["is_me"])
        self.assertEqual(self.erin.delete(f"{API}/org-members/{membership['id']}").status_code, 204)
        self.assertEqual(self.alice.get(f"{API}/team-members", {"filter{team}": self.south["id"]}).json()["items"], [])

    def test_deleting_a_team_moves_its_sub_teams_and_goals_up(self):
        self.apply(self.north)
        self.assertEqual(self.alice.delete(f"{API}/teams/{self.north['id']}").status_code, 204)
        roots = Goal.objects.filter(template_goal_id=self.revenue_goal["id"], is_rollup=False)
        self.assertEqual([str(g.team_id) for g in roots], [self.sales["id"]])
        self.assertEqual(self.total(self.mrr, self.sales).goal.team_id is not None, True)

    def test_deleting_a_team_can_archive_its_goals(self):
        self.apply(self.north)
        self.assertEqual(self.alice.delete(f"{API}/teams/{self.north['id']}?instances=archive").status_code, 204)
        goal = Goal.objects.get(title="Grow revenue", is_rollup=False)
        self.assertEqual((goal.status, goal.template_goal_id), (GoalStatus.ARCHIVED, None))

    # --- templates -----------------------------------------------------------

    def test_only_org_managers_change_templates(self):
        self.assertEqual(self.post(self.dave, "goal-templates", org_id=self.org["id"], title="X").status_code, 403)
        self.assertEqual(self.post(self.dave, "template-goals", template=self.template["id"], title="X").status_code, 403)
        self.assertEqual(self.post(self.dave, f"goal-templates/{self.template['id']}/apply",
                                   teams=[self.north["id"]]).status_code, 403)
        # A stranger can't even see it.
        self.assertEqual(self.bob.get(f"{API}/goal-templates/{self.template['id']}").status_code, 404)
        self.assertEqual(self.post(self.bob, f"goal-templates/{self.template['id']}/apply",
                                   teams=[self.north["id"]]).status_code, 404)

    def test_apply_creates_one_instance_per_team(self):
        created = self.apply(self.north, self.south)
        self.assertEqual(len(created["goals"]), 2)
        self.apply(self.north)  # already has one: skipped
        roots = Goal.objects.filter(template_goal_id=self.revenue_goal["id"], is_rollup=False)
        self.assertEqual(roots.count(), 2)
        north = self.instance_metric(self.north, self.mrr)
        self.assertEqual((north.name, north.unit, north.target_value), ("MRR", "$", Decimal(100)))
        # The team's lead owns its instance; Hiring is a sub-goal of it.
        self.assertEqual(str(north.goal.owner_id), self.dave.user_id)
        hiring = Goal.objects.get(template_goal_id=self.hiring_goal["id"], team_id=self.north["id"], is_rollup=False)
        self.assertEqual(hiring.parent_id, north.goal_id)
        # Hires has no default target: tracked only until the team sets one.
        hires = self.instance_metric(self.north, self.hires)
        self.assertEqual(hires.target_value, hires.base_value)

    def test_apply_rejects_a_team_of_another_org(self):
        other = self.ok(self.bob, "orgs", name="Bob Co")
        team = self.ok(self.bob, "teams", org=other["id"], name="Elsewhere")
        response = self.post(self.alice, f"goal-templates/{self.template['id']}/apply", teams=[team["id"]])
        self.assertEqual(response.status_code, 400, response.content)

    def test_template_fields_are_locked_in_instances(self):
        self.apply(self.north)
        metric = self.instance_metric(self.north, self.mrr)
        self.assertEqual(self.client_patch(self.alice, f"metrics/{metric.id}", name="Money").status_code, 400)
        self.assertEqual(self.client_patch(self.alice, f"goals/{metric.goal_id}", title="Other").status_code, 400)
        self.assertEqual(self.alice.delete(f"{API}/metrics/{metric.id}").status_code, 400)
        # The team's numbers are its own: its lead sets the target.
        self.assertEqual(self.client_patch(self.dave, f"metrics/{metric.id}", target_value=150).status_code, 200)
        # A local metric is the team's to add.
        self.ok(self.dave, "metrics", goal=str(metric.goal_id), name="Demos", target_value=10)

    def test_only_the_team_sets_its_targets(self):
        self.apply(self.north, self.south)
        north = self.instance_metric(self.north, self.mrr)
        self.set_target(self.dave, north, 120)
        self.set_target(self.erin, north, 999, status=403)  # another team's member
        self.set_target(self.frank, north, 999, status=403)
        self.assertEqual(self.client_patch(self.frank, f"metrics/{north.id}", target_value=1).status_code, 403)
        north.refresh_from_db()
        self.assertEqual(north.target_value, Decimal(120))

    def test_only_the_team_checks_in(self):
        self.apply(self.north, self.south)
        north = self.instance_metric(self.north, self.mrr)
        self.check_in(self.dave, north, 10)
        self.check_in(self.erin, north, 10, status=403)
        self.check_in(self.alice, north, 10)  # org owner

    def test_template_changes_are_pushed(self):
        self.apply(self.north, self.south)
        self.client_patch(self.alice, f"template-metrics/{self.mrr['id']}", name="Monthly revenue", unit="€")
        self.assertEqual(set(Metric.objects.filter(template_metric_id=self.mrr["id"]).values_list("name", "unit")),
                         {("Monthly revenue", "€")})
        deals = self.ok(self.alice, "template-metrics", template_goal=self.revenue_goal["id"], name="Deals", rollup="sum")
        new = self.instance_metric(self.south, deals)
        self.assertEqual(new.target_value, new.base_value)  # needs a target
        goal = self.ok(self.alice, "template-goals", template=self.template["id"], title="Retention", parent=self.revenue_goal["id"])
        self.assertEqual(Goal.objects.filter(template_goal_id=goal["id"], is_rollup=False).count(), 2)

    def test_removed_template_metric_detaches_rows_with_history(self):
        self.apply(self.north, self.south)
        north = self.instance_metric(self.north, self.nps)
        south = self.instance_metric(self.south, self.nps)
        self.check_in(self.dave, north, 30)
        self.assertEqual(self.alice.delete(f"{API}/template-metrics/{self.nps['id']}").status_code, 204)
        north.refresh_from_db()
        self.assertIsNone(north.template_metric_id)  # kept, now the team's own
        self.assertFalse(Metric.objects.filter(id=south.id).exists())  # empty: gone

    def test_aggregation_is_fixed_once_teams_check_in(self):
        self.apply(self.north)
        self.check_in(self.dave, self.instance_metric(self.north, self.mrr), 10)
        response = self.client_patch(self.alice, f"template-metrics/{self.mrr['id']}", aggregation="sum")
        self.assertEqual(response.status_code, 400, response.content)

    def test_deleting_an_instance_takes_its_whole_tree(self):
        self.apply(self.north)
        root = self.instance_metric(self.north, self.mrr).goal
        hiring = Goal.objects.get(template_goal_id=self.hiring_goal["id"], team_id=self.north["id"], is_rollup=False)
        self.assertEqual(self.alice.delete(f"{API}/goals/{hiring.id}").status_code, 400)
        self.assertEqual(self.alice.delete(f"{API}/goals/{root.id}").status_code, 204)
        self.assertFalse(Goal.objects.filter(team_id=self.north["id"], is_rollup=False).exists())

    # --- totals --------------------------------------------------------------

    def test_totals_add_up_the_subtree(self):
        self.apply(self.north, self.south, self.sales)
        self.check_in(self.dave, self.instance_metric(self.north, self.mrr), 40)
        self.check_in(self.erin, self.instance_metric(self.south, self.mrr), 20)
        self.check_in(self.alice, self.instance_metric(self.sales, self.mrr), 5)
        sales_total = self.total(self.mrr, self.sales)
        org_total = self.total(self.mrr)
        # Sales' own instance plus both teams under it.
        self.assertEqual((sales_total.current_value, sales_total.target_value), (Decimal(65), Decimal(300)))
        self.assertEqual(org_total.current_value, Decimal(65))
        # The goal's progress is the mean of MRR (21.67%) and NPS (0%).
        self.assertEqual(org_total.goal.progress, Decimal("10.83"))
        # Stored as check-ins, so charts and health work.
        self.assertEqual(CheckIn.objects.filter(metric=sales_total, source="rollup").last().value, Decimal(65))

    def test_a_team_without_sub_teams_has_no_total(self):
        # North's total would only repeat North's own numbers.
        self.apply(self.north, self.south)
        totals = Goal.objects.filter(is_rollup=True, parent__isnull=True, cycle_id=self.cycle["id"])
        self.assertEqual({g.team_id and str(g.team_id) for g in totals}, {self.sales["id"], None})
        # A team that gains a sub-team gets one - once it's ticked.
        east = self.ok(self.alice, "teams", org=self.org["id"], name="East", parent=self.north["id"])
        self.assertFalse(Goal.objects.filter(is_rollup=True, team_id=self.north["id"]).exists())
        self.tick_totals("org", self.sales["id"], self.north["id"])
        self.assertEqual(self.total(self.mrr, self.north).goal.title, "Grow revenue · North total")
        self.client_patch(self.alice, f"teams/{east['id']}", parent=self.south["id"])
        self.assertFalse(Goal.objects.filter(is_rollup=True, team_id=self.north["id"]).exists())

    def test_totals_only_for_ticked_nodes(self):
        self.apply(self.north, self.south)
        self.tick_totals()  # nothing ticked: no totals at all
        self.assertFalse(Goal.objects.filter(is_rollup=True).exists())
        self.tick_totals(self.sales["id"])
        totals = Goal.objects.filter(is_rollup=True, parent__isnull=True, cycle_id=self.cycle["id"])
        self.assertEqual({str(g.team_id) for g in totals}, {self.sales["id"]})
        board = self.alice.get(f"{API}/goal-templates/{self.template['id']}/board", {"cycle": self.cycle["id"]}).json()
        self.assertEqual((board["total_for"], set(board["totals"])), ([self.sales["id"]], {self.sales["id"]}))
        # Only "org" or a team with sub-teams; only managers.
        self.assertEqual(self.post(self.alice, f"goal-templates/{self.template['id']}/totals",
                                   total_for=[self.north["id"]]).status_code, 400)
        self.assertEqual(self.post(self.dave, f"goal-templates/{self.template['id']}/totals",
                                   total_for=["org"]).status_code, 403)

    def test_unticking_a_team_takes_it_out(self):
        self.apply(self.north, self.south)
        self.check_in(self.dave, self.instance_metric(self.north, self.mrr), 40)
        north_root = self.instance_metric(self.north, self.mrr).goal_id
        self.assertEqual(self.post(self.dave, f"goal-templates/{self.template['id']}/leave",
                                   teams=[self.south["id"]], cycle=self.cycle["id"]).status_code, 403)
        left = self.ok(self.alice, f"goal-templates/{self.template['id']}/leave", expect=200,
                       teams=[self.north["id"], self.south["id"]], cycle=self.cycle["id"])
        self.assertEqual(left, {"deleted": [self.south["id"]], "detached": [self.north["id"]]})
        # North's history stays, as North's own goal; South's empty copy is gone.
        kept = Goal.objects.get(id=north_root)
        self.assertIsNone(kept.template_goal_id)
        self.assertFalse(Goal.objects.filter(team_id=self.south["id"], is_rollup=False).exists())
        self.assertFalse(Goal.objects.filter(is_rollup=True).exists())  # no team left to total
        # Ticking again starts a fresh copy.
        self.apply(self.north)
        self.assertEqual(self.instance_metric(self.north, self.mrr).current_value, Decimal(0))

    def test_average_and_lowest_rules(self):
        self.apply(self.north, self.south)
        self.check_in(self.dave, self.instance_metric(self.north, self.nps), 40)
        self.check_in(self.erin, self.instance_metric(self.south, self.nps), 20)
        self.assertEqual(self.total(self.nps).current_value, Decimal(30))
        north_hires = self.instance_metric(self.north, self.hires)
        south_hires = self.instance_metric(self.south, self.hires)
        self.set_target(self.dave, north_hires, 4)
        self.set_target(self.alice, south_hires, 2)
        self.check_in(self.dave, north_hires, 3)
        self.check_in(self.erin, south_hires, 1)
        hires = self.total(self.hires)
        self.assertEqual((hires.unit, hires.current_value, hires.target_value), ("%", Decimal(50), Decimal(100)))

    def test_a_team_without_a_target_does_not_drag_the_total(self):
        self.apply(self.north, self.south)
        north_hires = self.instance_metric(self.north, self.hires)
        self.set_target(self.dave, north_hires, 4)
        self.check_in(self.dave, north_hires, 4)
        self.assertEqual(self.total(self.hires).current_value, Decimal(100))  # South hasn't committed

    def test_planned_target(self):
        self.apply(self.north, self.south)
        self.check_in(self.dave, self.instance_metric(self.north, self.mrr), 50)
        org_total = self.total(self.mrr)
        sales_total = self.total(self.mrr, self.sales)
        # Leads plan only below their own team; owners/admins anywhere.
        self.set_target(self.dave, org_total, None, status=400)  # a total's target isn't settable
        self.post_plan(self.dave, sales_total, 80, status=403)
        self.post_plan(self.alice, org_total, 250)
        org_total.refresh_from_db()
        self.assertEqual((org_total.planned_target, org_total.target_value), (Decimal(250), Decimal(250)))
        self.assertEqual(org_total.goal.progress, Decimal(10))  # MRR 20%, NPS 0%
        board = self.alice.get(f"{API}/goal-templates/{self.template['id']}/board", {"cycle": self.cycle["id"]}).json()
        total = board["totals"]["org"]["metrics"][self.mrr["id"]]
        self.assertEqual((total["planned_target"], total["teams_target"]), (250.0, 200.0))

    def post_plan(self, client, metric, value, status=204):
        response = self.post(client, f"goal-templates/{self.template['id']}/targets",
                             items=[{"metric": str(metric.id), "planned_target": value}])
        self.assertEqual(response.status_code, status, response.content)

    def test_a_lead_plans_the_teams_below(self):
        lead = self.ok(self.alice, "team-members", team=self.sales["id"], user_id=self.frank.user_id, role="lead")
        east = self.ok(self.alice, "teams", org=self.org["id"], name="East", parent=self.north["id"])
        self.tick_totals("org", self.sales["id"], self.north["id"])
        self.apply(self.north, east)
        self.post_plan(self.frank, self.total(self.mrr, self.north), 90)
        self.post_plan(self.frank, self.total(self.mrr, self.sales), 90, status=403)
        self.assertTrue(lead)

    def test_totals_are_read_only(self):
        self.apply(self.north)
        org_total = self.total(self.mrr)
        self.check_in(self.alice, org_total, 10, status=400)
        self.assertEqual(self.client_patch(self.alice, f"goals/{org_total.goal_id}", status="completed").status_code, 403)
        self.assertEqual(self.client_patch(self.alice, f"metrics/{org_total.id}", target_value=5).status_code, 403)
        self.assertEqual(self.alice.delete(f"{API}/goals/{org_total.goal_id}").status_code, 403)

    def test_moving_a_team_moves_its_numbers(self):
        self.apply(self.north)
        self.check_in(self.dave, self.instance_metric(self.north, self.mrr), 40)
        self.assertEqual(self.total(self.mrr, self.sales).current_value, Decimal(40))
        self.client_patch(self.alice, f"teams/{self.north['id']}", parent=None)
        self.assertFalse(Metric.objects.filter(goal__is_rollup=True, goal__team_id=self.sales["id"]).exists())
        self.assertEqual(self.total(self.mrr).current_value, Decimal(40))

    # --- board, bulk check-ins -----------------------------------------------

    def test_board(self):
        self.apply(self.north, self.south)
        board = self.erin.get(f"{API}/goal-templates/{self.template['id']}/board", {"cycle": self.cycle["id"]}).json()
        self.assertEqual([g["title"] for g in board["goals"]], ["Grow revenue", "Hiring"])
        self.assertEqual({t["name"] for t in board["teams"]}, {"Sales", "North", "South"})
        south = board["instances"][self.south["id"]]
        north = board["instances"][self.north["id"]]
        self.assertEqual((south["can_check_in"], south["can_set_targets"]), (True, False))
        self.assertEqual(north["can_check_in"], False)
        self.assertEqual(north["metrics"][self.mrr["id"]]["target_value"], 100.0)
        self.assertEqual(set(board["totals"]), {"org", self.sales["id"]})
        self.assertFalse(board["can_manage"])

    def test_bulk_check_ins_are_all_or_nothing(self):
        self.apply(self.north, self.south)
        north = self.instance_metric(self.north, self.mrr)
        south = self.instance_metric(self.south, self.mrr)
        response = self.post(self.dave, "check-ins/bulk", items=[
            {"metric": str(north.id), "value": 10}, {"metric": str(south.id), "value": 10},
        ])
        self.assertEqual(response.status_code, 403, response.content)
        self.assertFalse(CheckIn.objects.filter(metric__in=[north, south]).exists())
        response = self.post(self.alice, "check-ins/bulk", items=[
            {"metric": str(north.id), "value": 10, "note": "week 1"}, {"metric": str(south.id), "value": 30},
        ])
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(self.total(self.mrr).current_value, Decimal(40))

    # --- visibility ------------------------------------------------------------

    def test_team_visibility(self):
        self.apply(self.north, self.south)
        north_root = self.instance_metric(self.north, self.mrr).goal
        response = self.client_patch(self.dave, f"goals/{north_root.id}", visibility="team")
        self.assertEqual(response.status_code, 200, response.content)
        hiring = Goal.objects.get(template_goal_id=self.hiring_goal["id"], team_id=self.north["id"], is_rollup=False)
        self.assertEqual(hiring.visibility, "team")  # the whole instance follows
        sales_lead = self.signup_into("Gina", team=self.sales, role="lead")
        sales_member = self.signup_into("Hank", team=self.sales)
        visible = {
            name: str(north_root.id) in ids(client.get(f"{API}/goals", {"page_size": 100}))
            for name, client in (("dave", self.dave), ("erin", self.erin), ("frank", self.frank),
                                 ("alice", self.alice), ("gina", sales_lead), ("hank", sales_member))
        }
        self.assertEqual(
            visible, {"dave": True, "erin": False, "frank": False, "alice": True, "gina": True, "hank": False}
        )
        # Hidden, it still counts in the totals everyone sees.
        self.check_in(self.dave, self.instance_metric(self.north, self.mrr), 40)
        board = self.erin.get(f"{API}/goal-templates/{self.template['id']}/board", {"cycle": self.cycle["id"]}).json()
        self.assertEqual(board["instances"][self.north["id"]], {"visible": False, "goals": {}, "metrics": {}})
        self.assertEqual(board["totals"]["org"]["metrics"][self.mrr["id"]]["current_value"], 40.0)

    def test_team_visibility_needs_a_team(self):
        goal = self.ok(self.alice, "goals", title="Own", org_id=self.org["id"])
        self.assertEqual(self.client_patch(self.alice, f"goals/{goal['id']}", visibility="team").status_code, 400)
        response = self.client_patch(self.alice, f"goals/{goal['id']}", team_id=self.south["id"], visibility="team")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertIn(goal["id"], ids(self.erin.get(f"{API}/goals")))
        self.assertNotIn(goal["id"], ids(self.frank.get(f"{API}/goals")))

    def signup_into(self, name, team, role="member"):
        client = signup(name)
        self.join(client)
        self.ok(self.alice, "team-members", team=team["id"], user_id=client.user_id, role=role)
        return client

    # --- cycles ----------------------------------------------------------------

    def test_rolling_over_starts_targets_blank(self):
        self.apply(self.north)
        north = self.instance_metric(self.north, self.mrr)
        self.check_in(self.dave, north, 70)
        next_cycle = self.ok(self.alice, "cycles", name="Q1", org_id=self.org["id"], starts_on="2027-01-01",
                             ends_on="2027-03-31", status="planning")
        decisions = [{"goal": str(g.id), "action": "rollover"} for g in Goal.objects.filter(cycle_id=self.cycle["id"])]
        self.ok(self.alice, f"cycles/{self.cycle['id']}/close", expect=200, decisions=decisions, next_cycle=next_cycle["id"])
        new = Metric.objects.get(template_metric_id=self.mrr["id"], goal__team_id=self.north["id"], goal__is_rollup=False,
                                 goal__cycle_id=next_cycle["id"])
        self.assertEqual((new.base_value, new.target_value), (Decimal(70), Decimal(70)))  # a reading: from where it ended
        hiring = Goal.objects.get(template_goal_id=self.hiring_goal["id"], team_id=self.north["id"], cycle_id=next_cycle["id"],
                                  is_rollup=False)
        self.assertEqual(hiring.parent_id, new.goal_id)
        self.assertEqual(Goal.objects.filter(cycle_id=next_cycle["id"], is_rollup=True, parent__isnull=True).count(), 2)

    # --- the agent path --------------------------------------------------------

    def test_metrics_say_whose_they_are(self):
        self.apply(self.north, self.south)
        rows = self.erin.get(f"{API}/metrics", {"filter{name.icontains}": "MRR", "page_size": 100}).json()["items"]
        mine = [r for r in rows if r["in_my_team"]]
        self.assertEqual([r["id"] for r in mine], [str(self.instance_metric(self.south, self.mrr).id)])
        self.assertEqual(sum(r["is_total"] for r in rows), 2)

    # --- check-in setting (template goals like goals) ------------------------

    def test_template_goal_check_in_setting_is_inherited_by_copies(self):
        # New template goals and metrics inherit; a top-level goal inheriting = any time.
        tg = self.alice.get(f"{API}/template-goals/{self.revenue_goal['id']}").json()
        self.assertEqual(tg["snap_to"], "parent")
        self.assertEqual(self.alice.get(f"{API}/template-metrics/{self.mrr['id']}").json()["snap_to"], "goal")
        self.apply(self.north)
        week = {"snap_to": "week", "snap_weekday": 5, "snap_time": "17:00"}
        response = self.client_patch(self.alice, f"template-goals/{self.revenue_goal['id']}", **week)
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["snap_to"], "week")
        # The copy's goal, its metrics, the sub-goal and its metric all follow.
        mrr, hires = self.instance_metric(self.north, self.mrr), self.instance_metric(self.north, self.hires)
        for row in (mrr, hires, mrr.goal, hires.goal):
            self.assertEqual((row.snap_to, row.snap_weekday, row.snap_time), ("week", 5, "17:00"), row)
        # A metric's own choice wins.
        response = self.client_patch(self.alice, f"template-metrics/{self.nps['id']}", snap_to="month", snap_day=15)
        self.assertEqual(response.status_code, 200, response.content)
        nps = self.instance_metric(self.north, self.nps)
        self.assertEqual((nps.snap_to, nps.snap_day), ("month", 15))
        # Back to inherited.
        self.assertEqual(self.client_patch(self.alice, f"template-metrics/{self.nps['id']}", snap_to="goal").status_code, 200)
        self.assertEqual(self.instance_metric(self.north, self.nps).snap_to, "week")
        # A team's copy can't change it.
        response = self.client_patch(self.alice, f"goals/{mrr.goal_id}", snap_to="day")
        self.assertEqual(response.status_code, 400)
        self.assertIn("Set by the goal template", str(response.json()))

    def test_inherited_setting_must_fit_a_metrics_target(self):
        self.client_patch(self.alice, f"template-metrics/{self.hires['id']}", target_per="day")
        response = self.client_patch(self.alice, f"template-goals/{self.revenue_goal['id']}", snap_to="week")
        self.assertEqual(response.status_code, 400)
        self.assertIn("Hires", str(response.json()["field_errors"]["snap_to"]))
        tg = self.alice.get(f"{API}/template-goals/{self.revenue_goal['id']}").json()
        self.assertEqual(tg["snap_to"], "parent")  # nothing saved


class TeamMemberCopyTests(TeamSetup):
    """A team member's own copy of their team's goals (P-91,
    docs/team-templates.md "Members"): Grace joins North (Dave leads it)."""

    def setUp(self):
        super().setUp()
        self.grace = signup("Grace")
        self.join(self.grace)
        self.ok(self.alice, "team-members", team=self.north["id"], user_id=self.grace.user_id)
        self.apply(self.north, self.south)

    def assign(self, client, team, *users, expect=201):
        return self.ok(client, f"goal-templates/{self.template['id']}/assign", expect=expect, team=team["id"],
                       users=[u.user_id for u in users], cycle=self.cycle["id"])

    def member_metric(self, user, template_metric):
        return Metric.objects.get(template_metric_id=template_metric["id"], goal__assignee_id=user.user_id,
                                  goal__cycle_id=self.cycle["id"])

    def test_the_lead_gives_a_member_a_copy(self):
        self.assign(self.dave, self.north, self.grace)
        goals = Goal.objects.filter(assignee_id=self.grace.user_id)
        self.assertEqual({g.title for g in goals}, {"Grow revenue", "Hiring"})
        self.assertEqual({str(g.owner_id) for g in goals}, {self.grace.user_id})
        self.assertEqual({str(g.team_id) for g in goals}, {self.north["id"]})
        hiring = goals.get(title="Hiring")
        self.assertEqual(hiring.parent_id, goals.get(title="Grow revenue").id)
        self.assertEqual(self.member_metric(self.grace, self.mrr).target_value, Decimal(100))  # the template's default
        # Again: nothing new.
        self.assertEqual(self.assign(self.dave, self.north, self.grace)["goals"], [])
        self.assertEqual(Goal.objects.filter(assignee_id=self.grace.user_id).count(), 2)

    def test_only_a_lead_or_manager_assigns_and_only_team_members(self):
        self.assign(self.grace, self.north, self.grace, expect=403)
        self.assign(self.erin, self.north, self.grace, expect=403)  # South's member
        self.assign(self.bob, self.north, self.grace, expect=404)  # a stranger
        self.assign(self.dave, self.north, self.erin, expect=400)  # not in North
        self.assign(self.alice, self.north, self.grace)

    def test_the_team_needs_its_own_copy_first(self):
        self.ok(self.alice, f"goal-templates/{self.template['id']}/leave", expect=200, teams=[self.north["id"]],
                cycle=self.cycle["id"])
        self.assign(self.dave, self.north, self.grace, expect=400)

    def test_the_team_total_is_its_copy_plus_its_members(self):
        self.assign(self.dave, self.north, self.grace)
        self.check_in(self.dave, self.instance_metric(self.north, self.mrr), 30)
        self.check_in(self.grace, self.member_metric(self.grace, self.mrr), 20)
        north = self.total(self.mrr, self.north)  # a team without sub-teams: totalled once it has members
        self.assertEqual((north.current_value, north.target_value), (Decimal(50), Decimal(200)))
        self.assertEqual(self.total(self.mrr, self.sales).current_value, Decimal(50))
        self.assertEqual(self.total(self.mrr).target_value, Decimal(300))  # North, Grace, South
        # Unassigned (no check-ins left? she has one): her copy is detached, North's total goes.
        result = self.ok(self.dave, f"goal-templates/{self.template['id']}/unassign", expect=200, team=self.north["id"],
                         users=[self.grace.user_id], cycle=self.cycle["id"])
        self.assertEqual(result, {"deleted": [], "detached": [self.grace.user_id]})
        self.assertFalse(Goal.objects.filter(team_id=self.north["id"], is_rollup=True).exists())
        self.assertEqual(self.total(self.mrr, self.sales).current_value, Decimal(30))
        self.assertEqual(Goal.objects.filter(assignee_id=self.grace.user_id, template_goal__isnull=True).count(), 2)

    def test_unassigning_an_empty_copy_deletes_it(self):
        self.assign(self.dave, self.north, self.grace)
        result = self.ok(self.dave, f"goal-templates/{self.template['id']}/unassign", expect=200, team=self.north["id"],
                         users=[self.grace.user_id], cycle=self.cycle["id"])
        self.assertEqual(result, {"deleted": [self.grace.user_id], "detached": []})
        self.assertFalse(Goal.objects.filter(assignee_id=self.grace.user_id).exists())

    def test_who_checks_in_and_sets_targets_on_a_members_copy(self):
        self.assign(self.dave, self.north, self.grace)
        mine = self.member_metric(self.grace, self.mrr)
        self.check_in(self.grace, mine, 5)
        self.check_in(self.dave, mine, 6)  # her lead
        self.check_in(self.erin, mine, 7, status=403)  # another team
        # Her copy is hers, but its targets are the lead's.
        self.set_target(self.grace, mine, 150, status=403)
        self.set_target(self.dave, mine, 150)
        # A member's copy is not the team's: another North member can't check in on it.
        henry = signup("Henry")
        self.join(henry)
        self.ok(self.alice, "team-members", team=self.north["id"], user_id=henry.user_id)
        self.check_in(henry, mine, 8, status=403)
        self.check_in(henry, self.instance_metric(self.north, self.mrr), 8)

    def test_board_shows_people_and_member_copies(self):
        self.assign(self.dave, self.north, self.grace)
        board = self.dave.get(f"{API}/goal-templates/{self.template['id']}/board", {"cycle": self.cycle["id"]}).json()
        north = next(t for t in board["teams"] if t["id"] == self.north["id"])
        self.assertTrue(north["can_assign"])
        self.assertEqual([(p["name"], p["role"]) for p in north["people"]], [("Dave", "lead"), ("Grace", "member")])
        self.assertFalse(next(t for t in board["teams"] if t["id"] == self.south["id"])["can_assign"])
        copy = board["members"][self.north["id"]][self.grace.user_id]
        self.assertEqual((copy["can_check_in"], copy["can_set_targets"]), (True, True))
        self.assertEqual(copy["metrics"][self.mrr["id"]]["target_value"], 100.0)
        self.assertEqual(board["names"], {self.grace.user_id: "Grace"})
        self.assertIn(self.north["id"], board["totals"])
        grace_view = self.grace.get(f"{API}/goal-templates/{self.template['id']}/board", {"cycle": self.cycle["id"]}).json()
        self.assertEqual(grace_view["members"][self.north["id"]][self.grace.user_id]["can_set_targets"], False)
        self.assertEqual(grace_view["instances"][self.north["id"]]["can_set_targets"], False)

    def test_metrics_say_which_copy_is_mine(self):
        self.assign(self.dave, self.north, self.grace)
        rows = self.grace.get(f"{API}/metrics", {"filter{name.icontains}": "MRR", "page_size": 100}).json()["items"]
        self.assertEqual([r["id"] for r in rows if r["for_me"]], [str(self.member_metric(self.grace, self.mrr).id)])
        self.assertEqual(len([r for r in rows if r["in_my_team"]]), 2)  # North's and hers
        dave_rows = self.dave.get(f"{API}/metrics", {"filter{name.icontains}": "MRR", "page_size": 100}).json()["items"]
        self.assertEqual([r for r in dave_rows if r["for_me"]], [])
        self.assertEqual(len([r for r in dave_rows if r["in_my_team"]]), 1)  # North's, not Grace's

    def test_template_changes_reach_member_copies(self):
        self.assign(self.dave, self.north, self.grace)
        self.client_patch(self.alice, f"template-metrics/{self.mrr['id']}", name="Revenue")
        self.assertEqual(self.member_metric(self.grace, self.mrr).name, "Revenue")

    def test_rolling_over_keeps_member_copies(self):
        self.assign(self.dave, self.north, self.grace)
        self.check_in(self.grace, self.member_metric(self.grace, self.mrr), 40)
        next_cycle = self.ok(self.alice, "cycles", name="Q1", org_id=self.org["id"], starts_on="2027-01-01",
                             ends_on="2027-03-31", status="planning")
        decisions = [{"goal": str(g.id), "action": "rollover"} for g in Goal.objects.filter(cycle_id=self.cycle["id"])]
        self.ok(self.alice, f"cycles/{self.cycle['id']}/close", expect=200, decisions=decisions, next_cycle=next_cycle["id"])
        new = Metric.objects.get(template_metric_id=self.mrr["id"], goal__assignee_id=self.grace.user_id,
                                 goal__cycle_id=next_cycle["id"])
        self.assertEqual((new.base_value, new.target_value, str(new.goal.owner_id)), (Decimal(40), Decimal(40), self.grace.user_id))
        team = Metric.objects.get(template_metric_id=self.mrr["id"], goal__team_id=self.north["id"], goal__is_rollup=False,
                                  goal__assignee_id__isnull=True, goal__cycle_id=next_cycle["id"])
        self.assertNotEqual(team.goal_id, new.goal_id)

    def test_deleting_the_team_archives_member_copies(self):
        self.assign(self.dave, self.north, self.grace)
        self.assertEqual(self.alice.delete(f"{API}/teams/{self.north['id']}").status_code, 204)
        copies = Goal.objects.filter(assignee_id=self.grace.user_id)
        self.assertEqual({(g.status, g.template_goal_id) for g in copies}, {(GoalStatus.ARCHIVED, None)})
        # North's own copy moved up to Sales, still in the template.
        self.assertTrue(Goal.objects.filter(team_id=self.sales["id"], is_rollup=False, assignee_id__isnull=True,
                                            template_goal_id=self.revenue_goal["id"]).exists())
