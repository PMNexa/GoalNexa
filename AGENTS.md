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

**Config lives in `.env`** (gitignored; `.env.sample` lists every key).
`FRONTEND_MODE=production` makes `main-frontend` run `react-router
build` + `react-router-serve` instead of the Vite dev server - no hot
reload then, so set it to `dev` (and `docker compose up -d
main-frontend`) for UI work. **Public access** is the optional
`tailscale` service (`docker compose --profile tailscale up -d`,
`TS_AUTHKEY` in `.env`): Funnel serves `https://<TS_HOSTNAME>.<tailnet>.ts.net`
to anyone (`tailscale/serve.json`'s `AllowFunnel`). Since that's public,
`.env` must carry real `DJANGO_SECRET_KEY`/`JWT_SECRET` and
`DJANGO_DEBUG=false`; nginx forwards `X-Forwarded-Proto` so Django
builds `https://` URLs. After recreating `main-frontend`, restart nginx
too - it resolves the upstream IP once at startup.

**Production** is `docker-compose.prod.yml`: images built from
`apps/main/{backend,frontend}/Dockerfile` (repo-root build context, like
every module's Dockerfile; modules pip-installed non-editable, gunicorn
+ WhiteNoise, `react-router-serve`), Postgres, a one-off `migrate`
service that runs before the backend (never in the backend's own
command - replicas would race), and the same `nginx/default.conf`. The
database is `DATABASE_URL` (unset = SQLite, what the dev compose uses);
the prod compose requires `DJANGO_ALLOWED_HOSTS` and real secrets. The
server bundle inlines every module package (`ssr.noExternal`), so the
frontend image carries only main's own `node_modules`. `/static/` is
the admin's CSS/JS, served by the backend (dev runs `collectstatic`
too, since `.env` usually has `DJANGO_DEBUG=false`). Login/signup/setup
are rate limited (platform-auth's throttles; `AUTH_*_RATE` in `.env`),
counted in a `DatabaseCache` so every worker shares one count
(`createcachetable` runs with `migrate`), per client IP from
`X-Forwarded-For`: `TRUSTED_PROXY_COUNT` = proxies in front of Django
(1 = nginx; 2 behind Funnel/Cloudflare/a load balancer - the dev compose
defaults to 2 for Funnel). Too low and everyone shares one limit.

**The hosted deployment** (DigitalOcean) is Docker Swarm:
`docker-stack.yml` (the same services as the prod compose, from registry
images tagged with the commit, a managed Postgres - no `db` service -
rolling start-first updates that roll back on a failed healthcheck,
nginx as a global host-port service so the client IP survives). Only
`scripts/deploy.sh` deploys it - Swarm ignores `depends_on`, so the
script runs migrate with the new image first, then `stack deploy`, then
fails if a service rolled back. A migration must therefore work with the
previous release's code too. Releasing = merging a PR into the `deploy`
branch: `.github/workflows/deploy.yml` builds, pushes and runs the
script (setup and rollback in its header). Adding a node = `docker swarm
join` + more replicas; the stack needs no change.

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
`SignupScreen`).

