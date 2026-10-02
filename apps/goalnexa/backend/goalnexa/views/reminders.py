"""`/api/v1/reminder-settings` - where the caller's own check-in reminders
go (`ReminderSettings`, `goalnexa.reminders`). One row per user, only
ever their own - a plain view, not a `BaseViewSet` resource: there's no
list of other people's settings to browse, filter or grant roles on.

- `GET` - `{enabled, urls, digest, digest_weekday, digest_hour, timezone,
  allowed_schemes}` (defaults before first save).
- `PUT` - the same fields: `urls` one Apprise URL per line, each checked
  (`validate_urls`); the digest ones optional (`goalnexa.digest`).
- `PATCH` - only the fields sent change (what an AI agent uses, through
  `mcp_tools.py`: it shouldn't have to resend the URLs to move the digest).
- `POST .../test` - sends a test message to the saved URLs.
"""

from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.conf import settings
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from goalnexa.models import DigestFrequency, ReminderSettings
from core_api.system import email_configured
from goalnexa.reminders import allowed_schemes, deliver, has_channel, validate_urls


def _app_url(request) -> str:
    return getattr(settings, "GOALNEXA_PUBLIC_URL", "") or request.build_absolute_uri("/")


def _payload(reminder_settings: ReminderSettings | None) -> dict:
    schemes = allowed_schemes()
    row = reminder_settings or ReminderSettings()
    return {
        "enabled": row.enabled,
        "urls": row.urls,
        "email": row.email,
        "email_available": email_configured(),
        "digest": row.digest,
        "digest_weekday": row.digest_weekday,
        "digest_hour": row.digest_hour,
        "timezone": row.timezone,
        "allowed_schemes": sorted(schemes) if schemes is not None else None,
    }


def _digest_fields(data) -> dict:
    """The digest settings in `data`, checked; missing ones are left as they are."""
    fields = {}
    if "digest" in data:
        if data["digest"] not in DigestFrequency.values:
            raise ValidationError({"digest": [f"One of: {', '.join(DigestFrequency.values)}."]})
        fields["digest"] = data["digest"]
    for name, low, high in (("digest_weekday", 0, 6), ("digest_hour", 0, 23)):
        if name in data:
            try:
                value = int(data[name])
            except (TypeError, ValueError):
                value = -1
            if not low <= value <= high:
                raise ValidationError({name: [f"A whole number from {low} to {high}."]})
            fields[name] = value
    if "timezone" in data:
        try:
            ZoneInfo(str(data["timezone"]))
        except (ZoneInfoNotFoundError, ValueError):
            raise ValidationError({"timezone": ["Unknown time zone."]}) from None
        fields["timezone"] = str(data["timezone"])
    return fields


def reminder_settings_email(request) -> bool:
    row = ReminderSettings.objects.filter(user_id=request.user.id).first()
    return row.email if row else False


class ReminderSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(_payload(ReminderSettings.objects.filter(user_id=request.user.id).first()))

    def put(self, request):
        urls = request.data.get("urls", "")
        if not isinstance(urls, str):
            raise ValidationError({"urls": ["One URL per line, as text."]})
        row = ReminderSettings(urls=urls)
        errors = validate_urls(row.url_list())
        if errors:
            raise ValidationError({"urls": errors})
        reminder_settings, _ = ReminderSettings.objects.update_or_create(
            user_id=request.user.id,
            defaults={
                "urls": urls,
                "enabled": bool(request.data.get("enabled", True)),
                "email": bool(request.data.get("email", reminder_settings_email(request))),
                "app_url": _app_url(request),
                **_digest_fields(request.data),
            },
        )
        return Response(_payload(reminder_settings))

    def patch(self, request):
        row = ReminderSettings.objects.filter(user_id=request.user.id).first() or ReminderSettings(user_id=request.user.id)
        if "urls" in request.data:
            urls = request.data["urls"]
            if not isinstance(urls, str):
                raise ValidationError({"urls": ["One URL per line, as text."]})
            errors = validate_urls(ReminderSettings(urls=urls).url_list())
            if errors:
                raise ValidationError({"urls": errors})
            row.urls = urls
        for name in ("enabled", "email"):
            if name in request.data:
                setattr(row, name, bool(request.data[name]))
        for name, value in _digest_fields(request.data).items():
            setattr(row, name, value)
        row.app_url = _app_url(request)
        row.save()
        return Response(_payload(row))


class ReminderTestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        reminder_settings = ReminderSettings.objects.filter(user_id=request.user.id).first()
        if reminder_settings is None or not has_channel(reminder_settings):
            raise ValidationError({"urls": ["Save at least one URL, or turn on email, first."]})
        ok = deliver(reminder_settings, "GoalNexa test reminder", "Check-in reminders will arrive here.", kind="test_reminder")
        if not ok:
            raise ValidationError({"urls": ["Sending failed - check the URLs (the server log has details)."]})
        return Response({"sent": True})
