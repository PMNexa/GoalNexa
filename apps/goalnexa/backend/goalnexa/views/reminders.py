"""`/api/v1/reminder-settings` - where the caller's own check-in reminders
go (`ReminderSettings`, `goalnexa.reminders`). One row per user, only
ever their own - a plain view, not a `BaseViewSet` resource: there's no
list of other people's settings to browse, filter or grant roles on.

- `GET` - `{enabled, urls, digest, digest_weekday, digest_hour, timezone,
  allowed_schemes}` (defaults before first save).
- `PUT` - the same fields: `urls` one Apprise URL per line, each checked
  (`validate_urls`); the digest ones optional (`goalnexa.digest`).
- `POST .../test` - sends a test message to the saved URLs.
"""

from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.conf import settings
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from goalnexa.models import DigestFrequency, ReminderSettings
from goalnexa.reminders import allowed_schemes, send, validate_urls


def _app_url(request) -> str:
    return getattr(settings, "GOALNEXA_PUBLIC_URL", "") or request.build_absolute_uri("/")


def _payload(reminder_settings: ReminderSettings | None) -> dict:
    schemes = allowed_schemes()
    row = reminder_settings or ReminderSettings()
    return {
        "enabled": row.enabled,
        "urls": row.urls,
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
                "app_url": _app_url(request),
                **_digest_fields(request.data),
            },
        )
        return Response(_payload(reminder_settings))


class ReminderTestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        reminder_settings = ReminderSettings.objects.filter(user_id=request.user.id).first()
        urls = reminder_settings.url_list() if reminder_settings else []
        if not urls:
            raise ValidationError({"urls": ["Save at least one URL first."]})
        try:
            ok = send(urls, "GoalNexa test reminder", "Check-in reminders will arrive here.")
        except Exception as exc:
            raise ValidationError({"urls": [f"Sending failed: {exc}"]}) from exc
        if not ok:
            raise ValidationError({"urls": ["Sending failed - check the URLs (the server log has details)."]})
        return Response({"sent": True})
