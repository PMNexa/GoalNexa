import { routeFilePath, type RouteEntry } from "platform-core";

/**
 * goalnexa's dashboard route, at a HOST-chosen path - `apps/main` puts
 * it inside its app-shell layout (`...createDashboardRoutes("dashboard")`)
 * so it's session-gated and gets the access token via outlet context.
 * Browser-safe on purpose (exported from `"."`, which is client-bundled):
 * plain route-config object, file path built only when called - see
 * platform-core's `lib/routes.ts` docstring.
 */
export function createDashboardRoutes(basePath: string): RouteEntry[] {
  return [
    {
      id: "goalnexa-dashboard",
      path: basePath.replace(/^\/+|\/+$/g, ""),
      file: routeFilePath(import.meta.url, "routes/dashboard.tsx"),
    },
  ];
}

/** The route id `routes/dashboard.tsx` looks up to build a public link's URL. */
export const SHARED_DASHBOARD_ROUTE_ID = "goalnexa-shared-dashboard";

/**
 * Where a public dashboard link opens (`<basePath>/:token`). The host
 * mounts it OUTSIDE its app shell - nobody opening a link is signed in.
 * The dashboard reads this route's path from the manifest, so its "Share"
 * links follow wherever the host puts it (and there's no "Share" without it).
 */
export function createSharedDashboardRoutes(basePath: string): RouteEntry[] {
  return [
    {
      id: SHARED_DASHBOARD_ROUTE_ID,
      path: `${basePath.replace(/^\/+|\/+$/g, "")}/:token`,
      file: routeFilePath(import.meta.url, "routes/shared-dashboard.tsx"),
    },
  ];
}
