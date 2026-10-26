import type { Decorator } from "@storybook/react-vite";
import { DASHBOARD_CSS } from "../components/dashboardStyles";

/**
 * For a piece of the dashboard shown on its own: the dashboard's styles
 * and the `.gn-dashboard` root its color tokens live on (screens add both
 * themselves).
 */
export const withDashboard: Decorator = (Story) => (
  <div className="gn-dashboard gn-viz">
    <style href="goalnexa-dashboard" precedence="default">
      {DASHBOARD_CSS}
    </style>
    <Story />
  </div>
);

/** A Tabler card around the story - for panels a host puts in one. */
export const inCard: Decorator = (Story) => (
  <div className="card">
    <div className="card-body">
      <Story />
    </div>
  </div>
);
