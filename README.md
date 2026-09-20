# GoalNexa

Self-hosted goal/habit/OKR tracker (personal + team use). See `docs/product-discovery/` for the market research behind the idea.

This repo is a pure **apps/ container**: it has no backend or frontend of its own. Every capability (auth, orgs, RBAC, the design system, and eventually the product features themselves) lives in its own repo, consumed here as a git submodule under `apps/`. `modules.yaml` at the repo root lists which modules this platform composes, and each submodule under `apps/` runs and is developed independently (see that module's own README/AGENTS.md).

See `docs/architecture/microservices-design.md` for the target-state module system this is heading toward.

## Cloning this repo

Submodules aren't fetched by a plain `git clone`:

```
git clone --recurse-submodules <this-repo-url>
# or, if already cloned:
git submodule update --init
```

## Modules

| Module | Kind | Path | Repo |
|---|---|---|---|
| platform-core | kernel | `apps/platform-core` | [EugeneNguyen/platform-core](https://github.com/EugeneNguyen/platform-core) |
| platform-auth | module | `apps/platform-auth` | [EugeneNguyen/platform-auth](https://github.com/EugeneNguyen/platform-auth) |

See `modules.yaml` for the machine-readable version of this list.
`platform-core` reads it (as `GET /modules`) when started with
`MODULES_MANIFEST_PATH=<path to this repo's modules.yaml>` — see its own
README for the full env var.

## Running the whole platform

```
docker compose up --build
```

Brings up every module's backend + frontend together (currently
platform-auth + platform-core), wired via `modules.yaml`. No single
external entrypoint yet (see the architecture doc — a real gateway is
future work), so each service is exposed on its own host port:

| Service | URL |
|---|---|
| platform-core frontend | http://localhost:5174 |
| platform-core backend | http://localhost:8000 |
| platform-auth frontend | http://localhost:5173 |
| platform-auth backend | http://localhost:8001 |
| Postgres (platform-auth's) | localhost:5432 |

platform-core's frontend fetches `GET /modules` and, for a module with a
`frontend_url`, hands the browser off to it (a full page navigation, not
module federation) — visit http://localhost:5174 and follow the link to
platform-auth to see this in action.

## Running a single module

Each module has its own backend/frontend and its own setup instructions — see that module's own README.
