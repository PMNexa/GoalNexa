import { MetricsRouter } from "../lib/metricsRouter";
import type { Metric } from "../lib/api/metrics";

export interface MetricsCreateScreenProps {
  accessToken: string;
  onCreated?: (metric: Metric) => void;
}

/**
 * The create screen - `MetricsRouter.Create` (see `lib/metricsRouter.ts`),
 * schema-driven. `goal` is a required field on the form - the backend
 * still 400s without it (`MetricViewSet.perform_create`) - but it's a
 * plain text input for the goal's id now, not a `useGoalOptions`-built
 * select (see `MetricsScreen`'s own docstring on this regression).
 */
function MetricsCreateScreen(props: MetricsCreateScreenProps) {
  return <MetricsRouter.Create {...props} />;
}

export default MetricsCreateScreen;
