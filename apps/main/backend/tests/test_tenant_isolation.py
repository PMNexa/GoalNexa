"""Tenant isolation, end to end through main's real stack (every module,
RBAC policy, main's own settings) - two strangers who signed up on the
same install must never read, change or attach to each other's rows.

Runs as a hosted install does (`AUTH_FIRST_RUN_SETUP=False`): both
accounts come from plain signup, so each holds only the default Member
role, app-wide. Every probe is made by Bob against Alice's data.

`python manage.py test tests` in apps/main/backend.
"""

import base64
import hashlib
import json
from urllib.parse import parse_qs, urlencode, urlsplit

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

API = "/api/v1"


def signup(name: str) -> APIClient:
    client = APIClient()
    response = client.post(
        f"{API}/auth/signup",
        {"name": name, "email": f"{name.lower()}@example.com", "password": "correct-horse-battery"},
        format="json",
    )
    assert response.status_code == 200, response.content
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.json()['access_token']}")
    client.user_id = response.json()["user"]["id"]
    return client


def ids(response) -> set[str]:
    return {row["id"] for row in response.json()["items"]}


@override_settings(AUTH_FIRST_RUN_SETUP=False)
class TenantIsolationTests(TestCase):
    def setUp(self):
        self.alice = signup("Alice")
        self.bob = signup("Bob")

        self.org = self.create(self.alice, "orgs", name="Alice Inc")
        self.goal = self.create(self.alice, "goals", title="Alice's goal", org_id=self.org["id"])
        self.metric = self.create(self.alice, "metrics", goal=self.goal["id"], name="Revenue", target_value=100)
        self.check_in = self.create(self.alice, "check-ins", metric=self.metric["id"], value=40)
        self.invitation = self.create(self.alice, "org-invitations", org=self.org["id"], email="dave@example.com")
        self.membership = self.alice.get(f"{API}/org-members").json()["items"][0]
        # Carol joins Alice's org so Alice's goal can be shared with her.
        self.carol = signup("Carol")
        token = self.create(self.alice, "org-invitations", org=self.org["id"], email="carol@example.com")["token"]
        self.assertEqual(self.carol.post(f"{API}/org-invitations/token/{token}/accept").status_code, 200)
        self.goal_member = self.create(self.alice, "goal-members", goal=self.goal["id"], user_id=self.carol.user_id)

        self.cycle = self.create(self.alice, "cycles", name="Q4", org_id=self.org["id"], starts_on="2026-10-01", ends_on="2026-12-31")
        self.comment = self.create(self.alice, "goal-comments", goal=self.goal["id"], body="On it")
        self.activity = self.alice.get(f"{API}/activities?filter{{goal}}={self.goal['id']}").json()["items"][0]
        # A closed cycle's score.
        closed = self.create(self.alice, "cycles", name="Q3", org_id=self.org["id"], starts_on="2026-07-01", ends_on="2026-09-30")
        scored = self.create(self.alice, "goals", title="Q3 goal", org_id=self.org["id"], cycle=closed["id"])
        self.assertEqual(self.alice.post(f"{API}/cycles/{closed['id']}/close", {}, format="json").status_code, 200)
        self.score = self.alice.get(f"{API}/goal-scores?filter{{goal}}={scored['id']}").json()["items"][0]

        self.bob_goal = self.create(self.bob, "goals", title="Bob's goal")
        self.bob_metric = self.create(self.bob, "metrics", goal=self.bob_goal["id"], name="Km", target_value=10)

    def create(self, client, resource, **body):
        response = client.post(f"{API}/{resource}", body, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        return response.json()

    def alices_rows(self):
        return {
            "orgs": self.org["id"],
            "goals": self.goal["id"],
            "metrics": self.metric["id"],
            "check-ins": self.check_in["id"],
            "goal-members": self.goal_member["id"],
            "org-members": self.membership["id"],
            "org-invitations": self.invitation["id"],
            "cycles": self.cycle["id"],
            "goal-comments": self.comment["id"],
            "activities": self.activity["id"],
            "goal-scores": self.score["id"],
        }

    # --- reading ---------------------------------------------------------

    def test_list_hides_other_tenants_rows(self):
        for resource, row_id in self.alices_rows().items():
            with self.subTest(resource):
                self.assertNotIn(row_id, ids(self.bob.get(f"{API}/{resource}")))
                # Alice's own list does show it - the probe above means something.
                self.assertIn(row_id, ids(self.alice.get(f"{API}/{resource}")))

    def test_filters_and_search_stay_scoped(self):
        probes = {
            "goals": [f"filter{{owner_id}}={self.alice.user_id}", f"filter{{org_id}}={self.org['id']}", "q=Alice"],
            "metrics": [f"filter{{goal}}={self.goal['id']}", "q=Revenue"],
            "check-ins": [f"filter{{metric}}={self.metric['id']}", "q=Revenue"],
            "goal-members": [f"filter{{goal}}={self.goal['id']}", f"filter{{user_id}}={self.carol.user_id}"],
            "orgs": [f"filter{{id}}={self.org['id']}", "q=Alice"],
            "org-members": [f"filter{{org}}={self.org['id']}", f"filter{{user_id}}={self.alice.user_id}"],
            "org-invitations": [f"filter{{org}}={self.org['id']}", "q=dave"],
        }
        for resource, queries in probes.items():
            for query in queries:
                with self.subTest(resource=resource, query=query):
                    response = self.bob.get(f"{API}/{resource}?{query}")
                    if response.status_code == 200:
                        self.assertNotIn(self.alices_rows()[resource], ids(response))
                    else:
                        self.assertEqual(response.status_code, 400)

    def test_check_in_search_matches_its_metric_and_goal(self):
        # The probe above only means something if Alice's own search finds it.
        for query in ("q=Revenue", "q=Alice"):
            with self.subTest(query):
                self.assertIn(self.check_in["id"], ids(self.alice.get(f"{API}/check-ins?{query}")))

    def test_retrieve_other_tenants_row_is_404(self):
        for resource, row_id in self.alices_rows().items():
            with self.subTest(resource):
                self.assertEqual(self.bob.get(f"{API}/{resource}/{row_id}").status_code, 404)

    def test_sideloading_never_reaches_other_tenants_rows(self):
        response = self.bob.get(f"{API}/goals?include[]=metrics&include[]=sub_goals")
        self.assertEqual(response.status_code, 200)
        self.assertNotIn(self.metric["id"], json.dumps(response.json()))
        self.assertNotIn(self.goal["id"], json.dumps(response.json()))

    # --- writing ---------------------------------------------------------

    def test_update_and_delete_other_tenants_row_is_404(self):
        for resource, row_id in self.alices_rows().items():
            with self.subTest(resource):
                # 405: the resource takes no PATCH at all (invitations).
                self.assertIn(self.bob.patch(f"{API}/{resource}/{row_id}", {}, format="json").status_code, (404, 405))
                # Read-only resources take no DELETE at all.
                expected = 405 if resource in ("activities", "goal-scores") else 404
                self.assertEqual(self.bob.delete(f"{API}/{resource}/{row_id}").status_code, expected)
                self.assertEqual(self.alice.get(f"{API}/{resource}/{row_id}").status_code, 200)

    def test_cannot_attach_to_other_tenants_parent(self):
        attempts = [
            ("metrics", {"goal": self.goal["id"], "name": "Sneaky", "target_value": 1}),
            ("metrics", {"goal": self.bob_goal["id"], "parent": self.metric["id"], "name": "Sneaky", "target_value": 1}),
            ("check-ins", {"metric": self.metric["id"], "value": 999}),
            ("goals", {"title": "Sneaky", "parent": self.goal["id"]}),
            ("goal-members", {"goal": self.goal["id"], "user_id": self.bob.user_id}),
            # Bob's own goal is personal - and Alice isn't in any org of his.
            ("goal-members", {"goal": self.bob_goal["id"], "user_id": self.alice.user_id}),
        ]
        for resource, body in attempts:
            with self.subTest(resource=resource, body=body):
                self.assertIn(self.bob.post(f"{API}/{resource}", body, format="json").status_code, (400, 403, 404))
        self.assertEqual(self.alice.get(f"{API}/metrics/{self.metric['id']}").json()["current_value"], "40.00")

    def test_cannot_move_own_row_under_other_tenants_parent(self):
        moves = [
            ("metrics", self.bob_metric["id"], {"goal": self.goal["id"]}),
            ("metrics", self.bob_metric["id"], {"parent": self.metric["id"]}),
            ("goals", self.bob_goal["id"], {"parent": self.goal["id"]}),
        ]
        for resource, row_id, body in moves:
            with self.subTest(resource=resource, body=body):
                self.assertIn(
                    self.bob.patch(f"{API}/{resource}/{row_id}", body, format="json").status_code, (400, 403, 404)
                )

    def test_cannot_hand_a_row_to_another_tenant(self):
        """Ownership is set by the server, never taken from the body."""
        created = self.bob.post(f"{API}/goals", {"title": "Gift", "owner_id": self.alice.user_id}, format="json")
        self.bob.patch(f"{API}/goals/{self.bob_goal['id']}", {"owner_id": self.alice.user_id}, format="json")
        alices = ids(self.alice.get(f"{API}/goals"))
        self.assertNotIn(self.bob_goal["id"], alices)
        if created.status_code == 201:
            self.assertNotIn(created.json()["id"], alices)

    def test_cannot_put_a_goal_in_an_org_you_are_not_in(self):
        created = self.bob.post(f"{API}/goals", {"title": "Squatter", "org_id": self.org["id"]}, format="json")
        self.assertIn(created.status_code, (400, 403, 404))
        moved = self.bob.patch(f"{API}/goals/{self.bob_goal['id']}", {"org_id": self.org["id"]}, format="json")
        self.assertIn(moved.status_code, (400, 403, 404))

    def test_public_dashboard_links_stay_scoped(self):
        """A link can't be made to someone else's goal, isn't listed or
        revocable by anyone else, and stops showing a goal once its owner
        can't see it (Carol, a goal member, leaves the org)."""
        stolen = self.bob.post(f"{API}/dashboard-shares", {"goals": [self.goal["id"]]}, format="json")
        self.assertEqual(stolen.status_code, 400)
        share = self.create(self.alice, "dashboard-shares", goals=[self.goal["id"]])
        self.assertEqual(self.bob.get(f"{API}/dashboard-shares").json()["items"], [])
        self.assertEqual(self.bob.delete(f"{API}/dashboard-shares/{share['id']}").status_code, 404)
        self.assertEqual(len(APIClient().get(f"{API}/shared-dashboards/{share['token']}").json()["goals"]), 1)

        carols = self.create(self.carol, "dashboard-shares", goals=[self.goal["id"]])
        membership = self.carol.get(f"{API}/org-members?filter{{user_id}}={self.carol.user_id}").json()["items"][0]
        self.assertEqual(self.carol.delete(f"{API}/org-members/{membership['id']}").status_code, 204)
        self.assertEqual(APIClient().get(f"{API}/shared-dashboards/{carols['token']}").json()["goals"], [])

    # --- accounts and access control -------------------------------------

    def test_user_directory_and_rbac_are_closed_to_members(self):
        for resource in ("users", "role-assignments"):
            with self.subTest(resource):
                response = self.bob.get(f"{API}/{resource}")
                self.assertTrue(
                    response.status_code == 403 or not ids(response) - {self.bob.user_id},
                    f"{resource} exposes other accounts: {response.content[:200]}",
                )
        self.assertEqual(self.bob.get(f"{API}/users/{self.alice.user_id}").status_code in (403, 404), True)

    def test_cannot_grant_yourself_admin(self):
        roles = self.bob.get(f"{API}/roles")
        admin_id = next((r["id"] for r in roles.json().get("items", []) if r["name"] == "Admin"), None)
        response = self.bob.post(
            f"{API}/role-assignments", {"user": self.bob.user_id, "role": admin_id or "0"}, format="json"
        )
        self.assertIn(response.status_code, (400, 403))
        self.assertEqual(self.bob.get(f"{API}/auth/me").json()["permissions"].count("*"), 0)

    def test_me_is_only_yourself(self):
        me = self.bob.get(f"{API}/auth/me").json()
        self.assertEqual(me["id"], self.bob.user_id)

    # --- MCP -------------------------------------------------------------

    def mcp(self, client, name, **arguments):
        response = client.post(
            f"{API}/mcp",
            {"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": name, "arguments": arguments}},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        result = response.json()["result"]
        return result["isError"], result["content"][0]["text"]

    def test_mcp_tools_stay_scoped(self):
        for tool, row_id in [
            ("orgs_get", self.org["id"]),
            ("goals_get", self.goal["id"]),
            ("metrics_get", self.metric["id"]),
            ("check_ins_get", self.check_in["id"]),
            ("goal_members_get", self.goal_member["id"]),
            ("org_members_get", self.membership["id"]),
            ("org_invitations_get", self.invitation["id"]),
        ]:
            with self.subTest(tool):
                self.assertFalse(self.mcp(self.alice, tool, id=row_id)[0])  # the tool exists
                self.assertTrue(self.mcp(self.bob, tool, id=row_id)[0])
                self.assertTrue(self.mcp(self.bob, tool.replace("_get", "_delete"), id=row_id)[0])
        error, text = self.mcp(self.bob, "goals_list")
        self.assertFalse(error)
        self.assertNotIn(self.goal["id"], text)
        self.assertTrue(self.mcp(self.bob, "check_ins_create", metric=self.metric["id"], value=1)[0])

    def test_mcp_custom_tools_stay_scoped(self):
        # The chart: Alice's goal is hers (and her org's), not Bob's.
        error, text = self.mcp(self.alice, "goals_chart", id=self.goal["id"])
        self.assertFalse(error, text)
        self.assertIn(self.metric["id"], text)
        self.assertTrue(self.mcp(self.bob, "goals_chart", id=self.goal["id"])[0])
        # Reminder settings: each caller's own row.
        error, text = self.mcp(self.alice, "reminder_settings_update", timezone="Asia/Ho_Chi_Minh", digest="daily")
        self.assertFalse(error, text)
        self.assertIn("Asia/Ho_Chi_Minh", self.mcp(self.alice, "reminder_settings_get")[1])
        self.assertNotIn("Asia/Ho_Chi_Minh", self.mcp(self.bob, "reminder_settings_get")[1])

    def test_mcp_offers_goal_tracking_not_administration(self):
        response = self.alice.post(f"{API}/mcp", {"jsonrpc": "2.0", "id": 1, "method": "tools/list"}, format="json")
        names = {tool["name"] for tool in response.json()["result"]["tools"]}
        for expected in ("goals_list", "check_ins_create", "org_invitations_create", "goals_chart", "reminder_settings_update"):
            self.assertIn(expected, names)
        for prefix in ("users_", "roles_", "permissions_", "role_assignments_", "system_settings_", "audit_events_"):
            self.assertFalse([name for name in names if name.startswith(prefix)], prefix)
        # What the Claude and ChatGPT directories require of every tool.
        for tool in response.json()["result"]["tools"]:
            annotations = tool.get("annotations", {})
            self.assertTrue(tool.get("title") and annotations.get("title"), tool["name"])
            self.assertIsInstance(annotations.get("readOnlyHint"), bool, tool["name"])
            self.assertIsInstance(annotations.get("openWorldHint"), bool, tool["name"])
            self.assertIsInstance(annotations.get("destructiveHint"), bool, tool["name"])
        # Reads stay closed-world; every write is open-world (settings.MCP_TOOL_ANNOTATIONS).
        for tool in response.json()["result"]["tools"]:
            annotations = tool["annotations"]
            self.assertEqual(annotations["openWorldHint"], not annotations["readOnlyHint"], tool["name"])
        instructions = self.alice.post(
            f"{API}/mcp", {"jsonrpc": "2.0", "id": 1, "method": "initialize"}, format="json"
        ).json()["result"]["instructions"]
        self.assertIn("/dashboard?goal=", instructions)
        self.assertNotIn("{{", instructions)

    def test_cycles_comments_and_feeds_stay_scoped(self):
        # Bob can't file a goal under Alice's cycle, close it, or comment on her goal.
        self.assertIn(self.bob.post(f"{API}/goals", {"title": "x", "cycle": self.cycle["id"]}, format="json").status_code, (400, 404))
        self.assertEqual(self.bob.post(f"{API}/cycles/{self.cycle['id']}/close", {}, format="json").status_code, 404)
        self.assertEqual(self.bob.post(f"{API}/goal-comments", {"goal": self.goal["id"], "body": "hi"}, format="json").status_code, 404)
        # Nor roll his own goals into it.
        bob_cycle = self.create(self.bob, "cycles", name="Mine", starts_on="2026-10-01", ends_on="2026-12-31")
        self.create(self.bob, "goals", title="Bob Q4", cycle=bob_cycle["id"])
        response = self.bob.post(f"{API}/cycles/{bob_cycle['id']}/close", {"next_cycle": self.cycle["id"]}, format="json")
        self.assertEqual(response.status_code, 404)
        # Carol (org member) sees the org's cycle, its goal's feed and comments.
        self.assertIn(self.cycle["id"], ids(self.carol.get(f"{API}/cycles")))
        self.assertIn(self.comment["id"], ids(self.carol.get(f"{API}/goal-comments")))
        # Only its author edits a comment.
        self.assertEqual(self.carol.patch(f"{API}/goal-comments/{self.comment['id']}", {"body": "x"}, format="json").status_code, 403)

    def test_mcp_check_ins_are_attributed_to_the_agent(self):
        error, text = self.mcp(self.alice, "check_ins_create", metric=self.metric["id"], value=55)
        self.assertFalse(error, text)
        latest = self.alice.get(f"{API}/check-ins?filter{{metric}}={self.metric['id']}&sort=-created_at").json()["items"][0]
        self.assertEqual((latest["source"], latest["author_id"]), ("agent", self.alice.user_id))

    def test_metric_ingest_tokens_stay_scoped(self):
        # Bob can't mint or revoke a token for Alice's metric.
        for method in ("post", "delete"):
            response = getattr(self.bob, method)(f"{API}/metrics/{self.metric['id']}/ingest-token")
            self.assertEqual(response.status_code, 404)
        token = self.alice.post(f"{API}/metrics/{self.metric['id']}/ingest-token").json()["token"]
        self.assertNotIn(token, json.dumps(self.alice.get(f"{API}/metrics/{self.metric['id']}").json()))

        with_token = APIClient()
        with_token.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        # It checks in to that one metric - not Bob's, and not the API.
        self.assertEqual(with_token.post(f"{API}/metrics/{self.metric['id']}/ingest", {"value": 1}, format="json").status_code, 201)
        self.assertEqual(with_token.post(f"{API}/metrics/{self.bob_metric['id']}/ingest", {"value": 1}, format="json").status_code, 401)
        self.assertEqual(with_token.get(f"{API}/metrics").status_code, 401)

    def test_reminder_settings_are_per_user(self):
        saved = self.alice.put(f"{API}/reminder-settings", {"urls": "tgram://123456789:abcdefg/12345", "enabled": True}, format="json")
        self.assertEqual(saved.status_code, 200, saved.content)
        self.assertEqual(self.bob.get(f"{API}/reminder-settings").json()["urls"], "")

    def test_personal_access_tokens_are_per_user(self):
        token = self.alice.post(f"{API}/mcp/tokens", {"name": "laptop"}, format="json").json()
        self.assertNotIn(token["id"], json.dumps(self.bob.get(f"{API}/mcp/tokens").json()))
        self.assertEqual(self.bob.delete(f"{API}/mcp/tokens/{token['id']}").status_code, 404)
        self.assertIn(token["id"], json.dumps(self.alice.get(f"{API}/mcp/tokens").json()))

        # Alice's token acts as Alice at the MCP endpoint - and nowhere else.
        as_alice = APIClient()
        as_alice.credentials(HTTP_AUTHORIZATION=f"Bearer {token['token']}")
        self.assertFalse(self.mcp(as_alice, "goals_get", id=self.goal["id"])[0])
        self.assertEqual(as_alice.get(f"{API}/goals").status_code, 401)

    def test_oauth_connections_are_per_user(self):
        # A connector's whole flow, approved by Alice: register, consent,
        # code for tokens (application/x-www-form-urlencoded, like a real
        # client).
        redirect = "https://claude.ai/api/mcp/auth_callback"
        verifier = "v" * 64
        challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
        client_id = APIClient().post(
            f"{API}/mcp/oauth/register", {"client_name": "Claude", "redirect_uris": [redirect]}, format="json"
        ).json()["client_id"]
        request = {
            "response_type": "code",
            "client_id": client_id,
            "redirect_uri": redirect,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
            "state": "s",
        }
        approved = self.alice.post(f"{API}/mcp/oauth/authorize", {**request, "approve": True}, format="json")
        code = parse_qs(urlsplit(approved.json()["redirect_to"]).query)["code"][0]
        tokens = APIClient().post(
            f"{API}/mcp/oauth/token",
            urlencode({"grant_type": "authorization_code", "code": code, "client_id": client_id,
                       "redirect_uri": redirect, "code_verifier": verifier}),
            content_type="application/x-www-form-urlencoded",
        ).json()

        # The connection is Alice's alone.
        grant_id = self.alice.get(f"{API}/mcp/oauth/grants").json()["items"][0]["id"]
        self.assertEqual(self.bob.get(f"{API}/mcp/oauth/grants").json()["items"], [])
        self.assertEqual(self.bob.delete(f"{API}/mcp/oauth/grants/{grant_id}").status_code, 404)

        # Its token acts as Alice at the MCP endpoint - and nowhere else.
        as_alice = APIClient()
        as_alice.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access_token']}")
        self.assertFalse(self.mcp(as_alice, "goals_get", id=self.goal["id"])[0])
        self.assertTrue(self.mcp(as_alice, "goals_get", id=self.bob_goal["id"])[0])
        self.assertEqual(as_alice.get(f"{API}/goals").status_code, 401)
        self.assertEqual(as_alice.get(f"{API}/mcp/oauth/grants").status_code, 401)
