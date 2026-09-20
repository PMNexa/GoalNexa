"""GoalNexa's actual ASGI entrypoint — `uvicorn goalnexa_ext.asgi:app`.

Mounts GoalNexa's own domain routes onto platform-core's already-fully-wired
FastAPI `app` (auth, orgs, RBAC, CORS, the two global exception handlers —
see `app.main` in the platform-core submodule for what that already
includes), rather than building a second app instance. This is the
downstream-app pattern platform-core's own `app/main.py` docstring
describes: "a plain `app.include_router(...)` call alongside the ones
below."

Both steps below are required for `Goal` to work end to end:
- `include_router` registers the actual HTTP routes (`/api/v1/goals`,
  `/api/v1/goals/{id}`).
- `register_entity_config` makes `GET /entities/goals/schema` describe Goal,
  which is what lets the frontend's generic `EntityListPage`/`EntityForm`/
  `EntityTable` render a Goal admin page with no Goal-specific frontend code.
"""

from app.api.entity_registry import register_entity_config
from app.main import app

from goalnexa_ext.routes.goals import GOAL_CONFIG
from goalnexa_ext.routes.goals import router as goals_router

app.include_router(goals_router, prefix="/api/v1", tags=["goals"])
register_entity_config(GOAL_CONFIG)

__all__ = ["app"]
