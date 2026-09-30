from django.db import models

from core_api.utils import TimestampedModel, generate_uuid7


class DigestFrequency(models.TextChoices):
    OFF = "off", "Off"
    DAILY = "daily", "Daily"
    WEEKLY = "weekly", "Weekly"


class ReminderSettings(TimestampedModel):
    """Where one user's check-in reminders go - one row per user, created
    on first save (`views/reminders.py`). `urls` holds one Apprise URL per
    line (`mailto://`, `ntfy://`, `tgram://`, `json://` for a webhook, ...
    - see `goalnexa.reminders`). `user_id` is a bare id, same convention
    as `Goal.owner_id`. `app_url` is where the user saved them from (or
    `GOALNEXA_PUBLIC_URL`), so a reminder can link back to the app.

    The digest (`goalnexa.digest`) goes to the same URLs: a summary of the
    user's goals - what moved, what's at risk, what's overdue - `daily` or
    `weekly` (on `digest_weekday`, 0 = Monday) at `digest_hour` in the
    user's `timezone` (saved from their browser). `last_digest_at` keeps it
    to one per period.
    """

    id = models.UUIDField(primary_key=True, default=generate_uuid7, editable=False)
    user_id = models.UUIDField(unique=True)
    enabled = models.BooleanField(default=True)
    urls = models.TextField(blank=True, default="")
    app_url = models.CharField(max_length=255, blank=True, default="")
    digest = models.CharField(
        max_length=8, choices=DigestFrequency.choices, default=DigestFrequency.WEEKLY, db_default=DigestFrequency.WEEKLY
    )
    digest_weekday = models.PositiveSmallIntegerField(default=0, db_default=0)
    digest_hour = models.PositiveSmallIntegerField(default=8, db_default=8)
    timezone = models.CharField(max_length=64, default="UTC", db_default="UTC")
    last_digest_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "reminder_settings"
        verbose_name = "reminder settings"
        verbose_name_plural = "reminder settings"

    def url_list(self) -> list[str]:
        return [line.strip() for line in self.urls.splitlines() if line.strip() and not line.strip().startswith("#")]
