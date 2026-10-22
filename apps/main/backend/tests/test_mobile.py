"""What the phone apps need from the server (P-67..P-72,
`docs/mobile-app.md`): native sessions (refresh token in the body), SSO
handed to an app with a one-time code + PKCE, the oldest app version
allowed, check-ins that a retry can't duplicate, `GET today`, and the
chart payload an app draws from.

`python manage.py test tests` in apps/main/backend.
"""

import base64
import hashlib
from datetime import datetime, timedelta
from unittest import mock
from urllib.parse import parse_qs, urlparse

from django.conf import settings
from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from goalnexa.models import CheckIn, Goal, Metric
from platform_auth import sso
from platform_auth.models import AppAuthCode, RefreshToken

from .test_admin import API, PASSWORD, client_for
from .test_auth_security import CLIENT_ID, ISSUER, FakeProvider, SecurityTestCase

APP = "goalnexa://auth/sso"
VERIFIER = "a-long-random-verifier-only-the-app-knows-0123456789"
CHALLENGE = base64.urlsafe_b64encode(hashlib.sha256(VERIFIER.encode()).digest()).rstrip(b"=").decode()


def native(response) -> APIClient:
    client = client_for(response)
    client.refresh_token = response.json()["refresh_token"]
    return client


class NativeSessionTests(SecurityTestCase):
    def native_login(self, email="bob@example.com"):
        return APIClient().post(
            f"{API}/auth/login",
            {"email": email, "password": PASSWORD, "client": "native", "device_name": "Pixel 8"},
            format="json",
        )

    def refresh(self, token, **extra):
        return APIClient().post(f"{API}/auth/refresh", {"refresh_token": token, **extra}, format="json")

    def test_a_native_login_gets_the_refresh_token_in_the_body(self):
        response = self.native_login()
        self.assertEqual(response.status_code, 200, response.content)
        self.assertTrue(response.json()["refresh_token"])
        self.assertGreater(response.json()["refresh_expires_in"], 0)
        self.assertNotIn(settings.REFRESH_COOKIE_NAME, response.cookies)
        # The website's login is unchanged: the cookie, never the token in the body.
        web = self.login("bob@example.com")
        self.assertNotIn("refresh_token", web.json())
        self.assertIn(settings.REFRESH_COOKIE_NAME, web.cookies)

    def test_refresh_rotates_in_the_body_and_stays_native(self):
        first = self.native_login().json()["refresh_token"]
        rotated = self.refresh(first)
        self.assertEqual(rotated.status_code, 200, rotated.content)
        second = rotated.json()["refresh_token"]
        self.assertNotEqual(first, second)
        self.assertNotIn(settings.REFRESH_COOKIE_NAME, rotated.cookies)
        # Single use: the old one is spent.
        self.assertEqual(self.refresh(first).status_code, 401)
        # The session remembers it's native - no `client` needed on refresh.
        third = self.refresh(second)
        self.assertIn("refresh_token", third.json())
        self.assertEqual(client_for(third).get(f"{API}/auth/me").status_code, 200)
        token = RefreshToken.objects.filter(user_id=self.bob.user_id, client="native", revoked_at__isnull=True).get()
        self.assertEqual((token.client, token.device_name), ("native", "Pixel 8"))

    def test_logout_with_the_token_in_the_body(self):
        token = self.native_login().json()["refresh_token"]
        self.assertEqual(APIClient().post(f"{API}/auth/logout", {"refresh_token": token}, format="json").status_code, 204)
        self.assertEqual(self.refresh(token).status_code, 401)

    def test_admin_sees_app_sessions(self):
        self.native_login()
        logins = self.admin.get(f"{API}/users/{self.bob.user_id}/sessions").json()["logins"]
        self.assertIn(("native", "Pixel 8"), {(login["client"], login["device_name"]) for login in logins})

    def test_config_says_the_oldest_app_allowed(self):
        config = self.anon.get(f"{API}/auth/config").json()
        self.assertEqual(config["min_app_version"], {"android": "", "ios": ""})
        self.assertEqual(self.set_setting("apps.min_android_version", "1.2.0").status_code, 200)
        self.assertEqual(self.anon.get(f"{API}/auth/config").json()["min_app_version"]["android"], "1.2.0")
        self.assertEqual(self.set_setting("apps.min_ios_version", "soon").status_code, 400)


