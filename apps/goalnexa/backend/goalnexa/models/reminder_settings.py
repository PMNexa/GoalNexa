from django.db import models

from core_api.utils import TimestampedModel, generate_uuid7


class ReminderSettings(TimestampedModel):
    """Where one user's check-in reminders go - one row per user, created
    on first save (`views/reminders.py`). `urls` holds one Apprise URL per
    line (`mailto://`, `ntfy://`, `tgram://`, `json://` for a webhook, ...
    - see `goalnexa.reminders`). `user_id` is a bare id, same convention
    as `Goal.owner_id`. `app_url` is where the user saved them from (or
    `GOALNEXA_PUBLIC_URL`), so a reminder can link back to the app.
    """

    id = models.UUIDField(primary_key=True, default=generate_uuid7, editable=False)
    user_id = models.UUIDField(unique=True)
    enabled = models.BooleanField(default=True)
    urls = models.TextField(blank=True, default="")
    app_url = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        db_table = "reminder_settings"
        verbose_name = "reminder settings"
        verbose_name_plural = "reminder settings"

    def url_list(self) -> list[str]:
        return [line.strip() for line in self.urls.splitlines() if line.strip() and not line.strip().startswith("#")]
