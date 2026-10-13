"""Every `Meta.form_layout` names real, editable fields of its resource -
a renamed field would silently drop out of its section otherwise."""

from django.test import TestCase, override_settings

from tests.test_tenant_isolation import API, signup


@override_settings(AUTH_FIRST_RUN_SETUP=False)
class FormLayoutTests(TestCase):
    def test_layouts_name_editable_fields(self):
        alice = signup("Alice")
        for resource in ("goals", "metrics", "template-goals", "template-metrics"):
            schema = alice.get(f"{API}/{resource}/schema").json()
            # Like the form's `isWritable`: a to-one relation is resolved by the view, so always "read only".
            editable = {f["name"] for f in schema["fields"]
                        if not f["read_only"] or (f["type"] == "relation" and not f.get("many"))}
            self.assertIn("form_layout", schema, resource)
            for section in schema["form_layout"]:
                for entry in section["fields"]:
                    name = entry if isinstance(entry, str) else entry["name"]
                    self.assertIn(name, editable, f"{resource}: {name}")
                    rule = None if isinstance(entry, str) else entry.get("show_if")
                    if rule:
                        self.assertIn(rule["field"], editable, f"{resource}: {name} shows by {rule['field']}")
