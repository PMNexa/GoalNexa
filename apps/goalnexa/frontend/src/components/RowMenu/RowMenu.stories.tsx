import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn, userEvent, within } from "storybook/test";
import { withDashboard } from "../../storybook/decorators";
import RowMenu from "./RowMenu";

const PlusIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 5l0 14" />
    <path d="M5 12l14 0" />
  </svg>
);

const meta = {
  title: "Components/RowMenu",
  component: RowMenu,
  decorators: [
    withDashboard,
    (Story) => (
      <div className="d-flex justify-content-end" style={{ maxWidth: 360 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    label: "Add to Grow revenue to $100k MRR",
    icon: PlusIcon,
    items: [
      { label: "Add metric", onSelect: fn() },
      { label: "Add sub-goal", onSelect: fn() },
    ],
  },
} satisfies Meta<typeof RowMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A goal row's "+" button, closed. */
export const Closed: Story = {};

/** Opened: the menu sits fixed under the toggle's right corner. */
export const Open: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button"));
  },
};

/** A metric row's menu, opened near the bottom of the window: it flips above the toggle. */
export const NearBottom: Story = {
  args: {
    label: "Check in or add to MRR",
    items: [
      { label: "Check in", onSelect: fn() },
      { label: "Add sub-metric", onSelect: fn() },
    ],
  },
  decorators: [
    (Story) => (
      <div style={{ height: "calc(100vh - 5rem)", display: "flex", alignItems: "flex-end" }}>
        <Story />
      </div>
    ),
  ],
  play: Open.play,
};
