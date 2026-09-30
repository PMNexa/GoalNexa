import { routeFilePath, type RouteEntry } from "platform-core";

/**
 * The check-in reminders page at a HOST-chosen path - `apps/main` mounts
 * it inside its app-shell layout (`...createRemindersRoutes("reminders")`).
 * Browser-safe, same as `createDashboardRoutes`.
 */
export function createRemindersRoutes(basePath: string): RouteEntry[] {
  return [
    {
      id: "goalnexa-reminders",
      path: basePath.replace(/^\/+|\/+$/g, ""),
      file: routeFilePath(import.meta.url, "routes/reminders.tsx"),
    },
  ];
}
