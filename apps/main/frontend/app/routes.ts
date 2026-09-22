import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";
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
  ]),
] satisfies RouteConfig;
