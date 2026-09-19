"""Password hashing, JWT issuance/verification, and opaque-token hashing.

Mechanics mirror the reference project's ADR-0003 auth strategy:
- Passwords: argon2 via passlib, explicit OWASP-recommended cost params.
- Access tokens: short-lived JWT (HS256).
- Refresh / invite tokens: opaque high-entropy strings, stored only as a
  SHA-256 hash server-side, never as a JWT.
"""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from passlib.context import CryptContext

from app.core.config import settings

# OWASP Argon2 cheat-sheet params for an interactive login path:
# time_cost=3, memory_cost=65536 KiB (64 MiB), parallelism=4.
_pwd_context = CryptContext(
    schemes=["argon2"],
    argon2__time_cost=3,
    argon2__memory_cost=65536,
    argon2__parallelism=4,
)

# Computed once at import time so `verify_password_or_dummy` always pays the
# same argon2-verify cost whether or not a matching user/hash exists —
# closes the timing side-channel that would otherwise let a login attempt
# distinguish "no such user" from "wrong password".
_DUMMY_PASSWORD_HASH = _pwd_context.hash("dummy-password-for-timing-safety")


def hash_password(password: str) -> str:
    """Hash a plaintext password with argon2."""
    return _pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a plaintext password against a stored argon2 hash."""
    return _pwd_context.verify(password, password_hash)


def verify_password_or_dummy(password: str, password_hash: str | None) -> bool:
    """Timing-safe password check for the login route.

    Always runs an argon2 verify. When `password_hash` is `None` (no such
    user, or no local credential), verifies against a fixed dummy hash
    instead of short-circuiting, and always returns `False` in that case.
    """
    if password_hash is None:
        _pwd_context.verify(password, _DUMMY_PASSWORD_HASH)
        return False
    return _pwd_context.verify(password, password_hash)


def create_access_token(user_id: str, expires_minutes: float | None = None) -> str:
    """Issue a short-lived JWT access token.

    Claims: `sub` (user id), `iat`, `exp`, `type: "access"`.
    """
    ttl_minutes = expires_minutes if expires_minutes is not None else settings.JWT_ACCESS_TTL_MINUTES
    now = datetime.now(UTC)
    claims: dict[str, Any] = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(minutes=ttl_minutes),
        "type": "access",
    }
    return jwt.encode(claims, settings.JWT_SECRET, algorithm="HS256")


def decode_token(token: str) -> dict[str, Any]:
    """Decode and verify a JWT access token, returning its claims.

    Raises `jwt.PyJWTError` on expiry / invalid signature — callers map that
    to a 401.
    """
    return jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])


def generate_refresh_token() -> str:
    """Generate a raw, opaque refresh token. Never persisted; only its hash is."""
    return secrets.token_urlsafe(32)


def hash_refresh_token(raw_token: str) -> str:
    """SHA-256 hex digest of a raw refresh token, for `refresh_token.token_hash`.

    A fast hash is sufficient (not argon2): the raw token is already a
    high-entropy random value, not a brute-forceable human secret, and this
    is a hot lookup key hit on every refresh.
    """
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def generate_invite_token() -> str:
    """Generate a raw, opaque invite token. Returned to the caller exactly once."""
    return secrets.token_urlsafe(32)


def hash_invite_token(raw_token: str) -> str:
    """SHA-256 hex digest of a raw invite token, for `invite.token_hash`."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
