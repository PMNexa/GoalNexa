"""Org membership management: listing, inviting, status updates, and invite-accept.

Two different accept flows exist by design:
- `POST /invites/{token}/accept` (public, no auth): for a brand-new
  placeholder `User` created by the invite flow (no password yet) — proves
  token ownership via the opaque invite token and sets a password.
- `POST /orgs/{org_id}/members/{id}/accept` (authenticated): for an
  already-existing `User` who was invited by email — they're already able
  to log in, so they self-accept their own `invited` membership once
  authenticated, no separate token needed.

No router-level prefix here (unlike other route modules) since these routes
span two different URL families (`/orgs/...` and `/invites/...`).
"""

import secrets
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_permission
from app.core.config import settings
from app.core.security import (
    create_access_token,
    generate_invite_token,
    generate_refresh_token,
    hash_invite_token,
    hash_password,
    hash_refresh_token,
)
from app.models.auth import AuthIdentity, AuthProvider, RefreshToken
from app.models.tenancy import Invite, Organization, OrgMembership, OrgMembershipStatus
from app.models.user import User
from app.schemas.auth import LoginResponse
from app.schemas.tenancy import (
    AcceptInviteRequest,
    InviteCreate,
    InviteRead,
    OrgMembershipRead,
    OrgMembershipUpdate,
    OrgSummary,
)

router = APIRouter()


def _not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"code": "not_found", "message": "Resource not found.", "field_errors": None},
    )


@router.get("/orgs/{org_id}/members", response_model=list[OrgMembershipRead])
async def list_members(
    org_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _membership: OrgMembership = Depends(require_permission("org_membership.list")),
) -> list[OrgMembership]:
    result = await db.execute(select(OrgMembership).where(OrgMembership.org_id == org_id))
    return list(result.scalars().all())


@router.post("/orgs/{org_id}/members/invite", response_model=InviteRead, status_code=status.HTTP_201_CREATED)
async def invite_member(
    org_id: uuid.UUID,
    payload: InviteCreate,
    db: AsyncSession = Depends(get_db),
    inviter: User = Depends(get_current_user),
    _membership: OrgMembership = Depends(require_permission("org_membership.invite")),
) -> InviteRead:
    email = payload.email.lower()

    result = await db.execute(select(User).where(User.email == email))
    invitee = result.scalars().first()

    if invitee is None:
        invitee = User(
            name=email.split("@")[0],
            email=email,
            password_hash=hash_password(secrets.token_urlsafe(32)),
        )
        db.add(invitee)
        try:
            await db.flush()
        except IntegrityError:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "integrity_error",
                    "message": "Could not create invitee.",
                    "field_errors": None,
                },
            ) from None

    membership = OrgMembership(org_id=org_id, user_id=invitee.id, status=OrgMembershipStatus.invited)
    db.add(membership)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "already_member",
                "message": "This user is already a member of this organization.",
                "field_errors": None,
            },
        ) from None

    raw_token = generate_invite_token()
    now = datetime.now(UTC)
    db.add(
        Invite(
            org_membership_id=membership.id,
            token_hash=hash_invite_token(raw_token),
            expires_at=now + timedelta(days=7),
            invited_by_user_id=inviter.id,
        )
    )
    await db.commit()

    return InviteRead(invite_link=f"{settings.APP_BASE_URL}/invites/{raw_token}/accept")


@router.patch("/orgs/{org_id}/members/{member_id}", response_model=OrgMembershipRead)
async def update_member_status(
    org_id: uuid.UUID,
    member_id: uuid.UUID,
    payload: OrgMembershipUpdate,
    db: AsyncSession = Depends(get_db),
    _membership: OrgMembership = Depends(require_permission("org_membership.update")),
) -> OrgMembership:
    result = await db.execute(
        select(OrgMembership).where(OrgMembership.id == member_id, OrgMembership.org_id == org_id)
    )
    target = result.scalars().first()
    if target is None:
        raise _not_found()

    legal_transitions = {
        (OrgMembershipStatus.active, OrgMembershipStatus.suspended),
        (OrgMembershipStatus.suspended, OrgMembershipStatus.active),
    }
    if (target.status, payload.status) not in legal_transitions:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "validation_error",
                "message": "Illegal membership status transition.",
                "field_errors": {"status": [f"Cannot transition from {target.status} to {payload.status}."]},
            },
        )

    target.status = payload.status
    await db.commit()
    await db.refresh(target)
    return target


@router.post("/invites/{token}/accept", response_model=LoginResponse)
async def accept_invite_by_token(
    token: str, payload: AcceptInviteRequest, db: AsyncSession = Depends(get_db)
) -> LoginResponse:
    """Public: accept an invite by its opaque token, setting a password.

    For the placeholder-`User` case (new invitee with no prior account).
    """
    token_hash = hash_invite_token(token)
    result = await db.execute(select(Invite).where(Invite.token_hash == token_hash))
    invite = result.scalars().first()

    now = datetime.now(UTC)
    if invite is None or invite.used_at is not None or invite.expires_at < now:
        raise _not_found()

    membership = await db.get(OrgMembership, invite.org_membership_id)
    if membership is None:
        raise _not_found()

    invitee = await db.get(User, membership.user_id)
    if invitee is None:
        raise _not_found()

    invitee.password_hash = hash_password(payload.password)

    identity_result = await db.execute(select(AuthIdentity).where(AuthIdentity.user_id == invitee.id))
    if identity_result.scalars().first() is None:
        db.add(AuthIdentity(user_id=invitee.id, provider=AuthProvider.local))

    membership.status = OrgMembershipStatus.active
    membership.joined_at = now
    invite.used_at = now

    access_token = create_access_token(str(invitee.id))
    raw_refresh_token = generate_refresh_token()
    db.add(
        RefreshToken(
            user_id=invitee.id,
            token_hash=hash_refresh_token(raw_refresh_token),
            issued_at=now,
            expires_at=now + timedelta(days=settings.JWT_REFRESH_TTL_DAYS),
        )
    )
    await db.commit()

    org = await db.get(Organization, membership.org_id)

    return LoginResponse(
        access_token=access_token,
        orgs=[OrgSummary(id=org.id, name=org.name, slug=org.slug)] if org else [],
    )


@router.post("/orgs/{org_id}/members/{member_id}/accept", response_model=OrgMembershipRead)
async def accept_own_invited_membership(
    org_id: uuid.UUID,
    member_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> OrgMembership:
    """Authenticated self-accept for an already-existing user invited by email.

    404-before-403, applied manually here (no `org_id`-keyed permission
    check makes sense for accepting one's own invite): if the caller has no
    membership row at all in this org, or the row isn't theirs, or it isn't
    `member_id`, they get a 404 either way — never confirmation that the
    org/membership exists.
    """
    result = await db.execute(
        select(OrgMembership).where(OrgMembership.id == member_id, OrgMembership.org_id == org_id)
    )
    target = result.scalars().first()
    if target is None or target.user_id != user.id:
        raise _not_found()

    if target.status != OrgMembershipStatus.invited:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "validation_error",
                "message": "This membership is not pending an invite.",
                "field_errors": None,
            },
        )

    target.status = OrgMembershipStatus.active
    target.joined_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(target)
    return target
