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
`SignupScreen`) and `apps/main/frontend/app/routes.ts`/`routes/login.tsx`/
`routes/signup.tsx` — main registers both as plain literals
(`route("auth/login", ...)`/`route("auth/signup", ...)`), giving
`/auth/login` and `/auth/signup`.

**A module does NOT export its own URL path as a constant just because
a host happens to use it** — `BASE_PATH`/`LOGIN_PATH`/`SIGNUP_PATH`
(platform-auth), `GOALS_PATH`/`METRICS_PATH`/`CHECK_INS_PATH` (goalnexa),
`ORGS_PATH` (platform-org) all used to exist and got removed: `apps/main`
is the ONLY host, it already owns every actual URL by calling
`createCrudRoutes`/`createOrgsRoutes` itself, and a link that never
varies gains nothing from a computed "suggested path" import over a
plain string literal at its one or two use sites (`app-shell.tsx`'s
`NAV_ITEMS`, `home.tsx`'s quick link) - it's one more file/import to
trace for zero actual flexibility. The bar for a module exporting a path
constant: does ANY consumer actually need to know it varies (e.g. it's
parameterized, like `createOrgsRoutes(basePath)`'s own `basePath` arg -
see below)? If not, hardcode it at the call site instead. A module's own
INTERNAL navigation (e.g. `goals-edit.tsx`'s own "go back to list" after
save) still reads its own `lib/goalsPaths.ts` directly via a relative
import - that's a different case: the SAME FILE needs the SAME value in
two places (the route's own registration and its post-save redirect), so
a shared internal constant avoids drift there. The dead giveaway a path
export is unnecessary: grep every consumer before adding or keeping one
- if the only "consumer" is a template string built once at one import
site, that's a literal wearing an import as a costume.

**When a computed value looks "stuck" at an old string after a rebuild,
don't assume dev-server/Vite caching before checking for a SEPARATE
hardcoded literal.** Burned an hour on exactly this: after nesting orgs
under `platform-org/`, one nav link kept showing the OLD unprefixed
`/orgs` even after a from-scratch container rebuild (fresh volume, fresh
`npm install`, fresh Vite dep-optimize cache) - every plausible caching
layer got ruled out one at a time (raw `/@fs/` fetch, an in-page dynamic
`import()`, the compiled production bundle - all showed the CORRECT
value) before it turned out `home.tsx` had its own, completely separate
`<Link to="/orgs">` hardcoded on the landing page, unrelated to the
`ORGS_PATH` computation being investigated the whole time. The tells,
in hindsight: (1) the production build's OWN output was already
correct, which a genuine caching bug can't explain since a prod build
starts from scratch every time; (2) network-request tracing (list every
request the page actually makes) showed the "broken" component's module
was never even fetched, meaning the DOM node under inspection wasn't
being rendered by the code being read at all. Both are faster and more
conclusive than clearing another cache layer - reach for them second,
not fifth.

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

**A generic CRUD resource (any `BaseViewSet`-backed one) needs ZERO
route files in its own domain module - route modules live in
`platform-core` now, shared by every resource.** This wasn't the design
from the start; it's where two earlier, reverted attempts led (worth
knowing before re-trying either):
1. First, each domain module (`platform-org-frontend`, `goalnexa-frontend`)
   owned its OWN `routes/orgs.tsx`/`orgs-new.tsx`/`orgs-edit.tsx` (etc) -
   the historical "one deliberate exception to no react-router dependency"
   - with `apps/main/routes.ts` hand-writing three `route()` calls per
   resource pointing at them.
2. Then those per-module route files got collapsed into a per-module
   `./routes` package.json subpath (`platform-org-frontend/routes`
   exporting a pre-built `orgRoutes` array) - worked, but was reverted for
   being more machinery than it was worth.
3. **Then it became clear there was no reason for PER-RESOURCE route
   files at all**: `CrudListScreen`/`CrudCreateScreen`/`CrudEditScreen`
   (platform-core) are fully schema-driven now (see platform-core's own
   AGENTS.md's CrudRouter section) - there's no remaining UI difference
   between one resource's route file and another's, so `platform-core`
   itself now ships THREE GENERIC route files
   (`crud-list.tsx`/`crud-new.tsx`/`crud-edit.tsx`) that every resource
   shares, deriving which resource they're rendering from the URL's own
   path segment at render time. `platform-org-frontend`/`goalnexa-frontend`
   have gone back to owning zero route files and zero `react-router`
   dependency - back to this section's own DEFAULT rule, not an exception
   to it anymore.

**How a resource actually gets registered today** - `platform-core`'s
`createCrudRoutes` (its own `"./routes"` `exports` subpath - `import {
createCrudRoutes } from "platform-core/routes"`), one call per resource,
taking only that resource's own backend base URL:
```ts
// apps/main/frontend/app/routes.ts
import { createCrudRoutes } from "platform-core/routes";
...
layout("routes/app-shell.tsx", [
  ...createCrudRoutes("/api/v1/goals", { editFile: GOALS_EDIT_ROUTE_FILE }),
  ...createCrudRoutes("/api/v1/check-ins"),
]),
```
No file paths, no `CrudPaths` object, no per-module import at all -
`createCrudRoutes` derives the resource name from the URL's own last
`/`-segment, `prefix()`-nests its list/create/edit routes under it (not
`route()` + children - that needs a wrapping layout element with its own
`<Outlet/>`, which none of the three share or need), and points every
registration at its OWN `src/routes/` files (`import.meta.url`-derived,
self-referential - never a relative string baking in the CALLER's
directory depth) by default. Two escape hatches worth knowing:
- **A resource whose edit page needs more than the plain schema-driven
  form** (e.g. goalnexa's `GoalsEditScreen` adds a goal's own
  `GoalMetricsSection` inline) gets `createCrudRoutes`'s `editFile`
  option - an ABSOLUTE path (same `import.meta.url` rule) to a
  HOST-OWNED route file that replaces JUST the generic `crud-edit.tsx`
  for that one resource; list/create stay generic. The domain module
  exposes that absolute path via its OWN `"./routeFiles"` Node-only
  subpath (see `goalnexa-frontend/src/routeFiles.ts`) rather than the
  host hardcoding a relative filesystem path across package boundaries.
- **A resource whose whole URL structure needs to be host-decided at a
  level ABOVE the plain `createCrudRoutes(apiPath)` call** (e.g.
  `platform-org`'s `orgs`, deliberately nested at `platform-org/orgs`
  instead of the bare `orgs` every other resource gets) - the domain
  module exposes its OWN parameterized route builder instead
  (`createOrgsRoutes(basePath: string)`, `platform-org-frontend`'s own
  `"./routes"` subpath), which wraps `createCrudRoutes` in its own
  `prefix(basePath, ...)`. The HOST still decides the actual mount
  string (`createOrgsRoutes("platform-org")` in `apps/main`'s own
  `routes.ts`) - the module only owns BUILDING the route list, never the
  URL choice itself. Don't reach for this by default; a resource that's
  happy at its bare name (nearly all of them) just calls
  `createCrudRoutes` directly, no module-owned wrapper needed.

See platform-core's own AGENTS.md for the full mechanics (the
`id`-collision gotcha, why this is the one place in the whole platform
allowed to import `@react-router/dev/routes` from a CLIENT-bundled
package's OWN `"."` entry without doing so, and the cookbook for adding
a brand-new resource's UI end-to-end).

Two things worth knowing regardless, if a resource ever DOES need a
route module of its own again (custom UI a generic screen can't do -
see platform-core's own cookbook for when to reach for this instead of
composing a custom screen around `XRouter.Edit`):
- **A relative filesystem path, not a package import.** `route()`
  resolves a relative `file` with a plain `readFileSync` relative to the
  host's `appDirectory` ("app/"), not real module resolution - a bare
  specifier like `"platform-org-frontend/routes/orgs"` just gets
  literally appended to `app/` and 404s (confirmed the hard way). A
  package's `exports` map is irrelevant here - an ABSOLUTE path (see
  `import.meta.url`, above) is what actually sidesteps this.
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
calls (e.g. `platform-core`'s `CrudListScreen`/`CrudCreateScreen`/
`CrudEditScreen` take `accessToken` as a plain prop, via
`<Outlet context={accessToken}>` in `app-shell.tsx` — none of them own
auth state of their own, since they're a pure consumer of a session
platform-auth created).

**Persisting login across a real reload**: the singleton above resets on
every fresh page load, same as `platform-auth-frontend`'s own in-memory
token store — what makes it survive anyway is `root.tsx`'s boot effect
calling `platform-auth-frontend`'s exported `refreshSession()` on every
mount, exchanging the httpOnly refresh cookie (which DOES survive a
reload) for a new access token. `app-shell.tsx`'s own
`useRequireAccessToken` (the ONE place every route nested under the
layout gets gated - see below) tracks a separate `isSessionInitialized()`
flag and must wait for it before deciding "no session → redirect to
login" — checking `accessToken === null` alone would redirect on every
fresh load, before the boot refresh even had a chance to run.
`refreshSession()` itself dedupes concurrent
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
it behind `layout("routes/app-shell.tsx", [...])` around every generic
CRUD resource's routes, while the public landing page (`home.tsx`) and
login/signup stay outside it, unwrapped. `app-shell.tsx` is where main
plugs in the pieces `AppShell` deliberately doesn't own: a
`linkComponent` wrapping react-router's own `Link` (same "no router
dependency inside the package" convention as the screens), the
`navItems` list (spans routes from multiple modules, each a plain
string literal - `/goals`, `/platform-org/orgs`, `/` for home - not a
computed path import; see this section's own note above on why - so it
can't live inside any one module's package anyway), and the session
read for the header's user/logout display. "Log out" there only
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
   the screen and registers it in `routes.ts`. (This is for ONE plain
   screen, e.g. login/signup. A `BaseViewSet`-backed CRUD resource -
   list/create/edit, like orgs/goals/metrics/check-ins - needs NO route
   file at all: `platform-core`'s generic route files + `createCrudRoutes`
   handle it in one line; see "A generic CRUD resource..." above and
   platform-core's own AGENTS.md for the full cookbook.)

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
