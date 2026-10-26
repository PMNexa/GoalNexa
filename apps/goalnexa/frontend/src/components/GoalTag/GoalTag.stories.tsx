import type { Meta, StoryObj } from "@storybook/react-vite";
import { goals } from "../../storybook/fixtures";
import { withDashboard } from "../../storybook/decorators";
import GoalTag from "./GoalTag";

const meta = {
  title: "Components/GoalTag",
  component: GoalTag,
  decorators: [withDashboard],
  args: { goal: goals[0], team: "North" },
} satisfies Meta<typeof GoalTag>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A team's copy of a template goal shows its team. */
export const Team: Story = {};

/** A team total says so, whatever its team. */
export const Total: Story = { args: { goal: { ...goals[0], is_rollup: true } } };

/** Any other goal: nothing. */
export const Plain: Story = { args: { team: null } };
