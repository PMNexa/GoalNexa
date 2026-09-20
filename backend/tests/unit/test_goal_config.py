"""Unit tests for `GOAL_CONFIG`'s shape — no DB, no running server.

The real end-to-end behavior (signup -> RBAC grant -> schema derivation ->
create/list through the actual HTTP routes) was verified manually against a
live Postgres during development; see the project README for the exact
commands to reproduce that. This file only guards the config wiring itself
against silent regressions (e.g. a typo in a permission action name, a
dropped field_meta entry).
"""

from goalnexa_ext.models.goal import Goal, GoalStatus
from goalnexa_ext.routes.goals import GOAL_CONFIG


def test_goal_config_resource_and_scope() -> None:
    assert GOAL_CONFIG.resource == "goal"
    assert GOAL_CONFIG.scope_field == "org_id"
    assert GOAL_CONFIG.model is Goal


def test_goal_config_resolve_org_id_reads_row_directly() -> None:
    # chain_resolver([]) is the "row carries its own org_id" case — no DB
    # hops. A stand-in object with just `.org_id` set is enough to prove it.
    import asyncio
    from types import SimpleNamespace

    row = SimpleNamespace(org_id="fake-org-id")
    result = asyncio.run(GOAL_CONFIG.resolve_org_id(None, row))
    assert result == "fake-org-id"


def test_goal_status_badge_colors_cover_every_enum_value() -> None:
    field_meta = GOAL_CONFIG.field_meta["status"]
    assert field_meta.badge_colors is not None
    assert set(field_meta.badge_colors.keys()) == {status.value for status in GoalStatus}


def test_goal_config_methods_include_full_crud() -> None:
    assert GOAL_CONFIG.methods == frozenset({"list", "get", "create", "update", "delete"})
