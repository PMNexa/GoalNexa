"""`GET /orgs/{org_id}/permissions/mine` — the caller's own permission grants."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.rbac import Permission, Role, RoleAssignment, RolePermission
from app.models.tenancy import OrgMembership
from app.models.user import User
from app.schemas.rbac import MyPermissionRead

router = APIRouter()


@router.get("/orgs/{org_id}/permissions/mine", response_model=list[MyPermissionRead])
async def my_permissions(
    org_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[MyPermissionRead]:
    """The caller reports on their own grants.

    404-before-403 still applies: a non-member gets 404, not an empty list.
    Beyond membership existing, no specific permission is required — this is
    identity-scoped self-reporting, same posture as `GET /auth/me/orgs`.
    """
    membership_result = await db.execute(
        select(OrgMembership).where(OrgMembership.org_id == org_id, OrgMembership.user_id == user.id)
    )
    if membership_result.scalars().first() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "not_found", "message": "Resource not found.", "field_errors": None},
        )

    result = await db.execute(
        select(Permission.code)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .join(Role, Role.id == RolePermission.role_id)
        .join(RoleAssignment, RoleAssignment.role_id == Role.id)
        .where(RoleAssignment.actor_id == user.id, RoleAssignment.org_id == org_id)
    )
    codes = sorted(set(result.scalars().all()))
    return [MyPermissionRead(permission_code=code, org_id=org_id) for code in codes]
