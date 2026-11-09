import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { useState } from "react";
import { boardBlocks, buildRows, changeBlocks } from "./boardRows";
import { BOARD_CSS } from "./boardStyles";
import { makeBoard, memberBoard, withShown } from "./TeamBoardScreen.mocks";
import HistoryTable, { type PeriodTip } from "./HistoryTable";

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

/** A board with `count` weeks (or days) of history, laid out as Over time draws it. */
function history(per: "week" | "day", count: number, member = false) {
  const board = withShown(member ? memberBoard() : makeBoard(), per, Date.now(), count);
  return { board, blocks: boardBlocks(buildRows(board, "", "history").rows), per };
}

const meta = {
  title: "Team board/HistoryTable",
  component: HistoryTable,
  decorators: [inBoard],
  args: { ...history("week", 8), busy: false, tip: null, onTip: fn(), onSavePeriod: fn() },
  // The hover details live in the screen; here too, so hovering a cell shows them.
  render: function Render(args) {
    const [tip, setTip] = useState<PeriodTip | null>(null);
    return <HistoryTable {...args} tip={tip} onTip={setTip} />;
  },
} satisfies Meta<typeof HistoryTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Eight weeks per team and total; Calls against its 50 a week, heat by %; click a team's cell to change it. */
export const ByWeek: Story = {};

/** Two weeks of days: Calls has no daily target, so no "/ quota". */
export const ByDay: Story = { args: history("day", 14) };

/** A member: only North's cells can be edited; the rest show their numbers. */
export const Member: Story = { args: history("week", 8, true) };

/** While a save runs, no cell can be edited. */
export const Busy: Story = { args: { busy: true } };

/** "Change": each period minus the one before - signed, coloured, not editable. */
export const Change: Story = (() => {
  const base = history("week", 8);
  return { args: { ...base, blocks: changeBlocks(base.blocks), change: true } };
})();

/** A folded total (its chevron): its goals and the teams under it are hidden; click it to unfold. Remembered per template. */
export const FoldedTotal: Story = (() => {
  const base = history("week", 8);
  const total = base.blocks.find((b) => b.sub);
  return {
    args: base,
    beforeEach: () => {
      const key = "goalnexa:board-folded";
      const before = window.localStorage.getItem(key);
      window.localStorage.setItem(key, JSON.stringify({ [base.board.template.id]: total ? [total.key] : [] }));
      return () => (before === null ? window.localStorage.removeItem(key) : window.localStorage.setItem(key, before));
    },
  };
})();
