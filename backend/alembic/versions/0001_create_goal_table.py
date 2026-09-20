"""Create the goal table.

Revision ID: 0001_create_goal_table
Revises:
Create Date: 2026-09-20

Assumes platform-core's own migration chain has already run against this
database (creates `organization`, which `goal.org_id` FKs into).
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0001_create_goal_table"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Not pre-created via a standalone `.create()` call: `op.create_table`'s
    # own DDL compilation already creates an Enum column's type if it
    # doesn't exist — calling `.create()` first as well causes a duplicate
    # "CREATE TYPE" within the same migration (asyncpg errors as
    # DuplicateObjectError, not a checkfirst-respecting no-op, since it's a
    # second, independent creation attempt from the column's own type
    # object, not a repeat of the first).
    goal_status = sa.Enum("not_started", "in_progress", "done", name="goal_status")

    op.create_table(
        "goal",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column(
            "org_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("organization.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", goal_status, nullable=False, server_default="not_started"),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column(
            "created_by_actor_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("actor.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )


def downgrade() -> None:
    op.drop_table("goal")
    sa.Enum(name="goal_status").drop(op.get_bind(), checkfirst=True)
