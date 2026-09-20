"""`Goal` CRUD routes, wired via platform-core's generic `crud_factory`.

`GOAL_CONFIG` is imported by `goalnexa_ext/asgi.py` twice: once to build this
module's own router (`app.include_router(router, ...)`, the actual list/get/
create/update/delete HTTP routes), and once to register it into
platform-core's `entity_registry` (`register_entity_config`, backing
`GET /entities/goals/schema` — what makes the generic admin frontend able to
render a Goal list/form/detail page with zero Goal-specific frontend code).
Both steps are required; either alone leaves the entity half-wired.
"""

from app.api.crud_factory import CrudEntityConfig, FieldMeta, chain_resolver, make_crud_router

from goalnexa_ext.models.goal import Goal
from goalnexa_ext.schemas.goal import GoalCreate, GoalSummary, GoalUpdate

GOAL_CONFIG = CrudEntityConfig(
    model=Goal,
    resource="goal",
    create_schema=GoalCreate,
    update_schema=GoalUpdate,
    summary_schema=GoalSummary,
    scope_field="org_id",
    # Goal.org_id is a direct column (not a multi-hop FK chain) — the same
    # "row carries its own org_id" case platform-core's own Project and
    # OrgMembership configs use.
    resolve_org_id=chain_resolver([]),
    search_fields=("title", "description"),
    filter_fields=("status",),
    label="Goals",
    field_meta={
        "status": FieldMeta(
            badge_colors={"not_started": "secondary", "in_progress": "info", "done": "success"},
        ),
    },
)

router = make_crud_router(GOAL_CONFIG)
