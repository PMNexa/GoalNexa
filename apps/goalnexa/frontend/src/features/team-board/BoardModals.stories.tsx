import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { buildRows } from "./boardRows";
import { callsMetric, makeBoard } from "./TeamBoardScreen.mocks";
import { LeaveTemplateModal, RemoveFromTemplateModal } from "./BoardModals";

const rows = buildRows(makeBoard(), "", "targets").rows;
const north = rows.find((r) => r.label === "North")!;

const meta = {
  title: "Team board/BoardModals",
  component: LeaveTemplateModal,
  args: { leaving: north, busy: false, onCancel: fn(), onConfirm: fn() },
} satisfies Meta<typeof LeaveTemplateModal>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Unticking a team with check-ins: its goals stay as its own. */
export const LeaveWithCheckIns: Story = {};

/** Unticking a team with no check-ins: its copy is deleted. */
export const LeaveEmpty: Story = {
  args: {
    leaving: {
      ...north,
      instance: {
        ...north.instance!,
        metrics: Object.fromEntries(Object.entries(north.instance!.metrics).map(([k, m]) => [k, { ...m, last_checked_in_at: null }])),
      },
    },
  },
};

/** Taking a team out is running: both buttons wait. */
export const LeaveBusy: Story = { args: { busy: true } };

/** The "×" on a metric's header: it leaves the template and every team's copy. */
export const RemoveMetric: Story = {
  render: () => (
    <RemoveFromTemplateModal
      removing={{ endpoint: "/api/v1/template-metrics", id: callsMetric.id, name: callsMetric.name }}
      busy={false}
      onCancel={fn()}
      onConfirm={fn()}
    />
  ),
};

/** The "×" on a goal's header: its sub-goals and metrics go too. */
export const RemoveGoal: Story = {
  render: () => (
    <RemoveFromTemplateModal
      removing={{ endpoint: "/api/v1/template-goals", id: callsMetric.template_goal, name: "Grow revenue" }}
      busy={false}
      onCancel={fn()}
      onConfirm={fn()}
    />
  ),
};
