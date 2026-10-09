from core_api.serializers import BaseSerializer
from goalnexa.models import Goal


class GoalSerializer(BaseSerializer):
    """No `Meta.fields` - every model field is emitted, and the `metrics`
    reverse relation (`Metric.goal`'s `related_name`) is auto-added and
    auto-deferred by `BaseSerializer` itself (it finds `MetricSerializer`
    via the model registry, no import needed here); pass
    `?include[]=metrics` to sideload a goal's metrics instead of leaving
    the field off. `owner_id` is read-only, same as `Organization.slug` -
    it's always `request.user.id` (see `GoalViewSet.perform_create`),
    never something a caller sets directly.

    `org_id` is a bare `UUIDField`, not a real FK (see `Goal.org_id`'s own
    docstring - no cross-module DB access from goalnexa into
    platform_org). `related_endpoints` tells `BaseViewSet.schema` to
    describe it as a relation anyway, purely so the frontend gets a real
    org picker instead of a raw-id text box - it's still a plain
    serializer field otherwise, written through `validated_data` like any
    other (no `GoalViewSet._resolve_*` needed for it).

    `members` (the reverse `GoalMember` relation) is left out: who a goal
    is shared with is managed at `/api/v1/goal-members` (goalnexa-frontend's
    goal members panel), not as a generic related-rows tab whose form
    would ask for a raw user id.

    `progress`/`projected_progress`/`health` are computed by the server
    (`goalnexa.progress`), read-only here.
    """

    class Meta:
        model = Goal
        # `help_text` is the plain-language hint forms and table headers show.
        extra_kwargs = {
            "title": {"help_text": "What you want to achieve, as an outcome. For example: Run a half marathon."},
            "description": {"help_text": "Optional. Why it matters, or any detail worth remembering."},
            "owner_id": {"read_only": True},
            "org_id": {"help_text": "The organization this goal belongs to. Its members can see it. Empty = just yours."},
            "status": {"help_text": "Where the goal stands: not started, in progress, completed, or archived (hidden from the dashboard)."},
            "target_date": {"help_text": "The day you want to be done by. Progress is projected forward to this date."},
            "visibility": {"help_text": "Public: everyone in the organization can see it. Private: only you and the people you add."},
            "progress": {"read_only": True, "help_text": "How far along the goal is, as a %: the average of its metrics' progress. Calculated for you."},
            "projected_progress": {"read_only": True, "help_text": "Where the goal is heading by its target date if the recent pace continues. Calculated for you."},
            "health": {"read_only": True, "help_text": "On track, at risk or off track, judged from the projection. Calculated for you."},
            "cycle": {"help_text": "The period (for example a quarter) this goal is set for. Optional."},
            "parent": {"help_text": "Makes this a sub-goal of another goal."},
        }
        # members: see above. The feed, comments and cycle scores have their
        # own panels (GoalActivityPanel, the cycle page) - not generic tabs.
        auto_exclude = [
            "created_at", "updated_at", "members", "activities", "comments", "scores", "snapshots", "rolled_from",
        ]
        related_endpoints = {"org_id": "/api/v1/orgs"}
