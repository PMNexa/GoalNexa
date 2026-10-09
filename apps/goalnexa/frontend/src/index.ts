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
 * those inline; the detail screen replaced them. A goal's page adds one
 * thing to it - who the goal is shared with (`GoalSharingPanel`), hence
 * `createGoalsRoutes()` instead of a bare `createCrudRoutes`. A metric's
 * page likewise adds its automatic check-ins (`createMetricsRoutes()`).
 */
export type { Goal, GoalHealth, GoalStatus, GoalVisibility } from "./lib/api/goals";

export type { CheckInCadence, Metric, MetricAggregation } from "./lib/api/metrics";

export type { CheckIn, CheckInSource } from "./lib/api/checkIns";

// Goals: the generic CRUD pages, with the sharing and activity panels on a goal's page.
export { createGoalsRoutes } from "./goalsRoutes";
export { default as GoalSharingPanel } from "./screens/GoalSharingPanel";
export { default as GoalActivityPanel } from "./screens/GoalActivityPanel";
export type { GoalActivityPanelProps } from "./screens/GoalActivityPanel";
export type { GoalSharingPanelProps } from "./screens/GoalSharingPanel";

// Metrics: the generic CRUD pages, with automatic check-ins (ingest
// token) on a metric's page.
export { createMetricsRoutes } from "./metricsRoutes";
export { default as MetricIngestPanel } from "./screens/MetricIngestPanel";
export type { MetricIngestPanelProps } from "./screens/MetricIngestPanel";

// Cycles: the generic CRUD pages, with closing (scores, rollover) and the
// scorecard on a cycle's page.
export { createCyclesRoutes } from "./cyclesRoutes";
export { default as CyclePanel } from "./screens/CyclePanel";
export type { CyclePanelProps } from "./screens/CyclePanel";
export type { Cycle, CycleStatus, GoalOutcome, GoalScore } from "./lib/api/cycles";

// Check-in reminders: where they go, and what's due -
// `createRemindersRoutes(basePath)` is what a host mounts.
export { default as RemindersScreen } from "./screens/RemindersScreen";
export type { RemindersScreenProps } from "./screens/RemindersScreen";
export { createRemindersRoutes } from "./remindersRoutes";

// Dashboard: org + goals filters, progress-over-time / current-progress
// charts. `createDashboardRoutes(basePath)` is what a host mounts.
export { default as DashboardScreen } from "./screens/DashboardScreen";
export type { DashboardScreenProps } from "./screens/DashboardScreen";
export { createDashboardRoutes, createSharedDashboardRoutes } from "./dashboardRoutes";
export { createCheckInTableRoutes } from "./checkInTableRoutes";
export { default as CheckInTableScreen } from "./screens/CheckInTableScreen";
// What a public dashboard link shows - mounted outside the app shell.
export { default as SharedDashboardScreen } from "./screens/SharedDashboardScreen";
export type { SharedDashboardScreenProps } from "./screens/SharedDashboardScreen";

// The org being worked in - the dashboard's org filter, which a host's
// header can switch too (`setCurrentOrg`); `fetchOrgs` lists the choices.
export { getCurrentOrg, PERSONAL_ORG, setCurrentOrg, subscribeCurrentOrg } from "./lib/currentOrg";
export { fetchOrgs } from "./lib/api/dashboard";
export type { OrgOption } from "./lib/api/dashboard";
