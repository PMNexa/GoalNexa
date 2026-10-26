import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { goals } from "../../storybook/fixtures";
import { goalPickerOptions } from "./buildTable";
import { TableToolbar } from "./TableToolbar";

const meta = {
  title: "Check-in table/TableToolbar",
  component: TableToolbar,
  args: {
    goalOptions: goalPickerOptions(goals),
    picked: new Set<string>(),
    onPickedChange: fn(),
    pickerDisabled: false,
    onNewGoal: fn(),
    newGoalDisabled: false,
    view: "table",
    onViewChange: fn(),
    snap: "day",
    onSnapChange: fn(),
    weekStart: 1,
    onWeekStartChange: fn(),
  },
} satisfies Meta<typeof TableToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every goal shown, daily columns, Table view. */
export const Default: Story = {};

/** One goal picked, Chart view. */
export const PickedChart: Story = { args: { picked: new Set([goals[1].id]), view: "chart" } };

/** Weekly columns ask which day a week starts on. */
export const Weekly: Story = { args: { snap: "week" } };

/** Before the table has loaded: the picker and New goal wait. */
export const Loading: Story = { args: { pickerDisabled: true, newGoalDisabled: true, goalOptions: [] } };
