import { type RouteConfig, index, route } from "@react-router/dev/routes";
import { LOGIN_PATH } from "platform-auth-frontend";

export default [
  index("routes/home.tsx"),
  route(LOGIN_PATH, "routes/login.tsx"),
] satisfies RouteConfig;
