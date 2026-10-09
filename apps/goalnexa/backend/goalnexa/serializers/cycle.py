from core_api.serializers import BaseSerializer
from goalnexa.models import Activity, Cycle, GoalComment, GoalScore


class CycleSerializer(BaseSerializer):
    """`goals` (reverse) is a generic tab on the cycle's page; `scores`
    are shown by the cycle's own close/score panel instead. `org_id` is a
    cross-module id, described as a relation like `Goal.org_id`. Closing
    is `CycleViewSet.close`, never a plain `status` write."""

    class Meta:
        model = Cycle
        auto_exclude = ["created_at", "updated_at", "scores"]
        # `help_text` is the plain-language hint forms and table headers show.
        extra_kwargs = {
            "name": {"help_text": "A name for the period. For example: Q4 2026."},
            "owner_id": {"read_only": True},
            "org_id": {"help_text": "The organization this period is for. Empty = just yours."},
            "starts_on": {"help_text": "The first day of the period."},
            "ends_on": {"help_text": "The last day of the period."},
            "status": {"help_text": "Planning (not started), active (running), or closed (scored and read-only)."},
            "closed_at": {"read_only": True, "help_text": "When the period was closed and scored."},
            "retro": {"help_text": "Optional. What went well, what didn't, and what to change next time."},
        }
        related_endpoints = {"org_id": "/api/v1/orgs"}


class GoalScoreSerializer(BaseSerializer):
    """Read-only - written once by `CycleViewSet.close`."""

    class Meta:
        model = GoalScore
        auto_exclude = ["updated_at"]


class ActivitySerializer(BaseSerializer):
    class Meta:
        model = Activity
        display_field = "verb"


class GoalCommentSerializer(BaseSerializer):
    """`goal`/`check_in` are resolved from the request body
    (`GoalCommentViewSet`), `author_id` is the caller's."""

    class Meta:
        model = GoalComment
        auto_exclude = ["updated_at"]
        extra_kwargs = {"author_id": {"read_only": True}}
        display_field = "body"
