"""`Goal` CRUD routes, wired via the generic `crud_factory`.

Proves the `make_crud_router()` pattern end to end: list/get/create/update/
delete all come for free from `CrudEntityConfig`, mounted at `/goals` and
`/goals/{id}`.
"""

from app.api.crud_factory import CrudEntityConfig, make_crud_router
from app.models.goal import Goal
from app.schemas.goal import GoalCreate, GoalSummary, GoalUpdate

_config = CrudEntityConfig(
    model=Goal,
    resource="goal",
    create_schema=GoalCreate,
    update_schema=GoalUpdate,
    summary_schema=GoalSummary,
    scope_field="org_id",
    search_fields=("title", "description"),
    filter_fields=("status",),
)

router = make_crud_router(_config)
