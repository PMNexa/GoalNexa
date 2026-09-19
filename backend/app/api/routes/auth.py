"""Auth routes: signup (bootstrap-only), login, refresh, logout, me, me/orgs.

Error responses in this module are built as plain `JSONResponse`s matching
the flat `{code, message, field_errors}` contract directly, rather than via
`raise HTTPException` — these are hand-rolled business-rule rejections
(closed signup, bad credentials, rate limit) with no shared helper, and a
route body always has a `Response`-shaped return type available, so there's
no reason to route them through the exception-handling machinery.
"""

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy import func, select, text
from sqlalchemy import update as sa_update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password_or_dummy,
)
from app.models.auth import AuthIdentity, AuthProvider, LoginAttempt, RefreshToken
from app.models.rbac import Role, RoleAssignment
from app.models.tenancy import Organization, OrgMembership, OrgMembershipStatus
from app.models.user import User
from app.schemas.auth import LoginRequest, LoginResponse, MeResponse, RefreshResponse, SignupRequest
from app.schemas.tenancy import OrgSummary

router = APIRouter(prefix="/auth")

_RATE_LIMIT_WINDOW_MINUTES = 15
_RATE_LIMIT_MAX_ATTEMPTS = 5

# Fixed advisory-lock key for POST /auth/signup's bootstrap-closed check —
# an arbitrary but stable constant (crc32 of a fixed string), not meaningful
# beyond "every signup call agrees on it".
_SIGNUP_BOOTSTRAP_LOCK_KEY = 1537250605


def _error(
    status_code: int,
    code: str,
    message: str,
    field_errors: dict[str, list[str]] | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"code": code, "message": message, "field_errors": field_errors},
    )


def _invalid_refresh_token() -> JSONResponse:
    return _error(
        status.HTTP_401_UNAUTHORIZED,
        "invalid_refresh_token",
        "Your session has expired. Please log in again.",
    )


async def _active_orgs_for_user(db: AsyncSession, user_id) -> list[Organization]:
    result = await db.execute(
        select(Organization)
        .join(OrgMembership, OrgMembership.org_id == Organization.id)
        .where(OrgMembership.user_id == user_id, OrgMembership.status == OrgMembershipStatus.active)
    )
    return list(result.scalars().all())


def _set_refresh_cookie(response: Response, raw_refresh_token: str) -> None:
    response.set_cookie(
        key="refresh_token",
        value=raw_refresh_token,
        httponly=True,
        samesite="lax",
        secure=(settings.ENV != "dev"),
        max_age=settings.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60,
    )


@router.post("/signup", response_model=LoginResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    payload: SignupRequest, response: Response, db: AsyncSession = Depends(get_db)
) -> LoginResponse | JSONResponse:
    """Bootstrap-only public signup: the first-ever `User` + `Organization`.

    Only works while zero `Organization` rows exist deployment-wide; after
    that, every further org/member is created via `POST /orgs` (an
    authenticated org_admin) or the invite-accept flow.

    1. Acquire `pg_advisory_xact_lock` before the exists-check, in the same
       transaction, so two concurrent first-signups can't both observe zero
       orgs and both succeed.
    2. `organization` has any row at all -> 409 `signup_closed`.
    3. Create `User` + `AuthIdentity(provider=local)` + `Organization` +
       `OrgMembership(status=active)` + `RoleAssignment(role=org_admin)`,
       all in this one transaction.
    4. Issue tokens; set the refresh cookie; return `LoginResponse`.
    """
    email = payload.email.lower()

    await db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": _SIGNUP_BOOTSTRAP_LOCK_KEY})

    any_org_id = await db.scalar(select(Organization.id).limit(1))
    if any_org_id is not None:
        await db.rollback()
        return _error(
            status.HTTP_409_CONFLICT,
            "signup_closed",
            "Self-registration is closed. Contact your administrator for an invite.",
        )

    org_admin_role = await db.scalar(select(Role).where(Role.name == "org_admin", Role.org_id.is_(None)))
    if org_admin_role is None:
        await db.rollback()
        return _error(
            status.HTTP_409_CONFLICT,
            "signup_closed",
            "The RBAC catalog has not been seeded yet. Run migrations before signing up.",
        )

    user = User(name=payload.name, email=email, password_hash=hash_password(payload.password))
    db.add(user)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        return _error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "validation_error",
            "Request failed validation.",
            field_errors={"email": ["An account with this email already exists."]},
        )

    db.add(AuthIdentity(user_id=user.id, provider=AuthProvider.local))

    org = Organization(name=payload.org_name, slug=payload.org_slug)
    db.add(org)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        return _error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "validation_error",
            "Request failed validation.",
            field_errors={"org_slug": ["This organization slug is already taken."]},
        )

    now = datetime.now(UTC)
    db.add(OrgMembership(org_id=org.id, user_id=user.id, status=OrgMembershipStatus.active, joined_at=now))
    db.add(RoleAssignment(actor_id=user.id, org_id=org.id, role_id=org_admin_role.id))

    access_token = create_access_token(str(user.id))
    raw_refresh_token = generate_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_refresh_token(raw_refresh_token),
            issued_at=now,
            expires_at=now + timedelta(days=settings.JWT_REFRESH_TTL_DAYS),
        )
    )
    await db.commit()

    _set_refresh_cookie(response, raw_refresh_token)
    return LoginResponse(
        access_token=access_token,
        orgs=[OrgSummary(id=org.id, name=org.name, slug=org.slug)],
    )


