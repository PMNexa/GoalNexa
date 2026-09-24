"""Tenant isolation, end to end through main's real stack (every module,
RBAC policy, main's own settings) - two strangers who signed up on the
same install must never read, change or attach to each other's rows.

Runs as a hosted install does (`AUTH_FIRST_RUN_SETUP=False`): both
accounts come from plain signup, so each holds only the default Member
role, app-wide. Every probe is made by Bob against Alice's data.

`python manage.py test tests` in apps/main/backend.
"""

import json

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
            "check-ins": [f"filter{{metric}}={self.metric['id']}"],
            "orgs": [f"filter{{id}}={self.org['id']}", "q=Alice"],
        }
        for resource, queries in probes.items():
            for query in queries:
                with self.subTest(resource=resource, query=query):
                    response = self.bob.get(f"{API}/{resource}?{query}")
                    if response.status_code == 200:
                        self.assertNotIn(self.alices_rows()[resource], ids(response))
                    else:
                        self.assertEqual(response.status_code, 400)

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
                self.assertEqual(self.bob.patch(f"{API}/{resource}/{row_id}", {}, format="json").status_code, 404)
                self.assertEqual(self.bob.delete(f"{API}/{resource}/{row_id}").status_code, 404)
                self.assertEqual(self.alice.get(f"{API}/{resource}/{row_id}").status_code, 200)

    def test_cannot_attach_to_other_tenants_parent(self):
        attempts = [
            ("metrics", {"goal": self.goal["id"], "name": "Sneaky", "target_value": 1}),
            ("metrics", {"goal": self.bob_goal["id"], "parent": self.metric["id"], "name": "Sneaky", "target_value": 1}),
            ("check-ins", {"metric": self.metric["id"], "value": 999}),
            ("goals", {"title": "Sneaky", "parent": self.goal["id"]}),
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
        ]:
            with self.subTest(tool):
                self.assertTrue(self.mcp(self.bob, tool, id=row_id)[0])
                self.assertTrue(self.mcp(self.bob, tool.replace("_get", "_delete"), id=row_id)[0])
        error, text = self.mcp(self.bob, "goals_list")
        self.assertFalse(error)
        self.assertNotIn(self.goal["id"], text)
        self.assertTrue(self.mcp(self.bob, "check_ins_create", metric=self.metric["id"], value=1)[0])

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
