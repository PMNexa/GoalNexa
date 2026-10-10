"""Lifecycle email (P-43..P-45; docs/lifecycle-email.md) through main's
real stack: preferences and unsubscribing, suppression and SES events,
the journey engine and its guards, goalnexa's and the host's journeys,
clicks and conversions, and the console's API.

`python manage.py test tests.test_lifecycle` in apps/main/backend.
"""

import base64
import datetime as dt
import json
from datetime import timedelta
from unittest import mock

from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from core_api.lifecycle import run_lifecycle_jobs
from core_api.system import user_removed
from goalnexa.models import Metric, ReminderSettings
from platform_lifecycle import engine
from platform_lifecycle.models import Enrollment, LifecycleSend, Signal
from platform_system.models import EmailPreference, EmailStatus, OutgoingEmail, Suppression, UserPresence

from tests.test_admin import API, AdminTestCase

DEFAULTS = {
    "auth.require_email_verification": False,
    "lifecycle.enabled": True,
    "lifecycle.holdout_percent": 0,
    "lifecycle.quiet_start": 0,
    "lifecycle.quiet_end": 0,
    "lifecycle.frequency_cap": 0,
}


@override_settings(PUBLIC_URL="https://gn.test", SYSTEM_SETTING_DEFAULTS=DEFAULTS)
class LifecycleTestCase(AdminTestCase):
    def setUp(self):
        engine._last_scan = 0.0
        super().setUp()

    def run_engine(self, after=timedelta(0)):
        return engine.run(now=timezone.now() + after)

    def sends(self, user_id, journey=None):
        rows = LifecycleSend.objects.filter(user_id=user_id).order_by("sent_at")
        return rows.filter(journey=journey) if journey else rows

    def goal_with_metric(self, client, title="Run more"):
        goal = client.post(f"{API}/goals", {"title": title}, format="json")
        self.assertEqual(goal.status_code, 201, goal.content)
        metric = client.post(f"{API}/metrics", {"goal": goal.json()["id"], "name": "km", "base_value": 0,
                                                "target_value": 100}, format="json")
        self.assertEqual(metric.status_code, 201, metric.content)
        return goal.json()["id"], metric.json()["id"]


