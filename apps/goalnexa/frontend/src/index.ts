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
export type { Goal, GoalHealth, GoalStatus, GoalVisibility } from "./api/goals";

export type { CheckInCadence, Metric, MetricAggregation } from "./api/metrics";

export type { CheckIn, CheckInSource } from "./api/checkIns";

// Goals: the generic CRUD pages, with the sharing and activity panels on a goal's page.
export { createGoalsRoutes } from "./features/goals/routes";
export { default as GoalSharingPanel } from "./features/goals/GoalSharingPanel";
export { default as GoalActivityPanel } from "./features/goals/GoalActivityPanel";
export type { GoalActivityPanelProps } from "./features/goals/GoalActivityPanel";
export type { GoalSharingPanelProps } from "./features/goals/GoalSharingPanel";

// Metrics: the generic CRUD pages, with automatic check-ins (ingest
// token) on a metric's page.
export { createMetricsRoutes } from "./features/metrics/routes";
export { default as MetricIngestPanel } from "./features/metrics/MetricIngestPanel";
export type { MetricIngestPanelProps } from "./features/metrics/MetricIngestPanel";

// Cycles: the generic CRUD pages, with closing (scores, rollover) and the
// scorecard on a cycle's page.
export { createCyclesRoutes } from "./features/cycles/routes";
export { default as CyclePanel } from "./features/cycles/CyclePanel";
export type { CyclePanelProps } from "./features/cycles/CyclePanel";
export type { Cycle, CycleStatus, GoalOutcome, GoalScore } from "./api/cycles";

// Check-in reminders: where they go, and what's due -
// `createRemindersRoutes(basePath)` is what a host mounts.
export { default as RemindersScreen } from "./features/reminders/RemindersScreen";
export type { RemindersScreenProps } from "./features/reminders/RemindersScreen";
export { createRemindersRoutes } from "./features/reminders/routes";

// Dashboard: org + goals filters, progress-over-time / current-progress
// charts. `createDashboardRoutes(basePath)` is what a host mounts.
export { default as DashboardScreen } from "./features/dashboard/DashboardScreen";
export type { DashboardScreenProps } from "./features/dashboard/DashboardScreen";
export { createDashboardRoutes, createSharedDashboardRoutes } from "./features/dashboard/routes";
export { createCheckInTableRoutes } from "./features/check-in-table/routes";
// Teams running one goal system: the team board (check-ins, targets and
// totals per team) and the goal templates' pages.
export { createTeamBoardRoutes, createTemplatesRoutes } from "./features/team-board/routes";
export { default as TeamBoardScreen } from "./features/team-board/TeamBoardScreen";
export type { TeamBoardScreenProps } from "./features/team-board/TeamBoardScreen";
export type { Board, GoalTemplate } from "./api/teamBoard";
export { default as CheckInTableScreen } from "./features/check-in-table/CheckInTableScreen";
/** The "check-in-moment" form widget (`registerFieldWidget`) - "Check-ins are for" and its moment in one picker. */
export { default as CheckInMomentField } from "./components/CheckInMomentField";
// What a public dashboard link shows - mounted outside the app shell.
export { default as SharedDashboardScreen } from "./features/dashboard/SharedDashboardScreen";
export type { SharedDashboardScreenProps } from "./features/dashboard/SharedDashboardScreen";

// The org being worked in - the dashboard's org filter, which a host's
// header can switch too (`setCurrentOrg`); `fetchOrgs` lists the choices.
export { getCurrentOrg, PERSONAL_ORG, setCurrentOrg, subscribeCurrentOrg } from "./lib/currentOrg";
export { fetchOrgs } from "./api/dashboard";
export type { OrgOption } from "./api/dashboard";