@override_settings(OIDC_ISSUER=ISSUER, OIDC_CLIENT_ID=CLIENT_ID, OIDC_CLIENT_SECRET="s3cret")
class AppSsoTests(SecurityTestCase):
    def setUp(self):
        super().setUp()
        cache.clear()
        self.idp = FakeProvider()
        for name, fake in (("fetch_json", self.idp.fetch_json), ("post_form", self.idp.post_form),
                           ("signing_key", self.idp.public_key)):
            patcher = mock.patch.object(sso, name, fake)
            patcher.start()
            self.addCleanup(patcher.stop)

    def start(self, browser, **params):
        params = {"app_redirect": APP, "code_challenge": CHALLENGE, "device_name": "Pixel 8", **params}
        return browser.get(f"{API}/auth/sso/start", params)

    def callback(self, **params):
        browser = APIClient()
        response = self.start(browser)
        self.assertEqual(response.status_code, 302, response.content)
        query = parse_qs(urlparse(response["Location"]).query)
        self.idp.nonce = query["nonce"][0]
        return browser.get(f"{API}/auth/sso/callback", {"code": "abc", "state": query["state"][0], **params})

    def back_in_app(self, response) -> dict:
        self.assertEqual(response.status_code, 302)
        self.assertTrue(response["Location"].startswith(f"{APP}?"), response["Location"])
        return {k: v[0] for k, v in parse_qs(urlparse(response["Location"]).query).items()}

    def exchange(self, code, verifier=VERIFIER):
        return APIClient().post(f"{API}/auth/sso/token", {"code": code, "code_verifier": verifier}, format="json")

    def test_the_app_gets_a_one_time_code_for_a_native_session(self):
        response = self.callback()
        self.assertNotIn(settings.REFRESH_COOKIE_NAME, response.cookies)
        code = self.back_in_app(response)["code"]
        # Only with the verifier behind the challenge - and a wrong one doesn't spend the code.
        self.assertEqual(self.exchange(code, "x" * 50).json()["code"], "invalid_grant")
        session = self.exchange(code)
        self.assertEqual(session.status_code, 200, session.content)
        self.assertTrue(session.json()["refresh_token"])
        self.assertEqual(client_for(session).get(f"{API}/auth/me").json()["email"], "dana@example.com")
        token = RefreshToken.objects.get(user__email="dana@example.com", revoked_at__isnull=True)
        self.assertEqual((token.client, token.device_name), ("native", "Pixel 8"))
        # Once only.
        self.assertEqual(self.exchange(code).status_code, 400)

    def test_a_code_expires(self):
        code = self.back_in_app(self.callback())["code"]
        AppAuthCode.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.exchange(code).status_code, 400)

    def test_only_listed_app_addresses(self):
        self.assertEqual(self.start(APIClient(), app_redirect="evil://steal").status_code, 400)
        self.assertEqual(self.start(APIClient(), app_redirect="https://evil.example.com/").status_code, 400)
        # No PKCE challenge: back to the app with an error, never to the provider.
        self.assertEqual(self.back_in_app(self.start(APIClient(), code_challenge=""))["error"], "invalid_request")

    def test_a_refused_sign_in_goes_back_to_the_app(self):
        self.assertEqual(self.back_in_app(self.callback(error="access_denied"))["error"], "denied")
        self.assertEqual(AppAuthCode.objects.count(), 0)

    def test_the_website_flow_is_unchanged(self):
        browser = APIClient()
        response = browser.get(f"{API}/auth/sso/start")
        query = parse_qs(urlparse(response["Location"]).query)
        self.idp.nonce = query["nonce"][0]
        done = browser.get(f"{API}/auth/sso/callback", {"code": "abc", "state": query["state"][0]})
        self.assertEqual(done["Location"], "http://testserver/auth/sso")
        self.assertIn(settings.REFRESH_COOKIE_NAME, done.cookies)


