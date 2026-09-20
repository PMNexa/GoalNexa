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
`platform-core` reads it (as `GET /api/modules`) when started with
`MODULES_MANIFEST_PATH=<path to this repo's modules.yaml>` — see its own
README for the full env var. Each module declares a `url_prefix` — the
path it's mounted at behind the single-port gateway below.

## Running the whole platform

```
docker compose up --build
```

Single external entrypoint: **http://localhost:41830** (nginx — see
`nginx/default.conf`). Every module's backend is reachable at `/api` on
this same port (`platform-core` at `/api/...`, `platform-auth` at
`/platform-auth/api/...` — its own `url_prefix`); every module's frontend
is reachable at its `url_prefix` (platform-auth: `/platform-auth`,
platform-core: `/`, the root).

- App shell: http://localhost:41830
- platform-auth: http://localhost:41830/platform-auth
- Postgres (platform-auth's): localhost:5432

platform-core's frontend fetches `GET /api/modules` and lists each
module's `url_prefix` as a plain link — visit http://localhost:41830 and
follow it to platform-auth to see this in action. There's no client-side
cross-module routing; the gateway (nginx) is what actually routes each
prefix to that module's own containers.

## Running a single module

Each module has its own backend/frontend and its own setup instructions — see that module's own README.
