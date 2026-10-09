import { routeFilePath, type RouteEntry } from "platform-core";

/**
 * The check-in table (rows: goals/metrics, columns: check-in days) at a
 * HOST-chosen path, inside the host's app-shell layout. Browser-safe, same
 * as `createDashboardRoutes`.
 */
export function createCheckInTableRoutes(basePath: string): RouteEntry[] {
  return [
    {
      id: "goalnexa-check-in-table",
      path: basePath.replace(/^\/+|\/+$/g, ""),
      file: routeFilePath(import.meta.url, "routes/check-in-table.tsx"),
    },
  ];
}
