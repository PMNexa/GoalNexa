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
