import type { CrudConfig, CrudFieldOption, DataTablePage, LinkComponent } from "platform-core";
import { apiFetch } from "./api/client";
import type { Metric } from "./api/metrics";

/**
 * `goalOptions` (id -> title pairs, fetched by whichever screen calls
 * this - see `useGoalOptions.ts`) drives both the `goal` select field
 * (create/edit) and the "Goal" column's id -> title lookup (list) - one
 * fetch, two uses, same rule `orgsCrudConfig.ts` follows for reusing one
 * computation across a package's screens. `metricOptions` is the same
 * idea for `parent` (see `useMetricOptions.ts`) - a sub-metric's own
 * parent picker, independent of which goal either belongs to (see
 * `Metric.parent`'s own docstring on why a sub-metric isn't required to
 * share its parent's `goal`).
 *
 * `goal` is required on create (`MetricViewSet.perform_create` 400s
 * without it) and optional-but-reassignable on update
 * (`MetricViewSet.perform_update` - see its own docstring); `parent` is
 * optional both times. Either way they're just plain `CrudField`s here,
 * no special-casing needed on this side.
 */
export function createMetricsCrudConfig(
  accessToken: string,
  goalOptions: CrudFieldOption[],
  metricOptions: CrudFieldOption[],
  linkComponent?: LinkComponent,
): CrudConfig<Metric> {
  const goalLabel = new Map(goalOptions.map((option) => [option.value, option.label]));
  const metricLabel = new Map(metricOptions.map((option) => [option.value, option.label]));

  return {
    resource: "metrics",
    endpoint: "/api/v1/metrics",
    columns: [
      { key: "name", header: "Name", sortable: true },
      { key: "goal", header: "Goal", render: (metric) => goalLabel.get(metric.goal) ?? metric.goal },
      {
        key: "parent",
        header: "Parent",
        render: (metric) => (metric.parent ? (metricLabel.get(metric.parent) ?? metric.parent) : "—"),
      },
      { key: "current_value", header: "Current" },
      { key: "target_value", header: "Target" },
      { key: "unit", header: "Unit" },
    ],
    fields: [
      { key: "goal", label: "Goal", type: "select", required: true, options: goalOptions },
      { key: "name", label: "Name", required: true },
      { key: "unit", label: "Unit" },
      { key: "target_value", label: "Target value", type: "number", required: true },
      { key: "parent", label: "Parent metric", type: "select", options: metricOptions },
    ],
    rowKey: (metric) => metric.id,
    fetcher: (url) => apiFetch<DataTablePage<Metric>>(url, accessToken),
    api: {
      create: (values) => apiFetch<Metric>("/api/v1/metrics", accessToken, { method: "POST", body: JSON.stringify(values) }),
      read: (id) => apiFetch<Metric>(`/api/v1/metrics/${id}`, accessToken),
      update: (id, values) =>
        apiFetch<Metric>(`/api/v1/metrics/${id}`, accessToken, { method: "PATCH", body: JSON.stringify(values) }),
      remove: (id) => apiFetch<void>(`/api/v1/metrics/${id}`, accessToken, { method: "DELETE" }),
    },
    linkComponent,
  };
}
