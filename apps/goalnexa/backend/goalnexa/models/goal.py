from django.db import models

from core_api.utils import TimestampedModel, generate_uuid7


class GoalStatus(models.TextChoices):
    NOT_STARTED = "not_started", "Not started"
    IN_PROGRESS = "in_progress", "In progress"
    COMPLETED = "completed", "Completed"
    ARCHIVED = "archived", "Archived"


class Goal(TimestampedModel):
    """`owner_id` is a bare UUIDField, not a ForeignKey - this module
    shares nothing at the DB level with whatever module owns the actual
    User table (platform-auth), same convention as platform-org's
    `OrgMembership.user_id`. The value is trusted to be a real user id
    because it comes from `request.user.id` (see GoalViewSet.perform_create),
    not looked up or validated against a users table here.

    `org_id` is the same kind of bare id, for platform-org's Organization -
    null for a personal goal, set for a team one. No cross-module
    membership check happens on it yet (no Python import of platform_org's
    models - see root AGENTS.md's "no cross-module DB access" rule), so a
    team goal today is only visible to whoever created it, same as a
    personal one; scoping goals to every org member is a deliberate
    follow-up once a module can call out to platform-org's own API for it.
    """

    id = models.UUIDField(primary_key=True, default=generate_uuid7, editable=False)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    owner_id = models.UUIDField()
    org_id = models.UUIDField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=GoalStatus.choices, default=GoalStatus.NOT_STARTED)
    target_date = models.DateField(null=True, blank=True)
    # Self-referential, optional - a sub-goal under a bigger one. SET_NULL
    # (not CASCADE): deleting a parent goal shouldn't silently destroy its
    # whole sub-tree, just detach the children back to top-level. No cycle
    # check (A -> B -> A) yet - see GoalViewSet._resolve_parent's own note.
    parent = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, db_column="parent_id", related_name="sub_goals"
    )

    class Meta:
        db_table = "goal"