class OnboardingTests(LifecycleTestCase):
    def test_signup_enrolls_and_welcome_goes_out_once_with_unsubscribe_headers(self):
        enrollment = Enrollment.objects.get(user_id=self.bob.user_id, journey="onboarding")
        self.assertEqual(enrollment.step, 0)
        with self.captureOnCommitCallbacks(execute=True):
            self.run_engine()
        self.run_engine()
        sends = self.sends(self.bob.user_id, "onboarding")
        self.assertEqual([s.step for s in sends], ["welcome"])
        email = sends[0].email
        self.assertEqual(email.category, "tips")
        self.assertIn("/api/v1/email/unsubscribe/", email.headers["List-Unsubscribe"])
        self.assertEqual(email.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click")
        self.assertIn("https://gn.test/email/unsubscribe/", email.text)
        self.assertIn("https://gn.test/api/v1/l/", email.html)  # the button is a tracked link
        self.assertNotIn("<img", email.html)  # no open pixel

    def test_steps_check_their_condition_when_due_and_check_in_ends_the_journey(self):
        self.run_engine()
        self.run_engine(timedelta(hours=25))  # no goal yet -> "first-goal"
        goal_id, metric_id = self.goal_with_metric(self.bob)
        self.run_engine(timedelta(hours=49))  # a goal, no check-in -> "first-check-in"
        steps = list(self.sends(self.bob.user_id, "onboarding").values_list("step", flat=True))
        self.assertEqual(steps, ["welcome", "first-goal", "first-check-in"])
        self.assertIn("Run more", LifecycleSend.objects.get(step="first-check-in").email.text)
        self.bob.post(f"{API}/check-ins", {"metric": metric_id, "value": 5}, format="json")
        self.run_engine(timedelta(days=5))
        enrollment = Enrollment.objects.get(user_id=self.bob.user_id, journey="onboarding")
        self.assertEqual((enrollment.status, enrollment.exit_reason), ("exited", "checked in"))
        # The first check-in starts the tips journey.
        self.assertTrue(Enrollment.objects.filter(user_id=self.bob.user_id, journey="tips").exists())

    def test_new_accounts_get_the_weekly_digest_by_email(self):
        row = ReminderSettings.objects.get(user_id=self.bob.user_id)
        self.assertTrue(row.email)
        self.assertEqual(row.digest, "weekly")

    def test_nothing_when_lifecycle_email_is_off(self):
        with override_settings(SYSTEM_SETTING_DEFAULTS={**DEFAULTS, "lifecycle.enabled": False}):
            carol = self.signup("Carol", "carol@example.com")
            self.assertEqual(run_lifecycle_jobs(), {})
        self.assertFalse(Enrollment.objects.filter(user_id=carol.user_id).exists())
        self.assertFalse(ReminderSettings.objects.filter(user_id=carol.user_id).exists())

    def test_unconfirmed_accounts_wait(self):
        with override_settings(SYSTEM_SETTING_DEFAULTS={**DEFAULTS, "auth.require_email_verification": True}):
            self.signup("Carol", "carol@example.com", expect=201)
            from platform_auth.models import User

            carol = Enrollment.objects.get(journey="onboarding", user_id=User.objects.get(email="carol@example.com").id)
            self.run_engine()
            self.assertFalse(self.sends(carol.user_id).exists())
            carol.refresh_from_db()
            self.assertEqual(carol.status, "active")
            self.run_engine(timedelta(days=8))
            carol.refresh_from_db()
            self.assertEqual(carol.exit_reason, "never confirmed")


class GuardTests(LifecycleTestCase):
    def test_frequency_cap_postpones(self):
        with override_settings(SYSTEM_SETTING_DEFAULTS={**DEFAULTS, "lifecycle.frequency_cap": 1}):
            self.run_engine()
            self.run_engine(timedelta(hours=25))
        self.assertEqual(self.sends(self.bob.user_id, "onboarding").count(), 1)
        enrollment = Enrollment.objects.get(user_id=self.bob.user_id, journey="onboarding")
        self.assertGreater(enrollment.next_at, timezone.now() + timedelta(days=6))

    def test_quiet_hours_in_the_users_time_zone(self):
        with override_settings(SYSTEM_SETTING_DEFAULTS={**DEFAULTS, "lifecycle.quiet_start": 21, "lifecycle.quiet_end": 8}):
            late = dt.datetime(2026, 10, 10, 15, 30, tzinfo=dt.timezone.utc)  # 22:30 in Ho Chi Minh City
            until = engine.quiet_until(late, "Asia/Ho_Chi_Minh")
            self.assertEqual(until, dt.datetime(2026, 10, 11, 1, 0, tzinfo=dt.timezone.utc))  # 08:00 local
            self.assertIsNone(engine.quiet_until(late, "Europe/Berlin"))  # 17:30 there
            early = dt.datetime(2026, 10, 10, 3, 0, tzinfo=dt.timezone.utc)  # 05:00 in Berlin
            self.assertEqual(engine.quiet_until(early, "Europe/Berlin"), dt.datetime(2026, 10, 10, 6, 0, tzinfo=dt.timezone.utc))

    def test_holdout_is_recorded_not_sent(self):
        with override_settings(SYSTEM_SETTING_DEFAULTS={**DEFAULTS, "lifecycle.holdout_percent": 100}):
            carol = self.signup("Carol", "carol@example.com")
            self.run_engine()
        send = self.sends(carol.user_id, "onboarding").get()
        self.assertTrue(send.holdout)
        self.assertIsNone(send.email)
        self.goal_with_metric(carol)
        self.run_engine()
        send.refresh_from_db()
        self.assertIsNotNone(send.converted_at)  # measured like everyone else

    def test_sunset_after_long_inactivity(self):
        UserPresence.objects.filter(user_id=self.bob.user_id).update(last_seen_at=timezone.now() - timedelta(days=90))
        self.run_engine()
        enrollment = Enrollment.objects.get(user_id=self.bob.user_id, journey="onboarding")
        self.assertEqual(enrollment.exit_reason, "sunset")

    def test_two_schedulers_never_send_a_step_twice(self):
        enrollment = Enrollment.objects.get(user_id=self.bob.user_id, journey="onboarding")
        user = engine.users([self.bob.user_id])[self.bob.user_id]
        now = timezone.now()
        self.assertEqual(engine.process(enrollment, user, None, now), "sent")
        stale = Enrollment.objects.get(id=enrollment.id)
        stale.step = 0  # a second scheduler holding the old row
        self.assertEqual(engine.process(stale, user, None, now), "duplicate")
        self.assertEqual(self.sends(self.bob.user_id, "onboarding").count(), 1)


class PreferenceTests(LifecycleTestCase):
    def test_preferences_api(self):
        prefs = {c["key"]: c["enabled"] for c in self.bob.get(f"{API}/email/preferences").json()["categories"]}
        self.assertEqual(prefs, {"reminders": True, "tips": True, "progress": True})
        response = self.bob.put(f"{API}/email/preferences", {"categories": {"tips": False, "nope": False}}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(EmailPreference.objects.get(user_id=self.bob.user_id, category="tips").enabled)
        self.assertEqual(APIClient().get(f"{API}/email/preferences").status_code, 401)

    def test_one_click_unsubscribe_stops_the_journey_and_is_counted(self):
        self.run_engine()
        send = self.sends(self.bob.user_id, "onboarding").get()
        url = send.email.headers["List-Unsubscribe"].strip("<>").replace("https://gn.test", "")
        page = APIClient().get(url)
        self.assertEqual(page.status_code, 200)
        self.assertEqual(page.json()["category"], "tips")
        response = APIClient().post(url, "List-Unsubscribe=One-Click", content_type="application/x-www-form-urlencoded")
        self.assertEqual(response.status_code, 200, response.content)
        send.refresh_from_db()
        self.assertIsNotNone(send.unsubscribed_at)
        self.run_engine(timedelta(hours=25))
        self.assertEqual(Enrollment.objects.get(id=send.enrollment_id).exit_reason, "unsubscribed")
        self.assertIn("email.unsubscribed", self.actions())

    def test_unsubscribe_tokens_cant_be_forged(self):
        self.assertEqual(APIClient().post(f"{API}/email/unsubscribe/not-a-token").status_code, 404)
        from platform_system.preferences import make_token

        token = make_token(self.bob.user_id, "tips")
        self.assertEqual(APIClient().post(f"{API}/email/unsubscribe/{token[:-2]}xx").status_code, 404)

    def test_reminder_email_respects_the_category(self):
        from goalnexa.reminders import deliver

        row = ReminderSettings.objects.get(user_id=self.bob.user_id)
        self.assertTrue(deliver(row, "Due", "body", kind="reminder"))
        self.assertEqual(OutgoingEmail.objects.filter(kind="reminder").get().category, "reminders")
        EmailPreference.objects.create(user_id=self.bob.user_id, category="reminders", enabled=False)
        self.assertFalse(deliver(row, "Due", "body", kind="reminder"))
        self.assertEqual(OutgoingEmail.objects.filter(kind="reminder").count(), 1)


class SuppressionTests(LifecycleTestCase):
    def test_suppressed_addresses_get_nothing_not_even_account_mail(self):
        Suppression.objects.create(email="bob@example.com", reason="bounce")
        self.anon.post(f"{API}/auth/password/forgot", {"email": "bob@example.com"}, format="json")
        reset = OutgoingEmail.objects.filter(to=["bob@example.com"]).order_by("-created_at").first()
        self.assertEqual(reset.status, EmailStatus.SUPPRESSED)
        self.run_engine()
        self.assertEqual(Enrollment.objects.get(user_id=self.bob.user_id, journey="onboarding").exit_reason,
                         "suppressed")

    def test_admins_manage_the_list_and_members_cant(self):
        response = self.admin.post(f"{API}/email-suppressions", {"email": "Eve@Example.com"}, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()["email"], "eve@example.com")
        self.assertEqual(response.json()["reason"], "manual")
        self.assertEqual(self.bob.get(f"{API}/email-suppressions").status_code, 403)
        self.assertEqual(self.admin.delete(f"{API}/email-suppressions/{response.json()['id']}").status_code, 204)
        self.assertIn("email.suppressed", self.actions())
        self.assertIn("email.unsuppressed", self.actions())

    def test_ses_events(self):
        from platform_system.ses import record_event

        bounce = {"eventType": "Bounce", "bounce": {"bounceType": "Permanent", "bouncedRecipients": [
            {"emailAddress": "Gone@Example.com", "diagnosticCode": "550 no such user"}]}}
        self.assertEqual(record_event(bounce), 1)
        self.assertEqual(record_event(bounce), 0)
        self.assertEqual(Suppression.objects.get(email="gone@example.com").reason, "bounce")
        transient = {"notificationType": "Bounce", "bounce": {"bounceType": "Transient", "bouncedRecipients": [
            {"emailAddress": "full@example.com"}]}}
        self.assertEqual(record_event(transient), 0)
        complaint = {"notificationType": "Complaint", "complaint": {"complainedRecipients": [
            {"emailAddress": "angry@example.com"}]}}
        self.assertEqual(record_event(complaint), 1)
        status = self.admin.get(f"{API}/system-settings/status").json()["emails_24h"]
        self.assertEqual((status["bounces"], status["complaints"]), (1, 1))

    def test_sns_messages_must_be_signed_by_amazon_for_an_allowed_topic(self):
        from cryptography import x509
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import padding, rsa
        from cryptography.x509.oid import NameOID

        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "sns.amazonaws.com")])
        cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key())
                .serial_number(1).not_valid_before(dt.datetime(2020, 1, 1)).not_valid_after(dt.datetime(2040, 1, 1))
                .sign(key, hashes.SHA256()))
        pem = cert.public_bytes(serialization.Encoding.PEM)
        topic = "arn:aws:sns:ap-southeast-1:123:ses-events"
        event = {"notificationType": "Complaint", "complaint": {"complainedRecipients": [{"emailAddress": "x@example.com"}]}}
        body = {"Type": "Notification", "MessageId": "m1", "TopicArn": topic, "Message": json.dumps(event),
                "Timestamp": "2026-10-10T00:00:00Z", "SignatureVersion": "2",
                "SigningCertURL": "https://sns.ap-southeast-1.amazonaws.com/cert.pem"}
        signed = "".join(f"{k}\n{body[k]}\n" for k in ("Message", "MessageId", "Timestamp", "TopicArn", "Type"))
        body["Signature"] = base64.b64encode(key.sign(signed.encode(), padding.PKCS1v15(), hashes.SHA256())).decode()

        def post(payload):
            return APIClient().post(f"{API}/email/ses-events", json.dumps(payload), content_type="text/plain")

        with mock.patch("platform_system.ses._certificate", return_value=pem):
            self.assertEqual(post(body).status_code, 403)  # topic not allowed yet
            self.set_setting("email.ses_topic_arns", [topic])
            self.assertEqual(post({**body, "Message": json.dumps({**event, "x": 1})}).status_code, 403)  # tampered
            self.assertEqual(post({**body, "SigningCertURL": "https://evil.example/cert.pem"}).status_code, 403)
            response = post(body)
        self.assertEqual(response.status_code, 200, response.content)
        self.assertTrue(Suppression.objects.filter(email="x@example.com", reason="complaint").exists())


