"""`Goal` — the example CRUD entity proving the generic `crud_factory` pattern.

A team/org-scoped goal or objective. Deliberately simple (title/description/
status/target_date) — the point of this entity is to exercise
`make_crud_router()` end to end, not to model a full OKR hierarchy.
"""

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Date, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, created_at_column, updated_at_column, uuid_pk


class GoalStatus(str, enum.Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    done = "done"


class Goal(Base):
    __tablename__ = "goal"

    id: Mapped[uuid.UUID] = uuid_pk()
    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organization.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[GoalStatus] = mapped_column(
        String(16), nullable=False, default=GoalStatus.not_started
    )
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("user.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = created_at_column()
    updated_at: Mapped[datetime] = updated_at_column()
