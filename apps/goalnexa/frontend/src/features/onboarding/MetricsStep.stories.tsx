import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { inCard } from "../../storybook/decorators";
import { draftGoals } from "./onboarding.mocks";
import MetricsStep from "./MetricsStep";

const meta = {
  title: "Onboarding/MetricsStep",
  component: MetricsStep,
  decorators: [inCard],
  args: { goals: draftGoals, locked: new Set<number>(), onUpdateGoal: fn(), onUpdateMetric: fn() },
} satisfies Meta<typeof MetricsStep>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Each goal's metrics: name, unit, start and target (one going down - churn 8% to 3%). */
export const Filled: Story = {};

/** After a failed create: the metric that went through is locked. */
export const PartlyCreated: Story = { args: { locked: new Set([draftGoals[0].metrics[0].key]) } };
