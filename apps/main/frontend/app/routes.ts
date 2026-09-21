import { type RouteConfig, index, route } from "@react-router/dev/routes";
import { BASE_PATH, LOGIN_PATH, SIGNUP_PATH } from "platform-auth-frontend";
import { ORGS_PATH } from "platform-org-frontend";

export default [
  index("routes/home.tsx"),
  route(`${BASE_PATH}/${LOGIN_PATH}`, "routes/login.tsx"),
  route(`${BASE_PATH}/${SIGNUP_PATH}`, "routes/signup.tsx"),
  route(ORGS_PATH, "routes/orgs.tsx"),
] satisfies RouteConfig;