@router.post("/login", response_model=LoginResponse)
async def login(
    payload: LoginRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db)
) -> LoginResponse | JSONResponse:
    """Authenticate by email + password; issue tokens.

    1. Rate limit check first (before any credentials check): 5 failed
       attempts per (email, client_ip) in a trailing 15-minute window -> 429.
    2. Look up the `User` by lowercased email.
    3. Timing-safe password verify (real hash, or the fixed dummy hash).
    4. Record a `LoginAttempt`; 401 (generic body) on failure.
    5. Issue an access token + refresh token; set the refresh cookie.
    """
    email = payload.email.lower()
    client_ip = request.client.host if request.client else "unknown"

    window_start = datetime.now(UTC) - timedelta(minutes=_RATE_LIMIT_WINDOW_MINUTES)
    failed_count = await db.scalar(
        select(func.count())
        .select_from(LoginAttempt)
        .where(
            LoginAttempt.email == email,
            LoginAttempt.client_ip == client_ip,
            LoginAttempt.succeeded.is_(False),
            LoginAttempt.created_at >= window_start,
        )
    )
    if (failed_count or 0) >= _RATE_LIMIT_MAX_ATTEMPTS:
        return _error(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "rate_limited",
            "Too many login attempts. Try again later.",
        )

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()

    password_ok = verify_password_or_dummy(payload.password, user.password_hash if user else None)

    if user is None or not password_ok:
        db.add(LoginAttempt(email=email, client_ip=client_ip, succeeded=False))
        await db.commit()
        return _error(status.HTTP_401_UNAUTHORIZED, "invalid_credentials", "Invalid email or password.")

    db.add(LoginAttempt(email=email, client_ip=client_ip, succeeded=True))

    orgs = await _active_orgs_for_user(db, user.id)

    access_token = create_access_token(str(user.id))
    raw_refresh_token = generate_refresh_token()
    now = datetime.now(UTC)
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_refresh_token(raw_refresh_token),
            issued_at=now,
            expires_at=now + timedelta(days=settings.JWT_REFRESH_TTL_DAYS),
        )
    )
    await db.commit()

    _set_refresh_cookie(response, raw_refresh_token)
    return LoginResponse(
        access_token=access_token,
        orgs=[OrgSummary(id=org.id, name=org.name, slug=org.slug) for org in orgs],
    )


@router.post("/refresh", response_model=RefreshResponse)
async def refresh(
    request: Request, response: Response, db: AsyncSession = Depends(get_db)
) -> RefreshResponse | JSONResponse:
    """Rotate the `refresh_token` cookie; issue a new access token.

    The presented token is revoked via an atomic conditional
    `UPDATE ... WHERE id = :id AND revoked_at IS NULL`, checked by rowcount
    — not a plain read-then-write — so two concurrent requests replaying the
    same stolen token can't both mint a child token. The new refresh token
    inherits the old one's absolute `expires_at` verbatim (the clock is not
    reset on rotation).
    """
    raw_token = request.cookies.get("refresh_token")
    if raw_token is None:
        return _invalid_refresh_token()

    token_hash = hash_refresh_token(raw_token)
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    stored_token = result.scalars().first()

    now = datetime.now(UTC)
    if stored_token is None or stored_token.revoked_at is not None or stored_token.expires_at < now:
        return _invalid_refresh_token()

    cas_result = await db.execute(
        sa_update(RefreshToken)
        .where(RefreshToken.id == stored_token.id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now, revoked_reason="rotated")
    )
    if cas_result.rowcount != 1:
        await db.rollback()
        return _invalid_refresh_token()

    new_raw_refresh_token = generate_refresh_token()
    db.add(
        RefreshToken(
            user_id=stored_token.user_id,
            token_hash=hash_refresh_token(new_raw_refresh_token),
            issued_at=now,
            expires_at=stored_token.expires_at,
        )
    )
    await db.commit()

    access_token = create_access_token(str(stored_token.user_id))
    _set_refresh_cookie(response, new_raw_refresh_token)
    return RefreshResponse(access_token=access_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    """Revoke the caller's current-session refresh token; idempotent. Always 204."""
    raw_token = request.cookies.get("refresh_token")
    if raw_token is not None:
        token_hash = hash_refresh_token(raw_token)
        now = datetime.now(UTC)
        await db.execute(
            sa_update(RefreshToken)
            .where(
                RefreshToken.token_hash == token_hash,
                RefreshToken.user_id == user.id,
                RefreshToken.revoked_at.is_(None),
            )
            .values(revoked_at=now, revoked_reason="logout")
        )
        await db.commit()

    response.delete_cookie(
        key="refresh_token",
        httponly=True,
        samesite="lax",
        secure=(settings.ENV != "dev"),
    )
    return None


@router.get("/me", response_model=MeResponse)
async def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.get("/me/orgs", response_model=list[OrgSummary])
async def me_orgs(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list[Organization]:
    """Every org the caller has an `active` `OrgMembership` in."""
    return await _active_orgs_for_user(db, user.id)
