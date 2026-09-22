import { CrudCreateScreen } from "platform-core";
import { createMetricsCrudConfig } from "../lib/metricsCrudConfig";
import { useGoalOptions } from "../lib/useGoalOptions";
import { useMetricOptions } from "../lib/useMetricOptions";
import type { Metric } from "../lib/api/metrics";

export interface MetricsCreateScreenProps {
  accessToken: string;
  onCreated?: (metric: Metric) => void;
}

/**
 * The create screen - `platform-core`'s `CrudCreateScreen` preconfigured
 * for `Metric`. Gated on `useGoalOptions` (unlike `MetricsScreen`) - the
 * required `goal` select field is meaningless with zero options, so this
 * waits for them rather than rendering an empty dropdown. NOT gated on
 * `useMetricOptions` - `parent` is optional, same reasoning
 * `GoalsCreateScreen` uses for its own `parent` field.
 */
function MetricsCreateScreen({ accessToken, onCreated }: MetricsCreateScreenProps) {
  const { goalOptions, error } = useGoalOptions(accessToken);
  const { metricOptions } = useMetricOptions(accessToken);

  if (error)
    return (
      <p className="text-danger" role="alert">
        {error.message}
      </p>
    );
  if (!goalOptions) return <p className="text-secondary">Loading…</p>;
  if (goalOptions.length === 0) return <p className="text-secondary">Create a goal first - a metric always belongs to one.</p>;

  return <CrudCreateScreen config={createMetricsCrudConfig(accessToken, goalOptions, metricOptions ?? [])} onCreated={onCreated} />;
}

export default MetricsCreateScreen;
