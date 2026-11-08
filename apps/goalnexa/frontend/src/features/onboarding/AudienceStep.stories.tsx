import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { inCard } from "../../storybook/decorators";
import AudienceStep from "./AudienceStep";

const meta = {
  title: "Onboarding/AudienceStep",
  component: AudienceStep,
  decorators: [inCard],
  args: { audience: null, onChoose: fn() },
} satisfies Meta<typeof AudienceStep>;

export default meta;
type Story = StoryObj<typeof meta>;

/** "Just me" (personal goals) or "My team" (an organization). */
export const Default: Story = {};

/** Back from a later step: the choice made is marked. */
export const TeamPicked: Story = { args: { audience: "team" } };
