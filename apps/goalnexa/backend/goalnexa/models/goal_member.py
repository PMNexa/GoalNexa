from django.db import models

from core_api.utils import TimestampedModel, generate_uuid7
from goalnexa.models.goal import Goal


class GoalMember(TimestampedModel):
    """Someone a goal is shared with besides its owner - what makes a
    PRIVATE org goal visible to them (a public one is visible to the whole
    org anyway; see `access.py`). Always a member of the goal's org: the
    goal stays out of reach once they leave it, membership row or not.

    `user_id` is a bare id, same convention as `Goal.owner_id` - checked
    against the org's members when added (`GoalMemberViewSet`), never
    looked up in a users table here.
    """

    id = models.UUIDField(primary_key=True, default=generate_uuid7, editable=False)
    goal = models.ForeignKey(Goal, on_delete=models.CASCADE, db_column="goal_id", related_name="members")
    user_id = models.UUIDField()

    class Meta:
        db_table = "goal_member"
        verbose_name = "goal member"
        constraints = [models.UniqueConstraint(fields=["goal", "user_id"], name="uq_goal_member_goal_user")]