class MeasurementTests(LifecycleTestCase):
    def test_click_is_stamped_and_redirects_with_utm(self):
        self.run_engine()
        send = self.sends(self.bob.user_id, "onboarding").get()
        import re

        link = re.search(r'href="https://gn\.test(/api/v1/l/[^"]+)"', send.email.html).group(1)
        response = APIClient().get(link)
        self.assertEqual(response.status_code, 302)
        self.assertIn("utm_campaign=onboarding.welcome", response["Location"])
        send.refresh_from_db()
        self.assertIsNotNone(send.clicked_at)
        self.assertEqual(APIClient().get(f"{API}/l/forged").status_code, 404)

    def test_target_action_within_72h_converts(self):
        self.run_engine()
        self.goal_with_metric(self.bob)
        self.run_engine()
        send = self.sends(self.bob.user_id, "onboarding").get()
        self.assertEqual(send.target, "goal_created")
        self.assertIsNotNone(send.converted_at)

    def test_overview_preview_and_test_send(self):
        self.run_engine()
        overview = self.admin.get(f"{API}/lifecycle-emails/overview?days=7")
        self.assertEqual(overview.status_code, 200, overview.content)
        journeys = {j["key"]: j for j in overview.json()["journeys"]}
        self.assertTrue({"onboarding", "tips", "milestones", "win-back", "team-invite", "team-quiet"} <= set(journeys))
        welcome = journeys["onboarding"]["steps"][0]
        self.assertEqual(welcome["key"], "welcome")
        self.assertGreaterEqual(welcome["sent"], 1)
        self.assertEqual(self.bob.get(f"{API}/lifecycle-emails/overview").status_code, 403)

        preview = self.admin.post(f"{API}/lifecycle-emails/preview",
                                  {"journey": "onboarding", "step": "welcome", "user_id": self.bob.user_id}, format="json")
        self.assertEqual(preview.status_code, 200, preview.content)
        self.assertIn("Hi Bob,", preview.json()["text"])
        skipped = self.admin.post(f"{API}/lifecycle-emails/preview",
                                  {"journey": "onboarding", "step": "first-check-in", "user_id": self.bob.user_id},
                                  format="json")
        self.assertTrue(skipped.json()["skipped"])  # no goal yet
        with mock.patch("platform_system.mail.EmailMultiAlternatives.send"):
            sent = self.admin.post(f"{API}/lifecycle-emails/test", {"journey": "onboarding", "step": "welcome"},
                                   format="json")
        self.assertEqual(sent.status_code, 200, sent.content)
        self.assertEqual(sent.json()["to"], "ada@example.com")

        # One user's messages, for their page in the console.
        mine = self.admin.get(f"{API}/lifecycle-emails?filter{{user_id}}={self.bob.user_id}")
        self.assertEqual(mine.json()["total"], 1)


