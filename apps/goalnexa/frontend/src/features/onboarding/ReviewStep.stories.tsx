import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { orgs } from "../../storybook/fixtures";
import { inCard } from "../../storybook/decorators";
import { draftGoals } from "./onboarding.mocks";
import ReviewStep from "./ReviewStep";

const meta = {
  title: "Onboarding/ReviewStep",
  component: ReviewStep,
  decorators: [inCard],
  args: { goals: draftGoals, orgName: "Acme Inc." },
} satisfies Meta<typeof ReviewStep>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A new organization with its goals and metrics. */
export const NewOrg: Story = {};

/** Adding goals to an organization that already exists. */
export const ExistingOrg: Story = { args: { existingOrg: { id: orgs[0].id, name: orgs[0].name } } };

/** One goal: singular wording. */
export const OneGoal: Story = { args: { goals: [draftGoals[1]] } };

/** Just me: personal goals, and "Email me when a check-in is due" (the instance sends email). */
export const PersonalWithReminder: Story = { args: { personal: true, remind: true, onRemind: fn() } };
