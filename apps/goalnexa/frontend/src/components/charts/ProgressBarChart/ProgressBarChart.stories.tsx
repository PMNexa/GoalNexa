import type { Meta, StoryObj } from "@storybook/react-vite";
import { withDashboard, inCard } from "../../../storybook/decorators";
import ProgressBarChart from "./ProgressBarChart";
import { mixedRows, progressRows } from "../charts.mocks";

const meta = {
  title: "Components/Charts/ProgressBarChart",
  component: ProgressBarChart,
  decorators: [inCard, withDashboard],
  args: { rows: progressRows },
} satisfies Meta<typeof ProgressBarChart>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The dashboard's "Current progress": one bar per shown goal, in its color. */
export const Goals: Story = {};

/** A goal with no metric that has a target ("No metrics with a target"), and one at 260% (the axis grows, a 100% line marks the target). */
export const NoMetricsAndOverTarget: Story = { args: { rows: mixedRows } };

/** Nothing shown: just the axis. */
export const Empty: Story = { args: { rows: [] } };
