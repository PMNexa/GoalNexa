"""System administration end to end, through main's real stack: system
settings (editable / env-locked), the audit log, the email outbox, and
account administration - signup policy, email verification, password
reset, invitations, disabling, sessions, and deleting a user with or
without handing their data to someone else.

`python manage.py test tests` in apps/main/backend.
"""

import json
import os
import re
from urllib.parse import unquote
from unittest import mock

from django.core import mail
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from goalnexa.models import Goal
from platform_auth.models import User
from platform_mcp.models import PersonalAccessToken
from platform_org.models import OrgMembership, Organization
from platform_system.models import AuditEvent, OutgoingEmail

API = "/api/v1"
PASSWORD = "correct-horse-battery"


def client_for(response) -> APIClient:
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.json()['access_token']}")
    client.user_id = response.json()["user"]["id"]
    return client


def link_token(text) -> str:
    text = getattr(text, "body", text)
    return unquote(re.search(r"token=([^\s&]+)", text).group(1))


@override_settings(EMAIL_CONFIGURED=True)
class AdminTestCase(TestCase):
    def setUp(self):
        self.anon = APIClient()
        setup = self.anon.post(f"{API}/auth/setup", {"name": "Ada Admin", "email": "ada@example.com", "password": PASSWORD}, format="json")
        self.assertEqual(setup.status_code, 200, setup.content)
        self.admin = client_for(setup)
        self.bob = self.signup("Bob", "bob@example.com")

    def signup(self, name, email, expect=200):
        response = APIClient().post(f"{API}/auth/signup", {"name": name, "email": email, "password": PASSWORD}, format="json")
        self.assertEqual(response.status_code, expect, response.content)
        return client_for(response) if expect == 200 else response

    def login(self, email, password=PASSWORD):
        return APIClient().post(f"{API}/auth/login", {"email": email, "password": password}, format="json")

    def set_setting(self, key, value, client=None):
        return (client or self.admin).patch(f"{API}/system-settings/{key}", {"value": value}, format="json")

    def actions(self):
        return list(AuditEvent.objects.order_by("created_at").values_list("action", flat=True))


class SystemSettingsTests(AdminTestCase):
    def test_admin_lists_settings_and_read_only_info(self):
        response = self.admin.get(f"{API}/system-settings")
        self.assertEqual(response.status_code, 200)
        keys = {s["key"]: s for s in response.json()["settings"]}
        for key in ("auth.signup_policy", "auth.require_email_verification", "email.from_name", "reminders.allowed_schemes"):
            self.assertIn(key, keys)
        self.assertEqual(keys["auth.signup_policy"]["source"], "default")
        groups = {g["group"]: g for g in response.json()["info"]}
        self.assertIn("Database", groups)
        secrets = {row["label"]: row["value"] for row in groups["Secrets"]["rows"]}
        self.assertIn(secrets["Login token secret"], ("set", "insecure default", "missing"))

    def test_members_cant_see_or_change_settings(self):
        self.assertEqual(self.bob.get(f"{API}/system-settings").status_code, 403)
        self.assertEqual(self.set_setting("auth.signup_policy", "closed", self.bob).status_code, 403)
        self.assertEqual(self.bob.get(f"{API}/audit-events").status_code, 403)

    def test_save_validate_reset_and_audit(self):
        self.assertEqual(self.set_setting("auth.signup_policy", "nonsense").status_code, 400)
        response = self.set_setting("auth.signup_policy", "closed")
        self.assertEqual((response.status_code, response.json()["value"], response.json()["source"]), (200, "closed", "saved"))
        event = AuditEvent.objects.get(action="settings.updated")
        self.assertEqual((event.data["before"], event.data["after"], event.actor_email), ("open", "closed", "ada@example.com"))
        reset = self.admin.delete(f"{API}/system-settings/auth.signup_policy")
        self.assertEqual(reset.json()["value"], "open")

    def test_env_locks_a_setting(self):
        with mock.patch.dict(os.environ, {"AUTH_SIGNUP_POLICY": "closed"}):
            described = {s["key"]: s for s in self.admin.get(f"{API}/system-settings").json()["settings"]}
            self.assertEqual(described["auth.signup_policy"]["source"], "env")
            self.assertFalse(described["auth.signup_policy"]["editable"])
            self.assertEqual(self.set_setting("auth.signup_policy", "open").status_code, 403)
            self.signup("Eve", "eve@example.com", expect=403)

    def test_test_email_and_outbox(self):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.admin.post(f"{API}/system-settings/test-email", {}, format="json")
        self.assertEqual(response.json()["status"], "sent")
        self.assertEqual(mail.outbox[-1].to, ["ada@example.com"])
        self.assertIn("GoalNexa", mail.outbox[-1].from_email)
        self.assertEqual(self.admin.get(f"{API}/outgoing-emails").json()["items"][0]["kind"], "test")

    @override_settings(EMAIL_CONFIGURED=False)
    def test_unconfigured_email_is_logged_not_sent(self):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.admin.post(f"{API}/system-settings/test-email", {}, format="json")
        self.assertEqual(response.json()["status"], "failed")
        self.assertIn("EMAIL_URL", response.json()["error"])
        self.assertEqual(mail.outbox, [])


