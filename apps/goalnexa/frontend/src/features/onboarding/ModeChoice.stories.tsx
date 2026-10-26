import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { inCard } from "../../storybook/decorators";
import ModeChoice from "./ModeChoice";

const meta = {
  title: "Onboarding/ModeChoice",
  component: ModeChoice,
  decorators: [inCard],
  args: { onChoose: fn(), onSkip: fn() },
} satisfies Meta<typeof ModeChoice>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The two ways to start - the agent marked recommended - and "Skip for now". */
export const Default: Story = {};
