import secrets

from django.db import models

from core_api.utils import TimestampedModel, generate_uuid7


def generate_share_token() -> str:
    return secrets.token_urlsafe(24)


class DashboardShare(TimestampedModel):
    """A public, read-only link to a dashboard view: up to 8 goals (and the
    metrics hidden on it), live - anyone with `token` sees their current
    progress, no login (`views/shares.py`). Revoked by deleting the row.

    The goals are re-checked on every view against what `owner_id` may see
    now (`access.visible_goals`), so leaving an org, a goal going private
    or being deleted takes it off the link without touching it here -
    hence bare ids in JSON, not a many-to-many.

    `token` is kept in the clear (not hashed like an ingest token): the
    owner can copy the link again later, and it only grants reading.
    """

    id = models.UUIDField(primary_key=True, default=generate_uuid7, editable=False)
    owner_id = models.UUIDField()
    token = models.CharField(max_length=64, unique=True, default=generate_share_token, editable=False)
    title = models.CharField(max_length=255, blank=True, default="")
    goal_ids = models.JSONField(default=list)
    hidden_metric_ids = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = "dashboard_share"
        ordering = ["-created_at"]
