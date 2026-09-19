"""Full CRUD roundtrip through the generic `crud_factory` for the `Goal` entity."""

from datetime import UTC, datetime

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password
from app.models.rbac import RoleAssignment
from app.models.tenancy import Organization, OrgMembership, OrgMembershipStatus
from app.models.user import User


async def test_goal_crud_roundtrip(client: AsyncClient, db_session: AsyncSession, seed_rbac):
    org = Organization(name="Goal Org", slug="goal-org")
    db_session.add(org)
    await db_session.flush()

    admin_user = User(email="admin@example.com", name="Admin", password_hash=hash_password("pw"))
    db_session.add(admin_user)
    await db_session.flush()

    db_session.add(
        OrgMembership(
            org_id=org.id,
            user_id=admin_user.id,
            status=OrgMembershipStatus.active,
            joined_at=datetime.now(UTC),
        )
    )
    db_session.add(RoleAssignment(actor_id=admin_user.id, org_id=org.id, role_id=seed_rbac["org_admin"]))
    await db_session.commit()

    token = create_access_token(str(admin_user.id))
    headers = {"Authorization": f"Bearer {token}"}

    create_response = await client.post(
        "/goals",
        json={"org_id": str(org.id), "title": "Ship v1", "description": "Get it out the door"},
        headers=headers,
    )
    assert create_response.status_code == 201
    created = create_response.json()
    assert created["title"] == "Ship v1"
    assert created["status"] == "not_started"
    assert created["created_by_user_id"] == str(admin_user.id)
    goal_id = created["id"]

    list_response = await client.get(f"/goals?org_id={org.id}", headers=headers)
    assert list_response.status_code == 200
    list_body = list_response.json()
    assert list_body["total"] == 1
    assert list_body["page"] == 1
    assert list_body["items"][0]["id"] == goal_id

    search_response = await client.get(f"/goals?org_id={org.id}&q=ship", headers=headers)
    assert search_response.status_code == 200
    assert search_response.json()["total"] == 1

    filter_miss_response = await client.get(f"/goals?org_id={org.id}&status=done", headers=headers)
    assert filter_miss_response.status_code == 200
    assert filter_miss_response.json()["total"] == 0

    get_response = await client.get(f"/goals/{goal_id}", headers=headers)
    assert get_response.status_code == 200
    assert get_response.json()["title"] == "Ship v1"

    update_response = await client.patch(f"/goals/{goal_id}", json={"status": "in_progress"}, headers=headers)
    assert update_response.status_code == 200
    assert update_response.json()["status"] == "in_progress"

    delete_response = await client.delete(f"/goals/{goal_id}", headers=headers)
    assert delete_response.status_code == 204

    get_after_delete = await client.get(f"/goals/{goal_id}", headers=headers)
    assert get_after_delete.status_code == 404


async def test_goal_list_requires_org_id(client: AsyncClient, db_session: AsyncSession, seed_rbac):
    admin_user = User(email="admin2@example.com", name="Admin2", password_hash=hash_password("pw"))
    db_session.add(admin_user)
    await db_session.commit()

    token = create_access_token(str(admin_user.id))
    response = await client.get("/goals", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"
