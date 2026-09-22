import type { CrudConfig, CrudFieldOption, DataTablePage, LinkComponent } from "platform-core";
import { apiFetch } from "./api/client";
import type { Goal } from "./api/goals";

/**
 * The one place this package's CRUD screens (`GoalsScreen`/
 * `GoalsCreateScreen`/`GoalsEditScreen` - thin wrappers around
 * `platform-core`'s `CrudListScreen`/`CrudCreateScreen`/`CrudEditScreen`)
 * get their `CrudConfig<Goal>` from. `GoalViewSet` is a real
 * `core_api.viewsets.BaseViewSet` (see root AGENTS.md and platform-core's
 * `BaseSerializer`/`BaseViewSet` section) - `?page=`/`?sort=`/`?q=` all
 * just work, zero extra backend glue.
 *
 * `status`/`target_date` aren't in `fields` below - `CrudField`'s `type`
 * only covers text/email/tel/password/number/checkbox/select (see
 * platform-core's `CrudField` type), no date control yet, so the create/edit
 * form stays to what those types can express (`title`/`description`/
 * `parent`), same as `orgsCrudConfig.ts` leaving `slug` out for being
 * server-derived. Both fields still round-trip on the server and show in
 * `columns` below - only their INPUT UI is deferred, matching this
 * module's MVP scope ("manual OKR creation and check-ins", see
 * docs/product-discovery).
 *
 * `goalOptions` (this same `Goal` type's own id -> title pairs, fetched by
 * whichever screen calls this - see `useGoalOptions.ts`) drives the
 * `parent` select field and the "Parent" column's id -> title lookup - a
 * goal picking ITSELF as its own parent is excluded by `useGoalOptions`'s
 * `excludeId` before it ever reaches here (also rejected server-side, see
 * `GoalViewSet._resolve_parent`).
 *
 * `api`/`fetcher` both route through `apiFetch` (this package's own
 * Bearer-token fetch wrapper - see `lib/api/client.ts`'s own docstring on
 * why this package holds no token of its own) rather than
 * `platform-core`'s plain-`fetch` defaults, since every route here
 * requires authentication.
 */
export function createGoalsCrudConfig(
  accessToken: string,
  goalOptions: CrudFieldOption[],
  linkComponent?: LinkComponent,
): CrudConfig<Goal> {
  const goalLabel = new Map(goalOptions.map((option) => [option.value, option.label]));

  return {
    resource: "goals",
    endpoint: "/api/v1/goals",
    columns: [
      { key: "title", header: "Title", sortable: true },
      { key: "status", header: "Status", sortable: true },
      { key: "target_date", header: "Target date" },
      { key: "parent", header: "Parent", render: (goal) => (goal.parent ? (goalLabel.get(goal.parent) ?? goal.parent) : "—") },
    ],
    fields: [
      { key: "title", label: "Title", required: true },
      { key: "description", label: "Description" },
      { key: "parent", label: "Parent goal", type: "select", options: goalOptions },
    ],
    rowKey: (goal) => goal.id,
    fetcher: (url) => apiFetch<DataTablePage<Goal>>(url, accessToken),
    api: {
      create: (values) => apiFetch<Goal>("/api/v1/goals", accessToken, { method: "POST", body: JSON.stringify(values) }),
      read: (id) => apiFetch<Goal>(`/api/v1/goals/${id}`, accessToken),
      update: (id, values) =>
        apiFetch<Goal>(`/api/v1/goals/${id}`, accessToken, { method: "PATCH", body: JSON.stringify(values) }),
      remove: (id) => apiFetch<void>(`/api/v1/goals/${id}`, accessToken, { method: "DELETE" }),
    },
    linkComponent,
  };
}
