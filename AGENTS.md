# AGENTS.md

Guidance for AI agents (and humans) working in this repo. GoalNexa is a
self-hosted goal/habit/OKR tracker (personal + team use) — see
`docs/product-discovery/` for the market research behind the idea and
`docs/architecture/microservices-design.md` for where this is headed.

## What this repo actually is

GoalNexa's root has **no backend or frontend of its own** — it's a pure
`apps/` container. Every capability lives in its own repo, consumed here
as a git submodule under `apps/`. Don't add product code directly to this
repo's root; a new capability gets its own repo/submodule under `apps/`,
matching `platform-auth`'s shape (own backend, own frontend, own repo).

## Repo layout

| Path | What |
|---|---|
| `modules.yaml` | Static registry of which modules this platform composes (name, kind, path, repo, enabled). See that file's own header comment for the planned dynamic version. |
| `apps/platform-core/` | git submodule. FastAPI+SQLAlchemy backend, React+Tabler frontend. Auth/orgs/RBAC/generic-CRUD-factory (kernel). Own repo, own AGENTS.md — read that for what it provides, don't duplicate that knowledge here. |
| `apps/platform-auth/` | git submodule. Django+DRF backend, React+Tabler frontend. Standalone login module. Own repo, own AGENTS.md. |
| `docs/architecture/` | Target-state design docs (microservices/module system). Not yet implemented — see status note in that doc. |
| `docs/product-discovery/` | Market/customer research, not implementation-relevant. |

## Adding a new module

Follow `platform-auth` as the template: its own repo, its own
`backend/`+`frontend/`, own AGENTS.md, added here via
`git submodule add <repo> apps/<name>`, then listed in `modules.yaml`.
Don't build a new capability directly in this repo's root.

## History note

GoalNexa previously had its own root `backend/`/`frontend/` (a `Goal`
entity mounted onto platform-core "in place", per an earlier
integration approach) — deliberately removed. If you're looking for that
code, it's in this repo's git history, not something to resurrect as-is;
any future product feature should land as its own `apps/` submodule
instead.
