from django.db import models

from core_api.utils import TimestampedModel, generate_uuid7


class CycleStatus(models.TextChoices):
    PLANNING = "planning", "Planning"
    ACTIVE = "active", "Active"
    CLOSED = "closed", "Closed"


class Cycle(TimestampedModel):
    """A period goals are set for and scored at the end of - a quarter, a
    season. `org_id` is an org's (bare id, like `Goal.org_id`; the org's
    members see it) or null for a personal one (only `owner_id` sees it).
    A goal joins one with `Goal.cycle`.

    Closing it (`CycleViewSet.close`) scores every goal in it
    (`GoalScore`) and marks each done, dropped or rolled over into the next
    cycle; a closed cycle is read-only. `retro` is the team's notes.
    """

    id = models.UUIDField(primary_key=True, default=generate_uuid7, editable=False)
    name = models.CharField(max_length=255)
    owner_id = models.UUIDField()
    org_id = models.UUIDField(null=True, blank=True)
    starts_on = models.DateField()
    ends_on = models.DateField()
    status = models.CharField(
        max_length=16, choices=CycleStatus.choices, default=CycleStatus.ACTIVE, db_default=CycleStatus.ACTIVE
    )
    closed_at = models.DateTimeField(null=True, blank=True)
    retro = models.TextField(blank=True, default="", help_text="What went well, what didn't - written when closing.")

    class Meta:
        db_table = "cycle"
