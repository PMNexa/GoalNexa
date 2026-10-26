import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { cycles, dateDaysAgo, teams } from "../../storybook/fixtures";
import { inCard } from "../../storybook/decorators";
import { ALL_CYCLES } from "./dashboardState";
import DashboardViewFilters from "./DashboardViewFilters";

const meta = {
  title: "Dashboard/DashboardViewFilters",
  component: DashboardViewFilters,
  decorators: [inCard],
  args: {
    cycles: [
      ...cycles,
      { ...cycles[0], id: "04000000-0000-7000-8000-000000000002", name: "Q3 2026", status: "closed", starts_on: dateDaysAgo(130), ends_on: dateDaysAgo(41) },
      { ...cycles[0], id: "04000000-0000-7000-8000-000000000003", name: "Q1 2027", status: "planning", starts_on: dateDaysAgo(-51), ends_on: dateDaysAgo(-140) },
    ],
    cycleKey: cycles[0].id,
    onCycle: fn(),
    snap: null,
    onSnap: fn(),
    teams,
    teamKey: "",
    onTeam: fn(),
  },
} satisfies Meta<typeof DashboardViewFilters>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An org with cycles (closed and planning ones marked) and teams: all three selects. */
export const All: Story = {};

/** Snapped to a week: the hint under "Show check-ins by". */
export const SnappedByWeek: Story = { args: { snap: "week", cycleKey: ALL_CYCLES } };

/** Personal goals - no cycles, no teams: only "Show check-ins by". */
export const SnapOnly: Story = { args: { cycles: [], teams: [] } };
