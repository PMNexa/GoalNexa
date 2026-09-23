/**
 * Package entry point - what a consuming app (apps/main) imports.
 *
 * List/create for every resource here (goals/metrics/check-ins) are
 * fully generic now - `apps/main`'s `routes.ts` registers them straight
 * off `platform-core`'s own `createCrudRoutes`, which builds
 * `CrudListScreen`/`CrudCreateScreen` itself from just a base URL. This
 * package has no `GoalsScreen`/`GoalsCreateScreen`/etc of its own to
 * wrap those anymore (nor `MetricsScreen`/`MetricsCreateScreen`/
 * `CheckInsScreen`/`CheckInsCreateScreen`/`CheckInsEditScreen`) - they
 * used to exist, thin `CrudRouter.List`/`.Create`/`.Edit` delegates, but
 * nothing imported them once routing centralized into `platform-core`
 * (a real regression, caught late: `apps/main` silently stopped
 * rendering them, so they were just dead code sitting in this barrel).
 *
 * So are their edit and detail pages: a goal's metrics and a metric's
 * check-ins are managed from `platform-core`'s generic detail screen
 * (one tab per to-many relation, derived from the schema). This package
 * used to ship custom `GoalsEditScreen`/`MetricsEditScreen` (+ route
 * files, wired in via `createCrudRoutes`'s `editFile`) just to show
 * those inline; the detail screen replaced them.
 */
export type { Goal, GoalStatus } from "./lib/api/goals";

export type { Metric } from "./lib/api/metrics";

export type { CheckIn } from "./lib/api/checkIns";

// Dashboard: org + goals filters, progress-over-time / current-progress
// charts. `createDashboardRoutes(basePath)` is what a host mounts.
export { default as DashboardScreen } from "./screens/DashboardScreen";
export type { DashboardScreenProps } from "./screens/DashboardScreen";
export { createDashboardRoutes } from "./dashboardRoutes";
