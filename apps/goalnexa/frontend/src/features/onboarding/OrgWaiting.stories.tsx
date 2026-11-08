import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import OrgWaiting from "./OrgWaiting";

const meta = {
  title: "Onboarding/OrgWaiting",
  component: OrgWaiting,
  args: { orgName: "Running club", onPersonal: fn(), onSetUpAnyway: fn() },
} satisfies Meta<typeof OrgWaiting>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A member's view of an organization with no goals yet. */
export const Default: Story = {};
