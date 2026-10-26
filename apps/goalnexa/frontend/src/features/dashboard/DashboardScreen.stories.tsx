import type { Meta, StoryObj } from "@storybook/react-vite";
import { delay, http, HttpResponse } from "msw";
import { ACCESS_TOKEN } from "../../storybook/fixtures";
import { collection, handlers } from "../../storybook/handlers";
import { emptyPage, personalGoals, shares } from "./dashboard.mocks";
import DashboardScreen from "./DashboardScreen";

const meta = {
  title: "Dashboard/DashboardScreen",
  component: DashboardScreen,
  args: { accessToken: ACCESS_TOKEN, shareUrl: (token: string) => `https://goal.example.com/shared/${token}` },
} satisfies Meta<typeof DashboardScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Acme's goals in the running cycle: the filters and goal tree on the left, one chart per shown goal on the right. */
export const WithGoals: Story = {
  parameters: {
    msw: { handlers: [http.get("*/api/v1/dashboard-shares", () => HttpResponse.json({ ...emptyPage, items: shares })), ...handlers] },
  },
};

/** No "Share" button: the host mounted no public link page. */
export const WithoutSharing: Story = { args: { shareUrl: undefined } };

/** A user in no organization who has personal goals (e.g. started by chat): the dashboard, not the wizard. */
export const PersonalNoOrg: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/api/v1/orgs", () => HttpResponse.json(emptyPage)),
        ...collection("goals", personalGoals as unknown as Record<string, unknown>[]),
        ...handlers,
      ],
    },
  },
};

/** The picked organization has no goals yet: its setup wizard, with a select to switch org in the heading. */
export const EmptyOrgShowsWizard: Story = {
  parameters: {
    msw: { handlers: [http.get("*/api/v1/goals", () => HttpResponse.json(emptyPage)), ...handlers] },
  },
};

/** A brand-new user - no organization, no goals: the first-run onboarding wizard. */
export const NewUserShowsWizard: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/api/v1/orgs", () => HttpResponse.json(emptyPage)),
        http.get("*/api/v1/goals", () => HttpResponse.json(emptyPage)),
        ...handlers,
      ],
    },
  },
};

/** Still loading the organizations: the org select and the tree say so. */
export const Loading: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/api/v1/orgs", async () => {
          await delay("infinite");
          return HttpResponse.json(emptyPage);
        }),
        ...handlers,
      ],
    },
  },
};

/** The goals failed to load: the error above the (empty) panes. */
export const ApiError: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/api/v1/goals", () =>
          HttpResponse.json({ code: "server_error", message: "The server had a problem - try again." }, { status: 500 }),
        ),
        ...handlers,
      ],
    },
  },
};
