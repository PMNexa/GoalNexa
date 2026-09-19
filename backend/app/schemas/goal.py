"""Pydantic schemas for the `Goal` CRUD entity."""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.models.goal import GoalStatus


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
    created_by_user_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
