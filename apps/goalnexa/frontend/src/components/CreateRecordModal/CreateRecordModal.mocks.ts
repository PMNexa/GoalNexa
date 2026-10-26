/**
 * `GET <resource>/schema` for the create form, trimmed to what the
 * goals' and metrics' real schemas carry (platform-core's `Schema`).
 */
import { http, HttpResponse } from "msw";

type Field = Record<string, unknown>;
const field = (name: string, type: string, label: string, extra: Field = {}): Field => ({
  name,
  type,
  label,
  required: false,
  read_only: false,
  ...extra,
});

export const goalSchema = {
  label: "goal",
  label_plural: "goals",
  display_field: "title",
  searchable: true,
  fields: [
    field("id", "string", "ID", { read_only: true, format: "uuid" }),
    field("title", "string", "Title", { required: true }),
    field("description", "string", "Description", { multiline: true, help_text: "What done looks like." }),
    field("org_id", "string", "Organization", { format: "uuid", nullable: true }),
    field("target_date", "date", "Target date", { nullable: true }),
    field("visibility", "string", "Visibility", {
      choices: [
        { value: "public", label: "Public - the whole organization" },
        { value: "private", label: "Private - owner and members" },
      ],
      default: "public",
    }),
    field("cycle", "relation", "Cycle", { related_endpoint: "/api/v1/cycles", nullable: true }),
    field("parent", "relation", "Parent goal", { related_endpoint: "/api/v1/goals", nullable: true }),
  ],
};

export const cycleSchema = {
  label: "cycle",
  label_plural: "cycles",
  display_field: "name",
  fields: [field("name", "string", "Name", { required: true })],
};

export const metricSchema = {
  label: "metric",
  label_plural: "metrics",
  display_field: "name",
  fields: [
    field("id", "string", "ID", { read_only: true, format: "uuid" }),
    field("goal", "relation", "Goal", { required: true, related_endpoint: "/api/v1/goals" }),
    field("name", "string", "Name", { required: true }),
    field("unit", "string", "Unit", { help_text: "km, $, users..." }),
    field("base_value", "number", "Start", { required: true }),
    field("target_value", "number", "Target", { required: true, help_text: "Equal to the start: tracked only, no %." }),
    field("aggregation", "string", "Check-ins are", {
      choices: [
        { value: "latest", label: "The new value" },
        { value: "sum", label: "An amount to add" },
      ],
      default: "latest",
    }),
    field("check_in_every", "string", "Check in every", {
      choices: [
        { value: "", label: "No schedule" },
        { value: "daily", label: "Day" },
        { value: "weekly", label: "Week" },
        { value: "monthly", label: "Month" },
      ],
      default: "weekly",
    }),
    field("parent", "relation", "Parent metric", { related_endpoint: "/api/v1/metrics", nullable: true }),
  ],
};

/** Schema endpoints - put these before the shared handlers (whose `<resource>/:id` would answer "schema" with a 404). */
export const schemaHandlers = [
  http.get("*/api/v1/goals/schema", () => HttpResponse.json(goalSchema)),
  http.get("*/api/v1/metrics/schema", () => HttpResponse.json(metricSchema)),
  http.get("*/api/v1/cycles/schema", () => HttpResponse.json(cycleSchema)),
];
