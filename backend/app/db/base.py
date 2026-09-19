"""Declarative base plus shared column helpers.

Every model's primary key is a UUIDv7 (time-sortable, good index locality),
generated Python-side (not a DB-side default) via `uuid6.uuid7()` so the
same behaviour holds whether the underlying engine is Postgres or SQLite
(used in unit tests).
"""

from datetime import UTC, datetime

from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.types import Uuid
from uuid6 import uuid7


class Base(DeclarativeBase):
    pass


def uuid_pk() -> Mapped[object]:
    """A `UUID` primary-key column with a Python-side `uuid7()` default."""
    return mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid7)


def utcnow() -> datetime:
    return datetime.now(UTC)


def created_at_column() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), nullable=False, default=utcnow, server_default=func.now())


def updated_at_column() -> Mapped[datetime]:
    return mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
        onupdate=utcnow,
        server_default=func.now(),
    )
