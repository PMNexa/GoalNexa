"""Pydantic schemas for organizations, memberships, and invites."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.tenancy import OrgMembershipStatus


class OrgSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str


class OrganizationCreate(BaseModel):
    name: str
    slug: str


class OrgMembershipRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    org_id: uuid.UUID
    user_id: uuid.UUID
    status: OrgMembershipStatus
    joined_at: datetime


class OrgMembershipUpdate(BaseModel):
    status: OrgMembershipStatus


class InviteCreate(BaseModel):
    email: EmailStr


class InviteRead(BaseModel):
    invite_link: str


class AcceptInviteRequest(BaseModel):
    password: str
