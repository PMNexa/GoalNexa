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
 * `GoalsEditScreen`/`MetricsEditScreen` are the two exceptions - a
 * goal's own edit page also shows/creates its metrics inline
 * (`GoalMetricsSection`), a metric's own edit page its check-ins
 * (`MetricCheckInsSection`); `platform-core`'s plain schema-driven
 * `CrudEditScreen` has no way to know about either. `routes/goals-edit.tsx`/
 * `routes/metrics-edit.tsx` are what `apps/main`'s `routes.ts` actually
 * points its edit route at instead (via `createCrudRoutes`'s `editFile`
 * option - see `routeFiles.ts` and `platform-core`'s own docstring on
 * that option); everything else (check-ins' own edit, every resource's
 * list/create) stays on the fully generic file. `GoalsEditScreen`/
 * `MetricsEditScreen` are still exported here too, same as before, in
 * case another host ever wants to reuse them directly.
 */
export { default as GoalsEditScreen } from "./screens/GoalsEditScreen";
export type { GoalsEditScreenProps } from "./screens/GoalsEditScreen";

export type { Goal, GoalStatus } from "./lib/api/goals";

export { default as MetricsEditScreen } from "./screens/MetricsEditScreen";
export type { MetricsEditScreenProps } from "./screens/MetricsEditScreen";

export type { Metric } from "./lib/api/metrics";

export type { CheckIn } from "./lib/api/checkIns";

// Dashboard: org + goals filters, progress-over-time / current-progress
// charts. `createDashboardRoutes(basePath)` is what a host mounts.
export { default as DashboardScreen } from "./screens/DashboardScreen";
export type { DashboardScreenProps } from "./screens/DashboardScreen";
export { createDashboardRoutes } from "./dashboardRoutes";
