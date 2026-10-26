import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { cycles } from "../../storybook/fixtures";
import { periodStart } from "../../lib/periods";
import { localInput } from "./boardHelpers";
import { boardTeams, templates } from "./TeamBoardScreen.mocks";
import BoardPickers, { MomentPicker, RangePicker, ShowPicker } from "./BoardPickers";

const NOW = Date.now();
const week = periodStart(NOW, "week");

const meta = {
  title: "Team board/BoardPickers",
  component: BoardPickers,
  args: {
    mode: "checkin",
    onModeChange: fn(),
    view: "table",
    onViewChange: fn(),
    pickersFolded: false,
    onFoldedChange: fn(),
    templates,
    templateId: templates[0].id,
    onTemplateChange: fn(),
    onNewTemplate: fn(),
    cycles,
    cycleId: cycles[0].id,
    onCycleChange: fn(),
    root: "",
    onRootChange: fn(),
    teams: [...boardTeams].sort((a, b) => a.name.localeCompare(b.name)),
  },
} satisfies Meta<typeof BoardPickers>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Check in, running totals: "Show by" on its Totals tab, and "Checked in at". */
export const CheckIn: Story = {
  args: {
    children: (
      <>
        <div className="col-sm-6 col-lg-2">
          <ShowPicker show="" picked={week} onShowChange={fn()} onPick={fn()} />
        </div>
        <div className="col-sm-6 col-lg-3">
          <MomentPicker when={localInput(NOW)} onChange={fn()} />
        </div>
      </>
    ),
  },
};

/** Check in, shown by a week: no "Checked in at" (check-ins go to the picked week). */
export const ShowByWeek: Story = {
  args: {
    children: (
      <div className="col-sm-6 col-lg-2">
        <ShowPicker show="week" picked={week} onShowChange={fn()} onPick={fn()} />
      </div>
    ),
  },
};

/** Over time: the range of periods instead; View stays. */
export const OverTime: Story = {
  args: {
    mode: "history",
    children: (
      <div className="col-sm-6 col-lg-3">
        <RangePicker per="week" from={week - 11 * 7 * 86_400_000} to={week} capped={false} onPerChange={fn()} onChange={fn()} />
      </div>
    ),
  },
};

/** Targets: no View switch, no period pickers. */
export const Targets: Story = { args: { mode: "targets" } };

/** A member: no "+ New" template. */
export const Member: Story = { args: { onNewTemplate: undefined } };

/** Folded to its first line. */
export const Folded: Story = { args: { pickersFolded: true } };
