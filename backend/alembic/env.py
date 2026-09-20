"""Async-configured Alembic environment for GoalNexa's OWN migration chain.

Distinct from platform-core's own `alembic/versions/` chain (a separate
`script_location`/`version_table`, run separately — see this project's
README) — this chain only ever creates/seeds `goalnexa_ext`'s own tables
(`goal`) and data (its RBAC permission grants). It must run AFTER
platform-core's own chain (`cd platform-core/backend && alembic upgrade
head`) has already created `organization`/`role`/`permission`/etc., since
`0002_seed_goal_permissions.py` looks those rows up by name.

`version_table="goalnexa_alembic_version"` keeps this chain's own history
row in a separate table from platform-core's `alembic_version`, so the two
chains coexist in the same database without colliding.
"""

import asyncio
import sys
from logging.config import fileConfig
from pathlib import Path

# Makes platform-core's `app` package importable as a plain top-level
# package (not copied here — see README.md's "consume in place" note) even
# if the caller didn't export PYTHONPATH themselves.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "platform-core" / "backend"))

from app.core.config import settings
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# Hand-written migrations only in this chain (see 0001/0002 in versions/) —
# target_metadata is intentionally None rather than Base.metadata: Base is
# shared with platform-core (same `app.db.base.Base` object), so importing
# platform-core's own models here would make every platform-core table look
# "new" to `alembic revision --autogenerate` against THIS chain's empty
# version history. Autogenerate isn't used against this chain; if a future
# migration needs it, import only `goalnexa_ext.models.goal` (not
# platform-core's models) and point target_metadata at a dedicated
# MetaData that has just this project's own tables registered.
target_metadata = None

VERSION_TABLE = "goalnexa_alembic_version"


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (emits SQL, no live DB connection)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        version_table=VERSION_TABLE,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata, version_table=VERSION_TABLE)

    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Run migrations in 'online' mode using an async engine."""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
