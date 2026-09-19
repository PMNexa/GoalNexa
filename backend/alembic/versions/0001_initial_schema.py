"""Initial schema: user, auth, tenancy, rbac, goal tables.

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-09-19

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0001_initial_schema"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "user",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_user_email", "user", ["email"], unique=True)

    op.create_table(
        "organization",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_organization_slug", "organization", ["slug"], unique=True)

    op.create_table(
        "auth_identity",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.Uuid(as_uuid=True), sa.ForeignKey("user.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", sa.String(32), nullable=False, server_default="local"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_auth_identity_user_id", "auth_identity", ["user_id"])

    op.create_table(
        "refresh_token",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.Uuid(as_uuid=True), sa.ForeignKey("user.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_reason", sa.String(64), nullable=True),
    )
    op.create_index("ix_refresh_token_user_id", "refresh_token", ["user_id"])
    op.create_index("ix_refresh_token_token_hash", "refresh_token", ["token_hash"], unique=True)

    op.create_table(
        "login_attempt",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("client_ip", sa.String(64), nullable=False),
        sa.Column("succeeded", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_login_attempt_email", "login_attempt", ["email"])
    op.create_index("ix_login_attempt_client_ip", "login_attempt", ["client_ip"])

    op.create_table(
        "org_membership",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column(
            "org_id", sa.Uuid(as_uuid=True), sa.ForeignKey("organization.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("user_id", sa.Uuid(as_uuid=True), sa.ForeignKey("user.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="invited"),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("org_id", "user_id", name="uq_org_membership_org_user"),
    )
    op.create_index("ix_org_membership_org_id", "org_membership", ["org_id"])
    op.create_index("ix_org_membership_user_id", "org_membership", ["user_id"])

    op.create_table(
        "invite",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column(
            "org_membership_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("org_membership.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "invited_by_user_id", sa.Uuid(as_uuid=True), sa.ForeignKey("user.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_invite_token_hash", "invite", ["token_hash"], unique=True)

    op.create_table(
        "permission",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(128), nullable=False),
        sa.Column("resource", sa.String(64), nullable=False),
        sa.Column("action", sa.String(64), nullable=False),
    )
    op.create_index("ix_permission_code", "permission", ["code"], unique=True)

    op.create_table(
        "role",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column(
            "org_id", sa.Uuid(as_uuid=True), sa.ForeignKey("organization.id", ondelete="CASCADE"), nullable=True
        ),
        sa.Column("name", sa.String(64), nullable=False),
        sa.Column("is_system_role", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_role_org_id", "role", ["org_id"])
    op.create_index(
        "uq_role_system_name",
        "role",
        ["name"],
        unique=True,
        postgresql_where=sa.text("org_id IS NULL"),
    )

    op.create_table(
        "role_permission",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("role_id", sa.Uuid(as_uuid=True), sa.ForeignKey("role.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "permission_id", sa.Uuid(as_uuid=True), sa.ForeignKey("permission.id", ondelete="CASCADE"), nullable=False
        ),
        sa.UniqueConstraint("role_id", "permission_id", name="uq_role_permission"),
    )
    op.create_index("ix_role_permission_role_id", "role_permission", ["role_id"])
    op.create_index("ix_role_permission_permission_id", "role_permission", ["permission_id"])

    op.create_table(
        "role_assignment",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("actor_id", sa.Uuid(as_uuid=True), sa.ForeignKey("user.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "org_id", sa.Uuid(as_uuid=True), sa.ForeignKey("organization.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("role_id", sa.Uuid(as_uuid=True), sa.ForeignKey("role.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("actor_id", "org_id", "role_id", name="uq_role_assignment"),
    )
    op.create_index("ix_role_assignment_actor_id", "role_assignment", ["actor_id"])
    op.create_index("ix_role_assignment_org_id", "role_assignment", ["org_id"])
    op.create_index("ix_role_assignment_role_id", "role_assignment", ["role_id"])

    op.create_table(
        "goal",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column(
            "org_id", sa.Uuid(as_uuid=True), sa.ForeignKey("organization.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="not_started"),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column(
            "created_by_user_id", sa.Uuid(as_uuid=True), sa.ForeignKey("user.id", ondelete="SET NULL"), nullable=True
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_goal_org_id", "goal", ["org_id"])


def downgrade() -> None:
    op.drop_table("goal")
    op.drop_table("role_assignment")
    op.drop_table("role_permission")
    op.drop_table("role")
    op.drop_table("permission")
    op.drop_table("invite")
    op.drop_table("org_membership")
    op.drop_table("login_attempt")
    op.drop_table("refresh_token")
    op.drop_table("auth_identity")
    op.drop_table("organization")
    op.drop_table("user")
