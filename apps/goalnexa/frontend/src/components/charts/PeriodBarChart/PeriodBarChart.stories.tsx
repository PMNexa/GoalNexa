import type { Meta, StoryObj } from "@storybook/react-vite";
import { withDashboard, inCard } from "../../../storybook/decorators";
import PeriodBarChart from "./PeriodBarChart";
import { callsBars, screensBars } from "../charts.mocks";

const meta = {
  title: "Components/Charts/PeriodBarChart",
  component: PeriodBarChart,
  decorators: [
    inCard,
    withDashboard,
    (Story) => (
      <div style={{ maxWidth: 420 }}>
        <Story />
      </div>
    ),
  ],
  args: { label: "Sales calls per day", unit: "calls", slot: 2, bars: callsBars, quota: 10 },
} satisfies Meta<typeof PeriodBarChart>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A target per day: the dashed quota line, days under it lighter, "n/14 hit" in the header. */
export const WithQuota: Story = {};

/** Amounts per week with no quota (the dashboard's "Show check-ins by" on a sum metric). */
export const NoQuota: Story = { args: { label: "Screens done per week", unit: "", slot: 1, bars: screensBars, quota: null } };

/** No periods to show: just the baseline. */
export const Empty: Story = { args: { bars: [] } };
