import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { withDashboard } from "../../storybook/decorators";
import { CheckInTableRow, type RowDrag } from "./CheckInTableRow";
import { TABLE_CSS } from "./tableStyles";
import { sampleTable } from "./checkInTable.mocks";

const table = sampleTable("week");
const rowFor = (label: string) => table.rows.find((row) => row.label === label)!;

/** The table around one row, with the screen's styles. */
const inTable: Decorator = (Story) => (
  <div className="card">
    <style href="gn-checkin-table" precedence="default">
      {TABLE_CSS}
    </style>
    <div className="gn-table-wrap">
      <table className="gn-table">
        <tbody>
          <Story />
        </tbody>
      </table>
    </div>
  </div>
);

/** Drag props that do nothing - the drag itself is `useSiblingDrag`'s. */
const drag: RowDrag = {
  source: { draggable: true, onDragStart: () => {}, onDragEnd: () => {} },
  target: { onDragOver: () => {}, onDrop: () => {}, "data-drop": undefined, "data-dragging": undefined },
};

const meta = {
  title: "Check-in table/CheckInTableRow",
  component: CheckInTableRow,
  decorators: [inTable, withDashboard],
  args: {
    row: rowFor("Grow revenue to $100k MRR"),
    columns: table.columns,
    drag,
    collapsed: false,
    onToggleCollapsed: fn(),
    tag: null,
    menuItems: [
      { label: "Add metric", onSelect: fn() },
      { label: "Add sub-goal", onSelect: fn() },
    ],
    draftValue: "",
    draftPlaceholder: "",
    onDraftChange: fn(),
    onDraftSubmit: fn(),
  },
} satisfies Meta<typeof CheckInTableRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A goal row: its progress per column, a collapse toggle, no check-in input. */
export const Goal: Story = {};

/** A collapsed goal row. */
export const CollapsedGoal: Story = { args: { collapsed: true } };

/** A `latest` metric: each cell is the reading and its %; the draft input shows its unit. */
export const LatestMetric: Story = {
  args: {
    row: rowFor("MRR"),
    menuItems: [
      { label: "Check in", onSelect: fn() },
      { label: "Add sub-metric", onSelect: fn() },
    ],
    draftPlaceholder: "$",
    draftValue: "76000",
  },
};

/** A `sum` metric: the running total with the amount added under it; the input asks for "+ amount". */
export const SumMetric: Story = {
  args: { row: rowFor("Screens done"), draftPlaceholder: "+ amount" },
};

/** A tracked metric (target = base): "tracked" target, values without %. */
export const TrackedMetric: Story = {
  args: { row: rowFor("Churn rate"), draftPlaceholder: "%" },
};
