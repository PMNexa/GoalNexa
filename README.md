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

## Running a module

Each module has its own backend/frontend and its own setup instructions — see that module's own README. There is no root-level `docker compose up` for the whole platform yet; that's follow-up work once there's an actual gateway composing these modules together (see the architecture doc).
