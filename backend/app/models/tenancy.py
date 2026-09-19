"""Single-level tenancy: `Organization` <-> `User` via `OrgMembership`, plus `Invite`."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, created_at_column, uuid_pk


class OrgMembershipStatus(str, enum.Enum):
    invited = "invited"
    active = "active"
    suspended = "suspended"


class Organization(Base):
    __tablename__ = "organization"

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    created_at: Mapped[datetime] = created_at_column()


class OrgMembership(Base):
    __tablename__ = "org_membership"
    __table_args__ = (UniqueConstraint("org_id", "user_id", name="uq_org_membership_org_user"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organization.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[OrgMembershipStatus] = mapped_column(
        String(16), nullable=False, default=OrgMembershipStatus.invited
    )
    joined_at: Mapped[datetime] = created_at_column()


class Invite(Base):
    __tablename__ = "invite"

    id: Mapped[uuid.UUID] = uuid_pk()
    org_membership_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("org_membership.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    invited_by_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("user.id", ondelete="CASCADE"), nullable=False
    )
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = created_at_column()
