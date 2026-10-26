import type { Meta, StoryObj } from "@storybook/react-vite";
import { delay, http, HttpResponse } from "msw";
import { handlers } from "../../storybook/handlers";
import { SHARE_TOKEN, sharedDashboard } from "./dashboard.mocks";
import SharedDashboardScreen from "./SharedDashboardScreen";
import type { SharedDashboard } from "../../api/shares";

const answer = (body: SharedDashboard) => ({
  msw: { handlers: [http.get("*/api/v1/shared-dashboards/:token", () => HttpResponse.json(body)), ...handlers] },
});

const meta = {
  title: "Dashboard/SharedDashboardScreen",
  component: SharedDashboardScreen,
  args: { token: SHARE_TOKEN },
  parameters: { layout: "fullscreen", ...answer(sharedDashboard) },
} satisfies Meta<typeof SharedDashboardScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A valid link: the read-only tree (eyes only, no menus) and the same charts as the dashboard. */
export const ValidLink: Story = {};

/** A link made with a metric unticked: it starts hidden (the visitor can show it). */
export const WithHiddenMetric: Story = {
  parameters: answer({ ...sharedDashboard, hidden_metrics: [sharedDashboard.metrics[1].id] }),
};

/** Every goal on the link is gone (deleted, or its creator lost access). */
export const NothingLeft: Story = {
  parameters: answer({ ...sharedDashboard, goals: [], metrics: [], check_ins: [] }),
};

/** A revoked or made-up link: the server answers 404. */
export const InvalidLink: Story = {
  args: { token: "shr_revoked" },
  parameters: {
    msw: {
      handlers: [
        http.get("*/api/v1/shared-dashboards/:token", () =>
          HttpResponse.json({ code: "not_found", message: "Not found." }, { status: 404 }),
        ),
        ...handlers,
      ],
    },
  },
};

/** Waiting for the link's data. */
export const Loading: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/api/v1/shared-dashboards/:token", async () => {
          await delay("infinite");
          return HttpResponse.json(sharedDashboard);
        }),
        ...handlers,
      ],
    },
  },
};

/** Too many views from one address: the rate limit's message. */
export const RateLimited: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/api/v1/shared-dashboards/:token", () =>
          HttpResponse.json({ code: "throttled", message: "Too many requests - try again in a minute." }, { status: 429 }),
        ),
        ...handlers,
      ],
    },
  },
};
