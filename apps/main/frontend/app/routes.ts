import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";
import { createCrudRoutes } from "platform-core/routes";
import { BASE_PATH, LOGIN_PATH, SIGNUP_PATH } from "platform-auth-frontend";

export default [
  index("routes/home.tsx"),
  route(`${BASE_PATH}/${LOGIN_PATH}`, "routes/login.tsx"),
  route(`${BASE_PATH}/${SIGNUP_PATH}`, "routes/signup.tsx"),
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
  // resource UI left to justify per-module route files anymore.
  layout("routes/app-shell.tsx", [
    ...createCrudRoutes("/api/v1/orgs"),
    ...createCrudRoutes("/api/v1/goals"),
    ...createCrudRoutes("/api/v1/metrics"),
    ...createCrudRoutes("/api/v1/check-ins"),
  ]),
] satisfies RouteConfig;
