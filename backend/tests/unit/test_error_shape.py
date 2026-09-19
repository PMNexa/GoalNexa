"""The one thing that must be exactly right: every error response is
`{"code": str, "message": str, "field_errors": dict | null}`.

A Pydantic validation error (bad email) never reaches a route body or the
database — it's rejected during request parsing — so this is safe to run as
a true unit test with `TestClient`, no Postgres required.
"""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_signup_validation_error_has_flat_error_shape():
    response = client.post(
        "/auth/signup",
        json={
            "name": "Ada",
            "email": "not-an-email",
            "password": "correct horse battery staple",
            "org_name": "Ada Co",
            "org_slug": "ada-co",
        },
    )
    assert response.status_code == 422
    body = response.json()

    assert set(body.keys()) == {"code", "message", "field_errors"}
    assert body["code"] == "validation_error"
    assert isinstance(body["message"], str)
    assert isinstance(body["field_errors"], dict)
    assert "email" in body["field_errors"]
    assert isinstance(body["field_errors"]["email"], list)
    assert all(isinstance(msg, str) for msg in body["field_errors"]["email"])


def test_health_check_ok():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
