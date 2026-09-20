# AGENTS.md

Guidance for AI agents (and humans) working in this repo. GoalNexa is a
self-hosted goal/habit/OKR tracker (personal + team use) — see
`docs/product-discovery/` for the market research behind the idea and
`docs/architecture/microservices-design.md` for where this is headed.

## What this repo actually is

GoalNexa's own code is small on purpose: one product entity (`Goal`) plus the
thin wiring that mounts it onto [`platform-core`](https://github.com/EugeneNguyen/platform-core)
— a separate repo providing auth, multi-tenant orgs, RBAC, and a generic CRUD
factory, consumed here as a git submodule **in place** (source imported
directly, not copied). Read `README.md`'s "Consuming platform-core in place"
section before touching `backend/` or `frontend/` — it explains the whole
mechanism this file's gotchas below assume you already understand.

## Repo layout

| Path | What |
|---|---|
| `apps/platform-core/` | git submodule. FastAPI+SQLAlchemy backend, React+Tabler frontend. Auth/orgs/RBAC/generic-CRUD-factory. Own repo, own README/CLAUDE.md — read those for what it provides, don't duplicate that knowledge here. |
| `backend/goalnexa_ext/` | GoalNexa's own Django-style "app" (deliberately not named `app` — collides with platform-core's own top-level package). The `Goal` entity: model, schemas, `CrudEntityConfig`, and `asgi.py` (the real ASGI entrypoint — mounts onto platform-core's `app.main:app`, doesn't build a second one). |
| `backend/alembic/` | GoalNexa's OWN migration chain (separate `version_table`, creates only the `goal` table + its RBAC permission grants). Must run AFTER `apps/platform-core/backend`'s own chain. |
| `frontend/src/main.tsx` | The entire frontend: imports `App`/`registerOrgScopedEntity` from `../../apps/platform-core/frontend/src/...`, registers `Goal`, sets up Tabler. |
| `frontend/scripts/link-platform-core-node-modules.mjs` | `postinstall` hook — symlinks the submodule's `node_modules` to this project's own. See "The symlink" below before touching anything node_modules-related. |
| `docs/architecture/` | Target-state design docs (microservices/module system). Not yet implemented — see status note in that doc. |
| `docs/product-discovery/` | Market/customer research, not implementation-relevant. |

## Before adding a new entity

Follow `Goal` as the template on both sides — do not hand-roll a new pattern:
- Backend: `backend/goalnexa_ext/{models,schemas,routes}/goal.py`, two Alembic
  migrations (create table; seed+grant its permissions — see that migration's
  own comments for why this is pure data, no platform-core edit needed), two
  lines in `asgi.py` (`include_router` + `register_entity_config`).
- Frontend: one `registerOrgScopedEntity({key, label})` call in `main.tsx`.
  Nothing else — list/form/detail admin pages are fully generic once the
  entity is registered and its `CrudEntityConfig` exists on the backend.

`register_entity_config()` / `registerOrgScopedEntity()` are extension points
added **upstream in platform-core itself** specifically so a submodule
consumer can register an entity without editing platform-core's own files —
if you ever feel like you need to edit something under `apps/platform-core/`
to add a GoalNexa entity, stop, that's the wrong path.

## The symlink (read before touching frontend/node_modules or the submodule path)

Node/Vite resolves a bare import by walking **up the directory tree from the
importing file's location**. A file under `apps/platform-core/frontend/src/`
walking up would find `apps/platform-core/frontend/node_modules` (if it
existed) — not this project's own `frontend/node_modules`, since they're not
in the same ancestor chain. Without the symlink, npm-installing the submodule
separately gives the page two independent copies of React — a real "Invalid
hook call" crash the moment anything renders, not a theoretical risk.

