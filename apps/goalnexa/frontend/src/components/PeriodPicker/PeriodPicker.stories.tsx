import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn, userEvent, within } from "storybook/test";
import { periodStart, type Snap } from "../../lib/periods";
import PeriodPicker, { type PeriodPickerProps } from "./PeriodPicker";

const NOW = Date.now();
const DAY = 86_400_000;
const at = (per: Snap, t = NOW) => periodStart(t, per);

/** Keeps the kind, the pick and the "none" tab, as the team board does (a new kind re-snaps the pick). */
function Controlled(args: PeriodPickerProps) {
  const [per, setPer] = useState(args.per);
  const [[from, to], setPick] = useState([args.from, args.to]);
  const [none, setNone] = useState(args.none);
  return (
    <PeriodPicker
      {...args}
      per={per}
      from={from}
      to={to}
      none={none}
      onPerChange={(next) => {
        setPer(next);
        setNone(false);
        setPick([periodStart(from, next), periodStart(to, next)]);
        args.onPerChange?.(next);
      }}
      onChange={(first, last) => {
        setPick([first, last]);
        setNone(false);
        args.onChange(first, last);
      }}
      onNone={
        args.onNone &&
        (() => {
          setNone(true);
          args.onNone?.();
        })
      }
    />
  );
}

const open = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  await userEvent.click(within(canvasElement).getByRole("button", { expanded: false }));
};

const meta = {
  title: "Components/PeriodPicker",
  component: PeriodPicker,
  render: (args) => <Controlled {...args} />,
  decorators: [
    // The menu opens under the button, right-aligned, 18rem wide.
    (Story) => (
      <div style={{ width: "18rem", minHeight: "22rem" }}>
        <Story />
      </div>
    ),
  ],
  args: { id: "period", per: "week", from: at("week"), to: at("week"), onChange: fn(), onPerChange: fn() },
} satisfies Meta<typeof PeriodPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Closed: the button shows the picked period. */
export const Closed: Story = {};

/** Days: a month's calendar; days after today can't be picked. */
export const Day: Story = { args: { per: "day", from: at("day"), to: at("day") }, play: open };

/** Weeks: each calendar row is one week, highlighted as one. */
export const Week: Story = { play: open };

/** Months: a year's grid. */
export const Month: Story = { args: { per: "month", from: at("month"), to: at("month") }, play: open };

/** Quarters: Q1-Q4 of a year. */
export const Quarter: Story = { args: { per: "quarter", from: at("quarter"), to: at("quarter") }, play: open };

/** Years: a block of 12. */
export const Year: Story = { args: { per: "year", from: at("year"), to: at("year") }, play: open };

/** One kind only (`pers`): no tabs. */
export const OneKind: Story = { args: { pers: ["month"], per: "month", from: at("month"), to: at("month") }, play: open };

/** A range (the board's "Over time"): the last 8 weeks, ends solid and the weeks between tinted. */
export const Range: Story = {
  args: { range: true, from: at("week", NOW - 7 * 7 * DAY), to: at("week") },
  play: open,
};

/** A range of months, closed: the button shows "first – last". */
export const RangeClosed: Story = {
  args: { range: true, per: "month", from: at("month", NOW - 150 * DAY), to: at("month") },
};

/** Mid-range pick: the first click is in, the hint asks for the last. */
export const RangePicking: Story = {
  args: { range: true, from: at("week", NOW - 7 * 7 * DAY), to: at("week") },
  play: async (context) => {
    await open(context);
    const menu = within(context.canvasElement).getByRole("dialog");
    await userEvent.click(within(menu).getAllByRole("button", { name: /^Week of/ })[0]);
  },
};

/** The board's "Show by" with its "Totals" tab picked (`noneTab`/`none`): the button reads "Running totals", no calendar. */
export const TotalsTab: Story = {
  args: { noneTab: "Totals", noneText: "Running totals", none: true, onNone: fn() },
  play: open,
};

/** The same picker with a week picked: "Totals" is the first tab, unpressed. */
export const TotalsTabWithPeriod: Story = {
  args: { noneTab: "Totals", noneText: "Running totals", none: false, onNone: fn() },
  play: open,
};

/** `max` in the past: nothing after it can be picked, and "Later" stops there. */
export const WithMax: Story = {
  args: { per: "day", from: at("day", NOW - 20 * DAY), to: at("day", NOW - 20 * DAY), max: NOW - 20 * DAY },
  play: open,
};
