# GoalNexa

Self-hosted goal/habit/OKR tracker (personal + team use). See `docs/product-discovery/` for the market research behind the idea.

This is an early scaffold: authentication, RBAC, organizations, a design system, and one working example CRUD entity (`Goal`). The architecture patterns (JWT + rotating refresh tokens, permission-code RBAC, org multi-tenancy, a generic entity-CRUD engine on both ends) are a simplified port of patterns proven out in a sibling reference project — simplified by dropping multi-level (org+project) tenancy, an AI-agent actor type, and backend-driven schema generation, none of which GoalNexa needs yet.

## Stack

- **Backend** (`backend/`): FastAPI + SQLAlchemy 2.0 (async) + PostgreSQL + Alembic + JWT/argon2. See `backend/README.md`.
- **Frontend** (`frontend/`): React 18 + Vite + TypeScript, TanStack Query, react-hook-form + zod, Bootstrap 5 + AdminLTE. See `frontend/README.md`.

## Quickstart

```
docker compose up --build
```

Single external entrypoint, per the reference project's single-port topology: nginx listens on **http://localhost:30566** and routes `/api/*` to the backend (prefix stripped) and everything else — including Vite's HMR websocket — to the frontend dev server. The backend and frontend containers have no host port of their own; only nginx is exposed.

- App: http://localhost:30566 (hot-reloads on `frontend/src` changes)
- API: http://localhost:30566/api/* (backend runs migrations on boot, hot-reloads on `backend/app` changes)
- Postgres: localhost:5432 (user/pass/db: `goalnexa`)

First run: open http://localhost:30566/signup — signup is bootstrap-only (the first signup creates the first organization and becomes its admin; every signup after that returns `409 signup_closed`, by design for a self-hosted single-tenant-per-instance deploy). Invite additional users from the org's Members page.

## Adding a new entity

Follow the `Goal` entity as the template on both sides:

- Backend: `backend/app/models/goal.py`, `backend/app/schemas/goal.py`, `backend/app/api/routes/goals.py` (wires a `CrudEntityConfig` into `make_crud_router()`), plus an Alembic migration and — if it needs new permissions — an entry in `backend/app/db/rbac_seed_catalog.py` with a backfill migration.
- Frontend: `frontend/src/entityConfigs/goal.ts` (a static `EntityConfig`), registered in `frontend/src/entityConfigs/index.ts`. The list/form/detail pages and routes are fully generic — no new page code needed.

## Verified end-to-end

Backend: 17 unit tests + 8 integration tests (auth flow incl. refresh rotation, RBAC 404-before-403 tenant boundary, full `Goal` CRUD roundtrip) passing against a real Postgres. Frontend: typecheck, production build, and component tests passing.
