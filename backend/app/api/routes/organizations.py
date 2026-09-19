"""`POST /orgs` — authenticated org creation.

No target org exists yet for this action, so it's gated by
`has_permission_in_any_org` rather than `require_permission`/`check_org_access`
(there is no `org_id` to 404-before-403 against). The creator is auto-joined
as `org_admin` of the new org, same as bootstrap signup.
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, has_permission_in_any_org
from app.models.rbac import Role, RoleAssignment
from app.models.tenancy import Organization, OrgMembership, OrgMembershipStatus
from app.models.user import User
from app.schemas.tenancy import OrganizationCreate, OrgSummary

router = APIRouter(prefix="/orgs")


@router.post("", response_model=OrgSummary, status_code=status.HTTP_201_CREATED)
async def create_organization(
    payload: OrganizationCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Organization:
    """Any already-authenticated user holding `organization.create` in at
    least one org (in practice: any existing org_admin) may mint a further
    org. The creator is auto-joined as that new org's `org_admin`.
    """
    allowed = await has_permission_in_any_org(db, user.id, "organization.create")
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "permission_denied",
                "message": "You do not have permission to create an organization.",
                "field_errors": None,
            },
        )

    org_admin_role = await db.scalar(select(Role).where(Role.name == "org_admin", Role.org_id.is_(None)))
    if org_admin_role is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "rbac_not_seeded",
                "message": "The RBAC catalog has not been seeded yet.",
                "field_errors": None,
            },
        )

    org = Organization(name=payload.name, slug=payload.slug)
    db.add(org)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "integrity_error",
                "message": "This organization slug is already taken.",
                "field_errors": {"slug": ["This organization slug is already taken."]},
            },
        ) from None

    now = datetime.now(UTC)
    db.add(OrgMembership(org_id=org.id, user_id=user.id, status=OrgMembershipStatus.active, joined_at=now))
    db.add(RoleAssignment(actor_id=user.id, org_id=org.id, role_id=org_admin_role.id))
    await db.commit()
    await db.refresh(org)
    return org
