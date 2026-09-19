"""404-before-403: a non-member gets 404, a member-without-permission gets 403.

Users/orgs/memberships are inserted directly via `db_session` (bypassing the
API) since this project's bootstrap signup only ever creates the first org's
first admin — every other actor here is a plain RBAC fixture, not something
this test is trying to exercise the invite flow for.
"""

from datetime import UTC, datetime

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password
from app.models.rbac import RoleAssignment
from app.models.tenancy import Organization, OrgMembership, OrgMembershipStatus
from app.models.user import User


async def _make_user(db_session: AsyncSession, email: str) -> User:
    user = User(email=email, name=email, password_hash=hash_password("irrelevant-password"))
    db_session.add(user)
    await db_session.flush()
    return user


async def test_non_member_gets_404_not_403(client: AsyncClient, db_session: AsyncSession, seed_rbac):
    org = Organization(name="Acme", slug="acme")
    db_session.add(org)
    await db_session.flush()

    outsider = await _make_user(db_session, "outsider@example.com")
    await db_session.commit()

    token = create_access_token(str(outsider.id))
    response = await client.get(f"/orgs/{org.id}/members", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 404
    assert response.json()["code"] == "not_found"


async def test_suspended_member_gets_403_membership_inactive(
    client: AsyncClient, db_session: AsyncSession, seed_rbac
):
    org = Organization(name="Acme Suspended", slug="acme-suspended")
    db_session.add(org)
    await db_session.flush()

    suspended_user = await _make_user(db_session, "suspended@example.com")
    await db_session.flush()

    db_session.add(
        OrgMembership(
            org_id=org.id,
            user_id=suspended_user.id,
            status=OrgMembershipStatus.suspended,
            joined_at=datetime.now(UTC),
        )
    )
    db_session.add(
        RoleAssignment(actor_id=suspended_user.id, org_id=org.id, role_id=seed_rbac["org_admin"])
    )
    await db_session.commit()

    token = create_access_token(str(suspended_user.id))
    response = await client.get(f"/orgs/{org.id}/members", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403
    assert response.json()["code"] == "membership_inactive"


async def test_member_without_permission_gets_403_permission_denied(
    client: AsyncClient, db_session: AsyncSession, seed_rbac
):
    org = Organization(name="Acme Viewer", slug="acme-viewer")
    db_session.add(org)
    await db_session.flush()

    viewer_user = await _make_user(db_session, "viewer@example.com")
    await db_session.flush()

    db_session.add(
        OrgMembership(
            org_id=org.id,
            user_id=viewer_user.id,
            status=OrgMembershipStatus.active,
            joined_at=datetime.now(UTC),
        )
    )
    db_session.add(RoleAssignment(actor_id=viewer_user.id, org_id=org.id, role_id=seed_rbac["viewer"]))
    await db_session.commit()

    token = create_access_token(str(viewer_user.id))
    response = await client.post(
        f"/orgs/{org.id}/members/invite",
        json={"email": "someone@example.com"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403
    assert response.json()["code"] == "permission_denied"
