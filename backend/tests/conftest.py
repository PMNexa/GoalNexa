"""Top-level pytest config: env setup + shared DB fixtures for integration tests.

Unit tests (tests/unit/) never touch these fixtures — they test pure
functions and DB-free data (crud_factory helpers, the RBAC seed catalog).

Integration tests need a real Postgres reachable at `TEST_DATABASE_URL`
(default: localhost, database `goalnexa_test`). If none is available, these
fixtures simply fail at connection time — see `tests/integration/` for the
"collect-only" fallback used to verify syntax/importability without a DB.
"""

import os

os.environ.setdefault("ENV", "dev")
os.environ.setdefault("JWT_SECRET", "test-secret-key-for-pytest-only")
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+asyncpg://goalnexa:goalnexa@localhost:5432/goalnexa_test"
)

import pytest  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession  # noqa: E402

from app.db.base import Base  # noqa: E402
from app.db.rbac_seed_catalog import PERMISSIONS, SYSTEM_ROLES  # noqa: E402
from app.db.session import AsyncSessionLocal, engine  # noqa: E402
from app.models.rbac import Permission, Role, RolePermission  # noqa: E402


@pytest.fixture()
async def db_schema():
    """Create every table fresh before a test, drop them all after."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture()
async def db_session(db_schema) -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session


@pytest.fixture()
async def seed_rbac(db_session: AsyncSession) -> dict[str, object]:
    """Seed the permission catalog + 3 system roles; return role id by name."""
    permission_id_by_code: dict[str, object] = {}
    for code, resource, action in PERMISSIONS:
        permission = Permission(code=code, resource=resource, action=action)
        db_session.add(permission)
        await db_session.flush()
        permission_id_by_code[code] = permission.id

    role_id_by_name: dict[str, object] = {}
    for system_role in SYSTEM_ROLES:
        role = Role(org_id=None, name=system_role.name, is_system_role=True)
        db_session.add(role)
        await db_session.flush()
        role_id_by_name[system_role.name] = role.id
        for code in system_role.permission_codes:
            db_session.add(RolePermission(role_id=role.id, permission_id=permission_id_by_code[code]))

    await db_session.commit()
    return role_id_by_name
