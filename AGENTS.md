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
See `apps/platform-auth/frontend/src/index.ts` (exports `LoginScreen`/
`SignupScreen` + `BASE_PATH`/`LOGIN_PATH`/`SIGNUP_PATH`) and
`apps/main/frontend/app/routes.ts`/`routes/login.tsx`/`routes/signup.tsx`
— main nests both under `BASE_PATH` ("auth"), giving `/auth/login` and
`/auth/signup`; that nesting choice is the host's, the package only
names its own bare segments.

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

**`platform-org-frontend` is the one deliberate exception to "no
react-router dependency of its own"**: at the host's explicit request,
its `routes/orgs.tsx`/`orgs-new.tsx`/`orgs-edit.tsx` are real
react-router route modules (not just screens) - `apps/main`'s `routes.ts`
still registers the actual URL and still owns nesting, it just points
`route()`'s `file` argument at a path INSIDE `platform-org-frontend`
instead of a local file:
```ts
route(ORGS_PATH, "../../../platform-org/frontend/src/routes/orgs.tsx"),
```
Two things this costs, worth knowing before repeating the pattern
elsewhere:
- **A relative filesystem path, not a package import.** `route()`
  resolves `file` with a plain `readFileSync` relative to the host's
  `appDirectory` ("app/"), not real module resolution - a bare
  specifier like `"platform-org-frontend/routes/orgs"` just gets
  literally appended to `app/` and 404s (confirmed the hard way). A
  package's `exports` map is irrelevant here.
- **`react-router` itself joins the React-singleton list.** Once a
  module's OWN files import `useOutletContext`/etc. directly, the same
  duplicate-copy risk above applies to `react-router`, not just
  `react`/`react-dom` - `apps/main/frontend/vite.config.ts`'s `dedupe`
  includes `"react-router"` for exactly this, and the module's own
  `package.json` pins the SAME `react-router` version as `apps/main`
  (both `^8.4.0` today). Since different modules' own standalone deploys
  can genuinely sit on different react-router majors (main is on v8,
  platform-auth's own standalone app is on v7, per above), this is a
  real version-drift risk to watch, not just a doubled-instance one -
  verified end-to-end with a real browser (signup → list → create →
  edit) specifically because a context-passing bug here fails silently
  past `tsc`/`vite build` and would only surface at runtime.

Tabler is loaded once, at the host level (`apps/main/frontend/app/root.tsx`'s
`links` function) — a screen package's own `index.html` (which has its
own Tabler `<link>` for standalone dev) isn't used when the package is
imported, since only its component code gets pulled in, not its HTML
shell. Don't load a design system from inside a screen package; that's
the host's job. (Tailwind was removed from `apps/main` — its preflight
reset conflicts with Tabler's own button/input/card styles.)

**Sharing auth state across modules' screens**: `platform-auth-frontend`'s
`LoginScreen`/`SignupScreen` `onSuccess` callback returns a `Session`
(`{accessToken, user}`) — `apps/main` captures this into its own
module-singleton store (`app/lib/session.ts`) and passes the token down
to any OTHER module's screen that needs to make its own authenticated
calls (e.g. `platform-org-frontend`'s `OrgsScreen` takes `accessToken` as
a plain prop — it owns no auth state of its own, since it's a pure
consumer of a session platform-auth created).

**Persisting login across a real reload**: the singleton above resets on
every fresh page load, same as `platform-auth-frontend`'s own in-memory
token store — what makes it survive anyway is `root.tsx`'s boot effect
calling `platform-auth-frontend`'s exported `refreshSession()` on every
mount, exchanging the httpOnly refresh cookie (which DOES survive a
reload) for a new access token. A protected route (`orgs.tsx`) tracks a
separate `isSessionInitialized()` flag and must wait for it before
deciding "no session → redirect to login" — checking `accessToken ===
null` alone would redirect on every fresh load, before the boot refresh
even had a chance to run. `refreshSession()` itself dedupes concurrent
calls (see `platform-auth`'s own AGENTS.md) — React StrictMode
double-invokes effects in dev, and the backend's refresh token is
single-use/rotating, so two naive concurrent calls would race and one
would spuriously 401.

Navigating between pages that read the session store still works fine
either client-side (`<Link>`/`navigate()`, session survives) or via a
full navigation (`page.goto`-style, session resets but the boot refresh
restores it) — both are exercised in this feature's own verification,
worth re-checking if you touch either.

**App shell (sidemenu + sticky header)**: `platform-core`'s
`AppShell` wraps post-login screens only — `apps/main`'s `routes.ts` puts
it behind `layout("routes/app-shell.tsx", [...])` around routes like
`orgs.tsx`, while the public landing page (`home.tsx`) and login/signup
stay outside it, unwrapped. `app-shell.tsx` is where main plugs in the
pieces `AppShell` deliberately doesn't own: a `linkComponent` wrapping
react-router's own `Link` (same "no router dependency inside the package"
convention as the screens), the `navItems` list (spans routes from
multiple modules — `ORGS_PATH` from `platform-org-frontend`, `/` for
home — so it can't live inside any one module's package), and the
session read for the header's user/logout display. "Log out" there only
clears main's local session singleton — there's no backend `/logout`
endpoint yet, so the refresh cookie is still valid and a full reload
after logging out silently logs back in; fine for now, revisit once a
real logout endpoint exists.

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

