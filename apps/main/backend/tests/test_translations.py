"""The API answers in the request's language (P-16, docs/translations.md):
schema texts and error messages are written in English and translated
where they're sent (core_api/i18n.py), from each app's
`locale/vi/LC_MESSAGES/django.po` (`manage.py collect_ui_strings`).
Without a language (agents, ingest, these other tests) it's English."""

import gettext as gnu_gettext
import io
import uuid
from pathlib import Path

from django.apps import apps
from django.conf import settings
from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from platform_system.management.commands.collect_ui_strings import read_po
from tests.test_tenant_isolation import API, signup

VI = {"HTTP_ACCEPT_LANGUAGE": "vi"}


def field(schema, name):
    return next(f for f in schema["fields"] if f["name"] == name)


@override_settings(AUTH_FIRST_RUN_SETUP=False)
class TranslationTests(TestCase):
    def setUp(self):
        self.alice = signup("Alice")

    def test_schema_in_vietnamese(self):
        schema = self.alice.get(f"{API}/goals/schema", **VI).json()
        self.assertEqual(schema["label"], "mục tiêu")
        self.assertEqual(field(schema, "target_date")["label"], "Hạn chót")
        self.assertEqual(schema["form_layout"][0]["title"], "Mục tiêu")
        status = field(schema, "status")
        self.assertIn("Đã lưu trữ", [c["label"] for c in status["choices"]])
        metric = self.alice.get(f"{API}/metrics/schema", **VI).json()
        self.assertEqual(field(metric, "target_value")["label"], "Chỉ tiêu")
        self.assertEqual(field(metric, "base_value")["label"], "Giá trị ban đầu")

    def test_language_cookie(self):
        self.alice.cookies[settings.LANGUAGE_COOKIE_NAME] = "vi"
        schema = self.alice.get(f"{API}/goals/schema").json()
        self.assertEqual(field(schema, "target_date")["label"], "Hạn chót")

    def test_english_without_a_language(self):
        schema = self.alice.get(f"{API}/goals/schema").json()
        self.assertEqual(schema["label"], "goal")
        self.assertEqual(field(schema, "target_date")["label"], "Target date")
        self.assertEqual(schema["form_layout"][0]["title"], "Goal")
        response = self.alice.post(f"{API}/goals/reorder", {"ids": []}, format="json")
        self.assertEqual(response.json()["message"], "Request failed validation.")
        self.assertEqual(response.json()["field_errors"]["ids"], ["A list of ids, first to last."])

    def test_errors_in_vietnamese(self):
        # A literal ValidationError message, translated by the exception handler.
        response = self.alice.post(f"{API}/goals/reorder", {"ids": []}, format="json", **VI)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["message"], "Yêu cầu không hợp lệ.")
        self.assertEqual(response.json()["field_errors"]["ids"], ["Danh sách ID, theo thứ tự từ đầu đến cuối."])
        # An ApiError (platform-auth's wrong password).
        response = APIClient().post(f"{API}/auth/login", {"email": "alice@example.com", "password": "wrong-password"},
                                    format="json", **VI)
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["message"], "Email hoặc mật khẩu không đúng.")
        # A message built with values (`gettext(...).format(...)`).
        too_many = [str(uuid.uuid4()) for _ in range(501)]
        response = self.alice.post(f"{API}/goals/reorder", {"ids": too_many}, format="json", **VI)
        self.assertEqual(response.json()["field_errors"]["ids"], ["Tối đa 500 ID khác nhau."])


def shipped_po_files() -> list[Path]:
    paths = [Path(app.path) / "locale" for app in apps.get_app_configs()]
    paths += [Path(p) for p in settings.LOCALE_PATHS]
    return sorted({po for base in paths if base.is_dir() for po in base.glob("*/LC_MESSAGES/django.po")
                   if "site-packages" not in po.parts})


class CatalogTests(TestCase):
    def test_every_string_is_translated_and_compiled(self):
        files = shipped_po_files()
        self.assertGreaterEqual(len(files), 5)
        for po in files:
            entries = read_po(po)
            self.assertTrue(entries, po)
            untranslated = [msgid for msgid, msgstr in entries.items() if not msgstr.strip()]
            self.assertEqual(untranslated, [], f"{po}: untranslated")
            # The committed .mo must be compiled from this .po (msgfmt -o django.mo django.po).
            mo = po.with_suffix(".mo")
            self.assertTrue(mo.exists(), f"{mo} missing")
            with mo.open("rb") as handle:
                catalog = gnu_gettext.GNUTranslations(handle)
            stale = [msgid for msgid, msgstr in entries.items() if catalog.gettext(msgid) != msgstr]
            self.assertEqual(stale, [], f"{mo}: out of date - recompile it")

    def test_one_translation_per_string(self):
        # Django merges every app's catalog into one: a string translated two
        # ways in two apps would show the first app's everywhere.
        seen = {}
        for po in shipped_po_files():
            language = po.parent.parent.name
            for msgid, msgstr in read_po(po).items():
                first = seen.setdefault((language, msgid), (msgstr, po))
                self.assertEqual(first[0], msgstr, f"{msgid!r}: {first[1]} and {po} disagree")

    def test_catalogs_are_up_to_date(self):
        # A new or changed label/message must be collected (and translated).
        call_command("collect_ui_strings", "--check", stdout=io.StringIO(), stderr=io.StringIO())
