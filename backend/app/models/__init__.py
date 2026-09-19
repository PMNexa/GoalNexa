"""SQLAlchemy models.

Import all model modules here so `Base.metadata` is fully populated for
Alembic autogenerate and for `Base.metadata.create_all` in tests.
"""

from app.models.auth import AuthIdentity, LoginAttempt, RefreshToken
from app.models.goal import Goal
from app.models.rbac import Permission, Role, RoleAssignment, RolePermission
from app.models.tenancy import Invite, Organization, OrgMembership
from app.models.user import User

__all__ = [
    "AuthIdentity",
    "LoginAttempt",
    "RefreshToken",
    "Goal",
    "Permission",
    "Role",
    "RoleAssignment",
    "RolePermission",
    "Invite",
    "Organization",
    "OrgMembership",
    "User",
]