class SignupPolicyTests(AdminTestCase):
    def test_closed_and_domains(self):
        self.set_setting("auth.signup_policy", "closed")
        self.assertEqual(self.signup("Eve", "eve@example.com", expect=403).json()["code"], "signup_closed")
        self.set_setting("auth.signup_policy", "open")
        self.set_setting("auth.allowed_email_domains", "acme.com\nexample.org")
        self.assertEqual(self.signup("Eve", "eve@gmail.com", expect=403).json()["code"], "signup_domain")
        self.signup("Eve", "eve@acme.com")

    def test_invite_only_lets_invited_emails_in(self):
        self.set_setting("auth.signup_policy", "invite_only")
        self.assertEqual(self.signup("Eve", "eve@example.com", expect=403).json()["code"], "signup_invite_only")
        org = self.admin.post(f"{API}/orgs", {"name": "Acme"}, format="json").json()
        with self.captureOnCommitCallbacks(execute=True):
            self.admin.post(f"{API}/org-invitations", {"org": org["id"], "email": "eve@example.com"}, format="json")
        self.assertIn("/platform-org/invitations/", mail.outbox[-1].body)  # invitations are emailed now
        self.signup("Eve", "eve@example.com")


class VerificationAndResetTests(AdminTestCase):
    def test_verification_flow(self):
        self.set_setting("auth.require_email_verification", True)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.signup("Eve", "eve@example.com", expect=201)
        self.assertTrue(response.json()["verification_required"])
        self.assertEqual(self.login("eve@example.com").json()["code"], "email_unverified")
        token = link_token(mail.outbox[-1])
        self.assertIn("/auth/verify?token=", mail.outbox[-1].body)
        verified = self.anon.post(f"{API}/auth/verify-email", {"token": token}, format="json")
        self.assertEqual(verified.status_code, 200, verified.content)
        self.assertEqual(self.login("eve@example.com").status_code, 200)
        # Existing accounts count as verified.
        self.assertEqual(self.login("bob@example.com").status_code, 200)

    def test_confirmation_link_returns_to_where_the_signup_was_heading(self):
        """Someone connecting an AI client with no account: signup, confirm,
        and back on the consent page - not the dashboard."""
        self.set_setting("auth.require_email_verification", True)
        heading_to = "/mcp/authorize?client_id=abc123&state=xyz"
        body = {"name": "Eve", "email": "eve@example.com", "password": "a-long-password", "next": heading_to, "ref": "claude"}
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.anon.post(f"{API}/auth/signup", body, format="json").status_code, 201)
        self.assertIn("next=%2Fmcp%2Fauthorize%3Fclient_id%3Dabc123%26state%3Dxyz", mail.outbox[-1].body)
        # A resend keeps it too.
        with self.captureOnCommitCallbacks(execute=True):
            self.anon.post(f"{API}/auth/resend-verification", {"email": "eve@example.com", "next": heading_to}, format="json")
        self.assertIn("next=%2Fmcp%2Fauthorize", mail.outbox[-1].body)
        # The audit event says where the signup came from - the path, the client, the ref; not the query.
        event = self.admin.get(f"{API}/audit-events?filter{{action}}=auth.signup&sort=-created_at").json()["items"][0]
        self.assertEqual(
            {k: event["data"].get(k) for k in ("next", "client_id", "ref")},
            {"next": "/mcp/authorize", "client_id": "abc123", "ref": "claude"},
        )
        # Another site is never put in the link.
        for bad in ("https://evil.example/x", "//evil.example/x", "/\\evil.example"):
            body = {"name": "Mal", "email": f"mal{len(mail.outbox)}@example.com", "password": "a-long-password", "next": bad}
            with self.captureOnCommitCallbacks(execute=True):
                self.assertEqual(self.anon.post(f"{API}/auth/signup", body, format="json").status_code, 201)
            self.assertNotIn("next=", mail.outbox[-1].body)

    @override_settings(EMAIL_CONFIGURED=False)
    def test_verification_needs_email_to_be_enforced(self):
        self.set_setting("auth.require_email_verification", True)
        self.signup("Eve", "eve@example.com")  # logged in right away - nothing could be sent

    def test_forgot_and_reset_password(self):
        old_session = self.login("bob@example.com")
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.anon.post(f"{API}/auth/password/forgot", {"email": "bob@example.com"}, format="json").status_code, 204)
            self.assertEqual(self.anon.post(f"{API}/auth/password/forgot", {"email": "nobody@example.com"}, format="json").status_code, 204)
        self.assertEqual(len(mail.outbox), 1)
        token = link_token(mail.outbox[0])
        reset = self.anon.post(f"{API}/auth/password/reset", {"token": token, "password": "a-new-password"}, format="json")
        self.assertEqual(reset.status_code, 200, reset.content)
        self.assertEqual(self.login("bob@example.com").status_code, 401)
        self.assertEqual(self.login("bob@example.com", "a-new-password").status_code, 200)
        # One use only, and every other session ended.
        again = self.anon.post(f"{API}/auth/password/reset", {"token": token, "password": "another-one"}, format="json")
        self.assertEqual(again.json()["code"], "invalid_link")
        refresh = APIClient()
        refresh.cookies["refresh_token"] = old_session.cookies["refresh_token"].value
        self.assertEqual(refresh.post(f"{API}/auth/refresh").status_code, 401)
        self.assertIn("auth.password_reset", self.actions())

    def test_bad_link(self):
        response = self.anon.post(f"{API}/auth/verify-email", {"token": "nope"}, format="json")
        self.assertEqual(response.json()["code"], "invalid_link")


