import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";
import {
  CHECK_INS_NEW_PATH,
  CHECK_INS_PATH,
  checkInsEditPath,
  GOALS_NEW_PATH,
  GOALS_PATH,
  goalsEditPath,
  METRICS_NEW_PATH,
  METRICS_PATH,
  metricsEditPath,
} from "goalnexa-frontend";
import { BASE_PATH, LOGIN_PATH, SIGNUP_PATH } from "platform-auth-frontend";
import { ORGS_NEW_PATH, ORGS_PATH, orgsEditPath } from "platform-org-frontend";

export default [
  index("routes/home.tsx"),
  route(`${BASE_PATH}/${LOGIN_PATH}`, "routes/login.tsx"),
  route(`${BASE_PATH}/${SIGNUP_PATH}`, "routes/signup.tsx"),
  // AppShell (sidemenu + sticky header) wraps post-login screens only -
  // the public landing page (home) and login/signup stay bare. See
  // routes/app-shell.tsx.
  //
  // The org routes' own leaf files live in platform-org-frontend itself
  // (routes/orgs.tsx etc.) - this app still owns the actual URL (the
  // string on the left) and still registers it, it just doesn't
  // hand-write the component anymore. See platform-org-frontend's
  // routes/orgs.tsx for why this is the one screen package that isn't
  // react-router-free.
  //
  // A relative path, not the package specifier ("platform-org-frontend/
  // routes/orgs") you'd use to IMPORT it - react-router's own route()
  // resolves `file` with a plain `readFileSync` relative to this app's
  // `appDirectory` ("app/"), not real module resolution, so a bare
  // specifier just gets literally appended to "app/" and 404s. A `../`
  // path is still a real filesystem path once joined, so it works.
  layout("routes/app-shell.tsx", [
    route(ORGS_PATH, "../../../platform-org/frontend/src/routes/orgs.tsx"),
    route(ORGS_NEW_PATH, "../../../platform-org/frontend/src/routes/orgs-new.tsx"),
    route(orgsEditPath(":id"), "../../../platform-org/frontend/src/routes/orgs-edit.tsx"),
    // goalnexa-frontend's own route modules, same "package owns the leaf
    // file, this app still owns the actual URL" pattern as the org routes
    // above (see their own comment on why a relative path, not a package
    // specifier).
    route(GOALS_PATH, "../../../goalnexa/frontend/src/routes/goals.tsx"),
    route(GOALS_NEW_PATH, "../../../goalnexa/frontend/src/routes/goals-new.tsx"),
    route(goalsEditPath(":id"), "../../../goalnexa/frontend/src/routes/goals-edit.tsx"),
    route(METRICS_PATH, "../../../goalnexa/frontend/src/routes/metrics.tsx"),
    route(METRICS_NEW_PATH, "../../../goalnexa/frontend/src/routes/metrics-new.tsx"),
    route(metricsEditPath(":id"), "../../../goalnexa/frontend/src/routes/metrics-edit.tsx"),
    route(CHECK_INS_PATH, "../../../goalnexa/frontend/src/routes/check-ins.tsx"),
    route(CHECK_INS_NEW_PATH, "../../../goalnexa/frontend/src/routes/check-ins-new.tsx"),
    route(checkInsEditPath(":id"), "../../../goalnexa/frontend/src/routes/check-ins-edit.tsx"),
  ]),
] satisfies RouteConfig;
