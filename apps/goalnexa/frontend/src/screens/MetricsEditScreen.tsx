import { useState } from "react";
import { MetricsRouter } from "../lib/metricsRouter";
import type { Metric } from "../lib/api/metrics";
import MetricCheckInsSection from "./MetricCheckInsSection";

export interface MetricsEditScreenProps {
  accessToken: string;
  id: string;
  onUpdated?: (metric: Metric) => void;
  onDeleted?: () => void;
}

/**
 * The edit screen - `MetricsRouter.Edit` (see `lib/metricsRouter.ts`),
 * schema-driven, plus this metric's own check-ins (list + a lightweight
 * add form - see `MetricCheckInsSection`'s own docstring).
 *
 * `refreshKey` remounts `MetricsRouter.Edit` (forcing it to refetch this
 * metric) after a check-in add - `MetricCheckInsSection`'s own create
 * bumps `current_value` server-side, but the edit form already loaded
 * its own state before that happened and has no way to know it's now
 * stale otherwise.
 */
function MetricsEditScreen({ accessToken, id, onUpdated, onDeleted }: MetricsEditScreenProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
      <MetricsRouter.Edit key={refreshKey} accessToken={accessToken} id={id} onUpdated={onUpdated} onDeleted={onDeleted} />
      <MetricCheckInsSection accessToken={accessToken} metricId={id} onCheckIn={() => setRefreshKey((key) => key + 1)} />
    </>
  );
}

export default MetricsEditScreen;
