"""Teams (platform-org's, docs/team-templates.md) as goalnexa sees them -
asked through core's registry by endpoint, never by importing platform-org's
models. With a request, rows are what the caller could list there
(`visible_rows`); without one (rollups recomputed after an ingest check-in
or by the scheduler) the endpoint's model is read directly, which needs no
access decision: it's only the tree's shape.

Who may do what with a team's goals:

- the org's owners and admins: everything;
- a team's lead: its instance's targets, and planned targets for every
  team BELOW it (their own comes from above);
- a team's members (and the instance's owner and goal members): check in.
"""

from __future__ import annotations

from core_api.registry import endpoint_model
from core_api.viewsets import visible_rows

TEAMS_ENDPOINT = "/api/v1/teams"
TEAM_MEMBERS_ENDPOINT = "/api/v1/team-members"
ORG_MEMBERS_ENDPOINT = "/api/v1/org-members"
MANAGER_ROLES = ("owner", "admin")
LEAD = "lead"


def teams_installed() -> bool:
    return endpoint_model(TEAMS_ENDPOINT) is not None


def team_parents(org_id) -> dict:
    """`{team_id: parent_id}` for every team of `org_id` ({} without teams)."""
    model = endpoint_model(TEAMS_ENDPOINT)
    if model is None or org_id is None:
        return {}
    return dict(model.objects.filter(org_id=org_id).values_list("id", "parent_id"))


def team_names(team_ids) -> dict:
    model = endpoint_model(TEAMS_ENDPOINT)
    if model is None:
        return {}
    return {str(k): v for k, v in model.objects.filter(id__in=list(team_ids)).values_list("id", "name")}


def team_org(team_id):
    model = endpoint_model(TEAMS_ENDPOINT)
    if model is None:
        return None
    return model.objects.filter(id=team_id).values_list("org_id", flat=True).first()


def children_of(parents: dict) -> dict:
    children: dict = {}
    for child, parent in parents.items():
        children.setdefault(parent, []).append(child)
    return children


def subtree(parents: dict, team_id) -> set:
    """`team_id` and every team under it; `None` = the whole org."""
    if team_id is None:
        return set(parents)
    children = children_of(parents)
    found, stack = set(), [team_id]
    while stack:
        current = stack.pop()
        if current not in found:
            found.add(current)
            stack.extend(children.get(current, []))
    return found


def ancestors(parents: dict, team_id) -> list:
    """`team_id`'s parent, grandparent, ... (not itself), nearest first."""
    found, current = [], parents.get(team_id)
    while current is not None and current not in found:
        found.append(current)
        current = parents.get(current)
    return found


def _memberships(user_id, request=None):
    rows = visible_rows(TEAM_MEMBERS_ENDPOINT, request) if request is not None else None
    if rows is None:
        model = endpoint_model(TEAM_MEMBERS_ENDPOINT)
        if model is None:
            return None
        rows = model.objects.all()
    return rows.filter(user_id=user_id)


def my_team_ids(user_id, request=None) -> set:
    rows = _memberships(user_id, request)
    return set() if rows is None else set(rows.values_list("team_id", flat=True))


def my_lead_team_ids(user_id, request=None) -> set:
    rows = _memberships(user_id, request)
    return set() if rows is None else set(rows.filter(role=LEAD).values_list("team_id", flat=True))


def is_org_manager(request, org_id) -> bool:
    """Whether the caller is an owner or admin of `org_id`. True when the
    host has no org members endpoint (nothing to ask)."""
    if org_id is None:
        return False
    members = visible_rows(ORG_MEMBERS_ENDPOINT, request)
    if members is None:
        return True
    return members.filter(org_id=org_id, user_id=request.user.id, role__in=MANAGER_ROLES).exists()


def visible_team_ids(user_id, request=None) -> set:
    """Teams whose TEAM-visibility goals `user_id` sees: a team's goal is
    its subtree's - so their own teams and every team above them (a
    department's goals are its sub-teams' too) - plus every team below one
    they lead (who sets those teams' targets sees them)."""
    mine = my_team_ids(user_id, request)
    if not mine:
        return set()
    leads = my_lead_team_ids(user_id, request)
    model = endpoint_model(TEAMS_ENDPOINT)
    orgs = set(model.objects.filter(id__in=mine).values_list("org_id", flat=True)) if model else set()
    found = set(mine)
    for org_id in orgs:
        parents = team_parents(org_id)
        for team_id in mine:
            if team_id in parents:
                found.update(ancestors(parents, team_id))
                if team_id in leads:
                    found.update(subtree(parents, team_id))
    return found


def can_set_targets(request, goal) -> bool:
    """An instance's base/target values: the org's owners/admins, the
    goal's owner, a lead of its team or of a team above it."""
    if str(goal.owner_id) == str(request.user.id) or is_org_manager(request, goal.org_id):
        return True
    if goal.team_id is None:
        return False
    leads = my_lead_team_ids(request.user.id, request)
    parents = team_parents(goal.org_id)
    return bool(leads & ({goal.team_id} | set(ancestors(parents, goal.team_id))))


def can_check_in(request, goal) -> bool:
    """Checking in on an instance: anyone who may set its targets, its
    goal members, and the members of its team."""
    if can_set_targets(request, goal):
        return True
    if goal.members.filter(user_id=request.user.id).exists():
        return True
    return goal.team_id is not None and goal.team_id in my_team_ids(request.user.id, request)


def can_plan(request, rollup_goal) -> bool:
    """A planned (top-down) target on a rollup: the org's owners/admins
    anywhere; a team lead on nodes strictly below their team."""
    if is_org_manager(request, rollup_goal.org_id):
        return True
    if rollup_goal.team_id is None:
        return False
    parents = team_parents(rollup_goal.org_id)
    return bool(my_lead_team_ids(request.user.id, request) & set(ancestors(parents, rollup_goal.team_id)))
