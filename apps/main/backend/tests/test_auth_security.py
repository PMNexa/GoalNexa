"""Account security through main's real stack: locking an account after
wrong passwords, the rules a new password must meet, and single sign-on
with an OpenID Connect provider (a fake one - its three network calls
are replaced, its id tokens are really signed and verified).

`python manage.py test tests` in apps/main/backend.
"""

import time
from datetime import timedelta
from unittest import mock
from urllib.parse import parse_qs, urlparse

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from django.core import mail
from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from platform_auth import sso
from platform_auth.models import SsoIdentity, User
from platform_system.models import AuditEvent

from .test_admin import API, PASSWORD, AdminTestCase, link_token

ISSUER = "https://idp.example.com"
CLIENT_ID = "goalnexa"


class SecurityTestCase(AdminTestCase):
    def setUp(self):
        super().setUp()
        # These tests log in more often than the rate limits allow.
        patcher = mock.patch("platform_auth.throttling._AuthThrottle.get_rate", return_value=None)
        patcher.start()
        self.addCleanup(patcher.stop)

    def login(self, email, password=PASSWORD):
        # Emails go out when the transaction commits.
        with self.captureOnCommitCallbacks(execute=True):
            return super().login(email, password)

    def forgot(self, email):
        with self.captureOnCommitCallbacks(execute=True):
            return self.anon.post(f"{API}/auth/password/forgot", {"email": email}, format="json")


