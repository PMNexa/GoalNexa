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
| `modules.yaml` | Static registry of which modules this platform composes (name, kind, path, repo, `url_prefix`, `remote_entry`, enabled). See that file's own header comment for the planned dynamic version. |
| `docker-compose.yml` / `nginx/default.conf` | The single-port gateway that actually composes every module for local dev — nginx routes each module's `url_prefix` to its own frontend/backend containers. Add a new module here too (two location blocks) when you add one to `modules.yaml`. |
| `apps/platform-core/` | git submodule. Django+DRF kernel: no models, shared conventions only (`core_api/`), plus a thin React Router frontend shell that fetches `GET /api/modules` and renders each module's UI inline via Module Federation (`remote_entry`), falling back to a `url_prefix` link. Own repo, own AGENTS.md — read that for what it provides, don't duplicate that knowledge here. |
| `apps/platform-auth/` | git submodule. Django+DRF backend, React frontend. Standalone login module, mounted at `/platform-auth`. Own repo, own AGENTS.md. |
| `docs/architecture/` | Target-state design docs (microservices/module system). Not yet implemented — see status note in that doc. |
| `docs/product-discovery/` | Market/customer research, not implementation-relevant. |

## Adding a new module

Follow `platform-auth` as the template: its own repo, its own
`backend/`+`frontend/`, own AGENTS.md, added here via
`git submodule add <repo> apps/<name>`, then listed in `modules.yaml`
with a `url_prefix`. Don't build a new capability directly in this repo's
root. Also add two `location` blocks to `nginx/default.conf` (api, then
frontend) and a backend+frontend service pair to `docker-compose.yml` —
see `platform-auth`'s own entries for the pattern (its backend reads
`URL_PREFIX` so any absolute cookie paths stay correct under the prefix;
its frontend is started with `vite --base=<url_prefix>/`).

**If the new module should also render inline in platform-core's shell**
(not just link out to), it needs a Module Federation setup too: expose a
self-contained component (bundles its own providers/context, no
`react-router-dom` dependency - see `platform-auth`'s `RemoteLogin.tsx`
for why), add `remote_entry` to its `modules.yaml` entry, and run it via
`vite build --watch` + `vite preview` in `docker-compose.yml` instead of
`vite dev` (federation's remote side needs a real build to emit
`remoteEntry.js` from - platform-core, the host, stays on `vite dev`
fine). `shared: { react, 'react-dom' }` singleton config must match
platform-core's own `vite.config.ts` exactly or you get a duplicate-React
crash.

## History note

GoalNexa previously had its own root `backend/`/`frontend/` (a `Goal`
entity mounted onto platform-core "in place", per an earlier
integration approach) — deliberately removed. If you're looking for that
code, it's in this repo's git history, not something to resurrect as-is;
any future product feature should land as its own `apps/` submodule
instead.
