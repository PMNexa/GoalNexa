import { useState } from "react";
import { CrudEditScreen } from "platform-core";
import { createMetricsCrudConfig } from "../lib/metricsCrudConfig";
import { useGoalOptions } from "../lib/useGoalOptions";
import { useMetricOptions } from "../lib/useMetricOptions";
import type { Metric } from "../lib/api/metrics";
import MetricCheckInsSection from "./MetricCheckInsSection";

export interface MetricsEditScreenProps {
  accessToken: string;
  id: string;
  onUpdated?: (metric: Metric) => void;
  onDeleted?: () => void;
}

/**
 * The edit screen - `platform-core`'s `CrudEditScreen` preconfigured for
 * `Metric`, plus this metric's own check-ins (list + a lightweight add
 * form - see `MetricCheckInsSection`'s own docstring). Same
 * `useGoalOptions` gate as `MetricsCreateScreen` (see its own docstring);
 * `useMetricOptions(accessToken, id)` excludes this metric itself from
 * its own `parent` picker.
 *
 * `refreshKey` remounts `CrudEditScreen` (forcing it to refetch this
 * metric) after a check-in add - `MetricCheckInsSection`'s own create
 * bumps `current_value` server-side, but `CrudEditScreen` already loaded
 * its form state before that happened and has no way to know it's now
 * stale otherwise.
 */
function MetricsEditScreen({ accessToken, id, onUpdated, onDeleted }: MetricsEditScreenProps) {
  const { goalOptions, error } = useGoalOptions(accessToken);
  const { metricOptions } = useMetricOptions(accessToken, id);
  const [refreshKey, setRefreshKey] = useState(0);

  if (error)
    return (
      <p className="text-danger" role="alert">
        {error.message}
      </p>
    );
  if (!goalOptions) return <p className="text-secondary">Loading…</p>;

  return (
    <>
      <CrudEditScreen
        key={refreshKey}
        config={createMetricsCrudConfig(accessToken, goalOptions, metricOptions ?? [])}
        id={id}
        onUpdated={onUpdated}
        onDeleted={onDeleted}
      />
      <MetricCheckInsSection accessToken={accessToken} metricId={id} onCheckIn={() => setRefreshKey((key) => key + 1)} />
    </>
  );
}

export default MetricsEditScreen;
