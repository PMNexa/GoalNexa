"""Pydantic schemas for the `Goal` CRUD entity.

Field-shape source for `GET /entities/goals/schema` (platform-core's
`derive_entity_schema`) — the frontend's generic `EntityForm`/`EntityTable`
render entirely from what these schemas + `GOAL_CONFIG.field_meta`
(`routes/goals.py`) declare, no hand-written `entityConfigs/goal.ts` needed.
"""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from goalnexa_ext.models.goal import GoalStatus


class GoalCreate(BaseModel):
    org_id: uuid.UUID
    title: str
    description: str | None = None
    status: GoalStatus = GoalStatus.not_started
    target_date: date | None = None


class GoalUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: GoalStatus | None = None
    target_date: date | None = None


class GoalSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    org_id: uuid.UUID
    title: str
    description: str | None
    status: GoalStatus
    target_date: date | None
    created_by_actor_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
