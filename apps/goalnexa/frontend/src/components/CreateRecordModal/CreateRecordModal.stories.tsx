import type { Meta, StoryObj } from "@storybook/react-vite";
import { delay, http, HttpResponse } from "msw";
import { fn } from "storybook/test";
import { handlers } from "../../storybook/handlers";
import { ACCESS_TOKEN, goals, metrics, orgs } from "../../storybook/fixtures";
import CreateRecordModal from "./CreateRecordModal";
import { schemaHandlers } from "./CreateRecordModal.mocks";

const meta = {
  title: "Components/CreateRecordModal",
  component: CreateRecordModal,
  parameters: { msw: { handlers: [...schemaHandlers, ...handlers] } },
  args: {
    accessToken: ACCESS_TOKEN,
    target: { endpoint: "/api/v1/goals", title: "New goal", preset: { org_id: orgs[0].id } },
    onCreated: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof CreateRecordModal>;

export default meta;
type Story = StoryObj<typeof meta>;

/** "New goal" in the Goals header: the goal's schema fields, minus the org the dashboard decides. */
export const NewGoal: Story = {};

/** "Add sub-goal" on a goal's menu: the parent and org are preset, never asked. */
export const AddSubGoal: Story = {
  args: { target: { endpoint: "/api/v1/goals", title: `Add sub-goal to ${goals[1].title}`, preset: { org_id: orgs[0].id, parent: goals[1].id } } },
};

/** "Add metric" on a goal: no goal picker. */
export const AddMetric: Story = {
  args: { target: { endpoint: "/api/v1/metrics", title: `Add metric to ${goals[0].title}`, preset: { goal: goals[0].id } } },
};

/** "Add sub-metric" on a metric: goal and parent preset. */
export const AddSubMetric: Story = {
  args: { target: { endpoint: "/api/v1/metrics", title: `Add sub-metric to ${metrics[0].name}`, preset: { goal: goals[0].id, parent: metrics[0].id } } },
};

/** The schema is still loading: nothing shows until the form can. */
export const LoadingSchema: Story = {
  parameters: { msw: { handlers: [http.get("*/api/v1/goals/schema", () => delay("infinite")), ...handlers] } },
};

/** The schema failed to load: the modal says why (reopening retries). */
export const SchemaError: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/api/v1/goals/schema", () => HttpResponse.json({ code: "server_error", message: "Couldn't load the form. Try again." }, { status: 500 })),
        ...handlers,
      ],
    },
  },
};

/** Closed (`target: null`): renders nothing. */
export const Closed: Story = { args: { target: null } };
