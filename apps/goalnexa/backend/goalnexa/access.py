"""Which goals a caller may see: their personal goals (no org), plus the
goals filed under an org they belong to - every PUBLIC one, and a PRIVATE
one only if they own it or are one of its members (`GoalMember`), and a
TEAM one if it's their team's or a team above theirs (`goalnexa.teams`),
or they're an owner/admin of the org. An
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
        | _team_visible(request, path)
    )
    return (own & Q(**{f"{path}org_id__isnull": True})) | (Q(**{f"{path}org_id__in": orgs.values("id")}) & shared)


def _team_visible(request, path: str) -> Q:
    """TEAM-visibility goals the caller sees: their teams' and the teams
    above theirs, and every one in an org they're an owner/admin of."""
    from goalnexa.teams import MANAGER_ROLES, teams_installed, visible_team_ids

    if not teams_installed():
        return Q(pk__in=[])
    team = Q(**{f"{path}visibility": GoalVisibility.TEAM})
    allowed = Q(**{f"{path}team_id__in": list(visible_team_ids(request.user.id, request))})
    members = visible_rows(ORG_MEMBERS_ENDPOINT, request)
    if members is not None:
        managed = members.filter(user_id=request.user.id, role__in=MANAGER_ROLES).values("org_id")
        allowed |= Q(**{f"{path}org_id__in": managed})
    return team & allowed


def visible_cycles(request, path: str = "") -> Q:
    """Cycles the caller may see: their personal ones, and every cycle of
    an org they belong to (a cycle has no private mode)."""
    own = Q(**{f"{path}owner_id": request.user.id, f"{path}org_id__isnull": True})
    orgs = visible_rows(ORGS_ENDPOINT, request)
    if orgs is None:
        return Q(**{f"{path}owner_id": request.user.id})
    return own | Q(**{f"{path}org_id__in": orgs.values("id")})


def is_org_member(request, org_id, user_id) -> bool:
    """Whether `user_id` is an active member of `org_id`, as far as the
    caller can tell (platform-org's members endpoint lists only the orgs
    they belong to). `True` when the host has no such endpoint."""
    members = visible_rows(ORG_MEMBERS_ENDPOINT, request)
    if members is None:
        return True
    return members.filter(org_id=org_id, user_id=user_id).exists()
