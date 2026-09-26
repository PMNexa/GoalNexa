"""Which goals a caller may see: their personal goals (no org), plus the
goals filed under an org they belong to - every PUBLIC one, and a PRIVATE
one only if they own it or are one of its members (`GoalMember`). An
org's goals belong to its members, so leaving the org ends access even to
goals you created or were added to there. Which orgs those are is
platform-org's call, asked through core's registry (`visible_rows`)
rather than by importing its models; with no orgs endpoint in the host,
goals stay owner-only."""

from django.db.models import Q

from core_api.viewsets import visible_rows
from goalnexa.models import GoalMember, GoalVisibility

ORGS_ENDPOINT = "/api/v1/orgs"
ORG_MEMBERS_ENDPOINT = "/api/v1/org-members"


def visible_goals(request, path: str = "") -> Q:
    """A filter for goals the caller may see - `path` is the lookup from
    the queried model to its goal (`"goal__"` for metrics)."""
    user_id = request.user.id
    own = Q(**{f"{path}owner_id": user_id})
    orgs = visible_rows(ORGS_ENDPOINT, request)
    if orgs is None:
        return own
    shared = (
        Q(**{f"{path}visibility": GoalVisibility.PUBLIC})
        | own
        | Q(**{f"{path}id__in": GoalMember.objects.filter(user_id=user_id).values("goal_id")})
    )
    return (own & Q(**{f"{path}org_id__isnull": True})) | (Q(**{f"{path}org_id__in": orgs.values("id")}) & shared)


def is_org_member(request, org_id, user_id) -> bool:
    """Whether `user_id` is an active member of `org_id`, as far as the
    caller can tell (platform-org's members endpoint lists only the orgs
    they belong to). `True` when the host has no such endpoint."""
    members = visible_rows(ORG_MEMBERS_ENDPOINT, request)
    if members is None:
        return True
    return members.filter(org_id=org_id, user_id=user_id).exists()
