import type { Meta, StoryObj } from "@storybook/react-vite";
import { delay, http, HttpResponse } from "msw";
import { fn } from "storybook/test";
import { ACCESS_TOKEN, goals, metrics } from "../../storybook/fixtures";
import { handlers } from "../../storybook/handlers";
import { emptyPage, pageOf, shares } from "./dashboard.mocks";
import ShareDashboardModal from "./ShareDashboardModal";

const withShares = (items: typeof shares) => ({
  msw: { handlers: [http.get("*/api/v1/dashboard-shares", () => HttpResponse.json(pageOf(items))), ...handlers] },
});

const meta = {
  title: "Dashboard/ShareDashboardModal",
  component: ShareDashboardModal,
  args: {
    open: true,
    accessToken: ACCESS_TOKEN,
    goals: [goals[0], goals[1]],
    hiddenMetrics: [],
    defaultTitle: "Acme · Q4 2026",
    shareUrl: (token: string) => `https://goal.example.com/shared/${token}`,
    onClose: fn(),
  },
  parameters: withShares([]),
} satisfies Meta<typeof ShareDashboardModal>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No links yet: name the link and create it. */
export const NoLinksYet: Story = {};

/** Earlier links listed below, each with copy and revoke. */
export const ExistingLinks: Story = { parameters: withShares(shares) };

/** No goals shown on the dashboard: nothing to share yet (earlier links still listed). */
export const NoGoalsShown: Story = { args: { goals: [] }, parameters: withShares(shares) };

/** A metric unticked on the dashboard - left off the link too (same form; the request leaves it out). */
export const WithHiddenMetric: Story = { args: { hiddenMetrics: [metrics[4].id] } };

/** The user's links failed to load. */
export const LoadError: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/api/v1/dashboard-shares", () =>
          HttpResponse.json({ code: "server_error", message: "Couldn't load your links." }, { status: 500 }),
        ),
        ...handlers,
      ],
    },
  },
};

/** Still loading the user's links: the form is there, the list isn't yet. */
export const LoadingLinks: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/api/v1/dashboard-shares", async () => {
          await delay("infinite");
          return HttpResponse.json(emptyPage);
        }),
        ...handlers,
      ],
    },
  },
};
