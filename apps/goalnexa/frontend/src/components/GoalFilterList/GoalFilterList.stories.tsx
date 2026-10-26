import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { goals, metrics } from "../../storybook/fixtures";
import { inCard, withDashboard } from "../../storybook/decorators";
import GoalFilterList from "./GoalFilterList";
import { teamGoal, treeProps } from "./GoalFilterList.mocks";

const actions = {
  onCheckIn: fn(),
  onAddMetric: fn(),
  onAddGoal: fn(),
  onOpenGoal: fn(),
  onOpenMetric: fn(),
  onMove: fn(),
};

const meta = {
  title: "Components/GoalFilterList",
  component: GoalFilterList,
  decorators: [
    inCard,
    withDashboard,
    // The dashboard's filter pane is about this wide.
    (Story) => (
      <div style={{ maxWidth: 400 }}>
        <Story />
      </div>
    ),
  ],
  args: { ...treeProps(), onToggleGoal: fn(), onToggleMetric: fn(), actions },
} satisfies Meta<typeof GoalFilterList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The dashboard's tree, every goal shown: "+" menus, due clocks (Screens done, Enterprise MRR), a sub-goal, a sub-metric, a tracked metric (Churn rate), a target per day ("6 / 10 /day") and a team's goal tagged "North". */
export const WithActions: Story = {};

/** A shared link's tree (no `actions`): no menus, no clocks, names are plain text - only the eyes. */
export const ReadOnly: Story = { args: { actions: undefined } };

/** A hidden goal collapses to its muted title (its sub-goal stays, on its own); unticked metrics stay in place, dimmed. */
export const HiddenGoalsAndMetrics: Story = {
  args: treeProps([goals[1].id, goals[2].id, teamGoal.id], [metrics[3].id]),
};

/** A hidden metric of a shown goal: dimmed in place, and left out of the goal's %. */
export const HiddenMetric: Story = { args: treeProps(undefined, [metrics[1].id]) };

/** At the cap: hidden goals' eyes are disabled ("Up to 2 goals can be shown"). */
export const AtLimit: Story = { args: { ...treeProps([goals[0].id, goals[1].id]), atLimit: true, maxGoals: 2 } };

/** Metrics still loading: no % pills or bars yet. */
export const Loading: Story = { args: { loading: true } };

/** A shown goal with no metrics yet. */
export const NoMetrics: Story = { args: { ...treeProps(), metricsByGoal: new Map() } };

/** No goals at all: an empty list. */
export const Empty: Story = { args: { ...treeProps([]), goals: [] } };
