"""Auth-mechanics models: local credential linkage, refresh tokens, login attempts."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, created_at_column, uuid_pk


class AuthProvider(str, enum.Enum):
    local = "local"


class AuthIdentity(Base):
    """Links a `User` to a credential provider. Only `local` exists for now."""

    __tablename__ = "auth_identity"

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider: Mapped[AuthProvider] = mapped_column(
        String(32), nullable=False, default=AuthProvider.local
    )
    created_at: Mapped[datetime] = created_at_column()


class RefreshToken(Base):
    """Server-side-only opaque refresh token record.

    Only `token_hash` (SHA-256) is ever stored — the raw token is delivered
    to the client exactly once, as an httpOnly cookie, and never persisted.
    """

    __tablename__ = "refresh_token"

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    issued_at: Mapped[datetime] = created_at_column()
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_reason: Mapped[str | None] = mapped_column(String(64), nullable=True)


class LoginAttempt(Base):
    """One row per login attempt, used for the sliding-window rate limit."""

    __tablename__ = "login_attempt"

    id: Mapped[uuid.UUID] = uuid_pk()
    email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    client_ip: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    succeeded: Mapped[bool] = mapped_column(Boolean, nullable=False)
    created_at: Mapped[datetime] = created_at_column()
