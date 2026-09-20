# GoalNexa

Self-hosted goal/habit/OKR tracker (personal + team use). See `docs/product-discovery/` for the market research behind the idea.

Auth, orgs, RBAC, the generic CRUD factory, and the design system all come from [`platform-core`](https://github.com/EugeneNguyen/platform-core), a git submodule this project **consumes in place** — its source files are imported directly (backend via `PYTHONPATH`/editable install, frontend via relative import), not copied. GoalNexa's own code is just its product entity, `Goal`, plus the thin wiring that mounts it onto platform-core's app. See "Consuming platform-core in place" below for exactly how, and each subproject's own README for its half.

## Cloning this repo

The submodule isn't fetched by a plain `git clone`:

```
git clone --recurse-submodules <this-repo-url>
# or, if already cloned:
git submodule update --init
```

## Stack

- **Backend** (`backend/`): FastAPI + SQLAlchemy 2.0 (async) + PostgreSQL + Alembic + JWT/argon2, from `apps/platform-core/backend`. See `backend/README.md`.
- **Frontend** (`frontend/`): React 18 + Vite + TypeScript, TanStack Query, react-hook-form + zod, from `apps/platform-core/frontend`. Tabler is GoalNexa's own npm-installed design-system entry point (not platform-core's CDN link — see `frontend/README.md`).

## Quickstart

```
docker compose up --build
```

Single external entrypoint: nginx listens on **http://localhost:30566** and routes `/api/*` to the backend (passthrough — platform-core's own routes are mounted under `/api/v1/...`, `/api/health` is the one exception, see `nginx/default.conf`) and everything else, including Vite's HMR websocket, to the frontend dev server. The backend and frontend containers have no host port of their own; only nginx is exposed.

- App: http://localhost:30566 (hot-reloads on `frontend/src` and `apps/platform-core/frontend/src` changes)
- API: http://localhost:30566/api/v1/* (runs both migration chains on boot, hot-reloads on `backend/goalnexa_ext` changes)
- Postgres: localhost:5432 (user/pass/db: `goalnexa`)

First run: open http://localhost:30566/signup — signup is bootstrap-only (the first signup creates the first organization and becomes its admin; every signup after that returns `409 signup_closed`). Invite additional users from the org's Members page.

## Consuming platform-core in place

Two integration shapes exist for a project that wants platform-core's auth/org/RBAC/CRUD/design-system plumbing — "copy the pieces" (own a copy) or "consume in place" (import the submodule's source directly, stay a `git submodule update` away from upstream fixes). GoalNexa uses the latter. Concretely:

- **Backend**: `backend/goalnexa_ext` is GoalNexa's own package (deliberately not named `app` — that's platform-core's own top-level package name, and both being on the same `PYTHONPATH` would collide). `pip install -e ../apps/platform-core/backend` adds platform-core's `app` package to this environment as source (not copied); `backend/goalnexa_ext/asgi.py` is the real ASGI entrypoint — it imports platform-core's already-fully-wired `app.main:app`, mounts `goalnexa_ext`'s own `Goal` routes onto it, and calls `register_entity_config()` (a platform-core extension point added specifically for this — see below) so the generic admin frontend can render Goal with zero platform-core edits. GoalNexa's own Alembic chain (`backend/alembic/`, separate `version_table` from platform-core's) creates just the `goal` table and grants its permissions to platform-core's already-seeded system roles — it never touches platform-core's own migration history.
- **Frontend**: `frontend/src/main.tsx` imports `App` and `registerOrgScopedEntity` directly from `../apps/platform-core/frontend/src/...` and calls `registerOrgScopedEntity({key: "goal", label: "Goals"})` before rendering. `frontend/scripts/link-platform-core-node-modules.mjs` (this project's own `postinstall`) symlinks `apps/platform-core/frontend/node_modules` to this project's own — without it, two independently-installed copies of React would load into the same page (a real "Invalid hook call" crash, not theoretical — see that script's own comments for the exact bug this hit during development). `frontend/src/App.smoke.test.tsx` renders platform-core's `App` from inside this project specifically to catch a regression there.
- **Extension points added to platform-core itself**: adding a new entity's schema-introspection support (`entity_registry.py`'s `register_entity_config()`) and admin-nav registration (`registry.ts`'s `registerOrgScopedEntity()`/`registerProjectScopedEntity()`) originally required editing those files directly — fine for "copy the pieces," not for a pristine submodule. Both functions were added upstream (in platform-core) specifically to make "consume in place" viable for a real entity, not just auth/org/RBAC passthrough.

## Adding a new entity

Follow `Goal` as the template on both sides — `backend/goalnexa_ext/{models,schemas,routes}/goal.py` and `backend/alembic/versions/000{1,2}_*.py`; `frontend/src/main.tsx`'s `registerOrgScopedEntity` call is the entire frontend-side wiring (the list/form/detail pages are fully generic once the entity is registered and its `CrudEntityConfig` exists on the backend).

## Known environment gotcha

`frontend`'s dev container occasionally hits a documented npm bug ([npm/cli#4828](https://github.com/npm/cli/issues/4828)): an optional native dependency (`@rollup/rollup-*`) intermittently fails to install, crashing Vite on start. `docker-compose.yml`'s frontend command already retries automatically (`node -e "require('rollup')" || npm install --force`); if you ever see it crash-loop anyway, `docker compose restart frontend` clears it.

## Verified end-to-end

Backend: unit tests plus a full manual signup → RBAC-grant → `GET /entities/goals/schema` → Goal CRUD roundtrip against a real Postgres, through both `uvicorn` directly and the full docker-compose + nginx stack. Frontend: typecheck, production build, and a render test proving platform-core's `App` mounts correctly from inside this project (the concrete regression the "consume in place" symlink setup could otherwise silently break). Confirmed live via `docker compose up` + curl: signup, Goal create/list, `GET /entities/goals/schema`, and all SPA routes.
