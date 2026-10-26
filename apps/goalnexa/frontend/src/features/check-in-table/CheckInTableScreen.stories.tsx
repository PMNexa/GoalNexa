import type { Meta, StoryObj } from "@storybook/react-vite";
import { delay, http, HttpResponse } from "msw";
import { ACCESS_TOKEN, goals } from "../../storybook/fixtures";
import { handlers } from "../../storybook/handlers";
import CheckInTableScreen from "./CheckInTableScreen";
import { clearStored, ORG_ID, stored } from "./checkInTable.mocks";

const meta = {
  title: "Check-in table/CheckInTableScreen",
  component: CheckInTableScreen,
  args: { accessToken: ACCESS_TOKEN },
  beforeEach: () => {
    clearStored();
  },
} satisfies Meta<typeof CheckInTableScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Acme's goals, sub-goal and metrics with eight weekly check-ins each, one column per day checked in. */
export const Table: Story = {};

/** The same data as charts (Table / Chart remembered in `goalnexa:table-view`). */
export const ChartView: Story = { beforeEach: stored("goalnexa:table-view", "chart") };

/** "Ship the mobile app" ticked in the Goals picker: it and its sub-goal only (`goalnexa:table-goals`, per org). */
export const GoalPicked: Story = {
  beforeEach: stored("goalnexa:table-goals", { [ORG_ID]: [goals[1].id] }),
};

/** "Grow revenue" collapsed: its metrics are hidden (`goalnexa:table-collapsed`). */
export const Collapsed: Story = { beforeEach: stored("goalnexa:table-collapsed", [goals[0].id]) };

/** An organization with no goals yet. */
export const NoGoals: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/api/v1/goals", () => HttpResponse.json({ items: [], total: 0, page: 1, page_size: 100 })),
        ...handlers,
      ],
    },
  },
};

/** Still loading the goals. */
export const Loading: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/api/v1/goals", async () => {
          await delay("infinite");
          return HttpResponse.json({});
        }),
        ...handlers,
      ],
    },
  },
};

/** The goals failed to load (an intentional 500). */
export const ApiError: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/api/v1/goals", () =>
          HttpResponse.json({ code: "server_error", message: "Something went wrong." }, { status: 500 }),
        ),
        ...handlers,
      ],
    },
  },
};