**A module provides ONE centralized route builder, exported from its
main `"."` entry; main mounts it once.** `createAuthRoutes(basePath)`
(platform-auth), `createOrgsRoutes(basePath)` (platform-org) and
`createCrudRoutes(apiPath)` (platform-core) all follow this shape - no
`"./routes"` subpaths anymore. Main registers auth with one line,
`...createAuthRoutes("auth")`, giving `/auth/login` and `/auth/signup`:
main picks the mount, the module owns every page under it, including
what happens on success (platform-auth stores the session in its OWN
store and redirects to `?next=`, or `/`) - so main has no auth route
file at all. Main steers the destination by putting `?next=` on its
links (`useRequireAccessToken`'s redirect). A fresh install has no users: login/signup redirect to `/auth/setup`
(first-run onboarding, platform-auth's), which creates the first
account as Admin - roles and permissions are already seeded by
`migrate`. There is no landing page:
`/` (`routes/index.tsx`) redirects to `/dashboard`, so login's default
`/` target lands there too.

**Route builders ride in the CLIENT bundle** (a module's `"."` entry is
imported by client code too, e.g. `root.tsx`'s `initSession`,
`app-shell.tsx`'s `AppShell`), so they must be browser-safe: plain
route-config objects (no `@react-router/dev/routes` - Node-only tooling,
~16KB if bundled), no `node:*` imports, nothing computed at module load.
File paths come from `platform-core`'s `routeFilePath(import.meta.url,
rel)` (string ops, only run when a builder is called - which only
happens in Node, from main's `routes.ts`); never `new URL(rel,
import.meta.url)`, which Vite rewrites into an asset reference. They
tree-shake out of the client build since no client code calls them.
**The same `"."` entry is also loaded by react-router's route-config
loader** (main's `routes.ts` imports the builders from it), which runs a
minimal Vite with no CSS support - a `.css` import anywhere under a
module's `"."` entry fails typegen/dev/build with "Route config in
routes.ts is invalid ... Cannot read properties of undefined (reading
'get')". Ship component styles as a TS string rendered through React
19's `<style href="..." precedence="default">` instead (see
goalnexa-frontend's `screens/dashboard/dashboardStyles.ts`).

**Dashboard** (`/dashboard`, goalnexa-frontend's `DashboardScreen`,
mounted with `...createDashboardRoutes("dashboard")` inside the
app-shell layout): pick one org (or personal goals), pick up to 8 of its
goals, and see progress over time plus current progress (bars, one per
goal). Progress over time is PER METRIC, as small multiples: one card
per shown goal (titled with the goal + its %), one straight-segment line per shown
metric; the tooltip shows each metric's % AND its actual reading
("57,000 / 100,000"), and end labels sit past the plot edge with a
leader line (progress from base to target as a %,
replayed from check-ins, `computeMetricSeries`). All panels share one
time range (`fitDomain`) so they line up, but each fits its own %
ceiling (min 100%) - a goal at 800% would otherwise flatten one at 20%. That range also stretches to now and to every shown goal's
`target_date`; each panel draws a "Now" hairline and, if its goal has
one, a dashed "Target <date>" line (`markers` prop). A goal with a
target date also gets a linear PREDICTION (`lib/progress.ts`'s
`projectMetric`/`projectGoal`): each metric's least-squares slope over
its check-ins, carried forward from its latest reading to the target
date, drawn as a dashed segment ending in a hollow dot (hover shows it
as "projected"); the goal's is the mean of those, a metric with no trend
(< 2 check-ins) held at its current %, shown as "→ 62% by Oct 31" in
the panel header - not in the goal tree (tried, too busy). None once
the target date has passed. A single chart could need more lines than the palette has colors.
A metric's line color is its position among its goal's metrics (by
name), so it stays put when other metrics are hidden. A goal's 9th+
metric isn't charted: the palette has 8 slots, colors are never cycled,
and the panel notes how many were left out. The goal tree shows each
metric's color key, so it doubles as the panels' legend. A goal's progress = the mean of its
ROOT metrics' `(value - base_value) / (target_value - base_value)` (so a
metric meant to go down works too); sub-metrics break a root down and
don't count (`rootMetrics`; the goalnexa skills say the same). The math
is in `lib/progress.ts`.
A new metric's `current_value` starts at its `base_value` unless one is
sent (`MetricViewSet.perform_create`). The
charts are plain SVG, no chart library. The cap of 8 goals matches the
8 validated categorical color slots. A goal keeps its color slot for as
long as it's selected. Each selected goal lists its metrics in the filter
panel. Unticking a metric leaves it out of that goal's progress (it's an
opt-out, so the default matches the rest of the app), and "Check in"
opens a check-in form in platform-core's `Modal`
(`screens/dashboard/CheckInModal.tsx`); saving refreshes the charts
without resetting the filters. The goal picker is
`screens/dashboard/GoalFilterList.tsx`, a tree with no checkboxes. A
goal node is color key, title (up to 2 lines), % pill and eye, with a
thin progress bar in the goal's color. A goal's branches are its metrics
(while it's shown), then its sub-goals (always - each is shown/hidden on
its own); a metric's sub-metrics nest under it (`parent` on both;
`buildTree`). Tree lines are drawn in CSS from each key (`.gn-branch`).
A metric row is: name
(truncates, with a tooltip), current / target, "+" check-in, eye. The
eye (show/hide, `aria-pressed`) is always the last control on a row. A
hidden goal collapses to its muted title; a hidden metric stays in
place, dimmed. A goal's or metric's name opens its platform-core `CrudDetailScreen` in
a right-hand `Drawer` (closing it refreshes the charts). The picked org
is remembered in localStorage (`goalnexa:dashboard-org`). There is no
table view - charts only. The color tokens live on the `.gn-dashboard` root, not just on
`.gn-viz`, because the filter card's color keys sit outside the charts.
A user with no organization gets the onboarding wizard instead
(`screens/onboarding/OnboardingWizard.tsx`): org name → goals (optional
target date) → metrics per goal (start → target, must differ) → review,
then it creates everything over the REST API (`lib/api/onboarding.ts`)
and opens the dashboard on the new org. Nothing is written before the
last step; a failed create retries without duplicating what went
through. "Skip for now" sets `goalnexa:onboarding-skipped` in
localStorage (not asked again in that browser).

**Check-in time is `CheckIn.checked_in_at`**, not `created_at`. It's
user-set and defaults to now when left blank (the form omits the key and
the model default applies). `Metric.current_value` = the value of the
LATEST check-in by `checked_in_at`, recomputed on every check-in
create/update/delete (`goalnexa/views/check_ins.py`'s
`sync_current_value`), because a backdated check-in isn't necessarily
the latest. The generic CRUD form renders date/datetime schema fields as
native pickers (platform-core `CrudFormFields`: the form keeps API
values, converted to and from the picker's local time). The schema also
carries `nullable` and `help_text`: an emptied non-nullable field is
omitted from the request (server default), an emptied nullable one is
sent as `null`.

**A module does NOT export its own URL path as a constant just because
a host happens to use it** — `BASE_PATH`/`LOGIN_PATH`/`SIGNUP_PATH`
(platform-auth), `GOALS_PATH`/`METRICS_PATH`/`CHECK_INS_PATH` (goalnexa),
`ORGS_PATH` (platform-org) all used to exist and got removed: `apps/main`
is the ONLY host, it already owns every actual URL by calling
`createCrudRoutes`/`createOrgsRoutes` itself, and a link that never
varies gains nothing from a computed "suggested path" import over a
plain string literal at its one or two use sites (`app-shell.tsx`'s
`NAV_ITEMS`) - it's one more file/import to
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
`createCrudRoutes` (from its main entry - `import { createCrudRoutes }
from "platform-core"`), one call per resource,
taking only that resource's own backend base URL:
```ts
// apps/main/frontend/app/routes.ts
import { createCrudRoutes } from "platform-core";
...
layout("routes/app-shell.tsx", [
  ...createCrudRoutes("/api/v1/goals"),
  ...createCrudRoutes("/api/v1/check-ins"),
]),
```
No file paths, no `CrudPaths` object, no per-module import at all -
`createCrudRoutes` derives the resource name from the URL's own last
`/`-segment, `prefixRoutes()`-nests its list/create/detail/edit routes under it (not
`route()` + children - that needs a wrapping layout element with its own
`<Outlet/>`, which none of them share or need), and points every
registration at its OWN `src/routes/` files (`import.meta.url`-derived,
self-referential - never a relative string baking in the CALLER's
directory depth) by default. Two escape hatches worth knowing:
- **A resource whose edit or detail page needs more than the generic
  schema-driven one** gets `createCrudRoutes`'s `editFile`/`detailFile`
  option - an ABSOLUTE path (same `import.meta.url` rule) to a
  module-owned route file that replaces JUST that one generic file for
  that one resource. The domain module would expose that absolute path
  via its OWN Node-only subpath (goalnexa used to, `"./routeFiles"`)
  rather than the host hardcoding a relative filesystem path across
  package boundaries. Nothing uses it today: a record's related rows
  (a goal's metrics, a metric's check-ins) are handled by the generic
  detail screen - see "Relationships" below - which replaced goalnexa's
  hand-written `GoalsEditScreen`/`MetricsEditScreen`.
- **A resource whose whole URL structure needs to be host-decided at a
  level ABOVE the plain `createCrudRoutes(apiPath)` call** (e.g.
  `platform-org`'s `orgs`, deliberately nested at `platform-org/orgs`
  instead of the bare `orgs` every other resource gets) - the domain
  module exposes its OWN parameterized route builder instead
  (`createOrgsRoutes(basePath: string)`, from `platform-org-frontend`'s
  main entry), which wraps `createCrudRoutes` in platform-core's
  `prefixRoutes(basePath, ...)`. The HOST still decides the actual mount
  string (`createOrgsRoutes("platform-org")` in `apps/main`'s own
  `routes.ts`) - the module only owns BUILDING the route list, never the
  URL choice itself. Don't reach for this by default; a resource that's
  happy at its bare name (nearly all of them) just calls
  `createCrudRoutes` directly, no module-owned wrapper needed.

**Relationships (detail screen)**: `/<resource>/:id` is platform-core's
generic `CrudDetailScreen` - the record read-only (to-one relations as
their related row's `display_field`, linked to its detail page wherever
the host mounted it - read from the route manifest, which is why
`react-router.config.ts` sets `routeDiscovery: { mode: "initial" }`),
Edit/Delete, and one tab per to-many relation, all derived from the
schema. A `one_to_many` relation (reverse FK) gets in-place CRUD of the
children in modals, with the FK preset to the parent; a `many_to_many`
one gets Link existing / New (create + link) / Unlink, backed by
`BaseViewSet`'s generic `POST <res>/<id>/relations/<name>/link|unlink`
actions, and a custom through model's own fields (e.g. a `role`) are
asked for on link. List rows open the detail page; create lands on it;
an edit's Save returns to it. Names, the row label field and whether
search is offered all come from the schema API too (`label`,
`label_plural`, `display_field`, `searchable`). Nothing per resource to
write: add the relation on the model, register both sides'
`BaseViewSet`s, done. See
platform-core's AGENTS.md "Relationships" for the mechanics and gaps.

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

**Sidebar entries come from the module that owns the pages**: a module
with its own route builder also exports its sidebar entries from `"."`,
taking the SAME `basePath` - `createOrgsNavItems("platform-org")` next to
`createOrgsRoutes("platform-org")`, `createRbacNavItems("platform-auth")`
(the "Access control" group), `createMcpNavItems("mcp")` - so the link can't drift from where
the routes are mounted, and the module brings its own label and icon.
Main's `app-shell.tsx` just spreads them into `NAV_ITEMS` (plain literals
remain for resources main mounts with a bare `createCrudRoutes`, e.g.
`/goals`). An entry may carry `permission` (core's `NavItem`); main runs
the list through platform-auth's `filterNavByPermissions` (drops links
the user lacks, and groups left empty). Keep a nav builder browser-safe
like a route builder: JSX created when it's CALLED, nothing at module
load, no `.css` import.

**Sharing auth state across modules' screens**: `platform-auth-frontend`
owns the session store (`src/session.ts` - `getSession`/
`subscribeSession`/`isSessionInitialized`/`clearSession`/`initSession`,
all exported from its `"."` entry; its login/signup routes write it).
`apps/main` reads it and passes the token down
to any OTHER module's screen that needs to make its own authenticated
calls (e.g. `platform-core`'s `CrudListScreen`/`CrudCreateScreen`/
`CrudEditScreen` take `accessToken` as a plain prop, via
`<Outlet context={accessToken}>` in `app-shell.tsx` — none of them own
auth state of their own, since they're a pure consumer of a session
platform-auth created).

**Persisting login across a real reload**: the singleton above resets on
every fresh page load, same as `platform-auth-frontend`'s own in-memory
token store — what makes it survive anyway is `root.tsx`'s boot effect
calling `platform-auth-frontend`'s exported `initSession()` on every
mount (wraps `refreshSession()` + marks the store initialized), exchanging the httpOnly refresh cookie (which DOES survive a
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
CRUD resource's routes, while
login/signup stay outside it, unwrapped. `app-shell.tsx` is where main
plugs in the pieces `AppShell` deliberately doesn't own: a
`linkComponent` wrapping react-router's own `Link` (same "no router
dependency inside the package" convention as the screens), the
`navItems` list (spans routes from multiple modules, so it's assembled
here), and the session
read for the header's user/logout display. "Log out" there is
platform-auth's `logout()`: revokes the refresh token server-side, then
clears the session. Nothing else ends a session - platform-auth's
session store refreshes the 15-minute access token before it expires,
and the refresh token's 30-day window slides on every refresh.

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

**MCP server**: `POST /api/v1/mcp` (`platform_mcp`, from
`apps/platform-mcp`, mounted with `include('platform_mcp.urls')` in
`apps/main`'s `config/urls.py`) gives an AI client tools for every
`BaseViewSet` resource - orgs, goals, metrics, check-ins - with nothing
per resource to write. Each tool call is an internal sub-request to the
same REST API as the caller, so the same scoping and validation apply.
Clients authenticate with a **personal access token** (`gnx_...`,
created on the `/mcp` "MCP access" page, platform-mcp-frontend's
`createMcpRoutes`), which works at the MCP endpoint only - not the rest
of the API, not the token API itself. A login's access token works
there too. Client setup (Claude Code, Claude Desktop, Codex, Cursor, VS
Code, Gemini CLI, Windsurf): `apps/platform-mcp/README.md`, and the
same steps on the page. Mechanics: platform-mcp's AGENTS.md.

**Agent skills**: goalnexa ships `goalnexa-check-in`/`-review`/`-plan`
as `apps/goalnexa/backend/goalnexa/mcp_skills/<name>/SKILL.md`
(package data in its pyproject). platform-mcp discovers `mcp_skills/`
in every installed app and serves them publicly, with the index at
`/api/v1/mcp/skills` doubling as the install procedure. One prompt, "Install the
goalnexa skills from <host>/api/v1/mcp/skills", installs them (README and
the `/mcp` page show it). A skill may only rely on the MCP tools and on
filters that actually work (`org_id.isnull`, `name.icontains`,
`sort: "-checked_in_at"`) - test a changed skill with a real client run
(`claude -p ... --mcp-config`), not just by reading it. **nginx forwards
`$http_host`, not `$host`**: `$host` drops the `:55607` port, which
broke the skills' absolute URLs and react-router's action CSRF origin
check (a form submitted before hydration came back as a bare
"Bad Request").

**Hosted (SaaS) edition hooks**: a hosted edition is a private
downstream fork (`goalnexa-cloud`) that merges this repo and only ADDS
files - so the seams it needs live here, doing nothing by default:
- `DEPLOYMENT_MODE` (`self_hosted` | `saas`, `.env`): `saas` sets
  platform-auth's `AUTH_FIRST_RUN_SETUP = False` - no `/auth/setup`,
  signup open from the first account (which would otherwise become
  app-wide Admin); the operator's admin is `manage.py grant_role`.
- `GOALNEXA_EXTENSIONS` (comma-separated Django app modules, installed
  via `BACKEND_EXTRA_PIP`): added to `INSTALLED_APPS`, each one's `urls`
  mounted at `api/v1/`, each one's `host_settings.configure(settings)`
  run at the end of `settings.py`.
- `apps/main/frontend/app/extensions/index.ts`: `createExtensionRoutes()`
  (mounted in the app-shell layout) and `createExtensionNavItems()`,
  both empty here; the fork replaces that directory. Its two signatures
  are a contract with the fork - change them deliberately.
Anything a self-hoster could use too (tenant isolation, email
verification, ...) belongs here, not in the fork.
**Tenant isolation** is pinned by `apps/main/backend/tests/`
(`python manage.py test tests`, in the main-backend container): two
signed-up strangers probe each other's orgs/goals/metrics/check-ins
through list, filters, search, sideloading, retrieve/update/delete,
parent/goal/metric/org references, RBAC and MCP. Extend it with every
new resource or reference field.

**CI** (GitHub Actions, free on public repos): `.github/workflows/ci.yml`
here runs the whole stack at the pinned submodule commits - main's
backend suites + migration check, every module frontend's install,
goalnexa-frontend lint/build, main typecheck/build. Each `platform-*`
repo has its own `ci.yml` for its standalone suite, checked out next to
platform-core's main. Tests that send `Host: localhost` need
`DJANGO_ALLOWED_HOSTS=localhost,testserver` outside compose. The job is
skipped outside `PMNexa/GoalNexa`, so the hosted fork doesn't re-run it.

**Demo data / README media**: `scripts/seed_demo.py` (REST API only,
`--reset` to start over) seeds the account behind `docs/media/`. Re-shoot
after UI changes that the README shows.

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
| `apps/platform-auth/` | git submodule. Django+DRF backend (standalone, own Postgres, own `pyproject.toml` packaging its Django app for reuse) + a frontend package (own `package.json`/`exports`). Both halves are also consumed by `apps/main` — see above. Also owns RBAC (roles app-wide or per org, enforced on every `BaseViewSet` through platform-core's access-policy hook; `CORE_API_ACCESS_POLICY`/`RBAC_*` in main's settings, screens under `/platform-auth/`). Own repo, own AGENTS.md. |
| `apps/platform-org/` | git submodule. Multi-tenant `Organization`/`OrgMembership`, same packaged-both-halves pattern as `platform-auth`. No User table of its own — see the "module with no User table" note above. An org is also an RBAC scope (roles per org - see platform-auth). Own repo, own AGENTS.md. |
| `apps/platform-core/` | git submodule. Django+DRF kernel (no models) — `core_api`: error contract, pagination, filters, uuid7 utils, and `BaseSerializer`/`BaseViewSet` (dynamic fields + relation sideloading, inspired by dynamic-rest — see "Generic CRUD entities" below). **A real backend dependency of `platform-auth` and `platform-org`** (both used to vendor their own copy of the small stuff; that stopped scaling once `BaseSerializer`/`BaseViewSet` existed) — editable-installed into `apps/main`'s venv alongside them. Its `frontend/` doubles as two things: its own (still-unused) Module Federation shell, not part of the default `docker-compose.yml`, and — as the `platform-core` npm package (`src/index.ts` exporting `AppShell`) — the former `platform-ui` module's sidemenu/sticky-header shell, folded in here since it had no backend of its own to justify a separate repo. See the "App shell" note above. Own repo, own AGENTS.md. |
| `apps/platform-mcp/` | git submodule. MCP server over every `BaseViewSet` + personal access tokens, and the `platform-mcp-frontend` package with the "MCP access" page. Split out of platform-core. Same packaged-both-halves pattern; own README (client setup guide) and AGENTS.md. |
| `modules.yaml` | Written for the platform-core/platform-auth Module Federation phase (module registry with `url_prefix`/`remote_entry`). Not read by anything in the current `docker-compose.yml` — `apps/main`'s own imports (file:/pip editable) replace what this was for. |
| `nginx/default.conf` | Actively used — the single-port gateway in front of `apps/main`'s backend+frontend (rewritten for this when reused; a previous version was written for the platform-core/platform-auth setup instead). |
| `docs/architecture/` | Target-state design docs (microservices/module system) — written before the current package-import approach; treat as historical context, not a spec to follow literally. |
| `docs/product-discovery/` | Market/customer research, not implementation-relevant. |

## License (every repo)

Everything - this repo and every `platform-*` module - is **PolyForm
Shield 1.0.0** (source-available, not OSI open source; never call it
"open source" in docs). Each repo carries the same four things, keep
them identical: `LICENSE` (the verbatim license text + the
`Required Notice:` and `Licensor Line of Business:` lines - the latter
stops "Discontinued Products" from ever freeing a competitor),
`CONTRIBUTING.md` (with the Contributor License Agreement that keeps
dual/commercial licensing possible), `.github/pull_request_template.md`
(CLA checkbox), and a README "License" section. Packages declare it too:
`"license": "PolyForm-Shield-1.0.0"` in each `package.json`,
`license = { text = "PolyForm-Shield-1.0.0" }` in each `pyproject.toml`.
A new module copies all of these. platform-core/org/mcp were MIT up to
the commit named in their README; copies of those versions stay MIT.

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
