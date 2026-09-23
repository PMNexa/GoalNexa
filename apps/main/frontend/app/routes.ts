import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";
import { GOALS_EDIT_ROUTE_FILE, METRICS_EDIT_ROUTE_FILE } from "goalnexa-frontend/routeFiles";
import { createCrudRoutes } from "platform-core/routes";
import { createOrgsRoutes } from "platform-org-frontend/routes";

export default [
  index("routes/home.tsx"),
  // Plain literals, not `platform-auth-frontend`'s own path constants
  // (it doesn't export any anymore) - this app owns every actual URL
  // for every module it wires up; see this file's own comment further
  // down on why orgs/goals/metrics/check-ins follow the same rule.
  route("auth/login", "routes/login.tsx"),
  route("auth/signup", "routes/signup.tsx"),
  // AppShell (sidemenu + sticky header) wraps post-login screens only -
  // the public landing page (home) and login/signup stay bare. See
  // routes/app-shell.tsx.
  //
  // Every generic CRUD resource's actual route leaf files live in
  // platform-core itself now (crud-list.tsx/crud-new.tsx/crud-edit.tsx,
  // shared by every resource - see their own docstrings and
  // createCrudRoutes's) - this app still owns every actual URL, it just
  // registers a whole resource with one call, giving only its own
  // backend base URL. `CrudListScreen`/`CrudCreateScreen`/`CrudEditScreen`
  // are already fully generic (schema-driven), so there's no per-
  // resource UI left to justify per-module route files anymore - EXCEPT
  // goals/metrics' own edit route: `GoalsEditScreen`/`MetricsEditScreen`
  // (goalnexa-frontend) add a goal's own metrics / a metric's own
  // check-ins on top of the plain schema-driven form, which the generic
  // `crud-edit.tsx` has no way to know about. `editFile` swaps ONLY that
  // one file in; list/create for both stay fully generic.
  //
  // orgs is the one resource NOT registered with a bare `createCrudRoutes`
  // call here - `platform-org-frontend` provides `createOrgsRoutes`
  // (its own `"./routes"` subpath) as a parameterized route builder, but
  // THIS app decides the mount prefix ("platform-org", passed in below),
  // same as it decides every other resource's URL - so its real URLs
  // are `platform-org/orgs`, `platform-org/orgs/new`,
  // `platform-org/orgs/:id/edit`. The sidebar nav link (app-shell.tsx)
  // and the home page's quick link both hardcode that same
  // `"/platform-org/orgs"` string rather than importing a computed
  // path from platform-org-frontend - deliberately: this is the ONE
  // place that string is decided, so a plain literal at each of the two
  // other use sites is no less "single source of truth" than a shared
  // constant would be, for a link that doesn't change.
  layout("routes/app-shell.tsx", [
    ...createOrgsRoutes("platform-org"),
    ...createCrudRoutes("/api/v1/goals", { editFile: GOALS_EDIT_ROUTE_FILE }),
    ...createCrudRoutes("/api/v1/metrics", { editFile: METRICS_EDIT_ROUTE_FILE }),
    ...createCrudRoutes("/api/v1/check-ins"),
  ]),
] satisfies RouteConfig;
