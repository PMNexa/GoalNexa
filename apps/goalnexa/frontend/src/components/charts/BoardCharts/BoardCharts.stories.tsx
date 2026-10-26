import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { withDashboard } from "../../../storybook/decorators";
import { BOARD_CHART_CSS, BoardBarCharts, BoardLineCharts } from "./BoardCharts";
import { boardGoals, boardLabel, boardMetrics, boardPoint, boardSeries, boardStarts } from "../charts.mocks";

/** The team board's chart view: its chart styles inside `.gn-charts gn-viz`. */
const withBoardCharts: Decorator = (Story) => (
  <div className="card">
    <style href="gn-board-charts" precedence="default">
      {BOARD_CHART_CSS}
    </style>
    <div className="gn-charts gn-viz">
      <Story />
    </div>
  </div>
);

const meta = {
  title: "Components/Charts/BoardCharts",
  component: BoardBarCharts,
  decorators: [withBoardCharts, withDashboard],
  args: { goals: boardGoals, metrics: boardMetrics, series: boardSeries, point: boardPoint },
} satisfies Meta<typeof BoardBarCharts>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Check in mode as a chart: per metric a bar per team as % of its own target (tick at 100%), colored by how far along; a tracked metric by value; the total last, below a divider. West has no NPS. */
export const Bars: Story = {};

/** Bars with no total ticked. */
export const BarsWithoutTotal: Story = { args: { series: boardSeries.filter((s) => !s.total) } };

/** No team runs these metrics: each card says so. */
export const BarsNoTeams: Story = { args: { series: [] } };

/** "Over time" as a chart: a line per team across 8 weeks (gaps where a week has no check-in), the shared weekly quota dashed; hover lists the total too. */
export const Lines: Story = {
  render: (args) => <BoardLineCharts goals={args.goals} metrics={args.metrics} series={args.series} starts={boardStarts} label={boardLabel} />,
};

/** Over time with no check-ins in the periods: each card says so. */
export const LinesNoCheckIns: Story = {
  render: (args) => (
    <BoardLineCharts
      goals={args.goals}
      metrics={args.metrics}
      series={args.series.map((s) => ({
        ...s,
        metrics: Object.fromEntries(
          Object.entries(s.metrics).map(([id, c]) => [id, { ...c, history: c.history?.map((h) => h && { ...h, value: null, count: 0 }) }]),
        ),
      }))}
      starts={boardStarts}
      label={boardLabel}
    />
  ),
};