class LockoutTests(SecurityTestCase):
    def setUp(self):
        super().setUp()
        self.set_setting("auth.lockout_attempts", 3)
        self.set_setting("auth.lockout_minutes", 15)

    def fail(self, times, email="bob@example.com"):
        return [self.login(email, "wrong-password").status_code for _ in range(times)]

    def test_locks_after_the_configured_failures_and_refuses_the_right_password(self):
        self.assertEqual(self.fail(2), [401, 401])
        locking = self.login("bob@example.com", "wrong-password")
        self.assertEqual(locking.status_code, 403)
        self.assertEqual(locking.json()["code"], "account_locked")
        self.assertIn("15 more minutes", locking.json()["message"])

        self.assertEqual(self.login("bob@example.com").json()["code"], "account_locked")
        events = AuditEvent.objects.filter(action="auth.account_locked")
        self.assertEqual(events.count(), 1)
        self.assertEqual(events.first().data["attempts"], 3)
        self.assertIn("Your account was locked", [m.subject for m in mail.outbox])

    def test_the_lock_runs_out(self):
        self.fail(3)
        User.objects.filter(email="bob@example.com").update(locked_until=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.login("bob@example.com").status_code, 200)

    def test_a_successful_login_resets_the_count(self):
        self.fail(2)
        self.assertEqual(self.login("bob@example.com").status_code, 200)
        self.assertEqual(self.fail(2), [401, 401])
        self.assertEqual(self.login("bob@example.com").status_code, 200)

    def test_password_reset_unlocks(self):
        self.fail(3)
        self.assertEqual(self.forgot("bob@example.com").status_code, 204)
        reset = next(m for m in mail.outbox if m.subject == "Reset your password")
        response = self.anon.post(
            f"{API}/auth/password/reset", {"token": link_token(reset), "password": "a-brand-new-passphrase"}, format="json"
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(self.login("bob@example.com", "a-brand-new-passphrase").status_code, 200)

    def test_admin_unlocks_and_members_cant(self):
        self.fail(3)
        bob = User.objects.get(email="bob@example.com")
        self.assertIsNotNone(self.admin.get(f"{API}/users/{bob.id}").json()["locked_until"])
        self.assertEqual(self.bob.post(f"{API}/users/{bob.id}/unlock").status_code, 403)
        unlocked = self.admin.post(f"{API}/users/{bob.id}/unlock")
        self.assertEqual(unlocked.status_code, 200, unlocked.content)
        self.assertIsNone(unlocked.json()["locked_until"])
        self.assertEqual(self.login("bob@example.com").status_code, 200)
        self.assertIn("user.unlocked", self.actions())

    def test_zero_attempts_never_locks_and_unknown_emails_dont_lock(self):
        self.assertEqual(self.fail(5, email="nobody@example.com"), [401] * 5)
        self.set_setting("auth.lockout_attempts", 0)
        self.assertEqual(self.fail(5), [401] * 5)
        self.assertEqual(self.login("bob@example.com").status_code, 200)

    def test_settings_refuse_nonsense(self):
        self.assertEqual(self.set_setting("auth.lockout_attempts", -1).status_code, 400)
        self.assertEqual(self.set_setting("auth.lockout_minutes", 0).status_code, 400)
        self.assertEqual(self.set_setting("auth.password_min_length", 3).status_code, 400)


class PasswordRuleTests(SecurityTestCase):
    def signup_with(self, password, email="carol@example.com"):
        return APIClient().post(f"{API}/auth/signup", {"name": "Carol", "email": email, "password": password}, format="json")

    def test_signup_enforces_length_and_common_passwords(self):
        short = self.signup_with("abc12")
        self.assertEqual(short.status_code, 400)
        self.assertIn("at least 8", short.json()["field_errors"]["password"][0])
        common = self.signup_with("password123")
        self.assertEqual(common.status_code, 400)
        self.assertIn("too common", common.json()["field_errors"]["password"][0])
        self.assertEqual(self.signup_with("carol@example.com").status_code, 400)
        self.assertFalse(User.objects.filter(email="carol@example.com").exists())
        self.assertEqual(self.signup_with(PASSWORD).status_code, 200)

    def test_rules_are_settings(self):
        self.set_setting("auth.password_min_length", 12)
        self.assertEqual(self.signup_with("ten-chars1").status_code, 400)
        self.assertEqual(self.anon.get(f"{API}/auth/config").json()["password_min_length"], 12)
        self.set_setting("auth.password_min_length", 8)
        self.set_setting("auth.password_reject_common", False)
        self.assertEqual(self.signup_with("password123").status_code, 200)

    def test_existing_passwords_keep_working_when_rules_tighten(self):
        self.set_setting("auth.password_min_length", 40)
        self.assertEqual(self.login("bob@example.com").status_code, 200)

    def test_change_and_reset_enforce_them_too(self):
        change = self.bob.post(f"{API}/auth/me/password", {"current_password": PASSWORD, "new_password": "qwerty123"}, format="json")
        self.assertEqual(change.status_code, 400)
        self.assertIn("new_password", change.json()["field_errors"])
        self.assertEqual(self.login("bob@example.com").status_code, 200)

        self.forgot("bob@example.com")
        token = link_token(next(m for m in mail.outbox if m.subject == "Reset your password"))
        reset = self.anon.post(f"{API}/auth/password/reset", {"token": token, "password": "short"}, format="json")
        self.assertEqual(reset.status_code, 400)
        # A refused password doesn't use the link up.
        self.assertEqual(
            self.anon.post(f"{API}/auth/password/reset", {"token": token, "password": "a-brand-new-passphrase"}, format="json").status_code,
            200,
        )


class FakeProvider:
    """An OpenID Connect provider: really signs id tokens, answers the
    calls `platform_auth.sso` makes over the network."""

    def __init__(self):
        self.key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        self.person = {"sub": "idp-user-1", "email": "dana@example.com", "email_verified": True, "name": "Dana Doe"}
        self.nonce = None
        self.token_requests = []
        self.id_token_overrides = {}
        self.signing_key = self.key
        self.algorithm = "RS256"

    discovery = {
        "issuer": ISSUER,
        "authorization_endpoint": f"{ISSUER}/authorize",
        "token_endpoint": f"{ISSUER}/token",
        "userinfo_endpoint": f"{ISSUER}/userinfo",
        "jwks_uri": f"{ISSUER}/jwks",
        "id_token_signing_alg_values_supported": ["RS256"],
    }

    def fetch_json(self, url, *, bearer=None):
        if url.endswith("/.well-known/openid-configuration"):
            return self.discovery
        if url.endswith("/userinfo"):
            return {k: self.person[k] for k in ("sub", "email", "email_verified", "name") if k in self.person}
        raise OSError(f"unexpected {url}")

    def post_form(self, url, form, *, basic=None):
        self.token_requests.append({"form": form, "basic": basic})
        now = int(time.time())
        claims = {"iss": ISSUER, "aud": CLIENT_ID, "iat": now, "exp": now + 300, "nonce": self.nonce, **self.person,
                  **self.id_token_overrides}
        claims = {k: v for k, v in claims.items() if v is not None}
        return {"access_token": "at", "id_token": jwt.encode(claims, self.signing_key, algorithm=self.algorithm)}

    def public_key(self, jwks_uri, id_token):
        return self.key.public_key()


@override_settings(OIDC_ISSUER=ISSUER, OIDC_CLIENT_ID=CLIENT_ID, OIDC_CLIENT_SECRET="s3cret")
class SsoTests(SecurityTestCase):
    def setUp(self):
        super().setUp()
        cache.clear()
        self.idp = FakeProvider()
        for name, fake in (("fetch_json", self.idp.fetch_json), ("post_form", self.idp.post_form),
                           ("signing_key", self.idp.public_key)):
            patcher = mock.patch.object(sso, name, fake)
            patcher.start()
            self.addCleanup(patcher.stop)

    def start(self, browser, next_path=None):
        response = browser.get(f"{API}/auth/sso/start", {"next": next_path} if next_path else {})
        self.assertEqual(response.status_code, 302, response.content)
        query = parse_qs(urlparse(response["Location"]).query)
        self.idp.nonce = query["nonce"][0]
        return response, query

    def sign_in(self, next_path=None, browser=None):
        """The whole round trip; returns (the browser, the callback's response)."""
        browser = browser or APIClient()
        _, query = self.start(browser, next_path)
        return browser, browser.get(f"{API}/auth/sso/callback", {"code": "abc", "state": query["state"][0]})

    def error(self, response):
        self.assertEqual(response.status_code, 302)
        location = urlparse(response["Location"])
        self.assertEqual(location.path, "/auth/login")
        return parse_qs(location.query)["sso_error"][0]

    def test_config_tells_the_login_page(self):
        config = self.anon.get(f"{API}/auth/config").json()
        self.assertEqual(config["sso"], {"label": "SSO", "start_url": "/api/v1/auth/sso/start"})
        self.assertTrue(config["password_login"])
        self.set_setting("auth.sso_label", "Acme")
        self.assertEqual(self.anon.get(f"{API}/auth/config").json()["sso"]["label"], "Acme")
        with override_settings(OIDC_CLIENT_SECRET=""):
            self.assertIsNone(self.anon.get(f"{API}/auth/config").json()["sso"])
            self.assertEqual(self.anon.get(f"{API}/auth/sso/start").status_code, 404)

    def test_start_sends_the_browser_to_the_provider_with_pkce(self):
        response, query = self.start(APIClient(), "/goals")
        self.assertTrue(response["Location"].startswith(f"{ISSUER}/authorize?"))
        self.assertEqual(query["client_id"], [CLIENT_ID])
        self.assertEqual(query["redirect_uri"], ["http://testserver/api/v1/auth/sso/callback"])
        self.assertEqual(query["code_challenge_method"], ["S256"])
        self.assertEqual(query["scope"], ["openid email profile"])
        cookie = response.cookies["sso_state"]
        self.assertTrue(cookie["httponly"])
        self.assertEqual(cookie["path"], "/api/v1/auth/sso")

    def test_new_person_gets_an_account_and_a_session(self):
        browser, response = self.sign_in("/goals")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "http://testserver/auth/sso?next=%2Fgoals")
        dana = User.objects.get(email="dana@example.com")
        self.assertEqual(dana.name, "Dana Doe")
        self.assertIsNotNone(dana.email_verified_at)
        self.assertTrue(SsoIdentity.objects.filter(user=dana, issuer=ISSUER, subject="idp-user-1").exists())
        # The code went to the provider with the client's secret and the PKCE verifier.
        sent = self.idp.token_requests[0]
        self.assertEqual(sent["basic"], (CLIENT_ID, "s3cret"))
        self.assertTrue(sent["form"]["code_verifier"])

        # The page the callback lands on trades the refresh cookie for a session.
        session = browser.post(f"{API}/auth/refresh")
        self.assertEqual(session.status_code, 200, session.content)
        self.assertEqual(session.json()["user"]["email"], "dana@example.com")
        # No password: only the provider signs them in.
        self.assertEqual(self.login("dana@example.com", "anything-at-all").status_code, 401)
        self.assertEqual(AuditEvent.objects.filter(action="auth.login", data__method="sso").count(), 1)

    def test_existing_account_is_linked_by_verified_email(self):
        self.idp.person.update(email="Bob@Example.com", name="Robert")
        _, response = self.sign_in()
        self.assertEqual(response["Location"], "http://testserver/auth/sso")
        bob = User.objects.get(email="bob@example.com")
        self.assertEqual(bob.name, "Bob")
        self.assertEqual(SsoIdentity.objects.get(subject="idp-user-1").user_id, bob.id)
        self.assertEqual(User.objects.filter(email__iexact="bob@example.com").count(), 1)
        self.assertEqual(self.login("bob@example.com").status_code, 200)

        # From then on the link is the provider's id - a changed email there still signs in as Bob.
        self.idp.person["email"] = "robert@elsewhere.example"
        browser, _ = self.sign_in()
        self.assertEqual(browser.post(f"{API}/auth/refresh").json()["user"]["email"], "bob@example.com")
        self.assertFalse(User.objects.filter(email="robert@elsewhere.example").exists())

    def test_unverified_email_is_never_linked_or_created(self):
        self.idp.person.update(email="bob@example.com", email_verified=False)
        self.assertEqual(self.error(self.sign_in()[1]), "email_unverified")
        self.assertFalse(SsoIdentity.objects.exists())

        # A provider with no such claim: only when the operator says to trust it.
        del self.idp.person["email_verified"]
        self.assertEqual(self.error(self.sign_in()[1]), "email_unverified")
        with override_settings(OIDC_TRUST_EMAIL=True):
            self.assertEqual(self.sign_in()[1]["Location"], "http://testserver/auth/sso")

    def test_email_from_userinfo_when_the_id_token_has_none(self):
        self.idp.id_token_overrides = {"email": None, "email_verified": None, "name": None}
        self.assertEqual(self.sign_in()[1]["Location"], "http://testserver/auth/sso")
        self.assertTrue(User.objects.filter(email="dana@example.com").exists())

    def test_signup_policy_applies(self):
        self.set_setting("auth.signup_policy", "closed")
        self.assertEqual(self.error(self.sign_in()[1]), "signup_closed")
        self.assertFalse(User.objects.filter(email="dana@example.com").exists())
        # Someone who already has an account still signs in.
        self.idp.person.update(sub="idp-bob", email="bob@example.com")
        self.assertEqual(self.sign_in()[1]["Location"], "http://testserver/auth/sso")

        self.set_setting("auth.signup_policy", "open")
        self.set_setting("auth.allowed_email_domains", ["acme.com"])
        self.idp.person.update(sub="idp-user-1", email="dana@example.com")
        self.assertEqual(self.error(self.sign_in()[1]), "signup_domain")

    def test_disabled_account_is_refused(self):
        self.sign_in()
        User.objects.filter(email="dana@example.com").update(is_active=False)
        self.assertEqual(self.error(self.sign_in()[1]), "account_disabled")

    def test_forged_or_mismatched_tokens_are_refused(self):
        # Signed by someone else's key.
        self.idp.signing_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        self.assertEqual(self.error(self.sign_in()[1]), "invalid_token")
        self.idp.signing_key = self.idp.key
        # A symmetric token "signed" with something public.
        self.idp.signing_key, self.idp.algorithm = "s3cret", "HS256"
        self.assertEqual(self.error(self.sign_in()[1]), "invalid_token")
        self.idp.signing_key, self.idp.algorithm = self.idp.key, "RS256"
        # For another client, from another issuer, expired, or replayed (wrong nonce).
        for overrides in ({"aud": "someone-else"}, {"iss": "https://evil.example"}, {"exp": int(time.time()) - 600},
                          {"nonce": "replayed"}):
            self.idp.id_token_overrides = overrides
            self.assertEqual(self.error(self.sign_in()[1]), "invalid_token", overrides)
        self.assertFalse(User.objects.filter(email="dana@example.com").exists())

    def test_callback_needs_the_browser_that_started(self):
        _, query = self.start(APIClient())
        callback = {"code": "abc", "state": query["state"][0]}
        # Another browser (no state cookie), or a made-up state.
        self.assertEqual(self.error(APIClient().get(f"{API}/auth/sso/callback", callback)), "expired")
        browser = APIClient()
        self.start(browser)
        self.assertEqual(self.error(browser.get(f"{API}/auth/sso/callback", {"code": "abc", "state": "made-up"})), "expired")
        # The provider said no (or the person cancelled).
        browser = APIClient()
        _, query = self.start(browser)
        denied = browser.get(f"{API}/auth/sso/callback", {"error": "access_denied", "state": query["state"][0]})
        self.assertEqual(self.error(denied), "denied")
        self.assertEqual(self.idp.token_requests, [])

    def test_next_is_never_an_open_redirect(self):
        _, response = self.sign_in("//evil.example/steal")
        self.assertEqual(response["Location"], "http://testserver/auth/sso")

    def test_sso_only_turns_password_login_off(self):
        self.assertEqual(self.set_setting("auth.password_login", False).status_code, 200)
        self.assertFalse(self.anon.get(f"{API}/auth/config").json()["password_login"])
        refused = self.login("bob@example.com")
        self.assertEqual(refused.status_code, 403)
        self.assertEqual(refused.json()["code"], "password_login_disabled")
        signup = APIClient().post(f"{API}/auth/signup", {"name": "Eve", "email": "eve@example.com", "password": PASSWORD}, format="json")
        self.assertEqual(signup.json()["code"], "password_login_disabled")
        # No reset link either - it would sign them in.
        mail.outbox.clear()
        self.assertEqual(self.forgot("bob@example.com").status_code, 204)
        self.assertEqual(mail.outbox, [])
        # Single sign-on still works; and without a provider the setting is ignored.
        self.assertEqual(self.sign_in()[1]["Location"], "http://testserver/auth/sso")
        with override_settings(OIDC_ISSUER=""):
            self.assertEqual(self.login("bob@example.com").status_code, 200)
        # The environment override is the way back in.
        with mock.patch.dict("os.environ", {"AUTH_PASSWORD_LOGIN": "true"}):
            self.assertEqual(self.login("bob@example.com").status_code, 200)

    def test_a_lock_from_wrong_passwords_doesnt_block_sso(self):
        self.set_setting("auth.lockout_attempts", 2)
        self.idp.person.update(email="bob@example.com")
        for _ in range(2):
            self.login("bob@example.com", "wrong-password")
        self.assertEqual(self.login("bob@example.com").json()["code"], "account_locked")
        self.assertEqual(self.sign_in()[1]["Location"], "http://testserver/auth/sso")
        self.assertIsNone(User.objects.get(email="bob@example.com").locked_until)

    def test_provider_down_fails_cleanly(self):
        with mock.patch.object(sso, "fetch_json", side_effect=OSError("connection refused")):
            self.assertEqual(self.error(APIClient().get(f"{API}/auth/sso/start")), "provider_unreachable")

    def test_export_lists_the_link(self):
        browser, _ = self.sign_in()
        token = browser.post(f"{API}/auth/refresh").json()["access_token"]
        browser.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        account = browser.get(f"{API}/auth/me/export").json()["account"]
        self.assertEqual(account["single_sign_on"][0]["issuer"], ISSUER)
