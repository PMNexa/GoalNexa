# AGENTS.md

Guidance for AI agents (and humans) working in this repo. GoalNexa is a
self-hosted goal/habit/OKR tracker (personal + team use) — see
`docs/product-discovery/` for the market research behind the idea and
`docs/architecture/microservices-design.md` for where this is headed
(that doc predates the current approach below in some details — this
file is the source of truth for what's actually running).

## Current architecture: apps/main is the host app

`apps/main/` is the running application — a plain directory in this repo
(not a submodule), Django+DRF backend + `create-react-router` frontend.
`docker-compose.yml` starts only this (`main-backend` + `main-frontend`).

**Frontend rule: apps provide router/screen, packaged as an npm package;
`main` calls on it.** A module's frontend is an npm package (a local
`file:` dependency for now, e.g. `platform-auth-frontend`) exporting
plain, self-contained screen components — no bundled routing, no
assumptions about where it's mounted. `apps/main`'s own `routes.ts` owns
every actual path/URL; a route file there imports a package's screen and
wires it into that path. See `apps/platform-auth/frontend/src/index.ts`
(exports `LoginScreen` + `LOGIN_PATH`) and
`apps/main/frontend/app/routes/login.tsx` for the concrete example.

Why a screen must have **no `react-router` dependency of its own**: a
consuming app may be on a completely different `react-router` major
version (main is on v8, platform-auth's own standalone app is on v7) or
just a separate module instance of the same one — either way calling a
hook like `useNavigate()` inside the screen would throw. Anything
routing-dependent (redirect after success, etc.) is passed in as a prop
instead (see `Login`'s `onSuccess` prop).

**The React-singleton trap (this WILL bite you again):** a local `file:`
package ships its own `node_modules` with its own React copy. Vite's
`resolve.dedupe` only fixes the CLIENT bundle graph — React Router
framework mode also does SSR, which by default externalizes node_modules
packages to plain Node `require()`, which resolves the symlinked package
to its REAL path and walks up THAT directory's ancestry for `react`,
never finding the host's copy (siblings under `apps/` share no real
ancestor). You need **both**:
```ts
resolve: { dedupe: ["react", "react-dom"] },
ssr: { noExternal: ["<package-name>", /* + any of its deps that touch react hooks */] },
```
Getting only the first one produces a genuinely confusing "Invalid hook
call" error from *inside* the package's own code, not obviously pointing
at the real cause. See `apps/main/frontend/vite.config.ts`.

## Repo layout

| Path | What |
|---|---|
| `apps/main/` | The host app. `backend/` — empty Django+DRF project (no models/apps yet). `frontend/` — `create-react-router` scaffold; owns all routing, imports module packages for screens. Plain directory, not a submodule. |
| `apps/platform-auth/` | git submodule. Django+DRF backend (standalone, own Postgres). `frontend/` is now consumed as a package by `apps/main` (see above) — its own standalone dev server/routes still work too. Own repo, own AGENTS.md. |
| `apps/platform-core/` | git submodule. Django+DRF kernel (no models) + a Module Federation shell frontend — this was the previous composition approach (runtime remote loading across separately-deployed apps), now superseded by the package-import rule above for the active `apps/main` host. Not part of the default `docker-compose.yml` anymore; kept for reference/possible future use, not actively developed against. |
| `modules.yaml`, `nginx/` | Leftover from the platform-core/platform-auth multi-port gateway approach. Not read by anything in the current `docker-compose.yml`. |
| `docs/architecture/` | Target-state design docs (microservices/module system) — written before the current package-import approach; treat as historical context, not a spec to follow literally. |
| `docs/product-discovery/` | Market/customer research, not implementation-relevant. |

## Adding a new module's screen to main

1. Build it as a package (own `frontend/`, own `package.json` with a
   `name` and an `exports` field pointing at source — no build step
   needed, Vite processes the TS/TSX directly).
2. Export self-contained screen components (bundle their own
   providers/context, zero `react-router` dependency, routing-dependent
   behavior via props).
3. In `apps/main/frontend/package.json`, add it as
   `"<name>": "file:../../<module>/frontend"`, then `npm install`.
4. Add it to `resolve.dedupe`'s targets implicitly (dedupe list is by
   package name, not per-dependency — `react`/`react-dom` already
   covers every package) and to `ssr.noExternal` (the package itself,
   plus any of ITS OWN dependencies that call React hooks — check for
   "Invalid hook call" pointing into `node_modules/<other-package>` if
   you missed one).
5. Add a route file under `apps/main/frontend/app/routes/` that imports
   the screen and registers it in `routes.ts`.

## History note

GoalNexa previously had its own root `backend/`/`frontend/` (a `Goal`
entity mounted onto platform-core "in place"), then a platform-core/
platform-auth multi-port setup composed via nginx + Module Federation —
both deliberately superseded by the current `apps/main` + package-import
approach above. Old code/docs from those phases are in git history or
left in place for reference (see the platform-core/platform-auth row
above); don't extend them as if they were still the active pattern.
