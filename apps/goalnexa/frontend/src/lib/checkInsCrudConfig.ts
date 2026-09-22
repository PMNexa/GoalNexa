import type { CrudConfig, CrudFieldOption, DataTablePage, LinkComponent } from "platform-core";
import { apiFetch } from "./api/client";
import type { CheckIn } from "./api/checkIns";

/**
 * `metricOptions` (id -> name pairs, fetched by whichever screen calls
 * this - see `useMetricOptions.ts`) drives both the `metric` select field
 * and the "Metric" column's id -> name lookup - same one-fetch-two-uses
 * rule `metricsCrudConfig.ts`'s own `goalOptions` follows.
 *
 * `metric` is required on create (`CheckInViewSet.perform_create` 400s
 * without it, and creating also bumps that metric's `current_value` - see
 * `CheckIn`'s own model docstring) and optional-but-reassignable on
 * update (`CheckInViewSet.perform_update`, which deliberately does NOT
 * touch `current_value` - see its own docstring on why editing an old
 * check-in shouldn't overwrite a newer one's effect).
 */
export function createCheckInsCrudConfig(
  accessToken: string,
  metricOptions: CrudFieldOption[],
  linkComponent?: LinkComponent,
): CrudConfig<CheckIn> {
  const metricLabel = new Map(metricOptions.map((option) => [option.value, option.label]));

  return {
    resource: "check-ins",
    endpoint: "/api/v1/check-ins",
    columns: [
      { key: "metric", header: "Metric", render: (checkIn) => metricLabel.get(checkIn.metric) ?? checkIn.metric },
      { key: "value", header: "Value", sortable: true },
      { key: "note", header: "Note", truncate: true },
    ],
    fields: [
      { key: "metric", label: "Metric", type: "select", required: true, options: metricOptions },
      { key: "value", label: "Value", type: "number", required: true },
      { key: "note", label: "Note" },
    ],
    rowKey: (checkIn) => checkIn.id,
    fetcher: (url) => apiFetch<DataTablePage<CheckIn>>(url, accessToken),
    api: {
      create: (values) =>
        apiFetch<CheckIn>("/api/v1/check-ins", accessToken, { method: "POST", body: JSON.stringify(values) }),
      read: (id) => apiFetch<CheckIn>(`/api/v1/check-ins/${id}`, accessToken),
      update: (id, values) =>
        apiFetch<CheckIn>(`/api/v1/check-ins/${id}`, accessToken, { method: "PATCH", body: JSON.stringify(values) }),
      remove: (id) => apiFetch<void>(`/api/v1/check-ins/${id}`, accessToken, { method: "DELETE" }),
    },
    linkComponent,
  };
}
