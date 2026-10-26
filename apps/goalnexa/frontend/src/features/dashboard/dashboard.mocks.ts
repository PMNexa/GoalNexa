/**
 * Extra sample data for the dashboard stories: personal goals (no org),
 * a public link's payload and the user's links, and the goal/metric
 * schemas the details drawer's `CrudDetailScreen` loads.
 */
import type { Schema } from "platform-core";
import type { Goal } from "../../api/goals";
import type { DashboardShare, SharedDashboard } from "../../api/shares";
import { checkIns, daysAgo, goals, metrics } from "../../storybook/fixtures";

/** An empty `{items, total, page, page_size}` list. */
export const emptyPage = { items: [], total: 0, page: 1, page_size: 100 };

/** A list page holding `items`. */
export const pageOf = <T>(items: T[]) => ({ items, total: items.length, page: 1, page_size: 100 });

/** The fixture goals as someone's personal ones: no org, no cycle. */
export const personalGoals: Goal[] = goals.map((goal) => ({ ...goal, org_id: null, cycle: null }));

export const SHARE_TOKEN = "shr_storybook_demo";

/** What `GET shared-dashboards/<token>` answers: trimmed rows, no notes or authors. */
export const sharedDashboard: SharedDashboard = {
  title: "Acme · Q4 2026",
  goals: goals.map(({ id, title, status, target_date, parent, position, progress, projected_progress, health }) => ({
    id,
    title,
    status,
    target_date,
    parent,
    position,
    progress,
    projected_progress,
    health,
  })),
  metrics: metrics.map(
    ({ id, goal, name, unit, base_value, target_value, current_value, parent, position, aggregation }) => ({
      id,
      goal,
      name,
      unit,
      base_value,
      target_value,
      current_value,
      parent,
      position,
      aggregation,
    }),
  ),
  check_ins: checkIns.map(({ id, metric, value, checked_in_at, source }) => ({ id, metric, value, checked_in_at, source })),
  hidden_metrics: [],
};

export const shares: DashboardShare[] = [
  {
    id: "0b000000-0000-7000-8000-000000000001",
    token: "shr_board_update",
    title: "Acme · Q4 2026",
    goals: [goals[0].id, goals[1].id],
    hidden_metrics: [],
    created_at: daysAgo(12),
  },
  {
    id: "0b000000-0000-7000-8000-000000000002",
    token: "shr_investors",
    title: "",
    goals: [goals[0].id],
    hidden_metrics: [metrics[4].id],
    created_at: daysAgo(40),
  },
];

const can = { create: true, update: true, delete: true };

/** A few of the goal serializer's fields - enough for the drawer's details. */
export const goalSchema: Schema = {
  label: "goal",
  label_plural: "goals",
  display_field: "title",
  searchable: true,
  can,
  fields: [
    { name: "id", type: "string", format: "uuid", required: false, read_only: true, label: "ID" },
    { name: "title", type: "string", required: true, read_only: false, label: "Title" },
    { name: "description", type: "string", multiline: true, required: false, read_only: false, label: "Description" },
    {
      name: "status",
      type: "string",
      required: false,
      read_only: false,
      label: "Status",
      choices: [
        { value: "in_progress", label: "In progress" },
        { value: "completed", label: "Completed" },
        { value: "archived", label: "Archived" },
      ],
    },
    { name: "target_date", type: "date", nullable: true, required: false, read_only: false, label: "Target date" },
    { name: "progress", type: "number", required: false, read_only: true, label: "Progress" },
  ],
};

/** A few of the metric serializer's fields. */
export const metricSchema: Schema = {
  label: "metric",
  label_plural: "metrics",
  display_field: "name",
  searchable: true,
  can,
  fields: [
    { name: "id", type: "string", format: "uuid", required: false, read_only: true, label: "ID" },
    { name: "name", type: "string", required: true, read_only: false, label: "Name" },
    { name: "unit", type: "string", required: false, read_only: false, label: "Unit" },
    { name: "base_value", type: "number", required: false, read_only: false, label: "Base value" },
    { name: "target_value", type: "number", required: true, read_only: false, label: "Target value" },
    { name: "current_value", type: "number", required: false, read_only: true, label: "Current value" },
  ],
};