class AppDataTestCase(SecurityTestCase):
    def create(self, client, resource, expect=201, **data):
        response = client.post(f"{API}/{resource}", data, format="json")
        self.assertEqual(response.status_code, expect, response.content)
        return response.json()


class IdempotentCheckInTests(AppDataTestCase):
    def setUp(self):
        super().setUp()
        goal = self.create(self.bob, "goals", title="Run more")
        self.metric = self.create(self.bob, "metrics", goal=goal["id"], name="Distance", unit="km", target_value=100, aggregation="sum")
        self.other = self.create(self.bob, "metrics", goal=goal["id"], name="Runs", target_value=20, aggregation="sum")

    def check_in(self, client, metric, ref, **extra):
        return client.post(f"{API}/check-ins", {"metric": metric["id"], "value": 5, "client_ref": ref}, format="json", **extra)

    def test_the_same_client_ref_never_logs_twice(self):
        first = self.check_in(self.bob, self.metric, "q-1")
        self.assertEqual(first.status_code, 201, first.content)
        again = self.check_in(self.bob, self.metric, "q-1")
        self.assertEqual(again.status_code, 200)
        self.assertEqual(again.json()["id"], first.json()["id"])
        self.assertEqual(CheckIn.objects.filter(metric_id=self.metric["id"]).count(), 1)
        self.assertEqual(float(Metric.objects.get(id=self.metric["id"]).current_value), 5)
        # Another metric with the same reference is the caller's mistake, not a retry.
        self.assertEqual(self.check_in(self.bob, self.other, "q-1").status_code, 409)
        # References are per author; none at all is always a new check-in.
        self.assertEqual(self.check_in(self.admin, self.metric, "q-1").status_code, 404)  # Bob's goal: not visible to the admin
        self.assertEqual(self.bob.post(f"{API}/check-ins", {"metric": self.metric["id"], "value": 1}, format="json").status_code, 201)
        self.assertEqual(self.bob.post(f"{API}/check-ins", {"metric": self.metric["id"], "value": 1}, format="json").status_code, 201)

    def test_a_reference_is_set_once(self):
        check_in = self.check_in(self.bob, self.metric, "q-2").json()
        self.bob.patch(f"{API}/check-ins/{check_in['id']}", {"client_ref": "q-3", "value": 6}, format="json")
        stored = CheckIn.objects.get(id=check_in["id"])
        self.assertEqual((stored.client_ref, float(stored.value)), ("q-2", 6))

    def test_the_app_is_the_source(self):
        response = self.check_in(self.bob, self.metric, "q-4", HTTP_X_GOALNEXA_CLIENT="mobile")
        self.assertEqual(response.json()["source"], "mobile")
        self.assertEqual(self.check_in(self.bob, self.metric, "q-5").json()["source"], "web")