class JourneyTests(LifecycleTestCase):
    def test_milestones(self):
        goal_id, metric_id = self.goal_with_metric(self.bob)
        self.bob.post(f"{API}/check-ins", {"metric": metric_id, "value": 60}, format="json")
        self.bob.post(f"{API}/check-ins", {"metric": metric_id, "value": 70}, format="json")
        self.assertEqual(list(Enrollment.objects.filter(user_id=self.bob.user_id, journey="milestones")
                              .values_list("key", flat=True)), [f"{goal_id}:50"])
        self.bob.post(f"{API}/check-ins", {"metric": metric_id, "value": 100}, format="json")
        self.run_engine()
        subjects = set(self.sends(self.bob.user_id, "milestones").values_list("subject", flat=True))
        self.assertEqual(subjects, {"Halfway there: Run more", "You did it: Run more"})

    def test_win_back_enters_on_a_fresh_lapse_and_exits_on_return(self):
        UserPresence.objects.filter(user_id=self.bob.user_id).update(last_seen_at=timezone.now() - timedelta(days=8))
        UserPresence.objects.filter(user_id=self.admin.user_id).update(last_seen_at=timezone.now() - timedelta(days=40))
        goal_id, metric_id = self.goal_with_metric(self.bob)
        Metric.objects.filter(id=metric_id).update(check_in_due_at=timezone.now() - timedelta(days=1))
        UserPresence.objects.filter(user_id=self.bob.user_id).update(last_seen_at=timezone.now() - timedelta(days=8))
        self.run_engine()
        self.assertFalse(Enrollment.objects.filter(user_id=self.admin.user_id, journey="win-back").exists())
        send = self.sends(self.bob.user_id, "win-back").get()
        self.assertEqual(send.subject, "1 check-in is waiting")
        UserPresence.objects.filter(user_id=self.bob.user_id).update(last_seen_at=timezone.now() + timedelta(minutes=1))
        self.run_engine()
        send.refresh_from_db()
        self.assertIsNotNone(send.converted_at)  # target: came back
        self.run_engine(timedelta(days=8))
        enrollment = Enrollment.objects.get(user_id=self.bob.user_id, journey="win-back")
        self.assertEqual(enrollment.exit_reason, "came back")

    def test_team_invite_after_two_active_weeks_alone(self):
        from platform_system.models import UserDay

        today = timezone.now().date()
        UserDay.objects.create(user_id=self.bob.user_id, date=today - timedelta(days=10), web=True)
        self.run_engine()
        self.assertEqual(self.sends(self.bob.user_id, "team-invite").get().subject, "Track this with your team")
        self.assertFalse(self.sends(self.admin.user_id, "team-invite").exists())  # active one week only

    def test_removing_a_user_forgets_their_lifecycle_data(self):
        self.run_engine()
        self.bob.put(f"{API}/email/preferences", {"categories": {"tips": False}}, format="json")
        user_removed.send(sender=None, user_id=self.bob.user_id, transfer_to=None)
        for model in (Enrollment, LifecycleSend, Signal, EmailPreference):
            self.assertFalse(model.objects.filter(user_id=self.bob.user_id).exists(), model)

