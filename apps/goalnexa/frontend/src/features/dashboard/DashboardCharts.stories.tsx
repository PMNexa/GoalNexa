import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CheckIn } from "../../api/checkIns";
import type { Goal } from "../../api/goals";
import type { Metric } from "../../api/metrics";
import type { Snap } from "../../lib/periods";
import { withDashboard } from "../../storybook/decorators";
import { checkIns, daysAgo, goals, metrics, teams } from "../../storybook/fixtures";
import DashboardCharts from "./DashboardCharts";
import { useDashboardCharts } from "./useDashboardCharts";

interface FixtureChartsProps {
  goals: Goal[];
  metrics: Metric[];
  checkIns: CheckIn[];
  /** Metric ids unticked in the tree. */
  hiddenMetrics?: string[];
  snap?: Snap | null;
  loading?: boolean;
  teamNames?: Map<string, string>;
}

/** `DashboardCharts` fed the way the dashboard feeds it: every goal shown, slots in order, through `useDashboardCharts`. */
function FixtureCharts({ goals: shown, metrics: ms, checkIns: cs, hiddenMetrics = [], snap = null, loading, teamNames }: FixtureChartsProps) {
  const selected = new Map(shown.map((goal, i) => [goal.id, i + 1]));
  const charts = useDashboardCharts(shown, selected, ms, cs, new Set(hiddenMetrics), snap);
  return <DashboardCharts charts={charts} slotOf={(id) => selected.get(id) ?? 1} loading={loading} teamNames={teamNames} />;
}

const meta = {
  title: "Dashboard/DashboardCharts",
  component: FixtureCharts,
  decorators: [withDashboard],
  args: { goals, metrics, checkIns },
} satisfies Meta<typeof FixtureCharts>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Three goals: one card each (lines per metric, "Now"/target markers, a projection, a health badge), then the current-progress bars. A tracked metric (Churn rate, start = target) gets its own value chart. */
export const Default: Story = {};

/** One goal only. */
export const SingleGoal: Story = { args: { goals: [goals[0]] } };

/** A metric unticked in the tree: left out of its goal's line chart and %. */
export const HiddenMetric: Story = { args: { goals: [goals[0]], hiddenMetrics: [metrics[1].id] } };

/** Every metric of the goal unticked: the card says so. */
export const AllMetricsHidden: Story = {
  args: { goals: [goals[1]], hiddenMetrics: metrics.filter((m) => m.goal === goals[1].id).map((m) => m.id) },
};

/** A goal with no metrics yet. */
export const NoMetrics: Story = {
  args: { goals: [{ ...goals[0], id: "05000000-0000-7000-8000-000000000099", title: "Hire a designer" }] },
};

/** "Show check-ins by" a week: lines keep each metric's last reading per week, the amount-to-add metric (Screens done) gets weekly bars. */
export const SnappedByWeek: Story = { args: { snap: "week" } };

/** Goals past their target date and at 100%+: off track and achieved badges, no projection. */
export const HealthVariants: Story = {
  args: {
    goals: [
      { ...goals[0], target_date: daysAgo(5).slice(0, 10) },
      { ...goals[1], title: "Ship the mobile app (done)" },
    ],
    metrics: [
      ...metrics.filter((m) => m.goal === goals[0].id),
      ...metrics.filter((m) => m.goal === goals[1].id).map((m) => ({ ...m, current_value: m.target_value })),
    ],
    checkIns: [
      ...checkIns,
      { ...checkIns[0], id: "07000000-0000-7000-8000-000000099999", metric: metrics[2].id, value: "14", checked_in_at: daysAgo(0.5) },
    ],
  },
};

/** A team's copy of a template goal is tagged with its team. */
export const TeamGoal: Story = {
  args: {
    goals: [{ ...goals[0], team_id: teams[1].id, template_goal: "0c000000-0000-7000-8000-000000000001" }],
    teamNames: new Map(teams.map((t) => [t.id, t.name])),
  },
};

/** The dashboard is fetching the shown goals' metrics and check-ins. */
export const Loading: Story = { args: { loading: true } };
