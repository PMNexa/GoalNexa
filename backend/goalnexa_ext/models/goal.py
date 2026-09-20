"""`Goal` — GoalNexa's own product entity, proving the platform-core generic
`crud_factory` pattern works end to end for a downstream app's domain model.

Org-scoped (`org_id` is a direct column, not a multi-hop FK chain), so its
`resolve_org_id` in `routes/goals.py` is `chain_resolver([])` — the "row
carries its own org_id" case platform-core's own `Project`/`OrgMembership`
use.

`Base`/column helpers/`generate_uuid7` all come from platform-core (`app.db.
base`, resolved via `PYTHONPATH` — see `goalnexa_ext/__init__.py`), so this
table shares the exact same declarative metadata, UUIDv7 primary-key
convention, and `created_at`/`updated_at` shape as every platform-core table
it FKs into.
"""

import enum
import uuid
from datetime import date, datetime

from app.db.base import Base, created_at_column, generate_uuid7, updated_at_column
from sqlalchemy import Date, ForeignKey, String, Text, Uuid
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column


class GoalStatus(str, enum.Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    done = "done"


class Goal(Base):
    """A team/org-scoped goal or objective. Deliberately simple
    (title/description/status/target_date) — the point of this entity is to
    exercise platform-core's generic CRUD factory end to end, not to model a
    full OKR hierarchy.
    """

    __tablename__ = "goal"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=generate_uuid7)
    org_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("organization.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[GoalStatus] = mapped_column(
        SAEnum(GoalStatus, name="goal_status", values_callable=lambda enum_cls: [e.value for e in enum_cls]),
        nullable=False,
        default=GoalStatus.not_started,
    )
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    # References the generic actor.id (a User or AIAgent may create a Goal),
    # not user.actor_id — same posture as platform-core's own
    # Invite.invited_by_actor_id.
    created_by_actor_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("actor.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = created_at_column()
    updated_at: Mapped[datetime] = updated_at_column()
