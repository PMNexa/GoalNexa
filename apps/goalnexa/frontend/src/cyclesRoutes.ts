import { createCrudRoutes, routeFilePath, type RouteEntry } from "platform-core";

/**
 * cycles' routes - platform-core's generic CRUD screens at `cycles[/new|
 * /:id|/:id/edit]`, except the cycle page (`routes/cycle-detail.tsx`: the
 * generic detail plus closing it / its scores). Same shape as
 * `createGoalsRoutes`.
 */
export function createCyclesRoutes(): RouteEntry[] {
  return createCrudRoutes("/api/v1/cycles", { detailFile: routeFilePath(import.meta.url, "routes/cycle-detail.tsx") });
}
