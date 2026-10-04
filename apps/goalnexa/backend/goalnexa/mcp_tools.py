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
        "name": "reminder_settings_get",
        "title": "Get reminder settings",
        "description": (
            "The user's own check-in reminder and digest settings: `enabled`, `urls` (one Apprise URL per "
            "line), `email`, `digest` (off/daily/weekly), `digest_weekday` (0 = Monday), `digest_hour`, "
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
            "whole list (one Apprise URL per line, e.g. `tgram://<bot token>/<chat id>`, `ntfy://<topic>`): "
            "read the current ones first and send them back with the new one."
        ),
        "inputSchema": _schema({
            "enabled": {"type": "boolean", "description": "Send reminders for overdue check-ins."},
            "urls": {"type": "string", "description": "Apprise URLs, one per line."},
            "email": {"type": "boolean", "description": "Also send to the account's email."},
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
