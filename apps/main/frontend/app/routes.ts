import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";
import { BASE_PATH, LOGIN_PATH, SIGNUP_PATH } from "platform-auth-frontend";
import { ORGS_PATH } from "platform-org-frontend";

export default [
  index("routes/home.tsx"),
  route(`${BASE_PATH}/${LOGIN_PATH}`, "routes/login.tsx"),
  route(`${BASE_PATH}/${SIGNUP_PATH}`, "routes/signup.tsx"),
  // AppShell (sidemenu + sticky header) wraps post-login screens only -
  // the public landing page (home) and login/signup stay bare. See
  // routes/app-shell.tsx.
  layout("routes/app-shell.tsx", [route(ORGS_PATH, "routes/orgs.tsx")]),
] satisfies RouteConfig;
