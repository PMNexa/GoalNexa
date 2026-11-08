import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { inCard } from "../../storybook/decorators";
import TimeZoneSelect, { type TimeZoneSelectProps } from "./TimeZoneSelect";

function Controlled(props: TimeZoneSelectProps) {
  const [value, setValue] = useState(props.value);
  return (
    <TimeZoneSelect
      {...props}
      value={value}
      onChange={(zone) => {
        props.onChange(zone);
        setValue(zone);
      }}
    />
  );
}

const meta = {
  title: "Components/TimeZoneSelect",
  component: TimeZoneSelect,
  decorators: [inCard],
  render: (args) => <Controlled {...args} />,
  args: { value: "Asia/Ho_Chi_Minh", onChange: fn(), "aria-label": "Time zone" },
} satisfies Meta<typeof TimeZoneSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Utc: Story = { args: { value: "UTC" } };
