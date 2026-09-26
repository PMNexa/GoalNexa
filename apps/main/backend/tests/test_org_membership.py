"""Org membership end to end: invitations (create, accept, decline,
revoke), org roles (owner/admin/member) and what they may do, and an org's
goals shared with its members - through main's real stack, like
test_tenant_isolation.py.

`python manage.py test tests` in apps/main/backend.
"""

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from tests.test_tenant_isolation import API, ids, signup


@override_settings(AUTH_FIRST_RUN_SETUP=False)
class OrgMembershipTests(TestCase):
    def setUp(self):
        self.alice = signup("Alice")  # owner
        self.bob = signup("Bob")  # invited
        self.carol = signup("Carol")  # outsider
        self.org = self.post(self.alice, "orgs", name="Alice Inc").json()

    def post(self, client, path, **body):
        return client.post(f"{API}/{path}", body, format="json")

    def invite(self, email="bob@example.com", role="member", by=None):
        response = self.post(by or self.alice, "org-invitations", org=self.org["id"], email=email, role=role)
        self.assertEqual(response.status_code, 201, response.content)
        return response.json()

    def join(self, client, email, role="member"):
        token = self.invite(email, role)["token"]
        response = self.post(client, f"org-invitations/token/{token}/accept")
        self.assertEqual(response.status_code, 200, response.content)

    def membership(self, client, user_id):
        rows = client.get(f"{API}/org-members", {"filter{org}": self.org["id"]}).json()["items"]
        return next(row for row in rows if row["user_id"] == user_id)

    # --- invitations -----------------------------------------------------

    def test_creator_is_owner(self):
        self.assertEqual(self.org["my_role"], "owner")
        me = self.membership(self.alice, self.alice.user_id)
        self.assertEqual((me["role"], me["name"], me["email"]), ("owner", "Alice", "alice@example.com"))

    def test_invite_and_accept(self):
        invitation = self.invite("Bob@Example.com", "admin")
        self.assertEqual(invitation["email"], "bob@example.com")

        received = self.bob.get(f"{API}/org-invitations/received").json()["items"]
        self.assertEqual([row["org"]["name"] for row in received], ["Alice Inc"])
        self.assertEqual(received[0]["invited_by"]["name"], "Alice")
        self.assertEqual(self.carol.get(f"{API}/org-invitations/received").json()["items"], [])

        accepted = self.post(self.bob, f"org-invitations/token/{invitation['token']}/accept")
        self.assertEqual(accepted.status_code, 200, accepted.content)
        self.assertIn(self.org["id"], ids(self.bob.get(f"{API}/orgs")))
        self.assertEqual(self.membership(self.alice, self.bob.user_id)["role"], "admin")
        self.assertEqual(self.bob.get(f"{API}/org-invitations/received").json()["items"], [])
        # Used up.
        again = self.post(self.bob, f"org-invitations/token/{invitation['token']}/accept")
        self.assertEqual(again.status_code, 400)

    def test_only_the_addressee_can_accept(self):
        token = self.invite()["token"]
        preview = self.carol.get(f"{API}/org-invitations/token/{token}").json()
        self.assertFalse(preview["for_me"])
        self.assertEqual(self.post(self.carol, f"org-invitations/token/{token}/accept").status_code, 403)
        self.assertNotIn(self.org["id"], ids(self.carol.get(f"{API}/orgs")))

    def test_public_preview_says_whether_to_sign_up(self):
        anonymous = APIClient()
        for email, has_account in (("bob@example.com", True), ("newcomer@example.com", False)):
            token = self.invite(email)["token"]
            body = anonymous.get(f"{API}/org-invitations/token/{token}/public").json()
            self.assertEqual((body["email"], body["has_account"], body["org"]["name"]), (email, has_account, "Alice Inc"))
            self.assertEqual(body["signup_page"], "/auth/signup")
            self.assertNotIn("token", body)
        self.assertEqual(anonymous.get(f"{API}/org-invitations/token/nope/public").status_code, 404)

    def test_decline(self):
        token = self.invite()["token"]
        self.assertEqual(self.post(self.bob, f"org-invitations/token/{token}/decline").status_code, 204)
        self.assertEqual(self.post(self.bob, f"org-invitations/token/{token}/accept").status_code, 400)
        self.assertNotIn(self.org["id"], ids(self.bob.get(f"{API}/orgs")))

    def test_revoke(self):
        invitation = self.invite()
        self.assertEqual(self.alice.delete(f"{API}/org-invitations/{invitation['id']}").status_code, 204)
        self.assertEqual(self.post(self.bob, f"org-invitations/token/{invitation['token']}/accept").status_code, 404)

    def test_duplicate_pending_invitation_is_rejected(self):
        self.invite()
        response = self.post(self.alice, "org-invitations", org=self.org["id"], email="bob@example.com")
        self.assertEqual(response.status_code, 400)

    def test_members_cannot_invite_or_see_invitations(self):
        self.join(self.bob, "bob@example.com")
        self.invite("dave@example.com")
        self.assertEqual(ids(self.bob.get(f"{API}/org-invitations")), set())
        response = self.post(self.bob, "org-invitations", org=self.org["id"], email="erin@example.com")
        self.assertEqual(response.status_code, 403)

    def test_outsiders_cannot_invite_into_an_org(self):
        response = self.post(self.carol, "org-invitations", org=self.org["id"], email="carol@example.com")
        self.assertIn(response.status_code, (403, 404))
        self.assertEqual(ids(self.carol.get(f"{API}/org-members")), set())

    # --- roles -----------------------------------------------------------

    def test_member_can_leave_but_not_manage(self):
        self.join(self.bob, "bob@example.com")
        self.join(self.carol, "carol@example.com")
        carol = self.membership(self.bob, self.carol.user_id)
        self.assertEqual(self.bob.patch(f"{API}/org-members/{carol['id']}", {"role": "admin"}, format="json").status_code, 403)
        self.assertEqual(self.bob.delete(f"{API}/org-members/{carol['id']}").status_code, 403)
        # Only `role` is writable.
        bob = self.membership(self.bob, self.bob.user_id)
        self.bob.patch(f"{API}/org-members/{bob['id']}", {"user_id": self.carol.user_id}, format="json")
        self.assertEqual(self.membership(self.alice, self.bob.user_id)["id"], bob["id"])

        self.assertEqual(self.bob.delete(f"{API}/org-members/{bob['id']}").status_code, 204)
        self.assertNotIn(self.org["id"], ids(self.bob.get(f"{API}/orgs")))

    def test_admin_manages_members_but_not_owners(self):
        self.join(self.bob, "bob@example.com", "admin")
        self.join(self.carol, "carol@example.com")
        carol = self.membership(self.bob, self.carol.user_id)
        alice = self.membership(self.bob, self.alice.user_id)
        self.assertEqual(self.bob.patch(f"{API}/org-members/{carol['id']}", {"role": "admin"}, format="json").status_code, 200)
        self.assertEqual(self.bob.patch(f"{API}/org-members/{carol['id']}", {"role": "owner"}, format="json").status_code, 403)
        self.assertEqual(self.bob.patch(f"{API}/org-members/{alice['id']}", {"role": "member"}, format="json").status_code, 403)
        self.assertEqual(self.bob.delete(f"{API}/org-members/{alice['id']}").status_code, 403)
        self.assertEqual(self.bob.delete(f"{API}/org-members/{carol['id']}").status_code, 204)
        # Admins rename, only owners delete.
        self.assertEqual(self.bob.patch(f"{API}/orgs/{self.org['id']}", {"name": "Renamed"}, format="json").status_code, 200)
        self.assertEqual(self.bob.delete(f"{API}/orgs/{self.org['id']}").status_code, 403)

    def test_org_always_keeps_an_owner(self):
        alice = self.membership(self.alice, self.alice.user_id)
        self.assertEqual(self.alice.delete(f"{API}/org-members/{alice['id']}").status_code, 400)
        self.assertEqual(self.alice.patch(f"{API}/org-members/{alice['id']}", {"role": "admin"}, format="json").status_code, 400)

        self.join(self.bob, "bob@example.com")
        bob = self.membership(self.alice, self.bob.user_id)
        self.assertEqual(self.alice.patch(f"{API}/org-members/{bob['id']}", {"role": "owner"}, format="json").status_code, 200)
        self.assertEqual(self.alice.delete(f"{API}/org-members/{alice['id']}").status_code, 204)

    def test_plain_members_cannot_rename_the_org(self):
        self.join(self.bob, "bob@example.com")
        response = self.bob.patch(f"{API}/orgs/{self.org['id']}", {"name": "Bob's now"}, format="json")
        self.assertEqual(response.status_code, 403)

    # --- shared goals ----------------------------------------------------

    def test_org_goals_are_shared_with_members_only(self):
        goal = self.post(self.alice, "goals", title="Team goal", org_id=self.org["id"]).json()
        personal = self.post(self.alice, "goals", title="Alice's own").json()
        metric = self.post(self.alice, "metrics", goal=goal["id"], name="Revenue", target_value=100).json()

        self.join(self.bob, "bob@example.com")
        self.assertEqual(ids(self.bob.get(f"{API}/goals")), {goal["id"]})
        self.assertEqual(ids(self.bob.get(f"{API}/metrics")), {metric["id"]})
        # Members work on the org's goals.
        check_in = self.post(self.bob, "check-ins", metric=metric["id"], value=40)
        self.assertEqual(check_in.status_code, 201, check_in.content)
        self.assertEqual(self.post(self.bob, "goals", title="Bob's team goal", org_id=self.org["id"]).status_code, 201)
        self.assertEqual(self.bob.get(f"{API}/goals/{personal['id']}").status_code, 404)

        # Outsiders see none of it.
        self.assertEqual(ids(self.carol.get(f"{API}/goals")), set())
        self.assertEqual(self.post(self.carol, "check-ins", metric=metric["id"], value=1).status_code, 404)

        # Leaving ends access.
        bob = self.membership(self.bob, self.bob.user_id)
        self.bob.delete(f"{API}/org-members/{bob['id']}")
        self.assertEqual(ids(self.bob.get(f"{API}/goals")), set())

    # --- private goals and goal members ------------------------------------

    def share(self, client, goal, user_id):
        return self.post(client, "goal-members", goal=goal["id"], user_id=user_id)

    def test_private_goal_is_seen_by_its_owner_and_members_only(self):
        self.join(self.bob, "bob@example.com")
        self.join(self.carol, "carol@example.com")
        public = self.post(self.alice, "goals", title="Team goal", org_id=self.org["id"]).json()
        private = self.post(self.alice, "goals", title="Secret", org_id=self.org["id"], visibility="private").json()
        metric = self.post(self.alice, "metrics", goal=private["id"], name="Revenue", target_value=100).json()
        self.assertEqual((public["visibility"], private["visibility"]), ("public", "private"))

        self.assertEqual(ids(self.alice.get(f"{API}/goals")), {public["id"], private["id"]})
        for client in (self.bob, self.carol):
            self.assertEqual(ids(client.get(f"{API}/goals")), {public["id"]})
            self.assertEqual(client.get(f"{API}/goals/{private['id']}").status_code, 404)
            self.assertEqual(self.post(client, "check-ins", metric=metric["id"], value=1).status_code, 404)

        # Shared with Bob: he sees it and its metrics, Carol still doesn't.
        member = self.share(self.alice, private, self.bob.user_id)
        self.assertEqual(member.status_code, 201, member.content)
        self.assertEqual(ids(self.bob.get(f"{API}/goals")), {public["id"], private["id"]})
        self.assertEqual(ids(self.bob.get(f"{API}/metrics")), {metric["id"]})
        self.assertEqual(self.post(self.bob, "check-ins", metric=metric["id"], value=1).status_code, 201)
        self.assertEqual(ids(self.carol.get(f"{API}/goals")), {public["id"]})
        self.assertEqual(ids(self.bob.get(f"{API}/goal-members")), {member.json()["id"]})
        self.assertEqual(ids(self.carol.get(f"{API}/goal-members")), set())

        # Made public: the whole org sees it.
        self.alice.patch(f"{API}/goals/{private['id']}", {"visibility": "public"}, format="json")
        self.assertIn(private["id"], ids(self.carol.get(f"{API}/goals")))

    def test_only_the_owner_manages_visibility_and_members(self):
        self.join(self.bob, "bob@example.com")
        self.join(self.carol, "carol@example.com")
        goal = self.post(self.alice, "goals", title="Secret", org_id=self.org["id"], visibility="private").json()
        self.assertEqual(self.share(self.alice, goal, self.bob.user_id).status_code, 201)

        # Bob sees it but can't share it on, or open it up.
        self.assertEqual(self.share(self.bob, goal, self.carol.user_id).status_code, 403)
        response = self.bob.patch(f"{API}/goals/{goal['id']}", {"visibility": "public"}, format="json")
        self.assertEqual(response.status_code, 403)
        # Other edits are fine.
        response = self.bob.patch(f"{API}/goals/{goal['id']}", {"title": "Secret v2"}, format="json")
        self.assertEqual(response.status_code, 200, response.content)

        # The owner can remove a member; a member can leave.
        carol = self.share(self.alice, goal, self.carol.user_id).json()
        bob = next(row for row in self.alice.get(f"{API}/goal-members").json()["items"] if row["user_id"] == self.bob.user_id)
        self.assertEqual(self.bob.delete(f"{API}/goal-members/{carol['id']}").status_code, 403)
        self.assertEqual(self.bob.delete(f"{API}/goal-members/{bob['id']}").status_code, 204)
        self.assertEqual(ids(self.bob.get(f"{API}/goals")), set())
        self.assertEqual(self.alice.delete(f"{API}/goal-members/{carol['id']}").status_code, 204)
        self.assertEqual(ids(self.carol.get(f"{API}/goals")), set())

    def test_only_org_members_can_be_added(self):
        self.join(self.bob, "bob@example.com")
        goal = self.post(self.alice, "goals", title="Secret", org_id=self.org["id"], visibility="private").json()
        personal = self.post(self.alice, "goals", title="Mine").json()
        self.assertEqual(self.share(self.alice, goal, self.carol.user_id).status_code, 400)  # not in the org
        self.assertEqual(self.share(self.alice, goal, self.alice.user_id).status_code, 400)  # the owner
        self.assertEqual(self.share(self.alice, personal, self.bob.user_id).status_code, 400)  # no org
        self.assertEqual(self.share(self.alice, goal, self.bob.user_id).status_code, 201)
        self.assertEqual(self.share(self.alice, goal, self.bob.user_id).status_code, 400)  # already in
        self.assertEqual(ids(self.carol.get(f"{API}/goals")), set())

    def test_leaving_the_org_ends_access_to_a_shared_private_goal(self):
        self.join(self.bob, "bob@example.com")
        goal = self.post(self.alice, "goals", title="Secret", org_id=self.org["id"], visibility="private").json()
        self.share(self.alice, goal, self.bob.user_id)
        bob = self.membership(self.bob, self.bob.user_id)
        self.bob.delete(f"{API}/org-members/{bob['id']}")
        self.assertEqual(ids(self.bob.get(f"{API}/goals")), set())
