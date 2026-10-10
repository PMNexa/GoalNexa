"""The OpenAPI document (/api/v1/schema) and its pages: generated without
a warning for everything main mounts, and platform-core's conventions
described on every BaseViewSet (core_api/openapi.py).

`python manage.py test tests` in apps/main/backend.
"""

import io

from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

API = "/api/v1"


class OpenApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def schema(self):
        response = self.client.get(f"{API}/schema?format=json")
        self.assertEqual(response.status_code, 200)
        return response.json()

    def test_generates_valid_with_no_warnings(self):
        # A new view spectacular can't describe fails here, not silently
        # as a free-form operation.
        call_command("spectacular", "--validate", "--fail-on-warn", stdout=io.StringIO(), stderr=io.StringIO())

    def test_schema_and_pages_are_public(self):
        self.assertEqual(self.schema()["info"]["title"], "GoalNexa API")
        for page in ("docs", "redoc"):
            self.assertEqual(self.client.get(f"{API}/{page}").status_code, 200)

    def test_base_viewset_conventions(self):
        document = self.schema()
        goals = document["paths"][f"{API}/goals"]["get"]
        self.assertEqual(
            {"include[]", "exclude[]", "page", "page_size", "sort", "q"},
            {parameter["name"] for parameter in goals["parameters"]},
        )
        self.assertIn("filter{field.icontains}", goals["description"])
        self.assertEqual(goals["security"], [{"bearerAuth": []}])
        self.assertEqual(goals["responses"]["401"]["content"]["application/json"]["schema"], {"$ref": "#/components/schemas/Error"})

        page = document["components"]["schemas"]["PaginatedGoalList"]
        self.assertEqual(set(page["required"]), {"items", "total", "page", "page_size"})

        # A relation: an id, or the object when sideloaded.
        goal_field = document["components"]["schemas"]["Metric"]["properties"]["goal"]
        self.assertEqual(goal_field["oneOf"][1], {"$ref": "#/components/schemas/Goal"})

        self.assertEqual(set(document["components"]["schemas"]["Error"]["required"]), {"code", "message", "field_errors"})
        self.assertIn(f"{API}/goals/schema", document["paths"])
