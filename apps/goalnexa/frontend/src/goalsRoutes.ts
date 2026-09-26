import { createCrudRoutes, routeFilePath, type RouteEntry } from "platform-core";

/**
 * goals' routes - platform-core's generic CRUD screens at `goals[/new|/:id|
 * /:id/edit]`, except the goal page (`routes/goal-detail.tsx`: the generic
 * detail plus who the goal is shared with). A host mounts it inside its
 * session-gated layout (`...createGoalsRoutes()`), in place of a bare
 * `createCrudRoutes("/api/v1/goals")`. Browser-safe, same as
 * `createDashboardRoutes`.
 */
export function createGoalsRoutes(): RouteEntry[] {
  return createCrudRoutes("/api/v1/goals", { detailFile: routeFilePath(import.meta.url, "routes/goal-detail.tsx") });
}
