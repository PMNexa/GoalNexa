/**
 * Package entry point - what a consuming app (apps/main) imports.
 *
 * `GoalsScreen`/`GoalsCreateScreen`/`GoalsEditScreen` are thin wrappers
 * around `platform-core`'s `CrudListScreen`/`CrudCreateScreen`/
 * `CrudEditScreen` (see `lib/goalsCrudConfig.ts`) - none own auth state of
 * their own (see `GoalsScreen`'s own docstring); all take `accessToken` as
 * a plain prop. `GOALS_PATH`/`GOALS_NEW_PATH`/`goalsEditPath` are this
 * module's own suggested URL segments (`lib/goalsPaths.ts`), matching the
 * same route-export convention `platform-org-frontend`/`platform-auth-frontend`
 * use.
 *
 * `MetricsScreen`/`MetricsCreateScreen`/`MetricsEditScreen` are the same
 * pattern for `Metric` - a metric's `goal` renders as a `select` (see
 * `lib/metricsCrudConfig.ts`, `platform-core`'s `CrudField` `type:
 * "select"`), built from `useGoalOptions` (a live fetch of the caller's
 * own goals, since a metric always belongs to one - see that hook's own
 * docstring). A goal's OWN edit screen also shows and creates its
 * metrics inline (`GoalsEditScreen` -> `GoalMetricsSection`, not exported
 * here since it's not a route of its own) - the two aren't mutually
 * exclusive, they cover "I'm managing a goal" vs. "I'm managing metrics
 * directly" respectively.
 *
 * `CheckInsScreen`/`CheckInsCreateScreen`/`CheckInsEditScreen` are the
 * same pattern one level down - a check-in's `metric` renders as a
 * `select` (`useMetricOptions`). A metric's OWN edit screen also shows
 * and creates its check-ins inline (`MetricsEditScreen` ->
 * `MetricCheckInsSection`, not exported here, same "not mutually
 * exclusive" relationship `GoalMetricsSection` has with `MetricsScreen`).
 *
 * The actual react-router ROUTE MODULES live in `routes/` (`goals.tsx`/
 * `goals-new.tsx`/`goals-edit.tsx`, `metrics.tsx`/`metrics-new.tsx`/
 * `metrics-edit.tsx`, `check-ins.tsx`/`check-ins-new.tsx`/
 * `check-ins-edit.tsx` - see each file's own docstring). NOT exported
 * from this file, and not imported by bare specifier either - a host's
 * `routes.ts` reaches them with a relative filesystem path instead (see
 * platform-org-frontend's `routes/orgs.tsx` docstring on why); this
 * barrel only carries the plain screens/paths a host wires around them.
 */
export { default as GoalsScreen } from "./screens/GoalsScreen";
export type { GoalsScreenProps } from "./screens/GoalsScreen";

export { default as GoalsCreateScreen } from "./screens/GoalsCreateScreen";
export type { GoalsCreateScreenProps } from "./screens/GoalsCreateScreen";

export { default as GoalsEditScreen } from "./screens/GoalsEditScreen";
export type { GoalsEditScreenProps } from "./screens/GoalsEditScreen";

export type { Goal, GoalStatus } from "./lib/api/goals";

import { GOALS_PATHS } from "./lib/goalsPaths";
export { GOALS_PATHS } from "./lib/goalsPaths";
export const GOALS_PATH = GOALS_PATHS.listPath;
export const GOALS_NEW_PATH = GOALS_PATHS.createPath;
export const goalsEditPath = GOALS_PATHS.editPath;

export { default as MetricsScreen } from "./screens/MetricsScreen";
export type { MetricsScreenProps } from "./screens/MetricsScreen";

export { default as MetricsCreateScreen } from "./screens/MetricsCreateScreen";
export type { MetricsCreateScreenProps } from "./screens/MetricsCreateScreen";

export { default as MetricsEditScreen } from "./screens/MetricsEditScreen";
export type { MetricsEditScreenProps } from "./screens/MetricsEditScreen";

export type { Metric } from "./lib/api/metrics";

import { METRICS_PATHS } from "./lib/metricsPaths";
export { METRICS_PATHS } from "./lib/metricsPaths";
export const METRICS_PATH = METRICS_PATHS.listPath;
export const METRICS_NEW_PATH = METRICS_PATHS.createPath;
export const metricsEditPath = METRICS_PATHS.editPath;

export { default as CheckInsScreen } from "./screens/CheckInsScreen";
export type { CheckInsScreenProps } from "./screens/CheckInsScreen";

export { default as CheckInsCreateScreen } from "./screens/CheckInsCreateScreen";
export type { CheckInsCreateScreenProps } from "./screens/CheckInsCreateScreen";

export { default as CheckInsEditScreen } from "./screens/CheckInsEditScreen";
export type { CheckInsEditScreenProps } from "./screens/CheckInsEditScreen";

export type { CheckIn } from "./lib/api/checkIns";

import { CHECK_INS_PATHS } from "./lib/checkInsPaths";
export { CHECK_INS_PATHS } from "./lib/checkInsPaths";
export const CHECK_INS_PATH = CHECK_INS_PATHS.listPath;
export const CHECK_INS_NEW_PATH = CHECK_INS_PATHS.createPath;
export const checkInsEditPath = CHECK_INS_PATHS.editPath;
