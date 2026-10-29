import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import type { FieldWidgetProps } from "platform-core";
import { inCard } from "../../storybook/decorators";
import { momentFields, snapToField } from "./CheckInMomentField.mocks";
import CheckInMomentField from "./CheckInMomentField";

/** The widget as a form holds it: `onChange` updates the values it's given (and is still reported). */
function InForm(props: FieldWidgetProps) {
  const [values, setValues] = useState(props.values);
  return (
    <CheckInMomentField
      {...props}
      values={values}
      onChange={(key, value) => {
        props.onChange(key, value);
        setValues((prev) => ({ ...prev, [key]: value }));
      }}
    />
  );
}

const meta = {
  title: "Components/CheckInMomentField",
  component: CheckInMomentField,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: "28rem", minHeight: "34rem" }}>
        <Story />
      </div>
    ),
    inCard,
  ],
  render: (args) => <InForm {...args} />,
  args: {
    id: "crud-field-snap_to",
    field: snapToField,
    fields: momentFields,
    values: { name: "Weekly sales", snap_to: "week", snap_weekday: 5, snap_time: "17:00", snap_due: true },
    onChange: fn(),
  },
} satisfies Meta<typeof CheckInMomentField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Opens the picker. */
const openMenu: Story["play"] = async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole("button", { expanded: false }));
  await expect(canvas.getByRole("dialog")).toBeInTheDocument();
};

/** Closed: the setting in words - "Each week · Friday, 17:00 · due then". */
export const Week: Story = {};

/** Week, opened: period first, then the weekday, time and "due". */
export const WeekOpen: Story = { play: openMenu };

/** A day: only the time. */
export const DayOpen: Story = { args: { values: { snap_to: "day", snap_time: "21:30", snap_due: false } }, play: openMenu };

/** A month: the day of the month (and the time). */
export const MonthOpen: Story = { args: { values: { snap_to: "month", snap_day: 15, snap_time: "09:00", snap_due: true } }, play: openMenu };

/** A quarter: its month, then the day. */
export const QuarterOpen: Story = {
  args: { values: { snap_to: "quarter", snap_quarter_month: 3, snap_day: 1, snap_time: "00:00", snap_due: true } },
  play: openMenu,
};

/** A year on day 31: "A shorter month uses its last day." */
export const YearOpen: Story = {
  args: { values: { snap_to: "year", snap_month: 12, snap_day: 31, snap_time: "23:30", snap_due: true } },
  play: openMenu,
};

/** Inherited from the goal ("Same as goal" - the default when unset): no moment to pick. */
export const SameAsGoal: Story = { args: { values: {} } };

/** Any time: the periods only - picking one that has no moment closes the menu. */
export const AnyTimeOpen: Story = { args: { values: { snap_to: "" } }, play: openMenu };

/** A form whose layout passes only `snap_to` (no moment fields): just the period. */
export const PeriodOnly: Story = { args: { fields: {}, values: { snap_to: "week" } }, play: openMenu };

/** A team's copy of a template metric: shown, not editable, with where to change it. */
export const LockedByTemplate: Story = {
  args: { values: { snap_to: "week", snap_weekday: 1, snap_time: "00:00", snap_due: true, template_metric: "0b000000-0000-7000-8000-000000000001" } },
};

/** The server refused it: the errors of any of its fields, under the button. */
export const Refused: Story = {
  args: {
    values: { snap_to: "day", snap_time: "08:00", snap_due: true },
    errors: { snap_to: ["A metric with a weekly target can't take check-ins for a day."] },
  },
};
