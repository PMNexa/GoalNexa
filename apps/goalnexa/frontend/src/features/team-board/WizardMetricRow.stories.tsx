import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { fn } from "storybook/test";
import { inCard } from "../../storybook/decorators";
import { newMetric, type DraftMetric } from "./templateWizardModel";
import WizardMetricRow from "./WizardMetricRow";

const reading: DraftMetric = { ...newMetric(), name: "Revenue", unit: "$", base: "0", target: "100000" };
const perWeek: DraftMetric = {
  ...newMetric(),
  name: "Calls",
  unit: "calls",
  aggregation: "sum",
  target: "50",
  targetPer: "week",
  countDays: "weekdays",
  progressBy: "hit_rate",
  rollup: "avg",
};

const meta = {
  title: "Team board/WizardMetricRow",
  component: WizardMetricRow,
  decorators: [inCard],
  args: { goal: { key: 1, title: "Grow revenue" }, metric: reading, index: 0, onChange: fn(), onRemove: fn() },
  // Keeps the edits, so the fields that depend on others (Target is for, Counts, Progress is) appear as you pick.
  render: function Render(args) {
    const [metric, setMetric] = useState(args.metric);
    return (
      <WizardMetricRow
        {...args}
        metric={metric}
        onChange={(change) => {
          setMetric((m) => ({ ...m, ...change }));
          args.onChange(change);
        }}
      />
    );
  },
} satisfies Meta<typeof WizardMetricRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A reading ("the new value") with a target for the whole goal. */
export const Reading: Story = {};

/** An amount with a target each week, weekdays only, counted by how often it's hit (so totals average). */
export const AmountPerWeek: Story = { args: { metric: perWeek } };

/** A fresh row: every field empty but the start. */
export const Empty: Story = { args: { metric: newMetric() } };
