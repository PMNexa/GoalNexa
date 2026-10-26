import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { DraftColumnHeader } from "./DraftColumnHeader";
import { TABLE_CSS } from "./tableStyles";

/** The table's header row around the cell, with the screen's styles. */
const inHeader: Decorator = (Story) => (
  <div className="card" style={{ maxWidth: "24rem" }}>
    <style href="gn-checkin-table" precedence="default">
      {TABLE_CSS}
    </style>
    <table className="gn-table">
      <thead>
        <tr>
          <Story />
        </tr>
      </thead>
    </table>
  </div>
);

const today = new Date().toISOString().slice(0, 10);

const meta = {
  title: "Check-in table/DraftColumnHeader",
  component: DraftColumnHeader,
  decorators: [inHeader],
  args: {
    snap: "day",
    value: today,
    onChange: fn(),
    filledCount: 0,
    hasTime: true,
    saving: false,
    saveError: null,
    onSave: fn(),
  },
} satisfies Meta<typeof DraftColumnHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing typed yet: Save is disabled. */
export const Empty: Story = {};

/** Two values typed: "Save 2". */
export const Filled: Story = { args: { filledCount: 2 } };

/** Saving. */
export const Saving: Story = { args: { filledCount: 2, saving: true } };

/** Some check-ins failed. */
export const SaveError: Story = { args: { filledCount: 1, saveError: "Couldn't save: MRR" } };

/** Hourly columns: a date-time picker. */
export const Hour: Story = { args: { snap: "hour", value: `${today}T09:00`, filledCount: 1 } };

/** Monthly columns: a month picker. */
export const Month: Story = { args: { snap: "month", value: today.slice(0, 7), filledCount: 1 } };
