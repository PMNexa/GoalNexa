import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { inCard } from "../../storybook/decorators";
import { draftGoals } from "./onboarding.mocks";
import GoalsStep from "./GoalsStep";

const meta = {
  title: "Onboarding/GoalsStep",
  component: GoalsStep,
  decorators: [inCard],
  args: { goals: draftGoals, locked: new Set<number>(), onUpdate: fn(), onAdd: fn(), onRemove: fn() },
} satisfies Meta<typeof GoalsStep>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Two goals, one with a target date and description. */
export const Filled: Story = {};

/** A fresh start: one empty goal (its remove button is disabled - at least one is needed). */
export const Empty: Story = {
  args: { goals: [{ key: 1, title: "", description: "", targetDate: "", metrics: [] }] },
};

/** After a failed create: the goal that went through is locked. */
export const PartlyCreated: Story = { args: { locked: new Set([draftGoals[0].key]) } };
