import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import type { Board } from "../../api/teamBoard";
import { buildColumns, buildRows } from "./boardRows";
import type { Mode } from "./boardHelpers";
import { BOARD_CSS } from "./boardStyles";
import { localInput } from "./boardHelpers";
import { makeBoard, memberBoard, salesTemplate, withShown } from "./TeamBoardScreen.mocks";
import { useBoardDrafts, type BoardDrafts } from "./useBoardDrafts";
import BoardTable from "./BoardTable";

/** The board's styles and its card, as the screen draws them. */
const inBoard: Decorator = (Story) => (
  <div className="card">
    <style href="gn-team-board" precedence="default">
      {BOARD_CSS}
    </style>
    <div className="gn-board-wrap">
      <Story />
    </div>
  </div>
);

/** Rows and columns for `board` in `mode`, the way the screen lays them out. */
function layout(board: Board, mode: Mode) {
  return { board, rows: buildRows(board, "", mode).rows, columns: buildColumns(board), mode };
}

const noDrafts: BoardDrafts = {
  values: new Map(),
  notes: new Map(),
  openNotes: new Set(),
  targets: new Map(),
  setValue: () => {},
  setNote: () => {},
  toggleNote: () => {},
  editTarget: () => {},
  reset: () => {},
};

const meta = {
  title: "Team board/BoardTable",
  component: BoardTable,
  decorators: [inBoard],
  args: {
    ...layout(makeBoard(), "checkin"),
    templateId: salesTemplate.id,
    show: "",
    showing: false,
    when: localInput(Date.now()),
    busy: false,
    picking: false,
    drafts: noDrafts,
    templateHref: (id: string) => `/goal-templates/${id}`,
    goalHref: (id: string) => `/dashboard?goal=${id}`,
    onJoin: fn(),
    onLeave: fn(),
    onToggleTotal: fn(),
    onEdit: fn(),
    onRemove: fn(),
  },
  // Live drafts, so typing into a cell shows what it'd do ("→ 64,500").
  render: function Render(args) {
    const drafts = useBoardDrafts();
    return <BoardTable {...args} drafts={drafts} />;
  },
} satisfies Meta<typeof BoardTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Check in, running totals: an input per cell, a period line for Calls (per week), "Last update" per goal, the totals' rows. */
export const CheckIn: Story = {};

/** Check in, shown by week: each cell is this week's number, then which week and its %. */
export const ShownByWeek: Story = {
  args: { board: withShown(makeBoard(), "week", Date.now(), 0), show: "week", showing: true },
};

/** Targets for an owner: start and target inputs, the planned target on totals, the Own / Total ticks. */
export const Targets: Story = { args: { ...layout(makeBoard(), "targets"), picking: true } };

/** Targets for a member: read-only numbers, no ticks. */
export const TargetsReadOnly: Story = { args: { ...layout(memberBoard(), "targets") } };

/** A member checking in: only North's cells have inputs; no edit links in the headers. */
export const Member: Story = { args: { ...layout(memberBoard(), "checkin") } };