class TodayTests(AppDataTestCase):
    def setUp(self):
        super().setUp()
        self.goal = self.create(self.bob, "goals", title="Run more")
        self.due = self.create(self.bob, "metrics", goal=self.goal["id"], name="Distance", target_value=100, check_in_every="daily")
        self.quota = self.create(
            self.bob, "metrics", goal=self.goal["id"], name="Calls", target_value=10, aggregation="sum", target_per="day"
        )
        Metric.objects.filter(id=self.due["id"]).update(check_in_due_at=timezone.now() - timedelta(hours=1))
        Goal.objects.filter(id=self.goal["id"]).update(health="at_risk")

    def today(self, client, **params):
        response = client.get(f"{API}/today", params)
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()

    def test_due_quotas_and_goals_at_risk_in_one_call(self):
        today = self.today(self.bob)
        self.assertEqual([m["id"] for m in today["due"]], [self.due["id"]])
        self.assertEqual(today["due_total"], 1)
        self.assertEqual(today["due"][0]["goal"], {"id": self.goal["id"], "title": "Run more", "org_id": None, "team_id": None})
        self.assertEqual((today["at_risk"][0]["org_id"], today["at_risk"][0]["team_id"]), (None, None))
        self.assertEqual([m["id"] for m in today["periods"]], [self.quota["id"]])
        self.assertEqual(today["periods"][0]["pace"]["quota"], 10)
        self.assertEqual([g["id"] for g in today["at_risk"]], [self.goal["id"]])
        self.assertTrue(today["at_risk"][0]["url"].endswith(f"/dashboard?goal={self.goal['id']}"))
        # Personal goals only; an organization of someone else's: nothing.
        self.assertEqual(len(self.today(self.bob, org="personal")["due"]), 1)

    def test_an_org_goal_says_where_it_belongs(self):
        org = self.create(self.bob, "orgs", name="Acme")
        goal = self.create(self.bob, "goals", title="Ship it", org_id=org["id"])
        metric = self.create(self.bob, "metrics", goal=goal["id"], name="Releases", target_value=5, check_in_every="daily")
        Metric.objects.filter(id=metric["id"]).update(check_in_due_at=timezone.now() - timedelta(hours=2))
        Goal.objects.filter(id=goal["id"]).update(health="off_track")
        today = self.today(self.bob, org=org["id"])
        self.assertEqual(today["due"][0]["goal"], {"id": goal["id"], "title": "Ship it", "org_id": org["id"], "team_id": None})
        self.assertEqual(today["at_risk"][0]["org_id"], org["id"])

    def test_closed_goals_and_strangers_see_nothing(self):
        stranger = self.signup("Carol", "carol@example.com")
        today = self.today(stranger)
        self.assertEqual((today["due"], today["periods"], today["at_risk"], today["due_total"]), ([], [], [], 0))
        Goal.objects.filter(id=self.goal["id"]).update(status="archived")
        today = self.today(self.bob)
        self.assertEqual((today["due"], today["periods"], today["at_risk"]), ([], [], []))

    def test_needs_a_login(self):
        self.assertEqual(APIClient().get(f"{API}/today").status_code, 401)


class ChartPayloadTests(AppDataTestCase):
    def test_metrics_in_manual_order_with_projection_and_range(self):
        target = timezone.localdate() + timedelta(days=30)
        goal = self.create(self.bob, "goals", title="Grow", target_date=target.isoformat())
        second = self.create(self.bob, "metrics", goal=goal["id"], name="Zebra", target_value=100)
        first_by_name = self.create(self.bob, "metrics", goal=goal["id"], name="Apple", target_value=0)  # tracked: base = target
        now = timezone.now()
        for days_ago, value in ((10, 10), (5, 20)):
            self.create(
                self.bob, "check-ins", metric=second["id"], value=value,
                checked_in_at=(now - timedelta(days=days_ago)).isoformat(),
            )
        chart = self.bob.get(f"{API}/goals/{goal['id']}/chart").json()
        self.assertEqual([m["name"] for m in chart["metrics"]], ["Zebra", "Apple"])  # position, not name
        zebra, apple = chart["metrics"]
        self.assertFalse(zebra["tracked"])
        self.assertTrue(apple["tracked"])
        self.assertIsNone(apple["projection"])
        # 10 -> 20 in 5 days: 2 a day, carried from the last reading to the
        # target date's midnight - 34 to 35 days, depending on the time of day.
        days = (datetime.fromisoformat(zebra["projection"]["at"]) - (now - timedelta(days=5))).total_seconds() / 86400
        self.assertAlmostEqual(zebra["projection"]["value"], 20 + 2 * days, delta=0.1)
        self.assertEqual(zebra["projection"]["at"][:10], target.isoformat())
        self.assertEqual(chart["range"]["end"][:10], target.isoformat())
        self.assertLessEqual(chart["range"]["start"], zebra["points"][0]["at"])


