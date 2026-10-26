import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { BOARD_CHART_CSS } from "../../components/charts/BoardCharts";
import { withDashboard } from "../../storybook/decorators";
import { TableCharts } from "./TableCharts";
import { chartCards } from "./chartCards";
import { bucketLabel } from "./tableColumns";
import { sampleTable } from "./checkInTable.mocks";

/** The board charts' styles, which the screen adds in Chart view. */
const withChartStyles: Decorator = (Story) => (
  <>
    <style href="gn-board-charts" precedence="default">
      {BOARD_CHART_CSS}
    </style>
    <Story />
  </>
);

const weekly = sampleTable("week");
const weeklyCards = chartCards(weekly, new Map());

const meta = {
  title: "Check-in table/TableCharts",
  component: TableCharts,
  decorators: [withChartStyles, withDashboard],
  args: { cards: weeklyCards, columns: weekly.columns, label: (col: string) => bucketLabel(col, "week") },
} satisfies Meta<typeof TableCharts>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Weekly columns: per goal its % and each metric's, and the tracked "Churn rate" in its own unit. */
export const Weekly: Story = {};

/** Monthly columns: the same lines over fewer points. */
export const Monthly: Story = (() => {
  const table = sampleTable("month");
  return {
    args: { cards: chartCards(table, new Map()), columns: table.columns, label: (col: string) => bucketLabel(col, "month") },
  };
})();

/** A goal with a single metric: no separate "Goal" line, no legend. */
export const SingleMetric: Story = {
  args: { cards: weeklyCards.filter((card) => card.lines.length === 1 && card.percent) },
};

/** Nothing checked in yet. */
export const Empty: Story = { args: { cards: [] } };
