import { createCrudRoutes, routeFilePath, type RouteEntry } from "platform-core";

/**
 * metrics' routes - platform-core's generic CRUD screens at `metrics[/new|
 * /:id|/:id/edit]`, except the metric page (`routes/metric-detail.tsx`:
 * the generic detail plus its automatic check-ins). Same shape as
 * `createGoalsRoutes`; a host mounts it in place of a bare
 * `createCrudRoutes("/api/v1/metrics")`.
 */
export function createMetricsRoutes(): RouteEntry[] {
  return createCrudRoutes("/api/v1/metrics", { detailFile: routeFilePath(import.meta.url, "routes/metric-detail.tsx") });
}
