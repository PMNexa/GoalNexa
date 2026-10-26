import type { Meta, StoryObj } from "@storybook/react-vite";
import { delay, http, HttpResponse, type HttpHandler } from "msw";
import { expect, fn, userEvent, within } from "storybook/test";
import type { Cycle, GoalScore } from "../../api/cycles";
import type { Goal } from "../../api/goals";
import { ACCESS_TOKEN, goals } from "../../storybook/fixtures";
import { handlers } from "../../storybook/handlers";
import { activeCycle, closedCycle, goalScores, plannedCycle, scoredGoals } from "./CyclePanel.mocks";
import CyclePanel from "./CyclePanel";

const list = <T,>(items: T[]) => HttpResponse.json({ items, total: items.length, page: 1, page_size: 100 });

interface Setup {
  cycle: Cycle;
  /** The org's cycles (the roll-over choices are the open ones besides this). */
  siblings?: Cycle[];
  /** The goals in the cycle. */
  inCycle?: Goal[];
  scores?: GoalScore[];
  extra?: HttpHandler[];
}

function setup({ cycle, siblings = [cycle], inCycle = [], scores = [], extra = [] }: Setup) {
  return {
    msw: {
      handlers: [
        ...extra,
        http.get(`*/api/v1/cycles/${cycle.id}`, () => HttpResponse.json(cycle)),
        http.get("*/api/v1/cycles", () => list(siblings)),
        http.get("*/api/v1/goal-scores", () => list(scores)),
        http.get("*/api/v1/goals", ({ request }) => {
          const ids = new URL(request.url).searchParams.get("filter{id.in}");
          return list(ids ? scoredGoals.filter((g) => ids.split(",").includes(g.id)) : inCycle);
        }),
        http.post("*/api/v1/cycles", async ({ request }) => {
          await delay(300);
          return HttpResponse.json({ ...plannedCycle, ...((await request.json()) as object), id: crypto.randomUUID() }, { status: 201 });
        }),
        ...handlers,
      ],
    },
  };
}

const meta = {
  title: "Cycles/CyclePanel",
  component: CyclePanel,
  args: { accessToken: ACCESS_TOKEN, cycleId: activeCycle.id, onClosed: fn() },
} satisfies Meta<typeof CyclePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An open cycle: the close form, one row per goal, scores prefilled from progress. */
export const Open: Story = { parameters: setup({ cycle: activeCycle, siblings: [plannedCycle, activeCycle], inCycle: goals }) };

/** A goal set to roll over: "Roll over into" appears, the planned next cycle preselected. */
export const RollingOver: Story = {
  parameters: Open.parameters,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.selectOptions(await canvas.findByLabelText(`What happens to ${goals[1].title}`), "rollover");
    await expect(canvas.getByLabelText(/Roll over into/)).toHaveValue(plannedCycle.id);
  },
};

/** Rolling over with no next cycle yet: pick one or create "Q1 2027"; closing waits for it. */
export const RollingOverNoNextCycle: Story = {
  parameters: setup({ cycle: activeCycle, inCycle: goals }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.selectOptions(await canvas.findByLabelText(`What happens to ${goals[0].title}`), "rollover");
    await expect(canvas.getByRole("button", { name: /^Close cycle/ })).toBeDisabled();
  },
};

/** A score outside 0-1: closing is disabled. */
export const BadScore: Story = {
  parameters: Open.parameters,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = await canvas.findByLabelText(`Score for ${goals[0].title}`);
    await userEvent.clear(input);
    await userEvent.type(input, "1.5");
    await expect(canvas.getByRole("button", { name: /^Close cycle/ })).toBeDisabled();
  },
};

/** A cycle still being planned: the same close form. */
export const Planning: Story = {
  args: { cycleId: plannedCycle.id },
  parameters: setup({ cycle: plannedCycle, siblings: [plannedCycle, activeCycle], inCycle: goals.slice(0, 1) }),
};

/** An open cycle with no goals: closing just ends it. */
export const NoGoals: Story = { parameters: setup({ cycle: activeCycle }) };

/** Closing was refused: the server's message under the retro. */
export const CloseRefused: Story = {
  parameters: setup({
    cycle: activeCycle,
    inCycle: goals,
    extra: [
      http.post(`*/api/v1/cycles/${activeCycle.id}/close`, () =>
        HttpResponse.json({ code: "validation_error", message: "Invalid input.", field_errors: { next_cycle: ["That cycle is closed."] } }, { status: 400 }),
      ),
    ],
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: /^Close cycle/ }));
    await expect(await canvas.findByRole("alert")).toBeInTheDocument();
  },
};

/** A closed cycle: its scorecard - average, outcome counts, and each goal's score, outcome and reflection. */
export const Closed: Story = {
  args: { cycleId: closedCycle.id },
  parameters: setup({ cycle: closedCycle, scores: goalScores }),
};

/** A closed cycle that had no goals. */
export const ClosedEmpty: Story = { args: { cycleId: closedCycle.id }, parameters: setup({ cycle: closedCycle }) };

/** Still loading. */
export const Loading: Story = {
  parameters: { msw: { handlers: [http.get(`*/api/v1/cycles/${activeCycle.id}`, () => delay("infinite")), ...handlers] } },
};

/** The cycle couldn't be loaded. */
export const LoadError: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get(`*/api/v1/cycles/${activeCycle.id}`, () => HttpResponse.json({ code: "not_found", message: "Cycle not found." }, { status: 404 })),
        ...handlers,
      ],
    },
  },
};