**A module with no User table of its own** (e.g. `platform-org` —
multi-tenant orgs shouldn't own auth) still needs to know "who" is
calling: it authenticates via a JWT bearer token against a *shared*
`JWT_SECRET`, resolving to a lightweight actor stub exposing only `.id`
(see `platform-org/backend/platform_org/authentication.py`) — no
cross-module DB access, no Python import of another module's models.
When such a module is imported into a host that ALSO has an app with a
real User model (`apps/main` has both `platform_auth` and
`platform_org`), the host's own `DEFAULT_AUTHENTICATION_CLASSES` (set to
`platform_auth`'s) resolves `request.user` to a real `User` instance
instead, and the imported module's own authentication class goes
unused — its views only ever read `request.user.id`, so which one
resolved it is invisible to them. **Two gotchas this pattern hit
already, worth checking for again:**
- Any object DRF might put on `request.user` needs an `is_authenticated`
  attribute (DRF's built-in `IsAuthenticated` permission class checks it
  directly) — a hand-rolled actor stub needs it declared explicitly
  (fixed `True`), and so does a real model like `platform_auth.User`
  that was never designed with DRF's permission classes in mind (see
  `platform-auth/AGENTS.md`'s own note on this).
- A view relying on DRF's `IsAuthenticated` permission class should
  declare `permission_classes = [IsAuthenticated]` on itself, not rely
  on the process's `DEFAULT_PERMISSION_CLASSES` — the host may set that
  to something else (or nothing) for its own reasons (`apps/main` can't
  default every view to `IsAuthenticated` globally, since
  `platform_auth`'s login/signup must stay public).

**Generic CRUD entities: subclass `core_api.serializers.BaseSerializer`/
`core_api.viewsets.BaseViewSet` from `platform-core`**, not plain DRF
`ModelSerializer`/`ModelViewSet` — see platform-core's own AGENTS.md for
what they add (dynamic-rest-inspired: `?include[]=`/`?exclude[]=` field
selection, relation sideloading via `DynamicRelationField`, `?filter{field}
=value` filtering, all on top of this platform's own `?sort=`/`?q=` and
`{items,total,page,page_size}` pagination envelope). `platform-org`'s
`OrganizationViewSet`/`OrganizationSerializer` are the reference
implementation. This makes `platform-core` a real backend dependency of
any module with generic CRUD entities, not just something "kept for
reference" — see its repo-layout row below.

**Every process (including `apps/main` itself) needs its OWN
`REST_FRAMEWORK["EXCEPTION_HANDLER"]` pointed at
`"core_api.exceptions.platform_exception_handler"`.** Each module's own
`settings.py` already has this right (for ITS standalone deployment), but
a host importing the module has a completely separate `settings.py` that
doesn't inherit it — `apps/main/backend/config/settings.py` had a stale
copy-pasted value pointing at a module-specific handler name that no
longer existed, and every error response 500'd on an `ImportError`
*inside DRF's own exception handling* instead of returning the error it
was trying to report. Grep every `settings.py` in the platform for
`EXCEPTION_HANDLER` if you ever rename that function.

## Repo layout

| Path | What |
|---|---|
| `apps/main/` | The host app. `backend/` — Django+DRF, imports `platform_auth` as a pip package (see above); otherwise still empty (no models/apps of its own yet). `frontend/` — `create-react-router` scaffold; owns all routing, imports module packages for screens, loads Tabler. Plain directory, not a submodule. |
| `apps/platform-auth/` | git submodule. Django+DRF backend (standalone, own Postgres, own `pyproject.toml` packaging its Django app for reuse) + a frontend package (own `package.json`/`exports`). Both halves are also consumed by `apps/main` — see above. Own repo, own AGENTS.md. |
| `apps/platform-org/` | git submodule. Multi-tenant `Organization`/`OrgMembership`, same packaged-both-halves pattern as `platform-auth`. No User table of its own — see the "module with no User table" note above. No roles/permissions yet (deliberate follow-up, likely a `platform-rbac` module). Own repo, own AGENTS.md. |
| `apps/platform-core/` | git submodule. Django+DRF kernel (no models) — `core_api`: error contract, pagination, filters, uuid7 utils, and `BaseSerializer`/`BaseViewSet` (dynamic fields + relation sideloading, inspired by dynamic-rest — see "Generic CRUD entities" below). **A real backend dependency of `platform-auth` and `platform-org`** (both used to vendor their own copy of the small stuff; that stopped scaling once `BaseSerializer`/`BaseViewSet` existed) — editable-installed into `apps/main`'s venv alongside them. Its `frontend/` doubles as two things: its own (still-unused) Module Federation shell, not part of the default `docker-compose.yml`, and — as the `platform-core` npm package (`src/index.ts` exporting `AppShell`) — the former `platform-ui` module's sidemenu/sticky-header shell, folded in here since it had no backend of its own to justify a separate repo. See the "App shell" note above. Own repo, own AGENTS.md. |
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
