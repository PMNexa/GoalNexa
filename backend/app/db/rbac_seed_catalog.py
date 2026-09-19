"""Pure-Python RBAC seed data: the permission catalog and the 3 system roles.

Deliberately DB-free so it's unit-testable without a database — the seed
migration (`0002_seed_rbac.py`) and any future re-sync tooling both import
this module as their single source of truth for what "the RBAC catalog"
means, instead of hardcoding permission codes twice.

Permission code format: "<resource>.<action>", e.g. "goal.create".
"""

from dataclasses import dataclass

RESOURCES: tuple[str, ...] = ("goal", "organization", "org_membership")

# Every permission that exists in the system. Not every resource supports
# every action (e.g. organizations are only ever created, not deleted, in
# this scaffold) — this list is the explicit, authoritative set.
PERMISSIONS: tuple[tuple[str, str, str], ...] = (
    # (code, resource, action)
    ("goal.list", "goal", "list"),
    ("goal.get", "goal", "get"),
    ("goal.create", "goal", "create"),
    ("goal.update", "goal", "update"),
    ("goal.delete", "goal", "delete"),
    ("organization.create", "organization", "create"),
    ("org_membership.list", "org_membership", "list"),
    ("org_membership.get", "org_membership", "get"),
    ("org_membership.invite", "org_membership", "invite"),
    ("org_membership.update", "org_membership", "update"),
)

PERMISSION_CODES: tuple[str, ...] = tuple(code for code, _, _ in PERMISSIONS)

# Read-only permissions: every "*.list" / "*.get" action code.
_READ_ACTIONS = {"list", "get"}
READ_ONLY_PERMISSION_CODES: tuple[str, ...] = tuple(
    code for code, _, action in PERMISSIONS if action in _READ_ACTIONS
)

# `member` may read + write goals, but has no org-membership management
# rights and cannot delete goals.
_MEMBER_PERMISSION_CODES: tuple[str, ...] = (
    "goal.list",
    "goal.get",
    "goal.create",
    "goal.update",
)


@dataclass(frozen=True)
class SystemRole:
    name: str
    permission_codes: tuple[str, ...]


SYSTEM_ROLES: tuple[SystemRole, ...] = (
    SystemRole(name="org_admin", permission_codes=PERMISSION_CODES),
    SystemRole(name="member", permission_codes=_MEMBER_PERMISSION_CODES),
    SystemRole(name="viewer", permission_codes=READ_ONLY_PERMISSION_CODES),
)

SYSTEM_ROLE_NAMES: tuple[str, ...] = tuple(role.name for role in SYSTEM_ROLES)