The symlink is **relative** (`../../../frontend/node_modules` as of the
current `apps/platform-core/` depth), not absolute — an absolute one bit a
real bug: the same script runs inside the docker-compose frontend
container's own `npm install`, and a container-internal absolute path
written into the bind-mounted host checkout dangled outside Docker. If you
ever move `frontend/` or `apps/platform-core/` to a different depth, the
symlink must be recreated (`node frontend/scripts/link-platform-core-node-modules.mjs`)
— it does not update itself, and a stale one silently resolves to the wrong
directory instead of erroring.

`src/App.smoke.test.tsx` is the regression test for all of this — a passing
`npm run build` does NOT prove the symlink is correct (bundlers happily
bundle two copies of a package without erroring); only a real render does.

## Known environment gotcha: the npm/rollup bug

`frontend`'s docker-compose command occasionally hits a documented npm bug
([npm/cli#4828](https://github.com/npm/cli/issues/4828)): an optional native
dependency (`@rollup/rollup-*`) intermittently fails to install, crashing
Vite on start with `Cannot find module '@rollup/rollup-linux-...'`. This is
genuinely non-deterministic — reproduced directly during development where
an otherwise-identical `rm -f package-lock.json && npm install` sometimes
worked and sometimes didn't. `docker-compose.yml`'s frontend command already
retries automatically (`node -e "require('rollup')" || npm install --force`)
— if you see this crash in logs, that's the retry working as designed, wait
~10-20s for it to recover before assuming something is actually broken.

## Backend routing: everything is under `/api/v1/*` except `/health`

platform-core's `app/main.py` mounts every feature router with
`prefix="/api/v1"`; `health.router` is mounted with no prefix at all. This
is why `nginx/default.conf` and `frontend/vite.config.ts`'s dev proxy both
have a special-cased `/api/health` rule alongside the generic passthrough
`/api/` rule — if you add a new bespoke route anywhere, check which side of
that split it needs before assuming the generic proxy rule covers it.

## Auth/RBAC conventions inherited from platform-core (don't relitigate these)

- Bootstrap-only signup: the first `POST /api/v1/auth/signup` creates the
  first org + `org_admin`; every call after that 409s. There is no
  self-service path to a second org — further orgs come from an
  authenticated `POST /orgs`, further members from the invite flow.
- Permission codes are `<resource>.<action>` with actions `create`/`read`/
  `update`/`delete` — **not** `list`/`get`. A generic-CRUD `list` or `get`
  route both check `<resource>.read`, never separate list/get permissions.
  Match this exactly in any new RBAC seed migration (see
  `backend/alembic/versions/0002_seed_goal_permissions.py`'s own comment).
- 404-before-403: never confirm a resource/org's existence to a non-member.
  Every org-scoped route checks membership existence (any status) before
  checking the specific permission — implemented as an explicit function
  call in route bodies, not a stacked dependency (FastAPI resolves all
  `Depends` before the route body runs, which would let a 403 leak ahead of
  a 404 in some orderings).
- `org_admin` gets every permission that existed **at platform-core's own
  seed-migration time** — it is a one-time snapshot grant (`RolePermission`
  rows), not a dynamic "all permissions, including future ones" rule. Adding
  a new resource's permissions always needs its own migration granting them
  explicitly to whichever system roles should hold them.

## Running it

```
docker compose up --build
```

Single entrypoint at **http://localhost:30566** (nginx routes `/api/*` to
the backend, everything else including HMR to the frontend dev server). See
`README.md` for the full quickstart and `backend/README.md`/
`frontend/README.md` for each half's own setup/testing instructions — this
file is gotchas and orientation, not a setup guide; don't duplicate those.

## Verifying a change actually works

Typecheck/build/unit-test passing is not sufficient proof for anything
touching the platform-core integration boundary (imports across the
submodule, the symlink, the migration ordering, the nginx/proxy routing) —
those have broken silently before while every automated check stayed green.
For a change in that territory, do a live `docker compose up --build` and
curl through the real flow (signup → create an entity → list it) before
calling it done, the same way every integration change in this repo's
history was actually verified.
