import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn, userEvent, within } from "storybook/test";
import { goals } from "../../storybook/fixtures";
import GoalPicker, { type GoalPickerOption, type GoalPickerProps } from "./GoalPicker";

/** The check-in table's options: every goal in tree order, sub-goals indented. */
const options: GoalPickerOption[] = [
  { id: goals[0].id, title: goals[0].title, depth: 0 },
  { id: goals[1].id, title: goals[1].title, depth: 0 },
  { id: goals[2].id, title: goals[2].title, depth: 1 },
  { id: "05000000-0000-7000-8000-0000000000a1", title: "Recruit 20 beta testers in Hanoi", depth: 2 },
];

/** Keeps the picked set, as the check-in table does. */
function Controlled(args: GoalPickerProps) {
  const [selected, setSelected] = useState(args.selected);
  return (
    <GoalPicker
      {...args}
      selected={selected}
      onChange={(next) => {
        setSelected(next);
        args.onChange(next);
      }}
    />
  );
}

const open = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  await userEvent.click(within(canvasElement).getByRole("button"));
};

const meta = {
  title: "Components/GoalPicker",
  component: GoalPicker,
  render: (args) => <Controlled {...args} />,
  decorators: [
    (Story) => (
      <div style={{ minHeight: "16rem" }}>
        <Story />
      </div>
    ),
  ],
  args: { options, selected: new Set<string>(), onChange: fn() },
} satisfies Meta<typeof GoalPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing ticked: "All goals". */
export const AllGoals: Story = {};

/** Opened, nothing ticked: "Showing all", every goal indented as in the tree. */
export const Open: Story = { play: open };

/** One goal ticked: the button names it. */
export const OnePicked: Story = { args: { selected: new Set([goals[1].id]) } };

/** Several ticked, opened: "2 of 4" and "Show all". */
export const SeveralPicked: Story = { args: { selected: new Set([goals[0].id, goals[2].id]) }, play: open };

/** No goals yet, opened. */
export const NoGoals: Story = { args: { options: [] }, play: open };

/** Disabled while the table loads. */
export const Disabled: Story = { args: { disabled: true } };
