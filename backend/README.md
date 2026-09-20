# GoalNexa backend

Auth, orgs, RBAC, and the generic CRUD factory come from the [`platform-core`](https://github.com/EugeneNguyen/platform-core) git submodule (`../apps/platform-core/backend`), consumed **in place** — added to this environment's Python path as source via an editable install, not copied. This directory (`backend/`) holds only GoalNexa's own product code: the `Goal` entity, under `goalnexa_ext/` (deliberately not named `app` — that's platform-core's own top-level package name; both installed into the same environment would collide).

See the root `README.md`'s "Consuming platform-core in place" section for the full picture, and platform-core's own `README.md`/`CLAUDE.md` for what it provides.

## Stack

Python 3.11+, FastAPI, SQLAlchemy 2.0 (async, `asyncpg`), Alembic (async migrations), Pydantic v2, `passlib[argon2]`, `PyJWT`, UUIDv7 primary keys (`uuid6`) — all platform-core's own dependency set; `goalnexa-backend-ext`'s `pyproject.toml` declares the same versions since platform-core's `app` package isn't pip-installed as a separate distribution, just added to this same environment's import path.

## Setup

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -e ../apps/platform-core/backend   # platform-core's `app` package, as source
.venv/bin/pip install -e ".[dev]"                    # goalnexa_ext
cp .env.example .env   # adjust DATABASE_URL / JWT_SECRET for your environment
```

You need a Postgres database reachable at `DATABASE_URL`. Locally, e.g.:

```bash
docker run --rm -d --name goalnexa-pg \
  -e POSTGRES_USER=goalnexa -e POSTGRES_PASSWORD=goalnexa -e POSTGRES_DB=goalnexa \
  -p 5432:5432 postgres:16
```

## Environment variables

See `.env.example`. These are exactly what `apps/platform-core/backend/app/core/config.py`'s `Settings` class reads — there's no GoalNexa-specific settings module.

| Variable | Default | Notes |
| --- | --- | --- |
| `ENV` | `dev` | `dev` disables the `Secure` flag on the refresh cookie |
| `DATABASE_URL` | — | `postgresql+asyncpg://...` |
| `JWT_SECRET` | — | HS256 signing secret for access tokens |
| `JWT_ACCESS_TTL_MINUTES` | `15` | float minutes |
| `JWT_REFRESH_TTL_DAYS` | `30` | absolute refresh-token lifetime |
| `APP_BASE_URL` | `http://localhost:30566` | used to build invite links — points at the frontend's public URL, not the backend |

CORS isn't configurable: platform-core's `main.py` hardcodes a permissive policy, which is fine because nginx (`../nginx/default.conf`) makes the frontend and API same-origin from the browser's perspective.

## Run migrations

**Two separate migration chains, run in this order** — platform-core's own, then this project's:

```bash
(cd ../apps/platform-core/backend && ../../backend/.venv/bin/alembic upgrade head)   # organization, user, rbac, project, ...
.venv/bin/alembic upgrade head                                                  # goal, + its RBAC grants
```

GoalNexa's own chain (`alembic/`) uses a separate `version_table` (`goalnexa_alembic_version`) so the two chains coexist in the same database without colliding — it only ever creates the `goal` table and grants its permissions to platform-core's already-seeded system roles (`org_admin`, `member`); it never touches platform-core's own migration history or tables directly (other than inserting `Permission`/`RolePermission` rows, which is data, not schema).

## Run the server

```bash
.venv/bin/uvicorn goalnexa_ext.asgi:app --reload
```

`goalnexa_ext/asgi.py` is the real entrypoint — not platform-core's own `app.main:app` directly. It imports that (already fully wired: CORS, the two global exception handlers, auth/org/RBAC/agents/roles routes), mounts `goalnexa_ext`'s own `Goal` routes onto the same `FastAPI` instance, and calls `register_entity_config()` so `GET /entities/goals/schema` — and therefore the generic admin frontend — knows about it.

Then `POST /api/v1/auth/signup` once (bootstrap-only — creates the first `User` + `Organization` + `org_admin` role assignment, and returns `409 signup_closed` on every call after the first). From then on, further orgs come from an authenticated `POST /api/v1/orgs`, and further members come from the invite flow (`POST /api/v1/orgs/{org_id}/members/invite` → `POST /api/v1/invites/{token}/accept`).

## Tests

```bash
.venv/bin/pytest tests/unit -v
```

Covers `GOAL_CONFIG`'s own shape (resource/scope/resolver/permission-action wiring, badge-color coverage) — no DB needed. The real end-to-end behavior (signup → RBAC grant → schema derivation → Goal CRUD through the actual HTTP routes) was verified manually against a live Postgres during development (see the root README's "Verified end-to-end" section for exactly what was exercised) rather than as an automated integration suite, since platform-core itself ships no test infrastructure to build one on yet.

## API surface

Everything under `/api/v1/*` except `/health` (unprefixed) comes from platform-core — auth, orgs, org memberships, roles, permissions, role assignments, agents. This project adds:

- Goals (generic CRUD factory): `GET/POST /api/v1/goals`, `GET/PATCH/DELETE /api/v1/goals/{id}`.

Every error response is `{"code": str, "message": str, "field_errors": dict | null}` — platform-core's `app/main.py`'s two global exception handlers make this hold everywhere, including this project's own routes (built with the same `crud_factory`).

## Adding a new CRUD entity

Follow `goalnexa_ext/{models,schemas,routes}/goal.py` as the template:

1. SQLAlchemy model under `goalnexa_ext/models/`, importing `Base`/column helpers from `app.db.base` (platform-core, resolved via the editable install above).
2. Pydantic `*Create`/`*Update`/`*Summary` schemas under `goalnexa_ext/schemas/`.
3. A `CrudEntityConfig` + `make_crud_router()` call in `goalnexa_ext/routes/<entity>.py`, importing from `app.api.crud_factory` (platform-core).
4. Two lines in `goalnexa_ext/asgi.py`: `app.include_router(...)` and `register_entity_config(...)`.
5. A migration in this project's own `alembic/versions/` creating the table, plus a second one seeding its permissions and granting them to whichever system role(s) should hold them (same idempotent existence-check-then-insert shape as `0002_seed_goal_permissions.py`) — see that file's own comments for exactly why this can be pure data (no platform-core edit needed).
6. On the frontend: one `registerOrgScopedEntity({key, label})` call in `main.tsx`. Nothing else — the admin list/form/detail pages are fully generic.
