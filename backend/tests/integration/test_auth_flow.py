"""signup -> login -> refresh -> logout, plus the login rate limit.

Requires a real Postgres reachable at TEST_DATABASE_URL (see tests/conftest.py).
"""

from httpx import AsyncClient


async def test_signup_login_refresh_logout(client: AsyncClient, seed_rbac):
    signup_payload = {
        "name": "Ada Lovelace",
        "email": "ada@example.com",
        "password": "correct horse battery staple",
        "org_name": "Ada Co",
        "org_slug": "ada-co",
    }
    signup_response = await client.post("/auth/signup", json=signup_payload)
    assert signup_response.status_code == 201
    body = signup_response.json()
    assert "access_token" in body
    assert body["orgs"][0]["slug"] == "ada-co"
    assert "refresh_token" in signup_response.cookies
    assert "refresh_token" not in body  # never in the JSON body

    # Bootstrap is now closed: a second signup is rejected.
    second_signup = await client.post(
        "/auth/signup",
        json={**signup_payload, "email": "other@example.com", "org_slug": "other-co"},
    )
    assert second_signup.status_code == 409
    assert second_signup.json()["code"] == "signup_closed"

    login_response = await client.post(
        "/auth/login", json={"email": "ada@example.com", "password": signup_payload["password"]}
    )
    assert login_response.status_code == 200
    access_token = login_response.json()["access_token"]

    refresh_response = await client.post("/auth/refresh")
    assert refresh_response.status_code == 200
    assert "access_token" in refresh_response.json()
    assert "refresh_token" in refresh_response.cookies

    logout_response = await client.post("/auth/logout", headers={"Authorization": f"Bearer {access_token}"})
    assert logout_response.status_code == 204

    # The rotated-out refresh token can no longer be used.
    stale_refresh = await client.post("/auth/refresh")
    assert stale_refresh.status_code == 401
    assert stale_refresh.json()["code"] == "invalid_refresh_token"


async def test_login_rate_limited_after_five_failures(client: AsyncClient, seed_rbac):
    signup_payload = {
        "name": "Grace Hopper",
        "email": "grace@example.com",
        "password": "correct horse battery staple",
        "org_name": "Grace Co",
        "org_slug": "grace-co",
    }
    await client.post("/auth/signup", json=signup_payload)

    for _ in range(5):
        response = await client.post(
            "/auth/login", json={"email": "grace@example.com", "password": "definitely-wrong"}
        )
        assert response.status_code == 401
        assert response.json()["code"] == "invalid_credentials"

    limited_response = await client.post(
        "/auth/login", json={"email": "grace@example.com", "password": "definitely-wrong"}
    )
    assert limited_response.status_code == 429
    assert limited_response.json()["code"] == "rate_limited"


async def test_login_invalid_credentials_for_unknown_email(client: AsyncClient, seed_rbac):
    response = await client.post("/auth/login", json={"email": "nobody@example.com", "password": "whatever"})
    assert response.status_code == 401
    assert response.json()["code"] == "invalid_credentials"
