import type { Meta, StoryObj } from "@storybook/react-vite";
import { delay, http, HttpResponse } from "msw";
import { userEvent, within } from "storybook/test";
import { ACCESS_TOKEN } from "../../storybook/fixtures";
import { handlers } from "../../storybook/handlers";
import { PICKERS_KEY, SHOW_KEY, TEMPLATE_KEY, VIEW_KEY } from "./boardHelpers";
import { boardHandlers, memberBoard } from "./TeamBoardScreen.mocks";
import TeamBoardScreen from "./TeamBoardScreen";

/** The board's remembered settings (localStorage): cleared before each story, set by the ones that need them. */
function remember(values: Record<string, unknown> = {}) {
  return () => {
    for (const key of [SHOW_KEY, VIEW_KEY, PICKERS_KEY, TEMPLATE_KEY]) localStorage.removeItem(key);
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, JSON.stringify(value));
  };
}

/** Clicks one of the Mode buttons once the pickers are in. */
async function pickMode(canvasElement: HTMLElement, name: string) {
  const button = await within(canvasElement).findByRole("button", { name });
  await userEvent.click(button);
}

const meta = {
  title: "Team board/TeamBoardScreen",
  component: TeamBoardScreen,
  args: {
    accessToken: ACCESS_TOKEN,
    templateHref: (id: string) => `/goal-templates/${id}`,
    goalHref: (id: string) => `/dashboard?goal=${id}`,
  },
  parameters: { layout: "fullscreen", msw: { handlers: [...boardHandlers(), ...handlers] } },
  beforeEach: remember(),
} satisfies Meta<typeof TeamBoardScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Check in mode, running totals: each team's numbers with an input per cell, the Sales and org totals, a due clock on South's revenue, and West counted as not joined. */
export const CheckIn: Story = {};

/** "Show by" a week: each cell is this week's amount (Calls against its 50/week) or last reading, totals added up from the teams. */
export const ShowByWeek: Story = { beforeEach: remember({ [SHOW_KEY]: "week" }) };

/** Over time by week: rows team -> goal -> metric, the last 12 weeks as columns; a team's cells can be edited in place. */
export const OverTime: Story = {
  beforeEach: remember({ [SHOW_KEY]: "week" }),
  play: ({ canvasElement }) => pickMode(canvasElement, "Over time"),
};

/** Targets mode for an owner: each team's start and target, the planned target and gap on totals, and the Own / Total tick columns (West unticked). */
export const Targets: Story = { play: ({ canvasElement }) => pickMode(canvasElement, "Targets") };

/** Check in as charts: bars as % of each team's target, totals listed apart. */
export const ChartView: Story = { beforeEach: remember({ [VIEW_KEY]: "chart" }) };

/** Over time as charts: a line per team over the last 12 weeks. */
export const OverTimeChart: Story = {
  beforeEach: remember({ [VIEW_KEY]: "chart", [SHOW_KEY]: "week" }),
  play: ({ canvasElement }) => pickMode(canvasElement, "Over time"),
};

/** A member: no template editing or ticks; only their own team (North) takes check-ins. */
export const Member: Story = {
  parameters: { msw: { handlers: [...boardHandlers(memberBoard), ...handlers] } },
};

/** The pickers folded to one line (remembered per browser). */
export const PickersFolded: Story = { beforeEach: remember({ [PICKERS_KEY]: true }) };

/** An empty template picked: the board offers "Set it up" (the template wizard). */
export const EmptyTemplate: Story = {
  beforeEach: remember({ [TEMPLATE_KEY]: { "02000000-0000-7000-8000-000000000001": "0a000000-0000-7000-8000-000000000002" } }),
};

/** No templates in the organization yet: the empty state, with "Create the first one" for an owner. */
export const NoTemplates: Story = { parameters: { msw: { handlers } } };

/** The board is still loading: only the pickers are in. */
export const Loading: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/api/v1/goal-templates/:id/board", async () => {
          await delay("infinite");
          return HttpResponse.json({});
        }),
        ...boardHandlers(),
        ...handlers,
      ],
    },
  },
};

/** The board call fails: its message shows above the (missing) board. The 500 in the console is this story's point. */
export const ApiError: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/api/v1/goal-templates/:id/board", () =>
          HttpResponse.json({ code: "server_error", message: "The board couldn't be loaded." }, { status: 500 }),
        ),
        ...boardHandlers(),
        ...handlers,
      ],
    },
  },
};
