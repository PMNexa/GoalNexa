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
`docker-compose.yml` runs it behind a single nginx port (see
`nginx/default.conf`): `/api/*` and `/admin/*` → backend, everything else
→ frontend.

**The rule, frontend and backend both: a module provides its
router/screen or its Django app, packaged; `main` imports it.** Nothing
is copied. See `apps/platform-auth/` for the reference implementation of
both halves.

### Frontend half

A module's frontend is an npm package (a local `file:` dependency for
now, e.g. `platform-auth-frontend`) exporting plain, self-contained
screen components — no bundled routing, no assumptions about where it's
mounted. `apps/main`'s own `routes.ts` owns every actual path/URL; a
route file there imports a package's screen and wires it into that path.
See `apps/platform-auth/frontend/src/index.ts` (exports `LoginScreen` +
`LOGIN_PATH`) and `apps/main/frontend/app/routes/login.tsx`.

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

Tabler is loaded once, at the host level (`apps/main/frontend/app/root.tsx`'s
`links` function) — a screen package's own `index.html` (which has its
own Tabler `<link>` for standalone dev) isn't used when the package is
imported, since only its component code gets pulled in, not its HTML
shell. Don't load a design system from inside a screen package; that's
the host's job. (Tailwind was removed from `apps/main` — its preflight
reset conflicts with Tabler's own button/input/card styles.)

### Backend half

A module's backend Django app is a pip package too (packaged via that
module's own `pyproject.toml`, e.g. `apps/platform-auth/backend/pyproject.toml`
declares `platform_auth` + `core_api` as the importable units), editable-
installed into `apps/main/backend`'s own venv. `apps/main/backend/config/settings.py`
adds `"platform_auth"` to `INSTALLED_APPS`, and `config/urls.py` mounts
its `urls.py` at the exact same path prefix (`api/v1/auth/`) the module's
own standalone deployment uses — this keeps its internal cookie-path
logic (`settings.URL_PREFIX`) and the frontend package's already-
hardcoded fetch paths (e.g. `/api/v1/auth/login`) correct with zero
changes on either side.

`apps/main/backend`'s own `settings.py` must define every setting the
imported app reads via `django.conf.settings` (`JWT_SECRET`,
`REFRESH_COOKIE_NAME`, `URL_PREFIX`, ...) — these are read as hard
attribute access in the module's own code, not `getattr` with a
fallback, so a missing one is a runtime `AttributeError`, not a graceful
default. Copy the reference values from the module's own
`config/settings.py`, don't guess.

**nginx must forward the module's path prefix through unstripped** to
match what its `urls.py` actually registers — `apps/main`'s `/api/`
location uses `proxy_pass http://main-backend:8000;` (no trailing
path/slash) specifically so `/api/v1/auth/login` arrives at the backend
as `/api/v1/auth/login`, not stripped to `/v1/auth/login`. Getting this
wrong looks like a plain 404, not an obviously-nginx-shaped error.

## Repo layout

| Path | What |
|---|---|
| `apps/main/` | The host app. `backend/` — Django+DRF, imports `platform_auth` as a pip package (see above); otherwise still empty (no models/apps of its own yet). `frontend/` — `create-react-router` scaffold; owns all routing, imports module packages for screens, loads Tabler. Plain directory, not a submodule. |
| `apps/platform-auth/` | git submodule. Django+DRF backend (standalone, own Postgres, own `pyproject.toml` packaging its Django app for reuse) + a frontend package (own `package.json`/`exports`). Both halves are also consumed by `apps/main` — see above. Own repo, own AGENTS.md. |
| `apps/platform-core/` | git submodule. Django+DRF kernel (no models) + a Module Federation shell frontend — this was an earlier composition approach (runtime remote loading across separately-deployed apps), superseded by the package-import rule above for the active `apps/main` host. Not part of the default `docker-compose.yml`; kept for reference. |
| `modules.yaml` | Written for the platform-core/platform-auth Module Federation phase (module registry with `url_prefix`/`remote_entry`). Not read by anything in the current `docker-compose.yml` — `apps/main`'s own imports (file:/pip editable) replace what this was for. |
| `nginx/default.conf` | Actively used — the single-port gateway in front of `apps/main`'s backend+frontend (rewritten for this when reused; a previous version was written for the platform-core/platform-auth setup instead). |
| `docs/architecture/` | Target-state design docs (microservices/module system) — written before the current package-import approach; treat as historical context, not a spec to follow literally. |
| `docs/product-discovery/` | Market/customer research, not implementation-relevant. |

## Adding a new module's screen + login-like backend to main

Frontend:
1. Build it as a package (own `frontend/`, own `package.json` with a
   `name` and an `exports` field pointing at source — no build step
   needed, Vite processes the TS/TSX directly).
2. Export self-contained screen components (bundle their own
   providers/context, zero `react-router` dependency, routing-dependent
   behavior via props).
3. In `apps/main/frontend/package.json`, add it as
   `"<name>": "file:../../<module>/frontend"`, then `npm install`.
4. Add it to `ssr.noExternal` (the package itself, plus any of ITS OWN
   dependencies that call React hooks — check for "Invalid hook call"
   pointing into `node_modules/<other-package>` if you missed one).
   `resolve.dedupe` already covers every package by name.
5. Add a route file under `apps/main/frontend/app/routes/` that imports
   the screen and registers it in `routes.ts`.

Backend:
1. Add a `pyproject.toml` to the module's `backend/` declaring its
   Django app (and any support package it needs, e.g. `core_api`) as
   importable units (`[tool.setuptools.packages.find] include = [...]`).
2. In `apps/main/backend`'s own venv setup (see `docker-compose.yml`'s
   `main-backend` command), add `-e /apps/<module>/backend` to the pip
   install line — use the absolute `/apps/...` container path, a bare
   relative path is rejected by pip as "not a valid editable requirement".
3. Add the app to `apps/main/backend/config/settings.py`'s
   `INSTALLED_APPS`, copy over every setting its code reads via
   `django.conf.settings`, and mount its `urls.py` in `config/urls.py`
   at the same path prefix its own standalone deployment uses.
4. Add matching `location` block(s) to `nginx/default.conf` if the
   prefix needs special handling (unstripped forwarding, etc.).
5. `python manage.py migrate` in `apps/main/backend` to create the
   module's tables in main's own database.

## History note

GoalNexa previously had its own root `backend/`/`frontend/` (a `Goal`
entity mounted onto platform-core "in place"), then a platform-core/
platform-auth multi-port setup composed via nginx + Module Federation —
both deliberately superseded by the current `apps/main` + package-import
approach above. Old code/docs from those phases are in git history or
left in place for reference (see the platform-core/platform-auth row
above); don't extend them as if they were still the active pattern.
