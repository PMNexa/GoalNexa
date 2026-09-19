"""The plain `User` model.

No `Actor` polymorphic supertype (simplification vs. the reference
project) — `RoleAssignment.actor_id` and `OrgMembership.user_id` both FK
directly to `user.id`.
"""

import uuid
from datetime import datetime

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, created_at_column, uuid_pk


class User(Base):
    __tablename__ = "user"

    id: Mapped[uuid.UUID] = uuid_pk()
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = created_at_column()
