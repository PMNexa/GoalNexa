# GoalNexa

Self-hosted goal/habit/OKR tracker (personal + team use). See `docs/product-discovery/` for the market research behind the idea.

See root `AGENTS.md` for the current architecture in detail. Short version: `apps/main/` is the running app (Django+DRF backend, `create-react-router` frontend, plain directory in this repo). A module's frontend (e.g. `apps/platform-auth/frontend`) is an npm package exporting self-contained screens; `apps/main` imports and routes to them itself. `apps/platform-core`/`apps/platform-auth` are git submodules with their own repos — `platform-core` and the Module Federation composition approach are kept for reference but are not the active pattern.

## Cloning this repo

Submodules aren't fetched by a plain `git clone`:

```
git clone --recurse-submodules <this-repo-url>
# or, if already cloned:
git submodule update --init
```

## Running it

```
docker compose up --build
```

Single external entrypoint: **http://localhost:55607** (nginx — see
`nginx/default.conf`). `/api/*` and `/admin/*` go to the Django backend,
everything else to the frontend.

- App: http://localhost:55607
- Login: http://localhost:55607/login
- Backend directly (no nginx): http://localhost:8000 inside the compose network only — not published to the host; go through 55607.

## Running apps/main standalone (no Docker)

```
cd apps/main/backend && source .venv/bin/activate && python manage.py runserver
cd apps/main/frontend && npm install && npm run dev
```

`apps/main/frontend` depends on `platform-auth-frontend` via a local
`file:../../platform-auth/frontend` path — that sibling directory must
exist (it does, as the `apps/platform-auth` submodule) for `npm install`
to resolve it.