class UserAdminTests(AdminTestCase):
    def user(self, email):
        return User.objects.get(email=email)

    def test_invite_sets_password_by_link(self):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.admin.post(f"{API}/users/invite", {"name": "Ivy", "email": "ivy@example.com"}, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        self.assertIn("token=", response.json()["set_password_url"])
        self.assertEqual(mail.outbox[-1].to, ["ivy@example.com"])
        self.assertEqual(self.login("ivy@example.com", "!").status_code, 401)
        token = link_token(mail.outbox[-1])
        self.assertEqual(self.anon.post(f"{API}/auth/password/reset", {"token": token, "password": "ivy-password"}, format="json").status_code, 200)
        self.assertEqual(self.login("ivy@example.com", "ivy-password").status_code, 200)
        self.assertEqual(self.bob.post(f"{API}/users/invite", {"name": "X", "email": "x@example.com"}, format="json").status_code, 403)

    def test_disable_takes_effect_now_and_enable_restores(self):
        bob = self.user("bob@example.com")
        PersonalAccessToken.issue(user_id=bob.id, name="laptop")
        response = self.admin.post(f"{API}/users/{bob.id}/disable")
        self.assertEqual((response.status_code, response.json()["is_active"]), (200, False))
        self.assertEqual(self.bob.get(f"{API}/goals").status_code, 401)  # access token refused at once
        self.assertEqual(self.login("bob@example.com").json()["code"], "account_disabled")
        self.assertFalse(PersonalAccessToken.objects.filter(user_id=str(bob.id)).exists())
        self.admin.post(f"{API}/users/{bob.id}/enable")
        self.assertEqual(self.login("bob@example.com").status_code, 200)
        self.assertEqual(self.actions().count("user.disabled"), 1)

    def test_cant_disable_or_delete_yourself_or_the_last_admin(self):
        me = self.admin.user_id
        self.assertEqual(self.admin.post(f"{API}/users/{me}/disable").status_code, 400)
        self.assertEqual(self.admin.delete(f"{API}/users/{me}").status_code, 400)
        admin_assignment = self.admin.get(f"{API}/role-assignments?filter{{user}}={me}").json()["items"][0]
        self.assertEqual(self.admin.delete(f"{API}/role-assignments/{admin_assignment['id']}").status_code, 400)

    def test_sessions_list_and_revoke(self):
        bob = self.user("bob@example.com")
        self.login("bob@example.com")
        PersonalAccessToken.issue(user_id=bob.id, name="laptop")
        sessions = self.admin.get(f"{API}/users/{bob.id}/sessions").json()
        self.assertEqual(len(sessions["logins"]), 2)  # signup + login
        tokens = next(group for group in sessions["other"] if group["kind"] == "mcp_tokens")
        self.assertEqual(len(tokens["items"]), 1)
        self.assertEqual(self.admin.post(f"{API}/users/{bob.id}/revoke-sessions").json()["revoked"], 3)
        self.assertEqual(self.admin.get(f"{API}/users/{bob.id}/sessions").json()["logins"], [])

    def test_reset_link(self):
        bob = self.user("bob@example.com")
        url = self.admin.post(f"{API}/users/{bob.id}/reset-link").json()["url"]
        token = link_token(url)
        self.assertEqual(self.anon.post(f"{API}/auth/password/reset", {"token": token, "password": "from-admin-link"}, format="json").status_code, 200)

    def test_delete_with_transfer_hands_everything_over(self):
        bob = self.user("bob@example.com")
        org = self.bob.post(f"{API}/orgs", {"name": "Bob Co"}, format="json").json()
        goal = self.bob.post(f"{API}/goals", {"title": "Bob's goal", "org_id": org["id"]}, format="json").json()
        personal = self.bob.post(f"{API}/goals", {"title": "Bob's own"}, format="json").json()
        response = self.admin.delete(f"{API}/users/{bob.id}?transfer_to={self.admin.user_id}")
        self.assertEqual(response.status_code, 204, getattr(response, "content", b""))
        self.assertFalse(User.objects.filter(id=bob.id).exists())
        self.assertEqual(str(Goal.objects.get(id=goal["id"]).owner_id), self.admin.user_id)
        self.assertEqual(str(Goal.objects.get(id=personal["id"]).owner_id), self.admin.user_id)
        self.assertEqual(OrgMembership.objects.get(org_id=org["id"]).role, "owner")
        self.assertEqual(str(OrgMembership.objects.get(org_id=org["id"]).user_id), self.admin.user_id)
        event = AuditEvent.objects.get(action="user.deleted")
        self.assertEqual((event.target_label, event.data["transferred_to_email"]), ("Bob <bob@example.com>", "ada@example.com"))

    def test_delete_without_transfer_erases(self):
        bob = self.user("bob@example.com")
        org = self.bob.post(f"{API}/orgs", {"name": "Solo"}, format="json").json()
        self.bob.post(f"{API}/goals", {"title": "Gone"}, format="json")
        shared = self.admin.post(f"{API}/orgs", {"name": "Shared"}, format="json").json()
        token = self.admin.post(f"{API}/org-invitations", {"org": shared["id"], "email": "bob@example.com", "role": "admin"}, format="json").json()["token"]
        self.bob.post(f"{API}/org-invitations/token/{token}/accept")
        self.assertEqual(self.admin.delete(f"{API}/users/{bob.id}").status_code, 204)
        self.assertFalse(Goal.objects.filter(title="Gone").exists())
        self.assertFalse(Organization.objects.filter(id=org["id"]).exists())  # nobody left in it
        self.assertTrue(Organization.objects.filter(id=shared["id"]).exists())
        self.assertFalse(OrgMembership.objects.filter(user_id=bob.id).exists())


class AuditLogTests(AdminTestCase):
    def test_logins_and_failures_are_recorded_and_exported(self):
        self.login("bob@example.com", "wrong-password")
        self.login("bob@example.com")
        failed = AuditEvent.objects.filter(action="auth.login_failed").get()
        self.assertEqual((failed.target_label, failed.data["reason"]), ("bob@example.com", "bad_credentials"))
        self.assertTrue(failed.ip)
        listed = self.admin.get(f"{API}/audit-events?filter{{action}}=auth.login").json()["items"]
        self.assertEqual([e["actor_email"] for e in listed], ["bob@example.com"])
        export = self.admin.get(f"{API}/audit-events/export?q=login_failed")
        self.assertEqual(export["Content-Type"], "text/csv")
        self.assertIn("auth.login_failed", export.content.decode())
        self.assertNotIn("auth.signup", export.content.decode())

    def test_role_changes_are_recorded(self):
        bob = User.objects.get(email="bob@example.com")
        roles = {r["name"]: r["id"] for r in self.admin.get(f"{API}/roles").json()["items"]}
        self.admin.post(f"{API}/role-assignments", {"user": str(bob.id), "role": roles["Viewer"]}, format="json")
        self.assertIn("role.assigned", self.actions())

    def test_email_outbox_rows_record_kind(self):
        with self.captureOnCommitCallbacks(execute=True):
            self.anon.post(f"{API}/auth/password/forgot", {"email": "bob@example.com"}, format="json")
        self.assertEqual(OutgoingEmail.objects.get().kind, "password_reset")


class OperationsTests(AdminTestCase):
    """Phase 3: status page, notification log, announcement, all organizations."""

    def test_status_reports_scheduler_deliveries_and_usage(self):
        from core_api.system import heartbeat, log_delivery

        heartbeat("goalnexa_jobs", result={"digests": 1})
        heartbeat("broken_job", ok=False, error="boom")
        log_delivery("apprise", "reminder", user_id="x", target="tgram", ok=False, error="bad token")
        status = self.admin.get(f"{API}/system-settings/status").json()
        jobs = {j["name"]: j for j in status["jobs"]}
        self.assertEqual((jobs["goalnexa_jobs"]["state"], jobs["broken_job"]["state"]), ("ok", "failing"))
        self.assertEqual(status["notifications_24h"]["failed"], 1)
        groups = {g["group"]: {r["label"]: r["value"] for r in g["rows"]} for g in status["usage"]}
        self.assertEqual(groups["Accounts"]["Users"], 2)
        self.assertIn("Goals in progress", groups["Goals"])
        self.assertIn("Organizations", groups["Organizations"])
        self.assertEqual(self.bob.get(f"{API}/system-settings/status").status_code, 403)
        self.assertEqual(self.admin.get(f"{API}/delivery-attempts").json()["items"][0]["target"], "tgram")

    def test_announcement(self):
        self.assertEqual(self.bob.get(f"{API}/announcement").json()["text"], "")
        self.set_setting("system.announcement", "Maintenance Sunday 02:00 UTC")
        self.set_setting("system.announcement_level", "warning")
        banner = self.bob.get(f"{API}/announcement").json()
        self.assertEqual((banner["text"], banner["level"]), ("Maintenance Sunday 02:00 UTC", "warning"))
        self.assertTrue(banner["id"])

    def test_all_orgs_admin(self):
        org = self.bob.post(f"{API}/orgs", {"name": "Bob Co"}, format="json").json()
        goal = self.bob.post(f"{API}/goals", {"title": "Bob goal", "org_id": org["id"]}, format="json").json()
        self.assertEqual(self.bob.get(f"{API}/all-orgs").status_code, 403)
        listed = {o["id"]: o for o in self.admin.get(f"{API}/all-orgs").json()["items"]}
        self.assertEqual(listed[org["id"]]["member_count"], 1)
        members = self.admin.get(f"{API}/all-orgs/{org['id']}/members").json()
        self.assertEqual((members[0]["email"], members[0]["role"]), ("bob@example.com", "owner"))
        self.assertEqual(self.admin.post(f"{API}/all-orgs/{org['id']}/transfer-owner", {"user_id": self.admin.user_id}, format="json").status_code, 200)
        roles = {str(m.user_id): m.role for m in OrgMembership.objects.filter(org_id=org["id"])}
        self.assertEqual((roles[self.admin.user_id], roles[self.bob.user_id]), ("owner", "admin"))
        self.assertEqual(self.admin.delete(f"{API}/all-orgs/{org['id']}").status_code, 204)
        self.assertFalse(Goal.objects.filter(id=goal["id"]).exists())  # its goals went with it
        self.assertIn("org.deleted", self.actions())

    def test_owner_deleting_an_org_removes_its_goals(self):
        org = self.bob.post(f"{API}/orgs", {"name": "Bob Co"}, format="json").json()
        self.bob.post(f"{API}/goals", {"title": "Orphan?", "org_id": org["id"]}, format="json")
        self.assertEqual(self.bob.delete(f"{API}/orgs/{org['id']}").status_code, 204)
        self.assertFalse(Goal.objects.filter(title="Orphan?").exists())


class SupportTests(AdminTestCase):
    """Phase 4: org limits, view-as-user, data export and erasure."""

    def test_org_limits(self):
        org = self.bob.post(f"{API}/orgs", {"name": "Small"}, format="json").json()
        self.set_setting("limits.max_goals", 1)
        self.assertEqual(self.bob.post(f"{API}/goals", {"title": "One", "org_id": org["id"]}, format="json").status_code, 201)
        second = self.bob.post(f"{API}/goals", {"title": "Two", "org_id": org["id"]}, format="json")
        self.assertEqual((second.status_code, second.json()["code"]), (403, "limit_reached"))
        self.assertEqual(self.bob.post(f"{API}/goals", {"title": "Personal"}, format="json").status_code, 201)
        # A per-org override wins over the setting.
        self.assertEqual(self.admin.patch(f"{API}/all-orgs/{org['id']}", {"limits": {"max_goals": 5, "max_members": 1}}, format="json").status_code, 200)
        self.assertEqual(self.bob.post(f"{API}/goals", {"title": "Two", "org_id": org["id"]}, format="json").status_code, 201)
        invite = self.bob.post(f"{API}/org-invitations", {"org": org["id"], "email": "x@example.com"}, format="json")
        self.assertEqual(invite.json()["code"], "limit_reached")
        self.assertEqual(self.admin.patch(f"{API}/all-orgs/{org['id']}", {"limits": {"max_goals": -1}}, format="json").status_code, 400)

    def test_view_as_user_is_read_only_and_audited(self):
        bob = User.objects.get(email="bob@example.com")
        self.bob.post(f"{API}/goals", {"title": "Bob's"}, format="json")
        self.assertEqual(self.bob.post(f"{API}/users/{self.admin.user_id}/impersonate").status_code, 403)
        token = self.admin.post(f"{API}/users/{bob.id}/impersonate").json()["access_token"]
        viewer = APIClient()
        viewer.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual([g["title"] for g in viewer.get(f"{API}/goals").json()["items"]], ["Bob's"])
        me = viewer.get(f"{API}/auth/me").json()
        self.assertEqual((me["email"], me["impersonated_by"]["email"]), ("bob@example.com", "ada@example.com"))
        write = viewer.post(f"{API}/goals", {"title": "nope"}, format="json")
        self.assertEqual((write.status_code, write.json()["code"]), (403, "read_only_view"))
        self.assertEqual(viewer.get(f"{API}/auth/me/export").status_code, 403)
        self.assertIn("user.impersonated", self.actions())

    def test_export_my_data(self):
        org = self.bob.post(f"{API}/orgs", {"name": "Bob Co"}, format="json").json()
        goal = self.bob.post(f"{API}/goals", {"title": "Mine"}, format="json").json()
        metric = self.bob.post(f"{API}/metrics", {"goal": goal["id"], "name": "km", "target_value": 10}, format="json").json()
        self.bob.post(f"{API}/check-ins", {"metric": metric["id"], "value": 3}, format="json")
        response = self.bob.get(f"{API}/auth/me/export")
        self.assertIn("attachment", response["Content-Disposition"])
        data = json.loads(response.content)
        self.assertEqual(data["profile"]["email"], "bob@example.com")
        self.assertEqual(data["goals"]["goals"][0]["metrics"][0]["check_ins"][0]["value"], "3.00")
        self.assertEqual(data["organizations"]["memberships"][0]["org"], "Bob Co")
        self.assertNotIn("password", response.content.decode())
        self.assertEqual(self.admin.get(f"{API}/users/{self.bob.user_id}/export").status_code, 200)
        self.assertIn("user.data_exported", self.actions())
        self.assertTrue(org)

    def test_change_my_password(self):
        other_session = self.login("bob@example.com")
        url = f"{API}/auth/me/password"
        wrong = self.bob.post(url, {"current_password": "wrong", "new_password": "a-new-password"}, format="json")
        self.assertEqual(wrong.json()["code"], "wrong_password")
        self.assertEqual(self.bob.post(url, {"current_password": PASSWORD, "new_password": "short"}, format="json").status_code, 400)
        self.assertEqual(self.anon.post(url, {"current_password": PASSWORD, "new_password": "a-new-password"}, format="json").status_code, 403)
        changed = self.bob.post(url, {"current_password": PASSWORD, "new_password": "a-new-password"}, format="json")
        self.assertEqual(changed.status_code, 200, changed.content)
        self.assertEqual(self.login("bob@example.com").status_code, 401)
        self.assertEqual(self.login("bob@example.com", "a-new-password").status_code, 200)
        # Every other session ended; this one got a new refresh cookie.
        refresh = APIClient()
        refresh.cookies["refresh_token"] = other_session.cookies["refresh_token"].value
        self.assertEqual(refresh.post(f"{API}/auth/refresh").status_code, 401)
        refresh.cookies["refresh_token"] = changed.cookies["refresh_token"].value
        self.assertEqual(refresh.post(f"{API}/auth/refresh").status_code, 200)
        self.assertIn("auth.password_changed", self.actions())

    def test_delete_my_account(self):
        self.bob.post(f"{API}/goals", {"title": "Gone soon"}, format="json")
        self.assertEqual(self.bob.post(f"{API}/auth/me/delete", {"password": "wrong"}, format="json").json()["code"], "wrong_password")
        self.assertEqual(self.bob.post(f"{API}/auth/me/delete", {"password": PASSWORD}, format="json").status_code, 204)
        self.assertFalse(User.objects.filter(email="bob@example.com").exists())
        self.assertFalse(Goal.objects.filter(title="Gone soon").exists())
        self.assertEqual(self.admin.post(f"{API}/auth/me/delete", {"password": PASSWORD}, format="json").json()["code"], "last_admin")


class HealthTests(TestCase):
    """What every compose/stack healthcheck probes - and no Django admin."""

    def test_health_answers_without_auth(self):
        response = APIClient().get("/api/v1/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"ok": True})

    def test_django_admin_is_not_served(self):
        self.assertEqual(APIClient().get("/admin/").status_code, 404)
        self.assertEqual(APIClient().get("/admin/login/").status_code, 404)


class InsightsTests(AdminTestCase):
    """System > Insights (P-28..P-34) and data retention (P-04)."""

    def setUp(self):
        from platform_system.insights import flush_counts, forget_seen

        forget_seen()  # the hourly write gate is per process - start clean
        flush_counts()
        super().setUp()

    def insights(self, days=30, client=None):
        response = (client or self.admin).get(f"{API}/system-settings/insights?days={days}")
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()

    def section(self, data, key):
        return next(s for s in data["sections"] if s["key"] == key)

    def tiles(self, section):
        return {i["label"]: i["value"] for b in section["blocks"] if b["kind"] == "tiles" for i in b["items"]}

    def test_sign_ins_and_mcp_calls_count_as_active_by_channel(self):
        from platform_system.models import UserDay, UserPresence

        days = {d.user_id: d for d in UserDay.objects.all()}
        self.assertTrue(days[self.admin.user_id].web and days[self.bob.user_id].web)
        self.assertTrue(UserPresence.objects.filter(user_id=self.bob.user_id).exists())
        _, raw = PersonalAccessToken.issue(user_id=self.bob.user_id, name="Claude")
        call = APIClient()
        call.credentials(HTTP_AUTHORIZATION=f"Bearer {raw}")
        response = call.post(f"{API}/mcp", {"jsonrpc": "2.0", "id": 1, "method": "tools/call",
                                            "params": {"name": "goals_list", "arguments": {}}}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertTrue(UserDay.objects.get(user_id=self.bob.user_id).agent)
        active = self.tiles(self.section(self.insights(), "active_users"))
        self.assertEqual((active["Active today"], active["Website only"], active["Both"]), (2, 1, 1))
        quality = self.section(self.insights(), "quality")
        tools = next(b for b in quality["blocks"] if b.get("title") == "MCP tools")
        self.assertEqual(tools["rows"][0][0], "goals_list")

    def test_only_admins_see_it(self):
        self.assertEqual(self.bob.get(f"{API}/system-settings/insights").status_code, 403)
        self.assertEqual(self.bob.get(f"{API}/system-settings/insights-csv").status_code, 403)

    def test_daily_numbers_are_backfilled_and_exported(self):
        from core_api.system import run_system_jobs
        from platform_system.models import DailyStat

        self.bob.post(f"{API}/goals", {"title": "Run"}, format="json")
        run_system_jobs()
        self.assertTrue(DailyStat.objects.filter(key="users").count() >= 89)  # filled in back to 90 days
        series = {s["key"]: s for s in self.insights(7)["series"]}
        self.assertEqual(series["users"]["points"][-1][1], 2)
        self.assertEqual(series["goals"]["points"][-1][1], 1)
        self.assertEqual(len(series["users"]["points"]), 14)  # this range and the one before
        csv = self.admin.get(f"{API}/system-settings/insights-csv?days=7")
        self.assertEqual(csv["Content-Type"], "text/csv; charset=utf-8")
        lines = csv.content.decode().splitlines()
        self.assertTrue(lines[0].startswith("date,") and "users" in lines[0])
        self.assertEqual(len(lines), 8)

    def test_requests_are_counted_per_endpoint_without_ids(self):
        from platform_system.insights import flush_counts

        goal = self.bob.post(f"{API}/goals", {"title": "Run"}, format="json").json()
        self.bob.get(f"{API}/goals/{goal['id']}")
        flush_counts()
        quality = self.section(self.insights(), "quality")
        endpoints = [r[0] for r in next(b for b in quality["blocks"] if b.get("title", "").startswith("API endpoints"))["rows"]]
        self.assertIn("GET /api/v1/goals/{pk}", endpoints)
        self.assertFalse(any(goal["id"] in e for e in endpoints))

    def test_activation_funnel_by_source_and_onboarding_choice(self):
        self.assertEqual(self.bob.post(f"{API}/onboarding-choice", {"choice": "agent"}, format="json").status_code, 200)
        self.bob.post(f"{API}/onboarding-choice", {"choice": "web"}, format="json")  # the first answer stays
        self.assertEqual(self.bob.get(f"{API}/onboarding-choice").json()["choice"], "agent")
        goal = self.bob.post(f"{API}/goals", {"title": "Run"}, format="json").json()
        metric = self.bob.post(f"{API}/metrics", {"goal": goal["id"], "name": "km", "target_value": 10}, format="json").json()
        self.bob.post(f"{API}/check-ins", {"metric": metric["id"], "value": 3}, format="json")
        blocks = self.section(self.insights(), "activation")["blocks"]
        steps = {row[0]: row[1] for row in blocks[0]["rows"]}
        self.assertEqual((steps["Signed up"], steps["First goal"], steps["First check-in"]), (2, 1, 1))
        sources = {row[0]: row[1] for row in blocks[1]["rows"]}
        self.assertEqual(sources["Website"], 1)
        choices = {row[0]: row[1] for row in blocks[2]["rows"]}
        self.assertEqual(choices["AI assistant"], 1)

    def test_retention_and_adoption_sections_compute(self):
        data = self.insights(90)
        retention = self.section(data, "retention")
        cohort = next(b for b in retention["blocks"] if b.get("title", "").startswith("Weekly"))
        self.assertEqual(cohort["rows"][-1][1], 2)  # this week's cohort: both accounts
        adoption = self.section(data, "adoption")
        self.assertIn("Of the 2 people active", adoption["blocks"][0]["title"])
        for section in data["sections"]:
            for block in section["blocks"]:
                self.assertNotEqual(block.get("items", [{}])[0].get("label"), "Error", section["key"])

    def test_retention_deletes_old_rows_only_when_set(self):
        from datetime import timedelta

        from django.utils import timezone

        from platform_system.insights import apply_retention

        old = AuditEvent.objects.create(action="old.thing", created_at=timezone.now() - timedelta(days=40))
        self.assertEqual(apply_retention(), {})  # default: keep forever
        self.assertTrue(AuditEvent.objects.filter(id=old.id).exists())
        self.assertEqual(self.set_setting("retention.audit_days", -1).status_code, 400)
        self.assertEqual(self.set_setting("retention.audit_days", 30).status_code, 200)
        self.assertEqual(apply_retention()["audit"], 1)
        self.assertFalse(AuditEvent.objects.filter(id=old.id).exists())
        self.assertTrue(AuditEvent.objects.filter(action="settings.updated").exists())
