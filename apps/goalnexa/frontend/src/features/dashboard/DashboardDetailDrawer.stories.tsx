import type { Meta, StoryObj } from "@storybook/react-vite";
import { http, HttpResponse } from "msw";
import { fn } from "storybook/test";
import { ACCESS_TOKEN, goals, metrics } from "../../storybook/fixtures";
import { handlers } from "../../storybook/handlers";
import { goalSchema, metricSchema } from "./dashboard.mocks";
import DashboardDetailDrawer from "./DashboardDetailDrawer";

const meta = {
  title: "Dashboard/DashboardDetailDrawer",
  component: DashboardDetailDrawer,
  args: {
    accessToken: ACCESS_TOKEN,
    detail: { endpoint: "/api/v1/goals", id: goals[0].id },
    detailVersion: 0,
    onClose: fn(),
    onDeleted: fn(),
    onChanged: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        // Before the `:id` route, which would take "schema" for an id.
        http.get("*/api/v1/goals/schema", () => HttpResponse.json(goalSchema)),
        http.get("*/api/v1/metrics/schema", () => HttpResponse.json(metricSchema)),
        ...handlers,
      ],
    },
  },
} satisfies Meta<typeof DashboardDetailDrawer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A goal: its details, then sharing and the activity feed. */
export const Goal: Story = {};

/** A metric: its details, then its automatic check-ins (ingest URL). */
export const Metric: Story = { args: { detail: { endpoint: "/api/v1/metrics", id: metrics[0].id } } };

/** Closed: nothing shown. */
export const Closed: Story = { args: { detail: null } };
