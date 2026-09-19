# GoalNexa backend

A self-hosted goal/habit/OKR tracker backend (personal + team use). FastAPI +
SQLAlchemy (async) + Postgres, with a generic CRUD factory, cookie-based
refresh-token auth, and single-level org RBAC.

This is a simplified port of architecture patterns from a larger sibling
project: no `Actor` polymorphism, no AI-agent actors, no project-level
sub-tenancy — just `User` -> `OrgMembership` -> `Organization`, and one
example CRUD entity (`Goal`) proving the generic `make_crud_router()`
pattern end to end.

## Stack

Python 3.11+, FastAPI, SQLAlchemy 2.0 (async, `asyncpg`), Alembic (async
migrations), Pydantic v2, `passlib[argon2]`, `PyJWT`, UUIDv7 primary keys
(`uuid6`).

## Setup

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
cp .env.example .env   # adjust DATABASE_URL / JWT_SECRET for your environment
```

You need a Postgres database reachable at `DATABASE_URL`. Locally, e.g.:

```bash
docker run --rm -d --name goalnexa-pg \
  -e POSTGRES_USER=goalnexa -e POSTGRES_PASSWORD=goalnexa -e POSTGRES_DB=goalnexa \
  -p 5432:5432 postgres:16
```

## Environment variables

See `.env.example`. Summary:

| Variable | Default | Notes |
| --- | --- | --- |
| `ENV` | `dev` | `dev` disables the `Secure` flag on the refresh cookie |
| `DATABASE_URL` | — | `postgresql+asyncpg://...` |
| `JWT_SECRET` | — | HS256 signing secret for access tokens |
| `JWT_ACCESS_TTL_MINUTES` | `15` | float minutes |
| `JWT_REFRESH_TTL_DAYS` | `30` | absolute refresh-token lifetime |
| `CORS_ORIGINS` | `["http://localhost:30566"]` | JSON array; `allow_credentials=True` is required for the refresh cookie |
| `APP_BASE_URL` | `http://localhost:8000` | used to build invite links |

## Run migrations

```bash
.venv/bin/alembic upgrade head
```

This creates the schema (`0001_initial_schema`) and idempotently seeds the
RBAC catalog — permissions plus the 3 system roles `org_admin`, `member`,
`viewer` (`0002_seed_rbac`).

## Run the server

```bash
.venv/bin/uvicorn app.main:app --reload
```

Then `POST /auth/signup` once (bootstrap-only — creates the first
`User` + `Organization` + `org_admin`, and returns `409 signup_closed` on
every call after the first). From then on, further orgs come from an
authenticated `POST /orgs`, and further members come from the invite flow
(`POST /orgs/{org_id}/members/invite` -> `POST /invites/{token}/accept`).

## Tests

```bash
.venv/bin/pytest tests/unit -v            # no DB required
.venv/bin/pytest tests/integration -v     # needs Postgres at TEST_DATABASE_URL
```

`TEST_DATABASE_URL` (falls back to
`postgresql+asyncpg://goalnexa:goalnexa@localhost:5432/goalnexa_test` if
unset) points integration tests at a scratch database — each test creates
and drops the full schema itself, no Alembic needed for tests.

## API surface

- Auth: `POST /auth/signup`, `/auth/login`, `/auth/refresh`, `/auth/logout`,
  `GET /auth/me`, `GET /auth/me/orgs`.
- Orgs: `POST /orgs`.
- Membership: `GET /orgs/{org_id}/members`, `POST
  /orgs/{org_id}/members/invite`, `PATCH /orgs/{org_id}/members/{id}`,
  `POST /invites/{token}/accept`, `POST
  /orgs/{org_id}/members/{id}/accept`.
- RBAC: `GET /orgs/{org_id}/permissions/mine`.
- Goals (generic CRUD factory example): `GET/POST /goals`, `GET/PATCH/DELETE
  /goals/{id}`.
- `GET /health`.

Every error response is `{"code": str, "message": str, "field_errors": dict
| null}` — see `app/main.py`'s two global exception handlers.

## Adding a new CRUD entity

1. Add the SQLAlchemy model under `app/models/` (needs an `org_id` column,
   or set a different `scope_field`).
2. Add Pydantic `*Create` / `*Update` / `*Summary` schemas under
   `app/schemas/`.
3. In a new `app/api/routes/<entity>.py`, build a `CrudEntityConfig(...)`
   and `router = make_crud_router(config)`.
4. `app.include_router(...)` it in `app/main.py`.
5. Seed the new resource's `<resource>.{list,get,create,update,delete}`
   permission codes into `app/db/rbac_seed_catalog.py` and grant them to the
   system roles as appropriate, then write an Alembic migration that re-runs
   the same idempotent existence-check-then-insert pattern as
   `0002_seed_rbac.py`.

`app/models/goal.py` / `app/schemas/goal.py` / `app/api/routes/goals.py` is
the worked example.
