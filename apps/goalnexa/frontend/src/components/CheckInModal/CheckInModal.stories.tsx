import type { Meta, StoryObj } from "@storybook/react-vite";
import { http, HttpResponse } from "msw";
import { fn, userEvent, within } from "storybook/test";
import { handlers } from "../../storybook/handlers";
import { ACCESS_TOKEN, goals, metrics } from "../../storybook/fixtures";
import CheckInModal from "./CheckInModal";
import { periodCheckInHandler, stepsMetric, wauMetric } from "./CheckInModal.mocks";

const meta = {
  title: "Components/CheckInModal",
  component: CheckInModal,
  parameters: { msw: { handlers: [periodCheckInHandler, ...handlers] } },
  args: { accessToken: ACCESS_TOKEN, metric: metrics[0], goalTitle: goals[0].title, onSaved: fn(), onClose: fn() },
} satisfies Meta<typeof CheckInModal>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A reading ("latest") metric: the value is the new reading; when is a date-time, blank = now. */
export const Latest: Story = {};

/** A "sum" metric: "Amount to add", and the hint shows the total it makes. */
export const Sum: Story = {
  args: { metric: metrics[2], goalTitle: goals[1].title },
  play: async () => {
    await userEvent.type(within(document.body).getByLabelText(/Amount to add/), "3");
  },
};

/** One reading per day (`one_per`) on a sum metric: "Total so far today", prefilled from today's check-in, which this one replaces. */
export const OnePerDay: Story = { args: { metric: stepsMetric, goalTitle: "Walk 300k steps this month" } };

/** Check-ins for a week (`snap_to`/`snap_period`): "For" picks the week instead of a time. */
export const ForAWeek: Story = { args: { metric: wauMetric, goalTitle: goals[0].title } };

/** Saving failed: the server's message under the form, which stays open. */
export const SaveError: Story = {
  parameters: {
    msw: {
      handlers: [
        http.post("*/api/v1/check-ins", () =>
          HttpResponse.json({ code: "invalid", message: "This metric's goal is archived - check-ins are closed." }, { status: 400 }),
        ),
        periodCheckInHandler,
        ...handlers,
      ],
    },
  },
  play: async () => {
    const body = within(document.body);
    await userEvent.type(body.getByLabelText(/^Value/), "76000");
    await userEvent.click(body.getByRole("button", { name: "Save check-in" }));
    await body.findByRole("alert");
  },
};

/** Closed (`metric: null`). */
export const Closed: Story = { args: { metric: null } };
