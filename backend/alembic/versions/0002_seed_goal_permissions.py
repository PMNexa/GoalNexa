"""Seed goal.{create,read,update,delete} permissions and grant them to
platform-core's already-seeded system roles.

Revision ID: 0002_seed_goal_permissions
Revises: 0001_create_goal_table
Create Date: 2026-09-20

Idempotent existence-check-then-insert, same shape as platform-core's own
`0002_seed_rbac_system_roles.py` — safe to re-run, and this is how a
git-submodule consumer grants new permissions without editing
platform-core's own `rbac_seed_catalog.py` (see that file's own docstring
and this project's README). `permission`/`role`/`role_permission` are
platform-core's tables; this migration only inserts rows into them, no
schema change.

`goal.read` covers both platform-core's generic "list" and "get" routes —
`crud_factory.py`'s own gating code passes `action="read"` for both, not
separate "list"/"get" permission actions.
"""

import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from app.db.base import generate_uuid7

from alembic import op

revision: str = "0002_seed_goal_permissions"
down_revision: str | None = "0001_create_goal_table"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

GOAL_PERMISSIONS: tuple[tuple[str, str, str], ...] = (
    ("goal.create", "goal", "create"),
    ("goal.read", "goal", "read"),
    ("goal.update", "goal", "update"),
    ("goal.delete", "goal", "delete"),
)

# org_admin gets every permission at platform-core's OWN seed time — that's
# a one-time snapshot grant (RolePermission rows), not a dynamic "all
# permissions that will ever exist" rule, so goal.* needs granting to it
# explicitly here too. member is platform-core's generic read-only
# baseline. project_owner is skipped: Goal is org-scoped, not
# project-scoped, so it has no natural relationship to a project-scoped role.
ROLE_GRANTS: dict[str, tuple[str, ...]] = {
    "org_admin": ("goal.create", "goal.read", "goal.update", "goal.delete"),
    "member": ("goal.read",),
}


def upgrade() -> None:
    conn = op.get_bind()

    permission = sa.table(
        "permission",
        sa.column("id", sa.Uuid(as_uuid=True)),
        sa.column("code", sa.String),
        sa.column("resource", sa.String),
        sa.column("action", sa.String),
    )
    role = sa.table(
        "role",
        sa.column("id", sa.Uuid(as_uuid=True)),
        sa.column("name", sa.String),
        sa.column("org_id", sa.Uuid(as_uuid=True)),
    )
    role_permission = sa.table(
        "role_permission",
        sa.column("id", sa.Uuid(as_uuid=True)),
        sa.column("role_id", sa.Uuid(as_uuid=True)),
        sa.column("permission_id", sa.Uuid(as_uuid=True)),
    )

    code_to_id: dict[str, uuid.UUID] = {}
    for code, resource, action in GOAL_PERMISSIONS:
        existing_id = conn.execute(sa.select(permission.c.id).where(permission.c.code == code)).scalar_one_or_none()
        if existing_id is not None:
            code_to_id[code] = existing_id
            continue
        new_id = generate_uuid7()
        conn.execute(permission.insert().values(id=new_id, code=code, resource=resource, action=action))
        code_to_id[code] = new_id

    for role_name, codes in ROLE_GRANTS.items():
        role_id = conn.execute(
            sa.select(role.c.id).where(role.c.name == role_name, role.c.org_id.is_(None))
        ).scalar_one_or_none()
        if role_id is None:
            # System role not seeded yet — platform-core's own migration
            # chain hasn't run against this database. Nothing to grant onto.
            continue

        for code in codes:
            permission_id = code_to_id[code]
            already_granted = conn.execute(
                sa.select(role_permission.c.id).where(
                    role_permission.c.role_id == role_id,
                    role_permission.c.permission_id == permission_id,
                )
            ).scalar_one_or_none()
            if already_granted is not None:
                continue
            conn.execute(
                role_permission.insert().values(id=generate_uuid7(), role_id=role_id, permission_id=permission_id)
            )


def downgrade() -> None:
    conn = op.get_bind()
    permission = sa.table("permission", sa.column("id", sa.Uuid(as_uuid=True)), sa.column("code", sa.String))
    role_permission = sa.table(
        "role_permission",
        sa.column("permission_id", sa.Uuid(as_uuid=True)),
    )

    codes = [code for code, _, _ in GOAL_PERMISSIONS]
    permission_ids = conn.execute(sa.select(permission.c.id).where(permission.c.code.in_(codes))).scalars().all()
    if permission_ids:
        conn.execute(role_permission.delete().where(role_permission.c.permission_id.in_(permission_ids)))
    conn.execute(permission.delete().where(permission.c.code.in_(codes)))
