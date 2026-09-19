"""Unit tests for the pure-Python RBAC seed catalog (no DB)."""

from app.db.rbac_seed_catalog import (
    PERMISSION_CODES,
    PERMISSIONS,
    READ_ONLY_PERMISSION_CODES,
    SYSTEM_ROLE_NAMES,
    SYSTEM_ROLES,
)


def test_exactly_three_system_roles():
    assert len(SYSTEM_ROLES) == 3
    assert set(SYSTEM_ROLE_NAMES) == {"org_admin", "member", "viewer"}


def test_permission_codes_are_resource_dot_action():
    for code, resource, action in PERMISSIONS:
        assert code == f"{resource}.{action}"


def test_permission_codes_are_unique():
    assert len(PERMISSION_CODES) == len(set(PERMISSION_CODES))


def test_org_admin_has_every_permission():
    org_admin = next(r for r in SYSTEM_ROLES if r.name == "org_admin")
    assert set(org_admin.permission_codes) == set(PERMISSION_CODES)


def test_viewer_is_read_only():
    viewer = next(r for r in SYSTEM_ROLES if r.name == "viewer")
    assert set(viewer.permission_codes) == set(READ_ONLY_PERMISSION_CODES)
    for code in viewer.permission_codes:
        assert code.endswith(".list") or code.endswith(".get")


def test_member_can_read_and_write_goals_but_not_delete_or_manage_membership():
    member = next(r for r in SYSTEM_ROLES if r.name == "member")
    assert "goal.list" in member.permission_codes
    assert "goal.get" in member.permission_codes
    assert "goal.create" in member.permission_codes
    assert "goal.update" in member.permission_codes
    assert "goal.delete" not in member.permission_codes
    assert not any(code.startswith("org_membership.") for code in member.permission_codes)
