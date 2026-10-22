from django.db import models

from core_api.utils import TimestampedModel, generate_uuid7


class PushPlatform(models.TextChoices):
    ANDROID = "android", "Android"
    IOS = "ios", "iOS"


class PushKind(models.TextChoices):
    CHECKIN_DUE = "checkin_due", "Check-ins due"
    QUOTA_SHORT = "quota_short", "Target still short"
    DIGEST = "digest", "Digest"
    TEST = "test", "Test"


class PushDevice(TimestampedModel):
    """A phone that gets the user's reminders as push notifications
    (`goalnexa.push`, docs/mobile-app.md "Push protocol"). `handle` comes
    from the push relay, which the app registered with itself: it's bound
    to this server's key, so it's useless to any other server, and the
    server never sees the phone's FCM token. `last_seen_at` moves each
    time the app registers again (every start), for the retention rule."""

    id = models.UUIDField(primary_key=True, default=generate_uuid7, editable=False)
    user_id = models.UUIDField(db_index=True)
    handle = models.CharField(max_length=128, unique=True)
    platform = models.CharField(max_length=8, choices=PushPlatform.choices, default=PushPlatform.ANDROID)
    device_name = models.CharField(max_length=128, blank=True, default="")
    last_seen_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "push_device"
        ordering = ["-last_seen_at"]


class PushMessage(TimestampedModel):
    """What one push says. The relay only carries `kind` and `id`; the app
    fetches the text from here with its own session, so goal names and
    numbers never leave this server except to the user's phone."""

    id = models.UUIDField(primary_key=True, default=generate_uuid7, editable=False)
    user_id = models.UUIDField(db_index=True)
    kind = models.CharField(max_length=16, choices=PushKind.choices)
    title = models.CharField(max_length=255)
    body = models.TextField(blank=True, default="")

    class Meta:
        db_table = "push_message"
        ordering = ["-created_at"]
