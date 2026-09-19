"""RBAC models: permissions, roles, role-permission grants, role assignments.

Single-level tenancy simplification vs. the reference project: `RoleAssignment`
scopes to `org_id` only — no `project_id`.
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Index, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, created_at_column, uuid_pk


class Permission(Base):
    __tablename__ = "permission"

    id: Mapped[uuid.UUID] = uuid_pk()
    code: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    resource: Mapped[str] = mapped_column(String(64), nullable=False)
    action: Mapped[str] = mapped_column(String(64), nullable=False)


class Role(Base):
    """A role. `org_id IS NULL` marks a shared system-role template
    (`org_admin` / `member` / `viewer`), seeded once and never per-org
    copied in this scaffold — there is no support yet for custom per-org
    roles, but the column exists so that story can land later without a
    schema change.
    """

    __tablename__ = "role"
    __table_args__ = (
        # Partial unique index: system-role names (org_id IS NULL) must be
        # globally unique; a future per-org custom role is not constrained
        # against this index.
        Index(
            "uq_role_system_name",
            "name",
            unique=True,
            postgresql_where=text("org_id IS NULL"),
            sqlite_where=text("org_id IS NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    org_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("organization.id", ondelete="CASCADE"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    is_system_role: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class RolePermission(Base):
    __tablename__ = "role_permission"
    __table_args__ = (UniqueConstraint("role_id", "permission_id", name="uq_role_permission"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    role_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("role.id", ondelete="CASCADE"), nullable=False, index=True
    )
    permission_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("permission.id", ondelete="CASCADE"), nullable=False, index=True
    )


class RoleAssignment(Base):
    """Grants `Role` to a `User` (`actor_id`) within an `Organization`.

    No polymorphic `Actor` supertype (simplification vs. the reference
    project) — `actor_id` FKs directly to `user.id`.
    """

    __tablename__ = "role_assignment"
    __table_args__ = (
        UniqueConstraint("actor_id", "org_id", "role_id", name="uq_role_assignment"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    actor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organization.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("role.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = created_at_column()
