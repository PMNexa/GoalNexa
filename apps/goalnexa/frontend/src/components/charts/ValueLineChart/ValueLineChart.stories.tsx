import type { Meta, StoryObj } from "@storybook/react-vite";
import { withDashboard, inCard } from "../../../storybook/decorators";
import ValueLineChart from "./ValueLineChart";
import { churnDomain, churnPoints, NOW, revenueVndPoints } from "../charts.mocks";

const meta = {
  title: "Components/Charts/ValueLineChart",
  component: ValueLineChart,
  decorators: [
    inCard,
    withDashboard,
    (Story) => (
      <div style={{ maxWidth: 360 }}>
        <Story />
      </div>
    ),
  ],
  args: { label: "Churn rate", unit: "%", slot: 3, points: churnPoints, tMin: churnDomain.tMin, tMax: churnDomain.tMax, now: NOW },
} satisfies Meta<typeof ValueLineChart>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A tracked metric (target = base) on its goal panel's time range, with the "Now" hairline. */
export const Tracked: Story = {};

/** Big numbers in another currency, shown compact (1.9B đ); check-ins from an agent, an ingest URL and the phone app say so on hover. */
export const CompactValues: Story = {
  args: {
    label: "Revenue (VN)",
    unit: "đ",
    slot: 10,
    points: revenueVndPoints,
    tMin: revenueVndPoints[0].t,
    tMax: NOW,
  },
};

/** One reading: a flat line, mid-plot. */
export const OneReading: Story = { args: { points: churnPoints.slice(-1) } };

/** No check-ins yet: just the header. */
export const Empty: Story = { args: { points: [] } };
