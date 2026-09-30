"""A goal's activity feed (`Activity`): `record` is called from the same
writes that refresh progress - check-ins, metrics, the goal itself,
comments, cycle closes - plus `goalnexa.progress.refresh_goal` when a
goal's health changes. `changes` diffs the fields a feed shows."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from goalnexa.models import Activity, CheckInSource

#: Set by platform-mcp on a tool call's sub-request (`platform_mcp.server.MCP_REQUEST_KEY`) -
#: read by name, not imported: goalnexa doesn't depend on platform-mcp.
MCP_REQUEST_KEY = "platform_mcp.request"


def request_source(request) -> str:
    """WEB, or AGENT when the request is an MCP tool call's."""
    return CheckInSource.AGENT if getattr(request, "META", {}).get(MCP_REQUEST_KEY) else CheckInSource.WEB


def _plain(value):
    """JSON-safe: decimals as plain strings, dates ISO, rows as their id."""
    if isinstance(value, dict):
        return {k: _plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_plain(v) for v in value]
    if isinstance(value, Decimal):
        return format(value.normalize(), "f")
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if hasattr(value, "pk"):
        return str(value.pk)
    return value if value is None or isinstance(value, (bool, int, float, str)) else str(value)


def changes(before: dict, after, fields: list[str]) -> dict:
    """`{field: [old, new]}` for each of `fields` whose value differs
    between `before` (a dict from `snapshot`) and the saved `after`."""
    diff = {}
    for name in fields:
        old, new = before.get(name), _plain(getattr(after, name))
        if old != new:
            diff[name] = [old, new]
    return diff


def snapshot(instance, fields: list[str]) -> dict:
    return {name: _plain(getattr(instance, name)) for name in fields}


def record(goal_id, verb: str, actor_id=None, **data) -> Activity:
    return Activity.objects.create(
        goal_id=goal_id, verb=verb, actor_id=actor_id, data={k: _plain(v) for k, v in data.items()}
    )
