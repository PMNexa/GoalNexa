import type { LinkComponent } from "platform-core";
import { MetricsRouter } from "../lib/metricsRouter";
import type { Metric } from "../lib/api/metrics";

export interface MetricsScreenProps {
  accessToken: string;
  linkComponent?: LinkComponent;
  onDeleted?: (metric: Metric) => void;
}

/**
 * The list screen - `MetricsRouter.List` (see `lib/metricsRouter.ts`),
 * schema-driven. Same known regression as `GoalsScreen`'s own note:
 * `goal`/`parent` render as bare ids, not looked-up labels.
 */
function MetricsScreen(props: MetricsScreenProps) {
  return <MetricsRouter.List {...props} />;
}

export default MetricsScreen;
