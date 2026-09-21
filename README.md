# GoalNexa

Self-hosted goal/habit/OKR tracker (personal + team use). See `docs/product-discovery/` for the market research behind the idea.

See root `AGENTS.md` for the current architecture in detail. Short version: `apps/main/` is the running app (Django+DRF backend, `create-react-router` frontend, plain directory in this repo). A module's frontend (e.g. `apps/platform-auth/frontend`) is an npm package exporting self-contained screens, and its backend a pip-installable Django app; `apps/main` imports both and owns all routing itself. `apps/platform-core`/`apps/platform-auth`/`apps/platform-org` are git submodules with their own repos — `platform-core` and the Module Federation composition approach are kept for reference but are not the active pattern.

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
- Sign up / log in: http://localhost:55607/auth/signup, `/auth/login`
- Organizations (requires being logged in): http://localhost:55607/orgs
- Backend directly (no nginx): http://localhost:8000 inside the compose network only — not published to the host; go through 55607.

## Running apps/main standalone (no Docker)

```
cd apps/main/backend
source .venv/bin/activate
pip install -r requirements.txt -e ../platform-auth/backend -e ../platform-org/backend
python manage.py migrate
python manage.py runserver
```

```
cd apps/main/frontend && npm install && npm run dev
```

`apps/main/frontend`'s `package.json` depends on `platform-auth-frontend`
and `platform-org-frontend` via local `file:../../<module>/frontend`
paths — those sibling directories must exist (they do, as the
`apps/platform-auth`/`apps/platform-org` submodules) for `npm install` to
resolve them.
