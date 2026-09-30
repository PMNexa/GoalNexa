from django.db import models

from core_api.utils import TimestampedModel, generate_uuid7
from goalnexa.models.check_in import CheckIn
from goalnexa.models.goal import Goal


class GoalComment(TimestampedModel):
    """A comment on a goal - optionally on one of its check-ins. Whoever
    sees the goal sees its comments; only the author edits or deletes one
    (`GoalCommentViewSet`). `author_id` is a bare id."""

    id = models.UUIDField(primary_key=True, default=generate_uuid7, editable=False)
    goal = models.ForeignKey(Goal, on_delete=models.CASCADE, db_column="goal_id", related_name="comments")
    author_id = models.UUIDField()
    body = models.TextField()
    check_in = models.ForeignKey(
        CheckIn, on_delete=models.SET_NULL, null=True, blank=True, db_column="check_in_id", related_name="comments"
    )

    class Meta:
        db_table = "goal_comment"
        verbose_name = "goal comment"
