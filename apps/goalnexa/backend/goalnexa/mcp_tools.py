"""MCP tools for the endpoints that aren't `BaseViewSet` resources -
platform-mcp finds this module by name (`platform_mcp.server.custom_tools`),
so nothing here imports it. Each tool is a sub-request to the REST API as
the caller, like the generated resource tools.
"""

_ID = {"type": ["string", "integer"]}


def _schema(properties: dict, required=()) -> dict:
    schema = {"type": "object", "properties": properties, "additionalProperties": False}
    if required:
        schema["required"] = list(required)
    return schema


TOOLS = [
    {
        "name": "goals_chart",
        "title": "Get goal progress chart",
        "description": (
            "A goal's progress over time, as data to draw or summarize: per metric, its readings "
            "(`at`, `value`, `progress` in % from base to target), plus the goal's progress, projection, "
            "health and `url` - the goal on the dashboard."
        ),
        "inputSchema": _schema({"id": _ID}, ["id"]),
        "annotations": {"readOnlyHint": True, "destructiveHint": False},
        "method": "GET",
        "path": "/api/v1/goals/{id}/chart",
    },
    {
        "name": "check_ins_bulk",
        "title": "Check in on several metrics",
        "description": (
            "Check in on up to 500 metrics at once, all or nothing - e.g. a team's whole day. Each item: "
            "`metric` id, `value` (a `sum` metric: the amount done; a `latest` one: the new reading), an "
            "optional `note` and `checked_in_at` (ISO 8601, default now). Team totals refuse check-ins."
        ),
        "inputSchema": _schema({
            "items": {
                "type": "array",
                "minItems": 1,
                "maxItems": 500,
                "items": {
                    "type": "object",
                    "properties": {
                        "metric": _ID,
                        "value": {"type": "number"},
                        "note": {"type": "string"},
                        "checked_in_at": {"type": "string", "description": "ISO 8601; omit for now."},
                    },
                    "required": ["metric", "value"],
                    "additionalProperties": False,
                },
            },
        }, ["items"]),
        "annotations": {"readOnlyHint": False, "destructiveHint": False, "openWorldHint": True},
        "method": "POST",
        "path": "/api/v1/check-ins/bulk",
    },
    {
        "name": "cycles_close",
        "title": "Close a cycle",
        "description": (
            "Close a cycle (it becomes read-only): score each of its goals and mark it done, dropped or rolled "
            "over into `next_cycle` (a copy with its metrics; a reading metric starts from its current value). "
            "`decisions`: per goal, `action` (done/rollover/drop, default done), an optional `score` 0-1 "
            "(default = progress) and `reflection`. Goals left out are done. Can't be undone - confirm first."
        ),
        "inputSchema": _schema({
            "id": _ID,
            "decisions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "goal": _ID,
                        "action": {"type": "string", "enum": ["done", "rollover", "drop"]},
                        "score": {"type": "number", "minimum": 0, "maximum": 1},
                        "reflection": {"type": "string"},
                    },
                    "required": ["goal"],
                    "additionalProperties": False,
                },
            },
            "next_cycle": {**_ID, "description": "Needed when a goal rolls over: an open cycle of the same organization."},
            "retro": {"type": "string", "description": "The cycle's retrospective notes."},
        }, ["id"]),
        "annotations": {"readOnlyHint": False, "destructiveHint": True, "openWorldHint": True},
        "method": "POST",
        "path": "/api/v1/cycles/{id}/close",
    },
    {
        "name": "goal_templates_board",
        "title": "Get the team board",
        "description": (
            "A goal template's team board for one cycle: the template's goals and metrics, the team tree, each "
            "team's instance (its metrics' base, target, current value, `metric` ids to check in or set targets "
            "on, and whether the caller may) and the totals. `show` (day/week/month/quarter/year) adds each "
            "cell's numbers in the period around `at` (`shown`: the amount done or last reading, and the "
            "period's target); with `periods` (1-60) also the periods before it (`history`, oldest first; "
            "`value` null = no check-in)."
        ),
        "inputSchema": _schema({
            "id": _ID,
            "cycle": {"type": "string", "description": "A cycle id; empty or \"none\" = goals in no cycle."},
            "show": {"type": "string", "enum": ["day", "week", "month", "quarter", "year"]},
            "periods": {"type": "integer", "minimum": 1, "maximum": 60},
            "at": {"type": "string", "description": "ISO 8601; default now."},
        }, ["id"]),
        "annotations": {"readOnlyHint": True, "destructiveHint": False},
        "method": "GET",
        "path": "/api/v1/goal-templates/{id}/board",
    },
    {
        "name": "goal_templates_targets",
        "title": "Set team targets",
        "description": (
            "Set targets from the team board, all or nothing. Per item, a team's instance metric: `base_value` "
            "and/or `target_value` (the team's lead, the goal's owner, org owners/admins); a team total's metric: "
            "`planned_target` (null clears it). Metric ids come from `goal_templates_board`."
        ),
        "inputSchema": _schema({
            "id": _ID,
            "items": {
                "type": "array",
                "minItems": 1,
                "items": {
                    "type": "object",
                    "properties": {
                        "metric": _ID,
                        "base_value": {"type": "number"},
                        "target_value": {"type": "number"},
                        "planned_target": {"type": ["number", "null"]},
                    },
                    "required": ["metric"],
                    "additionalProperties": False,
                },
            },
        }, ["id", "items"]),
        "annotations": {"readOnlyHint": False, "destructiveHint": True, "idempotentHint": True, "openWorldHint": True},
        "method": "POST",
        "path": "/api/v1/goal-templates/{id}/targets",
    },
    {
        "name": "goal_templates_apply",
        "title": "Run a template for teams",
        "description": (
            "Give teams their own copy of a goal template (its goals and metrics, with default targets) in a "
            "`cycle` (or null for none). Teams that already have one there are skipped. Org owners/admins only."
        ),
        "inputSchema": _schema({
            "id": _ID,
            "teams": {"type": "array", "minItems": 1, "items": _ID, "description": "Team ids (`teams_list`)."},
            "cycle": {"type": ["string", "null"]},
        }, ["id", "teams"]),
        "annotations": {"readOnlyHint": False, "destructiveHint": False, "openWorldHint": True},
        "method": "POST",
        "path": "/api/v1/goal-templates/{id}/apply",
    },
    {
        "name": "goal_templates_leave",
        "title": "Take teams off a template",
        "description": (
            "Take teams out of a goal template in a `cycle` (org owners/admins): a team's copy with check-ins "
            "is detached and kept as its own goals; an empty one is deleted. Confirm first."
        ),
        "inputSchema": _schema({
            "id": _ID,
            "teams": {"type": "array", "minItems": 1, "items": _ID},
            "cycle": {"type": ["string", "null"]},
        }, ["id", "teams"]),
        "annotations": {"readOnlyHint": False, "destructiveHint": True, "openWorldHint": True},
        "method": "POST",
        "path": "/api/v1/goal-templates/{id}/leave",
    },
    {
        "name": "goal_templates_totals",
        "title": "Choose template totals",
        "description": (
            "Which totals a goal template calculates (org owners/admins): `total_for` lists \"org\" and/or "
            "ids of teams that have sub-teams. Replaces the list; every cycle's totals follow."
        ),
        "inputSchema": _schema({
            "id": _ID,
            "total_for": {"type": "array", "items": {"type": "string"}},
        }, ["id", "total_for"]),
        "annotations": {"readOnlyHint": False, "destructiveHint": False, "idempotentHint": True, "openWorldHint": True},
        "method": "POST",
        "path": "/api/v1/goal-templates/{id}/totals",
    },
    {
        "name": "goals_reorder",
        "title": "Reorder goals",
        "description": (
            "Put sibling goals (sub-goals of one goal, or one organization's top-level goals) in this order; "
            "siblings left out follow."
        ),
        "inputSchema": _schema({"ids": {"type": "array", "minItems": 1, "items": _ID}}, ["ids"]),
        "annotations": {"readOnlyHint": False, "destructiveHint": False, "idempotentHint": True, "openWorldHint": True},
        "method": "POST",
        "path": "/api/v1/goals/reorder",
    },
    {
        "name": "metrics_reorder",
        "title": "Reorder metrics",
        "description": "Put one goal's sibling metrics (same parent metric) in this order; siblings left out follow.",
        "inputSchema": _schema({"ids": {"type": "array", "minItems": 1, "items": _ID}}, ["ids"]),
        "annotations": {"readOnlyHint": False, "destructiveHint": False, "idempotentHint": True, "openWorldHint": True},
        "method": "POST",
        "path": "/api/v1/metrics/reorder",
    },
    {
        "name": "reminder_settings_get",
        "title": "Get reminder settings",
        "description": (
            "The user's own check-in reminder and digest settings: `enabled`, `urls` (one Apprise URL per "
            "line), `email`, `push` (to the phone app; `push_devices` counts phones), `digest` (off/daily/weekly), `digest_weekday` (0 = Monday), `digest_hour`, "
            "`timezone`. `allowed_schemes` lists the services this instance accepts (null = any); "
            "`email_available` says whether it can send email."
        ),
        "inputSchema": _schema({}),
        "annotations": {"readOnlyHint": True, "destructiveHint": False},
        "method": "GET",
        "path": "/api/v1/reminder-settings",
    },
    {
        "name": "reminder_settings_update",
        "title": "Update reminder settings",
        "description": (
            "Change the user's own reminder settings - only the fields given change. `urls` replaces the "
            "whole list (one Apprise URL per line, e.g. `tgram://<bot token>/<chat id>`, `ntfy://<topic>`)."
        ),
        "inputSchema": _schema({
            "enabled": {"type": "boolean", "description": "Send reminders for overdue check-ins."},
            "urls": {"type": "string", "description": "Apprise URLs, one per line."},
            "email": {"type": "boolean", "description": "Also send to the account's email."},
            "push": {"type": "boolean", "description": "Also send to the GoalNexa phone app (on the phones it's signed in on)."},
            "digest": {"type": "string", "enum": ["off", "daily", "weekly"]},
            "digest_weekday": {"type": "integer", "minimum": 0, "maximum": 6, "description": "0 = Monday."},
            "digest_hour": {"type": "integer", "minimum": 0, "maximum": 23, "description": "In `timezone`."},
            "timezone": {"type": "string", "description": "IANA name, e.g. Asia/Ho_Chi_Minh."},
        }),
        # Saves where reminders go: outside services (Telegram, email, ...).
        "annotations": {"readOnlyHint": False, "destructiveHint": True, "idempotentHint": True, "openWorldHint": True},
        "method": "PATCH",
        "path": "/api/v1/reminder-settings",
    },
    {
        "name": "reminder_settings_test",
        "title": "Send a test reminder",
        "description": "Send a test message to the user's saved reminder channels.",
        "inputSchema": _schema({}),
        # Reaches outside services (Telegram, email, ...).
        "annotations": {"readOnlyHint": False, "destructiveHint": False, "openWorldHint": True},
        "method": "POST",
        "path": "/api/v1/reminder-settings/test",
    },
]
