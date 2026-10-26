import type { Meta, StoryObj } from "@storybook/react-vite";
import { withDashboard, inCard } from "../../../storybook/decorators";
import ProgressLineChart from "./ProgressLineChart";
import { busySeries, overTargetSeries, revenueDomain, revenueGoal, revenueMarkers, revenueSeries, singlePointSeries } from "../charts.mocks";

const meta = {
  title: "Components/Charts/ProgressLineChart",
  component: ProgressLineChart,
  decorators: [inCard, withDashboard],
  args: {
    series: revenueSeries,
    height: 220,
    domain: revenueDomain,
    markers: revenueMarkers,
    alwaysLegend: true,
    ariaLabel: `${revenueGoal.title}: metric progress over time`,
  },
} satisfies Meta<typeof ProgressLineChart>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A dashboard panel: one line per metric, "Now" and a dashed "Target" line, each metric's projection to the target date (dashed, hollow dot). */
export const WithTargetAndProjection: Story = {};

/** No target date: no projection, no target line - the range fits the check-ins and now. */
export const NoTargetDate: Story = {
  args: { series: revenueSeries.map((s) => ({ ...s, projection: null })), domain: undefined, markers: revenueMarkers.slice(0, 1) },
};

/** 11 metrics on one chart: the 9th-11th reuse the palette with a dotted line; no end labels past 4 lines. */
export const ManyMetrics: Story = { args: { series: busySeries, height: 300, domain: undefined, markers: [] } };

/** Past target: the % axis grows past 100% (in 25% steps) to keep it in view. */
export const OverTarget: Story = { args: { series: overTargetSeries, domain: undefined, markers: [], alwaysLegend: false } };

/** A single check-in: one dot, mid-plot. */
export const SingleCheckIn: Story = { args: { series: singlePointSeries, domain: undefined, markers: [] } };

/** No check-ins yet: the empty text instead of a chart. */
export const Empty: Story = { args: { series: revenueSeries.map((s) => ({ ...s, points: [], projection: null })), domain: undefined } };
