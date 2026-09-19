"""Pydantic schemas for the auth routes."""

import uuid

from pydantic import BaseModel, ConfigDict, EmailStr

from app.schemas.tenancy import OrgSummary


class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    org_name: str
    org_slug: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    orgs: list[OrgSummary]


class RefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    name: str


class AcceptInviteRequest(BaseModel):
    password: str
