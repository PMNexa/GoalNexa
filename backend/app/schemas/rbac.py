"""Pydantic schemas for RBAC."""

import uuid

from pydantic import BaseModel, ConfigDict


class PermissionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    resource: str
    action: str


class RoleAssignmentCreate(BaseModel):
    actor_id: uuid.UUID
    org_id: uuid.UUID
    role_id: uuid.UUID


class RoleAssignmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    actor_id: uuid.UUID
    org_id: uuid.UUID
    role_id: uuid.UUID


class MyPermissionRead(BaseModel):
    permission_code: str
    org_id: uuid.UUID