class FakeRelay:
    """Stands in for the push relay: records every request, answers `send`
    with each handle's status from `statuses` (default "sent")."""

    def __init__(self):
        self.calls = []
        self.statuses = {}

    def __call__(self, path, body, headers):
        import json

        self.calls.append((path, json.loads(body), headers, body))
        response = mock.Mock()
        response.raise_for_status.return_value = None
        if path == "send":
            messages = json.loads(body)["messages"]
            response.json.return_value = {
                "results": [{"handle": m["handle"], "status": self.statuses.get(m["handle"], "sent")} for m in messages]
            }
        return response

    def sends(self):
        return [call for call in self.calls if call[0] == "send"]


class PushTests(AppDataTestCase):
    """P-73/P-74, the server's half: phones registered with a relay handle,
    reminders pushed as a kind + id signed with the server's key, the text
    fetched by the app (docs/mobile-app.md "Push protocol")."""

    def setUp(self):
        super().setUp()
        self.relay = FakeRelay()
        patcher = mock.patch("goalnexa.push._post", self.relay)
        patcher.start()
        self.addCleanup(patcher.stop)

    def register(self, client, handle="gnp_bob_phone", expect=201):
        response = client.post(
            f"{API}/push-devices", {"handle": handle, "platform": "android", "device_name": "Pixel 8"}, format="json"
        )
        self.assertEqual(response.status_code, expect, response.content)
        return response.json()

    def overdue_metric(self):
        goal = self.create(self.bob, "goals", title="Run more")
        metric = self.create(self.bob, "metrics", goal=goal["id"], name="Distance", unit="km", target_value=100, check_in_every="daily")
        Metric.objects.filter(id=metric["id"]).update(check_in_due_at=timezone.now() - timedelta(hours=1))
        return metric

    def test_config_gives_the_relay_and_a_stable_server_key(self):
        config = self.bob.get(f"{API}/push/config").json()
        self.assertTrue(config["enabled"])
        self.assertEqual(config["relay_url"], "https://goal.pmnexa.com/api/v1/push-relay")
        self.assertEqual(len(base64.urlsafe_b64decode(config["server_key"] + "==")), 32)
        self.assertEqual(self.admin.get(f"{API}/push/config").json()["server_key"], config["server_key"])
        self.set_setting("push.relay_url", "")
        self.assertFalse(self.bob.get(f"{API}/push/config").json()["enabled"])
        self.assertEqual(self.anon.get(f"{API}/push/config").status_code, 401)

    def test_devices_are_the_callers_own(self):
        from goalnexa.models import PushDevice, ReminderSettings

        device = self.register(self.bob)
        self.assertEqual(device["device_name"], "Pixel 8")
        # Registering starts reminders (push on by default).
        self.assertTrue(ReminderSettings.objects.get(user_id=PushDevice.objects.get().user_id).push)
        self.assertEqual(self.register(self.bob, expect=200)["id"], device["id"])
        self.assertEqual(self.admin.get(f"{API}/push-devices").json()["total"], 0)
        self.assertEqual(self.admin.delete(f"{API}/push-devices/{device['id']}").status_code, 404)
        self.assertEqual(self.bob.get(f"{API}/push-devices").json()["items"][0]["id"], device["id"])
        # The phone signed in to another account: the handle follows it.
        self.register(self.admin, expect=200)
        self.assertEqual(self.bob.get(f"{API}/push-devices").json()["total"], 0)
        self.assertEqual(self.admin.delete(f"{API}/push-devices/{device['id']}").status_code, 204)
        self.assertEqual(self.relay.calls[-1][:2], ("revoke", {"handle": "gnp_bob_phone"}))
        self.assertEqual(self.bob.post(f"{API}/push-devices", {"handle": ""}, format="json").status_code, 400)
        self.assertEqual(self.bob.post(f"{API}/push-devices", {"handle": "x", "platform": "nokia"}, format="json").status_code, 400)

    def test_a_due_reminder_is_pushed_as_a_signed_kind_and_id(self):
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

        from goalnexa.reminders import send_due_reminders

        self.register(self.bob)
        self.overdue_metric()
        self.assertEqual(send_due_reminders(), 1)
        [(_, payload, headers, raw)] = self.relay.sends()
        [message] = payload["messages"]
        self.assertEqual((message["handle"], message["kind"]), ("gnp_bob_phone", "checkin_due"))
        self.assertEqual(set(message), {"handle", "kind", "id"})  # nothing else leaves the server
        key = self.bob.get(f"{API}/push/config").json()["server_key"]
        self.assertEqual(headers["X-GoalNexa-Key"], key)
        Ed25519PublicKey.from_public_bytes(base64.urlsafe_b64decode(key + "==")).verify(
            base64.urlsafe_b64decode(headers["X-GoalNexa-Signature"] + "=="),
            headers["X-GoalNexa-Timestamp"].encode() + b"." + raw,
        )
        # The app fetches what it says - only its own user can.
        text = self.bob.get(f"{API}/push/messages/{message['id']}").json()
        self.assertEqual(text["title"], "GoalNexa: 1 check-in due")
        self.assertIn("Run more → Distance", text["body"])
        self.assertNotIn("Check in:", text["body"])
        self.assertEqual(self.admin.get(f"{API}/push/messages/{message['id']}").status_code, 404)

    def test_push_off_or_a_gone_phone(self):
        from goalnexa.models import PushDevice
        from goalnexa.reminders import send_due_reminders

        self.register(self.bob)
        self.bob.patch(f"{API}/reminder-settings", {"push": False}, format="json")
        settings_payload = self.bob.get(f"{API}/reminder-settings").json()
        self.assertEqual((settings_payload["push"], settings_payload["push_devices"]), (False, 1))
        self.overdue_metric()
        self.assertEqual(send_due_reminders(), 0)  # no other channel either
        self.assertEqual(self.relay.sends(), [])
        self.bob.patch(f"{API}/reminder-settings", {"push": True}, format="json")
        self.relay.statuses["gnp_bob_phone"] = "gone"
        Metric.objects.update(reminded_at=None)
        self.assertEqual(send_due_reminders(), 0)
        self.assertFalse(PushDevice.objects.exists())

    def test_a_test_reminder_reaches_the_phone(self):
        self.register(self.bob)
        self.assertEqual(self.bob.post(f"{API}/reminder-settings/test").status_code, 200)
        self.assertEqual(self.relay.sends()[0][1]["messages"][0]["kind"], "test")

    def test_signing_out_everywhere_or_deleting_the_account_forgets_the_phones(self):
        from goalnexa.models import PushDevice, PushMessage
        from platform_auth.models import User

        self.register(self.bob)
        bob = User.objects.get(email="bob@example.com")
        sessions = self.admin.get(f"{API}/users/{bob.id}/sessions").json()
        phones = next(group for group in sessions["other"] if group["kind"] == "push")
        self.assertEqual(phones["items"][0]["label"], "Pixel 8")
        self.admin.post(f"{API}/users/{bob.id}/revoke-sessions")
        self.assertFalse(PushDevice.objects.exists())
        self.assertEqual(self.relay.calls[-1][0], "revoke")

        bob_client = client_for(self.login("bob@example.com"))
        self.register(bob_client)
        bob_client.post(f"{API}/reminder-settings/test")
        self.assertTrue(PushMessage.objects.exists())
        self.assertEqual(bob_client.post(f"{API}/auth/me/delete", {"password": PASSWORD}, format="json").status_code, 204)
        self.assertFalse(PushDevice.objects.exists())
        self.assertFalse(PushMessage.objects.exists())
