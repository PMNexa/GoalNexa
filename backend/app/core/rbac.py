"""Authentication + RBAC dependencies.

Contains the one shared 404-before-403 helper (`check_org_access`) that both
`app/api/crud_factory.py` and the bespoke route modules call directly from
route bodies, plus `require_permission()`, a dependency factory for routes
that already have `org_id` in their path (so it can be resolved before the
route body runs).

404-before-403: a non-member of an org must get a 404 (never reveal whether
the org/resource exists), and only once membership existence is confirmed do
we evaluate suspended-status (403 `membership_inactive`) and the actual
permission grant (403 `permission_denied`). This can't be a stacked
`Depends` for item-level routes (e.g. `GET /goals/{id}`) since the org_id
isn't known until the row is fetched — so `check_org_access` is a plain
async function, called explicitly, not another `Depends`.
"""

import uuid
from collections.abc import Callable, Coroutine
from typing import Any

import jwt
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.db.session import get_db
from app.models.rbac import Permission, Role, RoleAssignment, RolePermission
from app.models.tenancy import OrgMembership, OrgMembershipStatus
from app.models.user import User


def _http_error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "field_errors": None},
    )


async def get_current_user(
    request: Request, db: AsyncSession = Depends(get_db)
) -> User:
    """Resolve the caller's `User` from a `Bearer` JWT access token.

    A dependency, so it raises `HTTPException` (it has no `Response` object
    of its own to build a `JSONResponse` from) — the global `HTTPException`
    handler in `main.py` unwraps this into the flat error-body contract.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise _http_error(status.HTTP_401_UNAUTHORIZED, "invalid_token", "Not authenticated.")
    raw_token = auth_header.removeprefix("Bearer ").strip()
    try:
        claims = decode_token(raw_token)
    except jwt.PyJWTError as exc:
        raise _http_error(status.HTTP_401_UNAUTHORIZED, "invalid_token", "Invalid or expired token.") from exc

    if claims.get("type") != "access":
        raise _http_error(status.HTTP_401_UNAUTHORIZED, "invalid_token", "Invalid or expired token.")

    try:
        user_id = uuid.UUID(str(claims.get("sub")))
    except (TypeError, ValueError) as exc:
        raise _http_error(status.HTTP_401_UNAUTHORIZED, "invalid_token", "Invalid or expired token.") from exc

    user = await db.get(User, user_id)
    if user is None:
        raise _http_error(status.HTTP_401_UNAUTHORIZED, "invalid_token", "Invalid or expired token.")
    return user


async def has_permission(db: AsyncSession, user_id: uuid.UUID, org_id: uuid.UUID, code: str) -> bool:
    """Does `user_id` hold `code` within `org_id`, via any `RoleAssignment`?"""
    stmt = (
        select(Permission.id)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .join(Role, Role.id == RolePermission.role_id)
        .join(RoleAssignment, RoleAssignment.role_id == Role.id)
        .where(
            RoleAssignment.actor_id == user_id,
            RoleAssignment.org_id == org_id,
            Permission.code == code,
        )
        .limit(1)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none() is not None


async def has_permission_in_any_org(db: AsyncSession, user_id: uuid.UUID, code: str) -> bool:
    """Does `user_id` hold `code` in ANY org (no `org_id` filter)?

    Used for actions that have no target org yet, e.g. `POST /orgs`.
    """
    stmt = (
        select(Permission.id)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .join(Role, Role.id == RolePermission.role_id)
        .join(RoleAssignment, RoleAssignment.role_id == Role.id)
        .where(RoleAssignment.actor_id == user_id, Permission.code == code)
        .limit(1)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none() is not None


async def check_org_access(
    db: AsyncSession, user_id: uuid.UUID, org_id: uuid.UUID, permission_code: str
) -> OrgMembership:
    """The shared 404-before-403 gate. Call this directly from route bodies
    (via `crud_factory` or a bespoke route), not as a stacked `Depends`.

    1. No `OrgMembership` row at all for (user_id, org_id) -> 404 `not_found`.
    2. Membership `status == suspended` -> 403 `membership_inactive`.
    3. Caller lacks `permission_code` in this org -> 403 `permission_denied`.

    Returns the `OrgMembership` row on success, in case the caller wants it.
    """
    result = await db.execute(
        select(OrgMembership).where(OrgMembership.org_id == org_id, OrgMembership.user_id == user_id)
    )
    membership = result.scalars().first()
    if membership is None:
        raise _http_error(status.HTTP_404_NOT_FOUND, "not_found", "Resource not found.")

    if membership.status == OrgMembershipStatus.suspended:
        raise _http_error(
            status.HTTP_403_FORBIDDEN,
            "membership_inactive",
            "Your membership in this organization is inactive.",
        )

    allowed = await has_permission(db, user_id, org_id, permission_code)
    if not allowed:
        raise _http_error(
            status.HTTP_403_FORBIDDEN,
            "permission_denied",
            "You do not have permission to do this.",
        )

    return membership


def require_permission(code: str) -> Callable[..., Coroutine[Any, Any, OrgMembership]]:
    """Dependency factory for routes with `org_id` as a path param.

    Reads `org_id` from `request.path_params` (every org-scoped route in
    this project names its path param `org_id`), resolves the current user,
    and applies the same `check_org_access` 404-before-403 gate.
    """

    async def _dependency(
        request: Request,
        db: AsyncSession = Depends(get_db),
        user: User = Depends(get_current_user),
    ) -> OrgMembership:
        raw_org_id = request.path_params.get("org_id")
        if raw_org_id is None:
            raise _http_error(status.HTTP_422_UNPROCESSABLE_ENTITY, "validation_error", "Missing org_id.")
        try:
            org_id = uuid.UUID(str(raw_org_id))
        except ValueError as exc:
            raise _http_error(
                status.HTTP_422_UNPROCESSABLE_ENTITY, "validation_error", "Invalid org_id."
            ) from exc

        return await check_org_access(db, user.id, org_id, code)

    return _dependency
