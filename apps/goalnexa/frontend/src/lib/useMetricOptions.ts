import { useEffect, useState } from "react";
import type { CrudFieldOption } from "platform-core";
import { apiFetch } from "./api/client";
import type { Metric } from "./api/metrics";

/**
 * The user's own metrics as `{value: id, label: name}` pairs - same
 * shape/rules as `useGoalOptions`, for `metricsCrudConfig.ts`'s own
 * `parent` select field (a sub-metric doesn't have to share its parent's
 * `goal` - see `Metric.parent`'s own docstring - so this offers every
 * metric of the caller's, not just the ones under a particular goal).
 * `excludeId` is the metric being edited, same "can't be its own parent"
 * rule as `useGoalOptions`.
 */
export function useMetricOptions(accessToken: string, excludeId?: string) {
  const [metricOptions, setMetricOptions] = useState<CrudFieldOption[] | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ items: Metric[] }>("/api/v1/metrics?page_size=100", accessToken)
      .then((page) => {
        if (!cancelled) {
          setMetricOptions(
            page.items.filter((metric) => metric.id !== excludeId).map((metric) => ({ value: metric.id, label: metric.name })),
          );
        }
      })
      .catch((thrown: unknown) => {
        if (!cancelled) setError(thrown instanceof Error ? thrown : new Error(String(thrown)));
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, excludeId]);

  return { metricOptions, error };
}
