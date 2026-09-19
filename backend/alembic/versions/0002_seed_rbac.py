"""Idempotent seed of the RBAC catalog: permissions + 3 system roles.

Existence-check-then-insert (not a raw bulk insert) so re-running this
migration, or a future re-sync, is safe: it only inserts rows that don't
already exist by their natural key (`Permission.code`, `Role.name` where
`org_id IS NULL`).

Revision ID: 0002_seed_rbac
Revises: 0001_initial_schema
Create Date: 2026-09-19

"""
from collections.abc import Sequence

import sqlalchemy as sa
from uuid6 import uuid7

from alembic import op
from app.db.rbac_seed_catalog import PERMISSIONS, SYSTEM_ROLES

revision: str = "0002_seed_rbac"
down_revision: str | None = "0001_initial_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    conn = op.get_bind()

    permission_table = sa.table(
        "permission",
        sa.column("id", sa.Uuid(as_uuid=True)),
        sa.column("code", sa.String),
        sa.column("resource", sa.String),
        sa.column("action", sa.String),
    )
    role_table = sa.table(
        "role",
        sa.column("id", sa.Uuid(as_uuid=True)),
        sa.column("org_id", sa.Uuid(as_uuid=True)),
        sa.column("name", sa.String),
        sa.column("is_system_role", sa.Boolean),
    )
    role_permission_table = sa.table(
        "role_permission",
        sa.column("id", sa.Uuid(as_uuid=True)),
        sa.column("role_id", sa.Uuid(as_uuid=True)),
        sa.column("permission_id", sa.Uuid(as_uuid=True)),
    )

    # 1. Permissions: insert any (code, resource, action) not already present.
    permission_id_by_code: dict[str, object] = {}
    existing_codes = {
        row[0] for row in conn.execute(sa.select(permission_table.c.code)).fetchall()
    }
    for code, resource, action in PERMISSIONS:
        if code not in existing_codes:
            new_id = uuid7()
            conn.execute(
                permission_table.insert().values(id=new_id, code=code, resource=resource, action=action)
            )
            permission_id_by_code[code] = new_id

    # Re-fetch full id map (covers both newly-inserted and pre-existing rows).
    for row in conn.execute(sa.select(permission_table.c.id, permission_table.c.code)).fetchall():
        permission_id_by_code[row[1]] = row[0]

    # 2. System roles (org_id IS NULL): insert any name not already present.
    role_id_by_name: dict[str, object] = {}
    existing_role_names = {
        row[0]
        for row in conn.execute(
            sa.select(role_table.c.name).where(role_table.c.org_id.is_(None))
        ).fetchall()
    }
    for system_role in SYSTEM_ROLES:
        if system_role.name not in existing_role_names:
            new_id = uuid7()
            conn.execute(
                role_table.insert().values(id=new_id, org_id=None, name=system_role.name, is_system_role=True)
            )
            role_id_by_name[system_role.name] = new_id

    for row in conn.execute(
        sa.select(role_table.c.id, role_table.c.name).where(role_table.c.org_id.is_(None))
    ).fetchall():
        role_id_by_name[row[1]] = row[0]

    # 3. role_permission grants: insert any (role_id, permission_id) pair not
    # already present.
    existing_pairs = {
        (row[0], row[1])
        for row in conn.execute(
            sa.select(role_permission_table.c.role_id, role_permission_table.c.permission_id)
        ).fetchall()
    }
    for system_role in SYSTEM_ROLES:
        role_id = role_id_by_name[system_role.name]
        for code in system_role.permission_codes:
            permission_id = permission_id_by_code[code]
            if (role_id, permission_id) not in existing_pairs:
                conn.execute(
                    role_permission_table.insert().values(
                        id=uuid7(), role_id=role_id, permission_id=permission_id
                    )
                )


def downgrade() -> None:
    # Seed data is not reverted — leaving the catalog in place is harmless
    # and other rows (RoleAssignment) may already depend on it.
    pass
